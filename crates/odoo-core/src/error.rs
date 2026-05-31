//! Error types for odoo-core.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum OdooError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Odoo API error ({code}): {message}")]
    Api {
        code: i64,
        message: String,
        data: Option<serde_json::Value>,
    },

    #[error("Invalid response from Odoo: {0}")]
    InvalidResponse(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Authentication failed: {0}")]
    LoginFailed(String),

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Odoo unreachable: {0}")]
    Unreachable(String),

    #[error("Deserialization error: {0}")]
    Deserialization(#[from] serde_json::Error),
}

pub type OdooResult<T> = Result<T, OdooError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_http_error() {
        let reqwest_err = reqwest::Proxy::all("not a url").unwrap_err();
        let err = OdooError::from(reqwest_err);
        let msg = format!("{err}");
        assert!(msg.starts_with("HTTP request failed:"));
    }

    #[test]
    fn from_serde_error() {
        let serde_err = serde_json::from_str::<serde_json::Value>("bad json").unwrap_err();
        let odoo_err: OdooError = serde_err.into();
        assert!(matches!(odoo_err, OdooError::Deserialization(_)));
        assert!(format!("{odoo_err}").contains("Deserialization error:"));
    }
}
