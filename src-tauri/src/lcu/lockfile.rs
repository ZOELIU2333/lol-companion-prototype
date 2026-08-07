pub(crate) struct LcuLockfile {
    port: u16,
    password: String,
    protocol: String,
}

impl LcuLockfile {
    pub(crate) fn port(&self) -> u16 {
        self.port
    }

    pub(crate) fn password(&self) -> &str {
        &self.password
    }

    pub(crate) fn protocol(&self) -> &str {
        &self.protocol
    }
}

impl std::fmt::Debug for LcuLockfile {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("LcuLockfile")
            .field("port", &self.port)
            .field("password", &"[REDACTED]")
            .field("protocol", &self.protocol)
            .finish()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LockfileParseError {
    FieldCount,
    InvalidPort,
    EmptyPassword,
    InvalidProtocol,
}

pub(crate) fn parse(raw: &str) -> Result<LcuLockfile, LockfileParseError> {
    let parts = raw.trim().split(':').collect::<Vec<_>>();
    if parts.len() != 5 {
        return Err(LockfileParseError::FieldCount);
    }
    let port = parts[2]
        .parse()
        .map_err(|_| LockfileParseError::InvalidPort)?;
    if parts[3].is_empty() {
        return Err(LockfileParseError::EmptyPassword);
    }
    if !matches!(parts[4], "http" | "https") {
        return Err(LockfileParseError::InvalidProtocol);
    }
    Ok(LcuLockfile {
        port,
        password: parts[3].to_owned(),
        protocol: parts[4].to_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn parses_valid_lockfile_without_exposing_password_in_debug() {
        let parsed = parse("LeagueClient:1234:54321:super-secret:https").unwrap();
        assert_eq!(parsed.port(), 54321);
        assert_eq!(parsed.protocol(), "https");
        assert!(!format!("{parsed:?}").contains("super-secret"));
    }

    #[test]
    fn rejects_malformed_lockfiles_by_category() {
        assert!(parse("LeagueClient:bad").is_err());
        assert!(parse("LeagueClient:1:bad:secret:https").is_err());
        assert!(parse("LeagueClient:1:54321::https").is_err());
        assert!(parse("LeagueClient:1:54321:secret:ftp").is_err());
    }
}
