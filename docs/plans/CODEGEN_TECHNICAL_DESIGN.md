# Odoo 模型 TypeScript 类型代码生成器 — 技术设计

> **版本**: 1.0
> **日期**: 2026-06-01
> **目标**: 从 Odoo 模型元数据自动生成 TypeScript 类型定义，消除 144 处不安全类型断言
> **前置**: Phase 36 (SDK 拆分) ✅ | Phase 23-25 (Calendar 对齐) ✅ | P0 闭环 ✅
>
> **使用指南**（设计目的、原理、CLI、工作流）：[`../ODOO_CODEGEN_AND_TYPES.md`](../ODOO_CODEGEN_AND_TYPES.md)

---

## 一、架构总览

```
┌─────────────────────────────────────────────┐
│            packages/odoo-codegen             │
│  ┌───────────────────────────────────────┐  │
│  │  CLI: bun run generate --odoo-url ... │  │
│  │       ↓                               │  │
│  │  Load manifest → fields_get(model)    │  │
│  │       ↓                               │  │
│  │  Odoo type → TS type mapping          │  │
│  │       ↓                               │  │
│  │  Write .ts files to odoo-types/       │  │
│  └───────────────────────────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │ output
┌──────────────────────▼──────────────────────┐
│            packages/odoo-types               │
│  ┌───────────────────────────────────────┐  │
│  │  generated/models/res.partner.ts      │  │
│  │  generated/models/crm.lead.ts         │  │
│  │  generated/models/calendar.event.ts   │  │
│  │  generated/models/...                 │  │
│  │  generated/index.ts (barrel)          │  │
│  └───────────────────────────────────────┘  │
│  零运行时依赖 · 纯类型定义 · 版本受控        │
└──────────────────────┬──────────────────────┘
                       │ import type
┌──────────────────────▼──────────────────────┐
│  apps/oweb + packages/odoo-client           │
│  → 消除 `as string` / `as number` 断言      │
│  → IDE 字段名自动补全                       │
└─────────────────────────────────────────────┘
```

**设计原则**:
- **零运行时** — 生成产物仅 `.d.ts`，不影响 bundle 体积
- **工具与产物分离** — codegen 依赖 Odoo 运行时，产物不依赖任何东西
- **可复现** — 相同输入 → 相同输出，适合 CI 校验
- **渐进迁移** — 不影响现有 `callKw` API，类型化包装器按需使用

---

## 二、包结构

### 2.1 `packages/odoo-codegen`

```
packages/odoo-codegen/
├── package.json          ← @odooseek/odoo-codegen
├── tsconfig.json
├── src/
│   ├── index.ts          ← CLI 入口
│   ├── codegen.ts        ← 核心引擎
│   ├── type-mapper.ts    ← Odoo 字段类型 → TS 类型映射
│   ├── manifest.ts       ← 模型清单加载
│   └── templates.ts      ← 文件生成模板
├── config/
│   └── models.json       ← 默认生成清单（可覆盖）
└── README.md
```

**`package.json` 关键字段**:
```json
{
  "name": "@odooseek/odoo-codegen",
  "type": "module",
  "bin": { "odoo-codegen": "./src/index.ts" },
  "scripts": {
    "generate": "bun run src/index.ts",
    "check": "bun run generate --check"
  },
  "dependencies": {
    "@odooseek/odoo-client": "workspace:*"
  }
}
```

### 2.2 `packages/odoo-types`

```
packages/odoo-types/
├── package.json          ← @odooseek/odoo-types
├── tsconfig.json
├── src/
│   └── generated/        ← 全量自动生成，人工勿改
│       ├── index.ts      ← barrel export
│       └── models/
│           ├── res.partner.ts
│           ├── res.users.ts
│           ├── crm.lead.ts
│           ├── sale.order.ts
│           ├── calendar.event.ts
│           └── ...       ← 每个 Odoo 模型一个文件
└── .gitkeep              ← generated 目录结构占位
```

**`package.json` 关键字段**:
```json
{
  "name": "@odooseek/odoo-types",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/generated/index.ts",
  "types": "./src/generated/index.ts",
  "exports": {
    ".": { "types": "./src/generated/index.ts" }
  },
  "peerDependencies": {}
}
```

---

## 三、生成产物格式

### 3.1 单模型文件示例 (`calendar.event.ts`)

```typescript
// Auto-generated from calendar.event (Odoo fields_get)
// DO NOT EDIT — run `bun run generate` to regenerate

import type { ModelRecord, ModelFieldName } from '../core'

/** calendar.event — Schedule employees' meetings */
export interface CalendarEventRecord {
  readonly id: number
  readonly display_name: string
  name: string
  description: string | false
  user_id: [number, string] | false
  partner_id: [number, string] | false
  partner_ids: number[]
  location: string | false
  videocall_location: string | false
  notes: string | false
  start: string  // datetime → string in JSON-RPC
  stop: string   // datetime
  start_date: string | false  // date
  stop_date: string | false   // date
  allday: boolean
  duration: number  // float
  privacy: 'public' | 'private' | 'confidential'
  show_as: 'free' | 'busy'
  active: boolean
  categ_ids: number[]
  attendee_ids: number[]
  alarm_ids: number[]
  attendees_count: number  // integer (computed)
  accepted_count: number
  declined_count: number
  recurrency: boolean
  recurrence_id: [number, string] | false
  access_token: string | false

  /** Dynamic fields from custom modules */
  readonly [key: string]: unknown
}

/** Field names for calendar.event */
export type CalendarEventFieldName = ModelFieldName<CalendarEventRecord>

/** Typed search_read result */
export type CalendarEventSearchResult = ModelRecord<CalendarEventRecord>

/** Typed read result */
export type CalendarEventReadResult = [CalendarEventRecord] | []
```

### 3.2 共享辅助类型 (`core.ts`)

```typescript
/** Utility: strip readonly and dynamic index for mutable record types */
export type ModelRecord<T> = T extends { readonly id: infer ID; readonly display_name: infer DN }
  ? { id: ID; display_name: DN } & Omit<
      { [K in keyof T as K extends 'id' | 'display_name' ? never : K]: T[K] },
      keyof { [key: string]: unknown }
    >
  : T

/** Utility: extract literal union of field names */
export type ModelFieldName<T> = keyof {
  [K in keyof T as K extends `readonly ${string}` | keyof { [key: string]: unknown }
    ? never : K]: T[K]
} & string

/** Typed RPC context */
export interface OdooRpcContext {
  active_id?: number
  active_ids?: number[]
  active_model?: string
  default_?: Record<string, unknown>
  lang?: string
  tz?: string
}
```

### 3.3 桶导出 (`index.ts`)

```typescript
export type { CalendarEventRecord, CalendarEventFieldName, CalendarEventSearchResult } from './models/calendar.event'
export type { CrmLeadRecord, CrmLeadFieldName, CrmLeadSearchResult } from './models/crm.lead'
export type { ResPartnerRecord, ResPartnerFieldName, ResPartnerSearchResult } from './models/res.partner'
// ... all models
export type { ModelRecord, ModelFieldName } from './core'
```

---

## 四、CLI 设计

### 4.1 命令

```bash
# 生成所有模型（从 models.json 清单）
bun run generate

# 生成指定模型
bun run generate --models res.partner,crm.lead,sale.order

# 校验模式：检查生成产物是否匹配 Odoo（CI 用）
bun run generate --check

# 指定 Odoo 实例（默认从 .env 读取 ODOO_URL）
bun run generate --odoo-url http://localhost:8069

# 自动发现：扫描 oweb 源码提取所有 callKw 中用到的 model
bun run generate --discover
```

### 4.2 模型清单 (`config/models.json`)

```json
{
  "version": "1.0",
  "models": [
    "res.partner",
    "res.users",
    "crm.lead",
    "sale.order",
    "sale.order.line",
    "stock.picking",
    "account.move",
    "account.move.line",
    "calendar.event",
    "mail.activity",
    "mail.message",
    "mail.followers",
    "ir.filters"
  ]
}
```

`--discover` 模式下，CLI 扫描 `apps/oweb/src/**/*.tsx` 中所有 `callKw("model", ...)` 和 `searchRead("model", ...)` 调用，自动提取模型列表合并到清单。

### 4.3 生成引擎伪代码

```typescript
async function generateAll(options: GenerateOptions) {
  const models = await loadManifest(options)
  
  for (const model of models) {
    // Step 1: call Odoo fields_get
    const fields = await fieldsGet(model, [], { attributes: ['string', 'help', 'selection', 'relation'] })
    
    // Step 2: map each field to TS type
    const properties = Object.entries(fields).map(([name, meta]) => ({
      name,
      type: mapFieldType(meta),
      optional: !meta.required && meta.type !== 'boolean',
      doc: buildDocComment(meta),
    }))
    
    // Step 3: render TypeScript
    const code = renderModelFile(model, properties)
    
    // Step 4: write to odoo-types/generated/models/
    const filename = `${model}.ts`
    await writeFile(`packages/odoo-types/src/generated/models/${filename}`, code)
  }
  
  // Step 5: regenerate barrel export
  await writeBarrelExport(models)
}
```

---

## 五、类型映射表

| Odoo 类型 | TypeScript 类型 | 备注 |
|-----------|----------------|------|
| `char`, `text`, `html` | `string` | 可能为 `false` (nullable) |
| `integer` | `number` | |
| `float`, `monetary` | `number` | |
| `boolean` | `boolean` | 永不 nullable |
| `date` | `string` | JSON-RPC 返回 `"2026-06-01"` |
| `datetime` | `string` | JSON-RPC 返回 `"2026-06-01 10:00:00"` |
| `selection` | `'option1' \| 'option2' \| ...` | 字符串字面量联合，从 `meta.selection` 提取 |
| `many2one` | `[number, string] \| false` | `false` 表示空值 |
| `many2many` | `number[] \| false` | `false` 表示空列表 |
| `one2many` | `number[]` | ID 列表 |
| `binary` | `string` | base64 编码 |

**Nullable 规则**：若 `meta.required === false` 且类型非 `boolean`，则追加 `| false`。例如 `string | false`。Odoo JSON-RPC 用 `false` 表示空值。

---

## 六、与 `odoo-client` 的集成点

### 6.1 类型化 API 包装器（`odoo-client` 新增 `typed-api.ts`）

```typescript
import type { 
  CalendarEventRecord, CalendarEventFieldName, CalendarEventSearchResult,
  ResPartnerRecord, ResPartnerFieldName, ResPartnerSearchResult,
  // ... all models
} from '@odooseek/odoo-types'
import { callKw, searchRead } from './api'

// ── Typed wrappers ──────────────────────────────────

export async function readModel<T extends ModelRecordMap>(
  model: T,
  ids: number[],
  fields: ModelFieldNames<T>[],
): Promise<ModelReadResult<T>> {
  return callKw(model, 'read', [ids, fields]) as Promise<ModelReadResult<T>>
}

export async function searchReadModel<T extends ModelRecordMap>(
  model: T,
  domain: unknown[],
  fields: ModelFieldNames<T>[],
  kwargs?: Record<string, unknown>,
): Promise<ModelSearchResult<T>[]> {
  return searchRead(model, domain, fields, kwargs) as Promise<ModelSearchResult<T>[]>
}

// ── Type maps (generated alongside models) ──────────

interface ModelRecordMap {
  'calendar.event': CalendarEventRecord
  'res.partner': ResPartnerRecord
  'crm.lead': CrmLeadRecord
  // ...
}
```

**关键设计**：包装器仅做类型擦除 + 断言，零运行时开销。`ModelRecordMap` 的接口确保新增模型时有编译期错误直到 codegen 重新生成。

### 6.2 渐进迁移策略

旧代码不需要改动：
```typescript
// 旧：仍然工作
const leads = await searchRead('crm.lead', domain, ['id', 'name'])
const name = leads[0].name as string   // ← unsafe cast
```

新代码使用包装器：
```typescript
// 新：类型安全
import { searchReadModel } from '@odooseek/odoo-client'
const leads = await searchReadModel('crm.lead', domain, ['id', 'name'])
const name = leads[0].name  // ← 自动推导为 string
```

---

## 七、CI 集成

### 7.1 GitHub Actions 步骤

```yaml
# .github/workflows/ci.yml 新增步骤
- name: Check generated types are up-to-date
  run: |
    cd packages/odoo-codegen
    bun run generate --check
  env:
    ODOO_URL: ${{ secrets.ODOO_URL }}
```

`--check` 模式下，codegen 重新生成到临时目录，与 `odoo-types/src/generated/` 对比。若有差异，CI 失败并打印 diff，指示开发者运行 `bun run generate`。

### 7.2 本地开发

```bash
# 首次设置或 Odoo 模块变更后
bun run codegen:generate

# 提交前
bun run codegen:check   # 确保类型与 Odoo 同步
```

---

## 八、迁移计划（4 个 Phase）

| Phase | 内容 | 工作量 | 优先级 |
|:-----:|------|:------:|:------:|
| **Codegen 1** | `odoo-codegen` + `odoo-types` 包搭建，核心引擎，类型映射，CLI，CI | 2-3 天 | P1 |
| **Codegen 2** | 模型清单完善（~15 模型），生成初版类型，`odoo-client` 添加 `readModel` / `searchReadModel` 包装器 | 1-2 天 | P1 |
| **Codegen 3** | 组件层迁移：ActivityPanel, Chatter, ImportDialog, Dashboard → 使用类型化 API | 2-3 天 | P1 |
| **Codegen 4** | Widget 内部类型收窄：`FieldWidgetProps.value` 按 `OdooFieldMeta.type` 推导 | 2-3 天 | P2 |

**Phase 1-2 完成后**即可获得核心收益——`readModel` / `searchReadModel` 提供编译期类型校验，所有后续代码可逐步迁移。

---

## 九、文件清单

### 新增文件

```
packages/odoo-codegen/
├── package.json
├── tsconfig.json
├── README.md
├── config/models.json
└── src/
    ├── index.ts
    ├── codegen.ts
    ├── type-mapper.ts
    ├── manifest.ts
    └── templates.ts

packages/odoo-types/
├── package.json
├── tsconfig.json
└── src/
    └── generated/
        ├── index.ts
        ├── core.ts
        └── models/
            └── (生成产物，数量 = 模型数)

packages/odoo-client/src/
├── typed-api.ts              # 新增：readModel / searchReadModel 包装器
└── index.ts                  # 修改：export typed-api
```

### 修改文件

| 文件 | 变更 |
|------|------|
| `apps/oweb/package.json` | 新增 `"@odooseek/odoo-types": "workspace:*"` 依赖 |
| `.github/workflows/ci.yml` | 新增 codegen check 步骤 |
| `turbo.json` | 新增 codegen pipeline |
| `AGENTS.md` | 新增 codegen 工作流说明 |

---

## 十、验证

```bash
# 1. 启动 Odoo Docker
cd docker && docker compose up -d

# 2. 运行 codegen
cd packages/odoo-codegen && bun run generate

# 3. 检查生成产物
ls packages/odoo-types/src/generated/models/

# 4. CI 检查
bun run generate --check

# 5. 前端构建 + 测试
cd apps/oweb
bun run build     # tsc 会检查生成类型的正确性
bun run test      # 现有测试全部通过
```

---

**文档版本**: 1.0
**日期**: 2026-06-01
