# QWeb 资产（Assets）培训教程

**版本**: v1.0.0  
**日期**: 2025-01-27  
**目标受众**: 前端开发人员、QWeb 模板开发者

## 目录

1. [什么是资产](#什么是资产)
2. [为什么需要资产](#为什么需要资产)
3. [资产在 Odoo 中的概念](#资产在-odoo-中的概念)
4. [资产与 QWeb 的关系](#资产与-qweb-的关系) ⭐ **核心概念**
5. [资产在 QWeb 模板中的使用](#资产在-qweb-模板中的使用)
6. [资产解析器工作原理](#资产解析器工作原理)
7. [实际使用示例](#实际使用示例)
8. [最佳实践](#最佳实践)
9. [常见问题](#常见问题)
10. [进阶主题](#进阶主题)

---

## 什么是资产

### 定义

**资产（Assets）** 是指前端页面运行所需的静态资源文件，主要包括：

- **CSS 样式表**：用于页面样式定义
- **JavaScript 脚本**：用于页面交互逻辑
- **其他静态资源**：如图片、字体等（通常通过 CSS 引用）

### 在 Web 开发中的角色

在传统的 Web 开发中，我们通常这样引入资源：

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="/static/css/main.css" />
    <link rel="stylesheet" href="/static/css/components.css" />
    <script src="/static/js/utils.js"></script>
    <script src="/static/js/app.js"></script>
  </head>
  <body>
    <!-- 页面内容 -->
  </body>
</html>
```

这种方式存在以下问题：

1. **手动管理**：需要手动维护每个页面的资源列表
2. **容易遗漏**：忘记引入某个依赖会导致功能异常
3. **难以复用**：不同页面需要重复编写相同的资源引用
4. **版本管理困难**：更新资源时需要修改多个地方

### 资产 Bundle 的概念

为了解决上述问题，现代 Web 框架引入了 **Bundle（资源包）** 的概念：

- **Bundle** 是一组相关资源的集合，通过一个名称来引用
- 例如：`web.assets_frontend` 包含了前端页面所需的所有 CSS 和 JS
- 使用 Bundle 时，只需要声明一次，系统会自动注入所有相关资源

---

## 为什么需要资产

### ⚠️ 重要说明：资产的使用场景

**资产（Assets）是通过 QWeb 模板的 `t-call-assets` 指令使用的**。因此：

- ✅ **使用 QWeb 模板的场景**：需要资产（报表、邮件、Dashboard QWeb 组件）
- ❌ **不使用 QWeb 的场景**：不需要资产（视图组件：列表、表单、看板等）

**本项目的情况**：

| 组件类型                           | 是否使用 QWeb | 是否使用资产  | 说明                                          |
| ---------------------------------- | ------------- | ------------- | --------------------------------------------- |
| **视图组件**（列表、表单、看板等） | ❌ 不使用     | ❌ **不需要** | 使用 React 组件直接渲染，资源通过 Vite 打包   |
| **报表组件**                       | ✅ 使用       | ✅ **需要**   | 使用 QWeb 模板，需要 `t-call-assets` 注入资产 |
| **邮件模板**                       | ✅ 使用       | ✅ **需要**   | 使用 QWeb 模板，需要资产                      |
| **Dashboard QWeb 组件**            | ✅ 使用       | ✅ **需要**   | 使用 QWeb 模板，需要资产                      |

**为什么视图组件不需要资产？**

1. **React 组件使用 Vite 打包**：资源在构建时已经打包到 bundle 中
2. **不使用 QWeb 模板**：视图组件直接使用 React，不需要 `t-call-assets`
3. **资源管理方式不同**：React 应用使用现代打包工具（Vite），而不是 Odoo 的资产系统

#### 💡 重要澄清：React 视图系统与资产的关系

**准确的说法**：

- ❌ **不使用 Odoo 的资产系统**：React 视图组件不使用 `t-call-assets` 指令
- ✅ **使用 Vite 的资源管理**：资源通过 Vite 在构建时打包
- ✅ **仍然有资源**：CSS、JavaScript 等资源仍然存在，只是管理方式不同

**资源管理的对比**：

| 方面         | Odoo 资产系统                  | 本项目 React 视图系统     |
| ------------ | ------------------------------ | ------------------------- |
| **资源定义** | `__manifest__.py` 中定义       | `package.json` 中定义依赖 |
| **资源打包** | Odoo 后端打包（Python）        | Vite 打包（构建时）       |
| **资源加载** | 运行时通过 `/web/assets/` 加载 | 构建时打包到 bundle       |
| **资源注入** | `t-call-assets` 指令           | `import` 语句             |
| **使用场景** | QWeb 模板                      | React 组件                |

**实际代码对比**：

**Odoo 原生（使用资产系统）**：

```xml
<!-- QWeb 模板中使用资产 -->
<t t-name="web.ListView">
  <t t-call-assets="'web.assets_backend'"/>
  <div class="o_list_view">...</div>
</t>
```

**本项目 React（不使用资产系统）**：

```typescript
// React 组件直接导入资源
import { Table, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export const OdooListView = () => {
  // 资源已经在构建时打包，无需运行时注入
  return (
    <Table>
      <TableRow>...</TableRow>
    </Table>
  )
}
```

#### ⚠️ 重要说明：`apps/web/src/lib/qweb` 与视图系统的关系

**`apps/web/src/lib/qweb` 对于视图系统来说没有引用**：

1. **视图组件不引用**：
   - `apps/web/src/components/odoo-views/list-view.tsx` ❌ 不引用 `@/lib/qweb`
   - `apps/web/src/components/odoo-views/form-view.tsx` ❌ 不引用 `@/lib/qweb`
   - `apps/web/src/components/odoo-views/kanban-view.tsx` ❌ 不引用 `@/lib/qweb`

2. **视图相关的 Hooks 不引用**：
   - `apps/web/src/hooks/use-odoo-list-view.ts` ❌ 不引用 `@/lib/qweb`
   - `apps/web/src/hooks/use-odoo-form-view.ts` ❌ 不引用 `@/lib/qweb`
   - `apps/web/src/hooks/use-odoo-kanban-view.ts` ❌ 不引用 `@/lib/qweb`

3. **`apps/web/src/lib/qweb` 的实际用途**：
   - ✅ **报表模板渲染**：`apps/web/src/features/dashboard/components/qweb-report.tsx`
   - ✅ **Dashboard QWeb 组件**：`apps/web/src/features/dashboard/components/qweb-pipeline.tsx`
   - ✅ **邮件模板渲染**（如果有）
   - ✅ **展示页面示例**：`apps/web/src/features/odoo-views-showcase/data/view-configs.ts`（仅用于演示）

**总结**：

- `apps/web/src/lib/qweb` 是 **QWeb 模板引擎的封装**，用于需要 QWeb 模板的场景
- **视图系统（列表、表单、看板）不使用 QWeb 模板**，因此不引用 `apps/web/src/lib/qweb`
- **视图系统使用 React 组件直接渲染**，资源通过 Vite 打包，不依赖 Odoo 的资产系统

**Vite 的资源管理**：

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
});
```

**总结**：

- ✅ **React 视图系统不使用 Odoo 的资产系统**
- ✅ **资源通过 Vite 在构建时打包**
- ✅ **使用标准的 `import` 语句导入资源**
- ✅ **不需要 `t-call-assets` 指令**

**为什么报表/邮件需要资产？**

1. **使用 QWeb 模板**：报表和邮件使用 QWeb 模板渲染
2. **需要样式和脚本**：报表需要特定的 CSS/JS 来正确显示
3. **模板复用**：可以复用 Odoo 后端的报表模板和资产

### 1. 声明式资源管理

使用资产系统，你只需要在模板中声明：

```xml
<t t-call-assets="'web.assets_frontend'"/>
```

系统会自动将其转换为：

```html
<link rel="stylesheet" href="/web/assets/debug/web.assets_frontend.css" />
<script src="/web/assets/debug/web.assets_frontend.js"></script>
```

**注意**：这仅适用于使用 QWeb 模板的场景（报表、邮件等），不适用于 React 视图组件。

### 2. 自动去重

如果同一个资产在模板中被多次引用，系统会自动去重，确保每个资源只加载一次：

```xml
<!-- 模板 A -->
<t t-call-assets="'web.assets_frontend'"/>

<!-- 模板 B（被模板 A 调用） -->
<t t-call-assets="'web.assets_frontend'"/>
```

最终只会注入一次 `web.assets_frontend`，避免重复加载。

### 3. 环境适配

资产系统会根据运行环境自动选择正确的资源路径：

- **开发环境**：使用未压缩的调试版本，便于调试
- **生产环境**：使用压缩后的版本，并包含版本号用于缓存控制

### 4. 集中管理

所有资源的路径、版本、压缩策略都在一个地方配置，便于维护和更新。

---

## 资产在 Odoo 中的概念

### 重要概念：资产的前后端关系

在理解 Odoo 资产系统之前，需要明确一个关键概念：

**资产的内容是前端代码，但资产的管理在后端完成**

#### 资产的内容（前端）

- **CSS 文件**：样式定义文件（`.css`, `.scss`）
- **JavaScript 文件**：交互逻辑文件（`.js`, `.ts`）
- **其他静态资源**：图片、字体等（通常通过 CSS 引用）

这些文件存储在模块的 `static/` 目录下，是纯前端代码。

#### 资产的管理（后端）

虽然资产的内容是前端代码，但资产的定义、收集、打包、服务都由 **Odoo 后端**完成：

1. **资产定义**：在模块的 `__manifest__.py`（Python 文件）中定义
2. **资产收集**：后端 Python 代码从各个模块收集资源文件
3. **资产打包**：后端 `AssetsBundle` 类负责编译、合并、压缩
4. **资产服务**：后端通过 `/web/assets/` 路径提供打包后的资源

#### 工作流程

```
前端代码（CSS/JS）
    ↓
存储在模块 static/ 目录
    ↓
后端 __manifest__.py 中声明资产
    ↓
后端收集所有模块的资产
    ↓
后端编译、打包、压缩
    ↓
后端通过 /web/assets/ 提供服务
    ↓
前端通过 t-call-assets 引用
```

#### 为什么后端管理前端资产？

1. **模块化**：不同模块可以贡献资源到同一个 Bundle
2. **依赖管理**：后端可以处理模块间的依赖关系
3. **动态组合**：根据安装的模块动态组合资源
4. **优化处理**：后端负责压缩、合并等优化操作
5. **版本控制**：后端管理资源版本和缓存策略

### Odoo 的资产系统

Odoo 使用一套完整的资产管理系统，将资源组织成多个 Bundle：

| Bundle 名称                | 用途             | 使用场景           |
| -------------------------- | ---------------- | ------------------ |
| `web.assets_frontend`      | 前端页面资源     | 面向客户的网站页面 |
| `web.assets_backend`       | 后端管理界面资源 | Odoo 后台管理界面  |
| `web.assets_backend_lazy`  | 后端懒加载资源   | 非关键路径的资源   |
| `web.assets_frontend_lazy` | 前端懒加载资源   | 非关键路径的资源   |
| `web.report_assets_common` | 报表通用资源     | 所有报表的基础样式 |
| `web.report_assets_pdf`    | PDF 报表资源     | PDF 报表专用资源   |
| `web.report_assets_svg`    | SVG 报表资源     | SVG 报表专用资源   |
| `web.report_assets_html`   | HTML 报表资源    | HTML 报表专用资源  |

### Bundle 的组成

每个 Bundle 通常包含：

1. **基础框架资源**：如 jQuery、Bootstrap 等
2. **业务逻辑资源**：应用特定的 CSS 和 JS
3. **组件资源**：可复用组件的样式和脚本

### 后端如何定义资产

虽然资产的内容是前端代码，但资产的定义在后端 Python 代码中完成。

#### 在 **manifest**.py 中定义

每个 Odoo 模块的 `__manifest__.py` 文件中可以定义 `assets` 字典：

```python
{
    'name': 'My Custom Module',
    'version': '1.0',
    'depends': ['web'],
    'assets': {
        # 向后端管理界面的资产包添加资源
        'web.assets_backend': [
            # 添加单个文件
            'my_module/static/src/css/custom.css',
            'my_module/static/src/js/custom.js',

            # 使用通配符匹配多个文件
            'my_module/static/src/components/**/*',

            # 包含其他 bundle
            ('include', 'my_module._assets_core'),
        ],

        # 向前端网站页面的资产包添加资源
        'web.assets_frontend': [
            'my_module/static/src/css/website.css',
        ],

        # 创建自定义资产包
        'my_module.custom_assets': [
            'my_module/static/src/css/custom.css',
            'my_module/static/src/js/custom.js',
        ],
    },
}
```

#### 资源指令类型

后端支持多种资源操作指令：

- `'path'`：直接添加文件或匹配模式
- `('include', 'bundle_name')`：包含其他 bundle
- `('remove', 'path')`：移除匹配的文件
- `('prepend', 'path')`：在 bundle 开头插入
- `('append', 'path')`：在 bundle 末尾追加
- `('before', 'target', 'path')`：在目标文件前插入
- `('after', 'target', 'path')`：在目标文件后插入

#### 后端处理流程

1. **收集阶段**：后端扫描所有已安装模块的 `__manifest__.py`
2. **解析阶段**：根据模块依赖顺序解析资产定义
3. **编译阶段**：将 SCSS 编译为 CSS，处理 JavaScript
4. **打包阶段**：合并、压缩资源文件
5. **服务阶段**：通过 `/web/assets/` 路径提供打包后的资源

### 资产路径规则

Odoo 使用统一的路径规则来管理资产：

```
/web/assets/{version}/{bundle}.min.{ext}
```

- `{version}`：版本号或 hash，用于缓存控制
- `{bundle}`：Bundle 名称
- `{ext}`：文件扩展名（`css` 或 `js`）

---

## 本项目与 Odoo 原生资产系统的差异

### ⚠️ 重要说明：本项目的资产处理方式

**本项目没有实现 Odoo 原生的自动资产打包机制，而是采用手动封装的方式。**

#### Odoo 原生的资产系统

在完整的 Odoo 项目中：

1. **多个 Addons 定义资产**：

   ```python
   # addon1/__manifest__.py
   {
       'assets': {
           'web.assets_backend': [
               'addon1/static/src/css/style1.css',
               'addon1/static/src/js/script1.js',
           ],
       },
   }

   # addon2/__manifest__.py
   {
       'assets': {
           'web.assets_backend': [
               'addon2/static/src/css/style2.css',
               'addon2/static/src/js/script2.js',
           ],
       },
   }
   ```

2. **后端自动收集**：
   - Odoo 后端扫描所有已安装模块的 `__manifest__.py`
   - 根据模块依赖顺序收集所有资产文件
   - 自动处理依赖关系和加载顺序

3. **后端自动打包**：
   - 后端 `AssetsBundle` 类负责编译、合并、压缩
   - 将多个模块的资产合并为单个 bundle
   - 通过 `/web/assets/{version}/{bundle}.min.{ext}` 提供服务

#### 本项目的实现方式

**本项目只实现了资产解析器，而不是资产打包系统**：

1. **手动封装资产解析器**：

   ```typescript
   // apps/web/src/lib/qweb/assets-resolver.ts
   const KNOWN_ASSETS = new Set([
     "web.assets_frontend",
     "web.assets_backend",
     "web.assets_backend_lazy",
     "web.assets_frontend_lazy",
     "web.report_assets_common",
     "web.report_assets_pdf",
     "web.report_assets_svg",
     "web.report_assets_html",
   ]);

   export function createOdooAssetResolver(
     options: AssetResolverOptions = {},
   ): (assetName: string) => string | undefined {
     // 只是将 bundle 名称转换为 HTML 标签
     // 实际的资产文件仍然由 Odoo 后端提供
     return (assetName: string): string | undefined => {
       if (!KNOWN_ASSETS.has(assetName)) return undefined;

       const base = `${baseUrl}/${version}/${assetName}.min`;
       return [
         `<link rel="stylesheet" href="${base}.css">`,
         `<script src="${base}.js"></script>`,
       ].join("");
     };
   }
   ```

2. **硬编码支持的 Bundle**：
   - 只支持预定义的几个 bundle（`KNOWN_ASSETS`）
   - 不支持动态添加新的 bundle
   - 不支持从多个 addons 自动收集资产

3. **依赖 Odoo 后端提供资产**：
   - 资产解析器只是将 bundle 名称转换为 HTML 标签
   - **实际的资产文件仍然由 Odoo 后端打包和提供**
   - 前端通过 `/web/assets/` 路径从后端获取打包后的资源

#### 对比总结

| 方面            | Odoo 原生系统                           | 本项目                                  |
| --------------- | --------------------------------------- | --------------------------------------- |
| **资产定义**    | 多个 addons 在 `__manifest__.py` 中定义 | ❌ 不支持（依赖 Odoo 后端）             |
| **资产收集**    | 后端自动扫描所有模块                    | ❌ 不支持（依赖 Odoo 后端）             |
| **资产打包**    | 后端 `AssetsBundle` 自动打包            | ❌ 不支持（依赖 Odoo 后端）             |
| **资产解析**    | 后端提供路径解析                        | ✅ **手动封装**（`assets-resolver.ts`） |
| **Bundle 支持** | 动态支持所有 bundle                     | ⚠️ **硬编码**（只支持预定义的 bundle）  |
| **资产服务**    | 后端通过 `/web/assets/` 提供服务        | ✅ **依赖后端**（前端通过该路径获取）   |

#### 为什么采用这种方式？

1. **简化实现**：
   - 本项目主要使用 React 组件，不依赖 Odoo 的资产系统
   - 只有 QWeb 模板需要资产，使用场景有限

2. **依赖后端**：
   - 实际的资产打包仍然由 Odoo 后端完成
   - 前端只需要将 bundle 名称转换为 HTML 标签即可

3. **保持兼容**：
   - 资产解析器兼容 Odoo 的路径规则
   - 可以无缝使用 Odoo 后端提供的资产

#### 实际工作流程

```
Odoo 后端（多个 addons）
    ↓
后端自动收集资产（__manifest__.py）
    ↓
后端自动打包（AssetsBundle）
    ↓
后端通过 /web/assets/ 提供服务
    ↓
前端资产解析器（apps/web/src/lib/qweb/assets-resolver.ts）
    ↓
将 bundle 名称转换为 HTML 标签
    ↓
QWeb 模板通过 t-call-assets 注入
```

**关键点**：

- ✅ 前端实现了**资产解析器**（将名称转换为标签）
- ❌ 前端**没有实现**资产收集和打包机制
- ✅ 实际的资产打包仍然由 **Odoo 后端**完成

---

## 资产与 QWeb 的关系

### 核心关系概述

**QWeb 是模板引擎，资产是前端资源，它们通过 `t-call-assets` 指令连接在一起。**

```
QWeb 模板引擎
    ↓
提供 t-call-assets 指令
    ↓
调用资产解析器（assetsResolver）
    ↓
将资产名称转换为 HTML 标签
    ↓
注入到渲染结果中
```

### QWeb 是什么？

**QWeb** 是 Odoo 使用的 XML 模板引擎，用于：

- 渲染动态 HTML 内容
- 支持条件、循环、变量等逻辑
- 提供模板继承和组合能力
- **支持资产注入**（通过 `t-call-assets` 指令）

### 资产在 QWeb 中的角色

资产在 QWeb 模板系统中扮演以下角色：

1. **声明式资源管理**：在模板中声明需要哪些资源
2. **自动注入**：QWeb 引擎自动将资产转换为 HTML 标签
3. **去重处理**：QWeb 引擎确保每个资产只注入一次
4. **环境适配**：根据运行环境生成正确的资源路径

### QWeb 如何支持资产？

#### 1. 提供 `t-call-assets` 指令

QWeb 引擎内置了 `t-call-assets` 指令，用于在模板中声明资产：

```xml
<t t-call-assets="'web.assets_frontend'"/>
```

#### 2. 资产解析器机制

QWeb 引擎通过**资产解析器（assetsResolver）**来处理资产：

```typescript
type AssetResolver = (assetName: string) => string | undefined;
```

- 接收资产名称（如 `'web.assets_frontend'`）
- 返回 HTML 片段（如 `<link>` 和 `<script>` 标签）
- 如果返回 `undefined`，则不注入任何内容

#### 3. 去重机制

QWeb 引擎维护一个 `assetsSeen` Set，记录已注入的资产：

```typescript
const assetsSeen = new Set<string>();

// 第一次调用
if (!assetsSeen.has("web.assets_frontend")) {
  assetsSeen.add("web.assets_frontend");
  // 注入资产
}

// 第二次调用（相同资产）
if (!assetsSeen.has("web.assets_frontend")) {
  // 不会执行，因为已存在
}
```

### QWeb 引擎配置资产支持

在使用 QWeb 引擎时，需要配置资产解析器：

```typescript
import { QWebEngine } from "@l8/qwebjs";
import { createOdooAssetResolver } from "@/lib/qweb";

// 创建资产解析器
const assetsResolver = createOdooAssetResolver({
  baseUrl: "/web/assets",
  version: "v1.0.0",
  debug: false,
});

// 创建 QWeb 引擎并配置资产解析器
const engine = new QWebEngine({
  assetsResolver, // 资产解析器
  assetsDedupe: true, // 启用去重
});
```

### 工作流程详解

当 QWeb 引擎渲染包含 `t-call-assets` 的模板时：

```
1. QWeb 引擎解析模板
   ↓
2. 遇到 <t t-call-assets="'web.assets_frontend'"/>
   ↓
3. 提取资产名称：'web.assets_frontend'
   ↓
4. 检查是否已注入（去重检查）
   ↓
5. 调用资产解析器：assetsResolver('web.assets_frontend')
   ↓
6. 解析器返回 HTML 片段：
   <link rel="stylesheet" href="/web/assets/v1.0.0/web.assets_frontend.min.css">
   <script src="/web/assets/v1.0.0/web.assets_frontend.min.js"></script>
   ↓
7. 将 HTML 片段注入到渲染结果中
   ↓
8. 继续渲染模板的其他部分
```

### QWeb 与资产的集成层次

```
┌─────────────────────────────────────┐
│      QWeb 模板引擎（核心层）          │
│  - 模板解析                          │
│  - 指令处理（t-esc, t-if, etc.）    │
│  - t-call-assets 指令支持            │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│      资产解析器（适配层）             │
│  - 资产名称 → HTML 片段              │
│  - 路径生成规则                      │
│  - 环境适配（开发/生产）              │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│      Odoo 资产系统（后端层）          │
│  - 资产定义（__manifest__.py）       │
│  - 资产收集和打包                    │
│  - 资产服务（/web/assets/）           │
└─────────────────────────────────────┘
```

### 关键要点

1. **QWeb 是模板引擎**：负责渲染模板，提供指令系统
2. **资产是前端资源**：CSS、JavaScript 等静态文件
3. **`t-call-assets` 是桥梁**：连接 QWeb 模板和资产系统
4. **资产解析器是适配器**：将资产名称转换为实际 HTML 标签
5. **去重是 QWeb 引擎的功能**：确保资产不重复注入

### 为什么 QWeb 需要支持资产？

1. **声明式资源管理**：在模板中声明资源，而不是手动编写 HTML 标签
2. **模块化**：不同模块可以贡献资源，QWeb 自动组合
3. **动态性**：可以根据条件或变量动态选择资产
4. **维护性**：资源路径变更时，只需修改解析器，不需要修改模板

---

## 资产在 QWeb 模板中的使用

### 基本语法

在 QWeb 模板中，使用 `t-call-assets` 指令来注入资产：

```xml
<t t-call-assets="'web.assets_frontend'"/>
```

### 语法说明

- `t-call-assets`：QWeb 指令，用于调用资产
- `'web.assets_frontend'`：资产名称（Bundle 名称），需要用引号包裹

### 完整示例

```xml
<t t-name="my.report.template">
  <t t-call-assets="'web.report_assets_common'"/>
  <t t-call-assets="'web.report_assets_pdf'"/>

  <div class="report-container">
    <h1 t-esc="title"/>
    <p t-esc="content"/>
  </div>
</t>
```

### 使用变量

资产名称也可以使用变量：

```xml
<t t-set="assetName" t-value="'web.assets_' + context"/>
<t t-call-assets="assetName"/>
```

### 条件注入

可以根据条件决定是否注入资产：

```xml
<t t-if="needChart">
  <t t-call-assets="'web.assets_chart'"/>
</t>
```

---

## 资产解析器工作原理

### 解析流程

当 QWeb 引擎遇到 `t-call-assets` 指令时，会执行以下流程：

```
1. 提取资产名称
   ↓
2. 检查是否已注入（去重检查）
   ↓
3. 调用资产解析器（assetsResolver）
   ↓
4. 解析器根据环境生成资源路径
   ↓
5. 生成 <link> 和 <script> 标签
   ↓
6. 注入到模板输出中
```

### 资产解析器实现

资产解析器是一个函数，接收资产名称，返回 HTML 片段：

```typescript
type AssetResolver = (assetName: string) => string | undefined;
```

### 路径生成规则

根据运行环境，解析器会生成不同的路径：

**开发环境**（`debug: true`）：

```
/web/assets/debug/web.assets_frontend.css
/web/assets/debug/web.assets_frontend.js
```

**生产环境**（`debug: false`）：

```
/web/assets/{version}/web.assets_frontend.min.css
/web/assets/{version}/web.assets_frontend.min.js
```

### 去重机制

引擎维护一个 `assetsSeen` Set，记录已注入的资产：

```typescript
const assetsSeen = new Set<string>();

// 第一次调用
assetsSeen.has("web.assets_frontend"); // false
// 注入资源，并添加到 Set
assetsSeen.add("web.assets_frontend");

// 第二次调用（相同资产）
assetsSeen.has("web.assets_frontend"); // true
// 跳过注入，返回空字符串
```

---

## 实际使用示例

### 示例 1：基础报表模板

```xml
<t t-name="sales.report">
  <!-- 注入报表通用资源 -->
  <t t-call-assets="'web.report_assets_common'"/>
  <!-- 注入 PDF 报表专用资源 -->
  <t t-call-assets="'web.report_assets_pdf'"/>

  <div class="report">
    <h1>销售报表</h1>
    <table>
      <tr t-foreach="records" t-as="record">
        <td t-esc="record.name"/>
        <td t-esc="record.amount"/>
      </tr>
    </table>
  </div>
</t>
```

### 示例 2：前端页面模板

```xml
<t t-name="website.page">
  <t t-call-assets="'web.assets_frontend'"/>

  <html>
    <head>
      <title t-esc="page.title"/>
    </head>
    <body>
      <div class="content" t-esc="page.content"/>
    </body>
  </html>
</t>
```

### 示例 3：条件注入

```xml
<t t-name="dashboard.view">
  <t t-call-assets="'web.assets_backend'"/>

  <!-- 仅在需要图表时注入图表资源 -->
  <t t-if="showChart">
    <t t-call-assets="'web.assets_chart'"/>
  </t>

  <div class="dashboard">
    <!-- 内容 -->
  </div>
</t>
```

### 示例 4：在 React 组件中使用

```tsx
import { createQWebReactComponent } from "@/lib/qweb";

const ReportComponent = createQWebReactComponent("sales.report", {
  title: "销售报表",
  records: [
    { name: "产品 A", amount: 1000 },
    { name: "产品 B", amount: 2000 },
  ],
});

// 组件会自动处理资产注入
```

---

## 最佳实践

### 1. 选择合适的 Bundle

根据页面类型选择合适的 Bundle：

- **前端页面**：使用 `web.assets_frontend`
- **后台管理**：使用 `web.assets_backend`
- **报表页面**：使用 `web.report_assets_*` 系列

### 2. 避免重复注入

虽然系统会自动去重，但应该避免在模板中重复声明：

```xml
<!-- ❌ 不推荐：重复声明 -->
<t t-call-assets="'web.assets_frontend'"/>
<t t-call-assets="'web.assets_frontend'"/>

<!-- ✅ 推荐：只声明一次 -->
<t t-call-assets="'web.assets_frontend'"/>
```

### 3. 按需加载

对于非关键资源，使用懒加载 Bundle：

```xml
<!-- 关键资源：立即加载 -->
<t t-call-assets="'web.assets_frontend'"/>

<!-- 非关键资源：懒加载 -->
<t t-call-assets="'web.assets_frontend_lazy'"/>
```

### 4. 模板继承中的资产

在模板继承中，资产会合并处理：

```xml
<!-- 父模板 -->
<t t-name="base.template">
  <t t-call-assets="'web.assets_backend'"/>
  <div class="base">基础内容</div>
</t>

<!-- 子模板 -->
<t t-name="child.template" t-inherit="base.template">
  <!-- 不需要再次声明资产，会自动继承 -->
  <xpath expr="//div[@class='base']" position="inside">
    <span>扩展内容</span>
  </xpath>
</t>
```

### 5. 环境变量配置

使用环境变量来配置资产路径和版本：

```bash
# .env.development
VITE_ODOO_ASSETS_BASE=/web/assets
VITE_ODOO_ASSETS_VERSION=debug

# .env.production
VITE_ODOO_ASSETS_BASE=/web/assets
VITE_ODOO_ASSETS_VERSION=abc1234
```

---

## 常见问题

### Q1: 为什么我的资产没有加载？

**可能原因**：

1. **资产名称拼写错误**

   ```xml
   <!-- ❌ 错误 -->
   <t t-call-assets="'web.asset_frontend'"/>

   <!-- ✅ 正确 -->
   <t t-call-assets="'web.assets_frontend'"/>
   ```

2. **资产名称未在已知列表中**
   - 检查 `KNOWN_ASSETS` 是否包含该资产
   - 或自定义资产解析器

3. **资产解析器未配置**
   - 确保 `createQWebEngine` 时传入了 `assetsResolver`

### Q2: 如何添加自定义资产？

**方法 1：扩展已知资产列表**

```typescript
// assets-resolver.ts
const KNOWN_ASSETS = new Set([
  "web.assets_frontend",
  "my.custom.assets", // 添加自定义资产
]);
```

**方法 2：自定义资产解析器**

```typescript
const customResolver = (assetName: string) => {
  if (assetName === "my.custom.assets") {
    return '<link rel="stylesheet" href="/custom/assets.css">';
  }
  // 回退到默认解析器
  return defaultResolver(assetName);
};
```

### Q3: 资产去重是如何工作的？

资产去重基于资产名称（Bundle 名称）：

- 引擎维护一个 `assetsSeen` Set
- 每次注入前检查是否已存在
- 如果已存在，跳过注入
- 作用域是整个渲染过程（从根模板到所有子模板）

### Q4: 开发环境和生产环境的资产有什么区别？

| 特性       | 开发环境             | 生产环境                 |
| ---------- | -------------------- | ------------------------ |
| 路径       | `/web/assets/debug/` | `/web/assets/{version}/` |
| 文件扩展名 | `.css`, `.js`        | `.min.css`, `.min.js`    |
| 压缩       | 未压缩               | 已压缩                   |
| 版本号     | 无                   | 有（用于缓存控制）       |

### Q5: 如何在 React 组件中使用资产？

使用 `createQWebReactComponent` 创建的组件会自动处理资产注入：

```tsx
import { createQWebReactComponent } from "@/lib/qweb";

const MyComponent = createQWebReactComponent("my.template", {
  // 数据
});

// 组件渲染时会自动注入模板中声明的资产
```

### Q6: 资产是在前端还是后端定义的？

**资产的内容是前端代码，但资产的定义和管理在后端**：

- **前端代码**：CSS、JavaScript 文件存储在模块的 `static/` 目录
- **后端定义**：在模块的 `__manifest__.py`（Python 文件）中声明资产
- **后端处理**：Odoo 后端负责收集、编译、打包这些前端资源
- **后端服务**：通过 `/web/assets/` 路径提供打包后的资源

所以，虽然资产的内容是前端代码，但整个资产系统是由后端管理的。

---

## 进阶主题

### 1. 自定义资产解析器

如果需要完全自定义资产解析逻辑：

```typescript
import { createQWebEngine } from "@/lib/qweb";

const customAssetsResolver = (assetName: string) => {
  // 自定义逻辑
  if (assetName.startsWith("cdn.")) {
    return `<link rel="stylesheet" href="https://cdn.example.com/${assetName}.css">`;
  }

  // 回退到默认解析
  return undefined;
};

const engine = createQWebEngine({
  assetsResolver: customAssetsResolver,
});
```

### 2. 动态资产加载

根据运行时条件动态选择资产：

```xml
<t t-set="assetType" t-value="isMobile ? 'mobile' : 'desktop'"/>
<t t-call-assets="'web.assets_' + assetType"/>
```

### 3. 资产版本管理

在生产环境中，使用版本号来控制缓存：

```typescript
const engine = createQWebEngine({
  assetsResolver: createOdooAssetResolver({
    version: "v1.2.3", // 版本号
  }),
});
```

生成的路径：

```
/web/assets/v1.2.3/web.assets_frontend.min.css
```

### 4. 资产预加载

对于关键资源，可以使用预加载：

```xml
<t t-call-assets="'web.assets_frontend'"/>
<link rel="preload" href="/critical.css" as="style"/>
```

### 5. 资产监控和调试

在开发环境中，可以启用调试模式查看资产注入情况：

```typescript
const engine = createQWebEngine({
  debug: true, // 启用调试
});
```

---

## 总结

### 核心概念

1. **资产（Assets）**：前端页面所需的静态资源（CSS、JS）
2. **Bundle**：资源的集合，通过名称引用
3. **资产解析器**：将资产名称转换为实际 HTML 标签的函数
4. **去重机制**：确保每个资产只加载一次

### 关键要点

- ✅ 使用 `t-call-assets` 指令在模板中声明资产
- ✅ 系统会自动处理路径生成、去重、环境适配
- ✅ 选择合适的 Bundle 类型
- ✅ 避免重复声明资产
- ✅ 使用环境变量配置资产路径和版本

### 下一步

- 阅读 [QWeb 模板语法文档](../spec/ODOO_FRONTEND_FRAMEWORK_SPECIFICATION.md)
- 查看 [QWeb 集成示例](../../apps/web/src/lib/qweb/README.md)
- 实践：在项目中创建自己的报表模板并注入资产

---

**文档状态**: 已完成  
**最后更新**: 2025-01-27  
**维护者**: L8 ERP 开发团队
