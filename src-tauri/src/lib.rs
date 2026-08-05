use std::{env, time::Duration};

pub mod diagnostics;
mod lcu;
mod live_client;

use diagnostics::{
    export::export_diagnostics,
    health::{discard_runtime_cache, get_desktop_health},
};
use lcu::client::{read_arena_lcu_session, read_lcu_session};
use lcu::discovery::config::choose_league_installation;
use live_client::read_live_client_snapshot;

#[tauri::command]
fn report_frontend_status(stage: String, detail: Option<String>) {
    let safe_stage = match stage.as_str() {
        "html-loaded"
        | "module-error"
        | "unhandled-rejection"
        | "frontend-timeout"
        | "frontend-ready" => stage,
        _ => "unknown".to_owned(),
    };
    let safe_detail = diagnostics::redact::redact(
        &detail
            .unwrap_or_default()
            .chars()
            .take(500)
            .collect::<String>(),
    );
    if safe_stage == "frontend-ready" || safe_stage == "html-loaded" {
        tracing::info!(stage = %safe_stage, detail = %safe_detail, "frontend status changed");
    } else {
        tracing::warn!(stage = %safe_stage, detail = %safe_detail, "frontend status changed");
    }
}

fn is_allowed_riot_api_url(raw_url: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(raw_url) else {
        return false;
    };

    if let Ok(base_url) = env::var("RIOT_API_BASE_URL") {
        if let Ok(base_url) = reqwest::Url::parse(&base_url) {
            return url.scheme() == base_url.scheme()
                && url.host_str() == base_url.host_str()
                && url.port_or_known_default() == base_url.port_or_known_default();
        }
    }

    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.ends_with(".api.riotgames.com"))
}

#[tauri::command]
async fn riot_api_get(url: String) -> Option<serde_json::Value> {
    if !is_allowed_riot_api_url(&url) {
        return None;
    }

    let api_key = env::var("RIOT_API_KEY")
        .or_else(|_| env::var("VITE_RIOT_API_KEY"))
        .ok()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(2600))
        .build()
        .ok()?;

    client
        .get(url)
        .header("X-Riot-Token", api_key)
        .send()
        .await
        .ok()?
        .json::<serde_json::Value>()
        .await
        .ok()
}

fn is_allowed_opgg_mcp_tool(tool_name: &str) -> bool {
    matches!(
        tool_name,
        "lol_get_champion_analysis"
            | "lol_get_summoner_profile"
            | "lol_list_summoner_matches"
            | "lol_get_summoner_game_detail"
    )
}

#[tauri::command]
async fn opgg_mcp_call(
    tool_name: String,
    arguments: serde_json::Value,
) -> Option<serde_json::Value> {
    if !is_allowed_opgg_mcp_tool(&tool_name) {
        return None;
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(3200))
        .build()
        .ok()?;
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "id": tool_name,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    });

    client
        .post("https://mcp-api.op.gg/mcp")
        .header("Accept", "application/json, text/event-stream")
        .json(&payload)
        .send()
        .await
        .ok()?
        .json::<serde_json::Value>()
        .await
        .ok()
}

#[tauri::command]
fn set_overlay_always_on_top(window: tauri::Window, enabled: bool) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_overlay_compact(window: tauri::Window, enabled: bool) -> Result<(), String> {
    let (width, height) = if enabled {
        (380.0, 620.0)
    } else {
        (460.0, 760.0)
    };
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), String> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            choose_league_installation,
            discard_runtime_cache,
            export_diagnostics,
            get_desktop_health,
            opgg_mcp_call,
            report_frontend_status,
            read_arena_lcu_session,
            read_lcu_session,
            read_live_client_snapshot,
            riot_api_get,
            set_overlay_always_on_top,
            set_overlay_compact
        ])
        .run(tauri::generate_context!())
        .map_err(|error| error.to_string())
}
