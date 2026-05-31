//! Axum-specific error wrapper for IntoResponse.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use odoo_core::error::OdooError;

/// Wrapper error type for axum handlers
#[derive(Debug)]
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
        match &self.0 {
            OdooError::Api {
                code,
                message,
                data,
            } => {
                // Session expired → 401 so frontend redirects to login
                let status = if *code == 100 {
                    StatusCode::UNAUTHORIZED
                } else {
                    StatusCode::OK
                };
                let body = serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": code,
                        "message": message,
                        "data": data,
                    },
                    "id": serde_json::Value::Null,
                });
                (status, axum::Json(body)).into_response()
            }
            OdooError::Http(_) | OdooError::Unreachable(_) => {
                let body = serde_json::json!({
                    "error": true,
                    "message": self.0.to_string(),
                });
                (StatusCode::BAD_GATEWAY, axum::Json(body)).into_response()
            }
            OdooError::NotAuthenticated | OdooError::LoginFailed(_) => {
                let body = serde_json::json!({
                    "error": true,
                    "message": self.0.to_string(),
                });
                (StatusCode::UNAUTHORIZED, axum::Json(body)).into_response()
            }
            _ => {
                let body = serde_json::json!({
                    "error": true,
                    "message": self.0.to_string(),
                });
                (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(body)).into_response()
            }
        }
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
            code: 1,
            message: "test".into(),
            data: None,
        })
        .into_response();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn app_error_session_expired_is_401() {
        let response = AppError::from(OdooError::Api {
            code: 100,
            message: "Session expired".into(),
            data: None,
        })
        .into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn app_error_generic_is_500() {
        let response = AppError::from(OdooError::Config("test".into())).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
