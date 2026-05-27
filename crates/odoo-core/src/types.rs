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

    pub fn odoo_call(path: &str, kwargs: serde_json::Value) -> Self {
        Self::new(
            "call",
            serde_json::json!({
                "path": path,
                "kwargs": kwargs,
            }),
        )
    }

    pub fn odoo_authenticate(db: &str, login: &str, password: &str) -> Self {
        Self::odoo_call(
            "/web/session/authenticate",
            serde_json::json!({
                "db": db,
                "login": login,
                "password": password,
            }),
        )
    }

    pub fn odoo_get_session() -> Self {
        Self::odoo_call("/web/session/get_session", serde_json::json!({}))
    }

    pub fn odoo_destroy_session() -> Self {
        Self::odoo_call("/web/session/destroy", serde_json::json!({}))
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

/// Session info returned to oweb frontend
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub authenticated: bool,
    pub uid: Option<i64>,
    pub username: Option<String>,
    pub db: Option<String>,
    pub session_id: Option<String>,
}

impl SessionInfo {
    pub fn anonymous() -> Self {
        Self {
            authenticated: false,
            uid: None,
            username: None,
            db: None,
            session_id: None,
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
