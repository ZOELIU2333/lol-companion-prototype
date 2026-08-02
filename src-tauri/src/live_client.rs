use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

static LAST_SUCCESS_UNIX_SECONDS: AtomicU64 = AtomicU64::new(0);

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn last_success_age_seconds() -> Option<u64> {
    let observed = LAST_SUCCESS_UNIX_SECONDS.load(Ordering::Relaxed);
    (observed > 0).then(|| unix_seconds().saturating_sub(observed))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveClientSnapshotPayload {
    pub game_time: f64,
    pub game_mode: Option<String>,
    pub active_player_name: Option<String>,
    pub champion_name: Option<String>,
    pub level: Option<u16>,
    pub current_gold: Option<u32>,
    pub current_item_ids: Vec<u16>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientAllData {
    active_player: Option<LiveClientActivePlayer>,
    all_players: Option<Vec<LiveClientPlayer>>,
    game_data: Option<LiveClientGameData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientActivePlayer {
    current_gold: Option<f64>,
    level: Option<u16>,
    summoner_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientGameData {
    game_mode: Option<String>,
    game_time: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientPlayer {
    champion_name: Option<String>,
    items: Option<Vec<LiveClientItem>>,
    level: Option<u16>,
    summoner_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientItem {
    #[serde(rename = "itemID")]
    item_id: Option<u16>,
}

fn live_client_data_base_url() -> String {
    env::var("LIVE_CLIENT_DATA_BASE_URL")
        .unwrap_or_else(|_| "https://127.0.0.1:2999".to_string())
        .trim_end_matches('/')
        .to_string()
}

pub fn parse_live_client_snapshot(value: Value) -> Option<LiveClientSnapshotPayload> {
    let payload: LiveClientAllData = serde_json::from_value(value).ok()?;
    let active_name = payload
        .active_player
        .as_ref()
        .and_then(|active| active.summoner_name.clone());
    let active_player = active_name
        .as_ref()
        .and_then(|name| {
            payload.all_players.as_ref()?.iter().find(|player| {
                player
                    .summoner_name
                    .as_ref()
                    .is_some_and(|candidate| candidate == name)
            })
        })
        .or_else(|| payload.all_players.as_ref()?.first());
    Some(LiveClientSnapshotPayload {
        game_time: payload
            .game_data
            .as_ref()
            .and_then(|data| data.game_time)
            .unwrap_or_default(),
        game_mode: payload
            .game_data
            .as_ref()
            .and_then(|data| data.game_mode.clone()),
        active_player_name: active_name,
        champion_name: active_player.and_then(|player| player.champion_name.clone()),
        level: payload
            .active_player
            .as_ref()
            .and_then(|active| active.level)
            .or_else(|| active_player.and_then(|player| player.level)),
        current_gold: payload
            .active_player
            .as_ref()
            .and_then(|active| active.current_gold)
            .map(|gold| gold.max(0.0).round() as u32),
        current_item_ids: active_player
            .and_then(|player| player.items.as_ref())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.item_id)
                    .filter(|id| *id > 0)
                    .collect()
            })
            .unwrap_or_default(),
        source: "live-client-data".to_string(),
    })
}

#[tauri::command]
pub async fn read_live_client_snapshot() -> Option<LiveClientSnapshotPayload> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(900))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;
    let payload = client
        .get(format!(
            "{}/liveclientdata/allgamedata",
            live_client_data_base_url()
        ))
        .send()
        .await
        .ok()?
        .json::<Value>()
        .await
        .ok()?;
    let snapshot = parse_live_client_snapshot(payload)?;
    LAST_SUCCESS_UNIX_SECONDS.store(unix_seconds(), Ordering::Relaxed);
    Some(snapshot)
}

#[cfg(test)]
mod tests {
    use super::parse_live_client_snapshot;
    use serde_json::json;

    #[test]
    fn parses_item_ids_and_ignores_unknown_fields() {
        let snapshot = parse_live_client_snapshot(json!({
            "activePlayer": { "summonerName": "Zoe", "level": 9, "currentGold": 1475.4 },
            "allPlayers": [{
                "summonerName": "Zoe",
                "championName": "Ahri",
                "items": [{ "itemID": 4629 }, { "itemID": 0 }],
                "futureField": "ignored"
            }],
            "gameData": { "gameMode": "CHERRY", "gameTime": 914.2 },
            "unknownRoot": true
        }))
        .expect("snapshot");

        assert_eq!(snapshot.current_item_ids, vec![4629]);
        assert_eq!(snapshot.champion_name.as_deref(), Some("Ahri"));
        assert_eq!(snapshot.level, Some(9));
    }

    #[test]
    fn missing_payload_is_unavailable() {
        assert!(parse_live_client_snapshot(json!(null)).is_none());
    }
}
