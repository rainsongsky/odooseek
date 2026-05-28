# OdooSeek 业务逻辑对齐分析与优化机会

> **来源**: Odoo 19 CE 源码校验  
> **日期**: 2026-05-28

---

## 一、设计缺陷总览（按影响排序）

| # | 缺陷 | 影响 | Odoo 源码依据 |
|---|------|------|--------------|
| 1 | **修饰器表达式仅处理静态值** | 动态 `invisible`/`readonly`/`required` 不生效 | `ir_ui_view.py:34` VIEW_MODIFIERS |
| 2 | **无 onchange 支持** | 字段修改不触发服务端业务逻辑 | `web/models/models.py:1909` onchange() |
| 3 | **无 default_get** | 新建记录无默认值 | `orm/models.py:1271` default_get() |
| 4 | **decoration-* 被忽略** | 列表/看板无状态颜色标记 | `field.js:224` parseFieldNode |
| 5 | **domain 属性未求值** | many2one 选择器无过滤 | `ir_ui_view.py:1663` domain handling |
| 6 | **context 属性未传递** | 默认值和动作上下文丢失 | `field.js:260` context extraction |

---

## 二、修饰器表达式 — 最大影响

### 2.1 当前状态

```typescript
// OdooSeek: 仅处理静态布尔值
const readOnly = !!(el.readonly ?? meta.readonly)  // 只能是 true/false
```

### 2.2 Odoo 实际行为

```xml
<!-- sale_order_views.xml:130 -->
<field name="date_order" readonly="state in ['cancel', 'sale']"/>
<!-- sale_order_views.xml:119 -->
<field name="partner_id" readonly="1"/>
<!-- account_views.xml:41 -->
<field name="team_id" column_invisible="context.get('default_move_type') not in ('out_invoice', 'out_refund', 'out_receipt')"/>
```

Odoo 在服务端只验证表达式语法（`_validate_expression()`），不求值。求值在客户端通过 `evaluateBooleanExpr()` 实时执行。

### 2.3 优化方案

在 `OdooFormRenderer` 的 `FormLayoutNode` 中求值修饰器：

```typescript
// 解析修饰器表达式为布尔值
function evalModifier(expr: string | undefined, record: Record<string, unknown>): boolean {
  if (!expr || expr === 'False' || expr === '0') return false
  if (expr === 'True' || expr === '1') return true
  return evaluateBooleanExpr(expr, record)  // 复用 Phase 4 的表达式求值器扩展
}
```

但需要扩展表达式求值器支持 `in`、`not in`、`context` 等 Python 语法。

### 2.4 影响范围

- `OdooFormRenderer` — readonly/required/invisible 动态化
- `OdooListRenderer` — column_invisible + decoration-* 支持
- `OdooKanbanRenderer` — decoration-* 卡片状态颜色

---

## 三、onchange — 缺失的业务逻辑链

### 3.1 Odoo onchange 工作机制

```
用户修改字段
  ↓
客户端检测 field.onChange=true → 调用 onchange RPC
  ↓
POST /web/dataset/call_kw
  { model, method: "onchange", args: [[ids], values, [fieldName], fieldsSpec] }
  ↓
服务端: default_get(首次) → 创建伪记录 → 应用 @api.onchange 方法
  → 计算 computed 字段 → 运行级联 → 返回 diff
  ↓
客户端: 合并返回值到表单
  result: { value: {partner_name: "Acme", ...}, warning: {title, message, type} }
```

### 3.2 对 OdooSeek 的影响

**缺失 onchange 的后果**:
- 修改 `product_id` → `price_unit` 不自动填充
- 修改 `partner_id` → `pricelist_id` 和地址不自动更新
- 计算字段（`amount_total` 等）不随明细行变化更新

### 3.3 优化方案

在 `OdooFormRenderer` 的 `handleChange` 中触发 onchange：

```typescript
async function handleChange(name: string, value: unknown) {
  setFormValues(prev => {
    const next = { ...prev, [name]: value }
    // 异步触发 onchange（不阻塞 UI）
    triggerOnchange(name, next)
    return next
  })
}

async function triggerOnchange(fieldName: string, values: Record<string, unknown>) {
  const fieldNames = [fieldName]
  const fieldsSpec = buildFieldsSpec(fields)  // 构建字段规范
  const result = await callKw(model, 'onchange', [
    recordId ? [recordId] : [],  // 现有记录ID或空(新记录)
    values,                       // 所有表单值
    fieldNames,                   // 修改的字段
    fieldsSpec,                   // 字段规范
  ])
  if (result.value) {
    setFormValues(prev => ({ ...prev, ...normalizeOnchangeValues(result.value) }))
  }
  if (result.warning) {
    showWarning(result.warning)
  }
}
```

### 3.4 优先级

P0 — 阻塞核心业务逻辑链，影响销售/采购等所有模块。

---

## 四、default_get — 新建记录默认值

### 4.1 Odoo 默认值机制

```
POST /web/dataset/call_kw
  { model, method: "default_get", args: [["partner_id", "date_order", "user_id"]], kwargs: {context} }
```

5 级优先级:
1. `context['default_<field>']` — 来自动作/菜单
2. `ir.default` 用户默认值 (非 company-dependent)
3. `field.default` callable (Python 字段定义)
4. `ir.default` 用户默认值 (company-dependent fallback)
5. 父模型委托 (`_inherits`)

### 4.2 优化方案

```typescript
// 在进入新建表单时调用
const defaultValues = await callKw(model, 'default_get', [
  Object.keys(fields)
], { context })
setFormValues(defaultValues)
setEditMode(true)  // 新建时直接进入编辑模式
```

---

## 五、decoration-* — 状态颜色标记

### 5.1 Odoo 源码

```xml
<!-- sale_order_views.xml -->
<field name="state" decoration-info="state == 'draft'" decoration-success="state == 'sale'"/>
<field name="amount_total" decoration-bf="1"
       decoration-danger="invoice_status == 'to invoice' and state in ['cancel']" />
```

### 5.2 优化方案

在 OdooListRenderer 的 `renderCell` 中应用 CSS 类：

```typescript
const DECORATION_MAP: Record<string, string> = {
  bf: 'font-bold',
  it: 'italic',
  danger: 'text-red-500',
  warning: 'text-yellow-500',
  success: 'text-green-500',
  info: 'text-blue-500',
  muted: 'text-text-muted',
}

function getDecorationClass(col: ViewField, record: Record<string, unknown>): string | undefined {
  if (!col.decoration_bf && !col.decoration_it && !col.decoration_danger) return
  // 求值 decoration 表达式 → 返回对应的 Tailwind class
}
```

---

## 六、优化优先级矩阵

| 优先级 | 功能 | 工时 | 影响范围 |
|--------|------|------|----------|
| **P0** | onchange 支持 | 1.5d | 所有表单 — 业务逻辑链 |
| **P0** | default_get 新建记录 | 0.3d | 所有模块 |
| **P1** | 修饰器表达式求值 | 1d | form/list/kanban |
| **P1** | decoration-* 支持 | 0.3d | list/kanban |
| **P2** | domain 属性求值 | 0.5d | many2one 过滤 |
| **P2** | context 属性传递 | 0.3d | 默认值/动作 |

---

## 七、核心源码索引

| 关注点 | 文件 | 行号 |
|--------|------|------|
| VIEW_MODIFIERS 定义 | `base/models/ir_ui_view.py` | 34 |
| _postprocess_tag_field (domain/context) | `base/models/ir_ui_view.py` | 1636-1687 |
| _postprocess_on_change (注入 on_change) | `base/models/ir_ui_view.py` | 1560-1586 |
| default_get() 实现 | `orm/models.py` | 1271-1338 |
| onchange() 完整实现 | `web/models/models.py` | 1909-2129 |
| _apply_onchange_methods | `orm/models.py` | 6967-6985 |
| Field.parseFieldNode (修饰器提取) | `web/static/.../field.js` | 224-280 |
| evaluateBooleanExpr | `web/static/.../py.js` | 54-62 |
| combineModifiers (AND/OR) | `web/static/.../utils.js` | 144-171 |
| JS _onchange (客户端触发) | `web/static/.../relational_model.js` | 692-730 |
| _getOnchangeValues | `web/static/.../record.js` | 1307-1345 |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
