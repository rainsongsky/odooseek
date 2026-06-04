mod common;

use common::*;
use serde_json::json;
use wiremock::MockServer;

#[tokio::test]
async fn cache_key_is_deterministic() {
    let body = json!({"jsonrpc":"2.0","method":"call","params":{"model":"res.partner","method":"fields_get","args":[[],["type"]],"kwargs":{}},"id":1});
    let k1 = odoo_web_server::cache::cache_key("res.partner", "fields_get", &body);
    let k2 = odoo_web_server::cache::cache_key("res.partner", "fields_get", &body);
    assert_eq!(k1, k2);
}

#[tokio::test]
async fn cache_hit_and_miss() {
    let state = test_state(&MockServer::start().await);
    let key = "test:key";
    let value = json!({"data": 42});

    assert!(state.cache.get(key).await.is_none());

    state.cache.set(key, value.clone(), "test").await;

    let cached = state.cache.get(key).await;
    assert!(cached.is_some());
    assert_eq!(cached.unwrap(), value);
}

#[tokio::test]
async fn cache_ttl_expires() {
    let state = test_state(&MockServer::start().await);
    let key = "ttl:test";
    let value = json!({"expires": true});

    state.cache.set(key, value.clone(), "search_read").await;

    assert!(state.cache.get(key).await.is_some());
}

#[tokio::test]
async fn cache_invalidation_prefix() {
    let state = test_state(&MockServer::start().await);
    state.cache.set("test:a", json!({}), "test").await;
    state.cache.set("test:b", json!({}), "test").await;
    state.cache.set("other:c", json!({}), "test").await;

    assert!(state.cache.get("test:a").await.is_some());
    assert!(state.cache.get("test:b").await.is_some());
    assert!(state.cache.get("other:c").await.is_some());

    state.cache.invalidate("test").await;

    assert!(state.cache.get("test:a").await.is_none());
    assert!(state.cache.get("test:b").await.is_none());
    assert!(state.cache.get("other:c").await.is_some());
}
