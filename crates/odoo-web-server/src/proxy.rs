//! JSON-RPC and HTTP proxy — transparently forwards requests from browser to Odoo.

use crate::AppState;
use crate::cache;
use crate::error::AppError;
use axum::Json;
use axum::http::HeaderMap;
use axum::http::Method;
use axum::response::{IntoResponse, Response};
use odoo_core::error::OdooError;

/// POST /api/odoo/{*path}
///
/// Transparently forwards the JSON-RPC request to Odoo, passing
/// Cookie headers through manually (no shared cookie store).
/// Responses for cacheable methods (fields_get, get_views, name_search) are cached.
pub async fn proxy_odoo(
    state: AppState,
    path: &str,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Response, AppError> {
    let odoo_url = build_odoo_url(&state.odoo_url, path)?;

    // Try cache for read-only cacheable methods
    if let Ok(cache_key) = try_build_cache_key(&body) {
        if let Some(cached) = state.cache.get(&cache_key).await {
            tracing::debug!("Cache hit → returning cached response");
            return Ok(Json(cached).into_response());
        }
        tracing::debug!("Proxying (cacheable) JSON-RPC to: {odoo_url}");

        let mut request = state
            .http_client
            .post(&odoo_url)
            .header("Content-Type", "application/json")
            .body(body);

        if let Some(c) = get_cookie_header(&headers) {
            request = request.header("cookie", c);
        }

        let response = request.send().await.map_err(|e| {
            tracing::warn!("Odoo unreachable at {odoo_url}: {e}");
            OdooError::Unreachable(format!("Odoo not reachable: {e}"))
        })?;

        let status = response.status();
        let odoo_headers = response.headers().clone();
        let body_bytes = response
            .bytes()
            .await
            .map_err(|e| OdooError::Http(e.without_url()))?;

        // Cache successful responses
        if status.is_success()
            && let Ok(value) = serde_json::from_slice::<serde_json::Value>(&body_bytes)
        {
            state.cache.set(&cache_key, value, &cache_key).await;
        }

        let mut builder = Response::builder().status(status);
        for (key, value) in odoo_headers.iter() {
            let name = key.as_str();
            if matches_proxy_header(name)
                && let Ok(v) = value.to_str()
            {
                builder = builder.header(name, v);
            }
        }
        return builder
            .body(axum::body::Body::from(body_bytes))
            .map_err(|e| {
                AppError(OdooError::InvalidResponse(format!(
                    "Failed to build response: {e}"
                )))
            });
    }

    // Not cacheable — proxy normally
    tracing::debug!("Proxying JSON-RPC POST to: {odoo_url}");

    let mut request = state
        .http_client
        .post(&odoo_url)
        .header("Content-Type", "application/json")
        .body(body);

    if let Some(c) = get_cookie_header(&headers) {
        request = request.header("cookie", c);
    }

    proxy_send(&state, request).await
}

/// ANY /api/odoo-http/{*path}
pub async fn proxy_odoo_http(
    state: AppState,
    method: Method,
    path: &str,
    headers: HeaderMap,
    query: Option<String>,
    body: axum::body::Bytes,
) -> Result<Response, AppError> {
    let mut url = build_odoo_url(&state.odoo_url, path)?;
    if let Some(ref q) = query
        && !q.is_empty()
    {
        url.push('?');
        url.push_str(q);
    }
    tracing::debug!("Proxying HTTP {method} to: {url}");

    let mut request = match method {
        Method::GET | Method::HEAD => state.http_client.get(&url),
        Method::POST => state.http_client.post(&url),
        Method::PUT => state.http_client.put(&url),
        Method::DELETE => state.http_client.delete(&url),
        Method::PATCH => state.http_client.patch(&url),
        _ => state.http_client.get(&url),
    };

    if !body.is_empty() {
        if let Some(ct) = headers.get("content-type").and_then(|v| v.to_str().ok()) {
            request = request.header("Content-Type", ct);
        }
        request = request.body(body);
    }

    if let Some(c) = get_cookie_header(&headers) {
        request = request.header("cookie", c);
    }

    proxy_send(&state, request).await
}

/// GET /api/web/image/{*path}
pub async fn proxy_image(
    state: AppState,
    path: axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let image_path = path.0;
    let odoo_url = build_odoo_url(&state.odoo_url, &format!("web/image/{}", image_path))?;
    tracing::debug!("Proxying image request to: {odoo_url}");

    let mut request = state.http_client.get(&odoo_url);
    if let Some(c) = get_cookie_header(&headers) {
        request = request.header("cookie", c);
    }
    proxy_send(&state, request).await
}

// ── Helpers ─────────────────────────────────────────────────

fn build_odoo_url(odoo_base: &str, path: &str) -> Result<String, AppError> {
    if path.contains("..") || path.contains('\0') {
        return Err(AppError(OdooError::Api {
            code: 400,
            message: "Invalid path".into(),
            data: None,
        }));
    }
    Ok(format!("{}/{}", odoo_base, path))
}

fn get_cookie_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .map(String::from)
}

async fn proxy_send(
    _state: &AppState,
    request: reqwest::RequestBuilder,
) -> Result<Response, AppError> {
    let request = request.build().map_err(|e| {
        AppError(OdooError::InvalidResponse(format!(
            "Failed to build request: {e}"
        )))
    })?;
    let url = request.url().to_string();

    let response = _state.http_client.execute(request).await.map_err(|e| {
        tracing::warn!("Odoo unreachable at {url}: {e}");
        OdooError::Unreachable(format!("Odoo not reachable: {e}"))
    })?;

    let status = response.status();
    let odoo_headers = response.headers().clone();
    let body_bytes = response
        .bytes()
        .await
        .map_err(|e| OdooError::Http(e.without_url()))?;

    let mut builder = Response::builder().status(status);

    // Forward standard response headers (exclude Content-Encoding to prevent double-compression)
    for (key, value) in odoo_headers.iter() {
        let name = key.as_str();
        if name.eq_ignore_ascii_case("content-encoding") {
            continue; // BFF applies its own compression
        }
        if matches_proxy_header(name)
            && let Ok(v) = value.to_str()
        {
            builder = builder.header(name, v);
        }
    }

    builder
        .body(axum::body::Body::from(body_bytes))
        .map_err(|e| {
            AppError(OdooError::InvalidResponse(format!(
                "Failed to build response: {e}"
            )))
        })
}

fn matches_proxy_header(name: &str) -> bool {
    let lower = name.to_lowercase();
    matches!(
        lower.as_str(),
        "set-cookie"
            | "content-type"
            | "content-length"
            | "content-disposition"
            | "cache-control"
            | "etag"
            | "last-modified"
            | "x-content-type-options"
            | "x-frame-options"
            | "content-security-policy"
            | "strict-transport-security"
            | "location"
    )
}

fn try_build_cache_key(body: &axum::body::Bytes) -> Result<String, ()> {
    let json: serde_json::Value = serde_json::from_slice(body).map_err(|_| ())?;
    let params = json.get("params").ok_or(())?;
    let model = params.get("model").and_then(|v| v.as_str()).ok_or(())?;
    let method = params.get("method").and_then(|v| v.as_str()).ok_or(())?;

    // Never cache write operations
    if WRITE_METHODS.contains(&method) {
        return Err(());
    }
    let args = params.get("args").ok_or(())?;
    Ok(cache::cache_key(model, method, args))
}

/// Methods that must never be cached (mutations)
const WRITE_METHODS: &[&str] = &[
    "create",
    "write",
    "unlink",
    "copy",
    "button_immediate_install",
    "button_immediate_upgrade",
    "toggle_active",
    "action_archive",
    "action_unarchive",
    "message_post",
    "message_subscribe",
    "message_unsubscribe",
];
