//! Simple in-memory response cache for the BFF proxy layer.
//!
//! Caches JSON-RPC responses for commonly-called, slow-changing endpoints
//! to reduce load on the Odoo server and improve frontend responsiveness.
//!
//! Cache TTLs:
//!   - fields_get: 24 hours (schema changes require server restart anyway)
//!   - get_views: 1 hour
//!   - name_search: 5 minutes
//!   - search_panel_select_range: 30 seconds

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
        // Spawn background eviction task
        let inner = cache.inner.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;
                let now = tokio::time::Instant::now();
                inner.write().await.retain(|_, v| v.expires_at > now);
            }
        });
        cache
    }

    /// Try to get a cached response. Returns None if not found or expired.
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

    /// Store a response with automatic TTL based on the endpoint.
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

/// Build a cache key from model, method, and serialized args.
///
/// Format: "{model}:{method}:{args_json}"
/// Args are truncated to 200 chars to keep keys reasonable for large payloads.
pub fn cache_key(model: &str, method: &str, args: &Value) -> String {
    let args_str = serde_json::to_string(args).unwrap_or_default();
    let args_short = if args_str.len() > 200 {
        &args_str[..200]
    } else {
        &args_str
    };
    format!("{model}:{method}:{args_short}")
}

fn ttl_for_endpoint(method: &str) -> Duration {
    match method {
        "fields_get" => Duration::from_secs(86_400), // 24h
        "get_views" => Duration::from_secs(3_600),   // 1h
        "name_search" | "web_name_search" => Duration::from_secs(300), // 5min
        "search_panel_select_range" | "search_panel_select_multi_range" => {
            Duration::from_secs(30) // 30s
        }
        "read" | "search_read" => Duration::from_secs(15), // 15s
        _ => Duration::from_secs(60),                      // 1min default
    }
}
