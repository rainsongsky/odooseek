# Odoo 菜单系统对齐分析

> 对比 Odoo 19 CE 原生菜单系统与 OdooSeek 当前实现的差距，提出对齐方案。

---

## 一、Odoo 原生菜单架构

### 1.1 数据获取

| 方面 | Odoo 原生 | OdooSeek 当前 |
|:---|:---|:---|
| **API** | `GET /web/webclient/load_menus` | `GET /api/menu` → `ir.ui.menu.search_read` |
| **返回数据** | 完整菜单树（扁平 dict，含 children/appID/actionID） | 仅根菜单列表（name, action, sequence, web_icon） |
| **缓存** | localStorage + `registry_hash` 版本校验 | TanStack Query staleTime 15min |
| **一次加载** | ✅ 一次请求获取所有菜单 | ❌ 根菜单 1 次 + 子菜单按需加载 + action 解析多次 |

### 1.2 菜单数据结构对比

**Odoo 原生 `load_menus` 返回**:
```json
{
  "root": {
    "id": "root",
    "children": [42, 87, 156],      // 顶层 app ID 列表
    "backgroundImage": null
  },
  "42": {
    "id": 42,
    "name": "Contacts",
    "children": [43, 44],            // 子菜单 ID 列表
    "appID": 42,                     // 所属 app 根菜单
    "xmlid": "contacts.menu_contacts",
    "actionID": 123,                 // 已解析的 action ID（app 级别会深入子菜单查找）
    "actionModel": "ir.actions.act_window",
    "actionPath": "contacts",        // URL 路由路径
    "webIcon": "contacts,static/description/icon.png",
    "webIconData": "data:image/png;base64,..."
  },
  // ... 所有可见菜单的扁平字典
}
```

**OdooSeek 当前 `GET /api/menu` 返回**:
```json
[
  { "id": 42, "name": "Contacts", "action": "ir.actions.act_window,123", "sequence": 10, "web_icon": "..." }
]
```

### 1.3 关键差距

| # | 差距 | 影响 |
|:---|:---|:---|
| 1 | **无子菜单树** | 用户无法通过侧边栏导航到具体功能 |
| 2 | **无 appID 归属** | 不知道子菜单属于哪个 app |
| 3 | **无 xmlid** | 无法做 URL 路由 (`/odoo/contacts`) |
| 4 | **action 未解析** | 前端要额外 2 次 RPC 解析 `action → res_model` |
| 5 | **无 web_icon_data** | 图标依赖猜测映射，不显示真实图标 |
| 6 | **无可见性过滤** | 显示所有根菜单，包括用户无权访问的 |
| 7 | **无菜单搜索** | 无法快速搜索/跳转到任意菜单 |
| 8 | **无侧边栏导航** | 只能从 /menu 页面进入，无法在视图中切换功能 |

---

## 二、导航架构对比

### 2.1 Odoo 原生导航

```
┌─────────────────────────────────────────────────────────┐
│ [≡ Apps ▾] [Current App Name ▾]  [Sub-menu1] [Sub-menu2] [More ▾] │ [👤 User] [⚙️]
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    主内容区 (Action/View)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **NavBar**: 顶部固定栏，包含 App 切换器 + 当前 App 子菜单 + 用户菜单
- **SectionsMenu**: 当前 App 的一级子菜单直接显示在 NavBar 中
- **More dropdown**: 溢出的子菜单折叠到 "More" 下拉
- **命令面板**: `Ctrl+K` 搜索所有菜单项
- **移动端**: 汉堡菜单 → 侧边栏

### 2.2 OdooSeek 当前导航

```
┌─────────────────────────────────────────────────────────┐
│ [🏠 Home] [📱 Apps] [📊 Dashboard]          [👤 User] [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    主内容区                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Navbar**: 固定的 3 个链接 (Home/Apps/Dashboard)
- **/menu 页面**: 独立的应用图标网格页面
- **无子菜单导航**: 点击 app 直接跳 `/web?model=xxx`，无法浏览子菜单
- **无面包屑菜单**: Breadcrumbs 只能回到 /menu，不能切换同级菜单

---

## 三、对齐方案

### 3.1 后端：`GET /api/menu` → `GET /api/menus`

**替换当前** `search_read(ir.ui.menu)` **为调用 Odoo 原生** `GET /web/webclient/load_menus`

**修改文件**: `crates/odoo-web-server/src/menu.rs`

```rust
// 新方案: 代理 Odoo 的 load_menus
pub async fn get_menus(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let url = format!("{}/web/webclient/load_menus", state.odoo_url);
    let mut req = state.http_client.get(&url);
    // 转发 Cookie 以识别用户
    if let Some(cookie) = headers.get("cookie") {
        req = req.header("cookie", cookie.to_str().unwrap_or(""));
    }
    let resp = req.send().await?;
    // 直接透传 JSON
    let body = resp.json::<serde_json::Value>().await?;
    Ok(Json(body).into_response())
}
```

**优势**:
- 一次请求获取所有菜单数据（含子菜单树、actionID、图标等）
- 自动遵守 Odoo 的可见性过滤（基于用户 group_ids）
- 包含 `web_icon_data`（真实图标 base64 数据）
- 包含 `actionPath`（可用于 URL 路由）

### 3.2 前端：Menu Service

**新增文件**: `apps/oweb/src/lib/menu-service.ts`

```typescript
interface OdooMenuEntry {
  id: number | 'root'
  name: string
  children: number[]
  appID: number | false
  xmlid: string
  actionID: number | false
  actionModel: string | false
  actionPath: string | false
  webIcon: string | null
  webIconData: string | null
}

interface MenusData {
  root: OdooMenuEntry & { backgroundImage: string | null }
  [menuId: string]: OdooMenuEntry
}

// API
function getApps(): OdooMenuEntry[]
function getMenu(menuId: number): OdooMenuEntry
function getMenuAsTree(menuId: number): MenuTreeNode
function selectMenu(menu: OdooMenuEntry): void
function getCurrentApp(): OdooMenuEntry | null
```

### 3.3 前端：NavBar 改造

**修改文件**: `apps/oweb/src/components/Navbar.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ [🏠] [App Name ▾]  [Sub1] [Sub2] [Sub3 ▾]    [👤] [⚙️] │
├─────────────────────────────────────────────────────────┤
```

**改造要点**:
1. **App 切换器**: 下拉显示所有 app 图标 + 名称（取代 /menu 页面）
2. **当前 App 子菜单**: 展示当前 app 的一级子菜单为 NavBar 按钮
3. **子菜单下拉**: 有子菜单的项展开为下拉
4. **溢出折叠**: 超过可用宽度的子菜单折叠到 "More"
5. **移除 /menu 页面**: App 切换器集成到 NavBar 中

### 3.4 前端：菜单搜索

**新增功能**: 命令面板 (`Ctrl+K`)

- 搜索所有菜单项（含子菜单）
- Fuzzy 匹配菜单名称和路径
- 按回车跳转

---

## 四、执行计划

| # | 任务 | 优先级 | 文件 |
|:---|:---|:---:|:---|
| 1 | 后端 `load_menus` 代理 | P0 | `crates/odoo-web-server/src/menu.rs` |
| 2 | Menu Service | P0 | `apps/oweb/src/lib/menu-service.ts` (新增) |
| 3 | NavBar App 切换器 + 子菜单 | P0 | `apps/oweb/src/components/Navbar.tsx` |
| 4 | 子菜单下拉组件 | P1 | `apps/oweb/src/components/NavBar/` (新增) |
| 5 | 移除 /menu 页面或降级为快捷方式 | P1 | `apps/oweb/src/routes/menu.tsx` |
| 6 | 菜单搜索 (Ctrl+K) | P2 | `apps/oweb/src/components/CommandPalette.tsx` (新增) |

### Phase 8 对齐

```
Phase 8A (P0):
  - menu.rs → 代理 /web/webclient/load_menus
  - menu-service.ts → 数据层
  - Navbar.tsx → App 切换器 + 子菜单

Phase 8B (P1):
  - 子菜单下拉组件
  - /menu 页面改造

Phase 8C (P2):
  - 命令面板菜单搜索
  - 快捷键 1-9 切换子菜单
```

---

**文档版本**: 1.0  
**创建日期**: 2026-05-29
