//! Session management — login/logout/session-info via Odoo 19 CE real API.

use axum::Json;
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};

use crate::AppState;
use crate::error::AppError;
use crate::helpers::{
    json_response_with_cookies, json_response_with_cookies_bytes, session_info_from_json,
};
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
    let mut json_body: serde_json::Value = response.json().await?;

    let info = match json_body.get("result") {
        Some(result) => session_info_from_json(result),
        None => SessionInfo::anonymous(),
    };

    // Enrich with cached menus and apps if authenticated
    if info.authenticated
        && let Ok(enriched) = enrich_with_menus(&state).await
        && let Some(result) = json_body.get_mut("result")
        && let Some(obj) = result.as_object_mut()
    {
        obj.insert("menus".into(), enriched);
    }

    Ok(json_response_with_cookies_bytes(
        &serde_json::to_vec(&json_body).unwrap_or_default(),
        &resp_headers,
    ))
}

/// Fetch menus once, cache in state for session enrichment
async fn enrich_with_menus(state: &AppState) -> Result<serde_json::Value, ()> {
    let cache_key = "session:menus";
    if let Some(cached) = state.cache.get(cache_key).await {
        return Ok(cached);
    }

    let url = format!("{}/web/webclient/load_menus?unique=1", state.odoo_url);
    let resp = state.http_client.get(&url).send().await.map_err(|_| ())?;

    let body: serde_json::Value = resp.json().await.map_err(|_| ())?;

    state.cache.set(cache_key, body.clone(), "load_menus").await;

    // Extract apps: root.children → menus entries with app-level data
    let apps: Vec<serde_json::Value> = if let Some(root) = body.get("root") {
        root.get("children")
            .and_then(|c| c.as_array())
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| {
                        let key = id
                            .as_i64()
                            .map(|n| n.to_string())
                            .or_else(|| id.as_str().map(String::from))?;
                        body.get(&key).cloned()
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    let enriched = serde_json::json!({
        "apps": apps,
    });

    state
        .cache
        .set(cache_key, enriched.clone(), "load_menus")
        .await;
    Ok(enriched)
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

/// GET /api/session/languages — returns installed language list
pub async fn get_languages(state: AppState) -> Result<Json<Vec<[String; 2]>>, AppError> {
    let odoo_url = format!("{}/web/session/get_lang_list", state.odoo_url);
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {},
        "id": 1,
    });

    let response = state
        .http_client
        .post(&odoo_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo lang list failed: {e}")))?;

    let json_body: serde_json::Value = response.json().await?;
    let langs: Vec<[String; 2]> = json_body
        .get("result")
        .and_then(|r| serde_json::from_value(r.clone()).ok())
        .unwrap_or_default();

    Ok(Json(langs))
}

/// GET /api/session/modules — returns installed module names
pub async fn get_modules(
    state: AppState,
    headers: HeaderMap,
) -> Result<Json<Vec<String>>, AppError> {
    let odoo_url = format!("{}/web/session/modules", state.odoo_url);
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
        .map_err(|e| OdooError::Unreachable(format!("Odoo modules failed: {e}")))?;

    let json_body: serde_json::Value = response.json().await?;
    let modules: Vec<String> = json_body
        .get("result")
        .and_then(|r| serde_json::from_value(r.clone()).ok())
        .unwrap_or_default();

    Ok(Json(modules))
}

/// GET /api/session/check — calls Odoo /web/session/check for session liveness
pub async fn check(state: AppState, headers: HeaderMap) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/session/check", state.odoo_url);
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

    let resp = req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Odoo session check failed: {e}")))?;

    if resp.status().is_success() {
        Ok(axum::Json(serde_json::json!({ "ok": true })).into_response())
    } else {
        Ok(axum::Json(serde_json::json!({ "ok": false })).into_response())
    }
}
