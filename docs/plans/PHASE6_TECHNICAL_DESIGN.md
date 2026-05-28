# Phase 6 技术方案 — 磐石（生产就绪）

> **优先级**: P0  
> **前置**: Phase 0-5 已完成，Phase 7 部分（面包屑/Pivot/Statusbar）已提前交付  
> **状态**: 📋 待启动  
> **目标**: 从 31 个测试扩展到 120+ 个测试，建立完整的测试基础设施

---

## 一、现状分析

### 1.1 当前测试覆盖

| 层 | 测试文件 | 测试数 | 覆盖内容 |
|---|:---:|:---:|---|
| `lib/api.ts` | `api.test.ts` | 4 | searchRead, read, callKw, fieldsGet |
| `lib/expression-evaluator.ts` | `expression-evaluator.test.ts` | 12 | parseKanbanTemplate(5), evalCondition(4), getValue(3) |
| `lib/xml-parser.ts` | `xml-parser.test.ts` | 5 | parseListXml(3), parseFormXml(2) |
| `views/field-widgets.tsx` | `field-widgets.test.ts` | 10 | TYPE_WIDGETS 映射 |
| **合计** | **4 文件** | **31** | **~15% 逻辑覆盖** |

### 1.2 零覆盖模块

| 模块 | 行数 | 风险 | 说明 |
|---|:---:|:---:|---|
| `xml-parser.ts` — parseSearchXml/parsePivotXml/parseKanbanXml | ~130 | 高 | domain 解析涉及安全性 |
| `expression-evaluator.ts` — evalModifier/getDecorationClass | ~40 | 高 | 控制字段可见性与装饰 |
| `components/SearchBar.tsx` | 402 | 高 | 复杂过滤/分组/高级搜索 |
| `views/OdooFormRenderer.tsx` | 407 | 中 | 表单编辑态/onchange/保存验证 |
| `views/OdooListRenderer.tsx` | 319 | 中 | 分组/排序/分页/CSV |
| `views/OdooKanbanRenderer.tsx` | 486 | 中 | 拖拽/分组/快速创建 |
| `views/OdooPivotRenderer.tsx` | 204 | 中 | 交叉表聚合 |
| `components/Breadcrumbs.tsx` | 73 | 低 | 导航链路 |
| `themes/` | ~300 | 低 | 主题引擎 |
| **Rust 后端 (10 文件)** | ~900 | 高 | **0 个测试** |

### 1.3 基础设施缺陷

- `@testing-library/react` 已安装但**未使用**（无组件测试）
- `@testing-library/jest-dom` 已安装但**未配置**（setup.ts 未导入）
- Rust 端无 `[dev-dependencies]`，无 `#[cfg(test)]` 模块

---

## 二、测试分层策略

```
┌──────────────────────────────────────────┐
│  Layer 3: 集成测试 (E2E)                  │  ← Phase 6.4 (Playwright)
│  完整用户流程: 登录→菜单→列表→表单→保存    │
├──────────────────────────────────────────┤
│  Layer 2: 组件测试                        │  ← Phase 6.1
│  React 组件渲染 + 用户交互                │
│  SearchBar, FormRenderer, ListRenderer    │
├──────────────────────────────────────────┤
│  Layer 1: 单元测试                        │  ← Phase 6.1
│  纯函数: XML 解析, 表达式求值, API 调用    │
│  Rust 类型序列化, 错误映射, 配置解析       │
├──────────────────────────────────────────┤
│  Layer 0: 基础设施                        │  ← Phase 6.1 前置
│  test setup, mocks, helpers              │
└──────────────────────────────────────────┘
```

---

## 三、任务分解

### 3.1 前置：测试基础设施完善

| # | 任务 | 说明 |
|---|------|------|
| 0.1 | 配置 jest-dom matchers | `tests/setup.ts` 添加 `import '@testing-library/jest-dom'` |
| 0.2 | 创建 `tests/mocks.ts` | 统一的 `mockFetch`, `mockQueryResult`, 通用 fixtures |
| 0.3 | 创建 `tests/fixtures/` | 存放 XML arch 样本文件（list/form/kanban/search/pivot） |
| 0.4 | 添加 `vitest` coverage 配置 | `vitest.config.ts` 添加 `coverage` 选项 |

### 3.2 前端单元测试（Layer 1）

#### 3.2.1 xml-parser 扩展（+18 tests）

**文件**: `src/lib/__tests__/xml-parser.test.ts`

| # | 测试 | 输入 | 期望 |
|---|------|------|------|
| 1 | parseSearchXml — 基本搜索字段 | `<search><field name="name"/><field name="email"/></search>` | `fields = ['name', 'email']` |
| 2 | parseSearchXml — 过滤器 | `<search><filter name="draft" domain="[('state','=','draft')]"/></search>` | `filters[0].name === 'draft'` |
| 3 | parseSearchXml — groupBy 过滤器 | `<search><filter name="group_stage" context="{'group_by': 'stage_id'}"/></search>` | `groupByFilters[0].fieldName === 'stage_id'` |
| 4 | parseSearchXml — 混合 domain | 多条件 domain `[('state','!=','cancel'), ('active','=',True)]` | 正确解析 |
| 5 | parseSearchXml — 空 search | `<search/>` | `{ fields: [], filters: [], groupByFilters: [] }` |
| 6 | parseKanbanXml — 基本看板 | `<kanban><field name="name"/><templates>...</templates></kanban>` | `fields = ['name']`, `template` 存在 |
| 7 | parseKanbanXml — default_group_by | `<kanban default_group_by="stage_id">` | `groupBy === 'stage_id'` |
| 8 | parsePivotXml — 基本透视 | `<pivot><field name="stage_id" type="row"/><field name="amount" type="measure"/></pivot>` | `rowFields`, `measures` 正确 |
| 9 | parsePivotXml — 行+列+度量 | 完整 3 维 | 3 个数组各含正确元素 |
| 10 | parsePivotXml — 默认 count | `<pivot>` 无 measure | 自动添加 `__count` |
| 11 | parsePivotXml — interval | `<field name="create_date" interval="month" type="col"/>` | `colFields[0].interval === 'month'` |
| 12 | parseListXml — decorations | `<list decoration-bf="state=='draft'"><field name="name"/></list>` | `decorations.bf === "state=='draft'"` |
| 13 | parseFormXml — notebook+group | 复杂嵌套 | pages/groups 正确解析 |
| 14 | parseFormXml — field readonly/invisible | `<field name="state" readonly="1" invisible="1"/>` | `readonly === '1'` |
| 15 | parseFormXml — widget 属性 | `<field name="priority" widget="priority"/>` | `widget === 'priority'` |
| 16 | parseFormXml — group col 属性 | `<group col="4">` | `col === 4` |
| 17 | parseFormXml — empty form | `<form/>` | 返回 null 或空结构 |
| 18 | parseListXml — empty list | `<list/>` | `{ fields: [], decorations: {} }` |

#### 3.2.2 expression-evaluator 扩展（+12 tests）

**文件**: `src/lib/__tests__/expression-evaluator.test.ts`

| # | 测试 | 输入 | 期望 |
|---|------|------|------|
| 1 | evalModifier — `in` 操作符 | `"state in ['draft', 'sent']"`, `{state: 'draft'}` | `true` |
| 2 | evalModifier — `not in` 操作符 | `"state not in ['cancel']"`, `{state: 'done'}` | `true` |
| 3 | evalModifier — `==` 操作符 | `"type == 'opportunity'"`, `{type: 'opportunity'}` | `true` |
| 4 | evalModifier — `!=` 操作符 | `"state != 'cancel'"`, `{state: 'draft'}` | `true` |
| 5 | evalModifier — True/False 字面量 | `"active == True"`, `{active: true}` | `true` |
| 6 | evalModifier — 0/1 字面量 | `"state == 'cancel'"`, `{state: 'confirm'}` | `false` |
| 7 | evalModifier — undefined expr | `undefined`, `{}` | `true`（默认可见） |
| 8 | evalModifier — 简单字段名 | `"state"`, `{state: 'draft'}` | `true` |
| 9 | getDecorationClass — decoration_bf | `{decoration_bf: "state=='draft'"}`, `{state: 'draft'}` | 包含 `font-bold` |
| 10 | getDecorationClass — decoration_danger | `{decoration_danger: "state=='cancel'"}`, `{state: 'cancel'}` | 包含 `text-red-500` |
| 11 | getDecorationClass — 多个装饰 | bf + success 同时匹配 | 两个 class 都出现 |
| 12 | getDecorationClass — 无匹配 | 无 decoration 属性 | 返回空字符串 |

#### 3.2.3 API 扩展（+6 tests）

**文件**: `src/lib/__tests__/api.test.ts`

| # | 测试 | 说明 |
|---|------|------|
| 1 | getViews 生成正确参数 | method=get_views, kwargs.options.toolbar=true |
| 2 | readGroup 生成正确参数 | method=read_group, kwargs.lazy=true |
| 3 | callKw 处理 Odoo 错误 | `{error: {code: 200, message: "..."}}` → 抛出 |
| 4 | callKw 处理 HTTP 错误 | `!response.ok` → 抛出 |
| 5 | _callId 递增 | 连续调用 ID 严格递增 |
| 6 | callKw 传递 kwargs | kwargs 正确序列化到 JSON-RPC body |

#### 3.2.4 field-widgets 扩展（+10 tests）

**文件**: `src/views/__tests__/field-widgets.test.ts`

| # | 测试 | 说明 |
|---|------|------|
| 1 | WIDGET_OVERRIDES — priority | widget="priority" → PriorityWidget |
| 2 | WIDGET_OVERRIDES — statusbar | widget="statusbar" → StateBadgeWidget |
| 3 | WIDGET_OVERRIDES — state | widget="state" → StateBadgeWidget |
| 4 | widget 属性覆盖类型 | type="integer", widget="priority" → PriorityWidget |
| 5 | TYPE_WIDGETS 包含 priority | 验证新增 widget 类型 |
| 6 | TYPE_WIDGETS 包含 state | 验证新增 widget 类型 |
| 7 | CharWidget 渲染 | render + 检查 input 元素 |
| 8 | BooleanWidget 渲染 | render + 检查 checkbox |
| 9 | SelectionWidget 渲染 | render + 检查 select options |
| 10 | DatetimeWidget 格式转换 | `2024-01-15 10:30:00` ↔ `2024-01-15T10:30` |

### 3.3 前端组件测试（Layer 2）

#### 3.3.1 SearchBar 组件（+8 tests）

**文件**: `src/components/__tests__/SearchBar.test.tsx`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 渲染搜索输入框 | `screen.getByPlaceholderText` |
| 2 | 输入文本触发 onSearch | `fireEvent.change` → domain 包含 ilike 条件 |
| 3 | 切换预定义过滤器 | 点击 filter → onSearch 带 domain |
| 4 | 组合多个过滤器 | 两个 filter → domain 用 `&` 连接 |
| 5 | 选择 groupBy | 点击 groupBy → onGroupByChange 触发 |
| 6 | 高级搜索 — 添加条件 | 打开面板 → 选字段/操作符/值 → 添加 |
| 7 | 重置按钮 | 清除所有过滤 → onSearch([]) |
| 8 | 预定义过滤器显示为 facet | 激活后显示可删除的标签 |

> **Mock 策略**: `onSearch`, `onGroupByChange` 为 `vi.fn()`，无需 mock API。

#### 3.3.2 Breadcrumbs 组件（+4 tests）

**文件**: `src/components/__tests__/Breadcrumbs.test.tsx`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 列表视图显示 2 层 | App / ViewTitle |
| 2 | 表单视图显示 3 层 | App / ViewTitle / RecordName |
| 3 | 点击 App 名称导航到 /menu | `useNavigate` mock |
| 4 | 点击 ViewTitle 返回列表 | onBackToList 回调 |

#### 3.3.3 OdooViewSwitcher 组件（+3 tests）

**文件**: `src/views/__tests__/OdooViewSwitcher.test.tsx`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 渲染所有视图按钮 | list, pivot, kanban, form |
| 2 | 当前视图高亮 | `aria-pressed` 或 class 检查 |
| 3 | 点击切换触发 onSwitch | `fireEvent.click` → `onSwitch('kanban')` |

#### 3.3.4 OdooFormRenderer 组件（+8 tests）

**文件**: `src/views/__tests__/OdooFormRenderer.test.tsx`

> **关键 Mock**: `callKw` 全部 mock，不发起真实请求。

| # | 测试 | 说明 |
|---|------|------|
| 1 | 只读模式渲染字段 | 传入 record → 字段可见，Edit 按钮可见 |
| 2 | 点击 Edit 进入编辑模式 | Edit → input 可编辑 |
| 3 | 保存触发 write | callKw('write') 被调用 |
| 4 | 新记录触发 create | 无 recordId → callKw('create') |
| 5 | 必填字段验证 | 空必填 → 保存失败，显示错误 |
| 6 | Cancel 返回只读 | Edit → Cancel → 回到只读 |
| 7 | Notebook 标签页切换 | 点击 tab → 显示对应页面内容 |
| 8 | Statusbar 显示状态 | 有 state 字段 → 状态条可见 |

#### 3.3.5 OdooListRenderer 组件（+6 tests）

**文件**: `src/views/__tests__/OdooListRenderer.test.tsx`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 渲染表头和行 | columns + records → table 正确 |
| 2 | 点击行触发 onRowClick | `fireEvent.click(row)` → callback |
| 3 | 排序切换 | 点击表头 → 正序/倒序/取消循环 |
| 4 | 分组模式 | groupBy 非空 → 显示分组标题 |
| 5 | CSV 导出 | 点击导出 → 触发文件下载 |
| 6 | 空数据显示提示 | 0 records → "No records" |

#### 3.3.6 OdooPivotRenderer 组件（+4 tests）

**文件**: `src/views/__tests__/OdooPivotRenderer.test.tsx`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 渲染交叉表 | 有数据 → thead + tbody 正确 |
| 2 | 空数据显示提示 | 无数据 → "No data" |
| 3 | formatMeasure — 整数 | `formatMeasure(42, '__count')` → `"42"` |
| 4 | formatMeasure — 小数 | `formatMeasure(3.14, 'amount')` → `"3.14"` |

### 3.4 主题引擎测试（+6 tests）

**文件**: `src/themes/__tests__/theme-engine.test.ts`

| # | 测试 | 说明 |
|---|------|------|
| 1 | hexToRgb 转换 | `"#ff0000"` → `"255, 0, 0"` |
| 2 | getPreset 返回预设 | `"dark"` → dark preset 对象 |
| 3 | getPreset 未知返回 null | `"nonexistent"` → `null` |
| 4 | getAccent 返回强调色 | `"blue"` → blue accent 对象 |
| 5 | getAccent 未知返回 null | `"nonexistent"` → `null` |
| 6 | applyTheme 设置 CSS 变量 | 调用后 `document.documentElement.style` 包含正确变量 |

### 3.5 Rust 后端测试（+25 tests）

#### 3.5.1 依赖添加

**文件**: `crates/odoo-core/Cargo.toml`

```toml
[dev-dependencies]
temp-env = "0.3"
```

**文件**: `crates/odoo-web-server/Cargo.toml`

```toml
[dev-dependencies]
wiremock = "0.6"
tower = { version = "0.5", features = ["util"] }
tokio = { version = "1", features = ["test-util", "macros"] }
```

#### 3.5.2 odoo-core 单元测试（+12 tests）

**文件**: `crates/odoo-core/src/types.rs` — `#[cfg(test)] mod tests`

| # | 测试 | 说明 |
|---|------|------|
| 1 | JsonRpcRequest 字段正确 | `jsonrpc == "2.0"`, method/params 正确 |
| 2 | JsonRpcRequest ID 递增 | 连续 new() → ID 严格递增 |
| 3 | JsonRpcResponse 反序列化 | 完整响应 → result 正确 |
| 4 | JsonRpcResponse 错误 | `{error: ...}` → error 字段填充 |
| 5 | JsonRpcError 反序列化 | 含 data 和不含 data |
| 6 | SessionInfo 匿名 | `anonymous()` → authenticated=false |
| 7 | SessionInfo 序列化 | 序列化后 camelCase 键名 |
| 8 | SessionInfo 反序列化 | 保留 flatten 未知字段 |
| 9 | LoginRequest 反序列化 | db/login/password 正确 |
| 10 | LoginRequest 缺失字段 | 缺少 db → 反序列化失败 |

**文件**: `crates/odoo-core/src/error.rs` — `#[cfg(test)] mod tests`

| # | 测试 | 说明 |
|---|------|------|
| 11 | OdooError Display 各变体 | 每个变体有正确的错误消息 |
| 12 | From<serde_json::Error> 转换 | serde error → OdooError::Serialize |

#### 3.5.3 odoo-web-server 单元测试（+6 tests）

**文件**: `crates/odoo-web-server/src/error.rs` — `#[cfg(test)] mod tests`

| # | 测试 | 说明 |
|---|------|------|
| 1 | AppError HTTP 状态码 — NotAuthenticated | → 401 |
| 2 | AppError HTTP 状态码 — Http | → 502 |
| 3 | AppError HTTP 状态码 — Api | → 200 |
| 4 | AppError HTTP 状态码 — 其他 | → 500 |
| 5 | AppError JSON body 格式 | `{error: {code, message}}` |
| 6 | IntoResponse 可调用 | 不 panic |

#### 3.5.4 odoo-core 配置测试（+3 tests）

**文件**: `crates/odoo-core/src/config.rs` — `#[cfg(test)] mod tests`

| # | 测试 | 说明 |
|---|------|------|
| 1 | default 值正确 | host/port/odoo_url 等符合预期 |
| 2 | from_env 有效变量 | PORT=4000 → port=4000 |
| 3 | from_env 缺失变量 | 无 ODOO_DB → db=None |

#### 3.5.5 session.rs 纯逻辑提取 + 测试（+4 tests）

> **重构**: 提取 `SessionInfo::from_odoo_value(value: &Value) -> SessionInfo` 纯函数

**文件**: `crates/odoo-web-server/src/session.rs` — `#[cfg(test)] mod tests`

| # | 测试 | 说明 |
|---|------|------|
| 1 | 完整 SessionInfo 解析 | 含 uid/username/lang/db 等 19 字段 |
| 2 | 缺失可选字段 | 无 partner_id → None |
| 3 | anonymous 场景 | uid=false → authenticated=false |
| 4 | flatten 额外字段 | 未知字段保留 |

### 3.6 集成测试（E2E）— Phase 6.4 延后

E2E (Playwright) 作为 Phase 6.4 P2 任务，不在本次技术方案范围内。

---

## 四、测试文件结构

```
apps/oweb/
├── tests/
│   ├── setup.ts                          # 已有，需增强
│   ├── mocks.ts                          # 新建：共享 mock 工具
│   └── fixtures/                         # 新建：XML arch 样本
│       ├── list.xml
│       ├── form.xml
│       ├── kanban.xml
│       ├── search.xml
│       └── pivot.xml
├── src/
│   ├── lib/__tests__/
│   │   ├── api.test.ts                   # 已有 4 → 扩展到 10
│   │   ├── expression-evaluator.test.ts  # 已有 12 → 扩展到 24
│   │   └── xml-parser.test.ts            # 已有 5 → 扩展到 23
│   ├── views/__tests__/
│   │   ├── field-widgets.test.ts         # 已有 10 → 扩展到 20
│   │   ├── OdooViewSwitcher.test.tsx     # 新建 3
│   │   ├── OdooFormRenderer.test.tsx     # 新建 8
│   │   ├── OdooListRenderer.test.tsx     # 新建 6
│   │   └── OdooPivotRenderer.test.tsx    # 新建 4
│   ├── components/__tests__/
│   │   ├── SearchBar.test.tsx            # 新建 8
│   │   └── Breadcrumbs.test.tsx          # 新建 4
│   └── themes/__tests__/
│       └── theme-engine.test.ts          # 新建 6

crates/
├── odoo-core/src/
│   ├── types.rs      # 内联 +12 tests
│   ├── error.rs      # 内联 +2 tests
│   └── config.rs     # 内联 +3 tests
└── odoo-web-server/src/
    ├── error.rs      # 内联 +6 tests
    └── session.rs    # 内联 +4 tests (提取纯函数后)
```

---

## 五、测试数量汇总

| 层 | 文件数 | 新增测试 | 累计 |
|---|:---:|:---:|:---:|
| **现有** | 4 | — | 31 |
| 基础设施 | 0 (setup) | — | — |
| 前端单元 — xml-parser | 1 | +18 | 49 |
| 前端单元 — expression-evaluator | 1 | +12 | 61 |
| 前端单元 — api | 1 | +6 | 67 |
| 前端单元 — field-widgets | 1 | +10 | 77 |
| 前端组件 — SearchBar | 1 | +8 | 85 |
| 前端组件 — Breadcrumbs | 1 | +4 | 89 |
| 前端组件 — ViewSwitcher | 1 | +3 | 92 |
| 前端组件 — FormRenderer | 1 | +8 | 100 |
| 前端组件 — ListRenderer | 1 | +6 | 106 |
| 前端组件 — PivotRenderer | 1 | +4 | 110 |
| 主题引擎 | 1 | +6 | 116 |
| **Rust — odoo-core** | 3 | +17 | 133 |
| **Rust — odoo-web-server** | 2 | +10 | 143 |
| **合计** | **18** | **+112** | **143** |

---

## 六、执行顺序

```
Week 1: 基础设施 + 前端单元测试
  Day 1: 0.1~0.4 基础设施 → xml-parser 扩展 (18 tests)
  Day 2: expression-evaluator 扩展 (12 tests) + api 扩展 (6 tests)
  Day 3: field-widgets 扩展 (10 tests)

Week 2: 前端组件测试 + Rust 测试
  Day 4: SearchBar (8) + Breadcrumbs (4) + ViewSwitcher (3)
  Day 5: FormRenderer (8) + ListRenderer (6) + PivotRenderer (4)
  Day 6: theme-engine (6) + Rust odoo-core (17 tests)
  Day 7: Rust odoo-web-server (10 tests) + 全量回归
```

---

## 七、Mock 策略

### 7.1 前端 API Mock

```typescript
// tests/mocks.ts
export function mockFetch(result: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(ok ? { result } : { error: result }),
    headers: new Headers({ 'set-cookie': 'session_id=test' }),
  })
}

export function mockCallKw(result: unknown) {
  vi.mocked(callKw).mockResolvedValue(result)
}
```

### 7.2 React Query Mock

组件测试中，需要在 `QueryClient` wrapper 下渲染：

```typescript
const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })}>
    {children}
  </QueryClientProvider>
)
```

### 7.3 TanStack Router Mock

`useNavigate` 需要 mock：

```typescript
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => vi.fn() }
})
```

### 7.4 Rust — wiremock

```rust
use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path, header};

#[tokio::test]
async fn test_login_success() {
    let server = MockServer::start().await;
    server.mock(
        Mock::given(method("POST"))
            .and(path("/web/session/authenticate"))
            .respond_with(ResponseTemplate::new(200)
                .set_body_json(json!({ "result": { "uid": 1, ... } }))),
    ).await;
    // ... test code using server.uri() as odoo_url
}
```

---

## 八、验收标准

1. **测试总数 ≥ 120**（前端 90+，Rust 25+）
2. **所有测试通过**: `bun run test` + `cargo test --workspace`
3. **CI 绿色**: `bun run build && bun run lint && bun run test` 无报错
4. **关键模块覆盖**: xml-parser, expression-evaluator, SearchBar, FormRenderer, Rust types/error 均有专门测试
5. **无测试 flakiness**: 连续运行 3 次全部通过

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**计划周期**: 7 天
