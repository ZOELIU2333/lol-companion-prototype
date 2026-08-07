use crate::lcu::credentials::{CredentialValidationError, LcuCredentials};

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub(crate) enum ProcessArgumentsError {
    #[error("进程参数不可用")]
    ArgumentsUnavailable,
    #[error("缺少 LCU 端口")]
    MissingPort,
    #[error("LCU 端口无效")]
    InvalidPort,
    #[error("缺少 LCU 认证字段")]
    MissingToken,
    #[error("LCU 协议无效")]
    InvalidProtocol,
}

fn tokens(command_line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for character in command_line.chars() {
        match character {
            '"' => quoted = !quoted,
            value if value.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    values.push(std::mem::take(&mut current));
                }
            }
            value => current.push(value),
        }
    }
    if !current.is_empty() {
        values.push(current);
    }
    values
}

fn argument(values: &[String], key: &str) -> Option<String> {
    values.iter().enumerate().find_map(|(index, value)| {
        if value == key {
            values
                .get(index + 1)
                .filter(|next| !next.starts_with("--"))
                .cloned()
        } else {
            value.strip_prefix(&format!("{key}=")).map(str::to_owned)
        }
    })
}

pub(crate) fn parse(command_line: &str, pid: u32) -> Result<LcuCredentials, ProcessArgumentsError> {
    let values = tokens(command_line);
    let port_raw = argument(&values, "--app-port")
        .filter(|value| !value.is_empty())
        .ok_or(ProcessArgumentsError::MissingPort)?;
    let port = port_raw
        .parse::<u16>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(ProcessArgumentsError::InvalidPort)?;
    let token = argument(&values, "--remoting-auth-token")
        .filter(|value| !value.is_empty())
        .ok_or(ProcessArgumentsError::MissingToken)?;
    let protocol = argument(&values, "--app-protocol").unwrap_or_else(|| "https".to_owned());
    LcuCredentials::try_new(pid, port, token, protocol).map_err(|error| match error {
        CredentialValidationError::InvalidPid => ProcessArgumentsError::ArgumentsUnavailable,
        CredentialValidationError::InvalidPort => ProcessArgumentsError::InvalidPort,
        CredentialValidationError::EmptyPassword => ProcessArgumentsError::MissingToken,
        CredentialValidationError::InvalidProtocol => ProcessArgumentsError::InvalidProtocol,
    })
}

#[cfg(test)]
mod tests {
    use super::{parse, ProcessArgumentsError};

    #[test]
    fn parses_equals_and_separate_argument_forms() {
        let first = parse(r#"LeagueClientUx.exe --app-port=54321 --remoting-auth-token=fixture-secret --app-protocol=https"#, 77).unwrap();
        assert_eq!(first.port(), 54321);
        assert!(!format!("{first:?}").contains("fixture-secret"));
        let second = parse(r#""C:\Riot Games\LeagueClientUx.exe" --remoting-auth-token "token=two" --app-port "54322""#, 78).unwrap();
        assert_eq!(second.port(), 54322);
        assert_eq!(second.password(), "token=two");
        assert_eq!(second.protocol(), "https");
    }

    #[test]
    fn rejects_missing_and_invalid_allowlisted_values() {
        assert_eq!(
            parse("LeagueClientUx.exe", 1),
            Err(ProcessArgumentsError::MissingPort)
        );
        assert_eq!(
            parse(
                "LeagueClientUx.exe --app-port=99999 --remoting-auth-token=x",
                1
            ),
            Err(ProcessArgumentsError::InvalidPort)
        );
        assert_eq!(
            parse("LeagueClientUx.exe --app-port=1234", 1),
            Err(ProcessArgumentsError::MissingToken)
        );
        assert_eq!(
            parse(
                "LeagueClientUx.exe --app-port=1234 --remoting-auth-token=x --app-protocol=ftp",
                1
            ),
            Err(ProcessArgumentsError::InvalidProtocol)
        );
    }
}
