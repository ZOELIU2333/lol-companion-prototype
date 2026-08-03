use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use super::lockfile::parse as parse_lockfile;

pub mod config;

#[cfg(target_os = "windows")]
mod windows;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DiscoverySource {
    Saved,
    Environment,
    Process,
    Registry,
    Common,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProbeStatus {
    Missing,
    NotFile,
    Unreadable,
    InvalidFormat,
    Valid,
}

#[derive(Debug, Clone)]
pub struct CandidateProbe {
    pub source: DiscoverySource,
    pub path: PathBuf,
    pub status: ProbeStatus,
}

#[derive(Debug, Clone)]
pub struct DiscoveryReport {
    pub correlation_id: u128,
    pub selected_path: Option<PathBuf>,
    pub selected_source: Option<DiscoverySource>,
    pub probes: Vec<CandidateProbe>,
}

#[derive(Debug, Default)]
pub struct DiscoveryEnvironment {
    saved_lockfile: Option<PathBuf>,
    variables: HashMap<String, String>,
    process_roots: Vec<PathBuf>,
    registry_roots: Vec<PathBuf>,
    common_roots: Vec<PathBuf>,
}

impl DiscoveryEnvironment {
    pub fn current() -> Self {
        let variables = [
            "LEAGUE_CLIENT_LOCKFILE",
            "ProgramFiles",
            "ProgramFiles(x86)",
            "SystemDrive",
        ]
        .into_iter()
        .filter_map(|key| env::var(key).ok().map(|value| (key.to_string(), value)))
        .collect();
        Self {
            saved_lockfile: config::load_saved_lockfile(),
            variables,
            process_roots: discover_process_roots(),
            registry_roots: discover_registry_roots(),
            common_roots: discover_common_roots(),
        }
    }

    #[cfg(test)]
    pub fn for_test() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub fn with_var(mut self, key: &str, value: &str) -> Self {
        self.variables.insert(key.to_string(), value.to_string());
        self
    }

    #[cfg(test)]
    pub fn with_saved_lockfile(mut self, path: &str) -> Self {
        self.saved_lockfile = Some(PathBuf::from(path));
        self
    }

    #[cfg(test)]
    pub fn with_process_root(mut self, root: &str) -> Self {
        self.process_roots.push(PathBuf::from(root));
        self
    }

    #[cfg(test)]
    pub fn with_registry_root(mut self, root: &str) -> Self {
        self.registry_roots.push(PathBuf::from(root));
        self
    }

    #[cfg(test)]
    pub fn with_common_root(mut self, root: &str) -> Self {
        self.common_roots.push(PathBuf::from(root));
        self
    }
}

fn lockfile_under(root: PathBuf) -> PathBuf {
    if root.file_name().is_some_and(|name| name == "lockfile") {
        root
    } else if root.to_string_lossy().contains('\\') {
        PathBuf::from(format!(
            r"{}\lockfile",
            root.to_string_lossy().trim_end_matches('\\')
        ))
    } else {
        root.join("lockfile")
    }
}

fn sourced_candidate_lockfile_paths(
    environment: &DiscoveryEnvironment,
) -> Vec<(DiscoverySource, PathBuf)> {
    let mut paths = Vec::new();
    if let Some(saved_path) = &environment.saved_lockfile {
        paths.push((DiscoverySource::Saved, saved_path.clone()));
    }
    if let Some(override_path) = environment.variables.get("LEAGUE_CLIENT_LOCKFILE") {
        paths.push((DiscoverySource::Environment, PathBuf::from(override_path)));
    }
    paths.extend(
        environment
            .process_roots
            .iter()
            .cloned()
            .map(lockfile_under)
            .map(|path| (DiscoverySource::Process, path)),
    );
    paths.extend(
        environment
            .registry_roots
            .iter()
            .cloned()
            .map(lockfile_under)
            .map(|path| (DiscoverySource::Registry, path)),
    );
    paths.extend(
        environment
            .common_roots
            .iter()
            .cloned()
            .map(lockfile_under)
            .map(|path| (DiscoverySource::Common, path)),
    );
    paths.push((
        DiscoverySource::Common,
        PathBuf::from(r"C:\Riot Games\League of Legends\lockfile"),
    ));
    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = environment.variables.get(key) {
            paths.push((
                DiscoverySource::Common,
                PathBuf::from(root).join(r"Riot Games\League of Legends\lockfile"),
            ));
        }
    }
    if let Some(drive) = environment.variables.get("SystemDrive") {
        paths.push((
            DiscoverySource::Common,
            PathBuf::from(drive).join(r"Riot Games\League of Legends\lockfile"),
        ));
    }
    let mut unique = Vec::new();
    for candidate in paths {
        if !unique
            .iter()
            .any(|(_, path): &(DiscoverySource, PathBuf)| path == &candidate.1)
        {
            unique.push(candidate);
        }
    }
    unique
}

pub fn candidate_lockfile_paths(environment: &DiscoveryEnvironment) -> Vec<PathBuf> {
    sourced_candidate_lockfile_paths(environment)
        .into_iter()
        .map(|(_, path)| path)
        .collect()
}

fn probe_path(path: &PathBuf) -> ProbeStatus {
    if !path.exists() {
        return ProbeStatus::Missing;
    }
    if !path.is_file() {
        return ProbeStatus::NotFile;
    }
    match fs::read_to_string(path) {
        Ok(raw) if parse_lockfile(&raw).is_ok() => ProbeStatus::Valid,
        Ok(_) => ProbeStatus::InvalidFormat,
        Err(_) => ProbeStatus::Unreadable,
    }
}

fn discover_with_environment(environment: &DiscoveryEnvironment) -> DiscoveryReport {
    let mut report = DiscoveryReport {
        correlation_id: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        selected_path: None,
        selected_source: None,
        probes: Vec::new(),
    };
    for (source, path) in sourced_candidate_lockfile_paths(environment) {
        let status = probe_path(&path);
        report.probes.push(CandidateProbe {
            source,
            path: path.clone(),
            status,
        });
        if status == ProbeStatus::Valid {
            report.selected_path = Some(path);
            report.selected_source = Some(source);
            break;
        }
    }
    report
}

pub fn discover_lockfile() -> DiscoveryReport {
    discover_with_environment(&DiscoveryEnvironment::current())
}

pub fn find_lockfile_path() -> Option<PathBuf> {
    discover_lockfile().selected_path
}

pub fn read_lockfile_contents() -> Option<String> {
    fs::read_to_string(find_lockfile_path()?).ok()
}

#[cfg(target_os = "windows")]
fn discover_process_roots() -> Vec<PathBuf> {
    windows::process_install_roots()
}

#[cfg(not(target_os = "windows"))]
fn discover_process_roots() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn discover_registry_roots() -> Vec<PathBuf> {
    windows::registry_install_roots()
}

#[cfg(not(target_os = "windows"))]
fn discover_registry_roots() -> Vec<PathBuf> {
    Vec::new()
}

fn discover_common_roots() -> Vec<PathBuf> {
    ('C'..='Z')
        .map(|drive| PathBuf::from(format!(r"{}:\Riot Games\League of Legends", drive)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        candidate_lockfile_paths, discover_with_environment, DiscoveryEnvironment, DiscoverySource,
        ProbeStatus,
    };
    use std::{fs, path::PathBuf};

    #[test]
    fn custom_lockfile_path_is_first() {
        let env = DiscoveryEnvironment::for_test().with_var(
            "LEAGUE_CLIENT_LOCKFILE",
            r"D:\Riot\League of Legends\lockfile",
        );
        assert_eq!(
            candidate_lockfile_paths(&env)[0],
            PathBuf::from(r"D:\Riot\League of Legends\lockfile")
        );
    }

    #[test]
    fn saved_lockfile_precedes_environment_and_automatic_sources() {
        let env = DiscoveryEnvironment::for_test()
            .with_saved_lockfile(r"E:\Riot\League of Legends\lockfile")
            .with_var(
                "LEAGUE_CLIENT_LOCKFILE",
                r"D:\Riot\League of Legends\lockfile",
            );
        assert_eq!(
            candidate_lockfile_paths(&env)[0],
            PathBuf::from(r"E:\Riot\League of Legends\lockfile")
        );
    }

    #[test]
    fn process_registry_and_non_default_roots_are_discovered() {
        let env = DiscoveryEnvironment::for_test()
            .with_process_root(r"E:\Games\League of Legends")
            .with_registry_root(r"F:\Riot\League of Legends")
            .with_common_root(r"G:\Riot Games\League of Legends");
        let paths = candidate_lockfile_paths(&env);

        assert!(paths.contains(&PathBuf::from(r"E:\Games\League of Legends\lockfile")));
        assert!(paths.contains(&PathBuf::from(r"F:\Riot\League of Legends\lockfile")));
        assert!(paths.contains(&PathBuf::from(r"G:\Riot Games\League of Legends\lockfile")));
    }

    #[test]
    fn report_distinguishes_missing_and_selected_candidates() {
        let root = std::env::temp_dir().join(format!(
            "lol-companion-discovery-report-{}",
            std::process::id()
        ));
        let league = root.join("League of Legends");
        fs::create_dir_all(&league).expect("create League directory");
        fs::write(
            league.join("lockfile"),
            "LeagueClient:1234:54321:secret:https",
        )
        .expect("write lockfile");

        let environment = DiscoveryEnvironment::for_test()
            .with_var(
                "LEAGUE_CLIENT_LOCKFILE",
                root.join("missing").to_string_lossy().as_ref(),
            )
            .with_process_root(league.to_string_lossy().as_ref());
        let report = discover_with_environment(&environment);

        assert_eq!(report.selected_source, Some(DiscoverySource::Process));
        assert_eq!(report.probes[0].status, ProbeStatus::Missing);
        assert_eq!(report.probes[1].status, ProbeStatus::Valid);
        fs::remove_dir_all(root).expect("remove discovery fixture");
    }

    #[test]
    fn native_windows_discovery_does_not_spawn_console_commands() {
        let source = include_str!("discovery/windows.rs");
        assert!(!source.contains("Command::new"));
        assert!(!source.contains("wmic"));
        assert!(!source.contains("reg.exe"));
    }
}
