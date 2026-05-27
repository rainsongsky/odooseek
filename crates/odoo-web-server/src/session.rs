//! Session management — login/logout/session-info via Odoo 19 CE real API.

use axum::http::HeaderMap;
use axum::response::Response;

use crate::error::AppError;
use crate::AppState;
use odoo_core::error::OdooError;
use odoo_core::types::{LoginRequest, SessionInfo};

/// GET /api/session — calls Odoo /web/session/get_session_info
pub async fn get_session_info(
    state: AppState,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/get_session_info", state.odoo_url.trim_end_matches('/'));

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": 1,
    });

    let mut req = state.http_client.post(&odoo_url).json(&request);

    // Forward browser Cookie to Odoo for session recognition
    if let Some(cookie) = headers.get("cookie")
        && let Ok(cookie_str) = cookie.to_str()
    {
        req = req.header("cookie", cookie_str);
    }

    let response = req.send().await.map_err(|e| {
        OdooError::Unreachable(format!("Odoo get_session_info failed: {e}"))
    })?;

    let resp_headers = response.headers().clone();
    let json_body: serde_json::Value = response.json().await?;

    // Build SessionInfo from Odoo's session_info() response
    let info = match json_body.get("result") {
        Some(result) => serde_json::from_value::<SessionInfo>(result.clone())
            .unwrap_or_else(|_| SessionInfo {
                authenticated: result.get("uid").and_then(|v| v.as_i64()).is_some(),
                uid: result.get("uid").and_then(|v| v.as_i64()),
                username: result.get("username").and_then(|v| v.as_str()).map(String::from),
                db: result.get("db").and_then(|v| v.as_str()).map(String::from),
                ..Default::default()
            }),
        None => SessionInfo::anonymous(),
    };

    let mut builder = Response::builder().status(200);
    for (key, value) in resp_headers.iter() {
        if key.as_str().eq_ignore_ascii_case("set-cookie") && let Ok(v) = value.to_str() {
            builder = builder.header("Set-Cookie", v);
        }
    }

    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&info).unwrap_or_default(),
        ))
        .map_err(|e| AppError(OdooError::InvalidResponse(e.to_string())))
}

/// POST /api/session/login — calls Odoo /web/session/authenticate
pub async fn login(
    state: AppState,
    body: LoginRequest,
) -> Result<Response, AppError> {
    let odoo_url = format!(
        "{}/web/session/authenticate",
        state.odoo_url.trim_end_matches('/')
    );

    // Odoo 19 CE: flat params (db, login, password), NOT nested args array
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
            message: err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown").into(),
            data: err.get("data").cloned(),
        }));
    }

    // Parse session_info from Odoo's authenticate response
    let info = match json_body.get("result") {
        Some(result) => serde_json::from_value::<SessionInfo>(result.clone())
            .unwrap_or_else(|_| SessionInfo {
                authenticated: result.get("uid").and_then(|v| v.as_i64()).is_some(),
                uid: result.get("uid").and_then(|v| v.as_i64()),
                username: Some(body.login),
                db: Some(body.db),
                ..Default::default()
            }),
        None => SessionInfo::anonymous(),
    };

    let mut builder = Response::builder().status(200);
    for (key, value) in resp_headers.iter() {
        if key.as_str().eq_ignore_ascii_case("set-cookie") && let Ok(v) = value.to_str() {
            builder = builder.header("Set-Cookie", v);
        }
    }

    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&info).unwrap_or_default(),
        ))
        .map_err(|e| AppError(OdooError::InvalidResponse(e.to_string())))
}

/// POST /api/session/logout — calls Odoo /web/session/destroy
pub async fn logout(
    state: AppState,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/destroy", state.odoo_url.trim_end_matches('/'));

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

    let response = req.send().await.map_err(|e| {
        OdooError::Unreachable(format!("Odoo session destroy failed: {e}"))
    })?;

    let resp_headers = response.headers().clone();

    let mut builder = Response::builder().status(200);
    for (key, value) in resp_headers.iter() {
        if key.as_str().eq_ignore_ascii_case("set-cookie") && let Ok(v) = value.to_str() {
            builder = builder.header("Set-Cookie", v);
        }
    }

    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&SessionInfo::anonymous()).unwrap_or_default(),
        ))
        .map_err(|e| AppError(OdooError::InvalidResponse(e.to_string())))
}
