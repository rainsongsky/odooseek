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
        db: result.get("db").and_then(|v| v.as_str()).map(String::from),
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
        max_file_upload_size: result.get("max_file_upload_size").and_then(|v| v.as_i64()),
        groups: result.get("groups").cloned(),
        menus: None,
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
    serde_json::to_vec(data).unwrap_or_else(|e| {
        tracing::error!("Failed to serialize response: {e}");
        vec![]
    })
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

/// Build a JSON response with Set-Cookie forwarding (raw bytes version).
pub fn json_response_with_cookies_bytes(data: &[u8], resp_headers: &HeaderMap) -> Response {
    let builder = forward_set_cookie_headers(Response::builder().status(200), resp_headers);
    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(data.to_vec()))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal error"))
                .unwrap()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use serde_json::json;

    // ── session_info_from_json ────────────────────────────────

    #[test]
    fn session_info_from_full_result() {
        let result = json!({
            "uid": 2,
            "name": "Admin",
            "username": "admin",
            "db": "test",
            "is_admin": true,
            "is_system": true,
            "partner_id": 3,
            "partner_display_name": "Admin User",
            "server_version": "19.0",
            "server_version_info": ["19", "0", "0", "final", 0, ""],
            "user_context": {"lang": "en_US", "tz": "UTC"},
            "user_companies": {"allowed_companies": [1, 2]},
            "web.base.url": "http://localhost:8069",
            "home_action_id": 1,
            "active_ids_limit": 20000,
            "max_file_upload_size": 25,
            "groups": {"base.group_user": true}
        });

        let info = session_info_from_json(&result);

        assert!(info.authenticated);
        assert_eq!(info.uid, Some(2));
        assert_eq!(info.name, Some("Admin".into()));
        assert_eq!(info.username, Some("admin".into()));
        assert_eq!(info.db, Some("test".into()));
        assert_eq!(info.is_admin, Some(true));
        assert_eq!(info.is_system, Some(true));
        assert_eq!(info.partner_id, Some(3));
        assert_eq!(info.partner_display_name, Some("Admin User".into()));
        assert_eq!(info.server_version, Some("19.0".into()));
        assert!(info.server_version_info.is_some());
        assert!(info.user_context.is_some());
        assert!(info.user_companies.is_some());
        assert_eq!(info.web_base_url, Some("http://localhost:8069".into()));
        assert_eq!(info.active_ids_limit, Some(20000));
        assert_eq!(info.max_file_upload_size, Some(25));
        assert!(info.groups.is_some());
        assert!(info.menus.is_none()); // always None from session_info_from_json
    }

    #[test]
    fn session_info_from_empty_result() {
        let result = json!({});

        let info = session_info_from_json(&result);

        assert!(!info.authenticated);
        assert_eq!(info.uid, None);
        assert_eq!(info.name, None);
        assert_eq!(info.username, None);
        assert_eq!(info.is_admin, None);
    }

    #[test]
    fn session_info_with_uid_but_no_name() {
        let result = json!({
            "uid": 42,
            "is_admin": false
        });

        let info = session_info_from_json(&result);

        assert!(info.authenticated); // uid present
        assert_eq!(info.uid, Some(42));
        assert_eq!(info.is_admin, Some(false));
        assert_eq!(info.name, None);
    }

    #[test]
    fn session_info_uid_null_not_authenticated() {
        let result = json!({
            "uid": null,
            "name": "Anonymous"
        });

        let info = session_info_from_json(&result);

        assert!(!info.authenticated); // uid was null → as_i64() returns None
    }

    // ── forward_set_cookie_headers ────────────────────────────

    #[test]
    fn forward_set_cookie_forwards_cookie_headers() {
        let mut headers = HeaderMap::new();
        headers.insert("set-cookie", "session_id=abc".parse().unwrap());
        headers.insert("content-type", "application/json".parse().unwrap());

        let builder = Response::builder().status(200);
        let builder = forward_set_cookie_headers(builder, &headers);

        let resp = builder.body(axum::body::Body::empty()).unwrap();
        let cookie_val = resp.headers().get("set-cookie").unwrap().to_str().unwrap();
        assert_eq!(cookie_val, "session_id=abc");
    }

    #[test]
    fn forward_set_cookie_case_insensitive() {
        let mut headers = HeaderMap::new();
        headers.insert("SET-COOKIE", "session_id=xyz".parse().unwrap());

        let builder = Response::builder().status(200);
        let builder = forward_set_cookie_headers(builder, &headers);

        let resp = builder.body(axum::body::Body::empty()).unwrap();
        assert!(resp.headers().get("set-cookie").is_some());
    }

    #[test]
    fn forward_set_cookie_no_cookies_returns_unchanged() {
        let mut headers = HeaderMap::new();
        headers.insert("content-type", "text/html".parse().unwrap());

        let builder = Response::builder().status(200);
        let builder = forward_set_cookie_headers(builder, &headers);

        let resp = builder.body(axum::body::Body::empty()).unwrap();
        assert!(resp.headers().get("set-cookie").is_none());
    }

    #[test]
    fn forward_set_cookie_empty_headers() {
        let headers = HeaderMap::new();
        let builder = Response::builder().status(200);
        let builder = forward_set_cookie_headers(builder, &headers);

        let resp = builder.body(axum::body::Body::empty()).unwrap();
        assert!(resp.headers().get("set-cookie").is_none());
    }

    // ── to_json_bytes ─────────────────────────────────────────

    #[test]
    fn to_json_bytes_serializes_valid_data() {
        let data = json!({"key": "value"});
        let bytes = to_json_bytes(&data);
        assert!(!bytes.is_empty());
        let parsed: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(parsed["key"], "value");
    }

    #[test]
    fn to_json_bytes_empty_object() {
        let data = json!({});
        let bytes = to_json_bytes(&data);
        assert_eq!(bytes, b"{}");
    }

    // ── json_response_with_cookies ────────────────────────────

    #[test]
    fn json_response_with_cookies_returns_json_content_type() {
        let headers = HeaderMap::new();
        let data = json!({"status": "ok"});

        let resp = json_response_with_cookies(&data, &headers).into_response();

        assert_eq!(resp.status(), 200);
        let ct = resp.headers().get("content-type").unwrap().to_str().unwrap();
        assert!(ct.contains("application/json"));
    }

    #[test]
    fn json_response_with_cookies_includes_set_cookie() {
        let mut headers = HeaderMap::new();
        headers.insert("set-cookie", "session_id=test".parse().unwrap());
        let data = json!({"status": "ok"});

        let resp = json_response_with_cookies(&data, &headers).into_response();

        let cookie = resp.headers().get("set-cookie").unwrap().to_str().unwrap();
        assert_eq!(cookie, "session_id=test");
    }

    // ── json_response_with_cookies_bytes ──────────────────────

    #[test]
    fn json_response_with_cookies_bytes_serializes() {
        let mut headers = HeaderMap::new();
        headers.insert("set-cookie", "token=secret".parse().unwrap());
        let data = br#"{"result":"raw"}"#;

        let resp = json_response_with_cookies_bytes(data, &headers).into_response();

        assert_eq!(resp.status(), 200);
        let cookie = resp.headers().get("set-cookie").unwrap().to_str().unwrap();
        assert_eq!(cookie, "token=secret");
    }
}
