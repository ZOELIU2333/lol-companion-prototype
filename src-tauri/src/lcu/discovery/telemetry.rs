use std::{
    path::Path,
    sync::{Mutex, OnceLock},
};

use super::DiscoveryReport;

static LAST_REPORT_KEY: OnceLock<Mutex<Option<String>>> = OnceLock::new();

pub fn safe_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    let separator = if raw.contains('\\') { '\\' } else { '/' };
    let mut parts = raw.split(separator).map(str::to_owned).collect::<Vec<_>>();
    let user_index = parts
        .iter()
        .position(|part| part.eq_ignore_ascii_case("Users"))
        .and_then(|index| (index + 1 < parts.len()).then_some(index + 1));
    if let Some(index) = user_index {
        parts[index] = "[USER]".to_owned();
    }
    if let (Some(user_index), Some(league_index)) = (
        user_index,
        parts
            .iter()
            .position(|part| part.eq_ignore_ascii_case("League of Legends")),
    ) {
        if league_index > user_index + 1 {
            parts.splice(user_index + 1..league_index, ["...".to_owned()]);
        }
    }
    parts.join(&separator.to_string())
}

fn report_key(report: &DiscoveryReport) -> String {
    let probes = report
        .probes
        .iter()
        .map(|probe| {
            format!(
                "{:?}:{:?}{}",
                probe.source,
                probe.status,
                probe
                    .parse_error
                    .map(|error| format!("({error:?})"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    format!("{:?}|{probes}", report.selected_source)
}

pub fn record_report(report: &DiscoveryReport) {
    let key = report_key(report);
    let mut last_key = LAST_REPORT_KEY
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if last_key.as_deref() == Some(key.as_str()) {
        return;
    }
    *last_key = Some(key);
    let selected_path = report
        .selected_path
        .as_deref()
        .map(safe_path)
        .unwrap_or_default();
    let probes = report
        .probes
        .iter()
        .map(|probe| {
            format!(
                "{:?}:{:?}{}",
                probe.source,
                probe.status,
                probe
                    .parse_error
                    .map(|error| format!("({error:?})"))
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>();
    tracing::info!(
        correlation_id = report.correlation_id,
        selected_source = ?report.selected_source,
        selected_path = %selected_path,
        probes = ?probes,
        "League client discovery changed"
    );
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::safe_path;

    #[test]
    fn safe_path_removes_windows_username_and_credentials() {
        let safe = safe_path(Path::new(
            r"C:\Users\Administrator\Riot Games\League of Legends\lockfile",
        ));
        assert_eq!(safe, r"C:\Users\[USER]\...\League of Legends\lockfile");
        assert!(!safe.contains("Administrator"));
    }
}
