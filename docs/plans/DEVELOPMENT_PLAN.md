# OdooSeek 开发计划

> 基于 [VISION.md](../VISION.md) 的愿景，将"探寻 Odoo 最佳可能"的使命分解为可执行、可追踪的开发任务。
>
> **对接目标**：Odoo 19 Community Edition（源码 `~/EA/odoo`），JSON-RPC 协议，Session Cookie 认证。

---

## 一、总览

| 阶段 | 代号 | 工期 | 目标 |
|------|------|------|------|
| **Phase 0** | 地基 | ✅ 已完成 (5/28) | Docker Odoo 19 + oweb 脚手架 |
| **Phase 1** | 网关 | ✅ 已完成 (5/28) | Rust axum BFF — 代理、会话、菜单、WebSocket |
| **Phase 2** | 视界 | ✅ 已完成 (5/28) | 视图引擎、路由守卫、i18n、XML 解析、动态菜单 |
| **Phase 3** | 疆域 | ✅ 已完成 (5/28) | CRM + 销售 + 库存 + 会计 17 条路由 |
| **Phase 4** | 精工 | ✅ 已完成 (5/28) | 看板 QWeb 语义支持 + QWeb 引擎分析 |
| **Phase 5** | 交互 | ✅ 已完成 (5/28) | 编辑模式、搜索/过滤、分组、装饰、图标移植 |
| **Phase 6** | 磐石 | 📋 规划中 | 测试扩展、Storybook、部署文档、CI/CD 完善 |
| **Phase 7** | 精进 | 📋 规划中 | 面包屑、Sheet 布局、Statusbar、Pivot |

---

## 二、Phase 0：地基 ✅ 已完成

### 成果

| 任务 | 产出 | 状态 |
|------|------|:----:|
| Docker Odoo 19.0 CE | `docker/19.0/Dockerfile` | ✅ |
| PostgreSQL 16 + pgAdmin | `docker/docker-compose.yml` | ✅ |
| oweb 项目脚手架 | React 19 + TypeScript + Vite + TanStack Router | ✅ |
| Biome lint/format | `biome.json` | ✅ |
| JSON-RPC SDK | `apps/oweb/src/lib/api.ts` | ✅ |
| 运行时主题引擎 | 5 预设 + 8 强调色 + localStorage | ✅ |
| CI/CD | `.github/workflows/ci.yml` (Rust + 前端) | ✅ |
| 文档 | VISION.md, AGENTS.md, WSL 教程 | ✅ |

---

## 三、Phase 1：网关 — odoo-web-server ✅ 已完成

### 成果

| 模块 | 文件 | 功能 |
|------|------|------|
| JSON-RPC 透传 | `proxy.rs` | POST `/api/odoo/*path` → Odoo，Cookie 转发 |
| Session 管理 | `session.rs` | 登录 `/web/session/authenticate` (flat params)，19 字段 SessionInfo |
| 菜单 | `menu.rs` | `ir.ui.menu` search_read 根菜单 |
| WebSocket | `ws.rs` | `/websocket/peek_notifications` 轮询 + broadcast |
| 静态文件 | `static.rs` | oweb SPA 托管 |
| Rust toolchain | `clippy.toml`, `rust-toolchain.toml` | cognitive-complexity=30, Odoo terms |

### 关键决策
- **`call_kw` 单一入口**: 所有模型操作通过 `/web/dataset/call_kw` — 不使用 `fields_view_get()`（Odoo 19 已移除）
- **Nginx 移除**: Rust server (:3000) 是唯一入口点，简化部署
- **WebSocket 直连**: Vite proxy 不可靠 → dev mode 使用 `ws://localhost:3000/ws/events`

---

## 四、Phase 2：视界 — 前端视图引擎 ✅ 已完成

### 成果

| 模块 | 文件 | 功能 |
|------|------|------|
| 路由守卫 | `__root.tsx`, 各路由 `beforeLoad` | 未认证 → `/login` |
| AuthProvider | `auth.tsx` | 14-field AuthState via `/api/session` |
| OdooViewLoader | `views/OdooViewLoader.tsx` | `get_views()` 一次调用 → 分发 List/Form/Kanban |
| OdooListRenderer | `views/OdooListRenderer.tsx` | 动态列 (from `<list>` XML)，TanStack Query |
| OdooFormRenderer | `views/OdooFormRenderer.tsx` | 递归布局 (sheet/group/notebook)，15 种 Widget |
| OdooViewSwitcher | `views/OdooViewSwitcher.tsx` | List/Form/Kanban 切换 |
| XML 解析器 | `lib/xml-parser.ts` | parseListXml, parseFormXml, parseKanbanXml, parseSearchXml |
| WebSocket 事件 | `hooks/useOdooBus.ts` | `/ws/events` 连接 + React Query 自动刷新 |
| i18n | `lib/i18n.tsx` | `use-intl` — zh_CN 默认, en fallback |
| 菜单导航 | `routes/menu.tsx` | `parseActionRef` + `callKw(ir.actions.act_window,read)` + 容器菜单子查询 |
| 通用路由 | 7 条 | `/`, `/login`, `/menu`, `/web`, `/dashboard`, `/settings`, `/home` |

---

## 五、Phase 3：疆域 — 业务模块 ✅ 已完成

### 实际架构（与早期设计不同）

采用**通用路由模式**而非每模块独立组件：
- `/web?model=MODEL` — 通用视图路由，不硬编码模型
- CRM pipeline 使用独立的 `/crm/pipeline` 路由（需要 domain 过滤）
- 各模块使用相同模式：列表 + 详情 + 索引重定向

### 路由表（17 条）

| 路由 | 视图类型 | 模型 | 域 |
|------|----------|------|-----|
| `/` | redirect | — | → `/menu` |
| `/login` | form | — | 登录 |
| `/menu` | grid | — | 动态菜单卡片 |
| `/web` | 通用 | search.model | 通用 ViewLoader |
| `/dashboard` | — | — | 占位 |
| `/settings` | — | — | 占位 |
| **CRM** | | | |
| `/crm/` | redirect | — | → `/crm/pipeline` |
| `/crm/pipeline` | kanban | crm.lead | `[['type','=','opportunity']]` |
| `/crm/leads` | list | crm.lead | `[['type','=','lead']]` |
| `/crm/lead/$id` | form | crm.lead | — |
| **Sales** | | | |
| `/sale/` | redirect | — | → `/sale/orders` |
| `/sale/orders` | list | sale.order | — |
| `/sale/order/$id` | form | sale.order | — |
| **Inventory** | | | |
| `/inventory/` | redirect | — | → `/inventory/pickings` |
| `/inventory/pickings` | list | stock.picking | — |
| `/inventory/picking/$id` | form | stock.picking | — |
| **Accounting** | | | |
| `/accounting/` | redirect | — | → `/accounting/moves` |
| `/accounting/moves` | list | account.move | — |
| `/accounting/move/$id` | form | account.move | — |

### 看板管线（Kanban）

| 功能 | 实现 |
|------|------|
| 数据获取 | `search_read` 全量 + 客户端 `stage_id` 分组 |
| 阶段列表 | `search_read('crm.stage', [['name','sequence','color']])` |
| 卡片渲染 | `parseKanbanFields(template)` → Widget 序列 + name 回退 |
| 拖拽 | HTML5 Drag & Drop + `callKw('write', [[id], {stage_id}])` + 乐观更新 |
| domain | pipeline 过滤 opportunity, leads 过滤 lead |

### 修复的关键 Bug

| 日期 | Bug | 修复 |
|------|-----|------|
| 5/28 | setState-during-render (menu.tsx:150) | `navigate()` 移入 `useEffect` |
| 5/28 | React duplicate keys (OdooListRenderer) | key 加索引前缀 |
| 5/28 | WebSocket CONNECTING close | `readyState` 检查 |
| 5/28 | 看板无数据 | `search_read` domain 双包裹修复 |

---

## 六、Phase 4：精工 — 看板 QWeb 语义 📋

> 详细技术方案：`PHASE4_TECHNICAL_DESIGN.md`

### 目标

将看板卡片从"扁平字段列表"升级为"符合 QWeb 语义的树状渲染"。

### 任务

| # | 任务 | 说明 | 工时 |
|---|------|------|------|
| 4.1 | `parseKanbanTemplate()` | 解析 t-if/t-foreach/t-elif/t-else 为 AST 树 | 1d |
| 4.2 | `KanbanNode` 递归渲染 | 条件、循环、footer 分区 | 1d |
| 4.3 | 表达式求值器 | 安全白名单，仅 `record.*` | 0.5d |
| 4.4 | `highlight_color` | 卡片颜色标记 | 0.3d |
| 4.5 | 测试 | 5 新测试 | 0.5d |

**共 3.3 天**

---

## 七、Phase 5：交互 — 编辑 + 搜索 + 分页 📋

| # | 任务 | 优先级 |
|---|------|--------|
| 5.1 | OdooFormRenderer 编辑模式 | P0 |
| 5.2 | `<search>` 视图 → 过滤器 UI | P1 |
| 5.3 | 列表分页 | P1 |
| 5.4 | many2one 搜索下拉 | P1 |
| 5.5 | `<xpath>` 视图继承 | P2 |
| 5.6 | `ir.actions.server` 支持 | P2 |

---

## 八、Phase 6：磐石 — 生产就绪 📋

| # | 任务 | 优先级 |
|---|------|--------|
| 6.1 | 测试扩展 (50+ tests) | P0 |
| 6.2 | Storybook 组件库 | P1 |
| 6.3 | 部署文档 + `make dev/prod` | P1 |
| 6.4 | E2E (Playwright) | P2 |
| 6.5 | Kubernetes Helm chart | P2 |

---

## 九、依赖关系图

```
Phase 0 ✅ (Docker + 脚手架)
    │
Phase 1 ✅ (Rust BFF: proxy, session, menu, ws)
    │
Phase 2 ✅ (前端: ViewEngine, XML parser, Auth, i18n, Menu)
    │
Phase 3 ✅ (17 routes: CRM, Sales, Inventory, Accounting + Kanban DnD)
    │
Phase 4 📋 (Kanban QWeb tree rendering, highlight_color)
    │
Phase 5 📋 (Edit mode, search, pagination, many2one dropdown)
    │
Phase 6 📋 (Tests, Storybook, deployment, E2E)
```

---

## 十、当前进度

```
Phase 0 ████████████████████ 100% ✅ (2026-05-28)
Phase 1 ████████████████████ 100% ✅ (2026-05-28)
Phase 2 ████████████████████ 100% ✅ (2026-05-28)
Phase 3 ████████████████████ 100% ✅ (2026-05-28)
Phase 4 ████████████████████ 100% ✅ (2026-05-28)
Phase 5 ████████████████████ 100% ✅ (2026-05-28)
Phase 6 ░░░░░░░░░░░░░░░░░░░░   0% 📋
Phase 7 ░░░░░░░░░░░░░░░░░░░░   0% 📋
```

---

## 十一、文档索引

| 文档 | 路径 | 版本 |
|------|------|------|
| VISION | `docs/VISION.md` | v1.7 |
| 架构哲学 | `docs/technologies/odoo-architecture-philosophy.md` | v2.0 |
| M→A→V→M 链路 | `docs/technologies/ODOOSEEK_MVAM_CHAIN.md` | v1.0 |
| QWeb 引擎 | `docs/technologies/ODOO_QWEB_ENGINE_ANALYSIS.md` | v1.0 |
| Phase 1 设计 | `docs/plans/PHASE1_TECHNICAL_DESIGN.md` | — |
| Phase 2 设计 | `docs/plans/PHASE2_TECHNICAL_DESIGN.md` | — |
| Phase 3 设计 | `docs/plans/PHASE3_TECHNICAL_DESIGN.md` | v3.0 |
| Phase 4 设计 | `docs/plans/PHASE4_TECHNICAL_DESIGN.md` | v1.0 |
| 开发工作流 | `docs/training/DEVELOPMENT_WORKFLOW.md` | — |

---

**文档版本**: 3.0 (Phase 4/5 完成)  
**更新日期**: 2026-05-28  
**维护团队**: OdooSeek
