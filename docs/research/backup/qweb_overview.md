# QWeb 模板引擎概览

本文介绍 Odoo 的 QWeb 模板引擎，涵盖语法要点、运行模式与扩展实践，便于编写界面与报表模板。

## 角色与适用场景

- Odoo 前端/后台界面渲染（WebClient 视图、组件模板）。
- 报表与邮件模板生成（HTML → PDF/文本）。
- 可与 XML 视图、资产体系、RPC 数据结合，实现动态 UI 与文档输出。

## 核心语法速览

- **变量插值**：`t-esc="expr"` 转义输出，`t-raw="expr"` 原样输出（谨慎使用）。
- **条件**：`t-if` / `t-elif` / `t-else`。
- **循环**：`t-foreach="seq"` 配合 `t-as="item"`；可用 `t-foreach-index` 获取索引。
- **设置与表达式**：`t-set="name"` 赋值，`t-value="expr"`；支持 `t-att-*` 设置属性、`t-attf-*` 格式化属性。
- **调用与继承**：`t-call="template_name"` 复用模板；`t-call-assets` 引入资产 bundle；通过 `inherit_id` + `xpath` 对已有模板插槽式修改。
- **占位与片段**：`t-slot` 定义插槽，`t-snippet`/`data-oe-*` 用于网站构建器场景。
- **国际化**：`t-translation="off/attributes/translate"` 控制可译性。

## 运行与渲染流程

- 模板载入：QWeb 模板定义存储于数据库（`ir.ui.view`）或 XML 文件，模块加载时解析并存入 registry，继承链按模块顺序与 `priority` 解析。
- 前端渲染：WebClient/OWL 组件读取 XML 模板，利用环境数据（`env`、`props`、上下文）完成渲染；模板与 JS 组件一一对应，遵循数据驱动渲染。
- 报表渲染：服务器侧以 QWeb 渲染 HTML，再由 wkhtmltopdf/WeasyPrint 转 PDF；可通过 `t-call-assets`/自定义 bundle 注入报表样式，支持页眉/页脚与公司抬头。
- 查找优先级：模板解析时按模块加载顺序与继承关系叠加，后加载的继承可覆盖前者；前端模板热重载依赖资产加载顺序。

## 运行机制详解

- **解析阶段**：XML 模板在模块安装/更新时解析，`inherit_id` + `xpath` 生成合并后的最终模板，缓存于 registry（区分数据库）。
- **上下文与环境**：
  - 服务器报表：上下文来自动作/模型/请求参数，通过渲染函数传入。
  - 前端：环境来自 WebClient `env`（用户、语言、时区、会话）与组件 `props/state`。
- **表达式求值**：`t-esc`/`t-raw`、`t-if`、`t-foreach` 等表达式在渲染时执行，使用 Odoo 安全的表达式求值（Python 端）或 JS 运行时（前端）。
- **资产挂载**：`t-call-assets` 根据 manifest bundle 注入所需 JS/CSS，报表/前端可使用不同 bundle；确保模板所需资源可用。
- **输出阶段**：
  - 前端：产出 DOM 片段由 OWL/客户端框架插入或更新。
  - 报表：产出 HTML，再转 PDF 或直接返回 HTML，必要时处理字体/RTL/分页。
- **缓存与失效**：模板解析结果缓存在 registry，模块升级、视图更新或调试模式下会触发失效重载；报表可按上下文缓存生成结果（取决于实现）。

## 扩展与最佳实践

- 尽量使用 `inherit_id` + `xpath` 进行增量修改，避免复制整段模板。
- 默认使用 `t-esc` 确保转义；仅在可信内容时使用 `t-raw`。
- 利用 `t-att-*`/`t-attf-*` 动态生成属性，保持模板简洁；减少在模板中编写复杂逻辑，将业务计算放在模型/控制器。
- 报表模板需关注分页、字体、RTL、本地化格式；必要时为报表定义独立的 assets bundle。
- 前端组件模板应与对应的 JS/OWL 组件保持数据约定，避免直接操作 DOM。

## 常见调试手段

- 启用调试模式查看模板继承链与最终渲染。
- 检查资源加载（assets）与上下文变量来源（控制器/视图数据）。
- 对报表使用 HTML 预览定位布局问题，确认 CSS 与字体可用。
