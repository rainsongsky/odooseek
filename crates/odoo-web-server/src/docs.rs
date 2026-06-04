//! OpenAPI 3.0 documentation via utoipa.

use utoipa::Modify;
use utoipa::OpenApi;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "OdooSeek BFF Gateway",
        version = "0.1.0",
        description = "Backend-for-Frontend gateway proxying between the React SPA and Odoo 19 CE.",
    ),
    paths(
        crate::health::health_check,
    ),
    tags(
        (name = "health", description = "Health & diagnostics"),
        (name = "session", description = "Session management"),
        (name = "menu", description = "Menu system"),
        (name = "proxy", description = "Odoo JSON-RPC proxy"),
        (name = "report", description = "Reports & barcodes"),
        (name = "cache", description = "Cache administration"),
    ),
    modifiers(&SecurityAddon),
)]
pub struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "cookie_auth",
                SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("session_id"))),
            );
        }
    }
}
