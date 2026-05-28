# Odoo 核心（odoo/odoo）设计架构与能力概览

本文概述 Odoo 核心代码库 `odoo/odoo` 的技术设计、关键子系统与扩展能力，便于理解内核行为与二次开发边界。

## 总体架构

- **分层思想**：HTTP 接入层 → 会话/安全中间层 → 业务/ORM 层 → 服务与工具层；以模块化机制装配功能。
- **模块化**：每个模块声明依赖、数据文件和资产，加载顺序由依赖解析决定；核心提供元模型与注册表以管理模块生命周期。
- **单进程多 worker 支持**：基于 WSGI/长轮询架构，可通过多 worker、gevent、cron、队列实现并发与任务调度。
- **多数据库与多租户**：支持多 DB 路由与会话隔离，通过 `dbfilter` 与 registry per DB 实现。

## 关键目录与责任

- `odoo/` 根：启动入口、配置、服务与工具集合。
- `odoo/modules/`：模块加载、清单解析、依赖解析、数据/视图/安全导入，处理安装、升级、卸载生命周期。
- `odoo/addons/`：内置基础模块（如 base、web、mail 等），可被扩展或替换。
- `odoo/api.py`：新 API 装饰器与调用协议，统一 ORM 接口（记录集语义、环境传递）。
- `odoo/models.py`：ORM 核心，模型定义、字段、约束、计算、onchange、访问控制钩子。
- `odoo/fields.py`：字段类型与序列化规则，含计算/反计算、inverse、search 定制。
- `odoo/http.py`：HTTP 层与 JSON-RPC 路由、请求上下文、CSRF、会话管理。
- `odoo/service/`：服务器启动、DB 管理、升级、单元测试入口、缓存、异步服务等。
- `odoo/tools/`：通用工具（时间、翻译、图像、导入导出、缓存、sql helpers）。
- `odoo/addons/base/`：系统基础模型与配置（用户、权限、菜单、ir.model/ir.ui.view 等）。

## 运行时核心机制

- **Registry**：每个数据库持有独立 registry，缓存模型元数据、字段、约束、访问控制；懒加载并支持热更新（重载）。
- **Environment (env)**：封装游标、用户、上下文、registry，贯穿 ORM 调用；确保多租户隔离与上下文传递。
- **ORM**：记录集语义（惰性、向量化），提供 CRUD、搜索/分页、计算字段、约束、onchange、访问控制、SUDO、事务钩子。
- **访问控制与安全**：基于组/ACL/规则（record rules）、共享与 sudo，HTTP 层处理 CSRF、会话、文件访问权限。
- **视图与数据模型**：`ir.model` 管理模型元信息；`ir.ui.view`/QWeb 描述界面；`ir.actions.*` 定义动作；`ir.cron`、`queue_job` 等调度后台任务。
- **国际化**：翻译文件 PO/CSV 与 terms 存储，加载至 registry，运行时按语言/上下文渲染。
- **缓存与性能**：字段级/方法级缓存、prefetch、context cache、registry cache；支持 workers 与 gevent 模式的并发优化。
- **资产与前端接口**：与 `addons/web` 协同，通过 manifest 中 assets 声明前端资源；HTTP/JSON-RPC 控制器为前端提供数据与操作接口。

## 扩展与定制点

- **模块扩展**：通过继承模型（\_inherit）、模型扩展、字段扩展、视图继承（xpath）、数据 XML/CSV 导入、服务器动作与钩子。
- **ORM 钩子**：`create/write/unlink` 重载，约束/计算/onchange，`@api.constrains`、`@api.depends`、`@api.model`、`@api.onchange`。
- **HTTP 扩展**：新增控制器、路由、JSON-RPC 端点；可叠加认证、CORS、安全策略。
- **服务与命令行**：自定义命令、后台任务、cron/队列；可通过 `odoo.service` 与 CLI 入口集成。
- **多语言/多公司**：利用上下文与记录规则扩展业务隔离；通过翻译导入导出实现本地化。

## 能力边界与最佳实践

- 避免直接改动核心文件，优先使用模块继承与扩展；保持可升级性。
- 变更模型需同步考虑访问控制、规则与性能（prefetch/批量操作）。
- 控制器需处理鉴权、上下文、安全过滤；返回结构应遵循前端/JSON-RPC 约定。
- 自定义视图与动作时优先继承/扩展现有 QWeb 与模型元数据，减少硬编码。
- 部署关注 worker/gevent 配置、dbfilter、缓存与定时任务；升级时确保 registry 与模块依赖一致性。
