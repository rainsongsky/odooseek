//! Simple in-memory response cache for the BFF proxy layer.
//!
//! Caches JSON-RPC responses for commonly-called, slow-changing endpoints
//! to reduce load on the Odoo server and improve frontend responsiveness.

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, Instant};

#[derive(Clone)]
pub struct ResponseCache {
    inner: Arc<RwLock<HashMap<String, CacheEntry>>>,
}

struct CacheEntry {
    value: Value,
    expires_at: Instant,
}

impl ResponseCache {
    pub fn new() -> Self {
        let cache = Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        };
        let inner = cache.inner.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;
                let now = Instant::now();
                inner.write().await.retain(|_, v| v.expires_at > now);
            }
        });
        cache
    }

    pub async fn get(&self, key: &str) -> Option<Value> {
        let cache = self.inner.read().await;
        cache.get(key).and_then(|entry| {
            if entry.expires_at > Instant::now() {
                Some(entry.value.clone())
            } else {
                None
            }
        })
    }

    pub async fn set(&self, key: &str, value: Value, endpoint_hint: &str) {
        let ttl = ttl_for_endpoint(endpoint_hint);
        let entry = CacheEntry {
            value,
            expires_at: Instant::now() + ttl,
        };
        self.inner.write().await.insert(key.to_string(), entry);
    }
}

impl Default for ResponseCache {
    fn default() -> Self {
        Self::new()
    }
}

pub fn cache_key(model: &str, method: &str, args: &Value) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    model.hash(&mut h);
    method.hash(&mut h);
    args.hash(&mut h);
    let hash = h.finish();
    format!("{model}:{method}:{hash:x}")
}

fn ttl_for_endpoint(method: &str) -> Duration {
    match method {
        "fields_get" => Duration::from_secs(86_400),
        "get_views" => Duration::from_secs(3_600),
        "default_get" => Duration::from_secs(3_600),
        "name_search" | "web_name_search" => Duration::from_secs(300),
        "read" | "search_read" => Duration::from_secs(15),
        m if m.starts_with("search_panel_select") => Duration::from_secs(30),
        _ => Duration::from_secs(60),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cache_key_deterministic() {
        let args1 = json!([[], ["name"]]);
        let args2 = json!([[], ["name"]]);
        let k1 = cache_key("model", "search_read", &args1);
        let k2 = cache_key("model", "search_read", &args2);
        assert_eq!(k1, k2);
    }

    #[test]
    fn cache_key_different_models() {
        let args = json!([[], ["name"]]);
        let k1 = cache_key("res.partner", "search_read", &args);
        let k2 = cache_key("res.users", "search_read", &args);
        assert_ne!(k1, k2);
    }

    #[test]
    fn cache_key_different_methods() {
        let args = json!([[], ["name"]]);
        let k1 = cache_key("model", "search_read", &args);
        let k2 = cache_key("model", "fields_get", &args);
        assert_ne!(k1, k2);
    }

    #[test]
    fn ttl_fields_get_is_24h() {
        assert_eq!(ttl_for_endpoint("fields_get"), Duration::from_secs(86_400));
    }

    #[test]
    fn ttl_search_panel_prefix_match() {
        assert_eq!(
            ttl_for_endpoint("search_panel_select_range"),
            Duration::from_secs(30)
        );
        assert_eq!(
            ttl_for_endpoint("search_panel_select_multi_range"),
            Duration::from_secs(30)
        );
    }

    #[test]
    fn ttl_unknown_falls_to_60s() {
        assert_eq!(ttl_for_endpoint("unknown"), Duration::from_secs(60));
    }

    #[test]
    fn ttl_default_get_is_1h() {
        assert_eq!(ttl_for_endpoint("default_get"), Duration::from_secs(3_600));
    }
}
