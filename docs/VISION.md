# OdooSeek 项目愿景文档

> 用现代 Web 技术重新定义 Odoo 的前端体验

---

## 一、项目命名

**OdooSeek** — `odoo` + `seek`，意为"探寻 Odoo 的最佳可能"。  
前端代号 **oweb** — `odoo` + `web`，代表新生的 Odoo Web 客户端。  
服务端代号 **odoo-web-server** — Rust 构建的中间层网关，连接前端与 Odoo。

---

## 二、缘起：为什么要做这个项目？

### Odoo 前端的现实困境

Odoo 是全球领先的开源 ERP 系统，但其前端技术栈长期滞后于现代 Web 开发潮流：

| 现状 | 痛点 |
|------|------|
| **OWL (Odoo Web Library)** | 自研框架，生态孤立，社区资源匮乏 |
| **服务端渲染 (QWeb)** | 前后端强耦合，无法独立部署和迭代 |
| **jQuery 遗留代码** | 大量旧代码混杂，维护成本高 |
| **模块加载机制** | 基于 `require.js` 的 bundle 机制，不支持现代 Tree Shaking、Code Splitting |
| **开发体验** | 无 HMR、构建缓慢、调试困难 |
| **人才壁垒** | 开发者需同时掌握 Python/Odoo + OWL，招聘困难 |

### 我们的回应

**OdooSeek 是一个大胆的命题**：

> 如果 Odoo 的前端可以独立于服务端、采用主流技术栈、拥有现代开发体验，它会长什么样？

答案就是 **oweb** — 一个基于 React + TypeScript + Bun + TanStack/Router + Rust BFF 的 Odoo 前端重构项目。

### 服务端架构：两段式后端

本项目采用 **前后端分离 + 两段式服务端** 架构，区别于传统 Odoo 单体部署：

```
oweb (React SPA)
    │
    ├── REST / WebSocket ──→ odoo-web-server (Rust axum :3000)
    │                         ├── API 聚合 / BFF
    │                         ├── 会话代理与验证
    │                         ├── WebSocket 事件桥接
    │                         ├── 直读 PostgreSQL 高性能查询
    │                         ├── 响应缓存与格式变换
    │                         └── 生产环境静态文件 serve
    │                                   │
    │                    JSON-RPC ──→  Odoo 19.0 (:8069)
    │                                   │
    │                                   ├── ORM / Business Logic
    │                                   ├── Workflows / Reports
    │                                   └── Odoo Bus (事件总线)
    │
    └── /web/content/* ──→ Odoo 19.0 (附件/图片下载)
```

| 组件 | 技术栈 | 职责 |
|------|--------|------|
| **oweb** | React + TypeScript + Vite + TanStack | 用户界面，纯静态 SPA |
| **odoo-web-server** | Rust + axum + tokio + reqwest | API 网关/BFF，前后端之间的智能中间层 |
| **Odoo 19.0** | Python + PostgreSQL | 业务逻辑核心，ORM，工作流引擎 |

---

## 三、使命宣言

> **让 Odoo 拥有世界级的前端体验，降低 ERP 定制化的技术与人才门槛。**

我们将：

1. **解耦前后端** — 前端作为独立 SPA，通过 Rust BFF 与 Odoo JSON-RPC API 通信
2. **拥抱主流生态** — 使用 React、TypeScript、TanStack（前端）+ Rust/axum（中间层）
3. **追求极致 DX** — Bun 极速构建、Vite HMR、TypeScript 全覆盖、Rust 零成本抽象
4. **开放与包容** — 任何前端/后端开发者都能参与贡献，无需了解 Odoo 全套技术栈

---

## 四、技术选型

### 前端技术栈（oweb）

```
┌──────────────────────────────────────────────────┐
│                    oweb 前端                       │
├──────────────────────────────────────────────────┤
│  运行时         Bun (JavaScript/TypeScript 运行时)│
│  UI 框架        React 19                          │
│  类型系统        TypeScript 6 (strict mode)       │
│  路由            TanStack Router (类型安全路由)    │
│  状态管理        TanStack Query (服务端状态)       │
│                 Zustand (客户端状态)              │
│  构建工具        Vite 8                           │
│  样式方案        Tailwind CSS 4                   │
│  测试            Vitest + React Testing Library   │
│  API 通信        REST / WebSocket (到 Rust BFF)   │
└──────────────────────────────────────────────────┘
```

### 中间层技术栈（odoo-web-server）

```
┌──────────────────────────────────────────────────┐
│              odoo-web-server (Rust)               │
├──────────────────────────────────────────────────┤
│  异步运行时      Tokio                             │
│  HTTP 框架      Axum                              │
│  中间件          Tower HTTP (CORS, 静态文件, 日志) │
│  WebSocket      Axum + tokio::sync::broadcast     │
│  数据库直连      sqlx / tokio-postgres            │
│  Odoo RPC       Reqwest (HTTP JSON-RPC 客户端)    │
│  Session 管理    Cookie 透传 + Odoo session 验证  │
│  缓存            moka / dashmap (内存缓存)         │
│  序列化          Serde JSON                       │
└──────────────────────────────────────────────────┘
```

### 选型理由

#### Bun → 替代 Node.js

| 维度 | Node.js | Bun |
|------|---------|-----|
| 包管理 | npm/yarn/pnpm | 原生内置，快 25x |
| 启动速度 | ~200ms | ~30ms |
| TypeScript | 需 ts-node/tsx | 原生支持 |
| 测试 | 需 Jest/Vitest | 内置 `bun test` |
| 兼容性 | Node.js API | 完全兼容 |

选择 Bun 作为运行时的核心理由：**极致的开发体验**。从 `bun install` 到 `bun dev` 到 `bun test`，一条命令无需任何配置文件。

#### React 19 → UI 框架

- 全球最大的前端生态，人才池最广
- **React Server Components** 虽未直接使用，但 React 19 的并发特性为未来扩展留足空间
- 与 TanStack 生态完美配合

#### TanStack Router → 路由

- **类型安全是第一公民**：URL 参数、Search Params、Route Context 全程类型推断
- 支持嵌套路由、Layout Routes、路由级数据预加载（Loader）
- 比 React Router v6 更现代的设计哲学，与 TanStack Query 深度集成

#### TanStack Query → 服务端状态

- 将 Odoo 的 `search_read`、`read`、`write` 等 JSON-RPC 调用封装为声明式 Query/Mutation
- 内置缓存、后台刷新、乐观更新、分页/无限滚动
- 消除前端手工管理 loading/error/data 状态的样板代码

#### Vite → 构建工具

- 开发环境下秒级 HMR（热模块替换）
- 生产环境下基于 Rollup 的高效构建
- 与 Bun 配合使用极致加速

#### odoo-web-server → BFF 中间层

选择 Rust + Axum 构建中间层的核心理由：

| 职责 | 说明 |
|------|------|
| **API 聚合** | 将前端多次 Odoo JSON-RPC 调用合并为单次 REST 请求，减少网络往返 |
| **会话代理** | 前端请求 → Rust 验证 Odoo session → 转发到 Odoo，前端无需直连 Odoo |
| **WebSocket 桥接** | 接收 Odoo Bus 事件，转为标准 WebSocket 推送给 oweb |
| **高性能直读** | 对仪表盘统计等性能敏感查询，Rust 直连 PostgreSQL，绕过 Odoo ORM |
| **响应缓存** | 菜单树、模型元数据、用户信息等低变更数据缓存到内存，加速渲染 |
| **格式变换** | 将 Odoo 的 `[id, name]` 数组格式转为前端友好的 `{id, name}` JSON |
| **类型同步** | Rust struct → Serde JSON ↔ TypeScript interface，编译期保证契约一致 |

> 要点：odoo-web-server 是 **增强层而非替代层** — Odoo 仍然是业务核心，Rust 负责"让前端更高效地与 Odoo 对话"。

---

## 五、架构设计

### 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户浏览器                                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     oweb (React SPA)                             │ │
│  │                                                                  │ │
│  │  TanStack Router ──→ Pages ──→ Components                       │ │
│  │       │                           │                              │ │
│  │  TanStack Query              UI Layer                            │ │
│  │       │                           │                              │ │
│  │  ┌────▼────┐              ┌───────▼───────┐                     │ │
│  │  │ API SDK │              │  Zustand      │                     │ │
│  │  │ (REST + │              │  (client      │                     │ │
│  │  │  WS)    │              │   state)      │                     │ │
│  │  └────┬────┘              └───────────────┘                     │ │
│  └───────┼─────────────────────────────────────────────────────────┘ │
│          │                                                            │
│          │ REST / WebSocket                                           │
│          │ credentials: "include"                                     │
│          ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                odoo-web-server (Rust axum :3000)                │ │
│  │                                                                  │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐    │ │
│  │  │ Session   │ │ API       │ │ WebSocket │ │ Static       │    │ │
│  │  │ Proxy     │ │ Aggregator│ │ Bridge    │ │ File Serve   │    │ │
│  │  │ (/api/auth)│ │ (/api/v1) │ │ (/ws)     │ │ (oweb dist)  │    │ │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────────────┘    │ │
│  │        │             │             │                              │ │
│  │        │  ┌──────────▼──────────┐  │                              │ │
│  │        │  │     Cache Layer     │  │                              │ │
│  │        │  │  (Menu / Metadata)  │  │                              │ │
│  │        │  └──────────┬──────────┘  │                              │ │
│  │        │             │             │                              │ │
│  └────────┼─────────────┼─────────────┼──────────────────────────────┘ │
│           │             │             │                                 │
│           │   JSON-RPC  │   Bus 轮询  │  SQL 直连                       │
│           ▼             ▼             ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     Odoo 19.0 Server                             │ │
│  │                     (Docker Container :8069)                      │ │
│  │                                                                  │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │ │
│  │  │ JSON-RPC  │  │ ORM       │  │ Odoo Bus  │                   │ │
│  │  │ API       │  │           │  │ (Events)  │                   │ │
│  │  └───────────┘  └─────┬─────┘  └───────────┘                   │ │
│  │                       │                                          │ │
│  └───────────────────────┼──────────────────────────────────────────┘ │
│                          │                                             │
│                          ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     PostgreSQL 16 (:5432)                         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 核心设计原则

#### 1. 前后端彻底解耦

- oweb 是**纯静态 SPA**，构建产物可以部署到任何 Web 服务器（Nginx、CDN、S3）
- 与 Odoo 通信仅通过标准 HTTP 协议（JSON-RPC），不依赖 Odoo 模板引擎或 QWeb
- 可以连接任意版本的 Odoo（14/15/16/17/18/19），只需实现对应的 JSON-RPC Adapter

#### 2. 类型安全贯穿全栈

```
Odoo Model (Python)          oweb (TypeScript)
───────────────────          ──────────────────
res.partner                  PartnerModel
  name: Char       ──→        name: string
  email: Char      ──→        email: string
  phone: Char      ──→        phone: string
  company_id: M2O  ──→        company_id: [number, string]
```

- 为每个 Odoo Model 定义 TypeScript 类型接口
- TanStack Router 的 Search Params 类型化，防止 URL 参数拼写错误
- 从 JSON-RPC 响应中自动推断类型，IDE 智能提示覆盖所有 API 调用

### 项目结构

```
odooseek/
├── apps/
│   └── oweb/                    # 前端 SPA (React + TypeScript + Vite)
│       ├── src/
│       │   ├── routes/          # TanStack Router 页面
│       │   ├── components/      # 共享组件
│       │   ├── lib/             # API SDK + 工具库
│       │   └── themes/          # 运行时主题引擎
│       └── dist/                # Vite 构建产物
│
├── crates/                      # Rust Workspace
│   ├── odoo-web-server/        # axum HTTP/WebSocket 服务端 (BFF)
│   │   └── src/main.rs
│   └── odoo-core/               # 共享类型: Session / Model / JSON-RPC
│       └── src/lib.rs
│
├── docker/
│   ├── docker-compose.yml       # 统一编排 (oweb + Rust + Odoo + PG)
│   ├── nginx/                   # 过渡期反向代理 (Rust server 就绪后可移除)
│   └── 19.0/                    # Odoo 19.0 镜像构建
│
└── docs/
    └── VISION.md                # 本文档
```

前端源码树（`apps/oweb/src/`）：

```
├── routes/             # 页面路由（TanStack Router）
│   ├── __root.tsx      # 根布局 (Navbar + Outlet)
│   ├── home.tsx        # 首页
│   ├── login.tsx       # Odoo 登录
│   ├── dashboard.tsx   # 会话仪表盘
│   └── settings.tsx    # 设置
├── components/         # 共享组件
│   ├── ErrorBoundary.tsx
│   ├── Navbar.tsx
│   └── ThemeToggle.tsx
├── lib/                # 核心库
│   ├── api.ts          # HTTP Client (REST to odoo-web-server)
│   └── lucide-icons.tsx
├── themes/             # 运行时主题引擎 (5 预设 + 8 强调色)
├── router.tsx          # TanStack Router 路由树
├── types.ts            # Odoo Model 类型定义
├── main.tsx            # React 入口
└── index.css           # Tailwind v4 + 主题变量

(规划中：)
├── modules/            # 业务模块（按 Odoo App 划分）
│   ├── sale/           # 销售模块
│   ├── crm/            # CRM 模块
│   └── ...
└── router/
    └── guards.ts       # 路由守卫（认证、权限）
```

#### 4. 开发体验优先

```bash
bun dev                    # 启动开发服务器，HMR 秒级更新
bun test --watch           # 监听模式运行测试
bun run build              # 生产构建，产物输出到 dist/
bun lint                   # Biome 格式化和 Lint
bun typecheck              # TypeScript 类型检查
```

- Vite 开发服务器代理 `/api/odoo` 到本地 Docker Odoo 实例
- 无需在 WSL 中安装任何东西，Bun 跨平台兼容
- 一个命令启动完整开发环境

---

## 六、开发路线图

### 第一阶段：核心基建（MVP）

| 任务 | 产出 |
|------|------|
| oweb 项目脚手架 | React 19 + TypeScript 6 + Vite 8 + TanStack Router + Tailwind 4 |
| 前端 RPC SDK | `lib/api.ts`: authenticate / searchRead / getSession / destroySession |
| 主题系统 | 5 预设 + 8 强调色, ThemeContext + localStorage 持久化 |
| 核心路由 | `/`, `/login`, `/dashboard`, `/settings`, 懒加载 + Code Splitting |
| odoo-web-server 骨架 | Rust workspace + axum 路由 + Tower 中间件 |
| Session 代理 | Rust → Odoo session 验证 + Cookie 透传 |
| JSON-RPC 透传 | `/api/odoo/*` 路由代理到 Odoo :8069 |
| Odoo Bus 桥接 | Rust 轮询 Odoo Bus → WebSocket 推送到 oweb |
| Docker 编排 | docker-compose.yml 整合 oweb + Rust + Odoo + PostgreSQL |

### 第二阶段：功能模块

| 模块 | 覆盖范围 |
|------|----------|
| 销售 (Sale) | 报价单、销售订单、产品管理 |
| CRM | 商机管道、活动管理、客户 360 |
| 库存 (Inventory) | 库存盘点、出入库、批次追踪 |
| 会计 (Accounting) | 发票、凭证、科目余额表 |

### 第三阶段：体验增强

- PWA 离线支持
- 键盘快捷导航（已实现基础版本）
- 实时通知（Odoo Bus + WebSocket）
- 国际化（i18n）
- 通用列表/表单 Odoo View 渲染引擎

---

## 七、为什么这个项目值得做？

### 对 Odoo 生态的价值

1. **降低 Odoo 前端定制的技术门槛** — React/TypeScript 开发者无需学习 OWL 即可贡献
2. **提升 Odoo 的集成能力** — 标准 SPA 架构易于嵌入其他系统或被其他系统嵌入
3. **加速 Odoo 的现代化** — 社区的创新可以反哺 Odoo 官方前端演进

### 对开发者的价值

1. **技能可迁移** — 项目中获得的 React/TypeScript/TanStack 经验可应用于任何现代 Web 项目
2. **参与开源 ERP** — 以前端角度参与 ERP 开发，打破"ERP 开发必须懂后端"的刻板印象
3. **高质量的代码实践** — 项目坚持类型安全、自动化测试、代码审查，是学习工程最佳实践的绝佳场域

### 对企业的价值

1. **快速定制** — 成熟的 React 生态意味着成百上千可直接复用的 UI 组件
2. **降低运维成本** — 前后端独立部署，前端可以部署到 CDN
3. **人才易得** — 招聘 React 开发者远比招聘 Odoo OWL 开发者容易

---

## 八、协作与贡献

### 项目原则

- **代码即文档** — 自解释的变量和函数命名，超过 3 行的逻辑必有注释
- **类型即边界** — 所有跨模块接口必须有 TypeScript 类型定义
- **组件即故事** — 每个共享组件附带 Storybook 文档
- **测试即信心** — 核心逻辑覆盖率 > 80%

### 当前状态（2026-05）

```
✅ Docker 基础设施就绪         (odoo:19.0 镜像 + PostgreSQL 16 + Nginx)
✅ oweb 项目脚手架              (bun + Vite 8 + React 19 + TypeScript 6 + TanStack Router)
✅ Odoo RPC SDK                (lib/api.ts: authenticate / searchRead / getSession / destroySession)
✅ 核心路由 + 懒加载            (4 路由 + 3 条 lazy load, 主包 100KB gzip)
✅ 运行时主题引擎               (5 预设 + 8 强调色, localStorage 持久化)
✅ 生产构建部署                 (254ms 构建, Nginx 静态资源 + /api/odoo 代理已启用)
✅ 两段式后端架构设计完成       (oweb → odoo-web-server → Odoo → PostgreSQL)
✅ API 代理链路验证通过         (Nginx → Odoo JSON-RPC 往返 < 50ms)
⏳ odoo-web-server 搭建       (Rust workspace + axum 骨架)
⏳ Session 代理                (Rust session 验证 + Cookie 透传)
⏳ Odoo Bus → WebSocket 桥接   (实时通知)
⏳ 路由守卫                     (认证/权限拦截)
⏳ 首个业务模块                 (CRM/销售)
```

---

## 九、开源参考项目分析

在构建 `odoo-web-server` 之前，我们调研了两个与"Rust + Odoo"相关的开源项目，评估其可复用价值。

### 参考项目概览

| 项目 | 定位 | 规模 | 许可证 | 可编译 |
|------|------|------|--------|--------|
| [odoo-rust-mcp](https://github.com/rachmataditiya/odoo-rust-mcp) | MCP 工具服务器 (面向 AI Agent) | v0.3.31, 271 commits | AGPL-3.0 | ✅ |
| **Rustdoo** (`odoo-rust`) | Odoo ERP 完整 Rust 重写 | 53 crates, ~186K LOC, 751 .rs 文件 | LGPL-3.0 | ❌ |

---

### 9.1 odoo-rust-mcp

**定位**: 为 Cursor/Claude Desktop 等 AI 助手提供 MCP 协议的工具服务器，通过标准化协议暴露 Odoo CRUD 操作。

**优势**:

| 维度 | 说明 |
|------|------|
| 工程成熟度 | CI/CD + codecov + 多平台安装包 (Homebrew/APT/Docker/K8s/Helm) |
| 多传输协议 | stdio / Streamable HTTP / SSE / WebSocket 全覆盖 |
| Odoo 兼容 | 双模式：Odoo 19+ (JSON-2 API Key) 和 Odoo < 19 (JSON-RPC user/pass) |
| 配置热更新 | `tools.json` / `prompts.json` 声明式定义 + 文件监听自动重载 |
| 代码分层 | `src/odoo/` (Odoo 客户端) / `src/mcp/` (协议层) / `src/config_manager/` (配置) |
| 多实例 | 通过 `instances.json` 管理多 Odoo 环境 |
| 测试 | wiremock 模拟 Odoo + axum-test 集成测试 |

**对 odoo-web-server 的参考价值**:

| 文件/模块 | 参考点 | 用途 |
|-----------|--------|------|
| `src/odoo/` (Odoo 客户端) | JSON-RPC + JSON-2 API 封装、session 管理、元数据缓存 | odoo-web-server 的 Odoo 连接层 |
| Cargo.toml 依赖 | `reqwest` + `serde_json` + `base64` + `tokio` + `tracing` | 项目依赖配置 |
| axum 多传输模式 | HTTP/WebSocket 端口绑定 + 服务发现 | 服务器启动骨架 |
| Config Manager | JSON 文件热重载 + REST API 配置管理 | 配置管理模块 |

**不适用点**: MCP 的"工具语义"与 BFF 的"聚合 API 语义"是两种不同的抽象，整体架构需独立设计。

---

### 9.2 Rustdoo (`odoo-rust`)

**定位**: Odoo ERP 的完整 Rust 重写，目标是与 Python 版保持 100% API 兼容。

**规模**:

| 指标 | 值 |
|------|-----|
| workspace crates | 53 个 |
| 有实质实现的 crate (>500 LOC) | 34 个 |
| 空壳 crate (声明但无实现) | 20 个 |
| 最大模块 | `odoo_sale` 19.5K LOC / `odoo_account` 19.1K LOC / `odoo_web` 14.9K LOC |

**核心架构**:

```
crates/odoo_server/src/main.rs    axum HTTP 服务器入口 (5.2K LOC)
crates/odoo_web/src/server.rs     Web 框架配置 + 静态文件 (375行)
crates/odoo_web/src/sessions.rs   Session 生命周期 + Cookie 处理
crates/odoo_api/src/jsonrpc.rs    Odoo JSON-RPC 调用封装
crates/odoo_api/src/rest.rs       REST API 端点设计
crates/odoo_api/src/xmlrpc.rs     XML-RPC 兼容支持
crates/odoo_orm/                  ORM 引擎 + 迁移 + 查询 (6K LOC)
crates/odoo_auth/                  认证/权限/OAuth (3.5K LOC)
crates/odoo_security/              安全框架 (7.9K LOC)
```

**业务模型完备性** (示例):

```
odoo_crm/src/models/crm_lead.rs           CRM 线索模型 (1368行)
  - CrmLeadType (Lead/Opportunity)
  - CrmLeadPriority (Low/Normal/High/VeryHigh)
  - CrmLeadStage, CrmLeadActivity
  - 完整字段定义 + SQL 操作 + 状态转换逻辑

odoo_account/src/models/account_move_line.rs   会计分录行 (881行)
  - AccountMoveLineStatus (Draft/Posted/Cancelled)
  - 52+ 字段 (debit/credit/balance/amount_residual/...)
  - 完整 Serde Serialize/Deserialize
```

**对 odoo-web-server 的参考价值**:

| 模块 | 复用方式 | 具体内容 |
|------|----------|----------|
| `odoo_web/src/server.rs` | 直接参考 | ServerConfig (host/port/workers/timeout), 请求处理流程, 静态文件目录 |
| `odoo_web/src/sessions.rs` | 直接参考 | Session 创建/销毁/验证, Cookie 注入/解析, 超时管理 |
| `odoo_server/src/main.rs` | 直接参考 | axum Router 组织, tracing 初始化, 优雅关闭 (signal handling), 配置加载 |
| `odoo_api/src/jsonrpc.rs` | 参考 + 提取 | JSON-RPC `call_kw` 参数构造, 响应解析, 错误映射 |
| `odoo_orm/src/queries/` | 参考 | PostgreSQL 直连查询模式, sqlx 参数绑定 |
| 业务模型类型定义 | 参考 | CRM/Account/Sale 的 Rust struct 定义 |

**局限性**: 53 个 crate 中有 20 个声明了 `src/bin/main.rs` 但文件不存在，导致 `cargo build --workspace` 失败；根 package 引用 `src/lib.rs` 但文件缺失。适合作为"参考图书馆"查阅，不适合直接引入为依赖。

---

### 9.3 odoo-web-server 构建路线（基于参考分析）

```
第一阶段：骨架
  ┌─ 参照 uncode/crates/uncode-platform/src/main.rs ──→ axum 启动 + 路由组织
  ├─ 参照 odoo-rust-mcp/src/odoo/ ──→ Odoo JSON-RPC 客户端
  └─ 参照 uncode-platform Cargo.toml ──→ 依赖版本锁定

第二阶段：Session 代理
  ┌─ 参照 Rustdoo/odoo_web/src/sessions.rs ──→ Session 生命周期
  ├─ 参照 Rustdoo/odoo_web/src/server.rs ──→ Cookie 注入/解析
  └─ 参照 odoo-rust-mcp 的 instance 配置 ──→ Odoo 连接管理

第三阶段：API 聚合
  ┌─ 参照 Rustdoo/odoo_api/src/jsonrpc.rs ──→ JSON-RPC 调用封装
  ├─ 参照 Rustdoo 业务模型 struct ──→ REST 响应格式设计
  └─ 参照 uncode-platform REST 端点模式 ──→ /api/session, /api/dashboard, /api/menu

第四阶段：高性能扩展
  ├─ 参照 Rustdoo/odoo_orm/src/queries/ ──→ sqlx 直连 PostgreSQL
  └─ 参照 odoo-rust-mcp 元数据缓存 ──→ 内存缓存层 (moka/dashmap)
```

---

## 十、命名释义

| 名称 | 含义 |
|------|------|
| **OdooSeek** | 探寻 Odoo 技术边界的旅程 (Seek = 追寻、探索) |
| **oweb** | Odoo Web 的重新诠释，既是 `odoo + web` 也是 `our web` |
| **odoo-web-server** | Rust 构建的中间层 BFF，连接 oweb 与 Odoo 的智能网关 |

---

> *"我们不是在逃离 Odoo，而是在拓宽它的边界。"*  
> *— OdooSeek 团队*

---

**文档版本**: 1.3  
**更新日期**: 2026-05-28  
**维护团队**: OdooSeek
