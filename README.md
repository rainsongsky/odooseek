# OdooSeek

> 用现代 Web 技术重新定义 Odoo 的前端体验

OdooSeek 是一个基于 React + TypeScript + Rust 的 Odoo 19 CE 现代前端替代方案。它保留了 Odoo 的元数据驱动架构和业务逻辑，仅替换前端渲染层和通信中间件。

[OdooSeek 愿景](/VISION.pdf)

## 架构

```
oweb (React SPA :5173)
    │
    ├── REST / WebSocket ──→ odoo-web-server (Rust axum :3000)
    │                         ├── API 代理 (JSON-RPC 透传)
    │                         ├── 会话代理与验证
    │                         ├── WebSocket 事件桥接
    │                         └── 静态文件 Serve
    │                                   │
    │                    JSON-RPC ──→  Odoo 19.0 CE (:8069)
    │                                   ├── ORM / 业务逻辑
    │                                   ├── 工作流引擎
    │                                   └── Odoo Bus (事件总线)
    │
    └── /web/content/* ──→ Odoo 19.0 (附件/图片)
```

## 技术栈

| 层 | 技术 |
|---|------|
| **前端 (oweb)** | React 19, TypeScript 6, TanStack Router/Query, Vite 8, Tailwind CSS 4, Bun |
| **中间层 (odoo-web-server)** | Rust, axum, tokio, reqwest, tower-http |
| **后端** | Odoo 19 Community Edition, PostgreSQL 16 |

## 项目结构

```
odooseek/
├── apps/oweb/                  # 前端 SPA
│   ├── src/
│   │   ├── routes/             # TanStack Router 页面
│   │   ├── components/         # 共享组件 (Navbar, Dialog, ThemeToggle ...)
│   │   ├── views/              # Odoo 视图渲染引擎 (List/Form/Kanban/Graph/Pivot/Calendar)
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── lib/                # API SDK, XML 解析器, 类型定义
│   │   └── themes/             # 运行时主题引擎 (5 预设 + 8 强调色)
│   └── package.json
│
├── crates/
│   ├── odoo-web-server/        # Rust BFF 网关
│   └── odoo-core/              # 共享类型与工具
│
├── docker/                     # Docker 编排 (Odoo + PostgreSQL)
└── CLAUDE.md                   # 开发规范

> `docs/` 为本地设计文档目录（已 `.gitignore`），**不会**推送到 [GitHub 仓库](https://github.com/FDE-GROUP/odooseek)。
```

## 功能特性

### 视图引擎

基于 Odoo XML 视图声明的通用渲染引擎，支持字段元数据驱动的动态表单：

- **List 视图** — 分页、排序、行选择、装饰色、内联编辑
- **Form 视图** — 动态字段渲染、分组布局、Notebook 标签页、Button Box 智能按钮、Statusbar 可点击、键盘快捷键 (Ctrl+S/Esc)、离开保护、字段 Help Tooltip
- **Kanban 视图** — 分组拖拽、QWeb 模板 AST 解析、进度条
- **Graph 视图** — Bar/Line/Pie 图表 (Recharts)
- **Pivot 视图** — 数据透视表
- **Calendar 视图** — 日/周/月视图 (react-big-calendar)
- **Search 视图** — 过滤器、分组、收藏管理

### 导航与交互

- 动态菜单系统 (从 Odoo `ir.ui.menu` 加载)
- 应用切换器 (网格布局、搜索过滤、拖拽排序持久化)
- 命令面板 (Ctrl+K)
- 主题系统 (5 预设主题 + 8 强调色)
- 国际化 (use-intl)
- WebSocket 实时连接状态指示

### 后端

- JSON-RPC 代理到 Odoo
- Session Cookie 透传
- Odoo Bus → WebSocket 事件桥接
- 静态文件 Serve (生产环境)

## 快速开始

### 前置条件

- [Bun](https://bun.com) >= 1.3
- [Rust](https://rustup.rs) >= 1.91
- Docker & Docker Compose (运行 Odoo)
- Odoo 19 CE 实例运行在 `localhost:8069`

### 安装

```bash
git clone https://github.com/FDE-GROUP/odooseek.git
cd odooseek

# 安装前端依赖
cd apps/oweb && bun install && cd ../..

# 构建 Rust 中间层
cargo build
```

### 启动 Odoo (Docker)

```bash
# 启动 Odoo + PostgreSQL
bun run docker:up
```

### 开发

```bash
# 启动 Rust BFF (端口 3000)
bun run dev

# 另一个终端：启动前端 HMR (端口 5173)
bun run oweb:dev
```

浏览器访问 `http://localhost:5173`。

## 常用命令

### 前端

```bash
cd apps/oweb
bun run dev          # 开发服务器 (HMR)
bun run build        # 类型检查 + 生产构建
bun run test         # 运行测试 (Vitest)
bun run lint         # Biome lint
bun run format       # Biome 格式化
```

### 后端

```bash
cargo build --workspace          # 构建
cargo test --workspace           # 测试
cargo clippy --all-targets       # Lint
cargo fmt --check --all          # 格式检查
```

### 一键预检测

```bash
bun run precommit   # 运行完整 CI 检查 (格式 + Lint + 构建 + 测试)
```

## 测试

项目包含 342 个前端测试，覆盖核心模块：

- XML 视图解析器 (Form/List/Kanban/Graph/Pivot/Calendar/Search)
- 视图渲染器 (List/Form/Kanban/Graph)
- API SDK 与 Hooks
- 组件 (Dialog, Navbar, SearchBar, ThemeToggle)
- 菜单服务
- 工具函数

```bash
cd apps/oweb
bun run test           # 单次运行
bun run test:watch     # 监听模式
```

### E2E（Playwright）

覆盖 **login → 应用菜单 → list → form** 主链路（MVAM smoke）。需 **Odoo + BFF** 已运行；前端 dev server 可由 Playwright 自动启动。

```bash
# 1. 启动 Odoo（见 docker/README.md）
bun run docker:up

# 2. 启动 BFF（:3000）
bun run dev

# 3. 配置凭据并运行 E2E（Playwright 会读 e2e/.env.local，并自动起 Vite :5173）
cd apps/oweb
cp e2e/.env.example e2e/.env.local   # 首次：填入 E2E_DB / E2E_LOGIN / E2E_PASSWORD
bun run e2e:install                  # 首次安装 Chromium
# WSL/Linux 缺 libnspr4 等系统库（sudo 默认找不到 bunx，需保留 PATH 或用绝对路径）：
sudo env "PATH=$PATH" bunx playwright install-deps chromium
# 若仍失败，用 bun 绝对路径：sudo env "PATH=$HOME/.bun/bin:$PATH" bunx playwright install-deps chromium
bun run e2e

# 若已手动启动 oweb（:5173），可跳过 Playwright 的 webServer：
# E2E_SKIP_WEBSERVER=1 bun run e2e
```

CI：GitHub Actions **workflow_dispatch** 工作流 `E2E`（需配置 `E2E_DB`、`E2E_LOGIN`、`E2E_PASSWORD` secrets，并指向可访问的 Odoo 实例）。


详见 [CLAUDE.md](./CLAUDE.md)，核心要点：

- **GitHub Flow**: main ← PR ← feature-branch
- **分支命名**: `feat/N-desc`, `fix/N-desc`
- **提交格式**: `type: description (refs #N)`
- **文档语言**: 中文
- **CI 预检测**: 提交前必须本地通过 build + lint + test

## 许可证

MIT
