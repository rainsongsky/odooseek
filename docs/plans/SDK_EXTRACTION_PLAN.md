# OdooSeek 前端 SDK 拆分技术方案

> **版本**: 1.0  
> **日期**: 2026-06-01  
> **目标**: 将 `apps/oweb/src/lib/` 中框架无关的 Odoo API 客户端层拆分为独立 npm 包

---

## 一、为什么拆分？

### 1.1 当前问题

```
apps/oweb/src/lib/   (2,268 行, 12 模块)
├── api.ts               ← fetch 调用 Odoo JSON-RPC
├── odoo-types.ts        ← 391 行纯类型定义
├── xml-parser.ts         ← 809 行 XML 解析器
├── expression-evaluator.ts ← 271 行 QWeb 表达式求值
├── menu-service.ts      ← 菜单数据结构层
├── view-cache.ts        ← localStorage 视图缓存
├── field-formatters.ts  ← 字段格式化函数
├── report.ts            ← 报表生成
│
├── auth.tsx             ← 依赖 React + TanStack Query + Router
├── i18n.tsx             ← 依赖 React + use-intl + auth.tsx
└── lucide-icons.tsx     ← 依赖 React
```

**问题**：Odoo API 客户端能力（JSON-RPC 调用、XML 视图解析、类型系统）与 React UI 层**混在一起**。以下场景无法复用：

| 场景 | 当前是否可行 |
|------|:--:|
| CLI 工具调用 Odoo API | ❌ 无法 import（依赖 React） |
| React Native 移动端连接 Odoo | ❌ 无法 import |
| 自动化脚本读取 Odoo 数据 | ❌ 需 setup React 环境 |
| 其他前端项目消费 Odoo API | ❌ 需复制粘贴代码 |
| 独立版本管理与发布 | ❌ 与 oweb 耦合 |

### 1.2 拆分收益

| 收益 | 说明 |
|------|------|
| **框架无关** | 纯 TypeScript，零框架依赖，仅依赖 `fetch` API |
| **可独立发布** | `npm publish @odooseek/odoo-client` |
| **版本管理** | SDK 版本独立于 oweb UI 版本 |
| **测试隔离** | SDK 可用 Vitest 测试，无需 React 环境 |
| **类型导出** | 391 行 Odoo 类型定义随包导出，消费方自动获取智能提示 |
| **生态贡献** | 公开 npm 包供社区使用，降低 Odoo 前端开发门槛 |

### 1.3 拆分原则

```
可以拆出的标准：
✅ 不 import React / React DOM / React Context
✅ 不 import @tanstack/react-query / @tanstack/react-router
✅ 不 import use-intl
✅ 不 import CSS / CSS Modules

不可以拆出的：
❌ auth.tsx — 依赖 @tanstack/react-query + router + React Context
❌ i18n.tsx — 依赖 React + use-intl + auth.tsx
❌ lucide-icons.tsx — 依赖 React (JSX 组件)
```

---

## 二、模块分类

### 2.1 可提取模块（7 个）

| 模块 | 行数 | 依赖 | 职责 |
|------|:--:|------|------|
| `odoo-types.ts` | 391 | 无 | Odoo 19 CE 视图/字段/看板等全部类型定义 |
| `api.ts` | 243 | `expression-evaluator.ts` (内部) | JSON-RPC 客户端：callKw/searchRead/readGroup/nameSearch/fieldsGet/callButton/loadAction |
| `xml-parser.ts` | 809 | `odoo-types.ts` + `expression-evaluator.ts` | 7 种 Odoo 视图 XML 解析器 (list/form/kanban/search/pivot/graph/calendar) |
| `expression-evaluator.ts` | 271 | 无 | QWeb 表达式求值器 + domain 解析 + 字段修饰符评估 |
| `menu-service.ts` | 121 | 无 | 菜单数据加载、树构建、搜索、扁平化 |
| `field-formatters.ts` | 50 | 无 | 字段值格式化（货币、浮点、时间等） |
| `view-cache.ts` | 76 | 无 | localStorage 视图定义缓存 |
| **合计** | **1,961** | — | |

### 2.2 不可提取模块（3 个）

| 模块 | 行数 | 原因 |
|------|:--:|------|
| `auth.tsx` | 271 | 依赖 React Context + @tanstack/react-query + @tanstack/react-router |
| `i18n.tsx` | 68 | 依赖 React + use-intl + auth.tsx |
| `lucide-icons.tsx` | 28 | 依赖 React (lucide-react JSX 组件) |
| **合计** | **367** | — |

### 2.3 条件可提取（2 个）

| 模块 | 行数 | 问题 | 方案 |
|------|:--:|------|------|
| `report.ts` | 35 | 依赖 `api.ts` 中的 `callKw` | 同包迁移，无额外问题 |
| `list-formatters.tsx` | 80 | 返回 `React.ReactNode`（图片组件） | 拆为两部分：纯格式化模块入包 + JSX 渲染器留 oweb |

### 2.4 滞留模块（2 个）

| 模块 | 行数 | 说明 |
|------|:--:|------|
| `__tests__/` (8 文件) | ~500 | 与 API 相关的测试随包迁移，UI 相关测试留 oweb |
| `locales/` (5 JSON) | ~300 | i18n 语言文件，随 i18n.tsx 留在 oweb |

---

## 三、目标包结构

```
odooseek/
├── apps/oweb/                      # oweb React SPA (保持不变)
│   └── src/
│       ├── lib/                    # 保留: auth.tsx, i18n.tsx, lucide-icons.tsx
│       │   ├── auth.tsx
│       │   ├── i18n.tsx
│       │   ├── lucide-icons.tsx
│       │   └── list-formatters.tsx  # 保留 (含 React JSX)
│       ├── views/                  # 视图组件
│       └── components/             # UI 组件
│
├── packages/
│   └── odoo-client/                # @odooseek/odoo-client (新包)
│       ├── src/
│       │   ├── types.ts            ← odoo-types.ts
│       │   ├── api.ts              ← api.ts
│       │   ├── xml-parser.ts       ← xml-parser.ts
│       │   ├── expression-evaluator.ts
│       │   ├── menu-service.ts
│       │   ├── field-formatters.ts
│       │   ├── view-cache.ts
│       │   ├── list-formatters.ts   ← 新增 (纯函数部分)
│       │   └── index.ts            # barrel export
│       ├── __tests__/              ← api/xml/evaluator/formatters 测试
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
└── packages/oweb/                  # @odooseek/oweb (可选，未来)
    └── (auth, i18n, UI 组件)
```

### 3.1 package.json

```json
{
  "name": "@odooseek/odoo-client",
  "version": "0.1.0",
  "description": "Framework-agnostic Odoo 19 CE JSON-RPC client with view XML parser",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "files": ["src/"],
  "keywords": ["odoo", "json-rpc", "erp", "xml-parser"],
  "license": "MIT",
  "peerDependencies": {},
  "devDependencies": {
    "typescript": "^5.0",
    "vitest": "^4.0"
  }
}
```

### 3.2 依赖关系

```
@odooseek/odoo-client (零外部依赖)
  ├── expression-evaluator.ts  (纯函数)
  ├── odoo-types.ts            (纯类型)
  ├── field-formatters.ts      (纯函数)
  ├── view-cache.ts            (localStorage)
  ├── menu-service.ts          (fetch)
  ├── api.ts                   (fetch → BFF /api/odoo/*)
  └── xml-parser.ts            (DOMParser + 上述模块)

apps/oweb (React SPA)
  ├── import from '@odooseek/odoo-client'   ← 新引用
  ├── auth.tsx                              ← 保留
  ├── i18n.tsx                              ← 保留
  ├── views/                                ← 保留
  └── components/                           ← 保留
```

---

## 四、实施计划

### 4.1 步骤

| 步骤 | 内容 | 工作量 |
|------|------|:--:|
| 1 | 创建 `packages/odoo-client/` 目录结构 | 10min |
| 2 | 移动 7 个模块文件 + 修正内部导入路径 | 30min |
| 3 | 提取 `list-formatters.tsx` 纯函数部分 | 20min |
| 4 | 更新 oweb 中 `import` 路径 → `@odooseek/odoo-client` | 20min |
| 5 | 迁移 `__tests__/` 中与 SDK 相关的测试 | 20min |
| 6 | 删除 lib/ 中已迁移的模块 | 5min |
| 7 | 运行全量测试验证 | 10min |
| 8 | 更新 tsconfig.json paths 配置 | 5min |
| **总计** | | **2 小时** |

### 4.2 导入路径变更

```typescript
// 之前
import { callKw } from '../../lib/api'
import type { OdooFieldMeta } from '../../lib/odoo-types'
import { parseFormXml } from '../../lib/xml-parser'

// 之后
import { callKw, type OdooFieldMeta, parseFormXml } from '@odooseek/odoo-client'
```

### 4.3 保留在 oweb 的模块

```typescript
// 这些继续留在 apps/oweb/src/lib/
import { useAuth } from '../lib/auth'        // React Context
import { I18nProvider } from '../lib/i18n'    // React + use-intl
import { Menu, Settings, ... } from '../lib/lucide-icons'  // React 组件
```

---

## 五、为什么这么做？

### 5.1 架构原则

oweb 项目遵循 **关注点分离** 原则：

```
┌──────────────────────────────────────────┐
│  数据访问层 (Data Access)                │
│  ── @odooseek/odoo-client               │
│  职责: 与 Odoo JSON-RPC 通信            │
│  依赖: 仅 fetch API                     │
│  框架: 无                               │
├──────────────────────────────────────────┤
│  业务逻辑层 (Business Logic)             │
│  ── apps/oweb/src/hooks/                │
│  职责: 状态管理、数据缓存               │
│  依赖: @tanstack/react-query            │
│  框架: React                            │
├──────────────────────────────────────────┤
│  表现层 (Presentation)                   │
│  ── apps/oweb/src/views/ + components/  │
│  职责: UI 渲染、用户交互                │
│  依赖: React + Tailwind + 上述两层      │
│  框架: React                            │
└──────────────────────────────────────────┘
```

### 5.2 类比 Odoo 官方架构

```
Odoo 官方                               OdooSeek
─────────                               ────────
odoo/                                   packages/odoo-client/
  addons/                                  src/
    web/                                     api.ts         ≈ orm_service.js
      static/src/                            xml-parser.ts   ≈ view_compiler.js
        core/                                odoo-types.ts  ≈ Python model fields
          orm_service.js                ──
          (Odoo JS 客户端)                apps/oweb/                       
        views/                              src/
          (视图引擎)                          views/         ≈ form/list/kanban renderers
                                             components/    ≈ UI primitives
```

Odoo 官方将 `orm_service` 封装为独立模块，oweb 同理应将 API 客户端独立。

### 5.3 生态价值

此包可作为公开 npm 包发布，供任何需要与 Odoo 19 CE 通信的 TypeScript 项目使用：

```bash
npm install @odooseek/odoo-client
```

```typescript
import { callKw, searchRead, parseListXml } from '@odooseek/odoo-client'

// 任何项目：CLI、React Native、Next.js、Deno...
const records = await searchRead('res.partner', [], ['name', 'email'])
const listView = parseListXml('<list>...</list>')
```

---

**文档版本**: 1.0  
**创建日期**: 2026-06-01  
**维护团队**: OdooSeek
