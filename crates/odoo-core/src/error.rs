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

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Odoo unreachable: {0}")]
    Unreachable(String),

    #[error("Deserialization error: {0}")]
    Deserialization(#[from] serde_json::Error),
}

pub type OdooResult<T> = Result<T, OdooError>;
