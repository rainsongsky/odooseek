# Odoo Web 技术设计与能力概览

本文聚焦 `odoo/addons/web`，总结其前后端协同的技术架构、构建方式与核心能力，帮助在二次开发和问题排查时快速定位扩展点。

## 模块定位与作用

- 提供 Odoo Web Client 的核心：导航框架、会话管理、界面主题、视图渲染与交互。
- 暴露通用 HTTP/JSON-RPC 控制器，作为前端视图与模型层之间的桥梁。
- 定义前端资产（JS/SCSS/XML）与打包规则，为后台、前台、报表、测试等场景提供独立 bundle。

## 整体分层

- **后端层（Python）**：`controllers` 负责 HTTP/JSON-RPC、报表、数据库管理等；`models` 提供视图与设置相关的模型扩展（如 `ir_ui_view`、`res_users`）；`views` 定义 QWeb 模板和报表布局；`security` 管控访问。
- **前端核心层（JS/TS/SCSS/XML）**：位于 `static/src`，以 OWL 组件体系为基础，涵盖环境初始化（`env.js`）、模块加载（`module_loader.js`）、服务与注册表（`core/registry.js`）、视图引擎与控件库（`views/**/*`）、WebClient 壳层（`webclient/**/*`）等。
- **资源与主题层**：`static/lib` 引入 Bootstrap、FontAwesome、Owl 等第三方库；`static/src/scss` 定义主题变量、暗色模式与报表样式；`static/src/webclient/actions/reports` 等专用于报表。
- **测试与工具层**：`static/tests`、`tooling` 和资产 `web.assets_tests`/`web.assets_unit_tests` 支撑前端单元与场景测试，预置 hoot/qunit 等工具链。

## 资产与构建

- 资产入口由 `__manifest__.py` 的 `assets` 字段定义，覆盖后台（`web.assets_backend`）、前台（`web.assets_frontend`）、报表（`web.report_assets_*`）、测试（`web.assets_tests`/`web.assets_unit_tests`）、暗色主题（`web.assets_web_dark`）等。
- 通过 `('include', ...)`、`('remove', ...)`、`('after', ...)` 控制子 bundle 组合与裁剪，支持懒加载包（`web.assets_backend_lazy`、`web.assets_frontend_lazy`）。
- 核心依赖：Owl 组件引擎、Luxon、Bootstrap、FontAwesome、jQuery（兼容性用途）、DOMPurify 等。
- SCSS 变量与 mixin 分层：`_assets_helpers`（函数/变量/mixin）、`_assets_bootstrap_*`（Bootstrap 主题）、`_assets_secondary_variables`（二级主题变量）为自定义主题与暗色模式提供注入点。

## 核心运行机制

- **启动流程**：通过 `web/static/src/main.js` 与 `start.js` 创建环境、装载服务和命令，并挂载 WebClient 根组件。
- **环境与服务**：`env.js` 提供全局注入点；`core/registry.js` 管理服务、视图、字段、小部件等可插拔元素；服务通过事件总线与依赖注入协作。
- **路由与动作**：WebClient 壳层管理菜单、动作（window/report/url）、多标签页、全局命令面板，动作触发视图渲染与数据加载。
- **数据与 RPC**：前端通过服务调用 `controllers`（如 `json.py`、`dataset.py`、`report.py`）进行 JSON-RPC；`domain.py`、`search` 等模块处理筛选条件与上下文。
- **视图与小部件**：支持列表、看板、表单、图表、数据透视等视图（后两者默认懒加载）；字段小部件、搜索面板、分页、内联编辑等由视图层统一管理。
- **国际化与本地化**：`i18n` 目录提供翻译；前端依赖 `session`/`env` 注入语言、时区与格式信息。
- **报表与导出**：报表资产独立，支持 PDF/HTML 预览、打印；导出/导入由 `export.py` 等控制器提供接口。
- **安全与会话**：后端控制 CSRF、文件访问（`binary.py`）、登录/会话（`session.py`）；前端处理权限反馈、错误提示与延迟加载敏感资源。

## 扩展能力与最佳实践

- 使用注册表与服务机制扩展：可在 `core/registry.js` 注册自定义服务、命令、视图渲染器或字段部件，实现可插拔扩展。
- 通过资产 hook 增删文件实现主题或功能定制；利用变量与 mixin 调整配色、暗色模式与报表样式。
- 自定义控制器或模型扩展可挂载到 `controllers`/`models`，与前端 RPC 协议保持一致。
- 前端组件采用 OWL 语法和 QWeb 模板，建议复用 `webclient` 与 `views` 中的基类组件与样式约定。
- 测试使用 `web.assets_unit_tests`/`web.assets_tests` 预置环境，借助 hoot/qunit 与 mock server 工具验证服务和组件。

## 典型交互流程示例

1. 用户登录后加载 `web.assets_backend`，初始化 `env` 与服务。
2. WebClient 通过菜单/动作解析请求，选择对应视图类型并加载必要的懒加载资产（如图表、透视）。
3. 视图层通过服务发起 JSON-RPC，后端控制器返回数据/元数据；视图渲染、挂载字段部件并处理用户交互。
4. 搜索栏构造 domain/context，再次 RPC 更新数据；导出/报表则调用对应控制器并使用专属资产呈现。

## 开发者关注要点

- 优先通过注册表与服务扩展，避免直接改动核心文件以降低升级冲突。
- 定制主题时修改 SCSS 变量或追加样式，减少覆盖核心选择器；暗色模式需对应 `*.dark.scss`。
- 引入新依赖应挂入 manifest 资产并考虑懒加载；保持与测试资产同步，避免测试缺失资源。
- 变更控制器/模型需同步处理权限与安全配置（`security/*.xml`、访问控制）。
