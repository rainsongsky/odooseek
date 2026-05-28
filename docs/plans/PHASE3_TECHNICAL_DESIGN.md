# Phase 3 技术方案与开发计划

> **目标**：实现 Odoo 19 CE 首个业务模块 — CRM 客户关系管理，包括看板管道、线索/商机列表、商机详情表单。严格遵循 Odoo 19 CE 源码事实。

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
            <field name="tag_ids" widget="many2many_tags" options="{'color_field': 'color'}"/>
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

---

## 三、模块设计

### 3.1 OdooKanbanRenderer

**架构**:

```
OdooKanbanRenderer
├── 解析 <kanban> XML → groupBy, template fields
├── search_read 获取所有记录
├── 前端按 stage_id 分组
├── 渲染列 (每列 = 一个 stage)
│   └── 渲染卡片 (每卡片 = 一条记录)
│       └── 卡片内容：renderFieldWidgets(card template fields)
└── 拖拽卡片到新列 → callKw(write, [{[id], {stage_id: new_id}}])
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

### 3.2 数据流

```typescript
// 1. 获取所有阶段（用于列标题和排序）
const stages = await callKw('crm.stage', 'search_read', [[], ['name', 'sequence', 'color']], { order: 'sequence' })

// 2. 获取所有记录
const records = await callKw(model, 'search_read', [[domain], visibleFields], { limit: 200, order: 'stage_id' })

// 3. 按 stage_id 分组
const groups = new Map<number, Record[]>()
for (const r of records) {
  const stageId = (r.stage_id as [number, string])[0]
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
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      {cardFields.map((f) => (
        <FieldWidget field={f} value={record[f.name]} meta={fields[f.name]}/>
      ))}
    </div>
  )
}
```

> **对齐论证**: Odoo `<kanban>` XML 声明了字段和 widget。我们解析 XML 并映射到 React Widget——这就是"声明式渲染"哲学在 React 中的实现。卡片布局简化为线性排列（vs Odoo 的自由 QWeb 模板），这是合理的取舍。

---

## 四、CRM 路由设计

```
routes/crm/
├── index.tsx          → /crm — 重定向到 /crm/pipeline
├── pipeline.tsx       → /crm/pipeline — kanban (crm.lead, domain opportunity only)
├── leads.tsx          → /crm/leads — list (crm.lead, domain lead only)
└── lead.$id.tsx       → /crm/lead/$id — form
```

**路由实现**:

```typescript
// pipeline.tsx
function CrmPipeline() {
  return <OdooViewLoader model="crm.lead" viewType="kanban" domain={[['type','=','opportunity']]}/>
}

// leads.tsx
function CrmLeads() {
  return <OdooViewLoader model="crm.lead" viewType="list" domain={[['type','=','lead']]}/>
}
```

---

## 五、任务分解

| # | 任务 | 工时 | 产出 |
|---|------|------|------|
| 3.1 | `xml-parser.ts` 扩展：提取 kanban card fields | 0.5 天 | `parseKanbanFields(template)` |
| 3.2 | OdooKanbanRenderer 组件 | 1.5 天 | 分组 + 列 + 卡片渲染 |
| 3.3 | OdooViewLoader kanban case | 0.5 天 | 分发 `<kanban>` 到 OdooKanbanRenderer |
| 3.4 | CRM 路由 (4 条) | 0.5 天 | routes/crm/* |
| 3.5 | 拖拽 → write stage | 0.5 天 | HTML5 Drag & Drop + 乐观更新 |
| 3.6 | 菜单集成 | 0.5 天 | 从菜单导航到 /crm/pipeline |

**总计**: 4 天

---

## 六、完成标准

```
[ ] parseKanbanFields 提取 <t t-name="card"> 内所有 <field>
[ ] 前端按 stage_id 分组渲染列
[ ] 卡片显示 name, expected_revenue, partner_id 等字段
[ ] /crm/pipeline 看板视图可用
[ ] /crm/leads 列表视图可用
[ ] /crm/lead/$id 表单视图可用
[ ] 拖拽卡片 → write stage_id 成功
[ ] 菜单项可导航到 CRM
```

---

**文档版本**: 2.0 (Odoo 19 CE 源码对齐)  
**创建日期**: 2026-05-28  
**更新**: 修正 `read_group` 废弃、字段名、动作 ID、看板模板结构  
**维护团队**: OdooSeek
