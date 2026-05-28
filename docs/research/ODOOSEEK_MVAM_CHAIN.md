# OdooSeek Menu → Action → View → Model 链路

> 基于 Odoo 19 CE 源码事实，阐述 OdooSeek 中从用户点击菜单到数据渲染的完整链路实现。

---

## 一、链路总览

```
用户点击 Menu 卡片 (MenuPage)
  │
  ▼
parseActionRef(menu.action)      → 解析 "ir.actions.act_window,142" → {type, id}
  │
  ▼
callKw('ir.actions.act_window', 'read', [[id], ['res_model']])
  │                               → {res_model: "sale.order"}
  ▼
navigate({ to: '/web', search: { model: "sale.order" } })
  │
  ▼
WebPage (/web) → OdooViewLoader
  │
  ├── callKw(model, 'get_views', [[[false, 'list'], [false, 'form']]], ...)
  │     → { views: { list: {arch, id}, form: {arch, id} }, models: {sale.order: {fields: {...}} } }
  │
  ├── OdooListRenderer  ← parseListXml(list.arch)  → 动态列
  ├── OdooFormRenderer  ← parseFormXml(form.arch)  → 递归布局
  └── OdooKanbanRenderer ← parseKanbanXml(kanban.arch) → 分组卡片
        │
        ▼
     callKw(model, 'search_read', [[domain], [fields]], {offset, limit, order})
       → [{id, name, state, amount_total, ...}, ...]
```

---

## 二、Menu — 菜单解析

### 2.1 数据来源

**Odoo 19 CE**: `ir.ui.menu` 表，`action` 字段存储外部 ID 引用字符串。

**OdooSeek 端点**: `GET /api/menu`

```rust
// crates/odoo-web-server/src/menu.rs
// 调用 ir.ui.menu search_read，parent_id=false，按 sequence 排序
// 返回 [{id, name, action, sequence, web_icon}, ...]
```

### 2.2 Action 字符串解析

```
action = "ir.actions.act_window,142"
         ├── actionType = "ir.actions.act_window"
         └── actionId   = 142
```

```typescript
// apps/oweb/src/routes/menu.tsx
function parseActionRef(action: string | undefined): { type: string; id: number } | null {
  if (!action || action === 'False') return null
  const [type, idStr] = action.split(',')
  return { type: type.trim(), id: Number(idStr?.trim()) }
}
```

### 2.3 Action → Model 解析

```typescript
// 收集所有 act_window 类型的 action ID
const actWindowIds = menus
  .map(m => parseActionRef(m.action))
  .filter(ref => ref?.type === 'ir.actions.act_window')
  .map(ref => ref!.id)

// 批量读取 res_model
const actionModels = await callKw<Array<{id, res_model}>>(
  'ir.actions.act_window', 'read', [actWindowIds, ['res_model']]
)

// 构建映射: action_id → model_name
const modelMap = new Map(actionModels.map(a => [a.id, a.res_model]))

// 解析菜单项的模型
function resolveModel(action: string | undefined): string | null {
  const ref = parseActionRef(action)
  if (ref?.type === 'ir.actions.act_window') return modelMap.get(ref.id) ?? null
  return null
}
```

### 2.4 容器菜单（无直接 action）

根菜单（CRM/Sales/Invoicing）常为容器（`action=False`）。处理方式：

```typescript
// 点击容器菜单 → 查询子菜单
const childMenus = await callKw<MenuItem[]>(
  'ir.ui.menu', 'search_read',
  [[['parent_id', '=', menuId]], ['id', 'name', 'action', 'sequence']]
)

// 找到第一个 act_window 子项
const firstActionable = childMenus.find(m => parseActionRef(m.action)?.type === 'ir.actions.act_window')

// 解析其 res_model → 导航
```

> ⚠️ 当前未处理 `ir.actions.server`（如 CRM My Pipeline），不能通过此方式解析。

---

## 三、Action — 动作执行

### 3.1 已支持的动作类型

| 类型 | 处理 | 说明 |
|------|------|------|
| `ir.actions.act_window` | `read(['res_model'])` → 导航到 `/web?model=MODEL` | ✅ |
| `ir.actions.client` | 无 | 客户端动作（如 Discuss） |
| `ir.actions.server` | 无 | 服务器动作（如 CRM My Pipeline） |
| `ir.actions.act_url` | 无 | URL 动作 |
| `ir.actions.report` | 无 | 报表动作 |

### 3.2 导航

```typescript
// 解析后的模型名 → TanStack Router 导航
navigate({ to: '/web', search: { model: 'sale.order' } })
```

---

## 四、View — 视图加载

### 4.1 单次 API 调用

`OdooViewLoader` 一次 `get_views()` 获取全部视图和字段：

```typescript
// views/OdooViewLoader.tsx
const viewData = await callKw(model, 'get_views', [
  [[false, 'list'], [false, 'form']]  // 请求列表+表单
], { options: { toolbar: true } })

// 返回:
// {
//   views: {
//     list:  { arch: "<list string='Orders'><field name='name'/>...</list>", id: 456 },
//     form:  { arch: "<form>...</form>", id: 789 }
//   },
//   models: {
//     'sale.order': {
//       fields: {
//         id:          { type: 'integer', string: 'ID', readonly: true, ... },
//         name:        { type: 'char',    string: 'Order Reference', ... },
//         partner_id:  { type: 'many2one', string: 'Customer', ... },
//         amount_total:{ type: 'monetary', string: 'Total', ... },
//         ...
//       }
//     }
//   }
// }
```

### 4.2 视图分发

```typescript
// 根据 viewType 分发到对应渲染器
switch (viewType) {
  case 'list':   return <OdooListRenderer   model arch fields domain onRowClick/>
  case 'form':   return <OdooFormRenderer   model arch fields recordId/>
  case 'kanban': return <OdooKanbanRenderer model arch fields domain onRecordClick/>
}
```

### 4.3 XML → React 组件

| 视图类型 | 解析器 | 渲染器 | Odoo XML → React |
|----------|--------|--------|------------------|
| `<list>` | `parseListXml()` | `OdooListRenderer` | `<field name="x"/>` → 列定义 → `<th>` 表头 |
| `<form>` | `parseFormXml()` | `OdooFormRenderer` | `<sheet>/<group>/<field>` → 递归 React 布局 |
| `<kanban>` | `parseKanbanXml()` | `OdooKanbanRenderer` | `<templates>` → `parseKanbanFields()` → 卡片渲染 |

---

## 五、Model — 数据操作

### 5.1 统一入口

所有模型操作通过单一 `call_kw` 端点：

```
前端 fetch → /api/odoo/web/dataset/call_kw
  → Rust proxy.rs 透明转发
    → Odoo 19 CE POST /web/dataset/call_kw
      → ORM search_read / read / write / ...
```

### 5.2 API 封装

```typescript
// lib/api.ts — 所有方法委托到 callKw
callKw(model, 'search_read', [[domain], [field1, field2]], { offset, limit, order })
callKw(model, 'read',          [[id], [field1, field2]])
callKw(model, 'write',         [[id], { field1: newValue }])
callKw(model, 'get_views',     [[[false, 'list']]], { options })
callKw(model, 'fields_get',    [['name', 'email']], { attributes })
```

### 5.3 代理层

```rust
// crates/odoo-web-server/src/proxy.rs
// POST /api/odoo/{*path} → reqwest 透明转发
// Cookie 透传: browser Cookie → Odoo
// Set-Cookie 返回: Odoo → browser
```

---

## 六、完整链路示例

以用户点击 "CRM → Leads" 为例：

```
1. Menu
   fetch('/api/menu') → [{name: "CRM", action: "False"}, ...]
   点击 "CRM"
     → parseActionRef("False") → null
     → 查询子菜单: callKw('ir.ui.menu', 'search_read', [[['parent_id','=',CRM_ID]],...])
     → [{name: "Leads", action: "ir.actions.act_window,170"}]

2. Action
     → parseActionRef("ir.actions.act_window,170") → {type, id: 170}
     → callKw('ir.actions.act_window', 'read', [[170], ['res_model']])
     → {res_model: "crm.lead"}

3. View
     → navigate({ to: '/web', search: { model: 'crm.lead' } })
     → OdooViewLoader: callKw('crm.lead', 'get_views', [[[false,'list']]])
     → parseListXml("<list string='Leads'><field name='name'/>...")

4. Model
     → callKw('crm.lead', 'search_read', [[['type','=','lead']], ['name','email','stage_id']], {limit:80})
     → [{id:1, name:"ABC Corp", email:"abc@test.com", stage_id:[1,"New"]}, ...]

5. Render
     → 列表表格: Name | Email | Stage | ...
     → 点击行 → setRecordId → switch to form → read → 表单渲染
```

---

## 七、对齐度

| 组件 | 实现 | 缺失 |
|------|------|------|
| **Menu 加载** | ✅ `ir.ui.menu` search_read | — |
| **Action 解析** | ✅ `parseActionRef` + `read(['res_model'])` | `ir.actions.server` 不可解析 |
| **View 加载** | ✅ `get_views()` 一次获取全部 | — |
| **XML 解析** | ✅ list, form, kanban, search | `<xpath>` 继承未处理 |
| **字段渲染** | ✅ 15 种类型 Widget | many2one 搜索下拉未实现 |
| **数据操作** | ✅ call_kw 统一入口 | — |
| **容器菜单** | ✅ 查询子菜单 | 多层嵌套未递归 |
| **路由集成** | ✅ `/web?model=MODEL` | — |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
