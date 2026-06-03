//! Report download proxy — forwards report generation requests from browser to Odoo.
//!
//! The browser calls `GET /api/report/download?report_id=...&ids=...&report_type=...`
//! which reads the report action to find the report's XML ID / name, then proxies
//! the request to Odoo's `/report/pdf/{report_name}/{ids}` endpoint.

use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use futures::StreamExt;
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
    // Validate report_id is positive
    if params.report_id <= 0 {
        return Err(AppError(OdooError::Api {
            code: 400,
            message: "Invalid report_id".into(),
            data: None,
        }));
    }
    // Validate ids is comma-separated integers only
    for part in params.ids.split(',') {
        if part.trim().parse::<i64>().is_err() {
            return Err(AppError(OdooError::Api {
                code: 400,
                message: "Invalid ids: must be comma-separated integers".into(),
                data: None,
            }));
        }
    }

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

    let odoo_rpc_url = format!("{}/web/dataset/call_kw", state.odoo_url);

    let mut rpc_req = state.http_client.post(&odoo_rpc_url).json(&rpc_body);

    // Forward browser Cookie to Odoo
    #[allow(clippy::collapsible_if)]
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
    let report_url = format!("{}/report/{}/{}", state.odoo_url, report_type, report_name,);

    // Odoo expects the record IDs as path segments after the report name
    let report_url = format!("{}/{}", report_url, params.ids);

    tracing::info!("Proxying report download: {report_url}");

    let mut dl_req = state.http_client.get(&report_url);

    // Forward browser Cookie to Odoo for session
    #[allow(clippy::collapsible_if)]
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

    let stream = response
        .bytes_stream()
        .map(|r| r.map_err(|e| std::io::Error::other(e.to_string())));

    crate::proxy::build_proxy_response(status, &odoo_headers, axum::body::Body::from_stream(stream))
}

/// GET /api/report/barcode/{barcode_type}/{value}
///
/// Proxies barcode generation requests to Odoo's barcode controller.
/// Returns image/png or image/svg+xml depending on the barcode type.
pub async fn proxy_barcode(
    state: State<AppState>,
    path: axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let barcode_path = path.0;
    if barcode_path.contains("..") || barcode_path.contains('\0') {
        return Err(AppError(OdooError::Api {
            code: 400,
            message: "Invalid barcode path".into(),
            data: None,
        }));
    }
    let url = format!("{}/report/barcode/{}", state.odoo_url, barcode_path);
    tracing::debug!("Proxying barcode request to: {url}");

    let mut request = state.http_client.get(&url);
    if let Some(c) = headers.get("cookie").and_then(|v| v.to_str().ok()) {
        request = request.header("cookie", c);
    }

    let response = request
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo barcode unreachable at {url}: {e}")))?;

    let status = response.status();
    let odoo_headers = response.headers().clone();

    let stream = response
        .bytes_stream()
        .map(|r| r.map_err(|e| std::io::Error::other(e.to_string())));

    crate::proxy::build_proxy_response(status, &odoo_headers, axum::body::Body::from_stream(stream))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_params_deserialize_from_query() {
        let params = ReportParams {
            report_id: 1,
            ids: "1,2,3".into(),
            report_type: Some("pdf".into()),
        };
        assert_eq!(params.report_id, 1);
        assert_eq!(params.ids, "1,2,3");
        assert_eq!(params.report_type.as_deref(), Some("pdf"));
    }

    #[test]
    fn report_params_default_report_type() {
        let params = ReportParams {
            report_id: 5,
            ids: "10,20".into(),
            report_type: None,
        };
        assert_eq!(params.report_id, 5);
        assert_eq!(params.ids, "10,20");
        assert!(params.report_type.is_none());
    }

    #[test]
    fn report_params_single_id() {
        let params = ReportParams {
            report_id: 1,
            ids: "42".into(),
            report_type: None,
        };
        assert_eq!(params.ids, "42");
    }
}
