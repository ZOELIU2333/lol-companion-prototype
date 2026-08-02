pub mod export;
pub mod health;
pub mod redact;

use std::{
    env, fmt,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

use thiserror::Error;
use tracing::{field::Visit, Event, Subscriber};
use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{
    fmt::{format::Writer, FmtContext, FormatEvent, FormatFields},
    registry::LookupSpan,
};

use redact::redact;

pub use tracing_appender::non_blocking::WorkerGuard;

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();

#[derive(Debug, Error)]
pub enum DiagnosticError {
    #[error("无法创建日志目录 {path}: {source}")]
    CreateDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("无法创建滚动日志: {0}")]
    CreateAppender(#[from] tracing_appender::rolling::InitError),
    #[error("日志系统已经初始化或无法启动: {0}")]
    InstallSubscriber(String),
}

#[derive(Default)]
struct EventFields(String);

impl Visit for EventFields {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if !self.0.is_empty() {
            self.0.push(' ');
        }
        if field.name() == "message" {
            self.0.push_str(value);
        } else {
            self.0.push_str(field.name());
            self.0.push('=');
            self.0.push_str(value);
        }
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
        if !self.0.is_empty() {
            self.0.push(' ');
        }
        if field.name() != "message" {
            self.0.push_str(field.name());
            self.0.push('=');
        }
        self.0.push_str(&format!("{value:?}"));
    }
}

struct RedactingFormatter;

impl<S, N> FormatEvent<S, N> for RedactingFormatter
where
    S: Subscriber + for<'lookup> LookupSpan<'lookup>,
    N: for<'writer> FormatFields<'writer> + 'static,
{
    fn format_event(
        &self,
        _ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> fmt::Result {
        let mut fields = EventFields::default();
        event.record(&mut fields);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        writeln!(
            writer,
            "{timestamp} {} {} {}",
            event.metadata().level(),
            event.metadata().target(),
            redact(&fields.0)
        )
    }
}

pub fn default_log_dir() -> Result<PathBuf, DiagnosticError> {
    #[cfg(windows)]
    let root = env::var_os("LOCALAPPDATA").map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let root = env::var_os("HOME").map(|home| PathBuf::from(home).join("Library/Logs"));
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let root = env::var_os("XDG_STATE_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/state")));

    Ok(root
        .unwrap_or_else(env::temp_dir)
        .join("LOL Companion")
        .join("logs"))
}

pub fn configured_log_dir() -> Option<&'static Path> {
    LOG_DIR.get().map(PathBuf::as_path)
}

pub fn init(app_log_dir: &Path) -> Result<WorkerGuard, DiagnosticError> {
    std::fs::create_dir_all(app_log_dir).map_err(|source| DiagnosticError::CreateDirectory {
        path: app_log_dir.to_path_buf(),
        source,
    })?;
    let appender = rolling::Builder::new()
        .rotation(rolling::Rotation::DAILY)
        .filename_prefix("lol-companion")
        .filename_suffix("log")
        .max_log_files(7)
        .build(app_log_dir)?;
    let (writer, guard) = non_blocking(appender);
    tracing_subscriber::fmt()
        .with_writer(writer)
        .event_format(RedactingFormatter)
        .try_init()
        .map_err(|error| DiagnosticError::InstallSubscriber(error.to_string()))?;
    let _ = LOG_DIR.set(app_log_dir.to_path_buf());
    install_panic_hook();
    tracing::info!(log_dir = %app_log_dir.display(), "desktop diagnostics initialized");
    Ok(guard)
}

fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        tracing::error!(panic = %panic_info, "desktop panic");
        previous(panic_info);
    }));
}
