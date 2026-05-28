//! Shared types for Odoo JSON-RPC communication.

use serde::{Deserialize, Serialize};

/// JSON-RPC 2.0 request
#[derive(Debug, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: &'static str,
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

impl JsonRpcRequest {
    pub fn new(method: impl Into<String>, params: serde_json::Value) -> Self {
        static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
        Self {
            jsonrpc: "2.0",
            id: NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed),
            method: method.into(),
            params,
        }
    }
}

/// JSON-RPC 2.0 response
#[derive(Debug, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<serde_json::Value>,
    #[serde(default)]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 2.0 error detail
#[derive(Debug, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// Session info returned to oweb frontend (camelCase JSON).
/// Built manually in session.rs from Odoo 19 CE's snake_case response.
#[derive(Debug, Serialize, Deserialize, Default)]
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
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

impl SessionInfo {
    pub fn anonymous() -> Self {
        Self {
            authenticated: false,
            ..Default::default()
        }
    }
}

/// Login request body
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub db: String,
    pub login: String,
    pub password: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn jsonrpc_request_new_has_correct_fields() {
        let req = JsonRpcRequest::new("call", json!({"key": "value"}));
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.method, "call");
        assert_eq!(req.params, json!({"key": "value"}));
    }

    #[test]
    fn jsonrpc_request_ids_increment() {
        let req1 = JsonRpcRequest::new("call", json!({}));
        let req2 = JsonRpcRequest::new("call", json!({}));
        assert!(req2.id > req1.id);
    }

    #[test]
    fn jsonrpc_response_deserialize_result() {
        let raw = r#"{"jsonrpc":"2.0","id":1,"result":{"uid":1}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(resp.id, Some(1));
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn jsonrpc_response_deserialize_error() {
        let raw = r#"{"jsonrpc":"2.0","id":1,"error":{"code":100,"message":"err"}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(raw).unwrap();
        assert!(resp.result.is_none());
        let err = resp.error.unwrap();
        assert_eq!(err.code, 100);
        assert_eq!(err.message, "err");
    }

    #[test]
    fn jsonrpc_error_deserialize() {
        let raw = r#"{"code":200,"message":"Odoo Error","data":{"debug":"traceback"}}"#;
        let err: JsonRpcError = serde_json::from_str(raw).unwrap();
        assert_eq!(err.code, 200);
        assert_eq!(err.message, "Odoo Error");
        assert!(err.data.is_some());
        assert_eq!(err.data.unwrap()["debug"], "traceback");
    }

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
            extra: serde_json::json!({}),
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
    fn login_request_deserialize() {
        let raw = r#"{"db":"odoo","login":"admin","password":"secret"}"#;
        let req: LoginRequest = serde_json::from_str(raw).unwrap();
        assert_eq!(req.db, "odoo");
        assert_eq!(req.login, "admin");
        assert_eq!(req.password, "secret");
    }

    #[test]
    fn login_request_missing_field() {
        let raw = r#"{"db":"odoo","login":"admin"}"#;
        let result = serde_json::from_str::<LoginRequest>(raw);
        assert!(result.is_err());
    }
}
