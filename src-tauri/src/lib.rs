use serde::{Deserialize, Serialize};
use std::{env, fs, path::PathBuf, time::Duration};

#[derive(Debug, Clone)]
struct LcuLockfile {
    password: String,
    port: u16,
    protocol: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuSessionPayload {
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientSnapshotPayload {
    game_time: f64,
    game_mode: Option<String>,
    active_player_name: Option<String>,
    champion_name: Option<String>,
    level: Option<u16>,
    current_gold: Option<u32>,
    current_item_ids: Vec<u16>,
    selected_augment_ids: Vec<u32>,
    selected_augment_names: Vec<String>,
    candidate_augment_ids: Vec<u32>,
    source: String,
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

fn parse_lockfile(raw: &str) -> Option<LcuLockfile> {
    let parts: Vec<&str> = raw.trim().split(':').collect();
    if parts.len() != 5 {
        return None;
    }

    let port = parts[2].parse::<u16>().ok()?;
    let protocol = parts[4].to_string();
    if protocol != "http" && protocol != "https" {
        return None;
    }

    Some(LcuLockfile {
        password: parts[3].to_string(),
        port,
        protocol,
    })
}

fn candidate_lockfile_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(path) = env::var("LEAGUE_CLIENT_LOCKFILE") {
        paths.push(PathBuf::from(path));
    }

    paths.push(PathBuf::from(r"C:\Riot Games\League of Legends\lockfile"));

    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(root) = env::var(key) {
            paths.push(PathBuf::from(root).join(r"Riot Games\League of Legends\lockfile"));
        }
    }

    if let Ok(system_drive) = env::var("SystemDrive") {
        paths.push(PathBuf::from(system_drive).join(r"Riot Games\League of Legends\lockfile"));
    }

    paths
}

fn read_lockfile() -> Option<LcuLockfile> {
    candidate_lockfile_paths()
        .into_iter()
        .find_map(|path| fs::read_to_string(path).ok())
        .and_then(|raw| parse_lockfile(&raw))
}

fn map_queue_to_mode(queue: Option<&GameflowQueue>) -> Option<String> {
    let raw = queue
        .and_then(|queue| queue.description.as_deref().or(queue.game_mode.as_deref()))
        .unwrap_or_default()
        .to_lowercase();

    if raw.contains("arena") || raw.contains("海克斯") {
        return Some("augment".to_string());
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

async fn request_lcu_json<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    lockfile: &LcuLockfile,
    path: &str,
) -> Option<T> {
    let url = format!(
        "{}://127.0.0.1:{}{}",
        lockfile.protocol, lockfile.port, path
    );
    client
        .get(url)
        .basic_auth("riot", Some(&lockfile.password))
        .send()
        .await
        .ok()?
        .json::<T>()
        .await
        .ok()
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
async fn opgg_mcp_call(tool_name: String, arguments: serde_json::Value) -> Option<serde_json::Value> {
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

fn live_client_data_base_url() -> String {
    env::var("LIVE_CLIENT_DATA_BASE_URL")
        .unwrap_or_else(|_| "https://127.0.0.1:2999".to_string())
        .trim_end_matches('/')
        .to_string()
}

#[tauri::command]
async fn read_live_client_snapshot() -> Option<LiveClientSnapshotPayload> {
    let base_url = live_client_data_base_url();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(900))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;
    let payload = client
        .get(format!("{}/liveclientdata/allgamedata", base_url))
        .send()
        .await
        .ok()?
        .json::<LiveClientAllData>()
        .await
        .ok()?;

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
            .and_then(|game_data| game_data.game_time)
            .unwrap_or_default(),
        game_mode: payload
            .game_data
            .as_ref()
            .and_then(|game_data| game_data.game_mode.clone()),
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
            .map(|items| items.iter().filter_map(|item| item.item_id).collect())
            .unwrap_or_default(),
        // The Live Client Data API (/liveclientdata/allgamedata) does not expose ARAM Mayhem
        // selected/candidate augment ids or names in any stable, documented field, so these
        // stay empty; the frontend treats empty arrays as "waiting for candidate sync" and
        // must never fabricate the three-choice augment offer.
        selected_augment_ids: Vec::new(),
        selected_augment_names: Vec::new(),
        candidate_augment_ids: Vec::new(),
        source: "live-client-data".to_string(),
    })
}

async fn read_champ_select_players(
    client: &reqwest::Client,
    lockfile: &LcuLockfile,
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
                let path = format!("/lol-summoner/v1/summoners/{}", summoner_id);
                request_lcu_json::<SummonerIdentity>(client, lockfile, &path).await
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
            champion_id: player.champion_id.filter(|champion_id| *champion_id > 0),
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
async fn read_lcu_session() -> Option<LcuSessionPayload> {
    let lockfile = read_lockfile()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1400))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;

    let phase =
        request_lcu_json::<String>(&client, &lockfile, "/lol-gameflow/v1/gameflow-phase").await?;
    let gameflow_session =
        request_lcu_json::<GameflowSession>(&client, &lockfile, "/lol-gameflow/v1/session").await;
    let current_summoner = request_lcu_json::<CurrentSummoner>(
        &client,
        &lockfile,
        "/lol-summoner/v1/current-summoner",
    )
    .await;

    let queue = gameflow_session
        .as_ref()
        .and_then(|session| session.game_data.as_ref())
        .and_then(|game_data| game_data.queue.as_ref());
    let players = if phase == "ChampSelect" {
        read_champ_select_players(&client, &lockfile).await
    } else {
        Vec::new()
    };

    Some(LcuSessionPayload {
        phase,
        mode: map_queue_to_mode(queue),
        local_summoner_name: current_summoner
            .and_then(|summoner| summoner.display_name.or(summoner.game_name)),
        players,
        source: "lcu".to_string(),
    })
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
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            opgg_mcp_call,
            read_lcu_session,
            read_live_client_snapshot,
            riot_api_get,
            set_overlay_always_on_top,
            set_overlay_compact
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LOL Companion desktop shell");
}
