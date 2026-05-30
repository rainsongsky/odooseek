//! Report download proxy — forwards report generation requests from browser to Odoo.
//!
//! The browser calls `GET /api/report/download?report_id=...&ids=...&report_type=...`
//! which reads the report action to find the report's XML ID / name, then proxies
//! the request to Odoo's `/report/pdf/{report_name}/{ids}` endpoint.

use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde::Deserialize;

use crate::AppState;
use crate::error::AppError;
use odoo_core::error::OdooError;

#[derive(Debug, Deserialize)]
pub struct ReportParams {
    pub report_id: i64,
    pub ids: String,
    pub report_type: Option<String>,
}

/// GET /api/report/download?report_id=...&ids=1,2,3&report_type=pdf
///
/// Proxies the report download request to Odoo's report engine.
/// 1. Reads the `ir.actions.report` record via JSON-RPC to get `report_name`.
/// 2. Forwards the browser's session cookie.
/// 3. Streams the PDF/XLSX binary back to the browser.
pub async fn download_report(
    state: State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ReportParams>,
) -> Result<Response, AppError> {
    let report_type = params.report_type.as_deref().unwrap_or("pdf");

    // Step 1: read the report action to obtain report_name
    let rpc_body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "ir.actions.report",
            "method": "read",
            "args": [[params.report_id], ["report_name", "report_type"]],
            "kwargs": {}
        },
        "id": 1,
    });

    let odoo_rpc_url = format!(
        "{}/web/dataset/call_kw",
        state.odoo_url.trim_end_matches('/')
    );

    let mut rpc_req = state.http_client.post(&odoo_rpc_url).json(&rpc_body);

    // Forward browser Cookie to Odoo
    if let Some(cookie) = headers.get("cookie") {
        if let Ok(cookie_str) = cookie.to_str() {
            rpc_req = rpc_req.header("cookie", cookie_str);
        }
    }

    let rpc_resp = rpc_req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo report read failed: {e}")))?;

    let rpc_json: serde_json::Value = rpc_resp.json().await?;

    // Extract report_name from the JSON-RPC result
    let report_name = rpc_json
        .get("result")
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.first())
        .and_then(|rec| rec.get("report_name"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            OdooError::InvalidResponse(format!(
                "Report action {} not found or has no report_name",
                params.report_id
            ))
        })?;

    // Step 2: build the Odoo report URL and proxy the request
    let report_url = format!(
        "{}/report/{}/{}",
        state.odoo_url.trim_end_matches('/'),
        report_type,
        report_name,
    );

    // Odoo expects the record IDs as path segments after the report name
    let report_url = format!("{}/{}", report_url, params.ids);

    tracing::info!("Proxying report download: {report_url}");

    let mut dl_req = state.http_client.get(&report_url);

    // Forward browser Cookie to Odoo for session
    if let Some(cookie) = headers.get("cookie") {
        if let Ok(cookie_str) = cookie.to_str() {
            dl_req = dl_req.header("cookie", cookie_str);
        }
    }

    let response = dl_req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo report download failed: {e}")))?;

    let status = response.status();
    let odoo_headers = response.headers().clone();
    let body_bytes = response
        .bytes()
        .await
        .map_err(|e| OdooError::Http(e.without_url()))?;

    // Build axum response, forwarding content-type and content-disposition
    let mut builder = Response::builder().status(status);

    for (key, value) in odoo_headers.iter() {
        let name = key.as_str();
        if matches!(
            name,
            "content-type" | "content-disposition" | "content-length"
        ) {
            if let Ok(v) = value.to_str() {
                builder = builder.header(name, v);
            }
        }
    }

    builder
        .body(axum::body::Body::from(body_bytes))
        .map_err(|e| AppError(OdooError::InvalidResponse(format!("Failed to build response: {e}"))))
}
