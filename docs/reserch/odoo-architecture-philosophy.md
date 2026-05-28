# Odoo 架构哲学分析

> 基于 Odoo 19 CE 源码（`~/EA/odoo`）的事实分析，并说明 OdooSeek 如何遵循这一哲学。

---

## 一、核心论断：元数据解释器

在众多开源企业级框架中，Odoo 以其独特的架构设计令人印象深刻。如果说大多数 Web 框架是"编写程序"，那么 Odoo 更像是在"**定义元数据**"——Python 和 JavaScript 实现了解释引擎，而真正定义业务形态的模型、视图、路由、权限、自动化流程，全部以声明式数据的形式存储在数据库中。

> **数据定义程序，而非程序定义数据。**

| OdooSeek 遵循 | 说明 |
|:---:|------|
| ✅ | 保留 Odoo 元数据驱动内核（`ir.*` 表、XML 视图声明、声明式权限） |
| ✅ | 保留 Odoo 业务逻辑（Python ORM、工作流、报表、自动化） |
| ✅ | 仅替换前端渲染层（OWL/QWeb → React SPA）和通信层（WSGI → Rust BFF） |

---

## 二、深度数据依赖：元数据驱动运行时

在传统 Web 框架（Django、Spring、Rails）中，模型用类定义，视图用模板编写，路由用装饰器注册，程序的结构由代码静态决定。Odoo 不同：

### 2.1 模型定义

**源码**: `odoo/addons/base/models/ir_model.py`

| 事实 | 说明 |
|------|------|
| 字段存储 | `ir.model.fields` 表存储字段名、类型、标签、必填、只读等属性 |
| 运行时注册 | `registry.setup_models()` 加载 Python 类并根据 `ir.model.fields` 动态构建字段 |
| 自定义字段 | 向 `ir.model.fields` 插入记录即可新增字段，无需修改 Python 代码 |

```
odoo/orm/registry.py:335  → registry.models[model_name]  # 运行时模型查找
odoo/orm/environments.py:107 → env['res.users']           # 动态模型引用
```

### 2.2 视图定义

**源码**: `odoo/addons/base/models/ir_ui_view.py`

| 事实 | 说明 |
|------|------|
| 存储表 | `ir.ui.view` — `arch_db` 字段存储 XML 字符串 |
| 视图类型 | `type` 字段: `list` (非 `tree`), `form`, `kanban`, `graph`, `pivot`, `calendar`, `search`, `qweb` |
| `get_view()` | 返回 `{arch, id, model}` — 不含字段定义 |
| `get_views()` | 返回 `{views: {type: {arch, id}}, models: {model: {fields: {...}}}}` — 一次调用获取所有视图 + 字段 |
| 继承机制 | `inherit_id` + `<xpath>` 表达式，`_combine()` 递归合并 |
| 运行时生效 | 修改 `ir.ui.view` 记录，清缓存即生效，无需重启 |
| 计算字段 | `arch` 是 computed 字段（从 `arch_db` 或 `arch_fs` 读取） |

> ❌ `fields_view_get()` 在 Odoo 19 CE 中**已移除**，被 `get_views()` 替代。

### 2.3 菜单与动作

**源码**: `odoo/addons/base/models/ir_ui_menu.py`

| 事实 | 说明 |
|------|------|
| 菜单表 | `ir.ui.menu` — `parent_id`, `action`（外部 ID 引用）, `sequence` |
| 动作表 | `ir.actions.act_window`, `ir.actions.client`, `ir.actions.act_url`, `ir.actions.server`, `ir.actions.report` |
| `act_window` | `res_model` 字段决定目标模型，`view_mode` 决定视图类型 |
| 运行时解析 | 菜单查询 → 解析 `action` 引用 → 读取对应动作表 → 获取 `res_model` |

> OdooSeek 的 MenuPage 通过 `callKw('ir.actions.act_window', 'read', ...)` 动态解析菜单到模型的映射，遵循 Odoo 的运行时解析模式。

### 2.4 权限系统

**源码**: `odoo/addons/base/models/ir_rule.py`

| 事实 | 说明 |
|------|------|
| 声明式 | `<record model="ir.rule">` + domain 表达式定义规则 |
| 运行时注入 | `_compute_domain()` 将用户规则合并到 ORM 查询的 WHERE 条件中 |
| 字段级权限 | `ir.model.access` 表控制 CRUD 权限 |

---

## 三、声明式编程：描述"是什么"，而非"怎么做"

### 3.1 视图声明

```xml
<!-- 只需声明要显示什么字段，如何渲染由框架决定 -->
<field name="name"/>                    <!-- 渲染为 <input> 或只读文本 -->
<field name="company_id"                <!-- many2one 下拉搜索 -->
       widget="many2one_avatar_user"
       domain="[('share', '=', False)]"/>
```

### 3.2 权限声明

```xml
<!-- 声明：用户只能看本公司的记录 -->
<record model="ir.rule" id="partner_company_rule">
  <field name="domain_force">[('company_id', '=', user.company_id)]</field>
</record>
```

### 3.3 自动化声明

```xml
<!-- 声明：创建线索后自动发邮件 -->
<record model="base.automation" id="lead_assign_automation">
  <field name="trigger">on_create_or_write</field>
  <field name="model_id" ref="crm.model_crm_lead"/>
  <field name="filter_domain">[('user_id', '=', False)]</field>
</record>
```

### 3.4 视图继承（零代码定制）

```xml
<!-- 在 res.partner 表单的 email 字段后面插入 VAT 字段 -->
<record id="view_partner_form_inherit" model="ir.ui.view">
  <field name="inherit_id" ref="base.view_partner_form"/>
  <field name="arch" type="xml">
    <xpath expr="//field[@name='email']" position="after">
      <field name="vat"/>
    </xpath>
  </field>
</record>
```

---

## 四、Odoo 19 CE 统一 API 架构

### 4.1 单一 RPC 入口

**源码**: `odoo/addons/web/controllers/dataset.py`

```python
@http.route(['/web/dataset/call_kw', '/web/dataset/call_kw/<path:path>'],
            type='jsonrpc', auth="user")
def call_kw(self, model, method, args, kwargs, path=None):
    return call_kw(request.env[model], method, args, kwargs)
```

| 要点 | 说明 |
|------|------|
| **所有操作走此入口** | `search_read`, `read`, `write`, `create`, `unlink`, `get_views`, `fields_get` 全部通过此端点 |
| **Method 字段被忽略** | Odoo's JsonRPCDispatcher 明确声明：`method` member of the JSON-RPC request payload is **ignored** |
| **Params 必须是 Object** | JSON-RPC `params` MUST be a JSON Object, NOT a JSON Array |
| **无独立端点** | `/web/dataset/search_read` 作为独立端点**不存在**于 Odoo 19 CE |

### 4.2 JSON-RPC 请求格式

```json
POST /web/dataset/call_kw
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "res.partner",
    "method": "search_read",
    "args": [[], ["id", "name"]],
    "kwargs": { "limit": 80, "offset": 0 }
  },
  "id": 1
}
```

### 4.3 Session API

**源码**: `odoo/addons/web/controllers/session.py`

| 端点 | 参数 | 返回 |
|------|------|------|
| `POST /web/session/authenticate` | 平面 `{db, login, password}` | 完整 `session_info()` (50+ 键) |
| `POST /web/session/get_session_info` | `{}` | 同上 |
| `POST /web/session/destroy` | `{}` | null |

> `authenticate()` 成功返回包含 `uid`, `name`, `username`, `is_admin`, `is_system`, `partner_id`, `partner_display_name`, `server_version`, `user_companies`, `user_context`, `home_action_id`, `currencies`, `groups` 等的完整会话信息。

### 4.4 Bus 架构

**源码**: `odoo/addons/bus/controllers/main.py`, `websocket.py`

| 端点 | 用途 |
|------|------|
| `POST /websocket/peek_notifications` | 轮询：`{channels, last, is_first_poll}` → `{channels, notifications: [{id, message}]}` |
| `ws://odo/websocket` | WebSocket 主通道 |

> ❌ `/web/bus/poll` **不存在**于 Odoo 19 CE。OdooSeek 的 `ws.rs` 在代码审计后已修正。

---

## 五、为什么选择这种架构？

### 5.1 模块化与继承

- 成百上千个模块互相叠加、继承、覆盖，不能修改原模块代码
- `<xpath>` 声明式继承实现零冲突扩展

### 5.2 运行时定制

- 用户/管理员通过开发者模式直接编辑视图、菜单、动作
- 本质上是修改 `ir.ui.view` 等表中的数据记录

### 5.3 统一元数据

- ORM、视图引擎、安全框架、报表引擎读取同一套 `ir.*` 元数据
- 保证各组件行为一致性，降低耦合

---

## 六、代价

| 代价 | 说明 |
|------|------|
| 调试困难 | 错误信息常指向 XML 视图的某个字段的某个属性，需查询 `ir.model.data` 追踪 |
| 性能开销 | 每次请求需查库获取视图结构、动作定义、字段属性；依赖强力缓存 |
| 学习曲线 | 需先理解 `ir.model`, `ir.ui.view`, `ir.actions.*` 等元数据表的工作方式 |
| 迁移困难 | 升级大版本时，不仅要改 Python 代码，还要迁移声明式数据 |

---

## 七、OdooSeek 的遵循

| Odoo 原则 | OdooSeek 实现 |
|-----------|--------------|
| **元数据驱动视图** | `OdooViewLoader` 调用 `get_views()` 获取 `<list>`, `<form>` XML 和字段元数据 |
| **声明式渲染** | `parseListXml`, `parseFormXml` 解析 XML → React 组件递归渲染，不硬编码布局 |
| **统一 call_kw 入口** | `api.ts` 全部通过 `/web/dataset/call_kw` 调用 ORM，无独立端点 |
| **Session 认证** | `session.rs` 使用正确的 `/web/session/authenticate` + 平面 params |
| **菜单动态解析** | `MenuPage` 通过 `callKw('ir.actions.act_window', 'read')` 动态获取 `res_model` |
| **视图类型正确** | 使用 `list` 而非 `tree`，匹配 Odoo 19 CE 命名 |

---

> *"我们不是在逃离 Odoo，而是在拓宽它的边界。保留它的灵魂，更换它的外衣。"*

---

**文档版本**: 2.0  
**创建日期**: 2026-05-28  
**更新**: 基于 Odoo 19 CE 源码事实修正（源码路径、API 签名、端点命名）  
**维护团队**: OdooSeek
