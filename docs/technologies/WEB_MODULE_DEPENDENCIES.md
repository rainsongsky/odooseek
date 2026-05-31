# Odoo 19 CE `addons/web` 模块依赖关系清单

> **版本**: 1.0  
> **日期**: 2026-05-31  

---

## 一、模块基本信息

| 属性 | 值 |
|------|-----|
| 模块名 | `web` |
| 显示名 | Web |
| 依赖 | **仅 `base`**（Odoo 核心框架） |
| 自动安装 | **是** (`auto_install: True`) — 不可卸载 |
| 安装时机 | 任何依赖 `web` 的模块安装时自动触发 |

---

## 二、依赖 `web` 的模块清单

共 **45 个** 模块声明了 `'web'` 依赖。

### 2.1 CE 模块（44 个）

| 模块 | 显示名 | 类别 |
|------|--------|------|
| `api_doc` | API Documentation | 开发工具 |
| `attachment_indexation` | Attachments List and Document Indexation | 基础设施 |
| `auth_oauth` | OAuth2 Authentication | 认证 |
| `auth_passkey` | Passkeys (WebAuthn) | 认证 |
| `auth_password_policy` | Password Policy | 认证 |
| `auth_signup` | Signup | 认证 |
| `auth_totp` | Two-Factor Authentication (TOTP) | 认证 |
| `barcodes` | Barcode | 工具 |
| `base_iban` | IBAN Bank Accounts | 财务 |
| `base_import` | Base Import | 数据 |
| `base_import_module` | Base Import Module | 开发工具 |
| `base_setup` | Initial Setup Tools | 配置 |
| `bus` | IM Bus | 基础设施 |
| `google_address_autocomplete` | Google Address Autocomplete | 地理 |
| `hr` | Employees | 人力资源 |
| `html_editor` | HTML Editor | 工具 |
| `http_routing` | Web Routing | 基础设施 |
| `iap` | In-App Purchases | 集成 |
| `iot_base` | IoT Base | IoT |
| `knowledge` | Knowledge | 文档 |
| `mail_plugin` | Mail Plugin | 邮件 |
| `onboarding` | Onboarding Toolbox | 配置 |
| `portal` | Customer Portal | 门户 |
| `project` | Project | 项目管理 |
| `resource` | Resource | 基础设施 |
| `social` | Social Marketing | 营销 |
| `spreadsheet` | Spreadsheet | 工具 |
| `timer` | Timer | 工具 |
| `transifex` | Transifex Integration | 翻译 |
| `utm` | UTM Trackers | 营销 |
| `web_cohort` | Cohort View | 视图扩展 |
| `web_enterprise` | Web Enterprise | 企业版基础 |
| `web_gantt` | Web Gantt | 视图扩展 |
| `web_grid` | Grid View | 视图扩展 |
| `web_hierarchy` | Web Hierarchy | 视图扩展 |
| `web_map` | Map View | 视图扩展 |
| `web_tour` | Tours | 工具 |
| `website` | Website | 网站 |
| `test_http` | Test HTTP | 测试 |
| `test_import_export` | Test - Import & Export | 测试 |
| `test_orm` | Test ORM | 测试 |
| `test_read_group` | Test Read Group | 测试 |
| `test_search_panel` | Test Search Panel | 测试 |
| `test_testing_utilities` | Test Testing Utilities | 测试 |

### 2.2 EE 模块（1 个）

| 模块 | 显示名 | 类别 |
|------|--------|------|
| `web_studio` | Studio | 企业版开发工具 |

---

## 三、`web` 依赖的模块

| 模块 | 作用 |
|------|------|
| `base` | Odoo 核心框架 — ORM 引擎、元数据表 (`ir.model`, `ir.ui.view`)、访问控制 |

`web` 模块 **不依赖任何其他模块**。它是 Odoo 的第二个基础层，紧贴在 `base` 之上。

---

## 四、依赖链可视化

```
base (核心)
  │
  └── web ⬅ 本模块
       │
       ├── auth_oauth        ├── knowledge       ├── web_cohort
       ├── auth_passkey      ├── mail_plugin     ├── web_enterprise
       ├── auth_signup       ├── onboarding       ├── web_gantt
       ├── auth_totp         ├── portal           ├── web_grid
       ├── base_import       ├── project          ├── web_hierarchy
       ├── bus               ├── social           ├── web_map
       ├── hr                ├── spreadsheet      ├── web_tour
       ├── html_editor       ├── website          └── web_studio (EE)
       └── ...               └── ...
       
  所有 Odoo 业务模块 (sale/crm/stock/account/...) 在 manifest 中不直接依赖 web，
  但通过 implicit dependency（其视图使用 web 模块的 view types）间接依赖。
```

**说明**: 虽然只有 45 个模块在 `depends` 中明确声明了 `'web'`，但实际上是 **所有** 业务模块（sale、crm、stock、account、purchase、manufacturing...）都间接依赖 web 模块，因为它们都需要 web 模块提供的基础视图类型（form、list、kanban）和 Widget 系统。它们通过 `ir.ui.view` 表存储 XML 视图定义，由 web 模块在运行时加载和渲染。

---

## 五、按类别的依赖分布

| 类别 | 数量 | 模块 |
|------|:--:|------|
| 认证/安全 | 5 | auth_oauth, auth_passkey, auth_password_policy, auth_signup, auth_totp |
| 基础设施 | 5 | attachment_indexation, bus, http_routing, resource, iap |
| 工具 | 5 | barcodes, html_editor, spreadsheet, timer, onboarding |
| 视图扩展 | 5 | web_cohort, web_gantt, web_grid, web_hierarchy, web_map |
| 企业版 | 2 | web_enterprise, web_studio |
| 测试 | 5 | test_http, test_import_export, test_orm, test_read_group, test_search_panel |
| 其他 | 18 | api_doc, base_iban, base_import, base_import_module, base_setup... |

---

## 六、oweb 的继承策略

| 依赖链中的角色 | oweb 处理方式 |
|---------------|-------------|
| `base`（ORM + 元数据） | ✅ 完全依赖，通过 JSON-RPC 调用 |
| `web` 服务端 (API) | ✅ 通过 BFF 代理继承 |
| `web` 客户端 (Owl SPA) | ❌ 替换为 React (oweb) |
| `web_enterprise` (企业版前端) | ⚠️ 部分功能通过 oweb 实现 |
| 视图扩展 (`web_cohort`/`web_gantt` 等) | ❌ 未实现（需额外开发） |
| 依赖 `web` 的所有业务模块 | ✅ 通过 oweb 的视图引擎渲染其 XML |

**关键结论**: oweb 通过代理 `web` 模块的服务端 API，可以**自动支持**所有依赖 `web` 的 45+ 模块的业务逻辑。只要视图 XML 能被 `OdooViewLoader` 解析，业务模块无需任何修改即可在 oweb 中运行。

---

**文档版本**: 1.0  
**创建日期**: 2026-05-31  
**维护团队**: OdooSeek
