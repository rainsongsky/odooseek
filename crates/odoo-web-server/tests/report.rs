mod common;

use common::*;
use odoo_web_server::report;
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn download_report_resolves_and_proxies() {
    let mock = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/web/dataset/call_kw"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "jsonrpc": "2.0", "id": 1,
            "result": [{"report_name": "hr.hr_employee_print_badge", "report_type": "qweb-pdf"}]
        })))
        .mount(&mock)
        .await;

    Mock::given(method("GET"))
        .and(path("/report/pdf/hr.hr_employee_print_badge/7,8"))
        .respond_with(
            ResponseTemplate::new(200).set_body_raw(b"%PDF-1.4 fake report", "application/pdf"),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = report::download_report(
        axum::extract::State(state),
        anon_header(),
        axum::extract::Query(report::ReportParams {
            report_id: 5,
            ids: "7,8".into(),
            report_type: Some("pdf".into()),
        }),
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn download_report_rejects_zero_id() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);
    let result = report::download_report(
        axum::extract::State(state),
        anon_header(),
        axum::extract::Query(report::ReportParams {
            report_id: 0,
            ids: "1".into(),
            report_type: None,
        }),
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn download_report_rejects_negative_id() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);
    let result = report::download_report(
        axum::extract::State(state),
        anon_header(),
        axum::extract::Query(report::ReportParams {
            report_id: -1,
            ids: "1".into(),
            report_type: None,
        }),
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn download_report_rejects_non_integer_ids() {
    let mock = MockServer::start().await;
    let state = test_state(&mock);
    let result = report::download_report(
        axum::extract::State(state),
        anon_header(),
        axum::extract::Query(report::ReportParams {
            report_id: 1,
            ids: "1,abc,3".into(),
            report_type: None,
        }),
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn proxy_barcode_forwards_request() {
    let mock = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/report/barcode/barcode/EAN13/1234567890123"))
        .respond_with(
            ResponseTemplate::new(200).set_body_raw(vec![0x89, b'P', b'N', b'G'], "image/png"),
        )
        .mount(&mock)
        .await;

    let state = test_state(&mock);
    let result = report::proxy_barcode(
        axum::extract::State(state),
        axum::extract::Path("barcode/EAN13/1234567890123".into()),
        anon_header(),
    )
    .await;

    assert!(result.is_ok());
}
