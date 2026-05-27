# Phase 2 技术方案与开发计划

> **目标**：实现 Odoo 元数据驱动的动态视图渲染引擎——从 `ir.ui.view` 获取 XML 定义，前端动态解析并渲染列表/表单/看板，替代硬编码字段方案。

---

## 一、核心修正：遵循 Odoo 元数据驱动哲学

### 1.1 修正原理

Odoo 的视图定义存储在 `ir.ui.view` 表中，而非前端代码中：

```xml
<!-- Odoo ir.ui.view 表 arch_db 字段中的 XML -->
<form string="Partner">
  <sheet>
    <group>
      <field name="name"/>
      <field name="email"/>
      <field name="phone" widget="phone"/>
      <field name="company_id" options="{'no_create': True}"/>
    </group>
  </sheet>
</form>
```

OdooSeek 遵循相同原则：

```
Odoo 原生路径:
  浏览器 → Python 控制器 → ir.ui.view → XML 解析 → QWeb 模板 → HTML

OdooSeek 路径:
  浏览器 → odoo-web-server → Odoo JSON-RPC → ir.ui.view → XML → React 组件 → DOM
```

**前端不硬编码任何视图结构。** 字段列表、标签文本、widget 类型、只读/必填状态、继承关系全部从数据库获取。

---

## 二、odoo-web-server 新增端点

### 2.1 路由表（新增）

| 路由 | 处理 | 用途 |
|------|------|------|
| `GET /api/model/{model}/fields` | Rust → Odoo `fields_get()` | 获取模型字段元数据（类型、标签、必填、只读） |
| `GET /api/view/{model}/{view_type}` | Rust → Odoo `ir.ui.view` search_read | 获取特定模型的视图 XML（form/tree/kanban/search） |
| `GET /api/menu` | Rust → Odoo `ir.ui.menu` search_read | 动态构建导航菜单 |
| `GET /api/action/{id}` | Rust → Odoo `ir.actions.*` read | 获取动作定义（目标模型、视图模式） |

### 2.2 字段元数据端点

**请求**: `GET /api/model/res.partner/fields`

**实现**:
```rust
// crates/odoo-web-server/src/view.rs
pub async fn get_model_fields(
    State(state): State<AppState>,
    Path(model): Path<String>,
) -> Result<Json<Value>, AppError> {
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [
                state.odoo_db.as_deref().unwrap_or(""),
                state.uid.unwrap_or(0),
                state.password.as_deref().unwrap_or(""),
                model,
                "fields_get",
                [],
                {},
            ],
        },
        "id": 1,
    });

    // ... forward to Odoo, cache response with model name as key
}
```

**响应**:
```json
{
  "name": { "type": "char", "string": "Name", "required": true, "readonly": false },
  "email": { "type": "char", "string": "Email", "required": false, "readonly": false },
  "phone": { "type": "char", "string": "Phone", "required": false, "readonly": false },
  "company_id": { "type": "many2one", "string": "Company", "relation": "res.company" }
}
```

### 2.3 视图 XML 端点

**请求**: `GET /api/view/res.partner/tree`

**实现**:
```rust
pub async fn get_view(
    State(state): State<AppState>,
    Path((model, view_type)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    // search_read ir.ui.view with domain:
    // [("model", "=", model), ("type", "=", view_type)]
    // Return arch_base (XML string) + fields (field definitions)
}
```

**响应**:
```json
{
  "arch": "<tree string=\"Contacts\"><field name=\"name\"/><field name=\"email\"/><field name=\"phone\"/><field name=\"company_id\"/></tree>",
  "fields": {
    "name": { "string": "Name", "type": "char", ... },
    "email": { "string": "Email", "type": "char", ... }
  }
}
```

### 2.4 缓存策略

| 缓存项 | TTL | 理由 |
|--------|-----|------|
| 模型字段 (`fields_get`) | 30 min | 模块安装/升级时才变更 |
| 视图 XML (`ir.ui.view`) | 15 min | 视图修改可即时清缓存 |
| 菜单树 (`ir.ui.menu`) | 15 min | 按用户角色缓存 |

实现：odoo-web-server 的 `AppState` 新增 `Arc<DashMap<String, CachedValue>>`。

---

## 三、前端视图引擎组件

### 3.1 架构

```
apps/oweb/src/views/
├── OdooListView.tsx       # 列表视图（读取 <tree> XML）
├── OdooFormView.tsx       # 表单视图（读取 <form> XML）
├── OdooKanbanView.tsx     # 看板视图（读取 <kanban> XML）
├── OdooSearchView.tsx     # 搜索视图（读取 <search> XML）
├── OdooViewRenderer.tsx   # 视图分发器：根据 view_type 渲染对应组件
├── xml-parser.ts          # Odoo XML 视图解析器
├── field-widgets.tsx      # 字段类型 → React Widget 映射
└── types.ts               # Odoo 视图类型定义
```

### 3.2 XML 视图解析器 (`xml-parser.ts`)

**输入**: Odoo `<tree>`, `<form>`, `<kanban>` XML 字符串

**输出**: 结构化 JSON

```typescript
interface ParsedTreeView {
  type: 'tree'
  string: string        // 视图标题
  editable?: 'top' | 'bottom'
  fields: TreeField[]
}

interface TreeField {
  name: string           // 字段名
  string?: string        // 列标题（覆盖模型默认 label）
  invisible?: string     // 可见性条件
  optional?: 'show' | 'hide'
  sum?: string           // 汇总函数
  decoration?: string    // 条件样式
}

interface ParsedFormView {
  type: 'form'
  string: string
  elements: FormElement[]
}

type FormElement = SheetElement | GroupElement | NotebookElement | FieldElement | ...

interface FieldElement {
  type: 'field'
  name: string
  widget?: string        // 覆盖默认 widget
  options?: Record<string, unknown>
  invisible?: string
  required?: boolean
  readonly?: boolean
  placeholder?: string
  nolabel?: boolean
}
```

**解析逻辑**:
1. 使用 `DOMParser` 解析 XML 字符串
2. 递归遍历 `<sheet>`, `<group>`, `<notebook>`, `<page>` 嵌套结构
3. 对 `<field>` 元素提取 name/widget/options/invisible/readonly 等属性
4. 处理 `attrs="{'invisible': [('state', '=', 'draft')]}"` 的条件表达式
5. 支持 `<xpath>` 继承（从多个视图合并）

### 3.3 字段 Widget 映射 (`field-widgets.tsx`)

```typescript
// Odoo 字段类型 → React 组件映射
const FIELD_WIDGETS: Record<string, React.ComponentType<FieldWidgetProps>> = {
  char:              CharWidget,           // <input type="text">
  text:              TextWidget,           // <textarea>
  integer:           IntegerWidget,        // <input type="number">
  float:             FloatWidget,          // <input type="number" step="0.01">
  monetary:          MonetaryWidget,       // 带货币符号的数字输入
  boolean:           BooleanWidget,        // <input type="checkbox">
  date:              DateWidget,           // <input type="date">
  datetime:          DateTimeWidget,       // <input type="datetime-local">
  selection:         SelectionWidget,      // <select>
  many2one:          Many2OneWidget,       // 搜索下拉 + 自动补全
  many2many:         Many2ManyWidget,      // 多选标签列表
  one2many:          One2ManyWidget,       // 内联列表
  binary:            BinaryWidget,         // 文件上传/图片预览
  image:             ImageWidget,          // 图片预览 + 上传
  html:              HtmlWidget,           // 富文本编辑器
  reference:         ReferenceWidget,      // 模型 + ID 选择器
}

// 特殊 widget 覆盖
const WIDGET_OVERRIDES: Record<string, React.ComponentType<FieldWidgetProps>> = {
  phone:             PhoneWidget,          // 电话格式
  email:             EmailWidget,          // mailto 链接
  url:               UrlWidget,            // 新窗口打开
  monetary:          MonetaryWidget,
  percentage:        PercentageWidget,
  handle:            HandleWidget,         // 拖拽排序手柄
  priority:          PriorityWidget,       // 星级/表情选择
  statinfo:          StatInfoWidget,       // 统计按钮
  many2one_barcode:  Many2OneBarcodeWidget,// 扫码枪输入
}
```

### 3.4 OdooListView（修正版）

```typescript
interface OdooListViewProps {
  model: string           // 必填：Odoo 模型名
  viewId?: number         // 可选：指定视图 ID（否则取默认 tree 视图）
  domain?: unknown[]      // 可选：初始过滤条件
}

export function OdooListView({ model, viewId, domain }: OdooListViewProps) {
  // 1. 获取视图 XML: GET /api/view/{model}/tree
  const { data: viewData } = useQuery({
    queryKey: ['odoo', 'view', model, 'tree', viewId],
    queryFn: () => fetchView(model, 'tree', viewId),
    staleTime: 15 * 60_000,
  })

  // 2. 解析 XML → 列定义
  const columns = useMemo(() => {
    if (!viewData?.arch) return []
    return parseTreeXml(viewData.arch, viewData.fields)
  }, [viewData])

  // 3. 查询数据: POST /api/odoo/web/dataset/search_read
  const { data: records } = useQuery({
    queryKey: ['odoo', 'data', model, domain, page, order],
    queryFn: () => searchRead(model, columns, domain, page, order),
  })

  // 4. 渲染表格
  return (
    <div className="flex flex-col gap-4">
      <OdooSearchView model={model} onSearch={setDomain} />
      <DataTable columns={columns} records={records} onSort={setOrder} />
      <Pagination page={page} onPage={setPage} />
    </div>
  )
}
```

### 3.5 OdooFormView

```typescript
interface OdooFormViewProps {
  model: string
  recordId?: number      // 编辑模式（有 ID）/ 创建模式（无 ID）
  viewId?: number
}

export function OdooFormView({ model, recordId, viewId }: OdooFormViewProps) {
  // 1. 获取视图 XML: GET /api/view/{model}/form
  const { data: viewData } = useQuery(...)

  // 2. 获取字段元数据: GET /api/model/{model}/fields
  const { data: fields } = useQuery(...)

  // 3. 如果是编辑模式，获取记录数据
  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () => readRecord(model, recordId),
    enabled: !!recordId,
  })

  // 4. 解析 XML + 构建表单结构
  const formLayout = useMemo(() => {
    if (!viewData?.arch) return null
    return parseFormXml(viewData.arch, fields)
  }, [viewData, fields])

  // 5. 递归渲染嵌套布局结构
  return (
    <FormLayoutRenderer
      layout={formLayout}
      record={record}
      fields={fields}
      onChange={handleChange}
      onSave={handleSave}
    />
  )
}

// 递归渲染器
function FormLayoutRenderer({ layout, record, fields, onChange, onSave }: Props) {
  return (
    <div className="space-y-4 p-6">
      {layout.elements.map((el, i) => {
        switch (el.type) {
          case 'sheet':
            return <Sheet key={i}><FormLayoutRenderer .../></Sheet>
          case 'group':
            return <Group key={i} string={el.string}>
              <FormLayoutRenderer .../>
            </Group>
          case 'field':
            const Widget = getWidget(el, fields[el.name])
            return <Widget key={el.name} field={el} value={record?.[el.name]} onChange={onChange}/>
          case 'notebook':
            return <Notebook key={i} pages={el.pages}/>
          // ... more layout types
        }
      })}
    </div>
  )
}
```

### 3.6 OdooViewRenderer（视图分发器）

```typescript
interface OdooViewRendererProps {
  model: string
  viewType: 'list' | 'form' | 'kanban' | 'calendar' | 'pivot' | 'graph'
  viewId?: number
  recordId?: number
  domain?: unknown[]
}

export function OdooViewRenderer({ model, viewType, ...props }: OdooViewRendererProps) {
  switch (viewType) {
    case 'list':
      return <OdooListView model={model} domain={props.domain} viewId={props.viewId}/>
    case 'form':
      return <OdooFormView model={model} recordId={props.recordId} viewId={props.viewId}/>
    case 'kanban':
      return <OdooKanbanView model={model} domain={props.domain} viewId={props.viewId}/>
    case 'calendar':
      return <OdooCalendarView model={model} domain={props.domain}/>
    case 'pivot':
      return <OdooPivotView model={model} domain={props.domain}/>
    case 'graph':
      return <OdooGraphView model={model} domain={props.domain}/>
  }
}
```

---

## 四、WebSocket 事件面板

### 4.1 目标

利用 Phase 1 已实现的 `/ws/events` 端点，创建实时事件显示和模型自动刷新。

### 4.2 EventPanel 组件

```typescript
export function EventPanel() {
  const queryClient = useQueryClient()
  const { events, connected } = useOdooBus()

  useEffect(() => {
    // 监听 Odoo Bus 事件，自动刷新相关模型列表
    for (const event of events) {
      if (event.type === 'record_created' || event.type === 'record_modified') {
        queryClient.invalidateQueries({
          queryKey: ['odoo', 'data', event.model],
        })
      }
    }
  }, [events, queryClient])

  // 在页面底部显示连接状态 + 最近事件
  return (
    <div className="border-t border-border-subtle px-4 py-2">
      <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}/>
      <span className="ml-2 text-xs text-text-muted">
        {connected ? `Live (${events.length} events)` : 'Disconnected'}
      </span>
    </div>
  )
}

function useOdooBus() {
  const [events, setEvents] = useState<OdooBusEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws/events`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      setEvents((prev) => [...prev.slice(-99), JSON.parse(e.data)])
    }
    return () => ws.close()
  }, [])

  return { events, connected }
}
```

---

## 五、更新 Routing 方案

### 5.1 路由调整

```
/_authenticated/                (新增布局：含 EventPanel)
  ├── /                          HomePage
  ├── /menu                      MenuPage (从 ir.ui.menu 动态构建)
  ├── /web                       OdooViewRenderer (主视图)
  │   ├── #model={model}         → OdooViewRenderer
  │   ├── #action={id}           → 加载 action → 跳转到对应 model
  │   ├── #view_type={type}      → 切换视图模式
  │   └── #id={record_id}        → 打开表单
  ├── /dashboard                 DashboardPage
  └── /settings                  SettingsPage
```

### 5.2 MenuPage

```typescript
export function MenuPage() {
  const { data: menuTree } = useQuery({
    queryKey: ['odoo', 'menu'],
    queryFn: () => fetch('/api/menu').then(r => r.json()),
    staleTime: 15 * 60_000,
  })

  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      {menuTree?.map((app) => (
        <AppCard key={app.id} app={app}
          onClick={() => navigate({ to: '/web', search: { action: app.action_id } })}
        />
      ))}
    </div>
  )
}
```

---

## 六、任务分解

### 6.1 子任务清单

| # | 任务 | 工时 | 产出 |
|---|------|------|------|
| 2.1 | odoo-web-server 新增聚合端点 | 2 天 | `view.rs` (fields_get, ir.ui.view search_read, menu) |
| 2.2 | 视图缓存层 (DashMap) | 1 天 | `AppState` 新增 `cache: Arc<DashMap<>>` |
| 2.3 | XML 视图解析器 | 2 天 | `views/xml-parser.ts` (tree/form/kanban/search 解析) |
| 2.4 | 字段 Widget 映射表 | 1.5 天 | `views/field-widgets.tsx` (12+ 字段类型 + widget 覆盖) |
| 2.5 | OdooListView（动态列定义） | 1.5 天 | 读 `<tree>` XML → 自动列定义 → TanStack Query 渲染 |
| 2.6 | OdooFormView（动态表单） | 2.5 天 | 读 `<form>` XML → 递归布局渲染 → Widget 分发 |
| 2.7 | OdooViewRenderer（视图分发器） | 0.5 天 | list/form/kanban 路由 |
| 2.8 | WebSocket EventPanel | 1 天 | `useOdooBus` + `EventPanel` + 自动刷新 |
| 2.9 | MenuPage（动态导航） | 1 天 | `GET /api/menu` → React 渲染 |
| 2.10 | 路由守卫增强 | 0.5 天 | `_authenticated` 布局 + EventPanel 底栏 |

### 6.2 开发顺序

```
Day 1-2   [2.1] odoo-web-server 聚合端点
Day 2-3   [2.2] 视图缓存层
Day 3-5   [2.3] XML 视图解析器 ──────────┐
Day 5-7   [2.4] 字段 Widget 映射表        │
Day 7-9   [2.5] OdooListView ←─ 依赖 2.3  │
Day 9-12  [2.6] OdooFormView ←─ 依赖 2.3,2.4
Day 12-13 [2.7] OdooViewRenderer ── 依赖 2.5,2.6
Day 13-14 [2.8] WebSocket EventPanel
Day 14-15 [2.9] MenuPage
Day 15    [2.10] 路由守卫增强
```

**总计**: 15 个工作日（3 周）

---

## 七、参考来源

| 参考 | 具体借鉴 |
|------|----------|
| `~/EA/odoo/addons/base/models/ir_ui_view.py` | P0 — `ir.ui.view` 模型字段定义、视图继承规则 |
| `~/EA/odoo/addons/web/controllers/dataset.py` | P0 — `fields_get`, `read` API 参数格式 |
| `~/EA/l8-erp-react/packages/biz-ui/.../form-preview.tsx` | P1 — 738 行动态表单渲染逻辑（字段类型分发最完整参考） |
| `~/EA/l8-erp-react/packages/biz-ui/.../list-preview.tsx` | P1 — 列表渲染 + 虚拟滚动模式 |
| `~/EA/l8-erp-react/apps/oweb/src/hooks/use-table-url-state.ts` | P1 — URL ↔ Table 状态同步 |
| `~/EA/l8-erp-react/packages/oweb-core/` | P1 — 视图解析、domain 构建、服务注册 |
| `~/EA/uncode/crates/uncode-platform/src/main.rs` | P3 — axum Router + WebSocket 模式 |

---

## 八、Phase 2 完成标准

```
[ ] GET /api/model/{model}/fields     → JSON 字段元数据
[ ] GET /api/view/{model}/{type}       → XML 视图 + 解析后的 JSON
[ ] GET /api/menu                      → 多级菜单树
[ ] OdooListView 从 <tree> XML 自动生成列定义
[ ] OdooFormView 从 <form> XML 递归渲染布局（sheet/group/notebook/page/field）
[ ] 12 种基础字段类型 Widget 可用 (char/text/int/float/boolean/date/datetime/selection/many2one/many2many/one2many/binary/image)
[ ] WebSocket EventPanel 显示连接状态 + 最近事件
[ ] 数据变更自动刷新相关列表
[ ] MenuPage 从 ir.ui.menu 动态构建导航
[ ] cargo clippy + cargo build + bun build 全部通过
```

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
