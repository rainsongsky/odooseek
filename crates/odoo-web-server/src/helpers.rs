//! Shared helper functions for request/response processing.

use axum::http::HeaderMap;
use axum::response::Response;
use odoo_core::types::SessionInfo;

/// Build SessionInfo from Odoo's JSON-RPC result object.
pub fn session_info_from_json(result: &serde_json::Value) -> SessionInfo {
    SessionInfo {
        authenticated: result.get("uid").and_then(|v| v.as_i64()).is_some(),
        uid: result.get("uid").and_then(|v| v.as_i64()),
        name: result
            .get("name")
            .and_then(|v| v.as_str())
            .map(String::from),
        username: result
            .get("username")
            .and_then(|v| v.as_str())
            .map(String::from),
        db: result
            .get("db")
            .and_then(|v| v.as_str())
            .map(String::from),
        is_admin: result.get("is_admin").and_then(|v| v.as_bool()),
        is_system: result.get("is_system").and_then(|v| v.as_bool()),
        partner_id: result.get("partner_id").and_then(|v| v.as_i64()),
        partner_display_name: result
            .get("partner_display_name")
            .and_then(|v| v.as_str())
            .map(String::from),
        server_version: result
            .get("server_version")
            .and_then(|v| v.as_str())
            .map(String::from),
        server_version_info: result
            .get("server_version_info")
            .cloned()
            .and_then(|v| v.as_array().cloned()),
        user_context: result.get("user_context").cloned(),
        user_companies: result.get("user_companies").cloned(),
        web_base_url: result
            .get("web.base.url")
            .and_then(|v| v.as_str())
            .map(String::from),
        home_action_id: result.get("home_action_id").cloned(),
        active_ids_limit: result.get("active_ids_limit").and_then(|v| v.as_i64()),
        max_file_upload_size: result
            .get("max_file_upload_size")
            .and_then(|v| v.as_i64()),
        groups: result.get("groups").cloned(),
        extra: serde_json::Value::default(),
    }
}

/// Forward Set-Cookie headers from an Odoo response into an axum response builder.
pub fn forward_set_cookie_headers(
    mut builder: axum::http::response::Builder,
    headers: &HeaderMap,
) -> axum::http::response::Builder {
    for (key, value) in headers.iter() {
        if key.as_str().eq_ignore_ascii_case("set-cookie")
            && let Ok(v) = value.to_str()
        {
            builder = builder.header("Set-Cookie", v);
        }
    }
    builder
}

/// Serialize a value to JSON bytes for use as a response body.
pub fn to_json_bytes<T: serde::Serialize>(data: &T) -> Vec<u8> {
    serde_json::to_vec(data).unwrap_or_default()
}

/// Build a JSON response with Set-Cookie forwarding.
pub fn json_response_with_cookies<T: serde::Serialize>(
    data: &T,
    resp_headers: &HeaderMap,
) -> Response {
    let builder = forward_set_cookie_headers(Response::builder().status(200), resp_headers);
    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(to_json_bytes(data)))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal error"))
                .unwrap()
        })
}
