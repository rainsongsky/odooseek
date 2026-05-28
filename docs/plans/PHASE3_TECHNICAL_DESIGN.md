# Phase 3 技术方案与开发计划

> **目标**：实现 Odoo 19 CE 首个业务模块 — CRM 客户关系管理，包括看板管道、线索/商机列表、商机详情表单。

---

## 一、背景

Phase 2 已完成 Odoo 元数据驱动的通用视图引擎（List / Form / Kanban 解析器 + 渲染器）。Phase 3 在此基础上实现具体业务模块，验证视图引擎在真实 Odoo App 上的表现。

选择 CRM 作为首个模块的理由：
- 同时用到 **看板**（管道）和 **列表**（线索）两种核心视图
- 看板的 `kanban` XML 视图是 Odoo 最复杂的视图类型之一
- 商机详情表单包含 `many2one`、`selection`、`one2many` 等多种字段类型
- CRM 是 Odoo 最常用的 App，验证价值高

---

## 二、CRM 模块设计

### 2.1 模型概览

| Odoo Model | 用途 | 主要字段 |
|------------|------|----------|
| `crm.lead` | 线索/商机 | name, partner_id, email, phone, stage_id, user_id, expected_revenue, probability, lost_reason, description |
| `crm.stage` | 商机阶段 | name, sequence, probability, requirements |
| `crm.team` | 销售团队 | name, user_id, member_ids |
| `mail.activity` | 活动 | activity_type_id, summary, date_deadline, user_id, res_id, res_model |

### 2.2 页面规划

| 路由 | 页面 | 默认视图 | Odoo Action |
|------|------|----------|-------------|
| `/crm` | CRM 首页 | 看板管道 | `crm.crm_lead_action_pipeline` |
| `/crm/pipeline` | 商机管道 | kanban (按 stage 分组) | CRMPipeline |
| `/crm/leads` | 线索列表 | list | `crm_lead_action_all_leads` |
| `/crm/lead/$id` | 商机详情 | form | (从列表/看板点击进入) |

### 2.3 路由架构

```
routes/crm/
├── index.tsx          → /crm — 默认跳转到 pipeline
├── pipeline.tsx       → /crm/pipeline — 看板视图
├── leads.tsx          → /crm/leads — 列表视图
└── lead.$id.tsx       → /crm/lead/$id — 表单视图
```

> 利用 TanStack Router 的文件路由，`$id` 自动捕获记录 ID。

---

## 三、看板（Kanban）实现

### 3.1 看板 XML 解析

Odoo 的 `<kanban>` XML 结构：

```xml
<kanban default_group_by="stage_id" class="o_kanban_small_column">
  <field name="name"/>
  <field name="expected_revenue"/>
  <field name="stage_id"/>
  
  <templates>
    <t t-name="kanban-box">
      <div class="oe_kanban_card">
        <strong><field name="name"/></strong>
        <div><field name="expected_revenue"/></div>
      </div>
    </t>
  </templates>
</kanban>
```

关键属性：
- `default_group_by` — 按哪个字段分组（CRM 按 `stage_id`）
- `<field>` 元素 — 声明看板需要加载的字段
- `<templates>` — QWeb 模板定义卡片外观

### 3.2 OdooKanbanRenderer 设计

```
OdooKanbanRenderer
├── 解析 <kanban> XML → 获取 fields + default_group_by
├── callKw(model, 'read_group', [domain, fields, groupBy, ...]) → 分组数据
├── 渲染列 (每列 = 一个 stage)
│   └── 渲染卡片 (每卡片 = 一条记录)
│       └── 卡片内容从 <templates> XML 提取
└── 拖拽卡片到新列 → callKw(model, 'write', [[id], {stage_id: new_stage_id}])
```

### 3.3 OdooKanbanRenderer 组件

```typescript
interface KanbanRendererProps {
  model: string
  arch: string         // <kanban> XML
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
}

export function OdooKanbanRenderer({ model, arch, fields, domain }: KanbanRendererProps) {
  const kanbanView = useMemo(() => parseKanbanXml(arch), [arch])
  const groupBy = kanbanView.default_group_by ?? 'stage_id'
  
  const { data: groups } = useQuery({
    queryKey: ['odoo', 'read_group', model, domain, groupBy],
    queryFn: () => callKw(model, 'read_group', [[domain], kanbanView.fields, [groupBy], {}]),
  })
  
  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {groups?.map((group: any) => (
        <KanbanColumn
          key={group[groupBy]?.[0] ?? group.__count}
          title={group[groupBy]?.[1] ?? 'Unknown'}
          count={group.__count}
          records={group.__records ?? []}
          fields={kanbanView.fields}
          template={kanbanView.template}
        />
      ))}
    </div>
  )
}
```

### 3.4 read_group API

Odoo 的 `read_group` 方法：
```json
{
  "model": "crm.lead",
  "method": "read_group",
  "args": [[], ["name", "expected_revenue", "stage_id"], ["stage_id"], {}]
}
```

返回格式：
```json
[
  {
    "__count": 5,
    "__domain": [["stage_id", "=", 1]],
    "stage_id": [1, "New"],
    "name": "New",
    "__records": [...]  // 需要请求 records 才返回
  }
]
```

---

## 四、CRM 页面实现

### 4.1 `/crm` — 默认跳转

```typescript
// routes/crm/index.tsx
export const Route = createFileRoute('/crm')({
  beforeLoad: () => { throw redirect({ to: '/crm/pipeline' }) },
})
```

### 4.2 `/crm/pipeline` — 看板视图

```typescript
// routes/crm/pipeline.tsx
function CrmPipeline() {
  return <OdooViewLoader model="crm.lead" viewType="kanban" />
}
```

### 4.3 `/crm/leads` — 列表视图

```typescript
// routes/crm/leads.tsx  
function CrmLeads() {
  return <OdooViewLoader model="crm.lead" viewType="list" />
}
```

### 4.4 `/crm/lead/$id` — 商机详情

```typescript
// routes/crm/lead.$id.tsx
function CrmLeadDetail() {
  const { id } = useParams({ from: '/crm/lead/$id' })
  return <OdooViewLoader model="crm.lead" viewType="form" recordId={Number(id)} />
}
```

---

## 五、技术依赖

| 层级 | 依赖 | 状态 |
|------|------|:----:|
| 看板 XML 解析 | `lib/xml-parser.ts` — `parseKanbanXml()` | ✅ 已实现 |
| read_group API | `lib/api.ts` — 需新增 `readGroup()` | ⏳ 待添加 |
| Kanban 渲染器 | `views/OdooViewLoader.tsx` — 需添加 kanban case | ⏳ 待添加 |
| 文件路由 | TanStack Router file-based routing | ✅ 已配置 |

---

## 六、任务分解

| # | 任务 | 工时 | 产出 |
|---|------|------|------|
| 3.1 | api.ts 新增 `readGroup()` | 0.5 天 | `readGroup(model, domain, fields, groupBy, kwargs)` |
| 3.2 | OdooKanbanRenderer 组件 | 1.5 天 | 分组查询 + 列/卡片渲染 |
| 3.3 | OdooViewLoader kanban case | 0.5 天 | 分发 `<kanban>` 视图到 OdooKanbanRenderer |
| 3.4 | CRM 路由 (4 条) | 0.5 天 | `/crm`, `/crm/pipeline`, `/crm/leads`, `/crm/lead/$id` |
| 3.5 | 菜单集成 | 0.5 天 | CRM 菜单项 → 导航到 `/crm/pipeline` |
| 3.6 | 卡片拖拽排序 + write | 1 天 | 乐观更新 + `callKw('write')` |

**总计**: 4.5 个工作日

---

## 七、开发顺序

```
Day 1     [3.1] readGroup API → [3.2] KanbanRenderer
Day 2     [3.3] ViewLoader kanban → [3.4] CRM routes
Day 3     [3.5] Menu integration → [3.6] Drag & drop
```

---

## 八、完成标准

```
[ ] lib/api.ts: readGroup() 正常工作
[ ] parseKanbanXml 解析真实 CRM <kanban> XML
[ ] OdooKanbanRenderer 按 stage 分组显示卡片
[ ] /crm/pipeline 看板视图可用
[ ] /crm/leads 列表视图可用
[ ] /crm/lead/$id 表单视图可用
[ ] 菜单"CRM"或"Sales"导航到 /crm/pipeline
[ ] 拖拽卡片到新阶段 → Odoo 数据更新
```

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
