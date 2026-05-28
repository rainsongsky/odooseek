# Phase 7 技术方案 — 精进（UI 完善 + 业务闭环）

> **优先级**: P0  
> **前置**: Phase 0-6 已完成  
> **状态**: 📋 待启动  
> **目标**: 补齐表单交互缺失，实现业务流程闭环

---

## 一、差距分析总览

当前 OdooSeek 已实现 List/Form/Kanban/Pivot 四种视图、搜索过滤、分组、编辑保存等核心功能。但与 Odoo 19 CE 原生 Web 客户端相比，存在以下关键差距：

| # | 功能 | 严重程度 | 说明 |
|---|------|:---:|------|
| 1 | 表单 `<header>` + Action 按钮 | **P0** | XML 解析器不处理 `<button>`，无法执行 Confirm/Cancel 等工作流 |
| 2 | 表单 Sheet 布局 | **P0** | 无 header/body 分离，按钮与状态条混在一起 |
| 3 | 分页器改进 | P1 | 有基础分页但缺少页大小选择、首末页、总页数 |
| 4 | 二进制/文件上传 Widget | P1 | `binary` 错误映射为 Many2OneWidget，无法上传/下载 |
| 5 | Graph 图表视图 | P1 | 零实现，需引入图表库 |
| 6 | many2many 标签选择器 | P1 | 当前只显示 #id 徽章，无添加/删除 |
| 7 | one2many 内联列表 | P1 | 无嵌套视图解析，无内联表格 |
| 8 | 列表内联编辑 | P1 | `editable` 已解析但未使用 |
| 9 | ControlPanel 工具栏集成 | P1 | toolbar 数据已获取但未使用 |
| 10 | Calendar 日历视图 | P2 | 需日历库 |
| 11 | Chatter 消息线程 | P2 | 重量级功能，推迟到独立 Phase |

---

## 二、Phase 7 范围定义

### 本次实现（P0 + P1 核心）

```
Phase 7A (P0): 表单 Header + Action 按钮 + Sheet 布局
Phase 7B (P1): 分页器改进 + Binary Widget + Graph 视图
Phase 7C (P1): many2many 标签选择器 + ControlPanel 工具栏
```

### 推迟到 Phase 8

- one2many 内联列表（需要嵌套视图解析，复杂度高）
- 列表内联编辑（需要单元格 Widget 架构重构）
- Calendar 日历视图
- Chatter 消息线程

---

## 三、任务分解

### 3.1 Phase 7A：表单 Header + Action 按钮 + Sheet 布局（P0）

> 关联 Issue: #37（Sheet 布局）

#### 3.1.1 XML 解析器扩展 — `<header>` 和 `<button>`

**文件**: `src/lib/xml-parser.ts`, `src/lib/odoo-types.ts`

**新增类型**:

```typescript
// odoo-types.ts
export interface ButtonElement {
  type: 'button'
  name: string              // 方法名或 action ID
  string?: string           // 按钮显示文字
  buttonType?: 'object' | 'action' | 'edit'  // type 属性
  class?: string            // CSS class (btn-primary 等)
  icon?: string             // 图标类名
  invisible?: string        // 可见性表达式
  states?: string           // 逗号分隔的 state 值
  confirm?: string          // 点击后确认对话框文本
  dataHotkey?: string       // 快捷键
}

export interface HeaderElement {
  type: 'header'
  buttons: ButtonElement[]
}

// FormElement 联合类型新增
export type FormElement =
  | HeaderElement
  | SheetElement
  | GroupElement
  | ...
```

**parseFormElements 扩展**:

```typescript
// 新增 case
if (tag === 'header') {
  const buttons: ButtonElement[] = []
  for (const btn of Array.from(child.querySelectorAll('button'))) {
    buttons.push({
      type: 'button',
      name: btn.getAttribute('name') ?? '',
      string: btn.getAttribute('string') ?? undefined,
      buttonType: (btn.getAttribute('type') as 'object' | 'action' | 'edit') ?? undefined,
      class: btn.getAttribute('class') ?? undefined,
      icon: btn.getAttribute('icon') ?? undefined,
      invisible: btn.getAttribute('invisible') ?? undefined,
      states: btn.getAttribute('states') ?? undefined,
      confirm: btn.getAttribute('confirm') ?? undefined,
    })
  }
  elements.push({ type: 'header', buttons })
}
```

#### 3.1.2 表单 Sheet 布局重构

**文件**: `src/views/OdooFormRenderer.tsx`

**当前布局**（混乱）:
```
┌──────────────────────────────────────┐
│ Statusbar + Title + Edit/Save/Cancel │  ← 所有混在一起
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │   Sheet 内容 (max-w-4xl)        │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**目标布局**（Odoo 原生）:
```
┌──────────────────────────────────────┐
│ Statusbar (state badges)             │  ← header 区域
│ Action Buttons: [Confirm] [Cancel]   │
├──────────────────────────────────────┤
│ Title + [Edit] [Save] [Cancel]       │  ← 控制栏
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │   o_form_sheet (max-w-[860px])  │ │  ← Sheet 区域
│ │   Groups / Notebook / Fields    │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**改动**:
1. `FormLayoutNode` 新增 `header` case → 渲染 `HeaderBar` 子组件
2. `HeaderBar` 渲染 statusbar + action buttons
3. Edit/Save/Cancel 移到独立控制栏（title 右侧）
4. Sheet 区域使用 `max-w-[860px] mx-auto` 居中
5. Action button 点击处理

#### 3.1.3 Action Button 执行逻辑

**文件**: `src/views/OdooFormRenderer.tsx`, `src/lib/api.ts`

| 按钮类型 | 执行方式 | API 调用 |
|----------|----------|----------|
| `type="object"` | 调用模型方法 | `callKw(model, methodName, [[recordId]])` |
| `type="action"` | 执行服务器动作 | `POST /web/action/run {action_id: Number(name)}` |
| `type="edit"` | 切换编辑模式 | `setEditMode(true)` |

**按钮可见性**:
- `states="draft,sent"` → 仅当 `record.state in ['draft', 'sent']` 时可见
- `invisible="state == 'cancel'"` → 使用 `evalModifier()` 判断
- 两者可共存：先检查 `states`，再检查 `invisible`

**确认对话框**:
- `confirm="Are you sure?"` → 点击后弹出 `confirm()` 对话框，确认后执行

#### 3.1.4 新增测试

| # | 测试 | 文件 |
|---|------|------|
| 1 | parseFormXml 解析 `<header>` 包含 buttons | `xml-parser.test.ts` |
| 2 | parseFormXml 解析 button 的 type/name/string/states | `xml-parser.test.ts` |
| 3 | ButtonElement 可见性 — states 匹配 | `OdooFormRenderer.test.tsx` |
| 4 | ButtonElement 可见性 — states 不匹配时隐藏 | `OdooFormRenderer.test.tsx` |
| 5 | 点击 `type="object"` 按钮调用 callKw | `OdooFormRenderer.test.tsx` |
| 6 | 点击 `type="action"` 按钮调用 /web/action/run | `OdooFormRenderer.test.tsx` |
| 7 | Sheet 区域使用 max-w-[860px] 居中 | `OdooFormRenderer.test.tsx` |

---

### 3.2 Phase 7B：分页器改进 + Binary Widget + Graph 视图（P1）

> 关联 Issue: #39（分页器）

#### 3.2.1 分页器改进

**文件**: `src/views/OdooListRenderer.tsx`

**改动**:

| 当前 | 目标 |
|------|------|
| `const limit = 80` (硬编码) | `const [limit, setLimit] = useState(80)` |
| Prev / Next 按钮 | First / Prev / Page X of Y / Next / Last |
| 无页大小选择 | 下拉选择: 40 / 80 / 200 / 500 |
| 无跳页 | 输入框跳转到指定页 |

**新增组件**: `Pagination`（内联在 ListRenderer 或提取为独立组件）

```tsx
function Pagination({ page, total, limit, onPageChange, onLimitChange }) {
  const totalPages = Math.ceil(total / limit)
  return (
    <div className="flex items-center gap-3">
      <select value={limit} onChange={...}>
        <option value={40}>40</option>
        <option value={80}>80</option>
        <option value={200}>200</option>
        <option value={500}>500</option>
      </select>
      <button onClick={() => onPageChange(0)}>«</button>
      <button onClick={() => onPageChange(Math.max(0, page-1))}>‹</button>
      <span>Page {page+1} of {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages-1, page+1))}>›</button>
      <button onClick={() => onPageChange(totalPages-1)}>»</button>
    </div>
  )
}
```

#### 3.2.2 Binary / File Upload Widget

**文件**: `src/views/field-widgets.tsx`

**新增 `BinaryWidget`**:

```tsx
function BinaryWidget({ field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  // readOnly: 显示文件名 + 下载链接
  // editMode: 上传按钮 + 预览 + 清除按钮
}
```

**逻辑**:
- **读取**: Odoo binary 字段值是 base64 字符串或 `false`
- **显示**: 显示文件名（从 `filename` 字段或 `field.filename` 获取）
- **下载**: `<a href="/api/odoo/web/content/{model}/{id}/{field}?download=true">`
- **上传**: `<input type="file">` → `FileReader.readAsDataURL()` → 取 base64 部分 → `onChange(base64)`
- **图片预览**: 如果 `widget="image"` 或 meta.type 包含 image，渲染 `<img src="data:...;base64,...">`

**修复映射**:
```typescript
// field-widgets.tsx
binary: BinaryWidget,       // 替换 Many2OneWidget
```

**新增 `ImageWidget`**:
```typescript
image: BinaryWidget,        // BinaryWidget 内部检测 widget 属性
```

#### 3.2.3 Graph 图表视图

**新增依赖**: `recharts`（React 生态最流行的图表库，与 React 19 兼容）

```bash
bun add recharts
```

**新增文件**:

| 文件 | 说明 |
|------|------|
| `src/views/OdooGraphRenderer.tsx` | 图表渲染器 |
| `src/lib/odoo-types.ts` 新增类型 | `ParsedGraphView`, `GraphField`, `GraphMeasure` |

**`parseGraphXml(xml)`**:

```typescript
interface ParsedGraphView {
  type: 'graph'
  string: string
  graphType: 'bar' | 'line' | 'pie'  // type 属性，默认 bar
  rowFields: GraphField[]
  colFields: GraphField[]
  measures: GraphMeasure[]
  stacked?: boolean
  orderBy?: string
}
```

**`OdooGraphRenderer`**:
- 使用 `read_group` 获取聚合数据（与 Pivot 相同的 API）
- 根据 `graphType` 渲染 `<BarChart>`, `<LineChart>`, `<PieChart>`
- X 轴 = rowFields 分组，Y 轴 = measures 聚合值
- 支持堆叠（stacked）和多度量

**集成**:
- `OdooViewLoader`: viewType 联合类型新增 `'graph'`
- `OdooViewSwitcher`: 新增 Graph 图标按钮
- `web.tsx`: 新增 graph case

**新增测试**:

| # | 测试 |
|---|------|
| 1 | parseGraphXml — 基本柱状图 |
| 2 | parseGraphXml — 饼图 |
| 3 | parseGraphXml — 默认 type=bar |
| 4 | parseGraphXml — 多度量 |
| 5 | OdooGraphRenderer — 渲染图表区域 |

---

### 3.3 Phase 7C：many2many 标签选择器 + ControlPanel 工具栏（P1）

#### 3.3.1 many2many 标签选择器

**文件**: `src/views/field-widgets.tsx`

**替换 `Many2ManyWidget`**:

当前实现：
```tsx
// 只显示 #id 徽章，无交互
function Many2ManyWidget({ value }) {
  return value.map((id, i) => <span key={i}>#{id}</span>)
}
```

目标实现：
```tsx
function Many2ManyWidget({ field, value, onChange, readOnly, meta }) {
  // readOnly: 显示标签列表 [Tag1 ×] [Tag2 ×]
  // editMode:
  //   - 显示已有标签（可点 × 移除）
  //   - 搜索输入框 + 下拉结果
  //   - "Create and Edit" 按钮
  //   - onChange: 使用 Odoo ORM 命令格式 [(6,0,[ids])]
}
```

**关键点**:
- 搜索：`callKw(meta.relation, 'web_name_search', ...)`
- 标签显示：`value` 格式为 `[id1, name1, id2, name2, ...]`
- 添加：用户选择后，将新 id 添加到列表
- 移除：点击 × 从列表移除
- 创建：`callKw(meta.relation, 'create', [{name: search}])` → 返回新 id

#### 3.3.2 ControlPanel 工具栏集成

**背景**: `OdooViewLoader` 已调用 `get_views()` 并传递 `options: { toolbar: true }`，返回数据包含 `toolbar` 字段（Print/Action 按钮），但**完全未使用**。

**新增类型**:

```typescript
interface ToolbarAction {
  id: number
  name: string
  type: string  // ir.actions.report, ir.actions.server, etc.
  display_name: string
}
```

**新增组件**: `ActionDropdown`

```tsx
function ActionDropdown({ actions, model, recordId }: Props) {
  // 渲染 "Action ▼" 下拉菜单
  // 点击执行: callKw 或 /web/action/run
}
```

**集成到 OdooViewLoader**:
- 从 `viewData` 提取 toolbar 数据
- 在控制栏右侧添加 "Print" 和 "Action" 下拉按钮
- Print → 触发报表下载
- Action → 触发服务器动作

---

## 四、文件变更预估

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/views/OdooGraphRenderer.tsx` | Graph 图表视图渲染器 |
| `src/views/__tests__/OdooGraphRenderer.test.tsx` | Graph 测试 |
| `src/components/Pagination.tsx` | 分页器组件 |
| `src/components/__tests__/Pagination.test.tsx` | 分页器测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/xml-parser.ts` | 新增 parseGraphXml + parseFormXml header/button 支持 |
| `src/lib/odoo-types.ts` | 新增 ButtonElement, HeaderElement, ParsedGraphView 等类型 |
| `src/lib/api.ts` | 新增 executeButtonAction 辅助函数 |
| `src/views/OdooFormRenderer.tsx` | Header+Sheet 布局重构 + Action 按钮执行 |
| `src/views/OdooListRenderer.tsx` | 集成分页器组件 |
| `src/views/OdooViewLoader.tsx` | 新增 graph viewType + toolbar 数据使用 |
| `src/views/OdooViewSwitcher.tsx` | 新增 Graph 图标按钮 |
| `src/views/field-widgets.tsx` | BinaryWidget + Many2ManyWidget 重写 |
| `src/routes/web.tsx` | 新增 graph case |
| `package.json` | 新增 recharts 依赖 |

### 新增测试

| 模块 | 新增测试数 |
|------|:---:|
| xml-parser (graph + header/button) | +5 |
| OdooFormRenderer (header/sheet/buttons) | +7 |
| OdooGraphRenderer | +5 |
| Pagination | +4 |
| field-widgets (Binary + Many2Many) | +4 |
| **合计** | **+25** |

---

## 五、执行顺序

```
Week 1: Phase 7A — 表单闭环
  Day 1-2: xml-parser 扩展 (header/button) + 类型定义 + 测试
  Day 3-4: OdooFormRenderer 布局重构 + Action Button 执行逻辑 + 测试
  Day 5: Sheet 居中布局 + 样式调整

Week 2: Phase 7B — 视图增强
  Day 6: Pagination 组件 + 集成到 ListRenderer + 测试
  Day 7: BinaryWidget + ImageWidget + 文件上传/下载
  Day 8-9: Graph 视图 (parseGraphXml + OdooGraphRenderer + recharts) + 测试
  Day 10: Phase 7C — many2many 标签选择器 + ControlPanel toolbar
```

---

## 六、依赖库

| 库 | 版本 | 用途 | 大小 |
|---|---|---|---|
| `recharts` | ^2.x | Graph 图表视图 (Bar/Line/Pie) | ~180KB gzip |

**不引入**:
- Calendar 库（推迟到 Phase 8）
- 富文本编辑器（推迟）
- WebSocket 消息库（Chatter 推迟）

---

## 七、验收标准

1. **表单 Action 按钮**: 打开 CRM Lead 表单 → 可见 "Convert to Opportunity" / "Mark as Lost" 等按钮 → 点击执行对应动作
2. **Sheet 布局**: 表单 header 区域（statusbar + buttons）与 sheet 内容区分离，sheet 居中 max-w-860px
3. **分页器**: 列表底部显示 `40/80/200/500` 页大小选择 + `Page 2 of 5` + 首末页按钮
4. **Binary Widget**: 产品图片字段显示图片预览，可上传替换
5. **Graph 视图**: 销售分析使用 Graph 视图 → 柱状图/饼图正确渲染
6. **many2many 选择器**: 表单中 Tags 字段可搜索、添加、移除标签
7. **所有新增测试通过**: +25 个新测试，总计 168+
8. **CI 绿色**: build + lint + test 全部通过

---

**文档版本**: 1.0  
**创建日期**: 2026-05-29  
**计划周期**: 10 天
