pub mod config;
pub mod error;
pub mod types;

/// Construct a JSON-RPC 2.0 call_kw request body.
///
/// Returns the standard envelope:
/// ```json
/// {"jsonrpc":"2.0","method":"call","params":{"model":...},"id":N}
/// ```
pub fn call_kw_request(
    model: &str,
    method: &str,
    args: &serde_json::Value,
    kwargs: Option<&serde_json::Value>,
) -> serde_json::Value {
    static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    let mut params = serde_json::Map::new();
    params.insert("model".into(), model.into());
    params.insert("method".into(), method.into());
    params.insert("args".into(), args.clone());
    if let Some(kw) = kwargs {
        params.insert("kwargs".into(), kw.clone());
    }

    serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": serde_json::Value::Object(params),
        "id": id,
    })
}

/// Construct a JSON-RPC request with empty params (for non-call_kw endpoints).
pub fn jsonrpc_empty_request() -> serde_json::Value {
    static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed),
    })
}
