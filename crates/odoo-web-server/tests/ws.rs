mod common;

use common::*;
use odoo_web_server::ws;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn verify_session_valid_cookie() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/check"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": { "uid": 1, "is_admin": false }
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = ws::verify_session(&state, "session_id=abc123").await;
    assert!(result.is_ok());
    assert!(result.unwrap());
}

#[tokio::test]
async fn verify_session_invalid_cookie() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/check"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = ws::verify_session(&state, "session_id=invalid").await;
    assert!(result.is_ok());
    assert!(!result.unwrap());
}

#[tokio::test]
async fn verify_session_missing_mock_returns_non_success() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);
    let result = ws::verify_session(&state, "session_id=abc").await;
    assert!(result.is_ok());
    assert!(!result.unwrap());
}
