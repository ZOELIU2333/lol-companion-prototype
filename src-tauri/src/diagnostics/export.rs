use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use super::{configured_log_dir, redact::redact};

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn approved_log_name(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?;
    (name.starts_with("lol-companion.") && name.ends_with(".log")).then(|| name.to_owned())
}

pub fn export_from(log_dir: &Path, destination: &Path) -> Result<PathBuf, String> {
    let output = fs::File::create(destination).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(output);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let manifest = serde_json::to_vec_pretty(&serde_json::json!({
        "applicationVersion": env!("CARGO_PKG_VERSION"),
        "catalogResource": "public/data/arena/manifest.json",
        "createdUnixSeconds": unix_seconds(),
        "privacy": "credentials and authorization headers are redacted",
    }))
    .map_err(|error| error.to_string())?;
    zip.start_file("diagnostics-manifest.json", options)
        .map_err(|error| error.to_string())?;
    zip.write_all(&manifest)
        .map_err(|error| error.to_string())?;

    let mut logs = fs::read_dir(log_dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| approved_log_name(&entry.path()).map(|name| (name, entry.path())))
        .collect::<Vec<_>>();
    logs.sort_by(|left, right| left.0.cmp(&right.0));

    for (name, path) in logs {
        let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
        zip.start_file(format!("logs/{name}"), options)
            .map_err(|error| error.to_string())?;
        zip.write_all(redact(&contents).as_bytes())
            .map_err(|error| error.to_string())?;
    }

    zip.finish().map_err(|error| error.to_string())?;
    Ok(destination.to_path_buf())
}

#[tauri::command]
pub fn export_diagnostics() -> Result<String, String> {
    let log_dir = configured_log_dir().ok_or_else(|| "诊断日志尚未初始化".to_owned())?;
    let parent = log_dir.parent().unwrap_or(log_dir);
    let destination = parent.join(format!("LOL-Companion-diagnostics-{}.zip", unix_seconds()));
    export_from(log_dir, &destination)?;
    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use std::{fs, io::Read};

    use super::export_from;

    #[test]
    fn zip_contains_only_redacted_logs_and_manifest() {
        let root = std::env::temp_dir().join(format!(
            "lol-companion-diagnostics-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let logs = root.join("logs");
        fs::create_dir_all(&logs).expect("create logs");
        fs::write(
            logs.join("lol-companion.2026-08-03.log"),
            "Authorization: Basic abc",
        )
        .expect("write log");
        fs::write(logs.join("private.lockfile"), "do-not-export").expect("write private file");

        let output = root.join("diagnostics.zip");
        export_from(&logs, &output).expect("export diagnostics");

        let file = fs::File::open(&output).expect("open zip");
        let mut archive = zip::ZipArchive::new(file).expect("read zip");
        let mut names = (0..archive.len())
            .map(|index| {
                archive
                    .by_index(index)
                    .expect("zip entry")
                    .name()
                    .to_owned()
            })
            .collect::<Vec<_>>();
        names.sort();
        assert_eq!(
            names,
            vec![
                "diagnostics-manifest.json".to_owned(),
                "logs/lol-companion.2026-08-03.log".to_owned(),
            ]
        );

        let mut log = String::new();
        archive
            .by_name("logs/lol-companion.2026-08-03.log")
            .expect("log entry")
            .read_to_string(&mut log)
            .expect("read log");
        assert!(!log.contains("Basic abc"));
        assert!(log.contains("[REDACTED]"));

        fs::remove_dir_all(root).expect("clean test directory");
    }
}
