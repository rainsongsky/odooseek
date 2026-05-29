# Phase 8 技术设计：深度交互

> **版本**: 1.0
> **日期**: 2026-05-30
> **前置**: Phase 7 已完成（157 测试）
> **目标**: 补全 oweb 关键交互能力 — o2m 内联表格、列表内联编辑、Calendar 视图、ControlPanel 工具栏、Activity 日程、Chatter 消息

---

## 一、总览

| # | 任务 | 优先级 | 依赖 |
|---|------|:------:|------|
| 8.1 | one2many 内联列表 | P0 | 无 |
| 8.2 | 列表内联编辑 | P1 | 8.1（共用 inline widget 模式） |
| 8.3 | Calendar 日历视图 | P1 | 无（独立，新视图类型） |
| 8.4 | ControlPanel 工具栏 | P1 | 无（toolbar 数据提取） |
| 8.5 | Activity 日程管理 | P2 | 无（mail.activity 模型） |
| 8.6 | Chatter 消息线程 | P2 | 8.5（共用 mail.* API） |

**执行顺序**: 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6

---

## 二、8.1 — one2many 内联列表 (P0)

### 问题

表单中 one2many 字段（如 `sale.order.order_line`）当前使用 `Many2ManyWidget` 标签选择器，无法展示内联表格、添加/删除行、编辑子记录。

### 类型扩展 — `lib/odoo-types.ts`

```typescript
export interface O2mSubView {
  columns: ViewField[]
  editable?: string
  decorations: Record<string, string>
  create?: boolean
  delete?: boolean
}

export interface O2mFormSubView {
  elements: FormElement[]
}

// FieldElement 扩展
export interface FieldElement {
  // ... 现有字段 ...
  mode?: string
  subViews?: {
    list?: O2mSubView
    form?: O2mFormSubView
  }
}

export type O2mCommand =
  | [0, number, Record<string, unknown>]
  | [1, number, Record<string, unknown>]
  | [2, number]
  | [4, number]
  | [5, 0]
  | [6, 0, number[]]
```

### XML 解析器 — `lib/xml-parser.ts`

`parseFormElements` 中 `tag === 'field'` 分支扩展：

1. 扫描 `<field>` 子元素中的 `<tree>`/`<list>` 和 `<form>` 元素
2. `<tree>` → 复用 `parseFieldAttrs` 解析列 + `parseDecorations` + `editable` 属性
3. `<form>` → 复用 `parseFormElements` 递归解析
4. 提取 `mode` 属性（o2m 默认显示模式：`"list"` / `"kanban"`）

复用函数：`parseFieldAttrs`、`parseFormElements`、`parseDecorations`

### One2ManyWidget — `views/field-widgets.tsx`

替换 `TYPE_WIDGETS` 中 `one2many: Many2ManyWidget` → `one2many: One2ManyWidget`

**数据流**：

- **读模式**：value 为 `[id1, id2, ...]`，通过 `callKw(relation, 'read', [ids, fieldNames])` 获取完整记录数据
- **写模式**：组件内部维护 ORM 命令数组，通过 `onChange` 传给父表单
- 父表单保存时，o2m 字段值格式：`[[0, 0, {field: val}], [1, 123, {field: val}], [2, 124]]`

**渲染逻辑**：

- 有 `subViews.list` → 内联表格，列头来自 `subViews.list.columns`
- 无 `subViews.list` → 用 `fieldsGet(relation)` 自动发现字段，渲染简化表格
- 每行：字段值渲染 + 删除按钮（ORM 命令 `(2, id)`）
- 底部：「添加行」按钮（inline 新行或弹出 mini form）
- 支持 `subViews.list.editable` 内联编辑

### API 调用

| 方法 | 用途 |
|------|------|
| `callKw(relation, 'read', [ids, fields])` | 读取 o2m 记录 |
| `callKw(relation, 'fields_get', [fields])` | 无子视图时自动发现字段 |
| `callKw(relation, 'default_get', [fields])` | 新行默认值 |
| 父表单 `write`/`create` | ORM 命令随 formValues 一起提交 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `lib/odoo-types.ts` | 新增 `O2mSubView`, `O2mFormSubView`, `O2mCommand`；扩展 `FieldElement` |
| `lib/xml-parser.ts` | `parseFormElements` 增加嵌套子视图解析 |
| `views/field-widgets.tsx` | 新增 `One2ManyWidget`；替换映射 |

### 测试

| 测试 | 文件 |
|------|------|
| 解析嵌套 `<tree>` → `subViews.list.columns` | `lib/__tests__/xml-parser.test.ts` |
| 解析嵌套 `<form>` → `subViews.form.elements` | `lib/__tests__/xml-parser.test.ts` |
| 解析 `editable="bottom"` → `subViews.list.editable` | `lib/__tests__/xml-parser.test.ts` |
| 渲染内联表格 + 列头 | `views/__tests__/field-widgets.test.ts` |
| 删除行 → `onChange` 含 `[2, id]` | `views/__tests__/field-widgets.test.ts` |
| 添加行 → `onChange` 含 `[0, 0, vals]` | `views/__tests__/field-widgets.test.ts` |

---

## 三、8.2 — 列表内联编辑 (P1)

### 问题

`parseListXml` 已解析 `editable` 属性但未使用。Odoo 列表视图支持 `editable="top|bottom"`，允许点击行进入内联编辑。

### 组件变更 — `views/OdooListRenderer.tsx`

**核心变更**：

1. 检测 `listView.editable`，若存在则启用内联编辑
2. 新增 `InlineEditState`：`{ mode: 'idle' | 'editing' | 'creating', recordId, values }`
3. 编辑行：`<td>` 从 `renderCell()` 切换为 `FieldWidget`（复用 `getFieldWidget()`）
4. `ViewField` → `FieldElement` 转换函数 `viewFieldToFieldElement()`
5. `editable="bottom"` → 新行在表格底部；`editable="top"` → 在顶部
6. 保存：`callKw(model, 'write', [[recordId], changedFields])`
7. 创建：`callKw(model, 'create', [values])`
8. 删除：`callKw(model, 'unlink', [[recordId]])`（当 `listView.delete === true`）
9. Tab/Enter 键切换到下一个可编辑单元格

**样式**：编辑行高亮（`bg-accent/5`），单元格 widget 使用 compact 样式

### 修改文件

| 文件 | 变更 |
|------|------|
| `views/OdooListRenderer.tsx` | 内联编辑状态 + 单元格 Widget + 保存/创建逻辑 |

### 测试

| 测试 | 文件 |
|------|------|
| editable 列表点击行进入编辑 | `views/__tests__/OdooListRenderer.test.tsx` |
| 编辑模式渲染 Widget | `views/__tests__/OdooListRenderer.test.tsx` |
| 保存调用 `write` | `views/__tests__/OdooListRenderer.test.tsx` |
| 创建新行调用 `create` | `views/__tests__/OdooListRenderer.test.tsx` |
| 非编辑列表不触发内联编辑 | `views/__tests__/OdooListRenderer.test.tsx` |
| readonly 字段仍只读 | `views/__tests__/OdooListRenderer.test.tsx` |

---

## 四、8.3 — Calendar 日历视图 (P1)

### 问题

缺少日历视图。CRM 的 Meeting、Project 的 Task 都需要日历展示。

### 类型 — `lib/odoo-types.ts`

```typescript
export interface ParsedCalendarView {
  type: 'calendar'
  string: string
  dateStart: string
  dateStop?: string
  colorField?: string
  mode: 'day' | 'week' | 'month'
  fields: string[]
  avatarField?: string
  eventLimit?: number
  quickCreate?: boolean
  hideTime?: boolean
}
```

### XML 解析器 — `lib/xml-parser.ts`

新增 `parseCalendarXml(xml: string): ParsedCalendarView`：

- 根元素 `<calendar>` 属性：`date_start`, `date_stop`, `color`, `mode`, `event_limit`, `quick_create`, `hide_time`
- 子 `<field>` 元素：`name`, `avatar_field`
- 默认 `mode="month"`

### OdooCalendarRenderer — 新文件 `views/OdooCalendarRenderer.tsx`

**Props**: `{ model, arch, fields, domain, onRecordClick }`

**实现**：

- 解析 XML → `ParsedCalendarView`
- TanStack Query 获取 `search_read`（含 dateStart/dateStop/colorField 字段）
- 日期范围变化时重新获取数据
- 使用 `react-big-calendar` 渲染月/周/日视图
- 事件颜色：`colorField` 值 hash 到 7 色调色板
- 事件文本：第一个 field 值（通常是 name）
- 点击事件 → `onRecordClick(recordId)`

**日期过滤**：
```typescript
domain = [...initialDomain, [dateStart, '>=', rangeStart], [dateStart, '<=', rangeEnd]]
```

### 集成点

| 文件 | 变更 |
|------|------|
| `views/OdooViewLoader.tsx` | viewType 加 `'calendar'`；新增渲染分支 |
| `views/OdooViewSwitcher.tsx` | VIEWS 加 calendar 选项（lucide-react `Calendar` 图标） |
| `routes/web.tsx` | viewType 状态加 `'calendar'` |

### 依赖

```bash
bun add react-big-calendar date-fns
bun add -D @types/react-big-calendar
```

选 react-big-calendar 而非 @fullcalendar/react：80KB vs 200KB gzip，无商业许可限制。

### 测试

| 测试 | 文件 |
|------|------|
| parseCalendarXml 基本属性 | `lib/__tests__/xml-parser.test.ts` |
| parseCalendarXml 默认 mode="month" | `lib/__tests__/xml-parser.test.ts` |
| parseCalendarXml 提取 avatarField | `lib/__tests__/xml-parser.test.ts` |
| 渲染日历容器 | `views/__tests__/OdooCalendarRenderer.test.tsx` |
| 点击事件触发 onRecordClick | `views/__tests__/OdooCalendarRenderer.test.tsx` |

---

## 五、8.4 — ControlPanel 工具栏 (P1)

### 问题

`get_views` 已传 `toolbar: true`，但返回的 toolbar 数据（打印/动作按钮）未被提取和使用。

### 类型 — `lib/odoo-types.ts`

```typescript
export interface ToolbarAction {
  id: number
  name: string
  type: string
  display_name: string
}

export interface ViewToolbar {
  print: ToolbarAction[]
  action: ToolbarAction[]
  other: ToolbarAction[]
}
```

### ControlPanel — 新文件 `components/ControlPanel.tsx`

**Props**: `{ toolbar?: ViewToolbar, model, recordId }`

**渲染**：

- Print 下拉（toolbar.print 非空时）
- Action 下拉（toolbar.action 非空时）
- toolbar 为空不渲染

**动作执行**：

- Print → `callKw('ir.actions.report', 'read', [[id], fields])` → 打开 PDF
- Server action → `callKw('ir.actions.server', 'run', [[id]])` → invalidateQueries
- Window action → 导航到新视图

### 集成 — `views/OdooViewLoader.tsx`

- 更新 `get_views` 响应类型：`views[type]` 增加 `toolbar?: ViewToolbar`
- 从 `activeView` 提取 toolbar
- 在面包屑栏右侧（viewSwitcher 前）渲染 `<ControlPanel>`

### 测试

| 测试 | 文件 |
|------|------|
| 渲染 Print 下拉 | `components/__tests__/ControlPanel.test.tsx` |
| 渲染 Action 下拉 | `components/__tests__/ControlPanel.test.tsx` |
| 空 toolbar 不渲染 | `components/__tests__/ControlPanel.test.tsx` |
| Print 触发报表 | `components/__tests__/ControlPanel.test.tsx` |
| Server action 执行 | `components/__tests__/ControlPanel.test.tsx` |

---

## 六、8.5 — Activity 日程管理 (P2)

### 问题

Odoo 的 `mail.activity` 模型提供任务日程管理，在表单上显示待办活动（逾期/今日/计划）。

### 类型 — `lib/odoo-types.ts`

```typescript
export interface OdooActivity {
  id: number
  activity_type_id: [number, string]
  summary: string
  note: string
  date_deadline: string
  state: 'overdue' | 'today' | 'planned'
  user_id: [number, string]
  res_model: string
  res_id: number
}
```

### ActivityPanel — 新文件 `components/ActivityPanel.tsx`

**Props**: `{ model, recordId }`

**功能**：

- 获取活动：`callKw('mail.activity', 'search_read', [[domain], fields])`
- 按状态分组：overdue（红）/ today（黄）/ planned（绿）
- 「Schedule Activity」→ 弹出表单（activity type + summary + note + deadline + assign to）
- 「Mark Done」→ `callKw('mail.activity', 'action_feedback', [[id], {feedback}])`
- 「Cancel」→ `callKw('mail.activity', 'unlink', [[id]])`

### 集成 — `views/OdooFormRenderer.tsx`

表单 Sheet 下方渲染 `<ActivityPanel>`（同宽 max-w-860px）。

### 测试

| 测试 | 文件 |
|------|------|
| 无活动渲染空状态 | `components/__tests__/ActivityPanel.test.tsx` |
| 按状态分组展示 | `components/__tests__/ActivityPanel.test.tsx` |
| 调度创建活动 | `components/__tests__/ActivityPanel.test.tsx` |
| 完成调用 action_feedback | `components/__tests__/ActivityPanel.test.tsx` |

---

## 七、8.6 — Chatter 消息线程 (P2)

### 问题

Odoo 表单底部的消息/笔记/关注者面板（Chatter）是协作核心功能。

### 类型 — `lib/odoo-types.ts`

```typescript
export interface OdooMessage {
  id: number
  body: string
  author_id: [number, string]
  date: string
  message_type: 'comment' | 'notification' | 'email'
  subtype_id: [number, string]
  attachment_ids: [number, string][]
  partner_ids: [number, string][]
  is_note: boolean
}

export interface OdooFollower {
  id: number
  partner_id: [number, string]
  channel_id: [number, string] | false
}
```

### Chatter — 新文件 `components/Chatter.tsx`

**Props**: `{ model, recordId }`

内含子组件：ChatterTopbar、ChatterComposer、ChatterMessageList

**功能**：

- 获取消息：`callKw('mail.message', 'search_read', [[domain], fields], {order: 'date desc', limit: 30})`
- 发送消息：`callKw(model, 'message_post', [[recordId]], {body, subtype_xmlid: 'mail.mt_comment'})`
- 发送笔记：`subtype_xmlid: 'mail.mt_note'`
- 关注者：`callKw('mail.followers', 'search_read', [[domain], ['partner_id']])`
- 关注/取关：`callKw(model, 'message_subscribe'/'message_unsubscribe', ...)`
- HTML 渲染：`dangerouslySetInnerHTML`

### 集成 — `views/OdooFormRenderer.tsx`

ActivityPanel 下方渲染 `<Chatter>`（同宽 max-w-860px）。

### 测试

| 测试 | 文件 |
|------|------|
| 无消息渲染空状态 | `components/__tests__/Chatter.test.tsx` |
| 渲染消息列表 | `components/__tests__/Chatter.test.tsx` |
| 发送消息调用 message_post | `components/__tests__/Chatter.test.tsx` |
| 显示关注者 | `components/__tests__/Chatter.test.tsx` |
| 切换关注调用 subscribe | `components/__tests__/Chatter.test.tsx` |

---

## 八、文件变更汇总

### 新文件

```
apps/oweb/src/
├── views/OdooCalendarRenderer.tsx
├── components/ControlPanel.tsx
├── components/ActivityPanel.tsx
├── components/Chatter.tsx
├── views/__tests__/OdooCalendarRenderer.test.tsx
├── components/__tests__/ControlPanel.test.tsx
├── components/__tests__/ActivityPanel.test.tsx
└── components/__tests__/Chatter.test.tsx
```

### 修改文件

| 文件 | 任务 |
|------|:----:|
| `lib/odoo-types.ts` | 全部 |
| `lib/xml-parser.ts` | 8.1, 8.3 |
| `views/field-widgets.tsx` | 8.1 |
| `views/OdooListRenderer.tsx` | 8.2 |
| `views/OdooViewLoader.tsx` | 8.3, 8.4 |
| `views/OdooViewSwitcher.tsx` | 8.3 |
| `views/OdooFormRenderer.tsx` | 8.5, 8.6 |
| `routes/web.tsx` | 8.3 |

### 新依赖

```bash
bun add react-big-calendar date-fns
bun add -D @types/react-big-calendar
```

---

## 九、验证方案

每个任务完成后执行：

```bash
cd apps/oweb
bun run build     # tsc + vite build
bun run lint      # biome check
bun run format    # biome format
bun run test      # vitest
```

**手动验证**：

| 任务 | 验证方式 |
|------|----------|
| 8.1 | `sale.order` 表单 → order_line 内联表格 → 添加/删除行 → 保存 |
| 8.2 | 可编辑列表 → 点击行编辑 → 修改字段 → 保存 |
| 8.3 | CRM → Calendar 视图 → 月/周/日切换 → 点击事件 |
| 8.4 | 任意视图 → Print/Action 下拉 → 执行动作 |
| 8.5 | 表单 → Activity 面板 → 调度/完成/取消 |
| 8.6 | 表单 → Chatter → 发送消息/笔记 → 关注/取关 |

---

**文档版本**: 1.0
**更新日期**: 2026-05-30
