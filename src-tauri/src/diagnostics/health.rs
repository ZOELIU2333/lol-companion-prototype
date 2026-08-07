use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use crate::{
    lcu::{
        client::{
            read_arena_lcu_session_from_path, read_lcu_session_from_path, CandidateCapability,
        },
        discovery::{discover_lockfile, telemetry::safe_path, DiscoveryReport, ProbeStatus},
    },
    live_client::{read_live_client_snapshot, LiveClientReadingPayload, LiveClientReadingState},
};

use super::configured_log_dir;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum HealthStatus {
    Ready,
    Degraded,
    Unavailable,
    Unsupported,
    Stale,
    Error,
    Missing,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheck {
    code: String,
    status: HealthStatus,
    detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    recovery_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    safe_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    age_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHealthSnapshot {
    generated_at_ms: u128,
    shell: HealthCheck,
    webview2: HealthCheck,
    league_discovery: HealthCheck,
    lcu: HealthCheck,
    live_client: HealthCheck,
    augment_capability: HealthCheck,
    catalog: HealthCheck,
    runtime_cache: HealthCheck,
    logs: HealthCheck,
}

fn check(code: &str, status: HealthStatus, detail: impl Into<String>) -> HealthCheck {
    HealthCheck {
        code: code.to_owned(),
        status,
        detail: detail.into(),
        recovery_code: None,
        safe_path: None,
        age_seconds: None,
        version: None,
    }
}

fn recovery(mut health: HealthCheck, code: &str) -> HealthCheck {
    health.recovery_code = Some(code.to_owned());
    health
}

fn with_path(mut health: HealthCheck, path: &Path) -> HealthCheck {
    health.safe_path = Some(safe_path(path));
    health
}

fn league_health(report: &DiscoveryReport) -> HealthCheck {
    if let Some(path) = report.selected_path.as_deref() {
        return with_path(
            check("league-found", HealthStatus::Ready, "已找到 League 客户端"),
            path.parent().unwrap_or(path),
        );
    }
    let has_invalid_candidate = report.probes.iter().any(|probe| {
        matches!(
            probe.status,
            ProbeStatus::NotFile | ProbeStatus::Unreadable | ProbeStatus::InvalidFormat
        )
    });
    if has_invalid_candidate {
        let parse_detail = report
            .probes
            .iter()
            .find_map(|probe| probe.parse_error)
            .map(|error| format!("（{error}）"))
            .unwrap_or_default();
        recovery(
            check(
                "league-invalid",
                HealthStatus::Degraded,
                format!("找到了 League 路径，但 lockfile 无法解析{parse_detail}"),
            ),
            "select-league-path",
        )
    } else {
        recovery(
            check(
                "league-not-found",
                HealthStatus::Missing,
                "未找到 League 安装或 lockfile",
            ),
            "select-league-path",
        )
    }
}

fn lcu_health(report: &DiscoveryReport, session_ready: bool) -> HealthCheck {
    if session_ready {
        check("lcu-ready", HealthStatus::Ready, "LCU 本地接口可用")
    } else if report.selected_path.is_some() {
        recovery(
            check(
                "lcu-unreachable",
                HealthStatus::Degraded,
                "已找到 League，但 LCU 暂时不可连接",
            ),
            "retry",
        )
    } else {
        recovery(
            check(
                "lcu-missing",
                HealthStatus::Missing,
                "等待 League 客户端启动或手动选择路径",
            ),
            "select-league-path",
        )
    }
}

fn live_client_health(reading: &LiveClientReadingPayload) -> HealthCheck {
    match reading.state {
        LiveClientReadingState::Fresh => check(
            "live-client-ready",
            HealthStatus::Ready,
            "Live Client 实时接口可用",
        ),
        LiveClientReadingState::Reconnecting => {
            let mut health = recovery(
                check(
                    "live-client-reconnecting",
                    HealthStatus::Stale,
                    "Live Client 正在重连，暂时保留最近快照",
                ),
                "retry",
            );
            health.age_seconds = reading.age_seconds;
            health
        }
        LiveClientReadingState::Unavailable => {
            let mut health = recovery(
                check(
                    "live-client-waiting",
                    HealthStatus::Unavailable,
                    "尚未进入游戏或 2999 接口不可用",
                ),
                "retry",
            );
            health.age_seconds = reading.age_seconds;
            health
        }
    }
}

fn catalog_health() -> HealthCheck {
    let raw = include_str!("../../../public/data/arena/manifest.json");
    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(manifest)
            if manifest
                .get("count")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or_default()
                > 0
                && manifest
                    .get("contentHash")
                    .and_then(serde_json::Value::as_str)
                    .is_some() =>
        {
            let mut health = check(
                "catalog-ready",
                HealthStatus::Ready,
                "内置海克斯目录校验通过",
            );
            health.version = manifest
                .get("contentHash")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned);
            health
        }
        _ => recovery(
            check("catalog-invalid", HealthStatus::Error, "内置海克斯目录损坏"),
            "retry",
        ),
    }
}

fn runtime_cache_path() -> Option<PathBuf> {
    configured_log_dir()?
        .parent()
        .map(|parent| parent.join("arena-runtime-cache.json"))
}

fn runtime_cache_health(path: Option<&Path>) -> HealthCheck {
    let Some(path) = path else {
        return check("cache-unused", HealthStatus::Ready, "当前使用内置目录");
    };
    if !path.exists() {
        return with_path(
            check(
                "cache-missing",
                HealthStatus::Ready,
                "运行缓存不存在，使用内置目录",
            ),
            path,
        );
    }
    match fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
    {
        Some(_) => with_path(
            check("cache-ready", HealthStatus::Ready, "运行缓存有效"),
            path,
        ),
        None => with_path(
            recovery(
                check(
                    "cache-corrupt",
                    HealthStatus::Degraded,
                    "运行缓存损坏，已回退到内置目录",
                ),
                "discard-cache",
            ),
            path,
        ),
    }
}

#[tauri::command]
pub async fn get_desktop_health() -> DesktopHealthSnapshot {
    let discovery_report = discover_lockfile();
    let lockfile_path = discovery_report.selected_path.clone();
    let (lcu_session, arena_session, live_reading) = tokio::join!(
        read_lcu_session_from_path(lockfile_path.as_deref()),
        read_arena_lcu_session_from_path(lockfile_path.as_deref()),
        read_live_client_snapshot()
    );

    let league_discovery = league_health(&discovery_report);
    let lcu = lcu_health(&discovery_report, lcu_session.is_some());
    let live_client = live_client_health(&live_reading);
    let augment_capability = match arena_session
        .as_ref()
        .map(|session| session.candidate_capability())
    {
        Some(CandidateCapability::Available) => check(
            "augment-ready",
            HealthStatus::Ready,
            "可自动读取本轮海克斯候选",
        ),
        Some(CandidateCapability::Unsupported) => recovery(
            check(
                "augment-unsupported",
                HealthStatus::Unsupported,
                "当前客户端未提供候选接口",
            ),
            "manual-arena",
        ),
        Some(CandidateCapability::Error) => recovery(
            check(
                "augment-error",
                HealthStatus::Error,
                "海克斯候选接口返回错误",
            ),
            "manual-arena",
        ),
        _ => recovery(
            check(
                "augment-unavailable",
                HealthStatus::Unavailable,
                "等待竞技场对局",
            ),
            "manual-arena",
        ),
    };
    let logs = configured_log_dir().map_or_else(
        || {
            recovery(
                check("logs-missing", HealthStatus::Error, "日志系统未初始化"),
                "export-diagnostics",
            )
        },
        |path| {
            with_path(
                check("logs-ready", HealthStatus::Ready, "脱敏滚动日志已启用"),
                path,
            )
        },
    );
    let cache_path = runtime_cache_path();

    DesktopHealthSnapshot {
        generated_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        shell: check("shell-ready", HealthStatus::Ready, "Tauri 桌面壳已启动"),
        webview2: check(
            "webview2-ready",
            HealthStatus::Ready,
            "WebView2 Runtime 可用",
        ),
        league_discovery,
        lcu,
        live_client,
        augment_capability,
        catalog: catalog_health(),
        runtime_cache: runtime_cache_health(cache_path.as_deref()),
        logs,
    }
}

#[tauri::command]
pub fn discard_runtime_cache() -> Result<bool, String> {
    let Some(path) = runtime_cache_path() else {
        return Ok(false);
    };
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(path).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use crate::{
        lcu::discovery::{
            CandidateProbe, DiscoveryReport, DiscoverySource, LockfileParseError, ProbeStatus,
        },
        live_client::{LiveClientFailureKind, LiveClientReadingPayload, LiveClientReadingState},
    };

    use super::{
        catalog_health, league_health, live_client_health, runtime_cache_health, HealthStatus,
    };

    #[test]
    fn bundled_catalog_is_valid() {
        assert!(matches!(catalog_health().status, HealthStatus::Ready));
    }

    #[test]
    fn corrupt_cache_is_degraded_without_exposing_contents() {
        let path = std::env::temp_dir().join(format!(
            "lol-companion-corrupt-cache-{}.json",
            std::process::id()
        ));
        fs::write(&path, r#"{"password":"secret""#).expect("write cache");
        let health = runtime_cache_health(Some(&path));
        assert!(matches!(health.status, HealthStatus::Degraded));
        assert!(!health.detail.contains("secret"));
        fs::remove_file(path).expect("remove cache");
    }

    #[test]
    fn invalid_candidates_are_degraded_not_missing() {
        let report = DiscoveryReport {
            correlation_id: 1,
            selected_path: None,
            selected_source: None,
            probes: vec![CandidateProbe {
                source: DiscoverySource::Saved,
                path: "C:/Riot Games/League of Legends/lockfile".into(),
                status: ProbeStatus::InvalidFormat,
                parse_error: Some(LockfileParseError::InvalidProtocol),
            }],
        };
        let health = league_health(&report);
        assert!(matches!(health.status, HealthStatus::Degraded));
        assert!(health.detail.contains("协议无效"));
        assert!(!health.detail.contains("secret"));
    }

    #[test]
    fn reconnecting_live_client_is_stale_with_age() {
        let reading = LiveClientReadingPayload {
            state: LiveClientReadingState::Reconnecting,
            snapshot: None,
            age_seconds: Some(6),
            failure_kind: Some(LiveClientFailureKind::Timeout),
        };
        let health = live_client_health(&reading);

        assert!(matches!(health.status, HealthStatus::Stale));
        assert_eq!(health.code, "live-client-reconnecting");
        assert_eq!(health.age_seconds, Some(6));
    }
}
