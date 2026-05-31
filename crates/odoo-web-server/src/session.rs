//! Session management — login/logout/session-info via Odoo 19 CE real API.

use axum::http::HeaderMap;
use axum::response::Response;

use crate::AppState;
use crate::error::AppError;
use crate::helpers::{json_response_with_cookies, session_info_from_json};
use odoo_core::error::OdooError;
use odoo_core::types::{LoginRequest, SessionInfo};

/// GET /api/session — calls Odoo /web/session/get_session_info
pub async fn get_session_info(state: AppState, headers: HeaderMap) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/get_session_info", state.odoo_url);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": 1,
    });

    let mut req = state.http_client.post(&odoo_url).json(&request);

    if let Some(cookie) = headers.get("cookie")
        && let Ok(cookie_str) = cookie.to_str()
    {
        req = req.header("cookie", cookie_str);
    }

    let response = req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo get_session_info failed: {e}")))?;

    let resp_headers = response.headers().clone();
    let json_body: serde_json::Value = response.json().await?;

    let info = match json_body.get("result") {
        Some(result) => session_info_from_json(result),
        None => SessionInfo::anonymous(),
    };

    Ok(json_response_with_cookies(&info, &resp_headers))
}

/// POST /api/session/login — calls Odoo /web/session/authenticate
pub async fn login(state: AppState, body: LoginRequest) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/authenticate", state.odoo_url);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "db": body.db,
            "login": body.login,
            "password": body.password,
        },
        "id": 1,
    });

    let response = state
        .http_client
        .post(&odoo_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo authenticate failed: {e}")))?;

    let resp_headers = response.headers().clone();
    let json_body: serde_json::Value = response.json().await?;

    // Check for JSON-RPC error
    if let Some(err) = json_body.get("error") {
        return Err(AppError(OdooError::Api {
            code: err.get("code").and_then(|c| c.as_i64()).unwrap_or(0),
            message: err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown")
                .into(),
            data: err.get("data").cloned(),
        }));
    }

    let mut info = match json_body.get("result") {
        Some(result) => session_info_from_json(result),
        None => SessionInfo::anonymous(),
    };
    info.username = Some(body.login);
    info.db = Some(body.db);

    Ok(json_response_with_cookies(&info, &resp_headers))
}

/// POST /api/session/logout — calls Odoo /web/session/destroy
pub async fn logout(state: AppState, headers: HeaderMap) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/destroy", state.odoo_url);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": 1,
    });

    let mut req = state.http_client.post(&odoo_url).json(&request);
    if let Some(cookie) = headers.get("cookie")
        && let Ok(cookie_str) = cookie.to_str()
    {
        req = req.header("cookie", cookie_str);
    }

    let response = req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo session destroy failed: {e}")))?;

    let resp_headers = response.headers().clone();

    Ok(json_response_with_cookies(
        &SessionInfo::anonymous(),
        &resp_headers,
    ))
}
