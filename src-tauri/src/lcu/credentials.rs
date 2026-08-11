#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub(crate) enum CredentialValidationError {
    #[error("进程编号无效")]
    InvalidPid,
    #[error("端口无效")]
    InvalidPort,
    #[error("认证字段为空")]
    EmptyPassword,
    #[error("协议无效")]
    InvalidProtocol,
}

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct LcuCredentials {
    pid: u32,
    port: u16,
    password: String,
    protocol: String,
}

impl LcuCredentials {
    pub(crate) fn try_new(
        pid: u32,
        port: u16,
        password: String,
        protocol: String,
    ) -> Result<Self, CredentialValidationError> {
        if pid == 0 {
            return Err(CredentialValidationError::InvalidPid);
        }
        if port == 0 {
            return Err(CredentialValidationError::InvalidPort);
        }
        if password.is_empty() {
            return Err(CredentialValidationError::EmptyPassword);
        }
        let protocol = protocol.to_ascii_lowercase();
        if !matches!(protocol.as_str(), "http" | "https") {
            return Err(CredentialValidationError::InvalidProtocol);
        }
        Ok(Self {
            pid,
            port,
            password,
            protocol,
        })
    }

    pub(crate) fn pid(&self) -> u32 {
        self.pid
    }
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

impl std::fmt::Debug for LcuCredentials {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("LcuCredentials")
            .field("pid", &self.pid)
            .field("port", &self.port)
            .field("password", &"[REDACTED]")
            .field("protocol", &self.protocol)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::{CredentialValidationError, LcuCredentials};

    #[test]
    fn validates_and_redacts_credentials() {
        let value =
            LcuCredentials::try_new(42, 12345, "fixture-secret".into(), "HTTPS".into()).unwrap();
        assert_eq!(value.pid(), 42);
        assert_eq!(value.port(), 12345);
        assert_eq!(value.protocol(), "https");
        let debug = format!("{value:?}");
        assert!(!debug.contains("fixture-secret"));
        assert!(debug.contains("[REDACTED]"));
    }

    #[test]
    fn rejects_unsafe_values_by_category() {
        assert_eq!(
            LcuCredentials::try_new(0, 1, "x".into(), "https".into()),
            Err(CredentialValidationError::InvalidPid)
        );
        assert_eq!(
            LcuCredentials::try_new(1, 0, "x".into(), "https".into()),
            Err(CredentialValidationError::InvalidPort)
        );
        assert_eq!(
            LcuCredentials::try_new(1, 1, String::new(), "https".into()),
            Err(CredentialValidationError::EmptyPassword)
        );
        assert_eq!(
            LcuCredentials::try_new(1, 1, "x".into(), "ftp".into()),
            Err(CredentialValidationError::InvalidProtocol)
        );
    }
}
