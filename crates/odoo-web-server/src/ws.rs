//! WebSocket event bridge — connects to Odoo Bus and broadcasts to browsers.
//!
//! Strategy: Try real WebSocket connection to Odoo first. If it fails (e.g. Odoo
//! behind a proxy that doesn't support WebSocket), fall back to HTTP polling.

use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

/// Spawn background tasks for Odoo Bus event relay.
/// Tries WebSocket connection first, falls back to HTTP polling.
pub async fn poll_odoo_bus(
    client: reqwest::Client,
    odoo_url: String,
    event_tx: broadcast::Sender<serde_json::Value>,
) {
    let base = odoo_url.trim_end_matches('/');

    // Try real WebSocket first
    match connect_odoo_ws(base, event_tx.clone()).await {
        Ok(()) => {
            info!("Connected to Odoo Bus via WebSocket");
            return;
        }
        Err(e) => {
            warn!("Odoo WebSocket failed ({e}), falling back to HTTP polling");
        }
    }

    // Fallback: HTTP polling
    let bus_url = format!("{}/websocket/peek_notifications", base);
    let mut last: i64 = 0;
    let mut first_poll = true;

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "channels": [],
                "last": last,
                "is_first_poll": first_poll,
            },
            "id": 1,
        });
        first_poll = false;

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

        if let Some(notifications) = body
            .get("result")
            .and_then(|r| r.get("notifications"))
            .and_then(|n| n.as_array())
            && !notifications.is_empty()
        {
            debug!(
                "Broadcasting {} Odoo Bus notification(s)",
                notifications.len()
            );
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

/// Attempt to connect to Odoo's `/websocket` endpoint using tokio-tungstenite.
/// On success, reads frames and broadcasts them via the event_tx channel.
async fn connect_odoo_ws(
    base: &str,
    event_tx: broadcast::Sender<serde_json::Value>,
) -> Result<(), String> {
    // Build WS URL: ws://host:8069/websocket or wss://host/websocket
    let ws_url = if base.starts_with("https://") {
        base.replace("https://", "wss://")
    } else if base.starts_with("http://") {
        base.replace("http://", "ws://")
    } else {
        format!("ws://{}", base)
    };
    let ws_url = format!("{}/websocket", ws_url);
    info!("Connecting to Odoo WebSocket at {ws_url}");

    let request = http::Request::builder()
        .uri(&ws_url)
        .header("Origin", base)
        .body(())
        .map_err(|e| format!("Failed to build WS request: {e}"))?;

    let (ws_stream, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("WS connection failed: {e}"))?;

    info!("Odoo WebSocket connected");
    let (mut write, mut read) = ws_stream.split();

    // Send periodic ping to keep connection alive through proxies/LBs
    let keepalive = tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            if write
                .send(tokio_tungstenite::tungstenite::Message::Ping(vec![]))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    while let Some(msg) = read.next().await {
        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&text) {
                    let _ = event_tx.send(event);
                }
            }
            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                warn!("Odoo WebSocket closed, will reconnect");
                break;
            }
            Err(e) => {
                warn!("Odoo WebSocket error: {e}, reconnecting...");
                break;
            }
            _ => {}
        }
    }

    keepalive.abort();
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    Err("Disconnected - will retry".into())
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
