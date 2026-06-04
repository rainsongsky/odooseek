mod common;

use axum::response::IntoResponse;
use common::*;
use odoo_web_server::health::health_check;
use serde_json::json;
use std::collections::HashMap;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn health_basic_returns_ok() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);

    let result = health_check(state, HashMap::new()).await.into_response();

    assert_eq!(result.status(), 200);

    let body_bytes = axum::body::to_bytes(result.into_body(), 1024)
        .await
        .unwrap();
    let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn health_deep_odoo_reachable() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/get_session_info"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1, "result": {}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);

    let mut params = HashMap::new();
    params.insert("deep".into(), "true".into());

    let result = health_check(state, params).await.into_response();

    assert_eq!(result.status(), 200);

    let body_bytes = axum::body::to_bytes(result.into_body(), 1024)
        .await
        .unwrap();
    let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(body["status"], "ok");
    assert_eq!(body["odoo"], "reachable");
}

#[tokio::test]
async fn health_deep_odoo_unreachable() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);

    let mut params = HashMap::new();
    params.insert("deep".into(), "true".into());

    let result = health_check(state, params).await.into_response();

    assert_eq!(result.status(), 200);

    let body_bytes = axum::body::to_bytes(result.into_body(), 1024)
        .await
        .unwrap();
    let body: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(body["status"], "degraded");
}
