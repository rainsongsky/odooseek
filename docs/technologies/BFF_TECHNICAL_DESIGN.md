# odoo-web-server 技术设计文档

> **版本**: 2.1  
> **日期**: 2026-05-31  
> **定位**: Odoo 19 CE 的 Rust BFF (Backend For Frontend) 网关

---

## 一、设计目标

### 1.1 核心定位

`odoo-web-server` 是位于浏览器与 Odoo 服务端之间的**智能中间层**，不是 Odoo 的替代品。它的设计哲学是：

> **增强而非替代** — Odoo 保持业务逻辑核心地位，BFF 负责让前端更高效地与 Odoo 对话。

```
┌──────────┐         ┌─────────────────┐         ┌──────────────┐
│   oweb   │──REST──→│ odoo-web-server │──RPC───→│ Odoo 19 CE   │
│ (React)  │←──WS───│   (Rust/axum)   │←──WS───│ (:8069)      │
└──────────┘         └─────────────────┘         └──────────────┘
                                                     │
                                                ┌────▼────┐
                                                │  PG 16  │
                                                └─────────┘
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **透明代理** | JSON-RPC 请求原样转发，不修改语义 |
| **Cookie 透传** | 每个请求独立转发浏览器 Cookie，无共享会话存储 |
| **零状态** | 不维护用户会话，支持水平扩展 |
| **压缩在前** | BFF 层统一 gzip/brotli 压缩，避免 Odoo 的 Python 压缩开销 |
| **缓存分层** | 读请求 (fields_get/get_views) 内存缓存，写请求直通 |
| **安全优先** | 路径穿越防护、CORS 显式白名单、安全头转发 |

---

## 二、架构概览

### 2.1 模块结构

```
crates/
├── odoo-core/                    # 共享类型库 (lib)
│   ├── config.rs                 # ServerConfig (env-based)
│   ├── error.rs                  # OdooError (thiserror 枚举)
│   └── types.rs                  # SessionInfo, LoginRequest, JsonRpcRequest
│
└── odoo-web-server/              # axum 服务 (bin)
    ├── main.rs                   # 入口：CLI、路由、优雅关闭
    ├── proxy.rs                  # 三层代理 (JSON-RPC / HTTP / Image)
    ├── session.rs                # 会话管理 (6 端点)
    ├── menu.rs                   # 菜单代理 (load_menus)
    ├── report.rs                 # 报表代理 (PDF + Barcode)
    ├── ws.rs                     # WebSocket 桥接 (WS → broadcast)
    ├── cache.rs                  # 响应缓存层 (TTL-based)
    ├── error.rs                  # AppError (axum IntoResponse)
    └── helpers.rs                # SessionInfo 解析、Set-Cookie 转发
```

### 2.2 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|------|------|------|
| 异步运行时 | `tokio` | 1.x (full) | 事件循环 + 线程池 |
| HTTP 框架 | `axum` | 0.8 | 路由、中间件、WebSocket |
| HTTP 客户端 | `reqwest` | 0.12 | Odoo JSON-RPC 调用 |
| WebSocket 客户端 | `tokio-tungstenite` | 0.24 | Odoo Bus 实时连接 |
| 压缩 | `tower-http` | 0.6 | gzip/brotli 响应压缩 |
| 序列化 | `serde` / `serde_json` | 1.x | JSON 请求/响应 |
| 错误处理 | `thiserror` | 2.x | 类型安全错误传播 |
| CLI | `clap` | 4.x | 命令行参数和环境变量 |
| URL | `url` | 2.x | 查询字符串编码 |

### 2.3 数据流

```
浏览器                     BFF (:3000)                Odoo (:8069)
──────                     ────────────                ───────────
│                            │                            │
│ POST /api/session/login    │                            │
│ {db, login, password}      │                            │
│──────────────────────────→│                            │
│                            │ POST /web/session/         │
│                            │   authenticate             │
│                            │ {db, login, password}      │
│                            │───────────────────────────→│
│                            │                            │
│                            │ ← 200 {uid, name, ...}     │
│                            │   Set-Cookie: session_id   │
│ ← 200 {authenticated:true} │                            │
│   Set-Cookie: session_id   │                            │
│                            │                            │
│ GET /api/session           │                            │
│ Cookie: session_id         │                            │
│──────────────────────────→│                            │
│                            │ POST /web/session/         │
│                            │   get_session_info         │
│                            │ Cookie: session_id         │
│                            │───────────────────────────→│
│ ← SessionInfo JSON         │                            │
│                            │                            │
│ POST /api/odoo/web/         │                            │
│   dataset/call_kw           │                            │
│ {model,method,args,kwargs}  │                            │
│──────────────────────────→│                            │
│                            │ [Cache Check]              │
│                            │ POST /web/dataset/call_kw  │
│                            │───────────────────────────→│
│                            │ ← 200 {result: [...]}      │
│                            │ [Cache Store]              │
│ ← 200 {result: [...]}      │                            │
```

---

## 三、端点全景

### 3.1 会话管理

| 端点 | 方法 | 认证 | 说明 |
|------|------|:--:|------|
| `/api/session` | GET | ✅ | 当前会话信息 |
| `/api/session/login` | POST | ❌ | 登录 |
| `/api/session/logout` | POST | ✅ | 登出 |
| `/api/session/languages` | GET | ❌ | 已安装语言列表 |
| `/api/session/modules` | GET | ✅ | 已安装模块名列表 |
| `/api/session/check` | GET | ✅ | 会话存活检查 → `{"ok":true/false}` |

### 3.2 数据代理

| 端点 | 方法 | 认证 | 说明 |
|------|------|:--:|------|
| `/api/odoo/{*path}` | POST | ✅ | JSON-RPC 代理（带缓存） |
| `/api/odoo-http/{*path}` | ANY | 取决于端点 | HTTP 代理（保留方法/Content-Type） |

### 3.3 资源服务

| 端点 | 方法 | 认证 | 说明 |
|------|------|:--:|------|
| `/api/menus` | GET | ✅ | 完整菜单树 (load_menus) |
| `/api/menu` | GET | ✅ | 根菜单（旧版兼容） |
| `/api/logo` | GET | ❌ | 公司 Logo 图片 |
| `/api/translations` | GET | ❌ | 翻译资源 |
| `/api/web/image/{*path}` | GET | 取决于端点 | 图片代理 |
| `/api/web/content/{*path}` | GET | ✅ | 文件/附件下载 |

### 3.4 报表

| 端点 | 方法 | 认证 | 说明 |
|------|------|:--:|------|
| `/api/report/download` | GET | ✅ | 报表下载 (PDF/Text/HTML/XLSX) |
| `/api/report/barcode/{*path}` | GET | ❌ | 条码/二维码生成 |

### 3.5 实时通信

| 端点 | 协议 | 说明 |
|------|------|------|
| `/ws/events` | WebSocket | Odoo Bus 事件桥接 |
| `/health` | HTTP GET | 健康检查 |

---

## 四、核心能力

### 4.1 JSON-RPC 代理 (`proxy.rs`)

**功能**：透明转发 JSON-RPC 请求到 Odoo，原样返回响应。

**缓存策略**：

| 方法 | TTL | 缓存键 |
|------|-----|--------|
| `fields_get` | 24h | `model:method:args_hash` |
| `get_views` | 1h | `model:method:args_hash` |
| `name_search` | 5min | `model:method:args_hash` |
| `search_panel_select_*` | 30s | `model:method:args_hash` |
| `read`/`search_read` | 15s | `model:method:args_hash` |
| 写操作 | 不缓存 | — |

缓存键包含 model + method + args (截断 200 字符)。60s 定时清除过期条目。

**安全防护**：
- 路径穿越检测 (`..` 和 `\0`)
- 请求方法隔离（JSON-RPC → POST only，HTTP → Any）
- 响应头转发白名单：`Content-Type`, `Content-Disposition`, `Cache-Control`, `ETag`, `Set-Cookie`, `X-Frame-Options`, `CSP`, `HSTS`
- 排除 `Content-Encoding` 防止双压缩

### 4.2 WebSocket 桥接 (`ws.rs`)

**双模式架构**：

```
优先级 1: tokio-tungstenite → ws://odoo:8069/websocket (实时)
优先级 2: HTTP polling → /websocket/peek_notifications (5s 间隔)
```

- 连接断开自动重连（5s 延迟）
- 事件通过 `tokio::sync::broadcast` 分发给所有浏览器客户端
- 浏览器断开自动退订

### 4.3 会话管理 (`session.rs`)

**认证流程**：
1. `login` → 转发 credentials 到 Odoo，返回 SessionInfo + Set-Cookie
2. `get_session_info` → 读取当前 Cookie 对应的会话状态
3. `logout` → 销毁 Odoo 会话 + 返回匿名 SessionInfo
4. `check` → 轻量级存活检测，返回 `{"ok": true/false}`
5. `languages` → 已安装语言列表
6. `modules` → 已安装模块名列表（需认证）

**Session 增强 (v2.1)**：
`GET /api/session` 在用户已认证时自动注入缓存的菜单数据：

```json
{
  "result": {
    "uid": 2,
    "name": "Mitchell Admin",
    ...
    "menus": {
      "apps": [
        {"id": 1, "name": "Sales", "webIconData": "...", "actionID": 123},
        {"id": 2, "name": "CRM", "webIconData": "...", "actionID": 42}
      ]
    }
  }
}
```

- 菜单数据通过内部调用 `load_menus` 获取，缓存于 BFF 内存
- 缓存 TTL: 与 `load_menus` 相同（1h）
- 效果：前端初始加载从 3 次往返（session + menus + data）减少到 1 次

### 4.4 菜单服务 (`menu.rs`)

调用 Odoo 的 `/web/webclient/load_menus?unique=1` 返回完整菜单树：
- 扁平 dict 结构，含 root 顶层应用列表
- 每个菜单：id, name, children, appID, xmlid, actionID, actionModel, webIconData
- 302 重定向 → 401 (未认证)

### 4.5 报表代理 (`report.rs`)

**两阶段流程**：
1. 读取 `ir.actions.report` 获取 `report_name` 和 `report_type`
2. 代理到 Odoo 的 `/report/{type}/{name}/{ids}` 端点

支持格式：`pdf`, `text`, `html`, `xlsx`。条码通过 `/report/barcode/{type}/{value}` 单独路由。

### 4.6 响应缓存 (`cache.rs`)

- 基于 `tokio::sync::RwLock<HashMap>` 的内存缓存
- TTL 按端点类型差异化
- 60s 后台任务自动回收过期条目
- 仅缓存成功的 JSON-RPC 响应（HTTP 200 + 有效 JSON）
- 缓存键 = `model:method:args_hash`（args 截断 200 字符）

**TTL 策略**：

| 方法 | TTL | 说明 |
|------|-----|------|
| `fields_get` | 24h | 字段定义仅在模块升级时变更 |
| `get_views` | 1h | 视图定义变更频率低 |
| `load_menus` | 1h | 菜单变更通过模块操作触发 |
| `name_search` / `web_name_search` | 5min | 数据可能变更 |
| `search_panel_select_*` | 30s | 分类计数器需较新鲜 |
| `read` / `search_read` | 15s | 短缓存减轻列表刷新负载 |
| 写操作 (create/write/unlink) | 不缓存 | 直接代理 |

**缓存架构**：请求到达 → 解析 model/method/args → 命中缓存返回（<1ms），未命中代理到 Odoo → 成功存入缓存。

---

### 4.7 Session 增强 (`session.rs` v2.1)

`GET /api/session` 在用户已认证时自动注入缓存的菜单数据，避免前端二次请求 `GET /api/menus`：

```json
{
  "result": {
    "uid": 2,
    "name": "Mitchell Admin",
    "menus": {
      "apps": [
        {"id": 1, "name": "Sales", "webIconData": "...", "actionID": 123}
      ]
    }
  }
}
```

- 菜单数据内部调用 `load_menus` 获取，TTL 1h
- 效果：初始加载从 3 次往返（session + menus + data）减少到 1–2 次

---

## 五、能力边界

### 5.1 不包含的功能

| 功能 | 原因 |
|------|------|
| 数据库直连 (sqlx) | 保持单一数据源原则，Odoo 是唯一的业务逻辑入口 |
| OAuth2 / SSO | SPA 自行处理 OAuth 流程 |
| 文件上传 | 通过通用 HTTP 代理透传，不解析 multipart |
| 数据库管理 (create/backup/restore) | 运维层面，超出 BFF 职责 |
| OWL/QWeb 模板渲染 | 前端接管，BFF 只做数据代理 |
| CSRF token 自动注入 | 仅代理，由 Odoo 自行验证 |
| 速率限制 | 可外挂 `tower::limit`，BFF 不自带 |

### 5.2 已知局限

| 局限 | 影响 | 缓解 |
|------|------|------|
| 无请求体大小限制 | DOS 风险 | 可配置 `axum::DefaultBodyLimit` |
| 无认证中间件 | 依赖 Odoo 下游验证 | 未来可加 `axum::middleware` |
| 缓存不可持久化 | 重启后缓存清空 | 冷启动增加 Odoo 负载 |
| WebSocket 单向（Odoo→浏览器） | 浏览器无法向 Odoo 发送消息 | 浏览器通过 REST 发送 |
| 测试覆盖率低 (~3%) | 重构风险 | 需要补全集成测试 |

### 5.3 扩展点

| 扩展 | 方案 |
|------|------|
| 速率限制 | `tower::limit::RateLimitLayer` 包裹登录路由 |
| 请求体限制 | `axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024)` |
| 持久化缓存 | 替换 `HashMap` 为 `moka::sync::Cache` |
| 双向 WebSocket | 浏览器 → BFF → Odoo WS 双向转发 |
| 认证中间件 | `axum::middleware::from_fn` 校验 session 后路由 |

---

## 六、配置与部署

### 6.1 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `3000` | 监听端口 |
| `ODOO_URL` | `http://localhost:8069` | Odoo 服务地址 |
| `ODOO_DB` | (空) | 默认数据库 |
| `FRONTEND_DIR` | `../apps/oweb/dist` | SPA 静态文件目录 |

### 6.2 运行

```bash
# 开发模式
cargo run -p odoo-web-server

# 生产构建
cargo build --release -p odoo-web-server
./target/release/odoo-web-server

# Docker
docker compose -f docker/docker-compose.yml up -d --build server
```

### 6.3 健康检查

```bash
curl http://localhost:3000/health
# → ok
```

---

## 七、错误处理模型

### 7.1 错误类型

| OdooError | HTTP Status | 说明 |
|-----------|:----------:|------|
| `Http` / `Unreachable` | `502` | Odoo 不可达 |
| `NotAuthenticated` | `401` | 未登录 |
| `Api { code: 100 }` | `401` | Session 过期 |
| `Api { code: N }` | `200` | Odoo 业务错误（JSON-RPC 格式） |
| `Config` / 其他 | `500` | 服务端配置错误 |

### 7.2 错误传播

```
reqwest::Error → OdooError::Http → AppError → axum Response
serde_json::Error → OdooError::Deserialization → AppError → axum Response
Odoo API error → OdooError::Api → AppError → JSON-RPC error response
```

---

## 八、性能特征

| 指标 | 值 | 说明 |
|------|:--:|------|
| 静态文件吞吐 | ~5 Gbps | `tower-http::ServeDir` |
| JSON-RPC 延迟（缓存命中） | <1ms | 内存查找 |
| JSON-RPC 延迟（缓存未命中） | ~50ms | Odoo 往返 |
| 并发连接 | 10K+ | tokio 多线程 |
| 内存占用（空闲） | ~10 MB | 不含缓存 |
| WebSocket 通知延迟 | ~0ms (WS), ~5s (fallback) | — |

---

## 九、依赖关系

```
Cargo.toml (workspace)
├── tokio 1.x (full)          — 异步运行时
├── axum 0.8 (ws)             — HTTP/WS 框架
├── reqwest 0.12               — HTTP 客户端
│   ├── json                   — JSON 序列化
│   ├── cookies                — Cookie 自动管理
│   └── rustls-tls             — TLS 支持
├── tower-http 0.6             — 压缩 + CORS + 静态文件
├── tokio-tungstenite 0.24     — WebSocket 客户端
├── serde 1.x / serde_json 1.x — 序列化
├── thiserror 2.x              — 错误派生
├── clap 4.x                   — CLI
├── url 2.x                    — URL 编码
├── tracing 0.1                — 日志
└── anyhow 1.x                 — 错误传播 (main)
```

---

## 十、安全审查清单

| 检查项 | 状态 | 说明 |
|--------|:--:|------|
| 路径穿越防护 (`..` / `\0`) | ✅ | `build_odoo_url` 验证 |
| CORS 显式白名单 (无 `*` + credentials) | ✅ | localhost:5173/3000 |
| Cookie 逐请求透传 (无共享) | ✅ | `get_cookie_header` 按请求提取 |
| 安全头转发 (X-Frame-Options, CSP, HSTS) | ✅ | `matches_proxy_header` 白名单 |
| 双压缩防护 (跳过 Content-Encoding) | ✅ | `proxy_send` 排除该头 |
| Session 过期 → 401 (code 100) | ✅ | `error.rs` 状态码映射 |
| JSON-RPC 错误格式标准 | ✅ | `Api` 错误返回 `{jsonrpc, error, id}` |
| TLS 支持 (rustls) | ✅ | reqwest `rustls-tls` feature |
| 错误不泄露堆栈信息 | ✅ | AppError 仅暴露 `message` |
| 速率限制 | ❌ | 待添加 `tower::limit` |
| 请求体大小限制 | ❌ | 待添加 `DefaultBodyLimit` |
| CSRF token 自动注入 | ❌ | JSON-RPC 端点无需 CSRF；HTTP 代理透传

---

**文档版本**: 2.1  
**创建日期**: 2026-05-31  
**更新日期**: 2026-05-31  
**维护团队**: OdooSeek

---

## 附录 A：Odoo 源文件映射

BFF 每个端点对应 Odoo 19 CE 源码中的具体模块和函数。

### A.1 端点 → Odoo 源文件

| BFF 端点 | 方法 | Odoo 源文件 | 类 / 函数 |
|----------|:--:|-------------|-----------|
| `/api/session` | GET | `odoo/addons/web/controllers/session.py` | `Session.get_session_info()` |
| `/api/session/login` | POST | `odoo/addons/web/controllers/session.py` | `Session.authenticate()` |
| `/api/session/logout` | POST | `odoo/addons/web/controllers/session.py` | `Session.destroy()` |
| `/api/session/languages` | GET | `odoo/addons/web/controllers/session.py` | `Session.get_lang_list()` |
| `/api/session/modules` | GET | `odoo/addons/web/controllers/session.py` | `Session.modules()` |
| `/api/session/check` | GET | `odoo/addons/web/controllers/session.py` | `Session.check()` |
| `/api/menus` | GET | `odoo/addons/web/controllers/webclient.py` | `WebClient.load_menus()` |
| `/api/translations` | GET | `odoo/addons/web/controllers/webclient.py` | `WebClient.translations()` |
| `/api/odoo/{*path}` | POST | `odoo/addons/web/controllers/dataset.py` | `DataSet.call_kw()` / `call_button()` |
| `/api/odoo-http/{*path}` | ANY | 通用路由 | 透传任意 `@http.route` 注册的 handler |
| `/api/web/image/{*path}` | GET | `odoo/addons/web/controllers/binary.py` | `Binary.image()` |
| `/api/web/content/{*path}` | GET | `odoo/addons/web/controllers/binary.py` | `Binary.content_*()` |
| `/api/logo` | GET | `odoo/addons/web/controllers/binary.py` | `Binary.company_logo()` |
| `/api/report/download` | GET | `odoo/addons/web/controllers/report.py` | `Report.report_routes()` |
| `/api/report/barcode/{*path}` | GET | `odoo/addons/web/controllers/report.py` | `Report.barcode()` |
| `/ws/events` | WS | `odoo/addons/bus/` + `odoo/addons/web/controllers/websocket.py` | Bus 模块事件轮询/WS |

### A.2 通过 JSON-RPC 代理使用的端点

以下端点不通过专用路由，而是由前端通过 `/api/odoo/{*path}` 代理调用：

| 前端调用 | Odoo 端点 | Odoo 源文件 |
|----------|-----------|-------------|
| `callKw('ir.actions.act_window', 'read', ...)` | `/web/dataset/call_kw` | `controllers/dataset.py:DataSet.call_kw()` |
| `callButton(model, method, ...)` | `/web/dataset/call_button` | `controllers/dataset.py:DataSet.call_button()` |
| `loadAction('action_id')` | `/web/action/load` | `controllers/action.py:Action.load()` |
| `resolveAction(id)` → server action | `/web/action/run` | `controllers/action.py:Action.run()` |
| `generateReport(id, ids)` | `ir.actions.report` → `/report/pdf/...` | `controllers/report.py:Report` |

### A.3 通过 HTTP 代理使用的端点

以下端点通过 `/api/odoo-http/{*path}` 代理调用，保留原始 HTTP 方法和 Content-Type：

| 用途 | 代理路径 | Odoo 源文件 |
|------|----------|-------------|
| 文件上传 | `/api/odoo-http/web/binary/upload_attachment` | `controllers/binary.py:Binary.upload_attachment()` |
| CSV 导出 | `/api/odoo-http/web/export/csv` | `controllers/export.py:Export.csv()` |
| XLSX 导出 | `/api/odoo-http/web/export/xlsx` | `controllers/export.py:Export.xlsx()` |
| CSV 导入 | `/api/odoo-http/base_import/set_file` | `base_import` addon |
| 邮件附件上传 | `/api/odoo-http/mail/attachment/upload` | `mail` addon |

### A.4 Odoo 核心控制器模块总览

```
odoo/addons/web/controllers/
├── session.py        ← 用户认证与会话管理 (6 端点, auth=user/none)
├── dataset.py        ← 数据 CRUD 操作 (JSON-RPC, call_kw/call_button)
├── binary.py         ← 文件/图片静态资源服务 (4 handler)
├── report.py         ← 报表生成与条码 (2 handler)
├── webclient.py      ← WebClient 配置 (菜单、翻译)
├── websocket.py      ← WebSocket 事件 (peek_notifications)
├── action.py         ← Action 加载与执行 (load/run)
├── export.py         ← 数据导出 (csv/xlsx)
├── main.py           ← 首页/登录/数据库管理等 HTML 页面
├── database.py       ← 数据库管理 (create/backup/restore/duplicate)
└── home.py           ← Odoo 首页路由

odoo/addons/bus/      ← 实时事件总线 (WebSocket 推送)
```

**总计**：BFF 对接 Odoo 的 **9 个控制器模块** + `bus` 事件模块，覆盖 **16 个专用端点** + **2 个通用代理端点**。
