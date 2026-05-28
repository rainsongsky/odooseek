# Odoo 前端 Model/View/Action/Menu 机制对齐分析

## 概述

本文档分析 `apps/web` 项目当前实现与 Odoo 原生前端 Model/View/Action/Menu 机制的对齐情况。

**分析时间**：2025-12-18  
**参考文档**：[ODOO_MODEL_VIEW_ACTION_MENU_TRAINING_GUIDE.md](./ODOO_MODEL_VIEW_ACTION_MENU_TRAINING_GUIDE.md)

---

## 对齐情况总览

### 完整链路：Menu → Action → View → Model

根据 Odoo 培训文档中的核心链路：

> 用户点击 **Menu** → 触发 **Action** → Action 指向某个 **Model** 并选择合适的 **View** → 渲染并展示数据记录。

**当前状态**：⚠️ **部分对齐**，缺少关键环节

---

## 详细能力分析

### 1. Model（模型）- ✅ **已对齐**

#### 实现情况

**核心能力**：

- ✅ RPC 客户端 (`OdooRpcClient`) 支持模型操作
  - `searchRead()`：搜索和读取记录
  - `read()`：读取指定记录
  - `executeKw()`：执行模型方法
  - `create()`、`write()`、`unlink()`：数据操作

**元数据访问**：

- ✅ 可通过 `ir.model` 获取模型列表
- ✅ 可通过 `get_views` 或 `fields_get` 获取字段定义
- ✅ 字段元数据自动加载（通过 `OdooViewLoader`）

**代码位置**：

- `apps/web/src/lib/odoo-rpc/`
- `apps/web/src/lib/odoo-views/loader.ts` - 字段加载
- `apps/web/src/features/odoo-rpc-showcase/` - 示例代码

**对齐度**：✅ **100%** - 完全对齐 Odoo 原生能力

---

### 2. View（视图）- ✅ **已对齐**

#### 实现情况

**视图加载**：

- ✅ `OdooViewLoader` 通过 `get_views` 加载视图定义
- ✅ 支持视图继承（Odoo 后端自动合并）
- ✅ 支持 XML ID 和数字 ID 两种方式指定视图

**支持的视图类型**：

- ✅ **form**：表单视图（`useOdooFormView`, `OdooFormView`）
- ✅ **list/tree**：列表视图（`useOdooListView`, `OdooListView`）
- ✅ **kanban**：看板视图（`useOdooKanbanView`, `OdooKanbanView`）
- ✅ **search**：搜索视图（`useOdooSearchView`）
- ✅ **graph**：图表视图（`useOdooGraphView`）
- ✅ **pivot**：透视表视图
- ✅ **calendar**：日历视图
- ✅ **gantt**：甘特图视图

**视图解析**：

- ✅ Form 视图解析（字段、分组、notebook、按钮框）
- ✅ List 视图解析（列定义、多行编辑）
- ✅ Kanban 视图解析（列、卡片模板）
- ✅ Graph 视图解析（指标、维度）
- ✅ Search 视图解析（过滤器、分组、搜索字段）

**代码位置**：

- `apps/web/src/lib/odoo-views/` - 核心视图加载和解析
- `apps/web/src/components/odoo-views/` - React 组件
- `apps/web/src/hooks/` - 视图相关的 Hooks

**对齐度**：✅ **95%** - 主要视图类型已对齐，部分高级视图功能可能需完善

---

### 3. Action（动作）- ✅ **已对齐**（执行层面）

#### 实现情况

**动作加载**：

- ✅ `ActionLoader.loadAction()` - 通过 ID 加载动作
- ✅ `ActionLoader.loadActionByRef()` - 通过 XML ID 加载动作
- ✅ 从 `ir.actions.actions` 模型读取动作定义

**支持的动作类型**：

- ✅ **ir.actions.act_window**：窗口动作（最常用）
  - 支持 `res_model`, `view_mode`, `view_id`, `view_ids`
  - 支持 `domain`, `context`, `target`, `limit`
- ✅ **ir.actions.server**：服务器动作
  - 支持执行后端代码
  - 支持返回动作（递归执行）
- ✅ **ir.actions.act_url**：URL 动作
- ✅ **ir.actions.client**：客户端动作
- ✅ **ir.actions.report**：报表动作

**动作执行**：

- ✅ `ActionExecutor.executeAction()` - 统一执行入口
- ✅ `executeWindowAction()` - 执行窗口动作
- ✅ `executeServerAction()` - 执行服务器动作
- ✅ `executeObjectMethod()` - 执行对象方法（按钮 type="object"）
- ✅ `useOdooAction` Hook - React 集成

**代码位置**：

- `apps/web/src/lib/odoo-actions/` - 动作加载和执行
- `apps/web/src/hooks/use-odoo-action.ts` - React Hook

**对齐度**：✅ **90%** - 动作执行能力完整，但缺少与路由的集成

---

### 4. Menu（菜单）- ⚠️ **部分对齐**

#### 实现情况

**菜单加载**：

- ✅ `loadMenus()` - 从 `ir.ui.menu` 加载菜单
- ✅ `buildMenuTree()` - 构建菜单树结构
- ✅ 支持 `parent_id`, `sequence`, `action` 字段
- ✅ `OdooMenu` React 组件渲染菜单树

**菜单结构**：

- ✅ 支持层级菜单（父子关系）
- ✅ 支持排序（sequence）
- ✅ 支持过滤（canAccess 回调）

**代码位置**：

- `apps/web/src/lib/odoo-menu/` - 菜单加载和构建
- `apps/web/src/components/odoo-menu/menu.tsx` - React 组件

#### ❌ **缺失能力**

1. **菜单 Action 字符串解析**
   - 菜单的 `action` 字段格式：`"ir.actions.act_window,123"`
   - ❌ 缺少解析此格式的工具函数
   - ❌ 缺少将菜单 action 转换为 action ID 的逻辑

2. **菜单点击与 Action 执行的连接**
   - ✅ 有 `onSelect` 回调机制
   - ❌ 但没有默认的 `onSelect` 实现来执行 action
   - ❌ 菜单组件不知道如何解析和执行 action

**对齐度**：⚠️ **60%** - 菜单加载和展示完整，但缺少与 Action 的自动连接

---

## 关键缺失环节

### ❌ 1. Menu → Action 的连接缺失

**问题**：

- 菜单组件只有 `onSelect` 回调，但使用者需要手动实现 action 解析和执行
- 菜单的 `action` 字段是字符串格式（如 `"ir.actions.act_window,123"`），需要解析

**需要的实现**：

```typescript
// 需要新增的工具函数
function parseMenuAction(actionString: string): {
  type: string
  id: number
} | null

// 菜单组件需要默认的 onSelect 实现
function handleMenuSelect(menu: OdooMenuItem) {
  if (!menu.action) return

  const parsed = parseMenuAction(menu.action)
  if (parsed) {
    executeAction({ action: parsed.id, ... })
  }
}
```

### ❌ 2. Action → View 的路由集成缺失

**问题**：

- `executeWindowAction` 返回 `navigationTarget`，但只有 `onNavigate` 回调
- 没有与路由系统（TanStack Router）的集成
- Form 视图中的注释显示：`// TODO: 集成到路由系统，打开新视图`

**需要的实现**：

```typescript
// 需要将 navigationTarget 转换为路由导航
function navigateToView(target: NavigationTarget) {
  // 例如：/odoo/model/res.partner/view/list?domain=...&context=...
  router.navigate({
    to: '/odoo/model/$model',
    params: { model: target.model },
    search: { viewMode: target.viewMode, domain: target.domain, ... }
  })
}
```

### ❌ 3. 统一的路由规范缺失

**问题**：

- 没有定义标准的 Odoo 视图路由格式
- 不同视图类型可能需要不同的路由参数

**建议的路由结构**：

```
/odoo/model/:model/view/:viewType?/:recordId?
  - model: 模型名称（如 res.partner）
  - viewType: 视图类型（list/form/kanban，默认 list）
  - recordId: 记录 ID（form 视图需要）

查询参数：
  - domain: 过滤条件（JSON 字符串）
  - context: 上下文（JSON 字符串）
  - viewId: 指定视图 ID（可选）
```

---

## 对齐度总结表

| 组件         | 对齐度  | 状态     | 说明                                     |
| ------------ | ------- | -------- | ---------------------------------------- |
| **Model**    | ✅ 100% | 完全对齐 | RPC 客户端完整支持所有模型操作           |
| **View**     | ✅ 95%  | 高度对齐 | 主要视图类型完整，部分高级功能待完善     |
| **Action**   | ✅ 90%  | 高度对齐 | 动作执行完整，但缺少路由集成             |
| **Menu**     | ⚠️ 60%  | 部分对齐 | 菜单加载完整，但缺少与 Action 的自动连接 |
| **完整链路** | ⚠️ 70%  | 部分对齐 | 各组件独立完整，但缺少端到端集成         |

---

## 完整的 Menu → Action → View → Model 链路

### Odoo 原生链路

```
用户点击菜单
  ↓
ir.ui.menu.action 字段（字符串："ir.actions.act_window,123"）
  ↓
解析 action 字符串，获取 action ID
  ↓
加载 ir.actions.act_window (id=123)
  ↓
执行窗口动作，获取 navigationTarget：
  - res_model: "res.partner"
  - view_mode: "tree,form"
  - domain: [...]
  - context: {...}
  ↓
根据 res_model 和 view_mode 选择合适的视图
  ↓
加载视图（通过 get_views）和字段定义
  ↓
渲染视图组件，展示数据记录
```

### apps/web 当前链路

```
用户点击菜单
  ↓
OdooMenu.onSelect 回调（需要手动实现）
  ❌ 缺少：action 字符串解析
  ❌ 缺少：自动执行 action
  ↓
手动调用 executeAction({ action: actionId })
  ↓
executeWindowAction 返回 navigationTarget
  ❌ 缺少：路由导航实现
  ↓
手动调用 onNavigate 回调
  ↓
需要手动创建视图页面组件
  ↓
手动调用 useOdooFormView/useOdooListView 加载数据
  ↓
渲染视图组件
```

---

## 建议的改进方案

### 方案 1：补齐缺失环节（推荐）

#### 1.1 实现菜单 Action 解析工具

**文件**：`apps/web/src/lib/odoo-menu/utils.ts`

```typescript
/**
 * 解析菜单 action 字符串
 *
 * @description
 * Odoo 菜单的 action 字段格式为："ir.actions.act_window,123"
 * 需要解析为 { type: string, id: number }
 */
export function parseMenuAction(actionString: string): {
  type: string;
  id: number;
} | null {
  const parts = actionString.split(",");
  if (parts.length !== 2) return null;

  const id = parseInt(parts[1], 10);
  if (isNaN(id)) return null;

  return {
    type: parts[0].trim(),
    id,
  };
}
```

#### 1.2 增强菜单组件，支持自动执行 Action

**文件**：`apps/web/src/components/odoo-menu/menu.tsx`

```typescript
// 添加默认的 onSelect 处理
const defaultOnSelect = useCallback(
  async (menu: OdooMenuItem) => {
    if (!menu.action) return;

    const parsed = parseMenuAction(menu.action);
    if (!parsed) return;

    const result = await executeAction({
      rpcClient,
      action: parsed.id,
      onNavigate: handleNavigate,
    });

    // 处理执行结果
  },
  [rpcClient],
);
```

#### 1.3 创建 Odoo 视图路由页面

**文件**：`apps/web/src/routes/_authenticated/odoo/model/$model/view/$viewType.$recordId.tsx`

```typescript
export const Route = createFileRoute('/_authenticated/odoo/model/$model/view/$viewType/$recordId')({
  component: OdooModelViewPage,
})

function OdooModelViewPage() {
  const { model, viewType, recordId } = Route.useParams()
  const search = Route.useSearch()

  // 根据 viewType 渲染对应的视图组件
  switch (viewType) {
    case 'list':
      return <OdooListView model={model} domain={search.domain} />
    case 'form':
      return <OdooFormView model={model} recordId={recordId} />
    // ...
  }
}
```

#### 1.4 实现导航辅助函数

**文件**：`apps/web/src/lib/odoo-actions/navigation.ts`

```typescript
/**
 * 将 navigationTarget 转换为路由导航
 */
export function navigateToView(router: Router, target: NavigationTarget) {
  const defaultViewType = target.viewMode?.split(",")[0] || "list";

  router.navigate({
    to: "/odoo/model/$model/view/$viewType",
    params: {
      model: target.model,
      viewType: defaultViewType,
    },
    search: {
      domain: target.domain,
      context: target.context,
      viewId: target.context?.default_view_id,
    },
  });
}
```

### 方案 2：创建统一的 Odoo 应用入口（可选）

创建一个类似于 Odoo Web Client 的统一应用入口，自动处理所有 Menu/Action/View 导航：

**文件**：`apps/web/src/routes/_authenticated/odoo/index.tsx`

```typescript
export function OdooApp() {
  return (
    <div className="flex h-screen">
      <aside>
        <OdooMenu
          onSelect={handleMenuSelect}
          // 自动处理 action 执行和导航
        />
      </aside>
      <main>
        <Outlet /> {/* 渲染当前视图 */}
      </main>
    </div>
  )
}
```

---

## 总结

### 当前状态

`apps/web` 在 **Model、View、Action 三个核心组件**的实现上已经高度对齐 Odoo 原生前端，但在 **Menu → Action → View 的完整链路集成**上还存在关键缺失：

1. ✅ **各组件独立能力完整** - Model、View、Action 都可以独立使用
2. ⚠️ **缺少端到端集成** - Menu 点击无法自动触发 Action 执行和 View 导航
3. ❌ **缺少路由规范** - 没有标准的 Odoo 视图路由定义

### ✅ 已实现：`apps/oweb/src/features/oweb-app-showcase`

**更新**：基于本分析文档，已在 `apps/oweb` 项目中实现了完整的 Menu → Action → View → Model 链路：

#### 核心实现

1. **`oweb-app-showcase` 模块** (`apps/oweb/src/features/oweb-app-showcase/`)
   - ✅ **`OwebApp` 组件**：统一的 Odoo 应用入口页面，组合所有功能模块
   - ✅ **`useApp` Hook**：核心组合 Hook，整合所有业务逻辑和状态管理
   - ✅ **`OwebErrorCallout` 组件**：统一的错误处理和展示

2. **Menu → Action 连接** (`apps/oweb/src/features/home-menu/hooks/use-home-menu.ts`)
   - ✅ 实现了菜单 Action 字符串解析（`"ir.actions.act_window,123"`）
   - ✅ 实现了自动导航到应用页面（`/_authenticated/oweb-app/`）

3. **Action → View 路由集成** (`apps/oweb/src/routes/_authenticated/oweb-app/index.tsx`)
   - ✅ 创建了标准的 Odoo 视图路由页面
   - ✅ 支持通过 `actionId` 参数恢复视图状态
   - ✅ 支持多种视图类型（list/kanban/form/pivot/graph/calendar）

4. **完整的视图渲染** (`apps/oweb/src/features/oweb-app-showcase/hooks/use-app.ts`)
   - ✅ 实现了 Action 加载和执行
   - ✅ 实现了视图类型选择和渲染
   - ✅ 实现了完整的数据加载链路（Menu → Action → View → Model）

#### 架构特点

- **组合式设计**：使用 `useApp` Hook 组合所有业务逻辑，组件仅负责 UI 展示
- **类型安全**：完整的 TypeScript 类型定义
- **错误处理**：统一的错误处理和用户友好的错误提示
- **路由集成**：与 TanStack Router 深度集成，支持 URL 状态管理

#### 对齐度更新

| 组件         | 文档分析（apps/web） | 当前实现（apps/oweb） | 状态    |
| ------------ | -------------------- | --------------------- | ------- |
| **Model**    | ✅ 100%              | ✅ 100%               | ✅ 对齐 |
| **View**     | ✅ 95%               | ✅ 95%                | ✅ 对齐 |
| **Action**   | ✅ 90%               | ✅ 100%               | ✅ 对齐 |
| **Menu**     | ⚠️ 60%               | ✅ 100%               | ✅ 对齐 |
| **完整链路** | ⚠️ 70%               | ✅ 100%               | ✅ 对齐 |

### 建议优先级

~~1. **P0（必须）**：实现菜单 Action 解析和自动执行~~ ✅ **已完成**
~~2. **P0（必须）**：创建 Odoo 视图路由页面~~ ✅ **已完成**
~~3. **P1（重要）**：实现 Action → View 的路由导航~~ ✅ **已完成**
~~4. **P2（可选）**：创建统一的 Odoo 应用入口页面~~ ✅ **已完成**

### 预计工作量

~~- 菜单 Action 解析：**1-2 小时**~~ ✅ **已完成**
~~- 视图路由页面：**4-6 小时**~~ ✅ **已完成**
~~- 路由导航集成：**2-3 小时**~~ ✅ **已完成**
~~- 测试和调试：**2-3 小时**~~ ✅ **已完成**

**总计**：~~约 **1-2 个工作日**可以完成完整的 Menu → Action → View → Model 链路对齐。~~ ✅ **已完成**

---

## 参考代码位置

### 核心实现

#### apps/web（原始分析目标）

- **Model**：`apps/web/src/lib/odoo-rpc/`
- **View**：`apps/web/src/lib/odoo-views/`, `apps/web/src/components/odoo-views/`
- **Action**：`apps/web/src/lib/odoo-actions/`, `apps/web/src/hooks/use-odoo-action.ts`
- **Menu**：`apps/web/src/lib/odoo-menu/`, `apps/web/src/components/odoo-menu/menu.tsx`

#### apps/oweb（完整实现）

- **完整链路**：`apps/oweb/src/features/oweb-app-showcase/`
  - `oweb-app.tsx` - 主组件，组合所有功能模块
  - `hooks/use-app.ts` - 核心组合 Hook，整合所有业务逻辑
  - `oweb-error-callout.tsx` - 统一错误处理组件
- **Menu → Action**：`apps/oweb/src/features/home-menu/hooks/use-home-menu.ts`
- **路由集成**：`apps/oweb/src/routes/_authenticated/oweb-app/index.tsx`
- **视图渲染**：通过 `@l8/biz-ui` 和 `@l8/oweb-core` 包实现

### 示例代码

- `apps/web/src/features/odoo-*-showcase/` - 各种组件的展示示例
- `apps/web/src/components/odoo-views/form-view.tsx:101` - Form 视图中的 Action 执行示例（TODO 注释）
- `apps/oweb/src/features/oweb-app-showcase/` - **完整的 Menu → Action → View → Model 链路实现**

### 相关文档

- [ODOO_MODEL_VIEW_ACTION_MENU_TRAINING_GUIDE.md](./ODOO_MODEL_VIEW_ACTION_MENU_TRAINING_GUIDE.md) - Odoo 机制培训文档
- [ODOO_WEB_FUNCTIONAL_ALIGNMENT_ANALYSIS.md](./ODOO_WEB_FUNCTIONAL_ALIGNMENT_ANALYSIS.md) - 功能对齐分析报告
