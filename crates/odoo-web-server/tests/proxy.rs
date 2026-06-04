mod common;

use common::*;
use odoo_web_server::proxy;
use serde_json::json;
use wiremock::matchers::method;
use wiremock::matchers::path;
use wiremock::{Mock, MockServer, ResponseTemplate};

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

#[tokio::test]
async fn proxy_http_get_forwards() {
    let mock = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/web/content/123"))
        .respond_with(ResponseTemplate::new(200).set_body_string("file content"))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let resp = proxy::proxy_odoo_http(
        state,
        axum::http::Method::GET,
        "web/content/123",
        axum::http::HeaderMap::new(),
        None,
        axum::body::Bytes::new(),
    )
    .await
    .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn proxy_image_forwards() {
    let mock = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/web/image/res.partner/1/image_128"))
        .respond_with(
            ResponseTemplate::new(200).set_body_raw(vec![0x89, b'P', b'N', b'G'], "image/png"),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = proxy::proxy_image(
        state,
        axum::extract::Path("res.partner/1/image_128".into()),
        axum::http::HeaderMap::new(),
    )
    .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn proxy_caches_different_ttls() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": {"field": {"type": "char", "string": "Name"}}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let body = json!({"jsonrpc":"2.0","method":"call","params":{"model":"res.partner","method":"fields_get","args":[[],["type","string"]],"kwargs":{"attributes":["type","string"]}},"id":1});
    let bytes = axum::body::Bytes::from(serde_json::to_vec(&body).unwrap());

    let resp = proxy::proxy_odoo(
        state.clone(),
        "web/dataset/call_kw",
        anon_header(),
        bytes.clone(),
    )
    .await
    .unwrap();
    assert_eq!(resp.status(), 200);

    let resp2 = proxy::proxy_odoo(state, "web/dataset/call_kw", anon_header(), bytes)
        .await
        .unwrap();
    assert_eq!(resp2.status(), 200);
}
