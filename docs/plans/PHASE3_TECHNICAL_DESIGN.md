# Phase 3 技术方案与开发计划

> **目标**：实现 Odoo 19 CE 首个业务模块 — CRM 客户关系管理，包括看板管道、线索/商机列表、商机详情表单。同时扩展为 4 个业务模块的完整路由体系。严格遵循 Odoo 19 CE 源码事实。

> **状态**: ✅ 已完成（2026-05-28）

---

## 一、基于 Odoo 19 CE 源码的事实校验

以下所有字段名、API 签名、XML 结构均来自 `~/EA/odoo` 源码验证。

### 1.1 CRM 模型字段（精确）

**`crm.lead`** (`odoo/addons/crm/models/crm_lead.py`):

| 字段名 | 类型 | Odoo 标签 | 说明 |
|--------|------|-----------|------|
| `name` | Char | Opportunity | 计算字段，store=True |
| `type` | Selection | Type | `lead` / `opportunity` — 核心区分 |
| `partner_id` | Many2one(res.partner) | Customer | |
| `contact_name` | Char | Contact Name | |
| `email_from` | Char | Email | ⚠️ 不是 `email` |
| `phone` | Char | Phone | |
| `stage_id` | Many2one(crm.stage) | Stage | 看板分组依据 |
| `user_id` | Many2one(res.users) | Salesperson | |
| `team_id` | Many2one(crm.team) | Sales Team | |
| `expected_revenue` | Monetary | Expected Revenue | |
| `recurring_revenue` | Monetary | Recurring Revenues | |
| `probability` | Float | Probability | |
| `priority` | Selection | Priority | 0-3 stars |
| `tag_ids` | Many2many(crm.tag) | Tags | `color_field='color'` |
| `color` | Integer | Color Index | 看板 `highlight_color` |
| `lost_reason_id` | Many2one(crm.lost.reason) | Lost Reason | ⚠️ 不是 `lost_reason` |
| `won_status` | Selection | Won Status | `won` / `lost` / `pending` |
| `active` | Boolean | Active | 归档标志 |
| `activity_ids` | One2many(mail.activity) | Activities | |
| `lead_properties` | Properties | Properties | |
| `description` | Html | Notes | |

**`crm.stage`** (`odoo/addons/crm/models/crm_stage.py`):

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | Char | Stage Name (translate=True) |
| `sequence` | Integer | 排序 |
| `is_won` | Boolean | 标记为"赢单" |
| `fold` | Boolean | 看板中折叠 |
| `team_ids` | Many2many(crm.team) | 团队可见性 |
| `requirements` | Text | 阶段要求 |
| `color` | Integer | 阶段颜色 |

> ❌ `crm.stage` **没有** `probability` 字段。

### 1.2 CRM Kanban XML 视图（精确）

**来源**: `odoo/addons/crm/views/crm_lead_views.xml` 行 544

```xml
<kanban highlight_color="color" default_group_by="stage_id"
    class="o_kanban_small_column o_opportunity_kanban"
    on_create="quick_create" quick_create_view="crm.quick_create_opportunity_form"
    archivable="false" sample="1" js_class="crm_kanban">
    
    <progressbar field="activity_state" .../>
    
    <templates>
        <t t-name="card">                     <!-- ⚠️ 是 "card"，不是 "kanban-box" -->
            <widget name="web_ribbon" .../>    <!-- 归档/丢失 ribbon -->
            <field class="fw-bold fs-5" name="name"/>
            <!-- 收入信息：条件渲染 regular + recurring -->
            <div class="o_kanban_card_crm_lead_revenue">
                <field name="expected_revenue" widget="monetary" .../>
                <field name="recurring_revenue" widget="monetary" .../>
                <field name="recurring_plan" .../>
            </div>
            <!-- 客户信息：条件渲染 -->
            <field name="partner_id" widget="many2one_avatar" .../>
            <field name="tag_ids" widget="many2multi_tags" options="{'color_field': 'color'}"/>
            <field name="lead_properties" widget="properties"/>
            <footer>                            <!-- ⚠️ 使用 <footer> 标签 -->
                <field name="priority" widget="priority"/>
                <field name="activity_ids" widget="kanban_activity"/>
                <field name="user_id" widget="many2one_avatar_user"/>
            </footer>
        </t>
    </templates>
</kanban>
```

**关键事实**:
- ✅ `default_group_by="stage_id"` — 按阶段分组
- ⚠️ 模板名是 `card`，不是 `kanban-box`
- ⚠️ 使用 Bootstrap 5 类（`fw-bold`, `fs-5`），不是 `oe_kanban_card`
- ⚠️ 收入金额使用 `t-if` 条件渲染（只有有值才显示）
- 看板属性：`js_class="crm_kanban"`, `highlight_color="color"`, `on_create="quick_create"`, `archivable="false"`
- Odoo 前端 JS 类 `crm_kanban` 负责拖拽和快速创建——在 OdooSeek 中忽略，用原生 HTML 实现

### 1.3 API 事实

**`read_group` 已废弃（Odoo 19.0）**:

```python
# odoo/orm/models.py:2749
@api.deprecated("Since 19.0, read_group is deprecated. Please use _read_group...")
def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
```

**OdooSeek 策略**: 不调用 `read_group`。改用 `search_read` 获取所有记录，前端按 `stage_id` 分组渲染。理由：
- `read_group` 不返回记录详情，需额外 `search_read`
- 看板记录数通常 <200，全量加载可行
- 避免依赖废弃 API

### 1.4 CRM 动作与菜单

| 用途 | 动作 XML ID | 模型 | 视图模式 | 说明 |
|------|------------|------|----------|------|
| 管道 | `crm_lead_action_pipeline` | crm.lead | kanban,... | `domain: [('type','=','opportunity')]` |
| 线索 | `crm_lead_all_leads` | crm.lead | list,kanban,... | ⚠️ 无 `action_` 前缀 |

---

## 二、技术决策（基于源码对齐）

| 决策 | 选择 | 理由 |
|------|------|------|
| 看板数据获取 | **`search_read` 全量 + 前端分组** | `read_group` 已废弃且不返回记录 |
| 看板卡片 | **渲染 `<field>` 元素为 React Widget** | 遵循声明式原则，不硬编码模板 |
| 分组维度 | **从 `<kanban default_group_by>` 读取** | 元数据驱动 |
| 拖拽实现 | **HTML5 Drag & Drop + `callKw('write')`** | 无需 Odoo JS 框架 |
| 路由架构 | **文件路由 + 每个模块 4 个页面** | TanStack Router file-based routing |
| 菜单导航 | **`parseActionRef` + `callKw` 解析 → `/web?model=`** | 元数据驱动，不硬编码路由 |

---

## 三、模块设计

### 3.1 OdooKanbanRenderer

**架构**:

```
OdooKanbanRenderer
├── 解析 <kanban> XML → groupBy, template fields, visible fields
├── search_read 获取所有记录
├── search_read 获取阶段列表（用于列标题和排序）
├── 前端按 stage_id 分组
├── 渲染列 (每列 = 一个 stage)
│   └── 渲染卡片 (每卡片 = 一条记录)
│       └── 卡片内容: canvasView 驱动 + name 回退
└── 拖拽卡片到新列 → callKw(write, [[recordId], {stage_id: new_id}])
```

**组件接口**:

```typescript
interface KanbanRendererProps {
  model: string
  arch: string                    // <kanban> XML
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  onRecordClick?: (id: number) => void
}
```

**关键实现细节**:
- `parseKanbanXml(arch)` 解析 `<kanban>` → `{fields, template, defaultGroupBy}`
- `<templates>` 被 `querySelector('templates')` 提取（不是 `<template>` 单数）
- `parseKanbanFields(template)` 从模板提取 `<field>` 列表 → 卡片 Widget 序列
- `search_read` 使用 `[domain, fields]` 格式（**不能** `[[domain], fields]`）
- 乐观更新：拖拽后立即更新 React Query 缓存，异步 `write` 失败时 invalidate

### 3.2 数据流

```typescript
// 1. 获取所有阶段（用于列标题和排序）
const stages = await callKw('crm.stage', 'search_read', [[], ['name', 'sequence', 'color']], { order: 'sequence' })

// 2. 获取所有记录
const records = await callKw(model, 'search_read', [domain, visibleFields], { limit: 200 })

// 3. 前端按 stage_id 分组
const groups = new Map<number, Record[]>()
for (const r of records) {
  const stageVal = r[groupBy]
  const stageId = Array.isArray(stageVal) ? stageVal[0] : typeof stageVal === 'number' ? stageVal : 0
  if (!groups.has(stageId)) groups.set(stageId, [])
  groups.get(stageId)!.push(r)
}
```

### 3.3 卡片渲染策略

**遵循 Odoo 声明式原则** — 不硬编码卡片布局，从 `<kanban>` XML 的 `<templates>` 提取 `<field>` 列表：

```xml
<!-- 从 <templates><t t-name="card"> 中提取的字段序列 -->
<field class="fw-bold fs-5" name="name"/>
<field name="expected_revenue" widget="monetary"/>
<field name="partner_id" widget="many2one_avatar"/>
<field name="tag_ids" widget="many2multi_tags"/>
```

解析为：
```typescript
// 从 xml-parser 提取 <t t-name="card"> 内的所有 <field> 元素
const cardFields = parseKanbanFields(kanbanView.template!)
```

卡片渲染：
```typescript
function KanbanCard({ record, cardFields, fields }: CardProps) {
  return (
    <div className="rounded-lg border bg-surface p-3 cursor-pointer" draggable>
      {cardFields.length > 0 ? (
        cardFields.map(f => <FieldWidget field={f} value={record[f.name]} meta={fields[f.name]} readOnly/>)
      ) : (
        <span className="text-sm font-medium">{record.name as string}</span>
      )}
    </div>
  )
}
```

> **对齐论证**: Odoo `<kanban>` XML 声明了字段和 widget。我们解析 XML 并映射到 React Widget——这就是"声明式渲染"哲学在 React 中的实现。卡片布局简化为线性排列（vs Odoo 的自由 QWeb 模板），这是合理的取舍。

---

## 四、路由设计

### 4.1 完整路由树

```
routes/
├── __root.tsx              # 根布局 (Outlet + AuthProvider)
├── index.tsx               # / → 重定向到 /menu
├── login.tsx               # /login 登录页
├── menu.tsx                # /menu 菜单/仪表盘
├── web.tsx                 # /web?model= → 通用 ViewLoader
├── dashboard.tsx           # /dashboard
├── settings.tsx            # /settings
├── -home.tsx               # /home 布局路由
├── crm/
│   ├── index.tsx           # /crm → 重定向到 /crm/pipeline
│   ├── pipeline.tsx        # /crm/pipeline — kanban (opportunity)
│   ├── leads.tsx           # /crm/leads — list (lead)
│   └── lead.$id.tsx        # /crm/lead/$id — form
├── sale/
│   ├── index.tsx           # /sale → 重定向
│   ├── orders.tsx          # /sale/orders — list (sale.order)
│   └── order.$id.tsx       # /sale/order/$id — form
├── accounting/
│   ├── index.tsx           # /accounting → 重定向
│   ├── moves.tsx           # /accounting/moves — list (account.move)
│   └── move.$id.tsx        # /accounting/move/$id — form
└── inventory/
    ├── index.tsx           # /inventory → 重定向
    ├── pickings.tsx        # /inventory/pickings — list (stock.picking)
    └── picking.$id.tsx     # /inventory/picking/$id — form
```

**17 条路由**，4 个业务模块，每个模块：
- `index.tsx` — 重定向到默认视图
- `list` 路由 — 模块列表视图
- `$id` 路由 — 记录详情表单视图
- CRM 额外有 `pipeline` — 看板管道

### 4.2 路由守卫

所有受保护路由使用 `beforeLoad`:
```typescript
beforeLoad: async () => {
  const res = await fetch('/api/session', { credentials: 'include' })
  if (!res.ok) throw redirect({ to: '/login' })
  const data = await res.json()
  if (!data.authenticated) throw redirect({ to: '/login' })
}
```

### 4.3 菜单→路由导航

```
菜单点击 (MenuPage)
  └── parseActionRef(action) → {type, id}
      └── callKw('ir.actions.act_window','read',[[id],['res_model']])
          └── navigate({ to: '/web', search: { model: 'crm.lead' } })
              └── WebPage → OdooViewLoader → 分发到 List/Form/Kanban
```

---

## 五、已完成功能清单

### ✅ 核心组件

| 组件 | 文件 | 状态 |
|------|------|------|
| OdooKanbanRenderer | `views/OdooKanbanRenderer.tsx` | ✅ 完成 |
| OdooListRenderer | `views/OdooListRenderer.tsx` | ✅ 完成 |
| OdooFormRenderer | `views/OdooFormRenderer.tsx` | ✅ 完成 |
| OdooViewLoader | `views/OdooViewLoader.tsx` | ✅ 完成（list/form/kanban 分发） |
| OdooViewSwitcher | `views/OdooViewSwitcher.tsx` | ✅ 完成 |
| field-widgets | `views/field-widgets.tsx` | ✅ 15 种类型 Widget |

### ✅ XML 解析器

| 函数 | 文件 | 状态 |
|------|------|------|
| parseListXml | `lib/xml-parser.ts` | ✅ 完成 |
| parseFormXml | `lib/xml-parser.ts` | ✅ 完成 |
| parseKanbanXml | `lib/xml-parser.ts` | ✅ 完成 |
| parseKanbanFields | `lib/xml-parser.ts` | ✅ 完成 |
| parseSearchXml | `lib/xml-parser.ts` | ✅ 完成 |

### ✅ 路由

| 路由 | 状态 |
|------|------|
| CRM: pipeline / leads / lead.$id / index | ✅ 完成 |
| Sales: orders / order.$id / index | ✅ 完成 |
| Accounting: moves / move.$id / index | ✅ 完成 |
| Inventory: pickings / picking.$id / index | ✅ 完成 |
| 通用: /web?model= / menu / login / dashboard | ✅ 完成 |

### ✅ 看板功能

| 功能 | 状态 |
|------|------|
| search_read 全量 + 前端 stage_id 分组 | ✅ 完成 |
| search_read 获取 crm.stage 阶段列表 | ✅ 完成 |
| HTML5 Drag & Drop 拖拽更新 stage_id | ✅ 完成 |
| 乐观更新 (optimistic update via React Query) | ✅ 完成 |
| 卡片渲染：cardFields + name 回退 | ✅ 完成 |
| domain 过滤 (pipeline: opportunity, leads: lead) | ✅ 完成 |

### ⚠️ 已知局限

| 局限 | 影响 | 优先级 |
|------|------|--------|
| 卡片 Widget 不支持 `t-if` 条件渲染 | 所有字段总是显示 | P4 |
| 未处理 `<xpath>` 继承 | 视图扩展不支持 | P4 |
| many2one 搜索下拉未实现 | 无法搜索关联记录 | P4 |
| `ir.actions.server` 不可解析 | CRM My Pipeline 不可用 | P4 |
| 看板 `highlight_color` 未实现 | 卡片无颜色标记 | P4 |
| `<footer>` 标签未特殊处理 | 优先级、活动等混在卡片中 | P4 |

---

## 六、关键 Bug 修复记录

| 日期 | Bug | 根因 | 修复 |
|------|-----|------|------|
| 2026-05-28 | setState-during-render warning | `navigate()` 在 MenuPage render body 调用 | 移入 useEffect |
| 2026-05-28 | React duplicate keys | visibleColumns 有重复 name | key 加索引前缀 |
| 2026-05-28 | WebSocket 关闭错误 | StrictMode 双挂载时 close CONNECTING 状态的 socket | 检查 readyState |
| 2026-05-28 | 看板无数据 | search_read domain 双包裹 `[[domain], fields]` → `[[]]` | 改为 `[domain, fields]` |

---

**文档版本**: 3.0 (反映实际实现)  
**创建日期**: 2026-05-28  
**最后更新**: 2026-05-28  
**维护团队**: OdooSeek
