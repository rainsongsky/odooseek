//! Menu handler — proxies Odoo's load_menus and enriches with `resModel`.

use std::collections::HashMap;

use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use serde_json::Value;

use crate::AppState;
use crate::error::AppError;
use crate::menu_enrich::{apply_action_res_models, collect_act_window_action_ids};
use odoo_core::error::OdooError;

/// GET /api/menus — proxy Odoo's /web/webclient/load_menus
///
/// Returns the complete menu tree as a flat dict with:
/// - root entry with top-level app IDs
/// - Each menu: id, name, children, appID, xmlid, actionID, actionModel, actionPath, webIcon, webIconData
/// - **resModel** (BFF): `ir.actions.act_window.res_model` for each actionID
pub async fn get_menus(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let cookie_key = headers
        .get("cookie")
        .and_then(|c| c.to_str().ok())
        .map(menu_cache_key)
        .unwrap_or_else(|| "anon".into());

    let cache_key = format!("menus:enriched:{cookie_key}");
    if let Some(cached) = state.cache.get(&cache_key).await {
        return Ok(Json(cached).into_response());
    }

    let body = fetch_load_menus(&state, &headers).await?;
    let enriched = enrich_menus_with_res_models(&state, &headers, body).await?;

    state
        .cache
        .set(&cache_key, enriched.clone(), "load_menus")
        .await;

    Ok(Json(enriched).into_response())
}

async fn fetch_load_menus(state: &AppState, headers: &HeaderMap) -> Result<Value, AppError> {
    let url = format!("{}/web/webclient/load_menus?unique=1", state.odoo_url);

    let mut req = state.http_client.get(&url);
    if let Some(cookie) = headers.get("cookie").and_then(|c| c.to_str().ok()) {
        req = req.header("cookie", cookie);
    }

    let response = req
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("load_menus fetch failed: {e}")))?;

    let status = response.status();
    if status == reqwest::StatusCode::FOUND || status == reqwest::StatusCode::MOVED_PERMANENTLY {
        return Err(AppError(OdooError::Api {
            code: 401,
            message: "Not authenticated".into(),
            data: None,
        }));
    }

    if !status.is_success() {
        return Err(AppError(OdooError::Unreachable(format!(
            "load_menus returned HTTP {status}"
        ))));
    }

    response.json().await.map_err(AppError::from)
}

async fn enrich_menus_with_res_models(
    state: &AppState,
    headers: &HeaderMap,
    menus: Value,
) -> Result<Value, AppError> {
    let ids = collect_act_window_action_ids(&menus);
    if ids.is_empty() {
        return Ok(menus);
    }

    let models = fetch_act_window_res_models(state, headers, &ids).await?;
    Ok(apply_action_res_models(menus, &models))
}

async fn fetch_act_window_res_models(
    state: &AppState,
    headers: &HeaderMap,
    ids: &[i64],
) -> Result<HashMap<i64, String>, AppError> {
    let mut result = HashMap::new();
    const CHUNK: usize = 80;

    for chunk in ids.chunks(CHUNK) {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "model": "ir.actions.act_window",
                "method": "read",
                "args": [chunk, ["res_model"]],
                "kwargs": {},
            },
            "id": 1,
        });

        let odoo_url = format!("{}/web/dataset/call_kw", state.odoo_url);
        let mut req = state
            .http_client
            .post(&odoo_url)
            .header("Content-Type", "application/json")
            .json(&request);

        if let Some(cookie) = headers.get("cookie").and_then(|c| c.to_str().ok()) {
            req = req.header("cookie", cookie);
        }

        let response = req
            .send()
            .await
            .map_err(|e| OdooError::Unreachable(format!("act_window read failed: {e}")))?;

        if !response.status().is_success() {
            tracing::warn!(
                "act_window read HTTP {} — menus returned without resModel",
                response.status()
            );
            continue;
        }

        let body: Value = response.json().await?;
        let Some(rows) = body.get("result").and_then(|r| r.as_array()) else {
            continue;
        };

        for row in rows {
            let Some(id) = row.get("id").and_then(|v| v.as_i64()) else {
                continue;
            };
            let Some(res_model) = row.get("res_model").and_then(|v| v.as_str()) else {
                continue;
            };
            if !res_model.is_empty() {
                result.insert(id, res_model.to_string());
            }
        }
    }

    Ok(result)
}

fn menu_cache_key(cookie: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    cookie.hash(&mut h);
    format!("{:x}", h.finish())
}

/// GET /api/menu — legacy endpoint, returns root menu items
/// Kept for backward compatibility during migration.
pub async fn get_menu(State(state): State<AppState>) -> Result<Response, AppError> {
    let odoo_url = format!("{}/web/dataset/call_kw", state.odoo_url);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "ir.ui.menu",
            "method": "search_read",
            "args": [
                [["parent_id", "=", false]],
                ["id", "name", "action", "sequence", "web_icon"],
            ],
            "kwargs": {
                "order": "sequence asc, id asc",
            },
        },
        "id": 1,
    });

    let response = state
        .http_client
        .post(&odoo_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| OdooError::Unreachable(format!("Menu fetch failed: {e}")))?;

    let body: Value = response.json().await?;

    let menu_items = body.get("result").cloned().unwrap_or(Value::Array(vec![]));

    Ok(Json(menu_items).into_response())
}
