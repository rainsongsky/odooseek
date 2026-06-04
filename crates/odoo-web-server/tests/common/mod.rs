#![allow(dead_code)]

use odoo_web_server::AppState;

pub fn test_state(mock: &wiremock::MockServer) -> AppState {
    let client = reqwest::Client::builder().build().unwrap();
    let (tx, _) = tokio::sync::broadcast::channel(1);
    AppState::new(client, mock.uri(), tx)
}

pub fn auth_cookie_header() -> axum::http::HeaderMap {
    let mut map = axum::http::HeaderMap::new();
    map.insert("cookie", "session_id=abc123".parse().unwrap());
    map
}

pub fn anon_header() -> axum::http::HeaderMap {
    axum::http::HeaderMap::new()
}
