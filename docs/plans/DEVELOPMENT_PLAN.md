# OdooSeek 开发计划

> 基于 [VISION.md](../VISION.md) 的愿景，将"探寻 Odoo 最佳可能"的使命分解为可执行、可追踪的开发任务。
>
> **对接目标**：Odoo 19 Community Edition（源码 `~/EA/odoo`），JSON-RPC 协议，Session Cookie 认证。

---

## 一、总览

| 阶段 | 代号 | 工期 | 目标 |
|------|------|------|------|
| **Phase 0** | 地基 | ✅ 已完成 | Docker 基础设施 + oweb 脚手架 |
| **Phase 1** | 网关 | 2-3 周 | odoo-web-server Rust BFF 核心 |
| **Phase 2** | 视界 | 3-4 周 | 前端扩展：路由守卫、列表/表单、Bus 实时 |
| **Phase 3** | 疆域 | 8-12 周 | 业务模块：CRM → 销售 → 库存 → 会计 |
| **Phase 4** | 磐石 | 2-3 周 | 生产就绪：测试、文档、CI/CD、k8s |

---

## 二、Phase 0：地基 ✅

### 已完成

| 任务 | 产出 | 状态 |
|------|------|:----:|
| Docker Odoo 19.0 镜像 | `docker/19.0/Dockerfile` + entrypoint | ✅ |
| PostgreSQL 16 + Nginx + pgAdmin | `docker/docker-compose.yml` 4 服务编排 | ✅ |
| oweb 项目脚手架 | React 19 + TypeScript 6 + Vite 8 + TanStack Router | ✅ |
| Odoo JSON-RPC SDK | `apps/oweb/src/lib/api.ts` | ✅ |
| 运行时主题引擎 | 5 预设 + 8 强调色 + localStorage | ✅ |
| 核心路由 (4 条) | `/`, `/login`, `/dashboard`, `/settings` | ✅ |
| 懒加载 + Code Splitting | 3 条 lazy load, 主包 100KB gzip | ✅ |
| 生产构建 + 部署 | 254ms Vite build → Nginx 静态 serve | ✅ |
| WSL 部署教程 | `docker/WSL_部署实操教程.md` | ✅ |
| VISION.md | 项目愿景、技术选型、架构设计 | ✅ |
| 开源参考分析 | `odoo-rust-mcp` + `Rustdoo` 评估 | ✅ |

### 交付标准

- [x] `docker compose up -d` 一键启动全部 4 个服务
- [x] `http://localhost:8080` 可访问 oweb SPA
- [x] `bun run build` 零错误零警告
- [x] 文档齐备（VISION / WSL 教程 / AGENTS）

---

## 三、Phase 1：网关 — odoo-web-server

> 详细技术方案：[PHASE1_TECHNICAL_DESIGN.md](./PHASE1_TECHNICAL_DESIGN.md)

### 目标

构建 Rust axum BFF 服务器替换 Nginx 直连方案，实现：
- 前端 → odoo-web-server → Odoo 的三层架构
- Session Cookie 透传替代前端直连 Odoo JSON-RPC
- WebSocket 实时事件通道

### 任务清单

#### 1.1 Rust Workspace 初始化

**产出**：`Cargo.toml` + `crates/odoo-web-server/` + `crates/odoo-core/`

```
odooseek/
├── Cargo.toml              # workspace root
├── rust-toolchain.toml     # stable, edition 2024
└── crates/
    ├── odoo-core/          # 共享类型 (lib)
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── types.rs    # OdooSession, OdooError, JsonRpcRequest/Response
    │       └── config.rs   # 配置加载
    └── odoo-web-server/   # axum 服务 (bin)
        ├── Cargo.toml
        └── src/
            ├── main.rs     # entry point
            ├── router.rs   # axum Router
            ├── proxy.rs    # JSON-RPC 透传 handler
            ├── session.rs  # Session Cookie 代理
            └── static.rs   # 静态文件 serve
```

**依赖**：参照 `uncode-platform/Cargo.toml` + `odoo-rust-mcp/Cargo.toml`

**验收**：
- [ ] `cargo check --workspace` 通过
- [ ] `cargo fmt --check --all` 通过
- [ ] `cargo clippy --all-targets --no-deps` 通过

#### 1.2 Axum HTTP 服务器骨架

**产出**：
```rust
// crates/odoo-web-server/src/main.rs
#[tokio::main]
async fn main() {
    tracing_subscriber::init();
    let app = Router::new()
        .route("/health", get(health))
        .nest("/api", api_routes())
        .fallback_service(static_files());
    axum::serve(listener, app).await.unwrap();
}
```

**路由规划**：

| 路由 | 处理层 | 说明 |
|------|--------|------|
| `GET /health` | 直返 | 健康检查 |
| `POST /api/odoo/*path` | proxy | JSON-RPC 透传到 Odoo `:8069` |
| `GET /api/session` | session | 返回当前 session 信息 |
| `POST /api/session/login` | session | 登录（转发到 Odoo auth） |
| `POST /api/session/logout` | session | 登出 |
| `GET /ws/events` | websocket | Odoo Bus 事件流 |
| `GET /{fallback}` | static | oweb SPA 静态文件 |

**参考**：`uncode/crates/uncode-platform/src/main.rs`

**验收**：
- [ ] `curl localhost:3000/health` → 200
- [ ] `curl -X POST localhost:3000/api/odoo/jsonrpc ...` → Odoo 响应透传

#### 1.3 JSON-RPC 透传代理

**产出**：`crates/odoo-web-server/src/proxy.rs`

```
Browser (oweb)
  │  POST /api/odoo/jsonrpc
  │  Cookie: session_id=xxx
  ▼
odoo-web-server (:3000)
  │  reqwest POST http://web:8069/jsonrpc
  │  Cookie: session_id=xxx (透传)
  ▼
Odoo 19.0 (:8069)
```

**核心逻辑**：
- 读取请求中的 `Cookie` header
- 用 `reqwest` 转发 JSON-RPC 请求到 Odoo
- 将 Odoo 的 `Set-Cookie` 返回给浏览器
- 请求/响应日志 (tracing)

**验收**：
- [ ] 登录流程走通：POST `/api/odoo/web/session/authenticate` → Set-Cookie
- [ ] 后续请求携带 Cookie → Odoo 正确识别 session

#### 1.4 Session 管理模块

**产出**：`crates/odoo-core/src/session.rs`

```rust
pub struct OdooSession {
    pub uid: i64,
    pub session_id: String,
    pub username: String,
    pub db: String,
    pub user_context: HashMap<String, Value>,
}

pub async fn get_session(client: &reqwest::Client, odoo_url: &str, cookie: &str)
    -> Result<OdooSession, Error>;
```

**验收**：
- [ ] `GET /api/session` → 返回 `{ uid, username, db, session_id }`
- [ ] 未认证时返回 `{ authenticated: false }`

#### 1.5 WebSocket 事件桥接

**产出**：`crates/odoo-web-server/src/ws.rs`

```
OdooBus (:8069)                    odoo-web-server (:3000)          oweb (Browser)
  │                                    │                              │
  │  POST /web/bus/poll               │                              │
  │  ← 事件列表 (last=0)              │                              │
  │                                    │  tokio::sync::broadcast      │
  │                                    │  ← 写入 channel              │
  │                                    │                              │
  │                                    │  GET /ws/events              │
  │                                    │  → WS 推送 ──────────→       │  onmessage
```

**核心逻辑**：
- 启动一个 `tokio::spawn` 后台任务，每 5 秒轮询 Odoo Bus
- 事件写入 `tokio::sync::broadcast::Sender`
- WebSocket handler 从 `Receiver` 读取并推送到客户端

**参考**：`uncode/crates/uncode-platform/src/main.rs` 的 `ws_events_handler`

**验收**：
- [ ] 在 Odoo 中创建一条记录 → WSL console 打印事件
- [ ] `wscat -c ws://localhost:3000/ws/events` 收到 JSON 事件

#### 1.6 Docker 编排更新

**产出**：`docker/docker-compose.yml` 新增 `server` 服务

```yaml
server:
  build:
    context: ..
    dockerfile: docker/Dockerfile.rust
  ports:
    - "3000:3000"
  environment:
    - ODOO_URL=http://web:8069
    - ODOO_PORT=3000
    - RUST_LOG=info
    - FRONTEND_DIR=/app/dist
  volumes:
    - ../apps/oweb/dist:/app/dist:ro
  depends_on:
    - web
```

**验收**：
- [ ] `docker compose up -d` 启动 odoo-web-server
- [ ] `curl localhost:3000/` 返回 oweb SPA
- [ ] `curl -X POST localhost:3000/api/odoo/jsonrpc` 代理成功

---

## 四、Phase 2：视界 — 前端扩展

### 目标

从"可运行的脚手架"升级为"可交付的 Odoo 前端基础框架"：
- 认证状态感知的路由守卫
- 通用 Odoo 列表/表单组件
- WebSocket 实时事件显示
- 搜索/过滤/排序基础设施

### 任务清单

#### 2.1 路由守卫

**产出**：`apps/oweb/src/router/guards.ts`

```typescript
// 未登录 → 重定向到 /login
// 已登录 → 正常渲染
// 登录成功后 → 重定向到 /dashboard
```

**依赖**：Phase 1 的 `/api/session` 端点

**验收**：
- [ ] 未登录访问 `/dashboard` → 自动跳转 `/login`
- [ ] 登录成功 → 自动跳转 `/dashboard`

#### 2.2 通用列表组件 (OdooListView)

**产出**：`apps/oweb/src/components/OdooListView.tsx`

```typescript
<OdooListView
  model="res.partner"
  fields={["name", "email", "phone", "company_id"]}
  domain={[["is_company", "=", true]]}
  limit={80}
/>
```

**功能**：
- `useQuery` 调用 `searchRead` 加载数据
- 可排序列 (点击列头排序)
- 分页 (offset/limit)
- 选中行高亮
- 加载态 Skeleton / 空态提示 / 错误重试

**验收**：
- [ ] 列表正确渲染 Odoo 数据
- [ ] 点击列头切换升序/降序
- [ ] 翻页加载新数据

#### 2.3 通用表单组件 (OdooFormView)

**产出**：`apps/oweb/src/components/OdooFormView.tsx`

**功能**：
- 读取模式 (read) 和编辑模式 (write)
- 字段类型分发：char → input, text → textarea, selection → select, boolean → checkbox
- `useMutation` 调用 write
- 乐观更新支持

**验收**：
- [ ] 表单正确渲染 Odoo 记录
- [ ] 编辑后保存 → Odoo 数据更新

#### 2.4 WebSocket 事件面板

**产出**：`apps/oweb/src/hooks/useOdooBus.ts`

**功能**：
- 连接到 `ws://localhost:3000/ws/events`
- 将事件分类显示 (模型变更 / 通知 / 工作流)
- `useQueryClient.invalidateQueries` 自动刷新相关列表

**验收**：
- [ ] 在 Odoo 中修改数据 → oweb 列表自动刷新

#### 2.5 搜索栏组件

**产出**：`apps/oweb/src/components/SearchBar.tsx`

**功能**：
- 模型级搜索 (按 name 过滤)
- 高级搜索 (domain 数组编辑)
- 与 OdooListView 联动

---

## 五、Phase 3：疆域 — 业务模块

### 目标

实现四大核心 ERP 模块的前端：CRM → 销售 → 库存 → 会计。

每个模块按以下模式开发：

```
apps/oweb/src/modules/{module}/
├── routes.ts          # TanStack Router 子路由
├── {model}/
│   ├── types.ts       # 模型 TypeScript 类型
│   ├── ListView.tsx   # 列表页
│   ├── FormView.tsx   # 表单页
│   └── queries.ts     # TanStack Query hooks
└── components/
    └── {feature}.tsx
```

### 3.1 CRM 模块

| 页面 | 路由 | Odoo Model | 复杂度 |
|------|------|------------|--------|
| 线索看板 | `/crm/leads` | `crm.lead` | 中 |
| 商机管道 | `/crm/pipeline` | `crm.lead` (按 stage 分组) | 高 |
| 活动列表 | `/crm/activities` | `mail.activity` | 低 |
| 商机详情 | `/crm/lead/$id` | `crm.lead` | 中 |

**Kanban 组件**：`apps/oweb/src/components/OdooKanbanView.tsx`
- 按 stage 分组渲染卡片
- 拖拽移动阶段的乐观更新
- 卡片显示：名称、金额、优先级、预期成交日期

**参考**：`Rustdoo/crates/odoo_crm/src/models/crm_lead.rs`

### 3.2 销售模块

| 页面 | 路由 | Odoo Model | 复杂度 |
|------|------|------------|--------|
| 报价单列表 | `/sale/quotations` | `sale.order` | 中 |
| 销售订单列表 | `/sale/orders` | `sale.order` | 中 |
| 订单详情 | `/sale/order/$id` | `sale.order` + `sale.order.line` | 高 |
| 产品列表 | `/sale/products` | `product.product` | 低 |

**订单明细表**（嵌套表单）：
- 主信息区：客户、日期、状态
- 明细行表：产品、数量、单价、小计、税金
- 汇总区：未税金额、税额、总计

### 3.3 库存模块

| 页面 | 路由 | Odoo Model | 复杂度 |
|------|------|------------|--------|
| 库存概览 | `/inventory/` | `stock.quant` + `product.product` | 中 |
| 调拨单列表 | `/inventory/pickings` | `stock.picking` | 中 |
| 盘点列表 | `/inventory/inventories` | `stock.inventory` | 低 |

### 3.4 会计模块

| 页面 | 路由 | Odoo Model | 复杂度 |
|------|------|------------|--------|
| 会计分录 | `/accounting/moves` | `account.move` | 高 |
| 凭证详情 | `/accounting/move/$id` | `account.move` + `account.move.line` | 高 |
| 科目余额表 | `/accounting/trial-balance` | 聚合查询 | 中 |

---

## 六、Phase 4：磐石 — 生产就绪

### 目标

从"功能可用"到"生产可靠"。

### 任务清单

#### 4.1 测试覆盖

| 层级 | 工具 | 目标 |
|------|------|------|
| 前端单元测试 | Vitest | 核心 hooks + API SDK > 80% |
| 前端组件测试 | React Testing Library | OdooListView / OdooFormView |
| Rust 单元测试 | `#[tokio::test]` | Session / Proxy 模块 |
| Rust 集成测试 | axum-test | 完整请求链路 |
| E2E | (Planning) | Playwright 关键用户路径 |

#### 4.2 CI/CD

```yaml
# .github/workflows/ci.yml
jobs:
  frontend:
    - bun install
    - bun run lint
    - bun run build
    - bun test
  backend:
    - cargo fmt --check
    - cargo clippy --no-deps
    - cargo build --workspace
    - cargo test --workspace
```

#### 4.3 文档

| 文档 | 内容 |
|------|------|
| `docs/API.md` | odoo-web-server REST 端点文档 |
| `docs/ARCHITECTURE.md` | 架构决策记录 (ADR) |
| `docs/MODULE_GUIDE.md` | 如何创建一个新的业务模块 |
| Storybook | 共享组件文档 |

#### 4.4 部署简化

- [ ] 单命令 `make dev` 启动完整开发环境
- [ ] `make prod` 启动生产环境 (关闭 debug)
- [ ] Kubernetes Helm chart (后续)

---

## 七、依赖关系图

```
Phase 0 ✅ (地基)
    │
    ▼
Phase 1 (网关)
    ├── 1.1 Rust Workspace
    │       │
    ├── 1.2 Axum 骨架 ──→ 1.3 JSON-RPC 透传 ──→ 1.6 Docker 编排
    │       │
    ├── 1.4 Session 管理 ──────────────────────────┐
    │       │                                      │
    └── 1.5 WebSocket 桥接 ────────────────────────┤
            │                                      │
            ▼                                      ▼
Phase 2 (视界)                              Phase 1. 验收完成
    ├── 2.1 路由守卫 ←── 依赖 1.4                    │
    ├── 2.2 通用列表                                    │
    ├── 2.3 通用表单                                    │
    ├── 2.4 WebSocket 面板 ←── 依赖 1.5                │
    └── 2.5 搜索栏                                      │
            │                                           │
            ▼                                           ▼
Phase 3 (疆域)                                Phase 2. 验收完成
    ├── 3.1 CRM                                        │
    ├── 3.2 销售                                        │
    ├── 3.3 库存                                        │
    └── 3.4 会计                                        │
            │
            ▼
Phase 4 (磐石)
    ├── 4.1 测试覆盖
    ├── 4.2 CI/CD
    ├── 4.3 文档
    └── 4.4 部署简化
```

---

## 八、Issue 创建指南

每个 Phase 中的任务应创建对应的 GitHub Issue，格式：

```
标题：[Phase N] 任务描述
标签：enhancement / bug / documentation
正文：
  - 产出文件列表
  - 验收标准 (checkbox)
  - 关联 PR (后续填写)
```

**第一批 Issues（Phase 1 启动）**：

1. `[Phase 1] 初始化 Rust workspace + odoo-core crate`
2. `[Phase 1] 构建 axum 服务器骨架 + /health 端点`
3. `[Phase 1] 实现 JSON-RPC 透传代理 (/api/odoo/*)`
4. `[Phase 1] 实现 Session Cookie 透传与验证`
5. `[Phase 1] 实现 Odoo Bus → WebSocket 事件桥接`
6. `[Phase 1] 更新 docker-compose.yml 集成 Rust server`

---

## 九、当前进度

```
Phase 0 ████████████████████ 100% (2026-05-28)
Phase 1 ░░░░░░░░░░░░░░░░░░░░   0%
Phase 2 ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3 ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4 ░░░░░░░░░░░░░░░░░░░░   0%
```

---

**文档版本**: 1.1  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
