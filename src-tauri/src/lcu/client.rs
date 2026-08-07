use super::{credentials::LcuCredentials, discovery::discover_lockfile};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    sync::{Mutex, OnceLock},
    time::Duration,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LcuSessionPayload {
    phase: String,
    mode: Option<String>,
    local_summoner_name: Option<String>,
    players: Vec<LcuPlayerPayload>,
    source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuPlayerPayload {
    id: String,
    team: String,
    role: Option<String>,
    champion_id: Option<u16>,
    summoner_id: Option<u64>,
    summoner_name: Option<String>,
    riot_account: LcuRiotAccountPayload,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuRiotAccountPayload {
    game_name: Option<String>,
    puuid: Option<String>,
    tag_line: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameflowSession {
    game_data: Option<GameflowGameData>,
}

#[derive(Debug, Deserialize)]
struct GameflowGameData {
    queue: Option<GameflowQueue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameflowQueue {
    description: Option<String>,
    game_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurrentSummoner {
    display_name: Option<String>,
    game_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChampSelectSession {
    local_player_cell_id: Option<u16>,
    my_team: Option<Vec<ChampSelectParticipant>>,
    their_team: Option<Vec<ChampSelectParticipant>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChampSelectParticipant {
    assigned_position: Option<String>,
    cell_id: Option<u16>,
    champion_id: Option<u16>,
    puuid: Option<String>,
    summoner_id: Option<u64>,
    summoner_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SummonerIdentity {
    display_name: Option<String>,
    game_name: Option<String>,
    internal_name: Option<String>,
    puuid: Option<String>,
    tag_line: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CandidateCapability {
    Available,
    Unsupported,
    Unavailable,
    Error,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArenaLcuSnapshot {
    mode: Option<String>,
    champion_key: Option<u16>,
    round: Option<u16>,
    selected_augment_ids: Vec<u32>,
    candidate_augment_ids: Vec<u32>,
    candidate_capability: CandidateCapability,
    source: String,
}

impl ArenaLcuSnapshot {
    pub fn candidate_capability(&self) -> CandidateCapability {
        self.candidate_capability
    }
}

#[derive(Debug)]
pub struct ArenaFields {
    pub round: Option<u16>,
    pub selected_augment_ids: Vec<u32>,
    pub candidate_augment_ids: Vec<u32>,
    pub candidate_capability: CandidateCapability,
}

enum LcuValueResponse {
    Available(Value),
    Unsupported,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LcuOutcome {
    NoLockfile,
    ConnectError,
    HttpError(u16),
    Ready,
}

static LAST_LCU_OUTCOME: OnceLock<Mutex<Option<LcuOutcome>>> = OnceLock::new();

fn record_lcu_outcome(outcome: LcuOutcome) {
    let mut previous = LAST_LCU_OUTCOME
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if previous.as_ref() == Some(&outcome) {
        return;
    }
    *previous = Some(outcome);
    match outcome {
        LcuOutcome::NoLockfile => tracing::info!(outcome = "no-lockfile", "LCU state changed"),
        LcuOutcome::ConnectError => {
            tracing::warn!(outcome = "connect-error", "LCU state changed")
        }
        LcuOutcome::HttpError(status) => {
            tracing::warn!(outcome = "http-error", status, "LCU state changed")
        }
        LcuOutcome::Ready => tracing::info!(outcome = "ready", "LCU state changed"),
    }
}

#[derive(Debug, Clone, Copy)]
enum LcuRequestError {
    Connect,
    Http(u16),
}

pub fn map_queue_to_mode(queue: Option<&str>) -> Option<String> {
    let raw = queue.unwrap_or_default().to_lowercase();
    if raw.contains("arena") || raw.contains("cherry") || raw.contains("海克斯") {
        return Some("arena".to_string());
    }
    if raw.contains("rank")
        || raw.contains("normal")
        || raw.contains("匹配")
        || raw.contains("排位")
    {
        return Some("ranked".to_string());
    }
    None
}

fn map_position_to_role(position: Option<&str>) -> Option<String> {
    match position.unwrap_or_default().to_uppercase().as_str() {
        "TOP" => Some("上单".to_string()),
        "JUNGLE" => Some("打野".to_string()),
        "MIDDLE" | "MID" => Some("中路".to_string()),
        "BOTTOM" | "ADC" => Some("下路".to_string()),
        "UTILITY" | "SUPPORT" => Some("辅助".to_string()),
        _ => None,
    }
}

async fn request_lcu_json_result<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    lockfile: &LcuCredentials,
    path: &str,
) -> Result<T, LcuRequestError> {
    let url = format!(
        "{}://127.0.0.1:{}{}",
        lockfile.protocol(),
        lockfile.port(),
        path
    );
    let response = client
        .get(url)
        .basic_auth("riot", Some(lockfile.password()))
        .send()
        .await
        .map_err(|_| LcuRequestError::Connect)?;
    let status = response.status();
    if !status.is_success() {
        return Err(LcuRequestError::Http(status.as_u16()));
    }
    response
        .json()
        .await
        .map_err(|_| LcuRequestError::Http(status.as_u16()))
}

async fn request_lcu_json<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    lockfile: &LcuCredentials,
    path: &str,
) -> Option<T> {
    request_lcu_json_result(client, lockfile, path).await.ok()
}

async fn request_lcu_value(
    client: &reqwest::Client,
    lockfile: &LcuCredentials,
    path: &str,
) -> LcuValueResponse {
    let url = format!(
        "{}://127.0.0.1:{}{}",
        lockfile.protocol(),
        lockfile.port(),
        path
    );
    let response = match client
        .get(url)
        .basic_auth("riot", Some(lockfile.password()))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return LcuValueResponse::Error,
    };
    if response.status() == StatusCode::NOT_FOUND {
        return LcuValueResponse::Unsupported;
    }
    if !response.status().is_success() {
        return LcuValueResponse::Error;
    }
    response
        .json::<Value>()
        .await
        .map(LcuValueResponse::Available)
        .unwrap_or(LcuValueResponse::Error)
}

fn find_key<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            for key in keys {
                if let Some(found) = map.get(*key) {
                    return Some(found);
                }
            }
            map.values().find_map(|child| find_key(child, keys))
        }
        Value::Array(values) => values.iter().find_map(|child| find_key(child, keys)),
        _ => None,
    }
}

fn number_array(value: &Value) -> Vec<u32> {
    value
        .as_array()
        .map(|values| {
            values
                .iter()
                .filter_map(|entry| {
                    entry.as_u64().map(|number| number as u32).or_else(|| {
                        find_key(entry, &["id", "augmentId"])
                            .and_then(Value::as_u64)
                            .map(|number| number as u32)
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn parse_arena_fields(value: &Value) -> ArenaFields {
    let round = find_key(value, &["round", "roundNumber", "currentRound"])
        .and_then(Value::as_u64)
        .map(|number| number as u16);
    let candidate_value = find_key(
        value,
        &["candidateAugmentIds", "augmentChoices", "candidates"],
    );
    let selected_value = find_key(
        value,
        &["selectedAugmentIds", "selectedAugments", "augments"],
    );
    ArenaFields {
        round,
        selected_augment_ids: selected_value.map(number_array).unwrap_or_default(),
        candidate_augment_ids: candidate_value.map(number_array).unwrap_or_default(),
        candidate_capability: if candidate_value.is_some() && round.is_some() {
            CandidateCapability::Available
        } else {
            CandidateCapability::Unsupported
        },
    }
}

async fn read_champ_select_players(
    client: &reqwest::Client,
    lockfile: &LcuCredentials,
) -> Vec<LcuPlayerPayload> {
    let Some(session) =
        request_lcu_json::<ChampSelectSession>(client, lockfile, "/lol-champ-select/v1/session")
            .await
    else {
        return Vec::new();
    };
    let participants = session
        .my_team
        .unwrap_or_default()
        .into_iter()
        .map(|player| ("ally".to_string(), player))
        .chain(
            session
                .their_team
                .unwrap_or_default()
                .into_iter()
                .map(|player| ("enemy".to_string(), player)),
        )
        .filter(|(_, player)| {
            player.summoner_id.is_some() || player.summoner_name.is_some() || player.puuid.is_some()
        });
    let mut players = Vec::new();
    for (index, (team, player)) in participants.enumerate() {
        let identity = match player.summoner_id {
            Some(summoner_id) => {
                request_lcu_json::<SummonerIdentity>(
                    client,
                    lockfile,
                    &format!("/lol-summoner/v1/summoners/{summoner_id}"),
                )
                .await
            }
            None => None,
        };
        let game_name = identity
            .as_ref()
            .and_then(|identity| identity.game_name.clone())
            .or_else(|| player.summoner_name.clone());
        let summoner_name = identity
            .as_ref()
            .and_then(|identity| {
                identity
                    .display_name
                    .clone()
                    .or_else(|| identity.game_name.clone())
                    .or_else(|| identity.internal_name.clone())
            })
            .or_else(|| player.summoner_name.clone());
        players.push(LcuPlayerPayload {
            id: format!(
                "{}-{}",
                team,
                player
                    .cell_id
                    .map(|value| value.to_string())
                    .or_else(|| player.summoner_id.map(|value| value.to_string()))
                    .unwrap_or_else(|| index.to_string())
            ),
            team,
            role: map_position_to_role(player.assigned_position.as_deref()),
            champion_id: player.champion_id.filter(|id| *id > 0),
            summoner_id: player.summoner_id,
            summoner_name,
            riot_account: LcuRiotAccountPayload {
                game_name,
                puuid: identity
                    .as_ref()
                    .and_then(|identity| identity.puuid.clone())
                    .or_else(|| player.puuid.clone()),
                tag_line: identity.and_then(|identity| identity.tag_line),
            },
        });
    }
    players
}

#[tauri::command]
pub async fn read_lcu_session() -> Option<LcuSessionPayload> {
    let report = discover_lockfile();
    read_lcu_session_from_credentials(report.selected_credentials.as_ref()).await
}

pub(crate) async fn read_lcu_session_from_credentials(
    credentials: Option<&LcuCredentials>,
) -> Option<LcuSessionPayload> {
    let Some(lockfile) = credentials else {
        record_lcu_outcome(LcuOutcome::NoLockfile);
        return None;
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1400))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|_| LcuOutcome::ConnectError)
        .ok();
    let Some(client) = client else {
        record_lcu_outcome(LcuOutcome::ConnectError);
        return None;
    };
    let phase = match request_lcu_json_result::<String>(
        &client,
        &lockfile,
        "/lol-gameflow/v1/gameflow-phase",
    )
    .await
    {
        Ok(phase) => phase,
        Err(LcuRequestError::Connect) => {
            record_lcu_outcome(LcuOutcome::ConnectError);
            return None;
        }
        Err(LcuRequestError::Http(status)) => {
            record_lcu_outcome(LcuOutcome::HttpError(status));
            return None;
        }
    };
    let gameflow =
        request_lcu_json::<GameflowSession>(&client, &lockfile, "/lol-gameflow/v1/session").await;
    let current_summoner = request_lcu_json::<CurrentSummoner>(
        &client,
        &lockfile,
        "/lol-summoner/v1/current-summoner",
    )
    .await;
    let queue = gameflow
        .as_ref()
        .and_then(|session| session.game_data.as_ref())
        .and_then(|data| data.queue.as_ref());
    let queue_text =
        queue.and_then(|queue| queue.description.as_deref().or(queue.game_mode.as_deref()));
    let players = if phase == "ChampSelect" {
        read_champ_select_players(&client, &lockfile).await
    } else {
        Vec::new()
    };
    let payload = LcuSessionPayload {
        phase,
        mode: map_queue_to_mode(queue_text),
        local_summoner_name: current_summoner
            .and_then(|summoner| summoner.display_name.or(summoner.game_name)),
        players,
        source: "lcu".to_string(),
    };
    record_lcu_outcome(LcuOutcome::Ready);
    Some(payload)
}

fn champion_from_champ_select(session: &ChampSelectSession) -> Option<u16> {
    let local_cell = session.local_player_cell_id?;
    session
        .my_team
        .as_ref()?
        .iter()
        .find(|player| player.cell_id == Some(local_cell))?
        .champion_id
        .filter(|id| *id > 0)
}

#[tauri::command]
pub async fn read_arena_lcu_session() -> Option<ArenaLcuSnapshot> {
    let report = discover_lockfile();
    read_arena_lcu_session_from_credentials(report.selected_credentials.as_ref()).await
}

pub(crate) async fn read_arena_lcu_session_from_credentials(
    credentials: Option<&LcuCredentials>,
) -> Option<ArenaLcuSnapshot> {
    let lockfile = credentials?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1400))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;
    let gameflow_value =
        request_lcu_json::<Value>(&client, &lockfile, "/lol-gameflow/v1/session").await?;
    let queue_text =
        find_key(&gameflow_value, &["description", "gameMode"]).and_then(Value::as_str);
    let mode = map_queue_to_mode(queue_text);
    let champ_select =
        request_lcu_json::<ChampSelectSession>(&client, &lockfile, "/lol-champ-select/v1/session")
            .await;
    let champion_key = champ_select
        .as_ref()
        .and_then(champion_from_champ_select)
        .or_else(|| {
            find_key(&gameflow_value, &["championId", "championKey"])
                .and_then(Value::as_u64)
                .map(|id| id as u16)
        });

    let mut fields = ArenaFields {
        round: None,
        selected_augment_ids: Vec::new(),
        candidate_augment_ids: Vec::new(),
        candidate_capability: if mode.as_deref() == Some("arena") {
            CandidateCapability::Unsupported
        } else {
            CandidateCapability::Unavailable
        },
    };
    let mut saw_error = false;
    for endpoint in if mode.as_deref() == Some("arena") {
        [Some("/lol-cherry/v1/session"), Some("/lol-cherry/v1/game")]
    } else {
        [None, None]
    }
    .into_iter()
    .flatten()
    {
        match request_lcu_value(&client, &lockfile, endpoint).await {
            LcuValueResponse::Available(value) => {
                let parsed = parse_arena_fields(&value);
                if parsed.candidate_capability == CandidateCapability::Available
                    || parsed.round.is_some()
                {
                    fields = parsed;
                    break;
                }
            }
            LcuValueResponse::Unsupported => {}
            LcuValueResponse::Error => saw_error = true,
        }
    }
    if saw_error && fields.candidate_capability == CandidateCapability::Unsupported {
        fields.candidate_capability = CandidateCapability::Error;
    }
    Some(ArenaLcuSnapshot {
        mode,
        champion_key,
        round: fields.round,
        selected_augment_ids: fields.selected_augment_ids,
        candidate_augment_ids: fields.candidate_augment_ids,
        candidate_capability: fields.candidate_capability,
        source: "lcu".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::{map_queue_to_mode, parse_arena_fields, CandidateCapability};
    use crate::lcu::lockfile::parse as parse_lockfile;
    use serde_json::json;

    #[test]
    fn rejects_a_malformed_lockfile() {
        assert!(parse_lockfile("LeagueClient:bad").is_err());
        assert!(parse_lockfile("LeagueClient:1:bad:secret:https").is_err());
    }

    #[test]
    fn maps_arena_queues_to_the_canonical_mode() {
        assert_eq!(map_queue_to_mode(Some("Arena")), Some("arena".to_string()));
        assert_eq!(
            map_queue_to_mode(Some("Ranked Solo")),
            Some("ranked".to_string())
        );
    }

    #[test]
    fn structurally_absent_candidate_fields_are_unsupported() {
        let parsed = parse_arena_fields(&json!({ "round": 2, "unknownFutureField": true }));
        assert_eq!(
            parsed.candidate_capability,
            CandidateCapability::Unsupported
        );
    }

    #[test]
    fn recognized_empty_candidates_are_available_only_with_round_state() {
        let parsed = parse_arena_fields(&json!({ "round": 2, "candidateAugmentIds": [] }));
        assert_eq!(parsed.round, Some(2));
        assert_eq!(parsed.candidate_capability, CandidateCapability::Available);
        assert!(parsed.candidate_augment_ids.is_empty());
    }
}
