# Oweb Interface 通用界面模块技术方案

**创建日期**：2025-01-27  
**目标模块**：`apps/oweb/src/features/oweb-interface`  
**基础模块**：`apps/oweb/src/features/oweb-app-showcase`  
**参考实现**：Odoo 原生前端界面

---

## 1. 架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Oweb Interface 模块                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  布局层      │  │  业务逻辑层  │  │  数据层      │      │
│  │  Layout      │  │  Hooks       │  │  Stores      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                   │
│         ┌─────────────────┴─────────────────┐               │
│         │      @l8/biz-ui (业务组件)          │               │
│         │      @l8/oweb-core (核心功能)      │               │
│         │      @l8/odoo-rpc (RPC 客户端)     │               │
│         └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 模块结构

```
apps/oweb/src/features/oweb-interface/
├── index.ts                    # 模块导出
├── components/                 # UI 组件层
│   ├── layout/                 # 布局组件
│   │   ├── oweb-layout.tsx     # 主布局组件（三栏布局）
│   │   ├── top-navbar.tsx      # 顶部导航栏
│   │   ├── left-sidebar.tsx    # 左侧边栏
│   │   └── main-content.tsx    # 主内容区
│   ├── navigation/             # 导航组件
│   │   ├── breadcrumb.tsx      # 面包屑导航
│   │   ├── menu-tree.tsx       # 菜单树（复用 @l8/biz-ui）
│   │   └── view-switcher.tsx   # 视图切换器（图标按钮组）
│   ├── actions/                # 操作组件
│   │   ├── create-button.tsx   # 新建按钮
│   │   ├── action-buttons.tsx  # 操作按钮组（打印、收藏等）
│   │   └── bulk-actions.tsx    # 批量操作菜单
│   └── notifications/         # 通知组件
│       ├── message-icon.tsx    # 消息图标（带未读数量）
│       ├── activity-icon.tsx   # 活动图标（带未读数量）
│       └── notification-panel.tsx # 通知面板
├── hooks/                      # 业务逻辑层
│   ├── index.ts                # Hooks 导出
│   ├── use-interface.ts       # 核心组合 Hook（复用 useApp）
│   ├── use-notifications.ts   # 消息/通知 Hook
│   ├── use-actions.ts          # 操作 Hook
│   └── use-breadcrumb.ts      # 面包屑 Hook
├── stores/                     # 状态管理
│   ├── interface-store.ts      # 界面状态（侧边栏折叠、主题等）
│   └── notification-store.ts   # 通知状态（未读消息数、活动数等）
├── utils/                      # 工具函数
│   ├── menu-path.ts            # 菜单路径解析（用于面包屑）
│   └── action-utils.ts         # 操作工具函数
└── types.ts                    # 类型定义
```

---

## 2. 核心组件设计

### 2.1 OwebLayout（主布局组件）

**职责**：提供标准的三栏布局（顶部导航栏 + 左侧边栏 + 主内容区）

**设计**：

```tsx
interface OwebLayoutProps {
  /** 顶部导航栏内容 */
  topNavbar?: React.ReactNode;
  /** 左侧边栏内容 */
  leftSidebar?: React.ReactNode;
  /** 主内容区 */
  children: React.ReactNode;
  /** 侧边栏是否折叠 */
  sidebarCollapsed?: boolean;
  /** 侧边栏折叠回调 */
  onSidebarToggle?: (collapsed: boolean) => void;
}

export function OwebLayout({
  topNavbar,
  leftSidebar,
  children,
  sidebarCollapsed = false,
  onSidebarToggle,
}: OwebLayoutProps) {
  // 实现三栏布局
}
```

**布局结构**：

```
┌─────────────────────────────────────────┐
│         TopNavbar (固定高度)             │
├──────────┬──────────────────────────────┤
│          │                               │
│ Left     │      Main Content             │
│ Sidebar  │      (可滚动)                 │
│ (可折叠) │                               │
│          │                               │
└──────────┴──────────────────────────────┘
```

### 2.2 TopNavbar（顶部导航栏）

**职责**：提供顶部导航栏，包含 Logo、面包屑、搜索、消息、活动、用户菜单

**组件结构**：

```tsx
interface TopNavbarProps {
  /** Logo 和主页链接 */
  logo?: React.ReactNode;
  /** 面包屑导航 */
  breadcrumb?: React.ReactNode;
  /** 搜索框 */
  search?: React.ReactNode;
  /** 消息图标（带未读数量） */
  messageIcon?: React.ReactNode;
  /** 活动图标（带未读数量） */
  activityIcon?: React.ReactNode;
  /** 用户菜单 */
  userMenu?: React.ReactNode;
}

export function TopNavbar({
  logo,
  breadcrumb,
  search,
  messageIcon,
  activityIcon,
  userMenu,
}: TopNavbarProps) {
  // 实现顶部导航栏布局
}
```

**布局**：

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [Breadcrumb] | [Search] | [Message] [Activity] [User] │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 LeftSidebar（左侧边栏）

**职责**：提供左侧边栏，包含菜单树和操作按钮

**组件结构**：

```tsx
interface LeftSidebarProps {
  /** 顶部操作区（新建按钮、模块标题等） */
  topActions?: React.ReactNode;
  /** 菜单树 */
  menuTree?: React.ReactNode;
  /** 是否折叠 */
  collapsed?: boolean;
  /** 折叠切换回调 */
  onToggle?: (collapsed: boolean) => void;
}

export function LeftSidebar({
  topActions,
  menuTree,
  collapsed = false,
  onToggle,
}: LeftSidebarProps) {
  // 实现左侧边栏布局
}
```

**布局**：

```
┌─────────────┐
│ Top Actions │
├─────────────┤
│             │
│ Menu Tree   │
│             │
└─────────────┘
```

### 2.4 MainContent（主内容区）

**职责**：提供主内容区，包含视图渲染和操作栏

**组件结构**：

```tsx
interface MainContentProps {
  /** 顶部操作栏（分页、视图切换、操作按钮等） */
  topBar?: React.ReactNode;
  /** 视图内容 */
  children: React.ReactNode;
}

export function MainContent({ topBar, children }: MainContentProps) {
  // 实现主内容区布局
}
```

**布局**：

```
┌─────────────────────────────────────────┐
│ Top Bar (分页、视图切换、操作按钮)        │
├─────────────────────────────────────────┤
│                                         │
│         View Content                    │
│         (列表/表单/看板等)              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 3. 核心 Hook 设计

### 3.1 useInterface（核心组合 Hook）

**职责**：组合所有业务逻辑，提供统一的接口

**设计**：

```typescript
interface UseInterfaceParams {
  /** 路由搜索参数 */
  search: Record<string, unknown>
  /** 导航函数 */
  navigate: (options: NavigateOptions) => void
}

interface UseInterfaceReturn {
  // 复用 useApp 的所有功能
  ...UseAppReturn

  // 新增功能
  /** 面包屑数据 */
  breadcrumb: BreadcrumbItem[]
  /** 消息未读数量 */
  messageUnreadCount: number
  /** 活动未读数量 */
  activityUnreadCount: number
  /** 侧边栏折叠状态 */
  sidebarCollapsed: boolean
  /** 切换侧边栏折叠 */
  toggleSidebar: () => void
  /** 当前模块信息 */
  currentModule: {
    name: string
    icon?: string
    actionId?: number
  } | null
}

export function useInterface({
  search,
  navigate,
}: UseInterfaceParams): UseInterfaceReturn {
  // 复用 useApp
  const app = useApp({ search, navigate })

  // 新增功能
  const breadcrumb = useBreadcrumb(app.menusQuery.data, search.menuId)
  const { messageUnreadCount, activityUnreadCount } = useNotifications()
  const { sidebarCollapsed, toggleSidebar } = useInterfaceStore()

  return {
    ...app,
    breadcrumb,
    messageUnreadCount,
    activityUnreadCount,
    sidebarCollapsed,
    toggleSidebar,
    currentModule: getCurrentModule(app.selectedWindowActionQuery.data),
  }
}
```

### 3.2 useNotifications（消息/通知 Hook）

**职责**：管理消息和活动通知

**设计**：

```typescript
interface UseNotificationsReturn {
  /** 消息未读数量 */
  messageUnreadCount: number;
  /** 活动未读数量 */
  activityUnreadCount: number;
  /** 加载消息列表 */
  loadMessages: () => Promise<void>;
  /** 加载活动列表 */
  loadActivities: () => Promise<void>;
  /** 标记消息为已读 */
  markMessageAsRead: (messageId: number) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  // 集成 Odoo Bus 获取实时通知
  // 使用 TanStack Query 缓存通知数据
}
```

### 3.3 useBreadcrumb（面包屑 Hook）

**职责**：根据当前菜单生成面包屑路径

**设计**：

```typescript
interface BreadcrumbItem {
  label: string;
  menuId?: number;
  actionId?: number;
  onClick?: () => void;
}

interface UseBreadcrumbReturn {
  /** 面包屑项列表 */
  items: BreadcrumbItem[];
}

export function useBreadcrumb(
  menuTree: OwebMenuItem[] | undefined,
  currentMenuId: number | undefined,
): BreadcrumbItem[] {
  // 从菜单树中查找当前菜单的路径
  // 返回从根到当前菜单的路径数组
}
```

---

## 4. 状态管理设计

### 4.1 InterfaceStore（界面状态）

**职责**：管理界面相关的全局状态

**设计**：

```typescript
interface InterfaceState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 当前主题 */
  theme: "light" | "dark" | "system";
  /** 切换侧边栏折叠 */
  toggleSidebar: () => void;
  /** 设置主题 */
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useInterfaceStore = create<InterfaceState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "oweb-interface-store",
    },
  ),
);
```

### 4.2 NotificationStore（通知状态）

**职责**：管理通知相关的状态

**设计**：

```typescript
interface NotificationState {
  /** 消息未读数量 */
  messageUnreadCount: number;
  /** 活动未读数量 */
  activityUnreadCount: number;
  /** 设置消息未读数量 */
  setMessageUnreadCount: (count: number) => void;
  /** 设置活动未读数量 */
  setActivityUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  messageUnreadCount: 0,
  activityUnreadCount: 0,
  setMessageUnreadCount: (count) => set({ messageUnreadCount: count }),
  setActivityUnreadCount: (count) => set({ activityUnreadCount: count }),
}));
```

---

## 5. 实现方案

### 5.1 Phase 1：核心布局和基础功能

**目标**：实现标准的三栏布局和基础功能

**任务清单**：

1. **创建模块结构**
   - [ ] 创建 `oweb-interface` 目录结构
   - [ ] 创建基础文件（index.ts, types.ts）

2. **实现布局组件**
   - [ ] `OwebLayout` - 主布局组件
   - [ ] `TopNavbar` - 顶部导航栏
   - [ ] `LeftSidebar` - 左侧边栏
   - [ ] `MainContent` - 主内容区

3. **实现核心 Hook**
   - [ ] `useInterface` - 核心组合 Hook（复用 `useApp`）
   - [ ] `useBreadcrumb` - 面包屑 Hook

4. **实现状态管理**
   - [ ] `InterfaceStore` - 界面状态
   - [ ] `NotificationStore` - 通知状态（占位）

5. **集成现有功能**
   - [ ] 集成 `MenuTree` 组件
   - [ ] 集成 `ViewRenderer` 组件
   - [ ] 集成路由系统

6. **创建路由页面**
   - [ ] 创建 `/_authenticated/oweb/` 路由
   - [ ] 使用 `OwebLayout` 作为布局

**预计工作量**：3-5 个工作日

### 5.2 Phase 2：高级功能

**目标**：实现消息、活动、批量操作等高级功能

**任务清单**：

1. **消息/通知系统**
   - [ ] 集成 Odoo Bus 客户端
   - [ ] 实现 `useNotifications` Hook
   - [ ] 实现 `MessageIcon` 组件
   - [ ] 实现 `ActivityIcon` 组件
   - [ ] 实现通知面板

2. **操作功能**
   - [ ] 实现 `CreateButton` 组件（根据模型动态生成）
   - [ ] 实现 `ActionButtons` 组件（打印、收藏等）
   - [ ] 实现 `BulkActions` 组件（批量操作菜单）

3. **视图切换器**
   - [ ] 实现 `ViewSwitcher` 组件（图标按钮组）
   - [ ] 替换下拉菜单为图标按钮组

4. **面包屑导航**
   - [ ] 完善 `useBreadcrumb` Hook
   - [ ] 实现 `Breadcrumb` 组件

**预计工作量**：5-7 个工作日

### 5.3 Phase 3：优化和定制

**目标**：性能优化、主题定制、用户体验优化

**任务清单**：

1. **性能优化**
   - [ ] 代码分割和懒加载
   - [ ] 组件 memo 优化
   - [ ] 查询缓存优化

2. **主题定制**
   - [ ] 支持 Odoo 风格主题
   - [ ] 支持自定义主题变量

3. **用户体验优化**
   - [ ] 加载状态优化
   - [ ] 错误处理优化
   - [ ] 响应式设计优化

**预计工作量**：3-5 个工作日

---

## 6. 技术细节

### 6.1 复用策略

**最大化复用 `oweb-app-showcase`**：

1. **直接复用**：
   - `useApp` Hook - 核心业务逻辑
   - `ViewRenderer` 组件 - 视图渲染
   - `MenuTree` 组件 - 菜单树
   - 错误处理组件

2. **适配复用**：
   - 布局组件 - 从演示布局改为生产布局
   - 视图切换器 - 从下拉菜单改为图标按钮组

3. **扩展复用**：
   - 添加消息/通知功能
   - 添加批量操作功能
   - 添加面包屑导航

### 6.2 与现有系统集成

**路由集成**：

```typescript
// apps/oweb/src/routes/_authenticated/oweb/index.tsx
export const Route = createFileRoute("/_authenticated/oweb/")({
  validateSearch: owebSearchSchema, // 复用 oweb-app 的 schema
  component: OwebInterface,
});
```

**状态集成**：

- 复用 `useAuthStore` - 认证状态
- 复用 `useOdooRpcClient` - RPC 客户端
- 新增 `useInterfaceStore` - 界面状态

**组件集成**：

- 复用 `@l8/biz-ui` 组件
- 复用 `@l8/oweb-core` 功能
- 复用现有布局组件（Header、Sidebar）

### 6.3 Odoo Bus 集成

**消息通知实现**：

```typescript
// hooks/use-notifications.ts
export function useNotifications() {
  const rpcClient = useOdooRpcClient();
  const { setMessageUnreadCount, setActivityUnreadCount } = useNotificationStore();

  // 使用 Odoo Bus 订阅消息通知
  useEffect(() => {
    if (!rpcClient) return;

    const bus = new OdooBusClient(rpcClient);
    bus.subscribe("mail.message", (message) => {
      // 更新未读消息数
      setMessageUnreadCount(message.unread_count);
    });

    bus.subscribe("mail.activity", (activity) => {
      // 更新未读活动数
      setActivityUnreadCount(activity.unread_count);
    });

    return () => bus.disconnect();
  }, [rpcClient]);
}
```

---

## 7. 代码示例

### 7.1 OwebInterface 主组件

```tsx
// components/oweb-interface.tsx
import { OwebLayout } from "./components/layout/oweb-layout";
import { TopNavbar } from "./components/layout/top-navbar";
import { LeftSidebar } from "./components/layout/left-sidebar";
import { MainContent } from "./components/layout/main-content";
import { Breadcrumb } from "./components/navigation/breadcrumb";
import { ViewSwitcher } from "./components/navigation/view-switcher";
import { CreateButton } from "./components/actions/create-button";
import { ActionButtons } from "./components/actions/action-buttons";
import { MessageIcon } from "./components/notifications/message-icon";
import { ActivityIcon } from "./components/notifications/activity-icon";
import { useInterface } from "./hooks/use-interface";
import { MenuTree, ViewRenderer } from "@l8/biz-ui";

export function OwebInterface() {
  const route = getRouteApi("/_authenticated/oweb/");
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const interface_ = useInterface({ search, navigate });

  return (
    <OwebLayout
      topNavbar={
        <TopNavbar
          logo={<HomeButton />}
          breadcrumb={<Breadcrumb items={interface_.breadcrumb} />}
          search={<Search />}
          messageIcon={<MessageIcon count={interface_.messageUnreadCount} />}
          activityIcon={<ActivityIcon count={interface_.activityUnreadCount} />}
          userMenu={<ProfileDropdown />}
        />
      }
      leftSidebar={
        <LeftSidebar
          topActions={
            <>
              <CreateButton model={interface_.currentModule?.model} />
              <ModuleTitle module={interface_.currentModule} />
            </>
          }
          menuTree={
            <MenuTree
              menusQuery={interface_.menusQuery}
              selectedMenuId={search.menuId}
              onMenuClick={handleMenuClick}
            />
          }
          collapsed={interface_.sidebarCollapsed}
          onToggle={interface_.toggleSidebar}
        />
      }
    >
      <MainContent
        topBar={
          <>
            <PaginationInfo />
            <ViewSwitcher
              availableViews={interface_.availableViews}
              currentView={search.view}
              onViewChange={handleViewChange}
            />
            <ActionButtons />
          </>
        }
      >
        <ViewRenderer {...interface_.viewRendererProps} />
      </MainContent>
    </OwebLayout>
  );
}
```

---

## 8. 测试策略

### 8.1 单元测试

- Hook 测试（`useInterface`、`useBreadcrumb` 等）
- 组件测试（布局组件、导航组件等）
- 工具函数测试

### 8.2 集成测试

- 路由集成测试
- 状态管理集成测试
- 组件组合测试

### 8.3 E2E 测试

- 完整用户流程测试
- 界面交互测试
- 性能测试

---

## 9. 文档计划

1. **API 文档**：组件和 Hook 的 API 文档
2. **使用指南**：如何使用 `oweb-interface` 模块
3. **迁移指南**：从 `oweb-app-showcase` 迁移到 `oweb-interface`
4. **定制指南**：如何定制主题和布局

---

## 10. 总结

### 10.1 关键设计决策

1. **复用优先**：最大化复用 `oweb-app-showcase` 的实现
2. **模块化设计**：清晰的模块划分，易于维护和扩展
3. **渐进式实现**：分阶段实施，先核心后高级功能
4. **类型安全**：完整的 TypeScript 类型定义

### 10.2 预期成果

1. ✅ 标准的三栏布局（模仿 Odoo 原生界面）
2. ✅ 完整的 Menu → Action → View → Model 链路
3. ✅ 消息/通知系统
4. ✅ 批量操作功能
5. ✅ 可扩展的架构设计

### 10.3 开发周期

- **Phase 1**：3-5 个工作日
- **Phase 2**：5-7 个工作日
- **Phase 3**：3-5 个工作日

**总计**：11-17 个工作日（约 2-3 周）

---

## 参考文档

- [OWEB_INTERFACE_FEASIBILITY_ANALYSIS.md](./OWEB_INTERFACE_FEASIBILITY_ANALYSIS.md) - 可行性分析
- [OWEB_APP_SHOWCASE_MODULE.md](./OWEB_APP_SHOWCASE_MODULE.md) - 基础模块文档
- [ODOO_NATIVE_UI_COMPARISON.md](./ODOO_NATIVE_UI_COMPARISON.md) - Odoo 原生界面对比
