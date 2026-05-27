//! Session management — login/logout/session-info via Odoo JSON-RPC.

use crate::AppState;
use crate::error::AppError;
use axum::http::HeaderMap;
use axum::response::Response;
use odoo_core::error::OdooError;
use odoo_core::types::{JsonRpcRequest, JsonRpcResponse, LoginRequest, SessionInfo};

/// GET /api/session — return current authentication state
pub async fn get_session_info(state: AppState, _headers: HeaderMap) -> Result<Response, AppError> {
    let request = JsonRpcRequest::odoo_get_session();
    proxy_call(state, "/web/session/get_session", &request).await
}

/// POST /api/session/login — authenticate with Odoo
pub async fn login(state: AppState, body: LoginRequest) -> Result<Response, AppError> {
    let request = JsonRpcRequest::odoo_authenticate(&body.db, &body.login, &body.password);
    proxy_call(state, "/web/session/authenticate", &request).await
}

/// POST /api/session/logout — destroy current session
pub async fn logout(state: AppState, _headers: HeaderMap) -> Result<Response, AppError> {
    let request = JsonRpcRequest::odoo_destroy_session();
    proxy_call(state, "/web/session/destroy", &request).await
}

/// Forward a JSON-RPC call to Odoo and return the response
async fn proxy_call(
    state: AppState,
    path: &str,
    request: &JsonRpcRequest,
) -> Result<Response, AppError> {
    let odoo_url = format!("{}{}", state.odoo_url.trim_end_matches('/'), path);
    tracing::debug!("Session call to: {odoo_url}");

    let response = state
        .http_client
        .post(&odoo_url)
        .json(request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo not reachable: {e}")))?;

    let status = response.status();
    let odoo_headers = response.headers().clone();

    let json_body: JsonRpcResponse = response.json().await?;

    // Check for JSON-RPC error in Odoo response
    if let Some(rpc_error) = json_body.error {
        return Err(AppError(OdooError::Api {
            code: rpc_error.code,
            message: rpc_error.message,
            data: rpc_error.data,
        }));
    }

    // Build session info from Odoo response
    let session_info = match json_body.result {
        Some(ref result) => {
            let uid = result.get("uid").and_then(|v| v.as_i64());
            let username = result
                .get("username")
                .and_then(|v| v.as_str())
                .map(String::from);
            let db = result.get("db").and_then(|v| v.as_str()).map(String::from);
            let session_id = result
                .get("session_id")
                .and_then(|v| v.as_str())
                .map(String::from);

            SessionInfo {
                authenticated: uid.is_some(),
                uid,
                username,
                db,
                session_id,
            }
        }
        None => SessionInfo::anonymous(),
    };

    // Build response, forward Set-Cookie
    let mut builder = Response::builder().status(status);
    for (key, value) in odoo_headers.iter() {
        if key.as_str().eq_ignore_ascii_case("set-cookie") && let Ok(v) = value.to_str() {
            builder = builder.header("Set-Cookie", v);
        }
    }

    builder
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&session_info).unwrap_or_default(),
        ))
        .map_err(|e| AppError(OdooError::InvalidResponse(e.to_string())))
}
