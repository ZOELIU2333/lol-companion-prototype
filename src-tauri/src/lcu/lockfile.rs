use super::credentials::{CredentialValidationError, LcuCredentials};

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub(crate) enum LockfileParseError {
    #[error("字段数量不正确")]
    FieldCount,
    #[error("进程编号无效")]
    InvalidPid,
    #[error("端口无效")]
    InvalidPort,
    #[error("认证字段为空")]
    EmptyPassword,
    #[error("协议无效")]
    InvalidProtocol,
}

pub(crate) fn parse(raw: &str) -> Result<LcuCredentials, LockfileParseError> {
    let normalized = raw
        .trim_start_matches('\u{feff}')
        .trim_end_matches(|character| matches!(character, '\0' | '\r' | '\n'));
    let parts = normalized.split(':').collect::<Vec<_>>();
    if parts.len() < 5 {
        return Err(LockfileParseError::FieldCount);
    }
    let pid = parts[1]
        .parse::<u32>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(LockfileParseError::InvalidPid)?;
    let port = parts[2]
        .parse::<u16>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(LockfileParseError::InvalidPort)?;
    let protocol = parts
        .last()
        .copied()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let password = parts[3..parts.len() - 1].join(":");
    LcuCredentials::try_new(pid, port, password, protocol).map_err(|error| match error {
        CredentialValidationError::InvalidPid => LockfileParseError::InvalidPid,
        CredentialValidationError::InvalidPort => LockfileParseError::InvalidPort,
        CredentialValidationError::EmptyPassword => LockfileParseError::EmptyPassword,
        CredentialValidationError::InvalidProtocol => LockfileParseError::InvalidProtocol,
    })
}

#[cfg(test)]
mod tests {
    use super::{parse, LockfileParseError};

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

    #[test]
    fn parses_bom_nul_and_colons_inside_password() {
        let parsed = parse("\u{feff}LeagueClient:1234:54321:token:with:colon:https\0\r\n").unwrap();
        assert_eq!(parsed.pid(), 1234);
        assert_eq!(parsed.port(), 54321);
        assert_eq!(parsed.password(), "token:with:colon");
        assert_eq!(parsed.protocol(), "https");
    }

    #[test]
    fn rejects_invalid_structure_by_safe_category() {
        assert!(matches!(
            parse("LeagueClient:0:54321:secret:https"),
            Err(LockfileParseError::InvalidPid)
        ));
        assert!(matches!(
            parse("LeagueClient:1:0:secret:https"),
            Err(LockfileParseError::InvalidPort)
        ));
        assert!(matches!(
            parse("LeagueClient:1:54321::https"),
            Err(LockfileParseError::EmptyPassword)
        ));
        assert!(matches!(
            parse("LeagueClient:1:54321:secret:ftp"),
            Err(LockfileParseError::InvalidProtocol)
        ));
    }
}
