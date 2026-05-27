//! Session management — login/logout/session-info via Odoo JSON-RPC.

use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use axum::Json;
use crate::error::AppError;
use odoo_core::error::OdooError;
use odoo_core::error::OdooResult;
use odoo_core::types::{LoginRequest, SessionInfo};
use crate::AppState;

/// GET /api/session — return current authentication state
pub async fn get_session_info(
    state: AppState,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let cookie = headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Check if session cookie exists and is valid
    if cookie.is_empty() || !cookie.contains("session_id") {
        return Ok(Json(SessionInfo::anonymous()).into_response());
    }

    // Try to get session from Odoo
    match try_get_session(&state, headers).await {
        Ok(info) => Ok(Json(info).into_response()),
        Err(_) => Ok(Json(SessionInfo::anonymous()).into_response()),
    }
}

/// POST /api/session/login — authenticate with Odoo
pub async fn login(
    state: AppState,
    body: LoginRequest,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}/jsonrpc", state.odoo_url.trim_end_matches('/'));

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "common",
            "method": "authenticate",
            "args": [body.db, body.login, body.password],
        },
        "id": 1,
    });

    let response = state
        .http_client
        .post(&odoo_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo not reachable: {e}")))?;

    let resp_headers = response.headers().clone();
    let json_body: serde_json::Value = response.json().await?;

    // Check for error
    if let Some(err) = json_body.get("error") {
        return Err(AppError(OdooError::Api {
            code: err.get("code").and_then(|c| c.as_i64()).unwrap_or(0),
            message: err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown").into(),
            data: err.get("data").cloned(),
        }));
    }

    let uid = json_body.get("result").and_then(|r| r.as_i64());

    let info = SessionInfo {
        authenticated: uid.is_some(),
        uid,
        username: Some(body.login),
        db: Some(body.db),
        session_id: None,
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

/// POST /api/session/logout — destroy current session
pub async fn logout(
    state: AppState,
    _headers: HeaderMap,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}/jsonrpc", state.odoo_url.trim_end_matches('/'));

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "common",
            "method": "logout",
            "args": [],
        },
        "id": 1,
    });

    let response = state
        .http_client
        .post(&odoo_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo not reachable: {e}")))?;

    let headers = response.headers().clone();

    let mut builder = Response::builder().status(200);
    for (key, value) in headers.iter() {
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

/// Try to get the current session
async fn try_get_session(
    state: &AppState,
    headers: HeaderMap,
) -> OdooResult<SessionInfo> {
    let odoo_url = format!("{}/jsonrpc", state.odoo_url.trim_end_matches('/'));

    // Use object.execute_kw to get current user info
    let uid = {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "service": "common",
                "method": "authenticate",
                "args": ["", "", ""], // dummy — just to test if session cookie works
            },
            "id": 1,
        });

        let mut req = state.http_client.post(&odoo_url).json(&request);
        if let Some(cookie) = headers.get("cookie") {
            req = req.header("cookie", cookie);
        }

        let resp = req.send().await?;
        let body: serde_json::Value = resp.json().await?;

        body.get("result").and_then(|r| r.as_i64())
    };

    Ok(SessionInfo {
        authenticated: uid.is_some(),
        uid,
        username: None,
        db: None,
        session_id: None,
    })
}
