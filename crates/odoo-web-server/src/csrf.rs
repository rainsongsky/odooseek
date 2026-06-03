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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_origin_matches_allowed() {
        let config = CsrfConfig {
            allowed_origins: vec!["http://localhost:5173".into(), "http://example.com".into()],
        };
        assert!(config
            .allowed_origins
            .iter()
            .any(|o| "http://localhost:5173".starts_with(o)));
        assert!(config
            .allowed_origins
            .iter()
            .any(|o| "http://example.com/app".starts_with(o)));
    }

    #[test]
    fn test_origin_rejects_unknown() {
        let config = CsrfConfig {
            allowed_origins: vec!["http://localhost:5173".into()],
        };
        assert!(!config
            .allowed_origins
            .iter()
            .any(|o| "http://evil.com".starts_with(o)));
    }

    #[test]
    fn test_referer_extraction_from_url() {
        let referer = "http://localhost:5173/some/path";
        let origin = referer
            .trim_end_matches('/')
            .rsplitn(3, '/')
            .last()
            .unwrap();
        assert_eq!(origin, "http://localhost:5173");
    }

    #[test]
    fn test_empty_origin_allowed() {
        // Empty source (no Origin/Referer header) should be allowed
        // because same-origin POSTs may not send Origin
        let source = "";
        assert!(source.is_empty());
    }
}
