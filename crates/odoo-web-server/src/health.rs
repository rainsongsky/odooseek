use axum::Json;
use axum::response::IntoResponse;
use std::collections::HashMap;

use crate::AppState;

pub async fn health_check(
    state: AppState,
    params: HashMap<String, String>,
) -> impl IntoResponse {
    if params.get("deep").map_or(false, |v| v == "true") {
        let url = format!("{}/web/session/get_session_info", state.odoo_url);
        let result = state
            .http_client
            .post(&url)
            .timeout(std::time::Duration::from_secs(5))
            .json(&serde_json::json!({
                "jsonrpc": "2.0",
                "method": "call",
                "params": {},
                "id": 1,
            }))
            .send()
            .await;

        match result {
            Ok(resp) if resp.status().is_success() => {
                Json(serde_json::json!({ "status": "ok", "odoo": "reachable" }))
            }
            Ok(resp) => Json(serde_json::json!({
                "status": "degraded",
                "odoo": format!("HTTP {}", resp.status().as_u16()),
            })),
            Err(e) => Json(serde_json::json!({
                "status": "degraded",
                "odoo": e.to_string(),
            })),
        }
    } else {
        Json(serde_json::json!({ "status": "ok" }))
    }
}
