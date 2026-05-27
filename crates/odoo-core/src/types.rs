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
