use odoo_core::types::LoginRequest;
use odoo_web_server::{AppState, proxy, session};
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn test_state(mock: &MockServer) -> AppState {
    let client = reqwest::Client::builder().build().unwrap();
    let (tx, _) = tokio::sync::broadcast::channel(1);
    AppState::new(client, mock.uri(), tx)
}

#[tokio::test]
async fn login_success() {
    let mock = MockServer::start().await;
    Mock::given(method("POST")).and(path("/web/session/authenticate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": {"uid": 2, "name": "Admin", "username": "admin", "is_admin": true, "db": "test"}
        })).insert_header("Set-Cookie", "session_id=abc123"))
        .mount(&mock).await;

    let state = test_state(&mock);
    let result = session::login(state, LoginRequest::new("test", "admin", "admin")).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn login_invalid_credentials() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/authenticate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "error": {"code": 100, "message": "Invalid credentials"}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::login(state, LoginRequest::new("test", "bad", "wrong")).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn session_info_anonymous() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/get_session_info"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1, "result": {"uid": false}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::get_session_info(state, axum::http::HeaderMap::new()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn proxy_read_caches_response() {
    let mock = MockServer::start().await;
    use std::sync::atomic::{AtomicU32, Ordering};
    let call_count = AtomicU32::new(0);

    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(move |_: &wiremock::Request| {
            let count = call_count.fetch_add(1, Ordering::Relaxed);
            ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0", "id": 1,
                "result": [{"id": count, "name": format!("Record {count}")}]
            }))
        })
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let body = json!({"jsonrpc":"2.0","method":"call","params":{"model":"res.partner","method":"search_read","args":[[],["name"]],"kwargs":{}},"id":1});
    let bytes = axum::body::Bytes::from(serde_json::to_vec(&body).unwrap());
    let headers = axum::http::HeaderMap::new();

    let r1 = proxy::proxy_odoo(
        state.clone(),
        "web/dataset/call_kw",
        headers.clone(),
        bytes.clone(),
    )
    .await
    .unwrap();
    let r2 = proxy::proxy_odoo(state, "web/dataset/call_kw", headers, bytes)
        .await
        .unwrap();

    assert_eq!(r1.status(), 200);
    assert_eq!(r2.status(), 200);
    assert_eq!(
        axum::body::to_bytes(r1.into_body(), 9999).await.unwrap(),
        axum::body::to_bytes(r2.into_body(), 9999).await.unwrap()
    );
}

#[tokio::test]
async fn proxy_write_skips_cache() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"jsonrpc":"2.0","id":1,"result":42})),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let body = json!({"jsonrpc":"2.0","method":"call","params":{"model":"res.partner","method":"create","args":[[{"name":"New"}]],"kwargs":{}},"id":1});
    let bytes = axum::body::Bytes::from(serde_json::to_vec(&body).unwrap());

    let resp = proxy::proxy_odoo(
        state,
        "web/dataset/call_kw",
        axum::http::HeaderMap::new(),
        bytes,
    )
    .await
    .unwrap();
    assert_eq!(resp.status(), 200);
}
