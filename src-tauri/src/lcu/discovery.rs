use std::{collections::HashMap, env, fs, path::PathBuf};

#[derive(Debug, Default)]
pub struct DiscoveryEnvironment {
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

pub fn candidate_lockfile_paths(environment: &DiscoveryEnvironment) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(override_path) = environment.variables.get("LEAGUE_CLIENT_LOCKFILE") {
        paths.push(PathBuf::from(override_path));
    }
    paths.extend(
        environment
            .process_roots
            .iter()
            .cloned()
            .map(lockfile_under),
    );
    paths.extend(
        environment
            .registry_roots
            .iter()
            .cloned()
            .map(lockfile_under),
    );
    paths.extend(environment.common_roots.iter().cloned().map(lockfile_under));
    paths.push(PathBuf::from(r"C:\Riot Games\League of Legends\lockfile"));
    for key in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = environment.variables.get(key) {
            paths.push(PathBuf::from(root).join(r"Riot Games\League of Legends\lockfile"));
        }
    }
    if let Some(drive) = environment.variables.get("SystemDrive") {
        paths.push(PathBuf::from(drive).join(r"Riot Games\League of Legends\lockfile"));
    }
    let mut unique = Vec::new();
    for path in paths {
        if !unique.contains(&path) {
            unique.push(path);
        }
    }
    unique
}

pub fn read_lockfile_contents() -> Option<String> {
    candidate_lockfile_paths(&DiscoveryEnvironment::current())
        .into_iter()
        .find_map(|path| fs::read_to_string(path).ok())
}

#[cfg(target_os = "windows")]
fn discover_process_roots() -> Vec<PathBuf> {
    use std::process::Command;
    let output = Command::new("wmic")
        .args([
            "process",
            "where",
            "name='LeagueClientUx.exe'",
            "get",
            "ExecutablePath",
            "/value",
        ])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.strip_prefix("ExecutablePath="))
        .filter_map(|path| PathBuf::from(path.trim()).parent().map(PathBuf::from))
        .collect()
}

#[cfg(not(target_os = "windows"))]
fn discover_process_roots() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn discover_registry_roots() -> Vec<PathBuf> {
    use std::process::Command;
    let keys = [
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Riot Game league_of_legends.live",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\Riot Game league_of_legends.live",
    ];
    keys.into_iter()
        .filter_map(|key| {
            Command::new("reg")
                .args(["query", key, "/v", "InstallLocation"])
                .output()
                .ok()
        })
        .flat_map(|output| {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter_map(|line| {
            line.split("REG_SZ")
                .nth(1)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
        })
        .collect()
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
    use super::{candidate_lockfile_paths, DiscoveryEnvironment};
    use std::path::PathBuf;

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
}
