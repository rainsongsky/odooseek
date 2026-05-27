//! WebSocket event bridge — polls Odoo Bus and broadcasts to browsers.

use axum::extract::ws::{Message, WebSocket};
use futures::StreamExt;
use tokio::sync::broadcast;
use tracing::{debug, warn};

/// Spawn a background task that polls Odoo Bus and broadcasts events
pub async fn poll_odoo_bus(
    client: reqwest::Client,
    odoo_url: String,
    event_tx: broadcast::Sender<serde_json::Value>,
) {
    let bus_url = format!(
        "{}/websocket/peek_notifications",
        odoo_url.trim_end_matches('/')
    );
    let mut last: i64 = 0;

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "channels": [],
                "last": last,
                "is_first_poll": false,
            },
            "id": 1,
        });

        let response = match client.post(&bus_url).json(&payload).send().await {
            Ok(r) => r,
            Err(e) => {
                warn!("Odoo Bus poll failed: {e}");
                continue;
            }
        };

        let body: serde_json::Value = match response.json().await {
            Ok(b) => b,
            Err(e) => {
                warn!("Failed to parse Odoo Bus response: {e}");
                continue;
            }
        };

        // Odoo 19 CE returns { result: { channels, notifications: [{id, message}] } }
        if let Some(notifications) = body
            .get("result")
            .and_then(|r| r.get("notifications"))
            .and_then(|n| n.as_array())
            && !notifications.is_empty()
        {
            debug!("Broadcasting {} Odoo Bus notification(s)", notifications.len());
            last = notifications
                .iter()
                .filter_map(|n| n.get("id").and_then(|id| id.as_i64()))
                .max()
                .unwrap_or(last);
            for n in notifications {
                let _ = event_tx.send(n.clone());
            }
        }
    }
}

/// WebSocket handler — subscribes to event broadcast and pushes to browser
pub async fn handle_ws(mut socket: WebSocket, mut rx: broadcast::Receiver<serde_json::Value>) {
    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Ok(event) => {
                        let text = serde_json::to_string(&event).unwrap_or_default();
                        if let Err(e) = socket.send(Message::Text(text.into())).await {
                            warn!("WebSocket send error: {e}");
                            return;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        warn!("WebSocket client lagged by {n} messages");
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        return;
                    }
                }
            }
            msg = socket.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => return,
                    Some(Err(e)) => {
                        warn!("WebSocket recv error: {e}");
                        return;
                    }
                    _ => {} // ignore other messages
                }
            }
        }
    }
}
