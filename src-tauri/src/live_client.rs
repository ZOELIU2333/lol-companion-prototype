use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    sync::{Mutex, OnceLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const LIVE_CLIENT_STALE_AFTER_SECONDS: u64 = 10;
const LIVE_CLIENT_TIMEOUT: Duration = Duration::from_millis(2_500);
const LIVE_CLIENT_RETRY_DELAY: Duration = Duration::from_millis(150);

static LIVE_CLIENT: OnceLock<Result<reqwest::Client, ()>> = OnceLock::new();
static TRACKER: OnceLock<Mutex<LiveClientTracker>> = OnceLock::new();
static LAST_LOGGED_READING: OnceLock<
    Mutex<Option<(LiveClientReadingState, Option<LiveClientFailureKind>)>>,
> = OnceLock::new();

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LiveClientReadingState {
    Fresh,
    Reconnecting,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LiveClientFailureKind {
    Connection,
    Timeout,
    Tls,
    Http,
    Json,
    Payload,
    Client,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveClientReadingPayload {
    pub state: LiveClientReadingState,
    pub snapshot: Option<LiveClientSnapshotPayload>,
    pub age_seconds: Option<u64>,
    pub failure_kind: Option<LiveClientFailureKind>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LiveClientFailure {
    kind: LiveClientFailureKind,
    http_status: Option<u16>,
}

impl LiveClientFailure {
    fn new(kind: LiveClientFailureKind) -> Self {
        Self {
            kind,
            http_status: None,
        }
    }
}

#[derive(Debug, Default)]
struct LiveClientTracker {
    last_success: Option<(LiveClientSnapshotPayload, u64)>,
}

impl LiveClientTracker {
    fn record_success(
        &mut self,
        snapshot: LiveClientSnapshotPayload,
        observed_at: u64,
    ) -> LiveClientReadingPayload {
        self.last_success = Some((snapshot.clone(), observed_at));
        LiveClientReadingPayload {
            state: LiveClientReadingState::Fresh,
            snapshot: Some(snapshot),
            age_seconds: Some(0),
            failure_kind: None,
        }
    }

    fn record_failure(
        &mut self,
        failure_kind: LiveClientFailureKind,
        observed_at: u64,
    ) -> LiveClientReadingPayload {
        let Some((snapshot, last_success_at)) = self.last_success.as_ref() else {
            return LiveClientReadingPayload {
                state: LiveClientReadingState::Unavailable,
                snapshot: None,
                age_seconds: None,
                failure_kind: Some(failure_kind),
            };
        };
        let age_seconds = observed_at.saturating_sub(*last_success_at);
        if age_seconds <= LIVE_CLIENT_STALE_AFTER_SECONDS {
            return LiveClientReadingPayload {
                state: LiveClientReadingState::Reconnecting,
                snapshot: Some(snapshot.clone()),
                age_seconds: Some(age_seconds),
                failure_kind: Some(failure_kind),
            };
        }
        self.last_success = None;
        LiveClientReadingPayload {
            state: LiveClientReadingState::Unavailable,
            snapshot: None,
            age_seconds: Some(age_seconds),
            failure_kind: Some(failure_kind),
        }
    }
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
    let game_data = payload.game_data.as_ref()?;
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
        game_mode: game_data.game_mode.clone(),
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

fn live_client() -> Result<&'static reqwest::Client, LiveClientFailure> {
    LIVE_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(LIVE_CLIENT_TIMEOUT)
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|_| ())
        })
        .as_ref()
        .map_err(|_| LiveClientFailure::new(LiveClientFailureKind::Client))
}

fn classify_transport_error(error: &reqwest::Error) -> LiveClientFailure {
    let kind = if error.is_timeout() {
        LiveClientFailureKind::Timeout
    } else if error
        .to_string()
        .to_ascii_lowercase()
        .contains("certificate")
        || error.to_string().to_ascii_lowercase().contains("tls")
    {
        LiveClientFailureKind::Tls
    } else if error.is_connect() {
        LiveClientFailureKind::Connection
    } else {
        LiveClientFailureKind::Client
    };
    LiveClientFailure::new(kind)
}

async fn read_once() -> Result<LiveClientSnapshotPayload, LiveClientFailure> {
    let response = live_client()?
        .get(format!(
            "{}/liveclientdata/allgamedata",
            live_client_data_base_url()
        ))
        .send()
        .await
        .map_err(|error| classify_transport_error(&error))?;
    let status = response.status();
    let response = response.error_for_status().map_err(|_| LiveClientFailure {
        kind: LiveClientFailureKind::Http,
        http_status: Some(status.as_u16()),
    })?;
    let payload = response
        .json::<Value>()
        .await
        .map_err(|_| LiveClientFailure::new(LiveClientFailureKind::Json))?;
    parse_live_client_snapshot(payload)
        .ok_or_else(|| LiveClientFailure::new(LiveClientFailureKind::Payload))
}

fn update_tracker(
    result: Result<LiveClientSnapshotPayload, LiveClientFailure>,
) -> LiveClientReadingPayload {
    let now = unix_seconds();
    let mut tracker = TRACKER
        .get_or_init(|| Mutex::new(LiveClientTracker::default()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    match result {
        Ok(snapshot) => tracker.record_success(snapshot, now),
        Err(failure) => tracker.record_failure(failure.kind, now),
    }
}

fn log_transition(reading: &LiveClientReadingPayload, failure: Option<LiveClientFailure>) {
    let key = (reading.state, reading.failure_kind);
    let mut last = LAST_LOGGED_READING
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if last.as_ref() == Some(&key) {
        return;
    }
    *last = Some(key);
    tracing::info!(
        state = ?reading.state,
        failure_kind = ?reading.failure_kind,
        age_seconds = reading.age_seconds,
        http_status = failure.and_then(|value| value.http_status),
        "Live Client state changed"
    );
}

#[tauri::command]
pub async fn read_live_client_snapshot() -> LiveClientReadingPayload {
    let result = match read_once().await {
        Ok(snapshot) => Ok(snapshot),
        Err(first) => {
            tokio::time::sleep(LIVE_CLIENT_RETRY_DELAY).await;
            read_once()
                .await
                .map_err(|second| if second == first { first } else { second })
        }
    };
    let failure = result.as_ref().err().copied();
    let reading = update_tracker(result);
    log_transition(&reading, failure);
    reading
}

#[cfg(test)]
mod tests {
    use super::{
        parse_live_client_snapshot, LiveClientFailureKind, LiveClientReadingState,
        LiveClientSnapshotPayload, LiveClientTracker,
    };
    use serde_json::json;

    fn fixture_snapshot() -> LiveClientSnapshotPayload {
        LiveClientSnapshotPayload {
            game_time: 120.0,
            game_mode: Some("CHERRY".to_owned()),
            active_player_name: Some("Zoe".to_owned()),
            champion_name: Some("Ahri".to_owned()),
            level: Some(9),
            current_gold: Some(1475),
            current_item_ids: vec![4629],
            source: "live-client-data".to_owned(),
        }
    }

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

    #[test]
    fn transient_failure_reconnects_then_expires() {
        let mut tracker = LiveClientTracker::default();
        tracker.record_success(fixture_snapshot(), 100);

        let reconnecting = tracker.record_failure(LiveClientFailureKind::Timeout, 106);
        assert_eq!(reconnecting.state, LiveClientReadingState::Reconnecting);
        assert_eq!(reconnecting.age_seconds, Some(6));
        assert!(reconnecting.snapshot.is_some());

        let unavailable = tracker.record_failure(LiveClientFailureKind::Timeout, 111);
        assert_eq!(unavailable.state, LiveClientReadingState::Unavailable);
        assert_eq!(unavailable.age_seconds, Some(11));
        assert!(unavailable.snapshot.is_none());
    }

    #[test]
    fn success_after_failure_is_fresh_again() {
        let mut tracker = LiveClientTracker::default();
        tracker.record_success(fixture_snapshot(), 100);
        tracker.record_failure(LiveClientFailureKind::Connection, 105);

        let reading = tracker.record_success(fixture_snapshot(), 106);
        assert_eq!(reading.state, LiveClientReadingState::Fresh);
        assert_eq!(reading.age_seconds, Some(0));
        assert_eq!(reading.failure_kind, None);
        assert!(reading.snapshot.is_some());
    }

    #[test]
    fn reading_serializes_for_the_typescript_bridge() {
        let mut tracker = LiveClientTracker::default();
        tracker.record_success(fixture_snapshot(), 100);
        let reading = tracker.record_failure(LiveClientFailureKind::Timeout, 106);
        let value = serde_json::to_value(reading).expect("serialize reading");

        assert_eq!(value["state"], "reconnecting");
        assert_eq!(value["ageSeconds"], 6);
        assert_eq!(value["failureKind"], "timeout");
        assert_eq!(value["snapshot"]["championName"], "Ahri");
    }
}
