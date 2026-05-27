# Phase 1 技术方案与开发计划

> **目标**：构建 `odoo-web-server` Rust BFF 服务，实现 oweb → Rust → Odoo 三层架构，替换当前 Nginx 直连方案。

---

## 一、技术决策总览

| 决策 | 选择 | 理由 |
|------|------|------|
| Web 框架 | **axum 0.8** | uncode + odoo-rust-mcp 已验证 |
| 异步运行时 | **tokio (full features)** | axum 原生要求 |
| HTTP 客户端 | **reqwest 0.12** (json + cookies + rustls-tls) | cookie_store 模式自动管理 Odoo session |
| 序列化 | **serde + serde_json** | 生态标准 |
| 配置方案 | **CLI args (clap) + env vars** | 简单，Docker Compose 友好 |
| 静态文件 | **tower-http ServeDir** (fallback_service) | uncode 已验证，零配置 |
| CORS | **CorsLayer::permissive()** | 开发阶段全开放 |
| 日志/追踪 | **tracing + tracing-subscriber** (env-filter) | 生产级可观测 |
| 错误处理 | **thiserror** 自定义错误枚举 | 类型安全的错误传播 |
| Session 策略 | **HTTP Cookie 透传**（不自行管理 session 存储） | 无状态，最简单可靠 |
| WebSocket | **tokio::sync::broadcast** + axum ws | uncode 已验证，一对多广播 |
| Rust 版本 | **stable (1.91+)** | 与 uncode 对齐 |

---

## 二、Cargo Workspace 结构

### 2.1 根 Cargo.toml

```toml
# odooseek/Cargo.toml
[workspace]
resolver = "3"
members = [
    "crates/odoo-core",
    "crates/odoo-web-server",
]
default-members = ["crates/odoo-web-server"]

[workspace.package]
version = "0.1.0"
edition = "2024"
rust-version = "1.91"
license = "MIT"

[workspace.dependencies]
# Async
tokio = { version = "1", features = ["full"] }
futures = "0.3"

# HTTP / Web
axum = { version = "0.8", features = ["ws"] }
reqwest = { version = "0.12", default-features = false, features = [
    "json", "cookies", "rustls-tls",
] }
tower-http = { version = "0.6", features = ["cors", "fs"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
url = "2"

# Error / Logging
anyhow = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# CLI
clap = { version = "4", features = ["derive", "env"] }

# Utils
chrono = { version = "0.4", features = ["serde"] }
```

### 2.2 文件树

```
crates/
├── odoo-core/                  # 共享类型库 (lib)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs              # 模块导出
│       ├── types.rs            # OdooSession, JsonRpcRequest/Response
│       ├── error.rs            # OdooError, OdooResult
│       └── config.rs           # ServerConfig, load from env
│
└── odoo-web-server/           # axum 服务 (bin)
    ├── Cargo.toml
    └── src/
        ├── main.rs             # 入口 + CLI + Router 组装
        ├── proxy.rs            # JSON-RPC 透传代理
        ├── session.rs          # Session 端点 (/api/session)
        └── ws.rs               # WebSocket 事件桥接
```

### 2.3 crates/odoo-core/Cargo.toml

```toml
[package]
name = "odoo-core"
version.workspace = true
edition.workspace = true
rust-version.workspace = true

[dependencies]
serde.workspace = true
serde_json.workspace = true
thiserror.workspace = true
tracing.workspace = true
url.workspace = true
chrono.workspace = true
```

### 2.4 crates/odoo-web-server/Cargo.toml

```toml
[package]
name = "odoo-web-server"
version.workspace = true
edition.workspace = true
rust-version.workspace = true

[dependencies]
odoo-core = { path = "../odoo-core" }
tokio.workspace = true
axum.workspace = true
reqwest.workspace = true
tower-http.workspace = true
serde.workspace = true
serde_json.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
anyhow.workspace = true
clap.workspace = true
futures.workspace = true
```

---

## 三、核心类型设计

### 3.1 JSON-RPC 类型

```rust
// crates/odoo-core/src/types.rs

/// JSON-RPC 2.0 请求
#[derive(Debug, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: &'static str,      // "2.0"
    pub id: u64,
    pub method: String,              // "call"
    pub params: JsonRpcParams,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcParams {
    pub service: String,             // "common" | "object" | "db"
    pub method: String,              // "authenticate" | "execute_kw"
    pub args: Vec<serde_json::Value>,
}

/// JSON-RPC 2.0 响应
#[derive(Debug, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<serde_json::Value>,
    #[serde(default)]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    pub data: Option<serde_json::Value>,
}
```

### 3.2 Session 类型

```rust
// crates/odoo-core/src/types.rs

/// oweb 前端会话信息 (从 /api/session 返回)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub authenticated: bool,
    pub uid: Option<i64>,
    pub username: Option<String>,
    pub db: Option<String>,
    pub session_id: Option<String>,
}

impl SessionInfo {
    pub fn anonymous() -> Self {
        Self {
            authenticated: false,
            uid: None,
            username: None,
            db: None,
            session_id: None,
        }
    }
}
```

### 3.3 错误类型

```rust
// crates/odoo-core/src/error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum OdooError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Odoo API error ({code}): {message}")]
    Api {
        code: i64,
        message: String,
        data: Option<serde_json::Value>,
    },

    #[error("Invalid response from Odoo: {0}")]
    InvalidResponse(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Not authenticated")]
    NotAuthenticated,
}

pub type OdooResult<T> = Result<T, OdooError>;
```

### 3.4 服务器配置

```rust
// crates/odoo-core/src/config.rs

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub odoo_url: String,           // Odoo JSON-RPC endpoint
    pub odoo_db: Option<String>,    // default database
    pub frontend_dir: String,       // oweb SPA static files
    pub log_level: String,
}

impl ServerConfig {
    pub fn from_env() -> OdooResult<Self> {
        Ok(Self {
            host:       env_or("HOST", "0.0.0.0"),
            port:       env_or("PORT", "3000").parse().unwrap_or(3000),
            odoo_url:   env_or("ODOO_URL", "http://localhost:8069"),
            odoo_db:    env_opt("ODOO_DB"),
            frontend_dir: env_or("FRONTEND_DIR", "../apps/oweb/dist"),
            log_level:  env_or("LOG_LEVEL", "info"),
        })
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}
fn env_opt(key: &str) -> Option<String> {
    std::env::var(key).ok()
}
```

---

## 四、Axum 路由设计

### 4.1 整体路由表

```
Monitor:
  GET  /health                     → {"status":"ok","odoo":{"reachable":true}}

Session:
  GET  /api/session                → SessionInfo (当前认证状态)
  POST /api/session/login          → 代理 Odoo /web/session/authenticate
  POST /api/session/logout         → 代理 Odoo /web/session/destroy

Proxy:
  POST /api/odoo/*path             → reqwest 透传到 Odoo JSON-RPC
  GET  /web/content/*              → 透传到 Odoo (附件下载)

WebSocket:
  GET  /ws/events                  → Odoo Bus 事件推送

Static:
  GET  /{fallback}                 → oweb SPA (ServeDir + SPA fallback)
```

### 4.2 main.rs 结构

```rust
// crates/odoo-web-server/src/main.rs

use axum::{Router, routing::{get, post}};
use tower_http::{cors::CorsLayer, services::ServeDir};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;

mod proxy;
mod session;
mod ws;

/// 应用全局共享状态
#[derive(Clone)]
struct AppState {
    /// reqwest HTTP 客户端 (含 cookie_store, 自动管理 session)
    http_client: reqwest::Client,
    /// Odoo 服务 URL (如 http://web:8069)
    odoo_url: String,
    /// WebSocket 事件广播通道 (发送端)
    event_tx: broadcast::Sender<serde_json::Value>,
    /// 前端静态文件目录
    frontend_dir: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
        )
        .init();

    // 2. 加载配置
    let config = odoo_core::config::ServerConfig::from_env()?;
    info!("Starting odoo-web-server v{}", env!("CARGO_PKG_VERSION"));
    info!("Odoo URL: {}", config.odoo_url);
    info!("Frontend dir: {}", config.frontend_dir);

    // 3. 构建 HTTP 客户端 (cookie_store = true 自动管理 session)
    let http_client = reqwest::Client::builder()
        .user_agent(concat!("odoo-web-server/", env!("CARGO_PKG_VERSION")))
        .cookie_store(true)      // ← 核心：自动管理 Odoo session cookie
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    // 4. WebSocket 事件广播通道
    let (event_tx, _) = broadcast::channel::<serde_json::Value>(256);

    // 5. 组装共享状态
    let state = AppState {
        http_client,
        odoo_url: config.odoo_url.clone(),
        event_tx: event_tx.clone(),
        frontend_dir: config.frontend_dir.clone(),
    };

    // 6. 启动 Odoo Bus 轮询任务
    tokio::spawn(ws::poll_odoo_bus(
        state.http_client.clone(),
        config.odoo_url.clone(),
        event_tx,
    ));

    // 7. 构建路由
    let app = Router::new()
        // 健康检查
        .route("/health", get(|| async { "ok" }))
        // Session 管理
        .route("/api/session", get(session::get_session_info))
        .route("/api/session/login", post(session::login))
        .route("/api/session/logout", post(session::logout))
        // JSON-RPC 透传
        .route("/api/odoo/{*path}", post(proxy::proxy_odoo))
        // WebSocket
        .route("/ws/events", get(ws::ws_events_handler))
        // oweb 静态文件 (SPA fallback)
        .fallback_service(
            ServeDir::new(&config.frontend_dir)
                .fallback(
                    ServeDir::new(&config.frontend_dir)
                        .append_index_html_on_directories(true)
                )
        )
        // CORS 全开放 (开发阶段)
        .layer(CorsLayer::permissive())
        .with_state(state);

    // 8. 启动服务器
    let addr = format!("{}:{}", config.host, config.port);
    info!("Listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    info!("Shutting down gracefully...");
}
```

### 4.3 关键设计：Cookie 透传

> **核心思路**：odoo-web-server 在浏览器与 Odoo 之间 **不加任何 session 存储**，仅做 HTTP Cookie header 的透明转发。

```
步骤 A — 登录:
  browser  POST /api/session/login { db, login, password }
    │       Cookie: (none)
    ▼
  Rust     POST http://odoo:8069/web/session/authenticate
    │       body: { jsonrpc, params: { db, login, password } }
    │       Cookie: (none)
    ▼
  Odoo     ←  200  { result: { uid: 2, ... } }
           ←  Set-Cookie: session_id=abc123
    │
  Rust     → browser:  { authenticated: true, uid: 2 }
           → Set-Cookie: session_id=abc123    (原样透传)

步骤 B — 后续请求:
  browser  POST /api/odoo/jsonrpc  { ... }
    │       Cookie: session_id=abc123
    ▼
  Rust     POST http://odoo:8069/jsonrpc  { ... }
           Cookie: session_id=abc123    (原样透传)
    ▼
  Odoo     ← 200 { result: [...] }               (session 识别成功)
```

---

## 五、子任务详细方案

### 5.1 任务 1.1：Rust Workspace 初始化

**工时**: 0.5 天

**产出**:
```
odooseek/
├── Cargo.toml              ← 新建 workspace root
├── rust-toolchain.toml     ← stable, edition 2024
├── .gitignore              ← 追加 target/
└── crates/
    ├── odoo-core/           ← 新建 lib crate
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs       ← 空模块导出
    │       ├── types.rs     ← JsonRpcRequest/Response, SessionInfo
    │       ├── error.rs     ← OdooError, OdooResult
    │       └── config.rs    ← ServerConfig
    └── odoo-web-server/    ← 新建 bin crate
        ├── Cargo.toml
        └── src/
            ├── main.rs       ← 入口 (仅 health endpoint)
            ├── proxy.rs      ← 占位
            ├── session.rs    ← 占位
            └── ws.rs         ← 占位
```

**执行步骤**:
1. `cargo init --lib crates/odoo-core`
2. `cargo init --bin crates/odoo-web-server`
3. 编写 `odoo-core/src/types.rs`（核心类型）
4. 编写 `odoo-core/src/error.rs`
5. 编写 `odoo-core/src/config.rs`
6. 编写 `odoo-web-server/src/main.rs`（最小 axum Router）
7. 配置 `rust-toolchain.toml`

**验收标准**:
```
cargo check --workspace          # 无错误
cargo fmt --check --all           # 无警告
cargo clippy --all-targets --no-deps  # 无 clippy 警告
curl localhost:3000               # 返回 oweb SPA (或 404 如果 frontend_dir 为空)
curl localhost:3000/health        # 返回 ok
```

### 5.2 任务 1.2：Axum 服务器骨架 + 静态文件

**工时**: 1 天

**产出**:
- `odoo-web-server/src/main.rs`：完整 Router 组装 + CLI + tracing + 优雅关闭
- `ServeDir` 静态文件服务（Serves oweb `dist/`）

**CLI 参数**（clap）:
```
--host        default "0.0.0.0"
--port        default 3000
--odoo-url    default "http://localhost:8069"
--odoo-db     (optional)
--frontend-dir  env FRONTEND_DIR, default "../apps/oweb/dist"
--log-level   env RUST_LOG, default "info"
```

**SPA fallback 逻辑**: `ServeDir` 的 fallback 应返回 `index.html`（支持客户端路由）

**参考**: `uncode-platform/src/main.rs` 的 `main()` 函数结构

**验收标准**:
```
# 1. 健康检查
curl localhost:3000/health
# → 200 OK

# 2. 静态文件
curl -s localhost:3000/ | head -3
# → <!doctype html><html lang="en">...

# 3. SPA fallback
curl localhost:3000/login
# → 返回 index.html (不是 404)

# 4. 环境变量
FRONTEND_DIR=/tmp PORT=9090 cargo run
# → 监听 9090, 从 /tmp 读取静态文件
```

### 5.3 任务 1.3：JSON-RPC 透传代理

**工时**: 1.5 天

**产出**: `odoo-web-server/src/proxy.rs`

**核心函数签名**:
```rust
/// POST /api/odoo/{*path}
///
/// 从浏览器接收 JSON-RPC 请求，原样转发到 Odoo，返回 Odoo 响应。
/// Cookie/Set-Cookie header 自动透传 (reqwest cookie_store).
pub async fn proxy_odoo(
    State(state): State<AppState>,
    Path(path): Path<String>,
    headers: HeaderMap,        // 读取 Cookie
    body: Bytes,                // JSON-RPC 请求体
) -> Result<impl IntoResponse, AppError> {
    let odoo_url = format!("{}/{}", state.odoo_url, path);

    let mut request = state.http_client
        .post(&odoo_url)
        .header("Content-Type", "application/json")
        .body(body);

    // 透传浏览器 Cookie 到 Odoo
    if let Some(cookie) = headers.get("cookie") {
        request = request.header("cookie", cookie);
    }

    let response = request.send().await?;

    // 构建 axum response，透传 Status Code + Set-Cookie
    // ...
}
```

**错误处理映射**:
| 场景 | axum 返回 | 前端处理 |
|------|-----------|----------|
| Odoo 不可达 | 502 Bad Gateway | 提示重试 |
| Odoo 返回错误 | 200 + JSON-RPC error | TanStack Query error 处理 |
| Odoo 超时 | 504 Gateway Timeout | 提示重试 |
| 请求格式错误 | 400 Bad Request | 显示错误信息 |

**参考**: `odoo-rust-mcp/src/odoo/legacy_client.rs` 的 `call()` 方法

**验收标准**:
```
# 1. 透传 JSON-RPC
curl -X POST localhost:3000/api/odoo/jsonrpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"service":"common","method":"version","args":[]},"id":1}'
# → Odoo 版本信息

# 2. 登录 + Cookie
curl -X POST localhost:3000/api/odoo/web/session/authenticate \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"jsonrpc":"2.0","method":"call","params":{"path":"/web/session/authenticate","kwargs":{"db":"postgres","login":"admin","password":"admin"}},"id":1}'
# → Set-Cookie: session_id=...
# → 后续请求 -b cookies.txt 可用

# 3. 错误透传
curl -X POST localhost:3000/api/odoo/jsonrpc \
  -d 'invalid json'
# → 200 + JSON-RPC error (来自 Odoo) 或 4xx
```

### 5.4 任务 1.4：Session 管理端点

**工时**: 1 天

**产出**: `odoo-web-server/src/session.rs`

**端点实现**:

```
GET /api/session
  → 调用 Odoo /web/session/get_session
  → 返回 { authenticated: bool, uid, username, db, sessionId }

POST /api/session/login
  body: { db, login, password }
  → 调用 Odoo /web/session/authenticate
  → 返回 SessionInfo + Set-Cookie

POST /api/session/logout
  → 调用 Odoo /web/session/destroy
  → 清除 Cookie
```

**关键实现**:

```rust
/// GET /api/session — 返回当前认证状态
pub async fn get_session_info(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SessionInfo>, AppError> {
    let odoo_url = format!("{}/web/session/get_session", state.odoo_url);
    let rpc = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "path": "/web/session/get_session",
            "kwargs": {}
        },
        "id": 1,
    });

    let mut req = state.http_client.post(&odoo_url).json(&rpc);
    if let Some(cookie) = headers.get("cookie") {
        req = req.header("cookie", cookie);
    }

    let resp = req.send().await?;
    let body: JsonRpcResponse = resp.json().await?;

    if let Some(result) = body.result {
        let info: SessionInfo = serde_json::from_value(result)?;
        return Ok(Json(info));
    }

    // 未认证或 session 过期
    Ok(Json(SessionInfo::anonymous()))
}
```

**参考**: `Rustdoo/odoo_web/src/sessions.rs` 的 SessionManager 模式

**验收标准**:
```
# 1. 未认证 → anonymous
curl localhost:3000/api/session
# → {"authenticated":false}

# 2. 登录 + 获取 session
curl -X POST localhost:3000/api/session/login \
  -H 'Content-Type: application/json' -c cookies.txt \
  -d '{"db":"postgres","login":"admin","password":"admin"}'
# → {"authenticated":true,"uid":2,...}

# 3. 使用 Cookie 获取 session
curl -b cookies.txt localhost:3000/api/session
# → {"authenticated":true,"uid":2,...}

# 4. 登出
curl -X POST localhost:3000/api/session/logout -b cookies.txt
# → {"authenticated":false}
```

### 5.5 任务 1.5：WebSocket 事件桥接

**工时**: 1.5 天

**产出**: `odoo-web-server/src/ws.rs`

**架构**: 一个 `tokio::spawn` 后台任务轮询 Odoo Bus，通过 `broadcast` channel 推送到所有 WebSocket 客户端。

```
后台任务 (spawn):
  loop {
    POST /web/bus/poll { channels: [...], last: counter, peers: [...] }
      ← { result: [...events...] }
    counter += events.len
    for event in events {
      event_tx.send(event)     // broadcast 到所有 WS 客户端
    }
    sleep(5s)                  // 避免频繁轮询
  }

WebSocket handler:
  GET /ws/events
    → 从 event_tx.subscribe() 订阅
    → loop { tx.send(rx.recv().await?) }   // 推送到浏览器
```

**参考**: `uncode-platform/src/main.rs` 的 `ws_events_handler` + `post_event`

**错误处理**:
- Odoo Bus 轮询失败 → tracing::warn，继续重试
- WebSocket 断开 → 自动取消订阅 (broadcast channel 丢弃无接收者的消息)
- 后台任务 panic → `tokio::spawn` 自动重启

**验收标准**:
```
# 1. 连接 WebSocket
wscat -c ws://localhost:3000/ws/events

# 2. 在 Odoo 中创建一条记录
→ wscat 终端收到 JSON 事件
  {"type":"record_created","model":"res.partner","id":42}

# 3. 多客户端
同时连接 2 个 wscat → 都收到相同事件
```

### 5.6 任务 1.6：Docker 编排更新

**工时**: 1 天

**产出**:
1. `docker/Dockerfile.rust` — 多阶段构建 (builder + runtime)
2. 更新 `docker/docker-compose.yml` — 新增 `server` 服务

**Dockerfile.rust**:
```dockerfile
# Stage 1: Build
FROM rust:1.91-slim-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates/ crates/
RUN cargo build --release -p odoo-web-server

# Stage 2: Runtime
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/odoo-web-server /usr/local/bin/
ENV FRONTEND_DIR=/app/dist
ENV ODOO_URL=http://web:8069
ENV RUST_LOG=info
EXPOSE 3000
CMD ["odoo-web-server"]
```

**docker-compose.yml 新增**:
```yaml
server:
  build:
    context: ..
    dockerfile: docker/Dockerfile.rust
  ports:
    - "3000:3000"
  environment:
    - ODOO_URL=http://web:8069
    - RUST_LOG=info
    - FRONTEND_DIR=/app/dist
  volumes:
    - ../apps/oweb/dist:/app/dist:ro
  depends_on:
    - web
  restart: unless-stopped
```

**过渡期共存方案**: `gateway` (Nginx :8080) 与 `server` (Rust :3000) 同时运行，逐步切换：

```
第一阶段 (当前):     oweb → Nginx :8080 → Odoo
第一阶段完成验收:     oweb → Rust :3000 → Odoo    (新端口)
第二阶段:             Nginx :8080 重定向到 Rust :3000
最终:                 移除 Nginx, Rust :3000 → 80
```

**验收标准**:
```
# 1. 构建并启动
docker compose up -d --build server

# 2. 服务健康
docker compose ps | grep server   # → Up
curl localhost:3000/health        # → ok

# 3. API 代理
curl -X POST localhost:3000/api/odoo/jsonrpc ...
# → Odoo 响应透传

# 4. oweb SPA
curl localhost:3000/ | head -3
# → <!doctype html><html lang="en">...
```

---

## 六、前端适配任务

| 任务 | 文件 | 变更 |
|------|------|------|
| API 端点切换 | `apps/oweb/src/lib/api.ts` | `RPC_URL` 从 `/api/odoo/jsonrpc` → `/api/odoo/jsonrpc` (不变，仍通过 Nginx 或 Rust) |
| Session SDK | `apps/oweb/src/lib/api.ts` | 新增 `getSessionInfo()` → `GET /api/session`; `login()` → `POST /api/session/login` |
| Vite 代理 | `apps/oweb/vite.config.ts` | 开发代理目标从 `localhost:8069` → `localhost:3000` |
| Dashboard 页 | `apps/oweb/src/routes/dashboard.tsx` | 改用 `GET /api/session` 获取认证状态 |
| Login 页 | `apps/oweb/src/routes/login.tsx` | 改用 `POST /api/session/login` 登录 |

---

## 七、开发顺序与依赖

```
Day 1-2     [1.1] Rust Workspace + 类型定义
              │
Day 2-3     [1.2] Axum 骨架 + 静态文件 ─────────────┐
              │                                     │
Day 3-5     [1.3] JSON-RPC 透传 ──────────────┐     │
              │                               │     │
Day 5-6     [1.4] Session 端点 ←── 依赖 1.3   │     │
              │                               │     │
Day 6-8     [1.5] WebSocket ←── 独立           │     │
              │                               │     │
Day 8-9     [1.6] Docker 编排 ←── 依赖 1.2    │     │
              │                                        │
Day 9-10    前端适配 ←── 依赖 1.4 + 1.5                │
              │
Day 10      集成测试 + 验收
```

**总计**: 10 个工作日（2 周）

---

## 八、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| `reqwest` cookie_store 在 Docker 环境下表现异常 | 中 | 高 | 备选方案：手动解析 Set-Cookie → Forward |
| Odoo Bus 轮询频率过高导致 Odoo 性能下降 | 低 | 中 | 默认 5s 间隔，可配置；超过 100 个客户端时考虑合并轮询 |
| SPA fallback 与 API 路由冲突 | 中 | 中 | API 路由使用明确前缀 `/api/`，SPA fallback 仅匹配未被路由捕获的请求 |
| rustls-tls 证书链问题 | 低 | 低 | 开发阶段使用 HTTP，生产阶段通过反向代理处理 HTTPS |

---

## 九、Phase 1 完成标准

```
[ ] cargo check --workspace           (零错误)
[ ] cargo fmt --check --all            (零警告)
[ ] cargo clippy --all-targets --no-deps  (零警告)
[ ] cargo build --workspace            (构建通过)
[ ] docker compose up -d server        (容器启动)
[ ] curl :3000/health → ok             (健康检查)
[ ] curl :3000/ → oweb SPA             (静态文件)
[ ] curl :3000/login → index.html      (SPA fallback)
[ ] curl -X POST :3000/api/odoo/jsonrpc → Odoo 响应    (JSON-RPC 透传)
[ ] curl :3000/api/session → anonymous  (未认证状态)
[ ] curl -X POST :3000/api/session/login → authenticated (登录)
[ ] wscat :3000/ws/events → 收到 Odoo Bus 事件 (WebSocket)
[ ] bun run build (oweb) → 零错误     (前端构建)
[ ] 前端 Dashboard 正确显示 session 信息
```

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**下一阶段**: 根据 Phase 1 验收结果制定 Phase 2 前端扩展计划
