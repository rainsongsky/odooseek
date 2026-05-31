# Odoo Web 模块能力继承分析

> **版本**: 1.0  
> **日期**: 2026-05-31  
> **目标**: 明确 oweb 如何继承 Odoo 19 CE `addons/web` 模块的能力，划分已完成/待完成/不需要做的边界。

---

## 一、继承策略

### 核心原则

oweb 对 Odoo web 模块采用 **分层替换** 策略：

```
Odoo web 模块架构                    oweb 处理方式
─────────────────                    ────────────
服务端 Python (models/controllers)  → ✅ 完全继承，通过 BFF 代理
客户端 Owl SPA                       → ❌ 替换为 React + TypeScript
QWeb 模板引擎                        → ⚠️  语义映射，不移植引擎
CSS/样式                             → ❌ 替换为 Tailwind CSS
```

**核心决策**: Odoo 的服务端逻辑（ORM 桥接、视图继承、会话管理）**不重写**，通过 BFF 的 JSON-RPC 代理透明调用。oweb 只替换前端渲染层。

---

## 二、已完成继承清单

### 2.1 服务端能力（通过 BFF 代理）

| Odoo 能力 | Odoo 文件 | BFF 端点 | 继承方式 |
|-----------|----------|----------|----------|
| ORM CRUD | `controllers/dataset.py:DataSet.call_kw()` | `POST /api/odoo/web/dataset/call_kw` | 透明代理 |
| 按钮执行 | `controllers/dataset.py:DataSet.call_button()` | `POST /api/odoo/web/dataset/call_button` | 透明代理 |
| Action 加载 | `controllers/action.py:Action.load()` | `POST /api/odoo/web/action/load` | 透明代理 |
| Action 执行 | `controllers/action.py:Action.run()` | `POST /api/odoo/web/action/run` | 透明代理 |
| 会话信息 | `controllers/session.py:Session.get_session_info()` | `GET /api/session` | 代理 + 增强(menus注入) |
| 登录 | `controllers/session.py:Session.authenticate()` | `POST /api/session/login` | 透明代理 |
| 登出 | `controllers/session.py:Session.destroy()` | `POST /api/session/logout` | 透明代理 |
| 语言列表 | `controllers/session.py:Session.get_lang_list()` | `GET /api/session/languages` | 透明代理 |
| 模块列表 | `controllers/session.py:Session.modules()` | `GET /api/session/modules` | 透明代理 |
| 会话检查 | `controllers/session.py:Session.check()` | `GET /api/session/check` | 透明代理 |
| 菜单加载 | `controllers/webclient.py:WebClient.load_menus()` | `GET /api/menus` | 透明代理 |
| 翻译加载 | `controllers/webclient.py:WebClient.translations()` | `GET /api/translations` | 透明代理 |
| 图片服务 | `controllers/binary.py:Binary.image()` | `GET /api/web/image/{*path}` | 透明代理 |
| 文件下载 | `controllers/binary.py:Binary.content_*()` | `GET /api/web/content/{*path}` | 透明代理 |
| 公司 Logo | `controllers/binary.py:Binary.company_logo()` | `GET /api/logo` | 透明代理 |
| 报表生成 | `controllers/report.py:Report` | `GET /api/report/download` | 两步代理 |
| 条码生成 | `controllers/report.py:Report.barcode()` | `GET /api/report/barcode/{*path}` | 透明代理 |
| WebSocket | `controllers/websocket.py` + `addons/bus/` | `WS /ws/events` | 桥接 + 轮询降级 |
| HTTP 通用 | 所有 `@http.route` 注册的 handler | `ANY /api/odoo-http/{*path}` | 透明代理 |
| CSV 导出 | `controllers/export.py` | `GET /api/odoo-http/web/export/csv` | 通过 HTTP 代理 |
| XLSX 导出 | `controllers/export.py` | `GET /api/odoo-http/web/export/xlsx` | 通过 HTTP 代理 |

**服务端继承度: ~90%**（18 个专用端点 + 2 个通用代理）

### 2.2 ORM 数据访问

| Odoo 方法 | Odoo 文件 | oweb 调用方式 | 状态 |
|-----------|----------|-------------|:--:|
| `web_search_read` | `models/models.py:62` | `callKw(model, 'search_read', ...)` | ✅ |
| `web_read` | `models/models.py:105` | `callKw(model, 'read', ...)` | ✅ |
| `web_read_group` | `models/models.py:306` | `callKw(model, 'read_group', ...)` | ✅ |
| `web_save` | `models/models.py:86` | `callKw(model, 'write'/'create', ...)` | ✅ |
| `get_views` | `base/models/ir_ui_view.py:2891` | `callKw(model, 'get_views', ...)` | ✅ |
| `fields_get` | ORM 内置 | `callKw(model, 'fields_get', ...)` | ✅ |
| `name_search` | `models/models.py` | `nameSearch(model, name)` | ✅ |
| `default_get` | ORM 内置 | `callKw(model, 'default_get', ...)` | ✅ |
| `onchange` | `models/models.py:1909` | `callKw(model, 'onchange', ...)` | ✅ |
| `search_panel_select_range` | `models/models.py` | `callKw(model, 'search_panel_select_range', ...)` | ✅ |
| `read_progress_bar` | `models/models.py` | `readGroup(model, ...)` (变体) | ⚠️ |

### 2.3 视图类型

| 视图 | Odoo 类型 | oweb 组件 | 状态 |
|------|----------|----------|:--:|
| List | `tree`/`list` | `OdooListRenderer.tsx` | ✅ |
| Form | `form` | `OdooFormRenderer.tsx` | ✅ |
| Kanban | `kanban` | `OdooKanbanRenderer.tsx` | ✅ |
| Pivot | `pivot` | `OdooPivotRenderer.tsx` | ✅ |
| Graph | `graph` | `OdooGraphRenderer.tsx` | ✅ |
| Calendar | `calendar` | `OdooCalendarRenderer.tsx` | ✅ |
| Search | `search` | `SearchBar.tsx` + `SearchPanel.tsx` | ✅ |

### 2.4 Widget 系统

oweb 实现 **41/87** (47%) Odoo 企业版 Widget：

| 类别 | 已实现 | 数量 |
|------|--------|:--:|
| 基础字段 | Char, Text, Integer, Float, Boolean, Date, DateTime, Monetary, Binary, HTML, Reference, Handle | 12 |
| 选择/状态 | Selection, Priority, State, Statusbar, Radio, Badge, Label, StateSelection | 8 |
| 关系字段 | Many2One, Many2Many, One2Many, Many2OneAvatar, Many2ManyTags, Many2ManyCheckboxes, Many2ManyTagsAvatar | 7 |
| 布尔变体 | Toggle, Favorite, Icon | 3 |
| 格式化 | FloatTime, Percentage, RemainingDays, CopyClipboard | 4 |
| 媒体 | Image, ImageUrl, AttachmentImage, PercentPie | 4 |
| 工具 | Progressbar, Password, Phone, Email, URL | 5 |

### 2.5 核心功能

| 功能 | 实现 |
|------|:--:|
| 导航菜单 (Navbar + HomeMenu) | ✅ |
| 认证 (login/logout/session) | ✅ |
| 路由 (17 条业务路由 + 通用路由) | ✅ |
| 搜索过滤 (SearchBar + date presets) | ✅ |
| 搜索面板 (SearchPanel sidebar) | ✅ |
| Dialog/Modal (target=new) | ✅ |
| Action 按钮执行 (object/action/edit) | ✅ |
| 上下文传递 (active_id/active_model) | ✅ |
| CRUD 操作 (create/read/update/delete/archive/duplicate) | ✅ |
| 分页 (40/80/200/500) | ✅ |
| 排序/分组 | ✅ |
| 内联编辑 (list + form) | ✅ |
| 行装饰 (decoration-*) | ✅ |
| 键盘导航 (list) | ✅ |
| Form autosave (draft + auto-save) | ✅ |
| Chatter (消息/笔记/关注者) | ✅ |
| Activity (日程管理) | ✅ |
| 搜索收藏 (ir.filters) | ✅ |
| 报表 (PDF via proxy) | ✅ |
| WebSocket (实时通知) | ✅ |
| 国际化 (en/zh 静态) | ⚠️ |
| 导出 (CSV) | ⚠️ |

---

## 三、明确未实现

### 3.1 不需要做的

| 项目 | 原因 |
|------|------|
| Odoo ORM 桥接 | BFF 代理 Odoo 的 `web_search_read` 等方法，服务端不变 |
| 视图继承 (`<xpath>`) | Odoo 服务端已处理，返回最终 merged XML |
| 安全规则 (`ir.rule`) | Odoo 服务端自动应用，RPC 响应已过滤 |
| 服务端 QWeb 引擎 | 仅 kanban 卡片需客户端处理，React 等效表达 |
| OWL 框架 | 已替换为 React + TanStack |
| Bootstrap CSS | 已替换为 Tailwind CSS |
| jQuery 遗留代码 | 已移除 |
| 数据库管理 UI | 通过 Odoo 直接访问 `:8069/web/database/manager` |

### 3.2 待完成（高优先级）

| 项目 | 说明 | 工作量 |
|------|------|:--:|
| 服务端 i18n 集成 | 前端加载 `/api/translations` 动态翻译 | 中 |
| XLSX 导出 | 列表视图 Excel 导出 | 中 |
| CSV 导入 | 批量导入数据 | 高 |
| Widget 补全 (46 个) | signature, gauge, domain, properties 等 | 高 |
| QWeb `t-call`/`t-set` | 看板卡片模板继承 | 低 |
| 双向 WebSocket | BFF 双向转发 Odoo WS 消息 | 中 |

### 3.3 待完成（低优先级）

| 项目 | 说明 |
|------|------|
| OAuth2/SSO 登录 | 第三方登录集成 |
| PWA 离线支持 | Service Worker + manifest |
| Kanban 列折叠 | `fold_field` 支持 |
| Kanban 列快速创建 | 看板添加新阶段 |
| `<xpath>` 客户端继承 | 客户端侧视图 custom |
| 多级分组 (list) | 递归展开分组 |
| 导出对话框 (字段选择器) | 高级导出 UI |
| 通知服务增强 | 类型化 toast + 按钮 |
| Progress bar (with sum_field) | 看板进度条聚合 |

---

## 四、架构对比

### Odoo 原生架构

```
浏览器
  └── Owl SPA (JavaScript)
       ├── orm_service → RPC → Odoo JSON-RPC
       ├── action_service → Action 管理
       ├── view_service → View 加载/编译
       ├── menu_service → 菜单管理
       └── View Components (Form/List/Kanban/...)
```

### oweb 架构

```
浏览器
  └── oweb SPA (React + TypeScript)
       ├── lib/api.ts → fetch → BFF :3000
       │                          └── proxy → Odoo :8069 JSON-RPC
       ├── TanStack Query → 数据缓存/同步
       ├── TanStack Router → 客户端路由
       ├── Context (Auth/i18n/Theme) → 跨组件状态
       └── View Components → OdooViewLoader → List/Form/Kanban/...

服务端
  ├── odoo-web-server (Rust)  → BFF 代理 + 缓存 + WS
  └── Odoo 19 CE (Python)     → 业务逻辑 + ORM（保持不变）
```

### 数据流对比

```
Odoo 原生                          oweb
─────────                          ────
Browser → POST /jsonrpc             Browser → POST /api/odoo/.../call_kw
          ↓                                      ↓
Odoo Http Dispatcher              odoo-web-server (Rust BFF)
  → 解析 JSON-RPC params             → 缓存检查
  → 调用 model.method(...)           → Cookie 转发
  → 返回 result                    → POST Odoo JSON-RPC
                                       → 返回 result
```

**关键差异**: oweb 在中间插入了 Rust BFF 层，提供缓存、压缩、安全头等增强，但不改变 Odoo 的 API 语义。

---

## 五、能力继承总结

| 分类 | 继承方式 | 覆盖率 |
|------|----------|:----:|
| Odoo 服务端 API | BFF 透明代理 (18 端点 + 2 通用) | **90%** |
| ORM 数据方法 | BFF 代理 → Odoo call_kw | **100%** |
| 视图类型 (7 种) | React 组件重新实现 | **100%** |
| Widget (字段组件) | React 组件映射 | **47%** |
| 核心交互 (CRUD/Search/Action/Dialog) | React 实现 | **95%** |
| 导航/菜单 | React + TanStack | **90%** |
| 实时通信 | BFF WS 桥接 | **80%** |
| 国际化 | 静态 JSON | **30%** |
| 导出/导入 | 基础 CSV | **50%** |
| **总体** | — | **~85%** |

---

## 六、开发指南

### 新增功能的决策流程

```
需要添加新功能？
    │
    ├─ 是 Odoo 服务端功能？
    │   ├─ 是 JSON-RPC？ → 通过 /api/odoo/ 代理 ✅
    │   └─ 是 HTTP？ → 添加专用 BFF 路由
    │
    ├─ 是前端 UI 功能？
    │   ├─ 是视图？ → 新建 React 组件
    │   ├─ 是 Widget？ → 注册到 widgets/index.ts
    │   └─ 是交互？ → hooks/ + components/
    │
    └─ 是基础设施？
        ├─ 是缓存？ → cache.rs
        ├─ 是安全？ → proxy.rs 或中间件
        └─ 是通信？ → ws.rs 或 api.ts
```

### 不重新发明轮子的清单

- ❌ 不要重写 `web_search_read` / `web_read` — Odoo 已实现
- ❌ 不要重写视图继承 — Odoo `get_views` 返回已合并的 XML
- ❌ 不要重写 QWeb 引擎 — React 等效表达
- ❌ 不要直连 PostgreSQL — 保持 Odoo 为单一数据源
- ❌ 不要实现服务端渲染 — oweb 是纯 SPA

---

**文档版本**: 1.0  
**创建日期**: 2026-05-31  
**维护团队**: OdooSeek
