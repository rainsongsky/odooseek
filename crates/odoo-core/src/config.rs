//! Server configuration loaded from environment variables.

use crate::error::{OdooError, OdooResult};

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    /// Odoo base URL (e.g. http://localhost:8069 or http://web:8069)
    pub odoo_url: String,
    /// Default Odoo database
    pub odoo_db: Option<String>,
    /// Path to oweb SPA static files
    pub frontend_dir: String,
    /// Log level filter (e.g. info, debug)
    pub log_level: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".into(),
            port: 3000,
            odoo_url: "http://localhost:8069".into(),
            odoo_db: None,
            frontend_dir: "../apps/oweb/dist".into(),
            log_level: "info".into(),
        }
    }
}

impl ServerConfig {
    pub fn from_env() -> OdooResult<Self> {
        Ok(Self {
            host: env_or("HOST", "0.0.0.0"),
            port: env_or("PORT", "3000")
                .parse()
                .map_err(|_| OdooError::Config("Invalid PORT".into()))?,
            odoo_url: env_or("ODOO_URL", "http://localhost:8069"),
            odoo_db: env_opt("ODOO_DB"),
            frontend_dir: env_or("FRONTEND_DIR", "../apps/oweb/dist"),
            log_level: env_or("RUST_LOG", "info"),
        })
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_opt(key: &str) -> Option<String> {
    std::env::var(key).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_values() {
        let config = ServerConfig::default();
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 3000);
        assert_eq!(config.odoo_url, "http://localhost:8069");
    }

    #[test]
    fn from_env_valid() {
        temp_env::with_var("PORT", Some("4000"), || {
            let config = ServerConfig::from_env().unwrap();
            assert_eq!(config.port, 4000);
        });
    }

    #[test]
    fn from_env_missing_db() {
        let no_db: Option<&str> = None;
        temp_env::with_var("ODOO_DB", no_db, || {
            let config = ServerConfig::from_env().unwrap();
            assert!(config.odoo_db.is_none());
        });
    }
}
