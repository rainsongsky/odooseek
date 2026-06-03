use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

#[derive(Clone)]
pub struct CsrfConfig {
    pub allowed_origins: Vec<String>,
}

pub async fn csrf_guard(
    axum::extract::State(config): axum::extract::State<CsrfConfig>,
    req: Request,
    next: Next,
) -> Result<Response, Response> {
    if !matches!(
        req.method(),
        &Method::POST | &Method::PUT | &Method::DELETE | &Method::PATCH
    ) {
        return Ok(next.run(req).await);
    }

    let source = req
        .headers()
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_end_matches('/').to_string())
        .or_else(|| {
            req.headers()
                .get("referer")
                .and_then(|v| v.to_str().ok())
                .and_then(|r| {
                    r.trim_end_matches('/')
                        .rsplitn(3, '/')
                        .last()
                        .map(String::from)
                })
        })
        .unwrap_or_default();

    if source.is_empty() || config.allowed_origins.iter().any(|o| source.starts_with(o)) {
        Ok(next.run(req).await)
    } else {
        Err((
            StatusCode::FORBIDDEN,
            "Cross-site request rejected: invalid Origin",
        )
            .into_response())
    }
}
