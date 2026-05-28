## Odoo 培训教程：Model / View / Action / Menu 机制讲解

- **适用对象**：Odoo 后端/前端开发、实施顾问、测试、运维、接口联调人员
- **学习目标**：
  - 理解 Odoo 中 **模型（Model）**、**视图（View）**、**动作（Action）**、**菜单（Menu）** 的职责边界
  - 掌握“从菜单点击到页面展示”的完整链路：`ir.ui.menu → ir.actions.* → ir.ui.view → model(record)`
  - 能快速排查常见问题：为什么某模型没有入口、为什么看不到某个视图、为什么打开的是别人的视图等
- **版本信息**：v1（2025-12-18）

### 目录

- 1. 四要素总览（一句话理解）
- 2. Model（模型）：数据与业务规则的中心
- 3. View（视图）：界面结构与交互的声明
- 4. Action（动作）：把“模型 + 视图 + 过滤条件/上下文”组合成可打开的页面
- 5. Menu（菜单）：给用户提供入口，并触发 Action
- 6. 从 Menu 到 View 的完整链路（强烈建议背下来）
- 7. 视图选择与继承机制（为什么会“打开的不是我定义的视图”）
- 8. 安全与可见性：ACL/Record Rule 对 Menu/Action/View 的影响
- 9. 常见排障场景与检查清单
- 10. 实操训练（建议 2–3 小时）

---

## 1. 四要素总览（一句话理解）

- **Model（模型）**：定义“业务数据是什么 + 业务规则是什么”（字段、约束、方法、权限基线）。
- **View（视图）**：定义“界面长什么样、有哪些字段/按钮/布局”（form/list/kanban/search 等）。
- **Action（动作）**：定义“打开哪个模型、用哪些视图、带什么 domain/context、默认怎么展示”。
- **Menu（菜单）**：定义“用户从哪里点进去”，通常绑定一个 Action。

一句话串起来：

> 用户点击 **Menu** → 触发 **Action** → Action 指向某个 **Model** 并选择合适的 **View** → 渲染并展示数据记录。

---

## 2. Model（模型）：数据与业务规则的中心

### 2.1 Model 的本质

在 Odoo 中，Model 是业务对象的代码定义，典型写法：

- Python 类继承 `models.Model`（持久化模型）
- `models.TransientModel`（向导/临时模型，数据通常会自动清理）
- `models.AbstractModel`（抽象基类，本身不可直接作为业务表使用）

> 重要结论：**模型可以存在但完全没有视图/Action/Menu**。是否“能在 UI 里直接打开”取决于后续是否配置 Action/Menu。

### 2.2 Model 对应的“技术记录”

- **模型元数据**：`ir.model`
- **字段元数据**：`ir.model.fields`

这些是“系统如何认识一个模型”的核心来源，也是很多动态能力（字段管理、权限、导出等）的基础。

### 2.3 模型与 UI 的关系（常见误区）

- **误区**：每个模型都应该有 form/list。
- **事实**：很多技术/中间/配置模型只用于被引用，不会暴露 UI 入口；也可能只提供向导视图（TransientModel）。

---

## 3. View（视图）：界面结构与交互的声明

### 3.1 View 在数据库中是什么

- 视图记录模型：`ir.ui.view`
- 关键字段（概念级）：
  - `name`：视图名称
  - `model`：对应的业务模型（如 `res.partner`）
  - `type`：视图类型（`form`/`tree`/`kanban`/`search`/`calendar`/`pivot`/`graph`/`activity`…）
  - `arch_db`：XML 结构（界面声明）
  - `inherit_id`：继承自哪个视图（视图继承核心）
  - `priority`：优先级（影响默认选择）

### 3.2 常见视图类型与用途

- **form**：编辑单条记录
- **tree（list）**：列表浏览多条记录
- **kanban**：看板
- **search**：搜索面板（过滤器、分组、搜索字段）

> 注意：前端页面上常把 `tree` 称为 list，这是历史命名差异。

### 3.3 视图继承（inherit）是 Odoo UI 定制的主路径

Odoo 鼓励“继承 + xpath 修改”而不是复制粘贴整份视图。

示意 XML（培训用示例，不保证与你们模块名一致）：

```xml
<record id="view_partner_form_inherit_demo" model="ir.ui.view">
  <field name="name">res.partner.form.inherit.demo</field>
  <field name="model">res.partner</field>
  <field name="inherit_id" ref="base.view_partner_form"/>
  <field name="arch" type="xml">
    <xpath expr="//field[@name='name']" position="after">
      <field name="x_demo_code"/>
    </xpath>
  </field>
</record>
```

要点：

- **继承链可能很长**：最终界面是“基视图 + 多个继承视图”叠加后的结果。
- **可见性可能受 group 限制**：视图或字段可能对某些用户组不可见。

---

## 4. Action（动作）：把“模型 + 视图 + 过滤条件/上下文”组合成可打开的页面

### 4.1 Action 的常见类型

- **窗口动作（最常见）**：`ir.actions.act_window`
  - 用来打开某个模型的列表/表单/看板等
- **服务器动作**：`ir.actions.server`
  - 触发 Python 逻辑、批处理、自动化
- 其他：报表、URL 动作等（不同版本/模块会有差异）

本培训重点关注 `ir.actions.act_window`，因为它连接了 Model 与 View。

### 4.2 `act_window` 的关键概念

窗口动作通常定义：

- **res_model**：目标模型
- **view_mode**：视图模式列表（如 `tree,form,kanban`）
- **views**：明确指定视图序列（可选；若不指定则由系统按规则挑选）
- **domain**：默认过滤条件（只展示满足条件的记录）
- **context**：默认上下文（默认值、行为开关、默认分组等）
- **target**：打开方式（当前页/弹窗等）

示意 XML：

```xml
<record id="action_partner_demo" model="ir.actions.act_window">
  <field name="name">客户（演示）</field>
  <field name="res_model">res.partner</field>
  <field name="view_mode">tree,form</field>
  <field name="domain">[("customer_rank", ">", 0)]</field>
  <field name="context">{"search_default_customer": 1}</field>
</record>
```

要点：

- **同一个模型可以有多个 Action**：入口不同，默认过滤/展示不同。
- **Action 可以决定默认打开哪种视图**：例如先 list 再 form。

---

## 5. Menu（菜单）：给用户提供入口，并触发 Action

### 5.1 Menu 在数据库中是什么

- 菜单记录模型：`ir.ui.menu`

关键概念：

- **parent_id**：父菜单
- **sequence**：排序
- **action**：绑定的动作（通常是 `ir.actions.act_window,<id>`）
- **groups_id**：允许看到此菜单的用户组

示意 XML：

```xml
<menuitem id="menu_partner_demo"
          name="客户（演示）"
          parent="base.menu_sales"
          action="action_partner_demo"
          sequence="10"/>
```

要点：

- **没有 action 的菜单**：通常只做分组/目录，不会打开页面。
- **菜单可见性受 group 限制**：你“看不到菜单”不等于它不存在。

---

## 6. 从 Menu 到 View 的完整链路（强烈建议背下来）

### 6.1 链路图（概念级）

- **菜单**：`ir.ui.menu`
  - 绑定 `action`
- **动作**：`ir.actions.act_window`（典型）
  - 指定 `res_model`
  - 指定 `view_mode` 或明确的 `views`
  - 提供 `domain/context`
- **视图**：`ir.ui.view`
  - 选择合适的 `type`（tree/form/kanban/search）
  - 合并继承视图得到最终 `arch`
- **数据**：模型表/记录（由 ORM 通过 Model 访问）

### 6.2 “为什么有模型但页面打不开”

典型原因按优先级排查：

- **没有 Menu**：没人给入口
- **有 Menu 但没 Action**：菜单是目录
- **有 Action 但 res_model 不对**：指向错误模型
- **有 Action 但 view_mode/views 配置不全**：例如只写了 `form` 没 list，或指定了不存在的 view
- **权限/记录规则阻断**：菜单可见，但记录不可读导致“空白/报错/无数据”

---

## 7. 视图选择与继承机制（为什么会“打开的不是我定义的视图”）

### 7.1 视图选择的常见来源

- **Action 显式指定 `views`**：优先使用指定的视图顺序
- **Action 只指定 `view_mode`**：系统会按模型 + 视图类型，结合优先级与继承结果挑选
- **上下文（context）影响**：某些场景会通过 context 强制某个视图/行为（例如默认分组、默认搜索过滤）

### 7.2 视图继承叠加后才是最终页面

同一个 `res_model + type` 下可能有：

- 1 个基础视图（不继承任何 view）
- N 个继承视图（`inherit_id` 指向基础视图或中间视图）

最终渲染：

- 服务端将继承链合并成最终 XML
- 客户端渲染为界面

### 7.3 常见现象与原因

- **现象**：我新增了字段，但界面看不到。
  - 可能原因：只加了字段到模型，没在任何 view 的 `arch` 中加入。
- **现象**：我写了继承 view，但打开页面没变化。
  - 可能原因：xpath 没匹配到（表达式错误）、继承视图未被加载（模块未更新）、受 group 限制、优先级被别的继承覆盖。

---

## 8. 安全与可见性：ACL/Record Rule 对 Menu/Action/View 的影响

### 8.1 三层常见控制

- **菜单层**：`ir.ui.menu.groups_id` 控制“看不看得到入口”
- **模型权限（ACL）**：控制“能不能读/写/创建/删除这个模型的记录”
- **记录规则（Record Rule）**：控制“能读/写哪些记录”（domain 级过滤）

### 8.2 常见误区

- **误区**：有菜单就一定能看到数据。
- **事实**：菜单可见只是入口；真正读数据还要过 ACL 与 Record Rule。

---

## 9. 常见排障场景与检查清单

### 9.1 场景 A：某个模型“没有视图/显示 0 个视图”

- **先确认定义层面**：是否存在 `ir.ui.view`（model=该模型）记录
- **再确认入口层面**：是否有 `ir.actions.act_window` 指向该模型
- **最后确认可见性**：是否被 group/权限隐藏（尤其是继承视图）

### 9.2 场景 B：有视图但 UI 看不到入口

- 是否缺少 `ir.ui.menu` 绑定 action
- 是否菜单被 `groups_id` 限制
- 是否 action 所属菜单在父菜单不可见（层级影响）

### 9.3 场景 C：打开页面但视图不对

- action 是否显式指定了 `views`
- 同类型 view 是否存在更高优先级/更后加载的继承覆盖
- 当前用户组是否导致“选中了另一套视图”

---

## 10. 实操训练（建议 2–3 小时）

### 10.1 练习 1：从菜单反查 action/model/view

- 找到任意一个业务菜单
- 识别它绑定的 action
- 记录 action 的 `res_model`、`view_mode`、`domain`、`context`
- 找到该模型的 tree/form/search 视图记录

### 10.2 练习 2：给现有模型增加一个字段并展示到 form

- 模型：任选一个可控的业务模型
- 增加字段（例如 `x_demo_code`）
- 通过继承 view 在 form 中插入字段
- 更新模块后验证生效

### 10.3 练习 3：为同一模型创建“不同入口”的两个 action

- action A：展示“全部记录”
- action B：通过 `domain` 只展示满足条件的记录
- 各自绑定不同菜单，体验“同模型不同入口”的效果

---

## 附：培训时建议强调的 5 句话（速记）

- **模型是数据与规则，视图只是展示**。
- **Action 决定打开什么（模型+视图+domain/context）**。
- **Menu 只是入口，不等于权限**。
- **看不到数据优先查 ACL/记录规则，再查 domain**。
- **“视图不生效”优先查继承 xpath、模块更新、用户组可见性**。
