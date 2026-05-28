# Odoo 两条界面实现机制培训教程：以“讨论（Discuss）”为例

**创建日期**：2026-01-07  
**适用对象**：前端/全栈工程师、实施顾问、测试同学  
**目标**：理解 Odoo 中“页面/界面”的两条实现机制，并能读懂本项目 Discuss 的端到端链路（菜单 → Action → 渲染）。

---

## 1. 先讲结论：Odoo 有两条“页面实现”机制

在 Odoo 的 WebClient 架构里，“点击菜单进入页面”本质不是跳某个固定 URL，而是执行 **Action**。Action 主要分两类：

### 1.1 机制 A：`ir.actions.act_window`（窗口动作 → 标准视图）

- **定位**：传统业务页面（看板/列表/表单/透视/图表/日历…）
- **定义方式**：后端通过 XML/数据库记录定义 view（`ir.ui.view`），再由 `act_window` 指定 `view_mode/views/domain/context` 等。
- **前端渲染**：前端是“通用渲染器”，根据 viewType（list/kanban/form/graph/pivot/calendar…）渲染对应 UI。

你在 Odoo 中看到的大多数业务模块（销售订单、产品、客户等）基本都属于这一类。

### 1.2 机制 B：`ir.actions.client`（客户端动作 / Client Action → 应用级 UI）

- **定位**：应用型体验（不是“某个模型的一张表”），例如 Discuss、部分设置/向导类应用。
- **定义方式**：后端记录 `ir.actions.client`，核心字段是 **`tag`**（前端用 tag 去 registry 找渲染器）。
- **前端渲染**：前端是“分发器（registry）”，根据 tag 挂载一个“子应用/组件树”，它拥有自己的布局、状态、交互。

**关键认知**：Discuss 官方就是 `client action` 承载的“应用级 UI”，它不是 `act_window` 的 kanban/list/form 页面。

---

## 2. 为什么 Discuss 不能按“看板/列表”那套处理？

### 2.1 标准视图擅长“记录管理”

`act_window` 的视图体系是“记录驱动”的：模型 + domain + view，典型交互是“筛选、分页、打开表单、批量操作”。

### 2.2 Discuss 属于“对话/线程应用”

Discuss 的核心是：

- 频道/私聊的“线程”
- 消息流实时刷新（bus/轮询）
- unread/needaction/starred 等消息状态
- 快速切换线程、定位消息、回复、编辑、撤回等

这类体验更像 IM/协作应用，不是“一个模型的 CRUD 页面”。因此官方选择 `client action` 承载。

---

## 3. 在本项目中，这两条机制如何落地？

本项目为了对齐 Odoo 官方，对 Discuss 采用了 “client action 分发 → 嵌入式 Discuss App” 的路线。

### 3.1 总体链路图（建议培训时画在白板上）

1. 用户点击菜单/首页应用：**不是跳固定 URL**
2. 菜单携带 action（`ir.actions.client` 或 `ir.actions.act_window`）
3. 前端解析 action：`parseMenuAction()`
4. 路由写入状态：`/oweb-interface?menuId=...&actionId=...&...`
5. `oweb-interface` 加载 action 数据
6. 渲染分发：
   - `act_window` → `ViewRenderer`（标准视图渲染）
   - `client` → `ClientActionRenderer`（按 tag 分发到子应用）
7. Discuss 子应用在主内容区渲染（频道列表/消息流/星标/定位…）

---

## 4. Discuss 贯穿案例：从“点击讨论”到“打开并定位消息”

下面以本项目现状为例，逐步讲解“讨论”是如何运行的。

### 4.1 入口：菜单/首页应用如何进入 Discuss

**入口目标**：进入 `/oweb-interface`，并保持 action 语义，不绑定历史自定义路由（如 `/chats`），也不打开 `.../web#action=...`。

关键实现点（请在代码审查/培训时打开对应文件）：

- 顶部应用菜单点击：`apps/oweb/src/features/oweb-interface/components/navigation/app-menu-bar.tsx`
  - 优先识别 `ir.actions.client`，写入 `menuId/actionId`，并清理 `view`，避免残留导致错误占位。
- 首页应用点击：`apps/oweb/src/features/home-menu/hooks/use-home-menu.ts`
  - 同样优先走 `ir.actions.client` → `/oweb-interface`。

### 4.2 路由状态（URL Search）如何承载 Discuss 的“深链接”

本项目选择“沿用 Oweb Interface 的 URL 状态”，在 search 里增加讨论需要的最小字段：

- `channelId`：当前打开的频道/私聊线程
- `messageId`：需要定位到的某条消息（可选）
- `discussMode`：左侧栏目模式（`channels/starred/inbox/history`）

关键规则（对齐官方使用场景，避免 URL 卡死）：

- 只要 URL 携带 `messageId`，就必须强制落在 `discussMode=channels`（否则无法渲染消息流与定位）。
- 支持 **messageId-only**：当 URL 只有 `messageId`（无 `channelId`）时，Discuss 会 best-effort 读取 `mail.message(model,res_id)` 反推频道或业务记录；失败会给中文提示并清理无效 `messageId`。

为避免“不同入口手写 query 参数”导致漂移，本项目已将 Discuss search 的解析/规范化与写回补丁收敛为单一真源：

- `apps/oweb/src/features/oweb-interface/components/client-actions/discuss-search.ts`

对应路由 schema：

- `apps/oweb/src/routes/_authenticated/oweb-interface/route.tsx`

### 4.3 渲染分发：Client Action Renderer（我们的 registry）

**目标**：把 `ir.actions.client` 的渲染逻辑收敛到统一分发层，而不是在 `oweb-interface.tsx` 里写特判。

对应实现：

- `apps/oweb/src/features/oweb-interface/components/client-actions/client-action-renderer.tsx`

核心点：

- **白名单识别 Discuss tag**：避免 `tag.includes('mail')` 之类的宽匹配误判其它 mail client action
- **未知 tag 的占位**：显示中文提示 + `actionId/tag`，用于快速确认真实 tag 并扩展 registry

### 4.4 Discuss 子应用：为什么说它“自定义”，但仍对齐官方模式？

Discuss 子应用位置：

- `apps/oweb/src/features/oweb-interface/components/client-actions/discuss-client-action-app.tsx`

它是“自定义”的原因：

- 它不是 `ViewRenderer` 的标准 list/kanban/form 视图；
- 它复用了本项目 `features/chats` 的组件与 RPC 能力；
- 布局/交互由前端应用自己控制（类似官方 mail/discuss 的 OWL 应用）。

但它仍“对齐官方模式”的原因：

- 官方 Discuss 本质也是 `ir.actions.client` → tag 分发 → 应用级 UI
- 我们只是用 React 实现了“同一种架构模式”（client action app），而不是复刻 Odoo 官方 OWL 组件树。

### 4.5 “星标消息 → 定位到消息”的深链接落地（高级示例）

目标体验：

1. 用户点击“星标消息”列表中的某条消息
2. 打开对应频道
3. 自动滚动定位到该 messageId，并短暂高亮

对应实现：

- Discuss 写入深链接：`discuss-client-action-app.tsx`
  - 点击星标项写入 `{ channelId, messageId }`
- 消息列表定位：`apps/oweb/src/features/chats/components/message-list/message-list.tsx`
  - 新增 `scrollToMessageId?: number`
  - 若目标消息未加载：自动 `loadMore`（最多 N 次）直到找到或无更多
  - 若虚拟列表：用 `virtualizer.scrollToIndex` 定位
  - 若非虚拟列表：用 `querySelector([data-message-id=...])` + `scrollIntoView`
  - 统一“高亮”样式，让用户明确“定位成功”

---

## 5. 培训时建议强调的“工程约束/规范”

### 5.1 统一原则：不要把模块强绑定到固定前端路由

Discuss 是最典型例子：如果绑定 `/chats`，你会失去：

- Action/context 语义（权限、默认线程、模式）
- 从通知/菜单/其它模块的正确跳转能力
- 后续对齐官方的扩展空间（needaction、星标、bus…）

### 5.2 URL 是“状态”，不是“页面类型”

本项目的约定：

- `view=form` 不代表“主内容区进入表单”
  - 表单由 `FormPreview` 弹窗承载（recordId/createMode 驱动）
- Discuss 不参与 `ViewSwitcher` 的视图切换（它不是 act_window 视图）
- Discuss 的深链接字段用 `channelId/messageId` 表达（属于 client action app 的状态）

### 5.3 Client Action 的扩展方式：tag registry

当出现新的 `ir.actions.client` tag（例如 mail 的其它页面）时：

1. 先通过未知 tag 占位获取 tag/actionId
2. 再在 `ClientActionRenderer` 中注册渲染器
3. 最后按模块逐步增强交互（类似 Discuss 的演进）

---

## 6. 练习（建议培训结束后让同学动手）

### 练习 1：验证两条机制

- 找一个 `act_window` 的菜单（例如“产品”）
  - 观察：`/oweb-interface?menuId=...&actionId=...&view=...`
  - 观察主内容区由 `ViewRenderer` 渲染（kanban/list 等）
- 再进入“讨论”
  - 观察同样是 `/oweb-interface?...`，但渲染走 `ClientActionRenderer` → Discuss App

### 练习 2：扩展一个 client action（占位→渲染）

- 找到一个非 Discuss 的 `ir.actions.client`（在占位里能看到 tag）
- 给它在 `ClientActionRenderer` 加一个简单渲染器（先展示“已命中 tag”即可）

### 练习 3：实现一个新的 deep link 状态

例如给 Discuss 增加 `mode=inbox/starred/channels` 并同步到 URL（训练“把 UI 状态纳入 URL 状态”的能力）。

---

## 7. 常见问题（FAQ）

### Q1：为什么不直接打开 `.../web#action=...`？

因为我们的目标是“统一在本项目界面内体验”，并逐步对齐官方机制（action 分发）。  
打开原生 WebClient 会带来体验割裂，也会重新引入“讨论绑定到 web#action”的历史问题。

### Q2：Discuss 既然是 client action，那还需要 `discuss.channel` 的 kanban 吗？

需要，但用途不同：

- client action 是“应用壳层与交互”
- `discuss.channel` 的模型视图可以用于某些管理场景或配置页面

官方也同时存在这两类（mail/discuss 应用 + channel 的模型视图）。

### Q3：我们现在的 Discuss 是否 100% 等同官方？

不等同。我们对齐的是“架构机制（client action app）”与关键体验（线程、星标、定位等），  
但实现细节是 React + 本项目组件体系，并复用 `features/chats` 的 RPC/组件。

### Q4：我能不能理解：我可以用 client action 做任何我想自定义的页面？

可以**大体这么理解**：Odoo 的机制允许你用 `ir.actions.client`（client action）+ `tag` 分发，做“任意自定义页面/子应用”。

但必须同时理解边界与代价：

- **更适合的场景**：应用级 UI / 强交互（例如 Discuss、仪表盘、工作台、导入向导、消息中心）。  
  简单 CRUD（增删改查）优先用 `ir.actions.act_window` + 标准视图（list/kanban/form…），维护成本更低。
- **你需要额外负责的内容**：client action 走自定义渲染，意味着你要自己处理更多一致性问题，例如：
  - 权限与上下文（context/domain）
  - 导航与深链接（URL 状态设计）
  - 缓存一致性与实时更新（轮询/bus/事件联动）
  - 性能（大列表虚拟滚动、增量加载）
  - 与其它模块联动（通知跳转、菜单切换、徽标未读数等）
- **推荐选型原则**：标准视图优先；当标准视图做不到或体验明显不足时，再用 client action 做“应用壳层”。  
  即便用了 client action，内部依然可以复用 Odoo 的模型与接口、并与标准视图能力协同。

### Q5：如何确认 Discuss 的真实 client action tag？不同环境 tag 不一致怎么办？

可以按“两步走”处理：

1. **先让系统跑起来**：本项目的 `ClientActionRenderer` 会优先按白名单匹配；若遇到 `mail.*discuss*` 但不在白名单，会自动将该 tag 写入 localStorage（key：`oweb.discussClientActionTags`），并弹一次提示，帮助你确认真实 tag。
2. **再把真实 tag 固化到代码**：当你确认了生产环境的真实 tag 后，把它加入 `ClientActionRenderer` 的白名单（并尽量收敛为单一值），避免误判其它 mail client action。

> 说明：这一机制的目的，是在多环境（不同 Odoo 版本/定制）下快速对齐讨论入口，同时保持“白名单优先”的可维护性。

---

## 8. 参考实现文件清单（便于培训时逐个打开讲解）

- **入口与导航**
  - `apps/oweb/src/features/oweb-interface/components/navigation/app-menu-bar.tsx`
  - `apps/oweb/src/features/home-menu/hooks/use-home-menu.ts`
- **Action 分发**
  - `apps/oweb/src/features/oweb-interface/components/client-actions/client-action-renderer.tsx`
  - `apps/oweb/src/features/oweb-interface/oweb-interface.tsx`
- **Discuss 子应用**
  - `apps/oweb/src/features/oweb-interface/components/client-actions/discuss-client-action-app.tsx`
- **深链接与路由 schema**
  - `apps/oweb/src/routes/_authenticated/oweb-interface/route.tsx`
- **消息定位（messageId）**
  - `apps/oweb/src/features/chats/components/message-list/message-list.tsx`
