//! JSON-RPC proxy — transparently forwards requests from browser to Odoo.

use crate::AppState;
use crate::error::AppError;
use axum::http::HeaderMap;
use axum::response::Response;
use odoo_core::error::OdooError;

/// POST /api/odoo/{*path}
///
/// Transparently forwards the JSON-RPC request to Odoo, passing
/// Cookie/Set-Cookie headers through via reqwest's cookie_store.
pub async fn proxy_odoo(
    state: AppState,
    path: &str,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}/{}", state.odoo_url.trim_end_matches('/'), path);
    tracing::debug!("Proxying JSON-RPC to: {odoo_url}");

    let mut request = state
        .http_client
        .post(&odoo_url)
        .header("Content-Type", "application/json")
        .body(body);

    // Forward browser Cookie to Odoo (reqwest cookie_store handles Set-Cookie return)
    if let Some(cookie) = headers.get("cookie")
        && let Ok(cookie_str) = cookie.to_str()
    {
        request = request.header("cookie", cookie_str);
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

    // Build axum response, forwarding Set-Cookie and other headers
    let mut builder = Response::builder().status(status);

    // Forward relevant response headers from Odoo
    for (key, value) in odoo_headers.iter() {
        let name = key.as_str();
        if (name.eq_ignore_ascii_case("set-cookie") || name.eq_ignore_ascii_case("content-type"))
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
