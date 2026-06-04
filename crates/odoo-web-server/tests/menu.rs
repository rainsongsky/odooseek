mod common;

use common::*;
use odoo_web_server::menu;
use serde_json::json;
use tower::util::ServiceExt;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn get_menus_proxies_load_menus() {
    let mock = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/web/webclient/load_menus"))
        .and(query_param("unique", "1"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "root": {"id": 1, "name": "root", "children": [2, 3]},
            "1": {"id": 1, "name": "root"},
            "2": {"id": 2, "name": "Human Resources", "xmlid": "menu_hr_root", "appID": "hr", "actionID": false, "children": [4]},
            "3": {"id": 3, "name": "CRM", "xmlid": "menu_crm_root", "appID": "crm", "actionID": false, "children": []},
            "4": {"id": 4, "name": "Employees", "xmlid": "menu_hr_employee_payroll", "actionID": "472", "children": []}
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let dispatch = axum::Router::new()
        .route("/api/menus", axum::routing::get(menu::get_menus))
        .with_state(state);

    let resp = dispatch
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/menus")
                .header("cookie", "session_id=abc123")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_menu_returns_items() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": [{"id": 2, "name": "Human Resources", "children_count": 3}]
        })))
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let dispatch = axum::Router::new()
        .route("/api/menu", axum::routing::get(menu::get_menu))
        .with_state(state);

    let resp = dispatch
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/menu")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[test]
fn collect_action_ids_extracts_valid_ids() {
    let menus = serde_json::json!({
        "root": {"children": [2, 3]},
        "2": {"actionID": 472, "actionModel": "ir.actions.act_window", "id": 2},
        "3": {"actionID": false, "id": 3}
    });

    let ids = odoo_web_server::menu_enrich::collect_act_window_action_ids(&menus);
    assert_eq!(ids, vec![472]);
}

#[test]
fn collect_action_ids_handles_empty() {
    let menus = serde_json::json!({});
    let ids = odoo_web_server::menu_enrich::collect_act_window_action_ids(&menus);
    assert!(ids.is_empty());
}

#[test]
fn apply_res_models_injects_field() {
    let mut maps = std::collections::HashMap::new();
    maps.insert(472, "hr.employee".into());

    let menus = serde_json::json!({
        "2": {"actionID": 472, "id": 2, "name": "Employees"},
        "3": {"actionID": false, "id": 3, "name": "Root"}
    });

    let enriched = odoo_web_server::menu_enrich::apply_action_res_models(menus.clone(), &maps);
    assert_eq!(enriched["2"]["resModel"], "hr.employee");
    assert!(enriched["3"].get("resModel").is_none());
}

#[test]
fn apply_res_models_preserves_other_fields() {
    let mut maps = std::collections::HashMap::new();
    maps.insert(504, "res.partner".into());

    let menus = serde_json::json!({
        "4": {"actionID": 504, "id": 4, "name": "Contacts", "xmlid": "menu_contacts"}
    });

    let enriched = odoo_web_server::menu_enrich::apply_action_res_models(menus.clone(), &maps);
    assert_eq!(enriched["4"]["resModel"], "res.partner");
    assert_eq!(enriched["4"]["name"], "Contacts");
    assert_eq!(enriched["4"]["id"], 4);
}
