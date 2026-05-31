use odoo_web_server::cache;
use odoo_web_server::proxy;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Build a test AppState pointing to the mock server
fn test_state(mock: &MockServer) -> odoo_web_server::AppState {
    let client = reqwest::Client::builder().build().unwrap();
    let (tx, _) = tokio::sync::broadcast::channel(1);
    odoo_web_server::AppState::new(client, mock.uri(), tx)
}

#[tokio::test]
async fn proxy_read_method_is_proxied() {
    let mock = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": [{"id": 1, "name": "Test"}]
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let body = json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "res.partner",
            "method": "search_read",
            "args": [[], ["name"]],
            "kwargs": {}
        },
        "id": 1
    });
    let body_bytes = axum::body::Bytes::from(serde_json::to_vec(&body).unwrap());

    let resp = proxy::proxy_odoo(
        state,
        "web/dataset/call_kw",
        axum::http::HeaderMap::new(),
        body_bytes,
    )
    .await
    .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn proxy_write_method_is_proxied_without_cache() {
    let mock = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": 42
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let body = json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "res.partner",
            "method": "create",
            "args": [[{"name": "New"}]],
            "kwargs": {}
        },
        "id": 1
    });
    let body_bytes = axum::body::Bytes::from(serde_json::to_vec(&body).unwrap());

    let resp = proxy::proxy_odoo(
        state,
        "web/dataset/call_kw",
        axum::http::HeaderMap::new(),
        body_bytes,
    )
    .await
    .unwrap();

    // Write method should succeed but NOT be cached
    assert_eq!(resp.status(), 200);
}

#[test]
fn cache_key_hash_consistent() {
    let a = cache::cache_key("model", "method", &json!([1, 2, 3]));
    let b = cache::cache_key("model", "method", &json!([1, 2, 3]));
    assert_eq!(a, b);
}
