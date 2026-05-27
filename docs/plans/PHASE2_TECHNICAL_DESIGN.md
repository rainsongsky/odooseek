# Phase 2 技术方案与开发计划

> **目标**：实现 Odoo 19 CE 元数据驱动的动态视图渲染引擎，严格遵循 Odoo 真实 API 契约。

---

## 一、核心修正：基于 Odoo 19 CE 源码的真实 API

### 1.1 关键发现（来自 `~/EA/odoo` 源码分析）

| 发现 | 说明 |
|------|------|
| **单一 RPC 入口** | 所有模型操作走 `POST /web/dataset/call_kw` + `{model, method, args, kwargs}`，无独立 search_read/fields_get 端点 |
| **`fields_view_get()` 已移除** | Odoo 19 CE 用 `get_view()` / `get_views()` 替代，返回 `{arch, id, model, models}`（字段定义由独立 `fields_get()` 调用获取） |
| **视图类型重命名** | `'tree'` → `'list'`，有效类型: `list, form, kanban, graph, pivot, calendar, search, qweb` |
| **Bus 架构变更** | 无 `/web/bus/poll`：轮询用 `POST /websocket/peek_notifications`，主通道用 `ws://odo/websocket` |
| **Session 返回丰富** | `authenticate()` 返回 50+ 键的完整 `session_info`（含 `user_companies`, `currencies`, `server_version` 等） |
| **JSON-RPC params 必须是对象** | Odoo `JsonRPCDispatcher` 明确要求 `params` 为 JSON Object，不接受 Array |

### 1.2 `get_views()` — 一次调用获取所有视图和字段

```json
// 请求: POST /web/dataset/call_kw
{
  "model": "res.partner",
  "method": "get_views",
  "args": [[[false, "list"], [false, "search"]]],
  "kwargs": { "options": { "toolbar": true, "load_filters": true } }
}

// 返回:
{
  "views": {
    "list": {
      "arch": "<tree string=\"Contacts\"><field name=\"name\"/><field name=\"email\"/></tree>",
      "id": 5,
      "model": "res.partner"
    },
    "search": {
      "arch": "<search><field name=\"name\"/><filter name=\"company\" domain=\"[('is_company','=',true)]\"/></search>",
      "id": 128,
      "model": "res.partner"
    }
  },
  "models": {
    "res.partner": {
      "name": {"type": "char", "string": "Name", "required": true, "readonly": false, ...},
      "email": {"type": "char", "string": "Email", "required": false, ...}
    }
  }
}
```

### 1.3 Phase 1 待修复项

Phase 1 的 `odoo-web-server/src/ws.rs` 轮询了不存在的 `/web/bus/poll`，需修正：

```
修正前: POST {odoo_url}/web/bus/poll
修正后: POST {odoo_url}/websocket/peek_notifications
  body: { channels: [], last: {counter}, is_first_poll: false }
  response: { channels: [...], notifications: [{id: N, message: {...}}] }
```

---

## 二、odoo-web-server API 设计

### 2.1 设计原则

> **不做重复造轮子** — Odoo 已有 `call_kw` 单一入口 + `get_views()` 批量接口。odoo-web-server 的职责是**透传 + 缓存**，而非创建新端点。

### 2.2 路由修正

| 路由 | 作用 | 实现 |
|------|------|------|
| `POST /api/odoo/{*path}` | JSON-RPC 透传（已有） | `proxy.rs` — 保持 |
| `GET /api/menu` | 动态导航菜单 | **新增** — 调用 `ir.ui.menu.search_read` |
| `GET /api/session` | 当前会话（已有） | `session.rs` — 修正返回格式，透传完整 `session_info()` |

**不再新增的端点**（通过 `call_kw` 实现）：

| 前端请求 | 实际调用 |
|----------|----------|
| 获取列表/表单视图 + 字段 | `call_kw(model, 'get_views', [[[false, 'list'], [false, 'form']]], {})` |
| 搜索数据 | `call_kw(model, 'search_read', [[domain], [fields]], {limit, offset, order})` |
| 读单条记录 | `call_kw(model, 'read', [[id], [fields]], {})` |
| 创建/更新/删除 | `call_kw(model, 'create'/'write'/'unlink', ...)` |

### 2.3 Menu 端点实现

```rust
// crates/odoo-web-server/src/menu.rs

pub async fn get_menu(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let payload = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "ir.ui.menu",
            "method": "search_read",
            "args": [
                [["parent_id", "=", false]],           // root menus only
                ["id", "name", "action", "children", "sequence", "web_icon"]
            ],
            "kwargs": {}
        },
        "id": 1,
    });

    // Forward to Odoo via proxy, cache 15 min
}
```

---

## 三、前端视图引擎

### 3.1 架构

```
apps/oweb/src/views/
├── OdooViewLoader.tsx      # ★ 核心：一次 call_kw 获取 get_views() 全部
├── OdooListRenderer.tsx    # 解析 <list> XML + 渲染数据表
├── OdooFormRenderer.tsx    # 解析 <form> XML + 递归布局渲染
├── OdooKanbanRenderer.tsx  # 解析 <kanban> XML + 卡片布局
├── OdooSearchPanel.tsx     # 解析 <search> XML + 过滤器/分组
├── OdooViewSwitcher.tsx    # 视图模式切换器 (list/form/kanban)
├── xml-parser.ts           # Odoo XML 视图解析器
├── field-widgets.tsx       # 字段类型 → React Widget 映射
└── types.ts                # Odoo 视图类型定义
```

### 3.2 OdooViewLoader — 核心组件

```typescript
interface ViewLoaderProps {
  model: string
  viewType: 'list' | 'form' | 'kanban'
  viewId?: number
  domain?: unknown[]
  recordId?: number
}

export function OdooViewLoader({ model, viewType, viewId, domain, recordId }: ViewLoaderProps) {
  // 一次调用获取 LIST + FORM + KANBAN 全部视图 + 全部字段
  const viewsToLoad: [number | false, string][] = [
    [viewId ?? false, viewType],
    ...(viewType !== 'list' ? [[false, 'list'] as const] : []),
    ...(viewType !== 'form' ? [[false, 'form'] as const] : []),
  ]

  const { data: viewData, isLoading } = useQuery({
    queryKey: ['odoo', 'get_views', model, viewsToLoad],
    queryFn: () => callKw(model, 'get_views', [viewsToLoad], {}),
    staleTime: 15 * 60_000,
  })

  if (isLoading) return <LoadingSpinner />

  const activeView = viewData?.views?.[viewType]
  const fields = viewData?.models?.[model] ?? {}

  switch (viewType) {
    case 'list':
      return <OdooListRenderer model={model} arch={activeView?.arch} fields={fields} domain={domain}/>
    case 'form':
      return <OdooFormRenderer model={model} arch={activeView?.arch} fields={fields} recordId={recordId}/>
    case 'kanban':
      return <OdooKanbanRenderer model={model} arch={activeView?.arch} fields={fields} domain={domain}/>
  }
}
```

### 3.3 XML 视图解析器 (`xml-parser.ts`)

**支持 `<list>` XML 解析**（注意：Odoo 19 用 `list` 非 `tree`）:

```typescript
interface ParsedListView {
  string: string
  editable?: 'top' | 'bottom'
  create?: boolean
  delete?: boolean
  multi_edit?: boolean
  limit?: number
  columns: ListColumn[]
}

interface ListColumn {
  name: string
  string?: string          // 列标题
  invisible?: number        // 0=显示, 1=隐藏, 2=debug 模式显示
  optional?: 'show' | 'hide'
  sum?: string
  decoration_bf?: string    // 条件加粗
  decoration_it?: string    // 条件斜体
  decoration_danger?: string
  widget?: string
  width?: string
}
```

**支持 `<form>` XML 嵌套结构**:

```typescript
type FormElement =
  | { type: 'sheet', elements: FormElement[] }
  | { type: 'group', string?: string, col?: number, elements: FormElement[] }
  | { type: 'notebook', pages: { string: string, elements: FormElement[] }[] }
  | { type: 'field', name: string, widget?: string, readonly?: boolean,
      required?: boolean, invisible?: boolean, nolabel?: boolean, placeholder?: string }
  | { type: 'label', string: string }
  | { type: 'separator', string?: string }
  | { type: 'newline' }
  | { type: 'button', string: string, name?: string, type?: string, icon?: string }
```

### 3.4 字段 Widget 映射 (`field-widgets.tsx`)

```typescript
type FieldWidgetComponent = React.ComponentType<{
  field: FieldMeta       // { name, type, string, required, readonly, ... }
  value: unknown
  onChange: (value: unknown) => void
  context: Record<string, unknown>
}>

const TYPE_WIDGETS: Record<string, FieldWidgetComponent> = {
  char:       CharWidget,
  text:       TextWidget,
  integer:    IntegerWidget,
  float:      FloatWidget,
  monetary:   MonetaryWidget,
  boolean:    BooleanWidget,
  date:       DateWidget,
  datetime:   DateTimeWidget,
  selection:  SelectionWidget,
  many2one:   Many2OneWidget,     // 搜索下拉 + 自动补全
  many2many:  Many2ManyWidget,    // 多选标签
  one2many:   One2ManyWidget,     // 内联子列表
  binary:     BinaryWidget,
  html:       HtmlWidget,
  reference:  ReferenceWidget,
}

// widget 属性覆盖（Odoo field 的 widget="" 属性）
const WIDGET_OVERRIDES: Record<string, FieldWidgetComponent> = {
  phone:   PhoneWidget,
  email:   EmailWidget,
  url:     UrlWidget,
  image:   ImageWidget,
  monetary: MonetaryWidget,
  priority: PriorityWidget,
  many2many_tags: Many2ManyWidget,
  many2many_binary: Many2ManyWidget,
  many2many_checkboxes: Many2ManyWidget,
  one2many_list: One2ManyWidget,
  handle:  HandleWidget,
  statinfo: StatInfoWidget,
  barcode_handler: BarcodeWidget,
}
```

### 3.5 OdooFormRenderer — 递归布局

```typescript
export function OdooFormRenderer({ model, arch, fields, recordId }: FormRendererProps) {
  const formLayout = useMemo(() => parseFormXml(arch), [arch])

  // 编辑模式：读取记录
  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () => callKw(model, 'read', [[recordId]]),
    enabled: !!recordId,
  })

  return <FormLayoutNode node={formLayout} record={record?.[0]} fields={fields} model={model}/>
}

// 递归渲染
function FormLayoutNode({ node, record, fields, model }: NodeProps) {
  switch (node.type) {
    case 'sheet':
      return <div className="p-6">{node.elements.map((el, i) =>
        <FormLayoutNode key={i} node={el} record={record} fields={fields} model={model}/>
      )}</div>
    case 'group':
      return (
        <fieldset className="mb-4 rounded-lg border border-border-subtle p-4">
          {node.string && <legend className="text-xs text-text-secondary">{node.string}</legend>}
          <div className={`grid gap-4 ${node.col ? `grid-cols-${node.col}` : 'grid-cols-2'}`}>
            {node.elements.map((el, i) =>
              <FormLayoutNode key={i} node={el} record={record} fields={fields} model={model}/>
            )}
          </div>
        </fieldset>
      )
    case 'field': {
      const meta = fields[node.name]
      if (!meta) return null
      const Widget = getFieldWidget(node, meta)
      return (
        <div className={node.invisible ? 'hidden' : ''}>
          {!node.nolabel && (
            <label className="mb-1 block text-xs text-text-secondary">{node.string || meta.string}</label>
          )}
          <Widget field={meta} value={record?.[node.name]} onChange={...}/>
        </div>
      )
    }
    case 'notebook':
      return <TabView pages={node.pages.map(p => ({ label: p.string, content: <FormLayoutNode .../> }))}/>
    case 'separator':
      return <hr className="my-2 border-border-subtle"/>
    case 'newline':
      return <div className="col-span-full"/>
  }
}
```

---

## 四、WebSocket 事件修复

### 4.1 Phase 1 修正

**文件**: `crates/odoo-web-server/src/ws.rs`

```rust
// 修正：使用 peek_notifications 而非不存在的 /web/bus/poll
pub async fn poll_odoo_bus(client: reqwest::Client, odoo_url: String, event_tx: broadcast::Sender<Value>) {
    let bus_url = format!("{}/websocket/peek_notifications", odoo_url.trim_end_matches('/'));
    let mut last: i64 = 0;

    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;

        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "call",
            "params": {
                "channels": [],
                "last": last,
                "is_first_poll": false,
            },
            "id": 1,
        });

        let response = match client.post(&bus_url).json(&payload).send().await {
            Ok(r) => r,
            Err(e) => { tracing::warn!("Bus poll failed: {e}"); continue; }
        };

        let body: Value = match response.json().await {
            Ok(b) => b,
            Err(e) => { tracing::warn!("Bus response parse failed: {e}"); continue; }
        };

        // Odoo 19 CE returns { channels, notifications: [{id, message}] }
        if let Some(notifications) = body.get("result").and_then(|r| r.get("notifications")).and_then(|n| n.as_array()) {
            if !notifications.is_empty() {
                last = notifications.iter()
                    .filter_map(|n| n.get("id").and_then(|id| id.as_i64()))
                    .max()
                    .unwrap_or(last);
                for n in notifications {
                    let _ = event_tx.send(n.clone());
                }
            }
        }
    }
}
```

### 4.2 前端 EventPanel

```typescript
export function EventPanel() {
  const queryClient = useQueryClient()
  const [events, setEvents] = useState<OdooBusNotification[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws/events`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      setTimeout(() => { /* reconnect */ }, 5000)
    }
    ws.onmessage = (e) => {
      const notification = JSON.parse(e.data)
      setEvents(prev => [...prev.slice(-49), notification])
      // Auto-refresh related model queries
      if (notification.message?.payload?.model) {
        queryClient.invalidateQueries({ queryKey: ['odoo', 'data', notification.message.payload.model] })
      }
    }
    return () => ws.close()
  }, [queryClient])

  return (
    <div className="flex items-center justify-end border-t border-border-subtle bg-root px-4 py-1">
      <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}/>
        {connected ? `Live (${events.length})` : 'Disconnected'}
      </span>
    </div>
  )
}
```

---

## 五、Session 格式修正

### 5.1 Rust 类型对齐

```rust
// crates/odoo-core/src/types.rs

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub authenticated: bool,
    pub uid: Option<i64>,
    pub name: Option<String>,
    pub username: Option<String>,
    pub db: Option<String>,
    pub is_admin: Option<bool>,
    pub is_system: Option<bool>,
    pub partner_id: Option<i64>,
    pub partner_display_name: Option<String>,
    pub user_companies: Option<Value>,
    pub server_version: Option<String>,
    pub server_version_info: Option<Vec<Value>>,
    pub user_context: Option<Value>,
    pub web_base_url: Option<String>,
}
```

### 5.2 前端对齐

```typescript
// apps/oweb/src/lib/auth.tsx
interface AuthState {
  authenticated: boolean
  uid: number | null
  name: string | null
  username: string | null
  db: string | null
  isAdmin: boolean
  partnerDisplayName: string | null
  serverVersion: string | null
}
```

---

## 六、开发顺序（修正后）

```
第 1 步 (0.5 天): Phase 1 修复
  ├── ws.rs: /web/bus/poll → /websocket/peek_notifications
  └── session.rs: 返回完整 session_info

第 2 步 (0.5 天): Menu 端点
  └── odoo-web-server/src/menu.rs

第 3 步 (1 天):  前端 RPC SDK 更新
  └── lib/api.ts: 添加 callKw(model, method, args, kwargs) 通用函数

第 4 步 (1 天):  XML 解析器
  └── views/xml-parser.ts (list/form/kanban/search)

第 5 步 (1 天):  字段 Widget 映射
  └── views/field-widgets.tsx

第 6 步 (1 天):  OdooViewLoader (get_views 一次调用)
  └── views/OdooViewLoader.tsx

第 7 步 (1 天):  OdooListRenderer
  └── views/OdooListRenderer.tsx

第 8 步 (1.5 天): OdooFormRenderer
  └── views/OdooFormRenderer.tsx

第 9 步 (1 天):  OdooViewSwitcher + OdooSearchPanel
  └── views/OdooViewSwitcher.tsx, views/OdooSearchPanel.tsx

第 10 步 (0.5 天): EventPanel + 自动刷新
  └── views/EventPanel.tsx

第 11 步 (0.5 天): MenuPage 动态导航
  └── routes/menu.tsx
```

**总计**: 9 个工作日

---

## 七、Phase 2 完成标准（修正后）

```
[ ] ws.rs 修正: 使用 /websocket/peek_notifications
[ ] session.rs 修正: 返回完整 session_info (name, partner_id, companies, ...)
[ ] GET /api/menu → JSON 菜单树
[ ] lib/api.ts: callKw(model, method, args, kwargs)
[ ] xml-parser.ts: 解析 <list> <form> <kanban> <search> XML
[ ] field-widgets.tsx: 12+ 字段类型 Widget
[ ] OdooViewLoader: 一次 call_kw(get_views) 获取全部视图+字段
[ ] OdooListRenderer: <list> XML → 动态列定义 + TanStack Query 渲染
[ ] OdooFormRenderer: <form> XML → 递归渲染 sheet/group/notebook/field
[ ] OdooViewSwitcher: list/form/kanban 视图切换
[ ] EventPanel: WebSocket 连接 + 自动刷新相关模型
[ ] MenuPage: ir.ui.menu 动态导航
[ ] cargo clippy + cargo build + bun build 全部通过
```

---

**文档版本**: 2.0  
**创建日期**: 2026-05-28  
**更新**: 基于 Odoo 19 CE 源码真实 API 修正  
**维护团队**: OdooSeek
