use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    time::Duration,
};

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
    queue_id: Option<u32>,
    local_summoner_name: Option<String>,
    players: Vec<LcuPlayerPayload>,
    player_source: Option<String>,
    source: String,
}

struct LeagueClientDiscovery {
    lockfile: Option<LcuLockfile>,
    lockfile_candidate_count: usize,
    process_running: bool,
    credential_source: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuPlayerPayload {
    id: String,
    team: String,
    is_local: bool,
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
    #[serde(rename = "teamOne")]
    team_one: Option<Vec<GameflowParticipant>>,
    #[serde(rename = "teamTwo")]
    team_two: Option<Vec<GameflowParticipant>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameflowQueue {
    id: Option<u32>,
    description: Option<String>,
    game_mode: Option<String>,
    name: Option<String>,
    short_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameflowParticipant {
    champion_id: Option<u16>,
    puuid: Option<String>,
    selected_position: Option<String>,
    summoner_id: Option<u64>,
    summoner_internal_name: Option<String>,
    summoner_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurrentSummoner {
    display_name: Option<String>,
    game_name: Option<String>,
    puuid: Option<String>,
    summoner_id: Option<u64>,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientSnapshotPayload {
    game_time: Option<f64>,
    game_mode: Option<String>,
    active_player_name: Option<String>,
    champion_name: Option<String>,
    level: Option<u16>,
    current_gold: Option<u32>,
    current_item_ids: Vec<u16>,
    selected_augment_ids: Vec<u32>,
    selected_augment_names: Vec<String>,
    candidate_augment_ids: Vec<u32>,
    players: Vec<LiveClientPlayerPayload>,
    source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientPlayerPayload {
    summoner_name: Option<String>,
    riot_id: Option<String>,
    champion_name: Option<String>,
    team: Option<String>,
    position: Option<String>,
    level: Option<u16>,
    is_local: bool,
    is_bot: bool,
    is_dead: bool,
    item_ids: Vec<u16>,
    kills: Option<u32>,
    deaths: Option<u32>,
    assists: Option<u32>,
    creep_score: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuDiagnosticsPayload {
    app_version: String,
    build_commit: String,
    process_running: bool,
    lockfile_found: bool,
    lockfile_candidate_count: usize,
    credential_source: Option<String>,
    lockfile_protocol: Option<String>,
    lockfile_port: Option<u16>,
    phase_status: String,
    phase: Option<String>,
    queue_id: Option<u32>,
    queue_label: Option<String>,
    mapped_mode: Option<String>,
    current_summoner_status: String,
    current_summoner_name: Option<String>,
    champ_select_status: String,
    champ_select_local_cell_id: Option<u16>,
    champ_select_ally_count: usize,
    champ_select_enemy_count: usize,
    gameflow_status: String,
    gameflow_team_one_count: usize,
    gameflow_team_two_count: usize,
    live_client_status: String,
    live_client_all_data_status: String,
    live_client_active_player_status: String,
    live_client_player_list_status: String,
    live_client_game_stats_status: String,
    live_client_game_mode: Option<String>,
    live_client_player_count: usize,
    live_client_active_player: Option<String>,
    live_client_local_player_resolved: bool,
    live_client_summoner_name_field_present: bool,
    live_client_riot_id_field_present: bool,
    champ_select_ally_champion_count: usize,
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
    riot_id: Option<String>,
    riot_id_game_name: Option<String>,
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
    riot_id: Option<String>,
    riot_id_game_name: Option<String>,
    position: Option<String>,
    team: Option<String>,
    #[serde(default)]
    is_bot: bool,
    #[serde(default)]
    is_dead: bool,
    scores: Option<LiveClientScores>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientScores {
    kills: Option<u32>,
    deaths: Option<u32>,
    assists: Option<u32>,
    creep_score: Option<u32>,
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

#[cfg(any(target_os = "windows", test))]
fn process_arg_value(args: &[String], names: &[&str]) -> Option<String> {
    for (index, arg) in args.iter().enumerate() {
        for name in names {
            if arg == name {
                if let Some(value) = args.get(index + 1) {
                    return Some(value.trim_matches('"').to_string());
                }
            }

            let prefix = format!("{}=", name);
            if let Some(value) = arg.strip_prefix(&prefix) {
                return Some(value.trim_matches('"').to_string());
            }
        }
    }

    None
}

#[cfg(any(target_os = "windows", test))]
fn parse_lcu_process_args(args: &[String]) -> Option<LcuLockfile> {
    let port = process_arg_value(args, &["--app-port", "--riotclient-app-port"])?
        .parse::<u16>()
        .ok()?;
    let password = process_arg_value(args, &["--remoting-auth-token", "--riotclient-auth-token"])?;
    let protocol = process_arg_value(args, &["--app-protocol", "--riotclient-app-protocol"])
        .unwrap_or_else(|| "https".to_string());

    if protocol != "http" && protocol != "https" {
        return None;
    }

    Some(LcuLockfile {
        password,
        port,
        protocol,
    })
}

fn lockfile_path_from_executable(executable: &Path) -> Option<PathBuf> {
    let file_name = executable.file_name()?.to_string_lossy();
    if !file_name.eq_ignore_ascii_case("LeagueClient.exe")
        && !file_name.eq_ignore_ascii_case("LeagueClientUx.exe")
    {
        return None;
    }

    executable.parent().map(|parent| parent.join("lockfile"))
}

fn lockfile_path_from_process_dir(process_dir: &Path) -> PathBuf {
    process_dir.join("lockfile")
}

#[cfg(target_os = "windows")]
fn running_league_client_paths() -> (bool, Vec<PathBuf>, Option<LcuLockfile>) {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_exe(sysinfo::UpdateKind::Always)
            .with_cwd(sysinfo::UpdateKind::Always)
            .with_cmd(sysinfo::UpdateKind::Always),
    );

    let mut process_running = false;
    let mut executable_paths = Vec::new();
    let mut process_credentials = None;

    for process in system.processes().values() {
        let process_name = process.name().to_string_lossy();
        if process_name.eq_ignore_ascii_case("LeagueClient.exe")
            || process_name.eq_ignore_ascii_case("LeagueClientUx.exe")
        {
            process_running = true;
            if let Some(executable) = process.exe() {
                executable_paths.push(executable.to_path_buf());
            }
            if let Some(cwd) = process.cwd() {
                executable_paths.push(cwd.to_path_buf());
            }
            if process_credentials.is_none() {
                let args = process
                    .cmd()
                    .iter()
                    .map(|arg| arg.to_string_lossy().to_string())
                    .collect::<Vec<_>>();
                process_credentials = parse_lcu_process_args(&args);
            }
        }
    }

    (process_running, executable_paths, process_credentials)
}

#[cfg(not(target_os = "windows"))]
fn running_league_client_paths() -> (bool, Vec<PathBuf>, Option<LcuLockfile>) {
    (false, Vec::new(), None)
}

fn candidate_lockfile_paths(executable_paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(path) = env::var("LEAGUE_CLIENT_LOCKFILE") {
        paths.push(PathBuf::from(path));
    }

    paths.extend(
        executable_paths
            .iter()
            .filter_map(|path| lockfile_path_from_executable(path)),
    );
    paths.extend(
        executable_paths
            .iter()
            .filter(|path| path.is_dir())
            .map(|path| lockfile_path_from_process_dir(path)),
    );

    paths.push(PathBuf::from(r"C:\Riot Games\League of Legends\lockfile"));
    paths.push(PathBuf::from(
        r"C:\Program Files (x86)\Tencent\WeGameApps\英雄联盟\Game\lockfile",
    ));
    paths.push(PathBuf::from(
        r"C:\Program Files\Tencent\WeGameApps\英雄联盟\Game\lockfile",
    ));
    paths.push(PathBuf::from(r"C:\英雄联盟\Game\lockfile"));
    paths.push(PathBuf::from(r"C:\腾讯游戏\英雄联盟\Game\lockfile"));

    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(root) = env::var(key) {
            let root = PathBuf::from(root);
            paths.push(root.join(r"Riot Games\League of Legends\lockfile"));
            paths.push(root.join(r"Tencent\WeGameApps\英雄联盟\Game\lockfile"));
            paths.push(root.join(r"WeGameApps\英雄联盟\Game\lockfile"));
            paths.push(root.join(r"WeGameApps\rail_apps\英雄联盟\Game\lockfile"));
            paths.push(root.join(r"腾讯游戏\英雄联盟\Game\lockfile"));
            paths.push(root.join(r"腾讯游戏\League of Legends\Game\lockfile"));
        }
    }

    if let Ok(system_drive) = env::var("SystemDrive") {
        let system_drive = PathBuf::from(system_drive);
        paths.push(system_drive.join(r"Riot Games\League of Legends\lockfile"));
        paths.push(system_drive.join(r"WeGameApps\英雄联盟\Game\lockfile"));
        paths.push(system_drive.join(r"Tencent\WeGameApps\英雄联盟\Game\lockfile"));
        paths.push(system_drive.join(r"英雄联盟\Game\lockfile"));
        paths.push(system_drive.join(r"腾讯游戏\英雄联盟\Game\lockfile"));
    }

    #[cfg(target_os = "windows")]
    for drive in b'C'..=b'Z' {
        let drive_root = format!("{}:\\", drive as char);
        paths.push(PathBuf::from(&drive_root).join(r"Riot Games\League of Legends\lockfile"));
        paths.push(
            PathBuf::from(&drive_root).join(r"Program Files\Riot Games\League of Legends\lockfile"),
        );
        paths.push(PathBuf::from(&drive_root).join(r"WeGameApps\英雄联盟\Game\lockfile"));
        paths.push(PathBuf::from(&drive_root).join(r"Tencent\WeGameApps\英雄联盟\Game\lockfile"));
        paths.push(PathBuf::from(&drive_root).join(r"英雄联盟\Game\lockfile"));
        paths.push(PathBuf::from(&drive_root).join(r"腾讯游戏\英雄联盟\Game\lockfile"));
        paths.push(
            PathBuf::from(&drive_root)
                .join(r"Program Files\Tencent\WeGameApps\英雄联盟\Game\lockfile"),
        );
        paths.push(
            PathBuf::from(&drive_root)
                .join(r"Program Files (x86)\Tencent\WeGameApps\英雄联盟\Game\lockfile"),
        );
        paths.push(
            PathBuf::from(&drive_root).join(r"Program Files\腾讯游戏\英雄联盟\Game\lockfile"),
        );
        paths.push(
            PathBuf::from(&drive_root).join(r"Program Files (x86)\腾讯游戏\英雄联盟\Game\lockfile"),
        );
    }

    let mut seen = HashSet::new();
    paths.retain(|path| seen.insert(path.clone()));
    paths
}

fn discover_league_client() -> LeagueClientDiscovery {
    let (process_running, executable_paths, process_credentials) = running_league_client_paths();
    let lockfile_paths = candidate_lockfile_paths(&executable_paths);
    let lockfile_candidate_count = lockfile_paths.len();
    let file_lockfile = lockfile_paths
        .into_iter()
        .find_map(|path| fs::read_to_string(path).ok())
        .and_then(|raw| parse_lockfile(&raw));
    let credential_source = if process_credentials.is_some() {
        Some("process-command-line".to_string())
    } else if file_lockfile.is_some() {
        Some("lockfile".to_string())
    } else {
        None
    };
    let lockfile = process_credentials.or(file_lockfile);

    LeagueClientDiscovery {
        lockfile,
        lockfile_candidate_count,
        process_running,
        credential_source,
    }
}

fn client_running_payload() -> LcuSessionPayload {
    LcuSessionPayload {
        phase: "ClientRunning".to_string(),
        mode: None,
        queue_id: None,
        local_summoner_name: None,
        players: Vec::new(),
        player_source: None,
        source: "lcu".to_string(),
    }
}

fn map_queue_to_mode(queue: Option<&GameflowQueue>) -> Option<String> {
    if let Some(queue_id) = queue.and_then(|queue| queue.id) {
        if matches!(queue_id, 2400 | 2401 | 2403 | 2405 | 3240 | 3270) {
            return Some("augment".to_string());
        }

        if matches!(queue_id, 400 | 420 | 430 | 440 | 490) {
            return Some("ranked".to_string());
        }
    }

    let raw = queue
        .map(|queue| {
            [
                queue.name.as_deref(),
                queue.short_name.as_deref(),
                queue.description.as_deref(),
                queue.game_mode.as_deref(),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ")
        })
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

fn queue_label(queue: Option<&GameflowQueue>) -> Option<String> {
    let label = queue
        .map(|queue| {
            [
                queue.name.as_deref(),
                queue.short_name.as_deref(),
                queue.description.as_deref(),
                queue.game_mode.as_deref(),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ")
        })
        .unwrap_or_default();

    if label.trim().is_empty() {
        None
    } else {
        Some(label)
    }
}

async fn build_player_payload(
    client: &reqwest::Client,
    lockfile: &LcuLockfile,
    team: String,
    is_local: bool,
    index: usize,
    role: Option<&str>,
    champion_id: Option<u16>,
    summoner_id: Option<u64>,
    summoner_name: Option<String>,
    puuid: Option<String>,
) -> LcuPlayerPayload {
    let identity = match summoner_id {
        Some(summoner_id) => {
            let path = format!("/lol-summoner/v1/summoners/{}", summoner_id);
            request_lcu_json::<SummonerIdentity>(client, lockfile, &path).await
        }
        None => None,
    };
    let identity = if identity.is_none() {
        match puuid.as_deref() {
            Some(puuid) => {
                let path = format!("/lol-summoner/v2/summoners/puuid/{}", puuid);
                request_lcu_json::<SummonerIdentity>(client, lockfile, &path).await
            }
            None => None,
        }
    } else {
        identity
    };
    let game_name = identity
        .as_ref()
        .and_then(|identity| identity.game_name.clone())
        .or_else(|| summoner_name.clone());
    let resolved_name = identity
        .as_ref()
        .and_then(|identity| {
            identity
                .display_name
                .clone()
                .or_else(|| identity.game_name.clone())
                .or_else(|| identity.internal_name.clone())
        })
        .or(summoner_name);

    LcuPlayerPayload {
        id: format!(
            "{}-{}",
            team,
            summoner_id
                .map(|value| value.to_string())
                .or_else(|| puuid.clone())
                .unwrap_or_else(|| index.to_string())
        ),
        team,
        is_local,
        role: map_position_to_role(role),
        champion_id: champion_id.filter(|champion_id| *champion_id > 0),
        summoner_id,
        summoner_name: resolved_name,
        riot_account: LcuRiotAccountPayload {
            game_name,
            puuid: identity
                .as_ref()
                .and_then(|identity| identity.puuid.clone())
                .or(puuid),
            tag_line: identity.and_then(|identity| identity.tag_line),
        },
    }
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

async fn read_live_client_json<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    path: &str,
) -> Option<T> {
    let base_url = live_client_data_base_url();
    client
        .get(format!("{}{}", base_url, path))
        .send()
        .await
        .ok()?
        .json::<T>()
        .await
        .ok()
}

async fn read_live_client_all_data(client: &reqwest::Client) -> Option<LiveClientAllData> {
    read_live_client_json(client, "/liveclientdata/allgamedata").await
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

fn live_client_data_base_url() -> String {
    env::var("LIVE_CLIENT_DATA_BASE_URL")
        .unwrap_or_else(|_| "https://127.0.0.1:2999".to_string())
        .trim_end_matches('/')
        .to_string()
}

/// On the CN/Garena client the `summonerName` field is frequently empty and the
/// real identity lives in `riotId` / `riotIdGameName`. Match the local player by
/// any of those identifiers so the active player's champion/items resolve.
fn live_player_matches_active(player: &LiveClientPlayer, active: &LiveClientActivePlayer) -> bool {
    let candidates = [
        active.summoner_name.as_deref(),
        active.riot_id.as_deref(),
        active.riot_id_game_name.as_deref(),
    ];
    let player_keys = [
        player.summoner_name.as_deref(),
        player.riot_id.as_deref(),
        player.riot_id_game_name.as_deref(),
    ];

    candidates.iter().flatten().any(|candidate| {
        player_keys
            .iter()
            .flatten()
            .any(|key| !key.is_empty() && key == candidate)
    })
}

#[tauri::command]
async fn read_live_client_snapshot() -> Option<LiveClientSnapshotPayload> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(900))
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;
    let mut active_endpoint_player = None;
    let mut all_players = None;
    let mut game_data = None;

    if let Some(payload) = read_live_client_all_data(&client).await {
        active_endpoint_player = payload.active_player;
        all_players = payload.all_players;
        game_data = payload.game_data;
    }

    if active_endpoint_player.is_none() {
        active_endpoint_player = read_live_client_json::<LiveClientActivePlayer>(
            &client,
            "/liveclientdata/activeplayer",
        )
        .await;
    }
    if all_players.is_none() {
        all_players =
            read_live_client_json::<Vec<LiveClientPlayer>>(&client, "/liveclientdata/playerlist")
                .await;
    }
    if game_data.is_none() {
        game_data =
            read_live_client_json::<LiveClientGameData>(&client, "/liveclientdata/gamestats").await;
    }

    if active_endpoint_player.is_none() && all_players.is_none() && game_data.is_none() {
        return None;
    }

    let active_name = active_endpoint_player.as_ref().and_then(|active| {
        active
            .summoner_name
            .clone()
            .filter(|name| !name.is_empty())
            .or_else(|| active.riot_id_game_name.clone())
            .or_else(|| active.riot_id.clone())
    });
    let local_index = active_endpoint_player.as_ref().and_then(|active| {
        all_players
            .as_ref()?
            .iter()
            .position(|player| live_player_matches_active(player, active))
    });
    // Only resolve the active player's champion/items when we can positively
    // identify them in the player list. Never fall back to the first player —
    // that would attribute another player's champion/level/items to the local user.
    let listed_active_player =
        local_index.and_then(|index| all_players.as_ref().and_then(|players| players.get(index)));

    let players = all_players
        .as_ref()
        .map(|players| {
            players
                .iter()
                .enumerate()
                .map(|(index, player)| LiveClientPlayerPayload {
                    summoner_name: player
                        .summoner_name
                        .clone()
                        .filter(|name| !name.is_empty())
                        .or_else(|| player.riot_id_game_name.clone()),
                    riot_id: player
                        .riot_id
                        .clone()
                        .or_else(|| player.riot_id_game_name.clone()),
                    champion_name: player.champion_name.clone(),
                    team: player.team.clone(),
                    position: player
                        .position
                        .clone()
                        .filter(|position| !position.is_empty() && position != "NONE"),
                    level: player.level,
                    is_local: Some(index) == local_index,
                    is_bot: player.is_bot,
                    is_dead: player.is_dead,
                    item_ids: player
                        .items
                        .as_ref()
                        .map(|items| items.iter().filter_map(|item| item.item_id).collect())
                        .unwrap_or_default(),
                    kills: player.scores.as_ref().and_then(|scores| scores.kills),
                    deaths: player.scores.as_ref().and_then(|scores| scores.deaths),
                    assists: player.scores.as_ref().and_then(|scores| scores.assists),
                    creep_score: player.scores.as_ref().and_then(|scores| scores.creep_score),
                })
                .collect()
        })
        .unwrap_or_default();

    Some(LiveClientSnapshotPayload {
        game_time: game_data.as_ref().and_then(|game_data| game_data.game_time),
        game_mode: game_data
            .as_ref()
            .and_then(|game_data| game_data.game_mode.clone()),
        active_player_name: active_name,
        champion_name: listed_active_player.and_then(|player| player.champion_name.clone()),
        level: active_endpoint_player
            .as_ref()
            .and_then(|active| active.level)
            .or_else(|| listed_active_player.and_then(|player| player.level)),
        current_gold: active_endpoint_player
            .as_ref()
            .and_then(|active| active.current_gold)
            .map(|gold| gold.max(0.0).round() as u32),
        current_item_ids: listed_active_player
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
        players,
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

    let local_player_cell_id = session.local_player_cell_id;
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
                .filter(|player| {
                    player.summoner_id.is_some()
                        || player.summoner_name.is_some()
                        || player.puuid.is_some()
                        || player
                            .champion_id
                            .is_some_and(|champion_id| champion_id > 0)
                })
                .map(|player| ("enemy".to_string(), player)),
        );

    let mut players = Vec::new();

    for (index, (team, player)) in participants.enumerate() {
        let fallback_index = player.cell_id.map(usize::from).unwrap_or(index);
        players.push(
            build_player_payload(
                client,
                lockfile,
                team,
                player.cell_id == local_player_cell_id,
                fallback_index,
                player.assigned_position.as_deref(),
                player.champion_id,
                player.summoner_id,
                player.summoner_name,
                player.puuid,
            )
            .await,
        );
    }

    players
}

#[tauri::command]
async fn read_lcu_diagnostics() -> LcuDiagnosticsPayload {
    let discovery = discover_league_client();
    let lockfile = discovery.lockfile;
    let lockfile_found = lockfile.is_some();
    let lockfile_protocol = lockfile.as_ref().map(|lockfile| lockfile.protocol.clone());
    let lockfile_port = lockfile.as_ref().map(|lockfile| lockfile.port);

    let mut phase_status = "unavailable".to_string();
    let mut phase = None;
    let mut queue_id = None;
    let mut queue_label_value = None;
    let mut mapped_mode = None;
    let mut current_summoner_status = "unavailable".to_string();
    let mut current_summoner_name = None;
    let mut champ_select_status = "unavailable".to_string();
    let mut champ_select_local_cell_id = None;
    let mut champ_select_ally_count = 0;
    let mut champ_select_enemy_count = 0;
    let mut champ_select_ally_champion_count = 0;
    let mut gameflow_status = "unavailable".to_string();
    let mut gameflow_team_one_count = 0;
    let mut gameflow_team_two_count = 0;

    if let Some(lockfile) = lockfile.as_ref() {
        if let Ok(client) = reqwest::Client::builder()
            .timeout(Duration::from_millis(1400))
            .danger_accept_invalid_certs(true)
            .build()
        {
            let phase_result =
                request_lcu_json::<String>(&client, lockfile, "/lol-gameflow/v1/gameflow-phase")
                    .await;
            if let Some(value) = phase_result {
                phase_status = "ok".to_string();
                phase = Some(value);
            }

            let gameflow_session =
                request_lcu_json::<GameflowSession>(&client, lockfile, "/lol-gameflow/v1/session")
                    .await;
            if let Some(session) = gameflow_session.as_ref() {
                gameflow_status = "ok".to_string();
                if let Some(game_data) = session.game_data.as_ref() {
                    gameflow_team_one_count =
                        game_data.team_one.as_ref().map_or(0, |team| team.len());
                    gameflow_team_two_count =
                        game_data.team_two.as_ref().map_or(0, |team| team.len());
                    let queue = game_data.queue.as_ref();
                    queue_id = queue.and_then(|queue| queue.id);
                    queue_label_value = queue_label(queue);
                    mapped_mode = map_queue_to_mode(queue);
                }
            }

            let current_summoner = request_lcu_json::<CurrentSummoner>(
                &client,
                lockfile,
                "/lol-summoner/v1/current-summoner",
            )
            .await;
            if let Some(summoner) = current_summoner {
                current_summoner_status = "ok".to_string();
                current_summoner_name = summoner.display_name.or(summoner.game_name);
            }

            let champ_select = request_lcu_json::<ChampSelectSession>(
                &client,
                lockfile,
                "/lol-champ-select/v1/session",
            )
            .await;
            if let Some(session) = champ_select {
                champ_select_status = "ok".to_string();
                champ_select_local_cell_id = session.local_player_cell_id;
                champ_select_ally_count = session.my_team.as_ref().map_or(0, |team| team.len());
                champ_select_enemy_count = session.their_team.as_ref().map_or(0, |team| team.len());
                champ_select_ally_champion_count = session.my_team.as_ref().map_or(0, |team| {
                    team.iter()
                        .filter(|player| player.champion_id.is_some_and(|id| id > 0))
                        .count()
                });
            }
        }
    }

    let live_client = reqwest::Client::builder()
        .timeout(Duration::from_millis(900))
        .danger_accept_invalid_certs(true)
        .build()
        .ok();
    let live_payload = match live_client.as_ref() {
        Some(client) => read_live_client_all_data(client).await,
        None => None,
    };
    let live_active_player = match live_client.as_ref() {
        Some(client) => {
            read_live_client_json::<LiveClientActivePlayer>(client, "/liveclientdata/activeplayer")
                .await
        }
        None => None,
    };
    let live_player_list = match live_client.as_ref() {
        Some(client) => {
            read_live_client_json::<Vec<LiveClientPlayer>>(client, "/liveclientdata/playerlist")
                .await
        }
        None => None,
    };
    let live_game_stats = match live_client.as_ref() {
        Some(client) => {
            read_live_client_json::<LiveClientGameData>(client, "/liveclientdata/gamestats").await
        }
        None => None,
    };
    let live_client_all_data_status = if live_payload.is_some() {
        "ok"
    } else {
        "unavailable"
    }
    .to_string();
    let live_client_active_player_status = if live_active_player.is_some() {
        "ok"
    } else {
        "unavailable"
    }
    .to_string();
    let live_client_player_list_status = if live_player_list.is_some() {
        "ok"
    } else {
        "unavailable"
    }
    .to_string();
    let live_client_game_stats_status = if live_game_stats.is_some() {
        "ok"
    } else {
        "unavailable"
    }
    .to_string();
    let live_client_status = if live_payload.is_some()
        || live_active_player.is_some()
        || live_player_list.is_some()
        || live_game_stats.is_some()
    {
        "ok"
    } else {
        "unavailable"
    }
    .to_string();
    let live_client_game_mode = live_payload
        .as_ref()
        .and_then(|payload| payload.game_data.as_ref())
        .and_then(|game_data| game_data.game_mode.clone())
        .or_else(|| {
            live_game_stats
                .as_ref()
                .and_then(|game_data| game_data.game_mode.clone())
        });
    let live_client_player_count = live_payload
        .as_ref()
        .and_then(|payload| payload.all_players.as_ref())
        .map(|players| players.len())
        .or_else(|| live_player_list.as_ref().map(|players| players.len()))
        .unwrap_or_default();
    let resolved_active_player = live_payload
        .as_ref()
        .and_then(|payload| payload.active_player.as_ref())
        .or(live_active_player.as_ref());
    let resolved_player_list = live_payload
        .as_ref()
        .and_then(|payload| payload.all_players.as_ref())
        .or(live_player_list.as_ref());
    // Only surface the active player's own display name (never opponents'),
    // and prefer the riotIdGameName when summonerName is blank on CN clients.
    let live_client_active_player = resolved_active_player.and_then(|active| {
        active
            .summoner_name
            .clone()
            .filter(|name| !name.is_empty())
            .or_else(|| active.riot_id_game_name.clone())
    });
    // Diagnostics flags below are intentionally booleans/counts only — they help
    // pinpoint CN field-name mismatches without leaking any player identities.
    let live_client_local_player_resolved = match (resolved_active_player, resolved_player_list) {
        (Some(active), Some(players)) => players
            .iter()
            .any(|player| live_player_matches_active(player, active)),
        _ => false,
    };
    let live_client_summoner_name_field_present = resolved_player_list.is_some_and(|players| {
        players.iter().any(|player| {
            player
                .summoner_name
                .as_ref()
                .is_some_and(|name| !name.is_empty())
        })
    });
    let live_client_riot_id_field_present = resolved_player_list.is_some_and(|players| {
        players.iter().any(|player| {
            player.riot_id.as_ref().is_some_and(|name| !name.is_empty())
                || player
                    .riot_id_game_name
                    .as_ref()
                    .is_some_and(|name| !name.is_empty())
        })
    });

    LcuDiagnosticsPayload {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        build_commit: option_env!("GITHUB_SHA")
            .unwrap_or("local")
            .chars()
            .take(7)
            .collect(),
        process_running: discovery.process_running,
        lockfile_found,
        lockfile_candidate_count: discovery.lockfile_candidate_count,
        credential_source: discovery.credential_source,
        lockfile_protocol,
        lockfile_port,
        phase_status,
        phase,
        queue_id,
        queue_label: queue_label_value,
        mapped_mode,
        current_summoner_status,
        current_summoner_name,
        champ_select_status,
        champ_select_local_cell_id,
        champ_select_ally_count,
        champ_select_enemy_count,
        gameflow_status,
        gameflow_team_one_count,
        gameflow_team_two_count,
        live_client_status,
        live_client_all_data_status,
        live_client_active_player_status,
        live_client_player_list_status,
        live_client_game_stats_status,
        live_client_game_mode,
        live_client_player_count,
        live_client_active_player,
        live_client_local_player_resolved,
        live_client_summoner_name_field_present,
        live_client_riot_id_field_present,
        champ_select_ally_champion_count,
        source: "lcu-diagnostics".to_string(),
    }
}

async fn read_gameflow_players(
    client: &reqwest::Client,
    lockfile: &LcuLockfile,
    game_data: Option<&GameflowGameData>,
    current_summoner: Option<&CurrentSummoner>,
) -> Vec<LcuPlayerPayload> {
    let Some(game_data) = game_data else {
        return Vec::new();
    };
    let team_one = game_data.team_one.clone().unwrap_or_default();
    let team_two = game_data.team_two.clone().unwrap_or_default();
    let is_local_player = |player: &GameflowParticipant| {
        current_summoner.is_some_and(|summoner| {
            (summoner.summoner_id.is_some() && summoner.summoner_id == player.summoner_id)
                || (summoner.puuid.is_some() && summoner.puuid == player.puuid)
                || summoner
                    .display_name
                    .as_deref()
                    .is_some_and(|name| player.summoner_name.as_deref() == Some(name))
                || summoner
                    .game_name
                    .as_deref()
                    .is_some_and(|name| player.summoner_name.as_deref() == Some(name))
        })
    };
    let local_is_team_two = team_two.iter().any(is_local_player);
    let (ally_team, enemy_team) = if local_is_team_two {
        (team_two, team_one)
    } else {
        (team_one, team_two)
    };
    let participants = ally_team
        .into_iter()
        .map(|player| ("ally".to_string(), player))
        .chain(
            enemy_team
                .into_iter()
                .map(|player| ("enemy".to_string(), player)),
        )
        .filter(|(_, player)| {
            player.summoner_id.is_some()
                || player.summoner_name.is_some()
                || player.summoner_internal_name.is_some()
                || player.puuid.is_some()
        });

    let mut players = Vec::new();
    for (index, (team, player)) in participants.enumerate() {
        players.push(
            build_player_payload(
                client,
                lockfile,
                team,
                is_local_player(&player),
                index,
                player.selected_position.as_deref(),
                player.champion_id,
                player.summoner_id,
                player.summoner_name.or(player.summoner_internal_name),
                player.puuid,
            )
            .await,
        );
    }

    players
}

#[tauri::command]
async fn read_lcu_session() -> Option<LcuSessionPayload> {
    let discovery = discover_league_client();
    let lockfile = match discovery.lockfile {
        Some(lockfile) => lockfile,
        None if discovery.process_running => return Some(client_running_payload()),
        None => return None,
    };
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(1400))
        .danger_accept_invalid_certs(true)
        .build()
    {
        Ok(client) => client,
        Err(_) if discovery.process_running => return Some(client_running_payload()),
        Err(_) => return None,
    };

    let phase =
        match request_lcu_json::<String>(&client, &lockfile, "/lol-gameflow/v1/gameflow-phase")
            .await
        {
            Some(phase) => phase,
            None if discovery.process_running => return Some(client_running_payload()),
            None => return None,
        };
    let gameflow_session =
        request_lcu_json::<GameflowSession>(&client, &lockfile, "/lol-gameflow/v1/session").await;
    let current_summoner = request_lcu_json::<CurrentSummoner>(
        &client,
        &lockfile,
        "/lol-summoner/v1/current-summoner",
    )
    .await;

    let game_data = gameflow_session
        .as_ref()
        .and_then(|session| session.game_data.as_ref());
    let queue = game_data.and_then(|game_data| game_data.queue.as_ref());
    let (players, player_source) = if phase == "ChampSelect" {
        let champ_select_players = read_champ_select_players(&client, &lockfile).await;
        if champ_select_players.is_empty() {
            let gameflow_players =
                read_gameflow_players(&client, &lockfile, game_data, current_summoner.as_ref())
                    .await;
            if gameflow_players.is_empty() {
                (champ_select_players, Some("champ-select".to_string()))
            } else {
                (gameflow_players, Some("gameflow".to_string()))
            }
        } else {
            (champ_select_players, Some("champ-select".to_string()))
        }
    } else if matches!(
        phase.as_str(),
        "GameStart" | "InProgress" | "Reconnect" | "WaitingForStats"
    ) {
        (
            read_gameflow_players(&client, &lockfile, game_data, current_summoner.as_ref()).await,
            Some("gameflow".to_string()),
        )
    } else {
        (Vec::new(), None)
    };

    Some(LcuSessionPayload {
        phase,
        mode: map_queue_to_mode(queue),
        queue_id: queue.and_then(|queue| queue.id),
        local_summoner_name: current_summoner
            .and_then(|summoner| summoner.display_name.or(summoner.game_name)),
        players,
        player_source,
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
            read_lcu_diagnostics,
            read_lcu_session,
            read_live_client_snapshot,
            riot_api_get,
            set_overlay_always_on_top,
            set_overlay_compact
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LOL Companion desktop shell");
}

#[cfg(test)]
mod tests {
    use super::{
        candidate_lockfile_paths, live_player_matches_active, lockfile_path_from_executable,
        map_queue_to_mode, parse_lcu_process_args, parse_lockfile, GameflowQueue,
        LiveClientActivePlayer, LiveClientPlayer,
    };
    use std::path::{Path, PathBuf};

    #[test]
    fn parses_valid_lcu_lockfile() {
        let lockfile = parse_lockfile("LeagueClient:1234:54321:secret:https").unwrap();

        assert_eq!(lockfile.port, 54321);
        assert_eq!(lockfile.password, "secret");
        assert_eq!(lockfile.protocol, "https");
    }

    #[test]
    fn parses_lcu_credentials_from_equals_process_arguments() {
        let args = vec![
            "LeagueClientUx.exe".to_string(),
            "--app-port=54321".to_string(),
            "--remoting-auth-token=process-secret".to_string(),
            "--app-protocol=https".to_string(),
        ];
        let credentials = parse_lcu_process_args(&args).unwrap();

        assert_eq!(credentials.port, 54321);
        assert_eq!(credentials.password, "process-secret");
        assert_eq!(credentials.protocol, "https");
    }

    #[test]
    fn parses_lcu_credentials_from_split_process_arguments() {
        let args = vec![
            "LeagueClientUx.exe".to_string(),
            "--app-port".to_string(),
            "54322".to_string(),
            "--remoting-auth-token".to_string(),
            "split-secret".to_string(),
        ];
        let credentials = parse_lcu_process_args(&args).unwrap();

        assert_eq!(credentials.port, 54322);
        assert_eq!(credentials.password, "split-secret");
        assert_eq!(credentials.protocol, "https");
    }

    #[test]
    fn maps_current_queue_ids_without_guessing_plain_aram() {
        let queue = |id| GameflowQueue {
            id: Some(id),
            description: None,
            game_mode: Some("ARAM".to_string()),
            name: None,
            short_name: None,
        };

        assert_eq!(
            map_queue_to_mode(Some(&queue(420))).as_deref(),
            Some("ranked")
        );
        assert_eq!(
            map_queue_to_mode(Some(&queue(2400))).as_deref(),
            Some("augment")
        );
        assert_eq!(map_queue_to_mode(Some(&queue(450))), None);
    }

    #[test]
    fn derives_lockfile_from_league_client_executable() {
        let path =
            lockfile_path_from_executable(Path::new("/games/League of Legends/LeagueClientUx.exe"));

        assert_eq!(
            path,
            Some(PathBuf::from("/games/League of Legends/lockfile"))
        );
    }

    #[test]
    fn ignores_unrelated_process_executables() {
        assert_eq!(
            lockfile_path_from_executable(Path::new("/games/OtherClient.exe")),
            None
        );
    }

    #[test]
    fn prioritizes_process_derived_lockfile_candidates() {
        let executable = PathBuf::from("/custom/LeagueClient.exe");
        let paths = candidate_lockfile_paths(&[executable]);
        let process_path = PathBuf::from("/custom/lockfile");
        let standard_path = PathBuf::from(r"C:\Riot Games\League of Legends\lockfile");

        let process_index = paths.iter().position(|path| path == &process_path).unwrap();
        let standard_index = paths
            .iter()
            .position(|path| path == &standard_path)
            .unwrap();

        assert!(process_index < standard_index);
    }

    #[test]
    fn includes_common_wegame_lockfile_candidates() {
        let paths = candidate_lockfile_paths(&[]);
        let rendered_paths = paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        assert!(rendered_paths
            .iter()
            .any(|path| path.contains(r"Tencent\WeGameApps\英雄联盟\Game\lockfile")));
        assert!(rendered_paths
            .iter()
            .any(|path| path.contains(r"腾讯游戏\英雄联盟\Game\lockfile")));
        assert!(rendered_paths
            .iter()
            .any(|path| path.contains(r"英雄联盟\Game\lockfile")));
    }

    #[test]
    fn matches_active_player_by_riot_id_game_name_when_summoner_name_is_blank() {
        // CN/Garena allgamedata: summonerName is empty, identity lives in riotIdGameName.
        let active: LiveClientActivePlayer = serde_json::from_value(serde_json::json!({
            "currentGold": 1375.0,
            "level": 8,
            "summonerName": "",
            "riotId": "影流之主#CN1",
            "riotIdGameName": "影流之主"
        }))
        .unwrap();
        let player: LiveClientPlayer = serde_json::from_value(serde_json::json!({
            "championName": "Zed",
            "level": 8,
            "summonerName": "",
            "riotId": "影流之主#CN1",
            "riotIdGameName": "影流之主",
            "team": "ORDER",
            "position": "MIDDLE"
        }))
        .unwrap();

        assert!(live_player_matches_active(&player, &active));
    }

    #[test]
    fn matches_active_player_by_summoner_name_on_western_client() {
        let active: LiveClientActivePlayer = serde_json::from_value(serde_json::json!({
            "summonerName": "Faker",
            "level": 10
        }))
        .unwrap();
        let player: LiveClientPlayer = serde_json::from_value(serde_json::json!({
            "championName": "Azir",
            "summonerName": "Faker",
            "team": "ORDER"
        }))
        .unwrap();

        assert!(live_player_matches_active(&player, &active));
    }

    #[test]
    fn does_not_match_unrelated_players_or_blank_identities() {
        let active: LiveClientActivePlayer = serde_json::from_value(serde_json::json!({
            "summonerName": "",
            "riotIdGameName": "我本人"
        }))
        .unwrap();
        let other: LiveClientPlayer = serde_json::from_value(serde_json::json!({
            "championName": "Lux",
            "summonerName": "",
            "riotIdGameName": "队友甲",
            "team": "ORDER"
        }))
        .unwrap();
        // A player carrying no identifiers must never collide with a blank active name.
        let blank: LiveClientPlayer = serde_json::from_value(serde_json::json!({
            "championName": "Yasuo"
        }))
        .unwrap();

        assert!(!live_player_matches_active(&other, &active));
        assert!(!live_player_matches_active(&blank, &active));
    }
}
