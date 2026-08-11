#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let log_dir = match lol_companion_lib::diagnostics::default_log_dir() {
        Ok(path) => path,
        Err(error) => {
            show_startup_error(&format!("LOL Companion 无法确定日志目录。\n\n{error}"));
            return;
        }
    };
    let _log_guard = match lol_companion_lib::diagnostics::init(&log_dir) {
        Ok(guard) => guard,
        Err(error) => {
            show_startup_error(&format!(
                "LOL Companion 日志系统启动失败。\n\n{error}\n\n请确认该目录可写：{}",
                log_dir.display()
            ));
            return;
        }
    };

    if let Err(error) = lol_companion_lib::run() {
        tracing::error!(%error, "desktop shell failed to start");
        show_startup_error(&format!(
            "LOL Companion 启动失败。\n\n{error}\n\n诊断日志：{}",
            log_dir.display()
        ));
    }
}

#[cfg(windows)]
fn show_startup_error(message: &str) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let title = std::ffi::OsStr::new("LOL Companion 启动失败")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let body = std::ffi::OsStr::new(message)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            body.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(windows))]
fn show_startup_error(message: &str) {
    eprintln!("{message}");
}
