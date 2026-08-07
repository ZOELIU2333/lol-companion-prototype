use std::{
    env,
    ffi::{OsStr, OsString},
    mem::size_of,
    os::windows::ffi::{OsStrExt, OsStringExt},
    path::PathBuf,
    ptr::{null, null_mut},
};

use windows_sys::Wdk::System::Threading::{
    NtQueryInformationProcess, ProcessCommandLineInformation,
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, ERROR_SUCCESS, HANDLE, INVALID_HANDLE_VALUE, UNICODE_STRING},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Registry::{
            RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER,
            HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY, REG_EXPAND_SZ, REG_SZ,
        },
        Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION},
    },
};

use super::{process_arguments, ProcessArgumentsError};
use crate::lcu::credentials::LcuCredentials;

const MAX_COMMAND_LINE_BYTES: u32 = 64 * 1024;

pub(crate) struct LeagueProcessCandidate {
    pub(crate) pid: u32,
    pub(crate) install_root: PathBuf,
}

struct OwnedHandle(HANDLE);

impl OwnedHandle {
    fn new(handle: HANDLE) -> Option<Self> {
        if handle.is_null() || handle == INVALID_HANDLE_VALUE {
            None
        } else {
            Some(Self(handle))
        }
    }
}

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

struct OwnedRegistryKey(HKEY);

impl Drop for OwnedRegistryKey {
    fn drop(&mut self) {
        unsafe {
            RegCloseKey(self.0);
        }
    }
}

fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

fn wide_slice_to_string(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(value.len());
    OsString::from_wide(&value[..end])
        .to_string_lossy()
        .into_owned()
}

fn query_process_image_path(process_id: u32) -> Option<PathBuf> {
    let handle =
        OwnedHandle::new(unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) })?;
    let mut buffer = vec![0u16; 32_768];
    let mut length = buffer.len() as u32;
    if unsafe { QueryFullProcessImageNameW(handle.0, 0, buffer.as_mut_ptr(), &mut length) } == 0 {
        return None;
    }
    buffer.truncate(length as usize);
    Some(PathBuf::from(OsString::from_wide(&buffer)))
}

pub(crate) fn process_candidates() -> Vec<LeagueProcessCandidate> {
    let Some(snapshot) =
        OwnedHandle::new(unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) })
    else {
        return Vec::new();
    };
    let mut entry = PROCESSENTRY32W {
        dwSize: size_of::<PROCESSENTRY32W>() as u32,
        ..unsafe { std::mem::zeroed() }
    };
    let mut candidates = Vec::new();
    let mut has_entry = unsafe { Process32FirstW(snapshot.0, &mut entry) } != 0;
    while has_entry {
        let executable_name = wide_slice_to_string(&entry.szExeFile);
        if executable_name.eq_ignore_ascii_case("LeagueClientUx.exe") {
            if let Some(root) = query_process_image_path(entry.th32ProcessID)
                .and_then(|path| path.parent().map(PathBuf::from))
            {
                if !candidates
                    .iter()
                    .any(|candidate: &LeagueProcessCandidate| candidate.pid == entry.th32ProcessID)
                {
                    candidates.push(LeagueProcessCandidate {
                        pid: entry.th32ProcessID,
                        install_root: root,
                    });
                }
            }
        }
        has_entry = unsafe { Process32NextW(snapshot.0, &mut entry) } != 0;
    }
    candidates
}

pub(crate) fn read_process_credentials(
    process_id: u32,
) -> Result<LcuCredentials, ProcessArgumentsError> {
    let handle =
        OwnedHandle::new(unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id) })
            .ok_or(ProcessArgumentsError::ArgumentsUnavailable)?;
    let mut required = 0u32;
    unsafe {
        NtQueryInformationProcess(
            handle.0,
            ProcessCommandLineInformation,
            null_mut(),
            0,
            &mut required,
        );
    }
    if required < size_of::<UNICODE_STRING>() as u32 || required > MAX_COMMAND_LINE_BYTES {
        return Err(ProcessArgumentsError::ArgumentsUnavailable);
    }
    let mut buffer = vec![0u8; required as usize];
    let status = unsafe {
        NtQueryInformationProcess(
            handle.0,
            ProcessCommandLineInformation,
            buffer.as_mut_ptr().cast(),
            required,
            &mut required,
        )
    };
    if status < 0 {
        return Err(ProcessArgumentsError::ArgumentsUnavailable);
    }
    let value = unsafe { buffer.as_ptr().cast::<UNICODE_STRING>().read_unaligned() };
    let byte_length = usize::from(value.Length);
    if byte_length == 0 || byte_length % 2 != 0 {
        return Err(ProcessArgumentsError::ArgumentsUnavailable);
    }
    let allocation_start = buffer.as_ptr() as usize;
    let allocation_end = allocation_start
        .checked_add(buffer.len())
        .ok_or(ProcessArgumentsError::ArgumentsUnavailable)?;
    let string_start = value.Buffer as usize;
    let string_end = string_start
        .checked_add(byte_length)
        .ok_or(ProcessArgumentsError::ArgumentsUnavailable)?;
    if string_start < allocation_start || string_end > allocation_end {
        return Err(ProcessArgumentsError::ArgumentsUnavailable);
    }
    let units = unsafe { std::slice::from_raw_parts(value.Buffer, byte_length / 2) };
    let command_line =
        String::from_utf16(units).map_err(|_| ProcessArgumentsError::ArgumentsUnavailable)?;
    process_arguments::parse(&command_line, process_id)
}

fn expand_percent_variables(value: &str) -> String {
    let parts = value.split('%').collect::<Vec<_>>();
    if parts.len() < 3 {
        return value.to_owned();
    }
    let mut expanded = String::new();
    for (index, part) in parts.into_iter().enumerate() {
        if index % 2 == 0 {
            expanded.push_str(part);
        } else if let Ok(replacement) = env::var(part) {
            expanded.push_str(&replacement);
        } else {
            expanded.push('%');
            expanded.push_str(part);
            expanded.push('%');
        }
    }
    expanded
}

fn read_registry_string(hive: HKEY, key_path: &str, view: u32) -> Option<PathBuf> {
    let key_path = wide_null(key_path);
    let mut raw_key: HKEY = null_mut();
    if unsafe { RegOpenKeyExW(hive, key_path.as_ptr(), 0, KEY_READ | view, &mut raw_key) }
        != ERROR_SUCCESS
    {
        return None;
    }
    let key = OwnedRegistryKey(raw_key);
    let value_name = wide_null("InstallLocation");
    let mut value_type = 0u32;
    let mut byte_length = 0u32;
    if unsafe {
        RegQueryValueExW(
            key.0,
            value_name.as_ptr(),
            null(),
            &mut value_type,
            null_mut(),
            &mut byte_length,
        )
    } != ERROR_SUCCESS
        || !matches!(value_type, REG_SZ | REG_EXPAND_SZ)
        || byte_length < 2
    {
        return None;
    }
    let mut buffer = vec![0u16; (byte_length as usize).div_ceil(2)];
    if unsafe {
        RegQueryValueExW(
            key.0,
            value_name.as_ptr(),
            null(),
            &mut value_type,
            buffer.as_mut_ptr().cast::<u8>(),
            &mut byte_length,
        )
    } != ERROR_SUCCESS
    {
        return None;
    }
    let value = wide_slice_to_string(&buffer);
    let value = if value_type == REG_EXPAND_SZ {
        expand_percent_variables(&value)
    } else {
        value
    };
    (!value.trim().is_empty()).then(|| PathBuf::from(value.trim()))
}

pub(crate) fn registry_install_roots() -> Vec<PathBuf> {
    const UNINSTALL_KEY: &str =
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Riot Game league_of_legends.live";
    let mut roots = Vec::new();
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for view in [0, KEY_WOW64_64KEY, KEY_WOW64_32KEY] {
            if let Some(root) = read_registry_string(hive, UNINSTALL_KEY, view) {
                if !roots.contains(&root) {
                    roots.push(root);
                }
            }
        }
    }
    roots
}

#[cfg(test)]
mod tests {
    use super::expand_percent_variables;

    #[test]
    fn expands_known_percent_variables_without_dropping_unknown_values() {
        std::env::set_var("LOL_COMPANION_TEST_DRIVE", r"D:\Games");
        assert_eq!(
            expand_percent_variables(r"%LOL_COMPANION_TEST_DRIVE%\Riot"),
            r"D:\Games\Riot"
        );
        assert_eq!(
            expand_percent_variables(r"%LOL_COMPANION_UNKNOWN%\Riot"),
            r"%LOL_COMPANION_UNKNOWN%\Riot"
        );
        std::env::remove_var("LOL_COMPANION_TEST_DRIVE");
    }
}
