//! Menu handler — fetches Odoo menu tree for dynamic navigation.

use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::error::AppError;
use crate::AppState;
use odoo_core::error::OdooError;

/// GET /api/menu — return root menu items from ir.ui.menu
pub async fn get_menu(
    State(state): State<AppState>,
) -> Result<Response, AppError> {
    let odoo_url = format!(
        "{}/web/dataset/call_kw",
        state.odoo_url.trim_end_matches('/')
    );

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

    // Return raw Odoo result — frontend handles formatting
    let menu_items = body
        .get("result")
        .cloned()
        .unwrap_or(serde_json::Value::Array(vec![]));

    Ok(Json(menu_items).into_response())
}
