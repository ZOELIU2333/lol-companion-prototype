use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) use super::lockfile::LockfileParseError;
use super::{credentials::LcuCredentials, lockfile::parse as parse_lockfile};

pub mod config;
#[allow(dead_code)]
mod process_arguments;
pub mod telemetry;
pub(crate) use process_arguments::ProcessArgumentsError;

#[cfg(target_os = "windows")]
mod windows;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DiscoverySource {
    Saved,
    Environment,
    Process,
    Registry,
    Common,
    ProcessArguments,
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
    pub parse_error: Option<LockfileParseError>,
    pub process_error: Option<ProcessArgumentsError>,
}

#[derive(Debug, Clone)]
pub struct DiscoveryReport {
    pub correlation_id: u128,
    pub selected_path: Option<PathBuf>,
    pub selected_source: Option<DiscoverySource>,
    pub(crate) selected_credentials: Option<LcuCredentials>,
    pub probes: Vec<CandidateProbe>,
}

#[derive(Debug, Default)]
pub struct DiscoveryEnvironment {
    saved_lockfile: Option<PathBuf>,
    variables: HashMap<String, String>,
    process_roots: Vec<PathBuf>,
    process_arguments: Vec<(PathBuf, Result<LcuCredentials, ProcessArgumentsError>)>,
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
        let (process_roots, process_arguments) = discover_process_sources();
        Self {
            saved_lockfile: config::load_saved_lockfile(),
            variables,
            process_roots,
            process_arguments,
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
    pub fn with_process_arguments(mut self, root: &str, command_line: &str, pid: u32) -> Self {
        self.process_arguments.push((
            PathBuf::from(root).join("LeagueClientUx.exe"),
            process_arguments::parse(command_line, pid),
        ));
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

fn probe_path(
    path: &PathBuf,
) -> (
    ProbeStatus,
    Option<LockfileParseError>,
    Option<LcuCredentials>,
) {
    if !path.exists() {
        return (ProbeStatus::Missing, None, None);
    }
    if !path.is_file() {
        return (ProbeStatus::NotFile, None, None);
    }
    match fs::read_to_string(path) {
        Ok(raw) => match parse_lockfile(&raw) {
            Ok(credentials) => (ProbeStatus::Valid, None, Some(credentials)),
            Err(error) => (ProbeStatus::InvalidFormat, Some(error), None),
        },
        Err(_) => (ProbeStatus::Unreadable, None, None),
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
        selected_credentials: None,
        probes: Vec::new(),
    };
    for (source, path) in sourced_candidate_lockfile_paths(environment) {
        let (status, parse_error, credentials) = probe_path(&path);
        report.probes.push(CandidateProbe {
            source,
            path: path.clone(),
            status,
            parse_error,
            process_error: None,
        });
        if status == ProbeStatus::Valid {
            report.selected_path = Some(path);
            report.selected_source = Some(source);
            report.selected_credentials = credentials;
            break;
        }
    }
    if report.selected_credentials.is_none() {
        for (path, result) in &environment.process_arguments {
            let (status, process_error, credentials) = match result {
                Ok(credentials) => (ProbeStatus::Valid, None, Some(credentials.clone())),
                Err(error) => (ProbeStatus::InvalidFormat, Some(*error), None),
            };
            report.probes.push(CandidateProbe {
                source: DiscoverySource::ProcessArguments,
                path: path.clone(),
                status,
                parse_error: None,
                process_error,
            });
            if let Some(credentials) = credentials {
                report.selected_source = Some(DiscoverySource::ProcessArguments);
                report.selected_credentials = Some(credentials);
                break;
            }
        }
    }
    report
}

pub fn discover_lockfile() -> DiscoveryReport {
    let report = discover_with_environment(&DiscoveryEnvironment::current());
    telemetry::record_report(&report);
    report
}

pub fn find_lockfile_path() -> Option<PathBuf> {
    discover_lockfile().selected_path
}

#[cfg(target_os = "windows")]
fn discover_process_sources() -> (
    Vec<PathBuf>,
    Vec<(PathBuf, Result<LcuCredentials, ProcessArgumentsError>)>,
) {
    let candidates = windows::process_candidates();
    let roots = candidates
        .iter()
        .map(|candidate| candidate.install_root.clone())
        .collect();
    let arguments = candidates
        .iter()
        .map(|candidate| {
            (
                candidate.install_root.join("LeagueClientUx.exe"),
                windows::read_process_credentials(candidate.pid),
            )
        })
        .collect();
    (roots, arguments)
}

#[cfg(not(target_os = "windows"))]
fn discover_process_sources() -> (
    Vec<PathBuf>,
    Vec<(PathBuf, Result<LcuCredentials, ProcessArgumentsError>)>,
) {
    (Vec::new(), Vec::new())
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
    use crate::lcu::lockfile::LockfileParseError;
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
    fn report_carries_only_safe_invalid_format_category() {
        let root = std::env::temp_dir().join(format!(
            "lol-companion-invalid-discovery-report-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("create invalid discovery fixture");
        let lockfile = root.join("lockfile");
        fs::write(&lockfile, "LeagueClient:1:54321:secret:ftp").expect("write invalid lockfile");

        let environment = DiscoveryEnvironment::for_test().with_var(
            "LEAGUE_CLIENT_LOCKFILE",
            lockfile.to_string_lossy().as_ref(),
        );
        let report = discover_with_environment(&environment);

        assert_eq!(report.probes[0].status, ProbeStatus::InvalidFormat);
        assert_eq!(
            report.probes[0].parse_error,
            Some(LockfileParseError::InvalidProtocol)
        );
        fs::remove_dir_all(root).expect("remove invalid discovery fixture");
    }

    #[test]
    fn valid_lockfile_beats_process_arguments() {
        let root = std::env::temp_dir().join(format!("lol-companion-order-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let lockfile = root.join("lockfile");
        fs::write(&lockfile, "LeagueClient:1:1234:file-secret:https").unwrap();
        let environment = DiscoveryEnvironment::for_test()
            .with_saved_lockfile(lockfile.to_string_lossy().as_ref())
            .with_process_arguments(
                root.to_string_lossy().as_ref(),
                "LeagueClientUx.exe --app-port=4321 --remoting-auth-token=process-secret",
                2,
            );
        let report = discover_with_environment(&environment);
        assert_eq!(report.selected_source, Some(DiscoverySource::Saved));
        assert_eq!(report.selected_credentials.as_ref().unwrap().port(), 1234);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn process_arguments_are_used_after_invalid_lockfiles() {
        let root = std::env::temp_dir().join(format!(
            "lol-companion-process-fallback-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let lockfile = root.join("lockfile");
        fs::write(&lockfile, "not:a:standard:lockfile").unwrap();
        let environment = DiscoveryEnvironment::for_test()
            .with_saved_lockfile(lockfile.to_string_lossy().as_ref())
            .with_process_arguments(
                root.to_string_lossy().as_ref(),
                "LeagueClientUx.exe --app-port=4321 --remoting-auth-token=fixture-process-secret",
                2,
            );
        let report = discover_with_environment(&environment);
        assert_eq!(
            report.selected_source,
            Some(DiscoverySource::ProcessArguments)
        );
        assert_eq!(report.selected_credentials.as_ref().unwrap().port(), 4321);
        assert!(!format!("{report:?}").contains("fixture-process-secret"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_windows_discovery_does_not_spawn_console_commands() {
        let source = include_str!("discovery/windows.rs");
        assert!(!source.contains("Command::new"));
        assert!(source.contains("ProcessCommandLineInformation"));
        assert!(!source.contains("powershell"));
        assert!(!source.contains("wmic"));
        assert!(!source.contains("reg.exe"));
    }
}
