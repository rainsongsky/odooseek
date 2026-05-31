//! Shared types for Odoo communication.

use serde::{Deserialize, Serialize};

/// Session info returned to oweb frontend (camelCase JSON).
/// Built manually in session.rs from Odoo 19 CE's snake_case response.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionInfo {
    #[serde(default)]
    pub authenticated: bool,
    pub uid: Option<i64>,
    pub name: Option<String>,
    pub username: Option<String>,
    pub db: Option<String>,
    pub is_admin: Option<bool>,
    pub is_system: Option<bool>,
    pub partner_id: Option<i64>,
    pub partner_display_name: Option<String>,
    pub server_version: Option<String>,
    pub server_version_info: Option<Vec<serde_json::Value>>,
    pub user_context: Option<serde_json::Value>,
    pub user_companies: Option<serde_json::Value>,
    pub web_base_url: Option<String>,
    pub home_action_id: Option<serde_json::Value>,
    pub active_ids_limit: Option<i64>,
    pub max_file_upload_size: Option<i64>,
    pub groups: Option<serde_json::Value>,
    pub menus: Option<serde_json::Value>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

impl SessionInfo {
    pub fn anonymous() -> Self {
        Self {
            authenticated: false,
            menus: None,
            ..Default::default()
        }
    }
}

/// Login request body — password is excluded from debug/serialize output.
#[derive(Deserialize)]
pub struct LoginRequest {
    pub db: String,
    pub login: String,
    #[serde(skip_serializing)]
    pub(crate) password: String,
}

impl LoginRequest {
    pub fn new(db: &str, login: &str, password: &str) -> Self {
        Self {
            db: db.into(),
            login: login.into(),
            password: password.into(),
        }
    }

    pub fn password(&self) -> &str {
        &self.password
    }
}

// Manual Debug impl that hides the password
impl std::fmt::Debug for LoginRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LoginRequest")
            .field("db", &self.db)
            .field("login", &self.login)
            .field("password", &"***")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn session_info_anonymous() {
        let info = SessionInfo::anonymous();
        assert!(!info.authenticated);
        assert!(info.uid.is_none());
        assert!(info.name.is_none());
    }

    #[test]
    fn session_info_serialize_camel_case() {
        let info = SessionInfo {
            authenticated: true,
            is_admin: Some(true),
            partner_id: Some(42),
            extra: json!({}),
            ..Default::default()
        };
        let json_str = serde_json::to_string(&info).unwrap();
        let map: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(&json_str).unwrap();
        assert!(map.contains_key("is_admin"));
        assert!(map.contains_key("partner_id"));
        assert_eq!(map["is_admin"], true);
        assert_eq!(map["partner_id"], 42);
    }

    #[test]
    fn session_info_deserialize() {
        let raw = r#"{"authenticated":true,"uid":42,"name":"Admin"}"#;
        let info: SessionInfo = serde_json::from_str(raw).unwrap();
        assert!(info.authenticated);
        assert_eq!(info.uid, Some(42));
        assert_eq!(info.name.as_deref(), Some("Admin"));
    }

    #[test]
    fn session_info_clone() {
        let info = SessionInfo::anonymous();
        let cloned = info.clone();
        assert_eq!(cloned.authenticated, info.authenticated);
    }

    #[test]
    fn login_request_deserialize() {
        let raw = r#"{"db":"odoo","login":"admin","password":"secret"}"#;
        let req: LoginRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(req.db, "odoo");
        assert_eq!(req.login, "admin");
        assert_eq!(req.password(), "secret");
    }

    #[test]
    fn login_request_debug_hides_password() {
        let req = LoginRequest {
            db: "db".into(),
            login: "user".into(),
            password: "secret".into(),
        };
        let debug_str = format!("{:?}", req);
        assert!(debug_str.contains("***"));
        assert!(!debug_str.contains("secret"));
    }

    #[test]
    fn login_request_missing_field() {
        let raw = r#"{"db":"odoo","login":"admin"}"#;
        let result = serde_json::from_str::<LoginRequest>(raw);
        assert!(result.is_err());
    }
}
