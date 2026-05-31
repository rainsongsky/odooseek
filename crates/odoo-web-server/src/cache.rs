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
    let args_str = serde_json::to_string(args).unwrap_or_default();
    let mut h = DefaultHasher::new();
    args_str.hash(&mut h);
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
