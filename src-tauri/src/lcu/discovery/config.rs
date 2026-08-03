use std::{
    fs::{self, File},
    io::{self, Write},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::diagnostics::configured_log_dir;

use super::super::lockfile::parse as parse_lockfile;

const CONFIG_FILE_NAME: &str = "league-client.json";
const CONFIG_VERSION: u8 = 1;

#[derive(Debug, thiserror::Error)]
pub enum SelectionError {
    #[error("请选择 League of Legends 安装目录，或名称为 lockfile 的文件")]
    InvalidSelection,
    #[error("所选 lockfile 无法读取")]
    Unreadable,
    #[error("所选 lockfile 格式无效；请先启动英雄联盟客户端后重试")]
    InvalidLockfile,
    #[error("无法保存 League 客户端路径: {0}")]
    Persist(#[from] io::Error),
    #[error("诊断目录尚未初始化")]
    DiagnosticsUnavailable,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedLeaguePath {
    version: u8,
    lockfile_path: PathBuf,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SelectionKind {
    Directory,
    Lockfile,
}

pub fn validate_selection(path: &Path) -> Result<PathBuf, SelectionError> {
    let lockfile_path = if path.is_dir() {
        path.join("lockfile")
    } else if path.file_name().is_some_and(|name| name == "lockfile") {
        path.to_path_buf()
    } else {
        return Err(SelectionError::InvalidSelection);
    };
    let raw = fs::read_to_string(&lockfile_path).map_err(|_| SelectionError::Unreadable)?;
    parse_lockfile(&raw).map_err(|_| SelectionError::InvalidLockfile)?;
    Ok(lockfile_path)
}

fn temporary_config_path(config_path: &Path) -> PathBuf {
    let mut name = config_path.file_name().unwrap_or_default().to_os_string();
    name.push(".tmp");
    config_path.with_file_name(name)
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    fn wide_null(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(Some(0)).collect()
    }

    let source = wide_null(source.as_os_str());
    let destination = wide_null(destination.as_os_str());
    if unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

pub(crate) fn save_selected_lockfile_at(
    config_path: &Path,
    lockfile_path: &Path,
) -> Result<(), SelectionError> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let payload = serde_json::to_vec_pretty(&SavedLeaguePath {
        version: CONFIG_VERSION,
        lockfile_path: lockfile_path.to_path_buf(),
    })
    .map_err(io::Error::other)?;
    let temporary_path = temporary_config_path(config_path);
    let mut file = File::create(&temporary_path)?;
    file.write_all(&payload)?;
    file.flush()?;
    file.sync_all()?;
    replace_file(&temporary_path, config_path)?;
    Ok(())
}

pub(crate) fn load_saved_lockfile_at(config_path: &Path) -> Option<PathBuf> {
    let saved = serde_json::from_slice::<SavedLeaguePath>(&fs::read(config_path).ok()?).ok()?;
    if saved.version != CONFIG_VERSION {
        return None;
    }
    validate_selection(&saved.lockfile_path).ok()
}

fn production_config_path() -> Result<PathBuf, SelectionError> {
    let log_dir = configured_log_dir().ok_or(SelectionError::DiagnosticsUnavailable)?;
    Ok(log_dir.parent().unwrap_or(log_dir).join(CONFIG_FILE_NAME))
}

pub fn load_saved_lockfile() -> Option<PathBuf> {
    load_saved_lockfile_at(&production_config_path().ok()?)
}

fn save_selected_lockfile(lockfile_path: &Path) -> Result<(), SelectionError> {
    save_selected_lockfile_at(&production_config_path()?, lockfile_path)
}

#[cfg(windows)]
fn pick_selection(kind: SelectionKind) -> Option<PathBuf> {
    let dialog = rfd::FileDialog::new().set_title("选择英雄联盟安装位置");
    match kind {
        SelectionKind::Directory => dialog.pick_folder(),
        SelectionKind::Lockfile => dialog.set_file_name("lockfile").pick_file(),
    }
}

#[tauri::command]
pub fn choose_league_installation(kind: SelectionKind) -> Result<Option<String>, String> {
    #[cfg(not(windows))]
    {
        let _ = kind;
        return Err("手动选择 League 路径仅在 Windows 桌面版中可用".to_owned());
    }

    #[cfg(windows)]
    {
        let Some(selection) = pick_selection(kind) else {
            return Ok(None);
        };
        let lockfile_path = validate_selection(&selection).map_err(|error| error.to_string())?;
        save_selected_lockfile(&lockfile_path).map_err(|error| error.to_string())?;
        tracing::info!(source = "manual", "League installation selected");
        let install_directory = lockfile_path.parent().unwrap_or(&lockfile_path);
        Ok(Some(install_directory.to_string_lossy().into_owned()))
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        load_saved_lockfile_at, save_selected_lockfile_at, validate_selection, SelectionError,
    };

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "lol-companion-config-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    #[test]
    fn validates_persists_and_reloads_selected_directory() {
        let root = temp_root();
        let league = root.join("League of Legends");
        fs::create_dir_all(&league).expect("create League fixture");
        fs::write(league.join("lockfile"), "LeagueClient:1:54321:secret:https")
            .expect("write valid lockfile");

        let selected = validate_selection(&league).expect("validate directory");
        let config_path = root.join("league-client.json");
        save_selected_lockfile_at(&config_path, &selected).expect("persist path");

        assert_eq!(load_saved_lockfile_at(&config_path), Some(selected));
        fs::remove_dir_all(root).expect("remove config fixture");
    }

    #[test]
    fn rejects_wrong_filename_and_invalid_lockfile() {
        let root = temp_root();
        fs::create_dir_all(&root).expect("create config fixture");
        let wrong_name = root.join("LeagueClientUx.exe");
        fs::write(&wrong_name, "binary").expect("write wrong selection");
        assert!(matches!(
            validate_selection(&wrong_name),
            Err(SelectionError::InvalidSelection)
        ));

        let lockfile = root.join("lockfile");
        fs::write(&lockfile, "invalid").expect("write invalid lockfile");
        assert!(matches!(
            validate_selection(&lockfile),
            Err(SelectionError::InvalidLockfile)
        ));
        fs::remove_dir_all(root).expect("remove invalid config fixture");
    }
}
