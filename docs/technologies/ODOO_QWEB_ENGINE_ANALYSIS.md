# Odoo QWeb 模版引擎 源码分析

> **目标**：从 Odoo 19 CE 源码出发，理解 QWeb 模版引擎架构、它如何与 XML 视图协作实现通用视图差异化、以及对 OdooSeek 的启示。

---

## 一、为什么 Odoo 有两套"视图层"？

**XML 视图** (`<form>`, `<list>`, `<kanban>`, `<search>`) 和 **QWeb 模版** (`<templates>`) 是 Odoo 前端渲染的两条并行管线：

| 维度 | XML 视图 (View) | QWeb 模版 (Template) |
|------|----------------|---------------------|
| **定位** | 声明字段 + 布局结构 | 生成最终 HTML 输出 |
| **存储** | `ir.ui.view` 表，type=form/tree/kanban | `ir.ui.view` 表，type=qweb |
| **处理方式** | ORM view parser → `fields_view_get()` | QWeb 编译器 → 生成 Python 函数 |
| **渲染时机** | 服务端：生成 `fields` + `arch` JSON | 服务端：生成 HTML 字符串 |
| | 客户端 (OWL)：`arch` XML → block DOM | 客户端 (OWL)：block DOM → DOM |
| **指令** | `<field>`, `<group>`, `<notebook>` 等 | `t-if`, `t-foreach`, `t-out`, `t-call` 等 |
| **使用场景** | 通用 CRUD 界面 (list/form/kanban) | 网站、报表、邮件、看板卡片 |

**核心区别**：XML 视图定义 **"什么字段、什么布局"**，QWeb 控制 **"如何渲染、何时显示"**。两者在 Odoo 中不是对立而是互补的。

---

## 二、QWeb 引擎架构

### 2.1 核心文件

| 文件 | 行数 | 角色 |
|------|------|------|
| `odoo/addons/base/models/ir_qweb.py` | 2980 | **核心引擎** — `IrQweb` 类 (模型名 `ir.qweb`) |
| `odoo/addons/base/models/ir_qweb_fields.py` | 904 | **字段转换器** — 21 个 `IrQwebField*` 类 |
| `odoo/addons/base/models/ir_ui_view.py` | 3609 | **视图模型** — 存储模板、视图继承 |
| `odoo/tools/template_inheritance.py` | 344 | **继承引擎** — `apply_inheritance_specs()` |
| `odoo/addons/web/controllers/report.py` | ~50 | Web 入口：PDF/HTML/Text 渲染 |

### 2.2 渲染管线

```
ir.ui.view (arch_db)
    │
    ▼
apply_inheritance_specs()                  ← template_inheritance.py
    │  (组合父视图 + 继承视图，通过 xpath 合并)
    ▼
ir.qweb._render(template_id, values)
    │
    ├─ _prepare_environment(values)        ← 设置上下文变量
    │     request, user_id, env, debug, lang,
    │     time, datetime, json, image_data_uri, ...
    │
    ├─ _get_template(template)             ← 从 DB 加载 lxml etree
    │     └─ _preload_trees()              ← 递归预加载 t-call 引用的模板
    │
    ├─ _compile(template)                  ← 编译为 Python 生成器函数
    │     ├─ _generate_code(template)      ← XML etree → Python 源码字符串
    │     │     └─ _compile_node()          ← 遍历每个 XML 节点
    │     │           └─ _compile_directives() ← 按优先级处理 QWeb 指令
    │     │                 (_compile_directive_if/foreach/out/call/set/att...)
    │     └─ unsafe_eval(code)             ← 编译 Python 字符串为函数对象
    │
    └─ _render_iterall()                   ← 栈式执行生成器
          └─ 栈深度上限: 50
```

### 2.3 编译模型：运行时 JIT，非预编译

QWeb 模板在**首次请求时编译**，通过 ORM Cache 缓存（缓存键: `lang`, `inherit_branding`, 等）：

1. **XML → Python 源码**: `_generate_code()` 遍历 lxml etree，对每个节点和指令生成 Python 代码字符串
2. **Python 源码 → 函数**: `unsafe_eval()` 用 `compile()` + `exec()` 将源码转为生成器函数
3. **执行**: `_render_iterall()` 用栈式结构消费生成器，逐个产出 HTML 字符串块

---

## 三、QWeb 指令全集

编译优先级由 `_directives_eval_order()` 定义（`ir_qweb.py:1586`）：

### 3.1 条件渲染

| 指令 | 说明 | 示例 |
|------|------|------|
| `t-if` | Python `if` 条件 | `<div t-if="record.type == 'lead'">` |
| `t-elif` | Python `elif` | `<div t-elif="record.type == 'opportunity'">` |
| `t-else` | Python `else` | `<div t-else="">` |
| `t-groups` / `groups` | 用户组权限检查 | `<div groups="base.group_user">` |

### 3.2 迭代

| 指令 | 说明 | 自动变量 |
|------|------|----------|
| `t-foreach` | Python 迭代 | `{var}_index`, `{var}_first`, `{var}_last`, `{var}_even`, `{var}_size` |
| `t-as` | 迭代变量名 | — |

### 3.3 输出

| 指令 | 说明 | 示例 |
|------|------|------|
| `t-out` | 转义输出 (HTML安全) | `<span t-out="record.name"/>` |
| `t-field` | 字段输出 (使用字段转换器) | `<field t-field="record.amount" t-options-widget="'monetary'"/>` |
| `t-esc` | ⚠️ 已废弃 — 替换为 `t-out` | |
| `t-raw` | ⚠️ 已废弃 — 替换为 `Markup()` + `t-out` | |

### 3.4 变量

| 指令 | 说明 | 示例 |
|------|------|------|
| `t-set` | 设置变量 | `<t t-set="total" t-value="sum(values)"/>` |
| `t-value` | 表达式值 | `t-value="record.amount * 2"` |
| `t-valuef` | 格式化字符串值 | `t-valuef="Price: ${price}"` |

### 3.5 模板调用

| 指令 | 说明 | 示例 |
|------|------|------|
| `t-call` | 调用子模板 | `<t t-call="web.layout"/>` |
| `t-name` | 模板命名 | `<t t-name="card">...</t>` |
| `t-call-assets` | 生成资源链接 | `<t t-call-assets="web.assets_common"/>` |

### 3.6 动态属性

| 指令 | 说明 | 示例 |
|------|------|------|
| `t-att` | 动态属性字典 | `t-att="{'class': 'active' if is_active else ''}"` |
| `t-att-*` | 单个动态属性 | `t-att-class="is_active ? 'active' : ''"` |
| `t-attf-*` | 格式化字符串属性 | `t-attf-class="card-{{ color }}"` |

### 3.7 内部指令 (不用于业务模板)

`t-tag-open`, `t-tag-close`, `t-inner-content`, `t-qweb-skip`, `t-else-valid`, `t-consumed-options`, `t-ignore`

### 3.8 客户端专用 (OWL)

`t-inherit`, `t-inherit-mode`, `t-key`

---

## 四、QWeb 评价上下文 — 可用变量

由 `_prepare_environment()` (`ir_qweb.py:1249`) 设置：

| 变量 | 值 | 来源 |
|------|-----|------|
| `request` | 当前 HTTP 请求 (或 None) | `odoo.http` |
| `user_id` | 当前用户 (带 env) | `self.env.user` |
| `res_company` | 当前公司 (sudo) | `self.env.company` |
| `env` | Odoo 环境 | `self.env` |
| `debug` | 调试模式 | `request.session.debug` |
| `lang` | 当前语言 | context |
| `time` / `datetime` | 时间函数 | `safe_eval` |
| `json` | 自定义 JSON 序列化器 | `QwebJSON` |
| `image_data_uri` | 图片转换函数 | 内部 |
| `keep_query` | URL 查询保留函数 | 内部 |
| `floor` / `ceil` | 数学函数 | `math` |
| `xmlid` / `viewid` | 模板 XML ID / DB ID | 生成器包装 |
| **调用者传入** | `record`, `object`, `company`, `website` 等 | `values` dict |

`t-foreach` 自动变量: `{var}_size`, `{var}_index`, `{var}_first`, `{var}_last`, `{var}_odd`, `{var}_even`, `{var}_parity`

---

## 五、QWeb 字段转换器

`ir.qweb.field` 模型有 21 个子类，每个负责将 Odoo 字段值转为 HTML 表示：

| 类名 | 字段类型 | 转换逻辑 |
|------|----------|----------|
| `IrQwebField` | 基类 | 纯文本输出 |
| `Integer` | integer | 数字格式化 |
| `Float` | float | 浮点格式化 |
| `Monetary` | monetary | 货币格式化 + 货币符号 |
| `Date` | date | 日期格式化 |
| `Datetime` | datetime | 日期时间格式化 |
| `Text` | text | 文本转 HTML |
| `Html` | html | 原始 HTML (不转义) |
| `Many2one` | many2one | `[id, display_name]` → display_name |
| `Many2many` | many2many | 标签列表渲染 |
| `One2many` | one2many | 链接列表 |
| `Image` | binary(图像) | Base64 → `<img>` 或 URL |
| `Image_Url` | binary(URL) | 直接 URL |
| `Selection` | selection | 显示文本 |
| `Contact` | 聚合 | 联系人卡片 (图标+姓名+邮箱) |
| `Barcode` | 条码 | SVG 条码渲染 |
| `Relative` | 相对时间 | "2 天前" 等 |
| `Duration` | timedelta | "3h 20m" |
| `Float_Time` | float(time) | "3:20" |
| `Time` | time | 时间格式化 |
| `Qweb` | 子模板 | 嵌套 QWeb 渲染 |

---

## 六、QWeb + XML 视图的协作 — 以 Kanban 为例

这是 QWeb 与 XML 视图融合的最佳示例：

```xml
<kanban default_group_by="stage_id" class="o_opportunity_kanban">
    <!-- 1. 顶级 <field> — 用于 search_read 确定获取哪些字段 -->
    <field name="name"/>
    <field name="expected_revenue"/>
    <field name="priority"/>

    <!-- 2. <templates> — QWeb 模版，定义卡片外观 -->
    <templates>
        <t t-name="card">
            <!-- QWeb 指令 + 字段 Widget -->
            <field name="name" class="fw-bold fs-5"/>
            
            <div t-if="record.expected_revenue">
                <field name="expected_revenue" widget="monetary"/>
            </div>
            
            <field name="partner_id" widget="many2one_avatar"/>
            <field name="tag_ids" widget="many2multi_tags"/>
            
            <!-- t-foreach 迭代标签 -->
            <t t-foreach="record.tag_ids" t-as="tag">
                <span t-out="tag[1]"/>
            </t>
        </t>
    </templates>
</kanban>
```

**两套语义的协作**：
1. 顶级 `<field>` — 告诉 `search_read` 需要获取哪些字段数据
2. `<templates>` 中的 `<field>` — 定义卡片如何展示数据，支持 QWeb 指令（`t-if`, `t-foreach`）

`_is_qweb_based_view()` 在 `ir_ui_view.py:2131` 返回 `True` 使得 **kanban 视图标记为 QWeb 兼容**，因此 QWeb 指令在 kanban arch 中有效。

---

## 七、视图继承与 QWeb

QWeb 模板的继承使用与 XML 视图相同的 `template_inheritance.py` 引擎：

```
ir.ui.view (父模板)
    ↑
    ↓ apply_inheritance_specs()
    ├── <xpath expr="//t[@t-name='card']" position="inside">
    │       <field name="new_field"/>
    │   </xpath>
    └── 合并后的 arch → 传给 QWeb 编译器
```

客户端 OWL 模板使用 `t-inherit` 属性实现类似功能：
```xml
<t t-name="card" t-inherit="crm.crm_lead_view_kanban" t-inherit-mode="extension">
    <xpath expr="//field[@name='name']" position="after">
        <field name="custom_field"/>
    </xpath>
</t>
```

---

## 八、安全机制

| 机制 | 位置 | 说明 |
|------|------|------|
| MarkupSafe | `ir_qweb.py:44` | 所有输出为 `Markup` 类型，自动转义 |
| Opcode 白名单 | `ir_qweb.py:420-458` | `_SAFE_QWEB_OPCODES` 限制 Python 操作码 |
| `javascript:` 检测 | `ir_qweb.py:484` | 阻止 `<a href="javascript:...">` XSS |
| `safe_eval.check_values()` | `ir_qweb.py:719` | 渲染前验证 values dict |
| 变量名限制 | `ir_qweb.py:1485` | 禁止 `__` 在变量名中 |
| 邮件安全 | `mail/models/ir_qweb.py:15-21` | 仅允许 `out`, `att`, `inner-content` 等安全指令 |
| 栈深度限制 | `ir_qweb.py:747-748` | 最大 50 帧，防止递归耗尽 |

---

## 九、对 OdooSeek 的启示

### 9.1 当前对齐度

| QWeb 能力 | OdooSeek 处理 | 状态 |
|-----------|--------------|------|
| 顶级 `<field>` 提取 | `parseKanbanXml()` → `fields[]` → `search_read` | ✅ 已实现 |
| 卡片模板解析 | `parseKanbanFields()` → `cardFields[]` → Widget 渲染 | ✅ 已实现 |
| `<templates>` 提取 | `querySelector('templates')` | ✅ 已实现 |
| `t-if` 条件渲染 | ❌ 未处理 — 所有字段始终显示 | ⚠️ 需支持 |
| `t-foreach` 迭代 | ❌ 未处理 — many2many 标签等不渲染 | ⚠️ 需支持 |
| `t-out` 输出 | ❌ 未处理 — 纯文本混合字段 | ⚠️ 需支持 |
| `t-att` / `t-attf` 属性 | ❌ 未处理 — 忽略 CSS 类 | 低优先级 |
| `t-call` 子模板 | ❌ 未处理 | 低优先级 |
| `<footer>`, `<widget>` | ❌ 未处理 | 低优先级 |
| 视图继承 (`<xpath>`) | ❌ 未处理 | 低优先级 |
| 字段转换器 (Currency, Date等) | ✅ 部分支持 (15 种 Widget) | — |

### 9.2 最小可行对齐策略

```
Odoo QWeb                       OdooSeek (React)
─────────                       ────────────────
<t t-if="condition">         →  {condition && <Component/>}
<t t-foreach="list" t-as="v">→  {list.map(v => <Component/>)}
<t t-out="expr"/>            →  {String(expr)}
<field widget="X"/>           →  getFieldWidget(field, type)
<sibling t-elif>              →  三元表达式 / switch
```

**建议实现顺序**：
1. **`t-if` / `t-elif` / `t-else`**: 在 `parseKanbanFields` 返回的字段上标记 `invisible` 或新增 `condition` 属性。渲染时条件判断。
2. **`t-foreach`**: 解析 `t-as` 变量名和迭代表达式，渲染时展开为子组件。
3. **`t-out`**: 当模板块包含纯文本 + 内联表达式时，用占位符替换并运行时求值。
4. **`t-att`**: 解析 CSS 类表达式，动态设置组件 className。

### 9.3 是否需要在 OdooSeek 中实现 QWeb 引擎？

**不需要**。理由：

- Odoo QWeb 是服务端 Python → HTML 的编译-执行管线，依赖 `safe_eval`、`ir.qweb.field` 转换器和 ORM 环境
- OdooSeek 是纯前端渲染，React 本身就提供了条件渲染 (`{cond && ...}`)、迭代 (`{list.map(...)}`)、模板组合 (`<Component/>`) 的能力
- 将 QWeb 指令**映射为 React 模式**是正确策略，而不是移植一个 Python 编译引擎到 TypeScript

**核心原则**：不重写 QWeb 引擎，而是**解析 QWeb 语义并用 React 等价表达**。

---

## 十、关键源码索引

| 关注点 | 文件 | 行号 |
|--------|------|------|
| QWeb 主类 | `base/models/ir_qweb.py` | 663 (`class IrQweb`) |
| 渲染入口 | `base/models/ir_qweb.py` | 675 (`_render`) |
| 编译 | `base/models/ir_qweb.py` | 917 (`_compile`) |
| 节点编译 | `base/models/ir_qweb.py` | 1627 (`_compile_node`) |
| 指令编译 | `base/models/ir_qweb.py` | 2095-2780 (各 `_compile_directive_*`) |
| 环境准备 | `base/models/ir_qweb.py` | 1249 (`_prepare_environment`) |
| 栈渲染 | `base/models/ir_qweb.py` | 727 (`_render_iterall`) |
| 安全 opcode 白名单 | `base/models/ir_qweb.py` | 420-458 |
| 字段转换器基类 | `base/models/ir_qweb_fields.py` | 47 (`IrQwebField`) |
| is_qweb_based_view | `base/models/ir_ui_view.py` | 2131 |
| 视图继承引擎 | `tools/template_inheritance.py` | 107 (`apply_inheritance_specs`) |
| render_template | `base/models/ir_ui_view.py` | 2531 |
| 报表 PDF 渲染 | `base/models/ir_actions_report.py` | 1023 |
| 离线 render() | `base/models/ir_qweb.py` | 2897 |
| 客户端模板注册 | `web/static/src/core/templates.js` | 131 |
| 客户端渲染 | `web/static/src/core/utils/render.js` | 5-70 |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**来源**: Odoo 19 CE 源码 (`~/EA/odoo`)  
**维护团队**: OdooSeek
