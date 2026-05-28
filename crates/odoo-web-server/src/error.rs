//! Axum-specific error wrapper for IntoResponse.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use odoo_core::error::OdooError;

/// Wrapper error type for axum handlers
pub struct AppError(pub OdooError);

impl From<OdooError> for AppError {
    fn from(e: OdooError) -> Self {
        AppError(e)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError(OdooError::Http(e))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError(OdooError::Deserialization(e))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            OdooError::Http(_) => (StatusCode::BAD_GATEWAY, self.0.to_string()),
            OdooError::Unreachable(_) => (StatusCode::BAD_GATEWAY, self.0.to_string()),
            OdooError::NotAuthenticated => (StatusCode::UNAUTHORIZED, self.0.to_string()),
            OdooError::Api { .. } => (StatusCode::OK, self.0.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.0.to_string()),
        };

        let body = serde_json::json!({
            "error": true,
            "message": message,
        });

        (status, axum::Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;
    use odoo_core::error::OdooError;

    use super::*;

    #[test]
    fn app_error_not_authenticated_is_401() {
        let response = AppError::from(OdooError::NotAuthenticated).into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn app_error_http_is_502() {
        let reqwest_err = reqwest::Proxy::all("not a url").unwrap_err();
        let response = AppError(OdooError::Http(reqwest_err)).into_response();
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    }

    #[test]
    fn app_error_api_is_200() {
        let response = AppError::from(OdooError::Api {
            code: 100,
            message: "test".into(),
            data: None,
        })
        .into_response();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn app_error_generic_is_500() {
        let response = AppError::from(OdooError::Config("test".into())).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
