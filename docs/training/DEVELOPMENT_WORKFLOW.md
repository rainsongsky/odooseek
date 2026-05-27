# OdooSeek 开发工作流培训教程

> 面向新加入项目的开发者，了解开发环境、工具链和日常开发流程。

---

## 一、项目概述

OdooSeek 是一个 Odoo 19 CE 的现代化前端重构项目，采用 Strangler Fig 模式逐层替换 Odoo 原生前端。

```
前端层:  oweb (React + TypeScript + Vite + TanStack)
中间层:  odoo-web-server (Rust + axum, BFF 网关)
业务层:  Odoo 19 CE (Python, 保留不变)
数据层:  PostgreSQL 16 (保留不变)
```

**核心哲学**: 保留 Odoo 的元数据驱动架构（`ir.ui.view`、`ir.model`、`ir.actions.*`），仅替换前端渲染和通信层。

**参考文档**:
- `docs/VISION.md` — 项目愿景、技术选型、架构设计
- `docs/plans/PHASE1_TECHNICAL_DESIGN.md` — 已完成的 BFF 网关技术方案
- `docs/plans/PHASE2_TECHNICAL_DESIGN.md` — 进行中的视图引擎方案
- `docs/reserch/odoo.md` — Odoo 架构哲学分析

---

## 二、环境准备

### 2.1 必备工具

| 工具 | 最低版本 | 用途 |
|------|----------|------|
| **Docker Desktop** | 24+ | 本地 Odoo + PostgreSQL + Rust server 容器化运行 |
| **Docker Compose** | 2.0+ | 多服务编排 |
| **Bun** | 1.3+ | 前端包管理、构建、测试 |
| **Rust** | 1.91+ (stable) | 后端 BFF 编译 |
| **Git** | 2.40+ | 版本控制 |
| **GitHub CLI** (`gh`) | 2.0+ | Issue/PR 管理 |

### 2.2 快捷安装

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Bun
curl -fsSL https://bun.sh/install | bash

# GitHub CLI (Ubuntu)
sudo apt install gh
```

### 2.3 克隆项目

```bash
git clone git@github.com:HL8-ORG/odooseek.git
cd odooseek
```

### 2.4 启动开发环境

```bash
# 首次启动（构建所有镜像，5-10 分钟）
docker compose -f docker/docker-compose.yml up -d --build

# 后续启动
docker compose -f docker/docker-compose.yml up -d
```

验证：

```bash
docker compose -f docker/docker-compose.yml ps
# 应看到 5 个服务均为 Up 状态
```

### 2.5 初始化 Odoo 数据库

1. 浏览器访问 `http://localhost:8069`
2. 按向导创建数据库（如 `odoo19`）
3. 设置管理员账号（如 `admin@admin.com` / `admin`）

---

## 三、项目结构

```
odooseek/
├── apps/oweb/                    # 前端 SPA
│   ├── src/
│   │   ├── components/          # 共享组件 (Navbar, ErrorBoundary, ThemeToggle, SearchBar)
│   │   ├── lib/                 # API SDK (auth, api), 图标
│   │   ├── routes/              # 页面 (home, login, dashboard, settings, menu)
│   │   ├── themes/              # 运行时主题引擎 (5 预设 + 8 强调色)
│   │   └── views/               # Odoo 视图引擎 (xml-parser, OdooViewLoader, OdooListRenderer)
│   ├── package.json             # 依赖 (React 19, TanStack, Vite 8, Tailwind 4)
│   └── vite.config.ts           # Vite 配置 + API 代理
│
├── crates/                       # Rust Workspace
│   ├── odoo-core/               # 共享类型 (SessionInfo, OdooError, ServerConfig)
│   └── odoo-web-server/         # axum HTTP 服务 (proxy, session, menu, ws)
│
├── docker/
│   ├── docker-compose.yml       # 5 服务编排
│   ├── Dockerfile.rust          # Rust server 多阶段构建
│   ├── 19.0/                    # Odoo 19 镜像构建
│   ├── nginx/                   # Nginx 配置（过渡期）
│   └── config/odoo.conf         # Odoo 服务器配置
│
├── docs/                        # 文档
│   ├── VISION.md               # 项目愿景
│   ├── reserch/odoo.md          # Odoo 架构分析
│   └── plans/                   # 技术方案 (PHASE1, PHASE2)
│
├── .github/workflows/ci.yml     # CI 流水线
├── AGENTS.md                    # AI 助手约定
├── biome.json                   # Biome 格式/Lint 配置
├── clippy.toml                  # Clippy 规则配置
├── Cargo.toml                   # Rust workspace 根
└── package.json                 # 项目脚本
```

---

## 四、服务架构与端口

```
                Docker Network
┌──────────────────────────────────────────────────┐
│                                                   │
│  localhost:3000          localhost:8069            │
│  ┌──────────┐           ┌──────────┐             │
│  │  server   │──JSON-RPC→│   web    │──SQL→ ┌────┐│
│  │  (Rust)   │           │  (Odoo)  │       │ db ││
│  └──────────┘           └──────────┘       │(PG)││
│       │                      │             └────┘│
│       │ SPA                  │                    │
│       ▼                      ▼                    │
│  :3000 (主要入口)       :8069 (Odoo 原生)         │
│                                                   │
│  localhost:25050                                    │
│  ┌──────────┐                                      │
│  │ pgadmin  │ (数据库管理)                         │
│  └──────────┘                                      │
└──────────────────────────────────────────────────┘
```

| 端口 | 服务 | 说明 |
|------|------|------|
| `3000` | **odoo-web-server** (Rust) | 主入口：SPA 静态文件 + API 代理 + Session 管理 |
| `8069` | **Odoo 19 CE** | 业务引擎（需初始化数据库时直接访问） |
| `25050` | **pgAdmin** | 数据库 Web 管理 (admin@admin.com / admin) |

---

## 五、开发工作流

### 5.1 日常开发循环

```
1. 启动环境      docker compose up -d
2. 修改代码      前端 → apps/oweb/src/   |  后端 → crates/
3. 预检 CI       bun run precommit      (fmt + clippy + build + test)
4. 重启服务      仅前端 → 刷新浏览器     |  仅后端 → docker compose up -d --build server
5. 验证          浏览器 :3000 + curl 测试
6. 创建 Issue    gh issue create --repo HL8-ORG/odooseek ...
7. 提交          按约定格式 commit → push
8. 创建 PR       gh pr create ...
```

### 5.2 前端开发

```bash
# 进入前端目录
cd apps/oweb

# 安装依赖（首次）
bun install

# 启动 Vite 开发服务器（带 HMR，代理 API 到 :3000）
bun dev

# 类型检查 + 构建
bun run build

# Lint 检查
bun run lint

# 格式化
bun run format
```

> **提示**：`bun dev` 启动的开发服务器自带 HMR（热模块替换），修改代码后浏览器即时刷新。API 请求通过 Vite 代理转发到 Rust server。

### 5.3 后端开发

```bash
# 进入项目根目录

# 类型检查（快速）
cargo check --workspace

# Lint
cargo clippy --all-targets --no-deps

# 格式化
cargo fmt --all

# 构建
cargo build --workspace

# 构建 + 重启 Docker 容器
docker compose -f docker/docker-compose.yml up -d --build server
```

### 5.4 提交前 CI 预检（必须）

根据 `AGENTS.md`，每次提交前必须运行：

```bash
# 一键全量检查
bun run precommit
```

等价于：

```bash
# 后端
cargo fmt --check --all
cargo clippy --all-targets --no-deps
cargo build --workspace
cargo doc --workspace --no-deps

# 前端
cd apps/oweb
bun run build
bun run lint
```

---

## 六、提交与协作规范

### 6.1 分支命名

```
feat/N-描述       # 新功能（refs #N）
fix/N-描述        # 修复
refactor/N-描述   # 重构
docs/N-描述       # 文档
test/N-描述       # 测试
```

示例：`feat/13-odoo-view-loader`

### 6.2 提交格式

```
type: description (refs #N)
```

示例：
```
feat: XML view parser + OdooViewLoader (refs #14)
fix: proxy.rs forward browser Cookie header to Odoo
docs: add l8-erp-react as P1 frontend reference
```

### 6.3 Issue/PR 流程

1. **新功能开发前**：在 `docs/` 下写设计文档 → 创建 Issue → 开始编码
2. **编码完成后**：本地 CI 预检全部通过 → 提交 → 推送 → 创建 PR
3. **PR 格式**：标题 `(refs #N)`，正文 `closes #N`

```bash
gh issue create --repo HL8-ORG/odooseek --title "[Phase 2] 描述" --body "产出... 验收..."
gh pr create --repo HL8-ORG/odooseek --title "(refs #N) 描述" --body "closes #N"
```

> **注意**：测试和错误修复不要求先有文档/Issue。

---

## 七、常用命令速查

### 服务管理

```bash
# 启动全部服务
docker compose -f docker/docker-compose.yml up -d

# 仅重建 Rust server
docker compose -f docker/docker-compose.yml up -d --build server

# 停止全部
docker compose -f docker/docker-compose.yml down

# 查看日志
docker compose -f docker/docker-compose.yml logs -f server
docker logs docker-web-1 --tail 50

# 查看所有容器状态
docker compose -f docker/docker-compose.yml ps
```

### API 测试

```bash
# 健康检查
curl http://localhost:3000/health

# 登录
curl -X POST http://localhost:3000/api/session/login \
  -H 'Content-Type: application/json' -c /tmp/ck.txt \
  -d '{"db":"odoo19","login":"admin@admin.com","password":"admin"}'

# 获取 session
curl -b /tmp/ck.txt http://localhost:3000/api/session

# JSON-RPC 透传
curl -b /tmp/ck.txt -X POST http://localhost:3000/api/odoo/jsonrpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"service":"common","method":"version","args":[]},"id":1}'

# call_kw
curl -b /tmp/ck.txt -X POST http://localhost:3000/api/odoo/web/dataset/call_kw \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"call","params":{"model":"res.partner","method":"search_read","args":[[],["id","name"]],"kwargs":{"limit":3}},"id":1}'

# 菜单
curl -b /tmp/ck.txt http://localhost:3000/api/menu
```

### 数据库管理

```bash
# 访问 pgAdmin
open http://localhost:25050  # admin@admin.com / admin

# 备份数据库
docker exec docker-db-1 pg_dump -U odoo postgres > backup_$(date +%Y%m%d).sql
```

---

## 八、调试技巧

### 8.1 查看日志

```bash
# Rust server 日志
docker logs docker-server-1 -f

# Odoo 日志
docker logs docker-web-1 --tail 100

# 带时间戳过滤
docker logs docker-server-1 2>&1 | grep -E "ERROR|WARN|Proxying"
```

### 8.2 进入容器

```bash
# 进入 Rust server 容器
docker exec -it docker-server-1 sh

# 进入 Odoo 容器
docker exec -it docker-web-1 bash

# 直接测试 Odoo 内部连通性
docker exec docker-server-1 wget -qO- http://web:8069/jsonrpc
```

### 8.3 前端调试

```bash
# 查看 Network 请求
# 浏览器 DevTools → Network → 筛选 /api/

# 检查 cookie
# 浏览器 DevTools → Application → Cookies → localhost:3000

# 查看 Vite 代理
cd apps/oweb && bun dev
# 控制台会显示所有代理的 API 请求
```

---

## 九、常见问题

### 9.1 登录失败：AccessDenied

Odoo 数据库未初始化。访问 `http://localhost:8069` 完成数据库创建向导。

### 9.2 前端报 HTML 而非 JSON

访问了 `:8080`（Nginx 旧网关）而非 `:3000`（Rust server）。使用 `http://localhost:3000`。

### 9.3 call_kw 报 Session Expired

Cookie 未正确转发。确认 proxy.rs 中 `headers` 参数未被忽略。已知已在 `3510e3e` 提交中修复。

### 9.4 Domain() invalid item in domain

`search_read` 的 args 格式错误。应为 `[domain, fields]` 而非 `[[domain], [fields]]`。已在 `7ea76c7` 提交中修复。

### 9.5 cargo build 报 target resolution errors

检查是否在正确的目录：`cd odooseek && cargo check --workspace`。

### 9.6 Docker 构建缓慢

首次构建 `Dockerfile.rust` 会下载 Rust 工具链（~300MB）和编译依赖。后续构建使用缓存，约 5-10 秒。

---

## 十、下一步

- **加入开发**：从 [Issues](https://github.com/HL8-ORG/odooseek/issues) 认领一个未分配的任务
- **提交第一个 PR**：参考第六节的分支/提交/PR 规范
- **阅读文档**：`docs/VISION.md` 了解全局架构，`docs/plans/` 了解当前技术方案

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
