mod common;

use common::*;
use odoo_core::types::LoginRequest;
use odoo_web_server::session;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn login_success() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/authenticate"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({
                    "jsonrpc": "2.0", "id": 1,
                    "result": {"uid": 2, "name": "Admin", "username": "admin", "is_admin": true, "db": "test"}
                }))
                .insert_header("Set-Cookie", "session_id=abc123"),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::login(state, LoginRequest::new("test", "admin", "admin")).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn login_rate_limited_after_exceeding_limit() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/authenticate"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&mock)
        .await;

    let state = test_state(&mock);

    for _ in 0..30 {
        let client_ip = "127.0.0.1".to_string();
        assert!(state.rate_limiter.check(&client_ip));
    }
    let client_ip = "127.0.0.1".to_string();
    assert!(!state.rate_limiter.check(&client_ip));
}

#[tokio::test]
async fn logout_destroys_session() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/destroy"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"jsonrpc":"2.0","id":1,"result":true}))
                .insert_header("Set-Cookie", "session_id=; Max-Age=0"),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::logout(state, auth_cookie_header()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn get_languages_returns_list() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/get_lang_list"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": [["en_US", "English"], ["zh_CN", "中文"]]
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::get_languages(state).await;
    assert!(result.is_ok());
    let langs = result.unwrap();
    assert!(!langs.is_empty());
}

#[tokio::test]
async fn get_modules_returns_list() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/modules"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": ["base", "web", "hr", "crm"]
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::get_modules(state, auth_cookie_header()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn session_check_authenticated() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/check"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::check(state, auth_cookie_header()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn session_check_anonymous() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/check"))
        .respond_with(ResponseTemplate::new(401))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::check(state, anon_header()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn session_info_anonymous() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/get_session_info"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1, "result": {"uid": false}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::get_session_info(state, anon_header()).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn session_info_authenticated() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/session/get_session_info"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": {"uid": 2, "name": "Admin", "username": "admin", "is_admin": true, "db": "test"}
        })))
        .mount(&mock)
        .await;

    Mock::given(method("GET"))
        .and(path("/web/webclient/load_menus"))
        .and(wiremock::matchers::query_param("unique", "1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "root": {"id": 1, "name": "root", "children": []},
            "1": {"id": 1, "name": "root"}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = session::get_session_info(state, auth_cookie_header()).await;
    assert!(result.is_ok());
}
