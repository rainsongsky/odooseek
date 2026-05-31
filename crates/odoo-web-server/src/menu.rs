//! Menu handler — proxies Odoo's load_menus for complete menu tree.

use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};

use crate::AppState;
use crate::error::AppError;
use odoo_core::error::OdooError;

/// GET /api/menus — proxy Odoo's /web/webclient/load_menus
///
/// Returns the complete menu tree as a flat dict with:
/// - root entry with top-level app IDs
/// - Each menu: id, name, children, appID, xmlid, actionID, actionModel, actionPath, webIcon, webIconData
pub async fn get_menus(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let url = format!("{}/web/webclient/load_menus?unique=1", state.odoo_url);

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| state.http_client.clone());

    let mut req = client.get(&url);
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

    let body: serde_json::Value = response.json().await?;

    Ok(Json(body).into_response())
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

    let body: serde_json::Value = response.json().await?;

    let menu_items = body
        .get("result")
        .cloned()
        .unwrap_or(serde_json::Value::Array(vec![]));

    Ok(Json(menu_items).into_response())
}
