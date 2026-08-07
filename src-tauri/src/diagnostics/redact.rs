use std::sync::OnceLock;

use regex::Regex;

const REDACTED: &str = "[REDACTED]";

fn patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        [
            r#"(?i)(\"(?:password|api[_-]?key|riot[_-]?api[_-]?key|x-riot-token|authorization)\"\s*:\s*\")([^\"]*)(\")"#,
            r"(?i)(\bX-Riot-Token\s*[:=]\s*)([^\s,;]+)",
            r"(?i)(\bAuthorization\s*[:=]\s*)([^\r\n]+)",
            r"(?i)(\bRiot(?:[_-]?API)?[_-]?Key\s*[:=]\s*)([^\s,;]+)",
            r"(?i)(\briot\s*:\s*)([^\s,;:]+)",
        ]
        .into_iter()
        .map(|pattern| Regex::new(pattern).expect("diagnostic redaction regex must be valid"))
        .collect()
    })
}

fn redact_lockfile_line(line: &str) -> String {
    let mut fields = line.split(':').collect::<Vec<_>>();
    let looks_like_lockfile = fields.len() == 5
        && fields[1].parse::<u32>().is_ok()
        && fields[2].parse::<u16>().is_ok()
        && matches!(fields[4], "http" | "https");
    if looks_like_lockfile {
        fields[3] = REDACTED;
        return fields.join(":");
    }
    line.to_owned()
}

pub fn redact(message: &str) -> String {
    let lockfile_safe = message
        .split('\n')
        .map(redact_lockfile_line)
        .collect::<Vec<_>>()
        .join("\n");
    patterns().iter().fold(lockfile_safe, |safe, pattern| {
        if pattern.as_str().starts_with("(?i)(\\\"") {
            pattern
                .replace_all(&safe, format!("$1{REDACTED}$3"))
                .into_owned()
        } else {
            pattern
                .replace_all(&safe, format!("$1{REDACTED}"))
                .into_owned()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::redact;

    #[test]
    fn removes_local_and_remote_credentials() {
        let raw = "riot:secret X-Riot-Token: RGAPI-secret Authorization: Basic abc";
        let safe = redact(raw);
        assert!(!safe.contains("secret"));
        assert!(!safe.contains("RGAPI-secret"));
        assert!(!safe.contains("Basic abc"));
        assert!(safe.contains("[REDACTED]"));
    }

    #[test]
    fn preserves_ordinary_status_messages() {
        let raw = "Live Client unavailable; retrying in 2500ms";
        assert_eq!(redact(raw), raw);
    }

    #[test]
    fn removes_lockfile_and_json_secrets() {
        let raw = concat!(
            "LeagueClientUx:1234:5678:lock-secret:https\n",
            r#"{"password":"json-secret","apiKey":"RGAPI-json","phase":"InProgress"}"#,
        );
        let safe = redact(raw);
        assert!(!safe.contains("lock-secret"));
        assert!(!safe.contains("json-secret"));
        assert!(!safe.contains("RGAPI-json"));
        assert!(safe.contains("InProgress"));
    }
}
