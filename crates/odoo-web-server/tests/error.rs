use axum::response::IntoResponse as _;
use odoo_core::error::OdooError;
use odoo_web_server::AppError;

#[tokio::test]
async fn login_failed_maps_to_401() {
    let response = AppError::from(OdooError::LoginFailed("Bad password".into())).into_response();
    assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn not_authenticated_maps_to_401() {
    let response = AppError::from(OdooError::NotAuthenticated).into_response();
    assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn unreachable_maps_to_502() {
    let response = AppError::from(OdooError::Unreachable("down".into())).into_response();
    assert_eq!(response.status(), axum::http::StatusCode::BAD_GATEWAY);
}

#[tokio::test]
async fn invalid_response_maps_to_500() {
    let response = AppError::from(OdooError::InvalidResponse("malformed".into())).into_response();
    assert_eq!(
        response.status(),
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    );
}

#[tokio::test]
async fn deserialization_maps_to_500() {
    let serde_err = serde_json::from_str::<serde_json::Value>("bad").unwrap_err();
    let response = AppError::from(OdooError::Deserialization(serde_err)).into_response();
    assert_eq!(
        response.status(),
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    );
}

#[tokio::test]
async fn api_error_code_100_maps_to_401() {
    let response = AppError::from(OdooError::Api {
        code: 100,
        message: "Session expired".into(),
        data: None,
    })
    .into_response();
    assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn api_error_other_code_maps_to_200() {
    let response = AppError::from(OdooError::Api {
        code: 200,
        message: "Validation error".into(),
        data: None,
    })
    .into_response();
    assert_eq!(response.status(), axum::http::StatusCode::OK);
}
