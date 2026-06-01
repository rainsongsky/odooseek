# Odoo 模型 TypeScript 类型：`odoo-codegen` 与 `odoo-types`

> **读者**：前端 / 全栈开发者、维护 `models.json` 与生成产物的贡献者  
> **相关**：[`plans/CODEGEN_TECHNICAL_DESIGN.md`](plans/CODEGEN_TECHNICAL_DESIGN.md)（实现细节与演进计划）、[`../docker/README.md`](../docker/README.md)（Docker + 环境变量速查）

---

## 1. 为什么需要这两个包？

Odoo 业务数据通过 JSON-RPC 读写，运行时字段名与类型由**服务端模型定义**决定。若前端只用 `Record<string, unknown>` 或随意 `as` 断言，会出现：

- 字段名拼写错误在编译期无法发现；
- `many2one`、`selection`、可空字段等语义丢失；
- 重构 Odoo 模块后，前端与后端字段漂移难以察觉。

**`@odooseek/odoo-codegen`** 与 **`@odooseek/odoo-types`** 将 Odoo 的 `fields_get` 元数据转为 **TypeScript 类型**，在开发时提供补全与检查，**不增加运行时开销**（仅 `import type`）。

| 包 | 角色 | 何时需要 |
|:---|:---|:---|
| `odoo-codegen` | **生成工具**（CLI，依赖 Odoo/BFF） | 增删模型、升级 Odoo、字段变更后重新生成 |
| `odoo-types` | **类型产物**（纯类型，提交到 Git） | 所有消费 Odoo 数据的 TS 代码 `import type` |

设计原则（与实现计划一致）：

1. **工具与产物分离** — 生成需要连 Odoo；应用构建、CI 类型检查不依赖 Odoo 在线。
2. **零运行时依赖** — `odoo-types` 无 `dependencies`，打包体积不受影响。
3. **可复现** — 同一 Odoo 库 + 同一 `models.json` → 可对比的生成结果；支持 `--check` 做漂移检测。
4. **渐进采用** — 不替换现有 `callKw`；在关键路径用生成类型收窄即可。

---

## 2. 架构与数据流

```
  config/models.json          Odoo (fields_get)
         │                            ▲
         ▼                            │ JSON-RPC via BFF
  ┌──────────────┐    session     ┌──┴─────────────┐
  │ odoo-codegen │ ──────────────►│ odoo-web-server │
  │  (Bun CLI)   │  /api/odoo/... │  :3000          │
  └──────┬───────┘                └────────┬────────┘
         │ write .ts                      │
         ▼                                ▼
  packages/odoo-types/src/generated   Odoo :8069
         │
         │  import type { XxxRecord }
         ▼
  apps/oweb · packages/odoo-client · 其他 TS 包
```

**原理（单模型一次生成）**：

1. 读取 **`config/models.json`** 中的模型技术名列表（如 `hr.employee`）。
2. 经 BFF 登录，对每个模型调用 **`fields_get`**（与 Odoo 后台字段定义一致）。
3. **`type-mapper`** 将 Odoo 字段类型映射为 TS 类型（见下表）。
4. **`templates`** 写出 `models/<model>.ts`，并更新 **`generated/index.ts`** 桶导出。

---

## 3. `packages/odoo-codegen`（生成工具）

### 3.1 目录结构

```
packages/odoo-codegen/
├── config/models.json    # 默认生成清单（仓库维护）
├── src/
│   ├── index.ts          # CLI 入口（环境变量、参数解析）
│   ├── odoo-direct.ts    # 经 BFF 登录与 call_kw / fields_get
│   ├── codegen.ts        # 遍历清单、写文件、--check 对比
│   ├── manifest.ts       # 加载 models.json 或 --models 覆盖
│   ├── type-mapper.ts    # Odoo type → TS type
│   └── templates.ts      # 单文件与 index 模板
└── package.json          # scripts: generate, check
```

### 3.2 连接方式

Codegen **不直连** `8069` 的 JSON-RPC，而是走与 Oweb 相同的 **BFF**（`odoo-web-server`），以便复用会话 Cookie 与统一代理路径：

| 步骤 | HTTP |
|:---|:---|
| 登录 | `POST {ODOO_URL}/api/session/login` |
| 拉字段 | `POST {ODOO_URL}/api/odoo/web/dataset/call_kw/{model}/fields_get` |

本地 Docker 开发时，环境变量示例见 [`docker/README.md`](../docker/README.md#typescript-类型生成odoo-codegen)。

### 3.3 CLI 用法

在仓库根目录或 `packages/odoo-codegen` 下执行：

```bash
cd packages/odoo-codegen

# 推荐：使用环境变量（可写入 shell profile）
export ODOO_URL=http://localhost:3000
export ODOO_DB=odoo19
export ODOO_LOGIN=admin@admin.com
export ODOO_PASSWORD=admin

# 全量生成（写入 ../odoo-types/src/generated）
bun run generate

# 仅检查是否与当前 Odoo 一致（不写文件，有差异则 exit 1）
bun run check
# 等价于: bun run generate --check
```

**命令行参数**（与环境变量二选一或组合）：

| 参数 | 说明 |
|:---|:---|
| `--odoo-url URL` | BFF 根地址，默认 `ODOO_URL` 或 `http://localhost:3000` |
| `--db NAME` | 数据库名，默认 `ODOO_DB` 或 `odoo` |
| `--login USER` | Odoo 登录名，默认 `ODOO_LOGIN` 或 `admin` |
| `--password PASS` | 密码，默认 `ODOO_PASSWORD` 或 `admin` |
| `--models a,b,c` | **仅**生成列出的模型（见下方警告） |
| `--output DIR` | 输出目录，默认 `packages/odoo-types/src/generated` |
| `--check` | 对比磁盘文件，不写入 |

> **警告**：使用 `--models` 且未再跑全量 `generate` 时，**不会**更新 `index.ts` 中其它模型的导出，可能导致 `odoo-types` 桶文件只剩子集。日常应使用 **无参数全量生成**；`--models` 仅适合临时调试单个模型。

### 3.4 维护 `config/models.json`

新增要对齐的 Odoo 模型时：

1. 在 `models` 数组中加入技术名（如 `hr.employee`）；
2. 确认 Odoo 已安装对应模块且模型存在；
3. 执行全量 `bun run generate`；
4. 将 `packages/odoo-types/src/generated/` 的变更一并提交 PR。

当前清单涵盖 CRM、销售、库存、会计、日历、邮件、HR 等；完整列表以仓库内 `models.json` 为准。

### 3.5 字段类型映射规则

| Odoo `type` | 生成 TS 类型 | 可空（非 required） |
|:---|:---|:---|
| `char`, `text`, `html` | `string` | `\| false` |
| `integer`, `float`, `monetary` | `number` | `\| false` |
| `boolean` | `boolean` | 无 `\| false` |
| `date`, `datetime` | `string` | `\| false` |
| `binary` | `string` | `\| false` |
| `many2one` | `[number, string] /* relation */` | `\| false` |
| `one2many`, `many2many` | `number[] /* relation */` | 关系字段按 Odoo 约定 |
| `selection` | `'key1' \| 'key2' \| ...` | `\| false` |
| 未知类型 | `unknown` | 视规则 |

说明：

- JSON-RPC 中「空」常用 **`false`** 表示，故可选标量多为 `T | false`。
- `id`、`display_name` 由 `BaseRecord` 提供，不在各模型接口中重复列出。
- 保留字字段名（如 `class`）会加前缀 `_`。

---

## 4. `packages/odoo-types`（类型产物）

### 4.1 目录结构

```
packages/odoo-types/
├── package.json
└── src/generated/
    ├── core.ts              # 手工维护的共享工具类型（非生成）
    ├── index.ts             # 自动生成：桶导出
    └── models/
        ├── res.partner.ts
        ├── hr.employee.ts
        └── ...              # 每个 Odoo 模型一个文件
```

### 4.2 每个模型导出什么？

以 `hr.department` 为例，单文件通常包含：

| 符号 | 含义 |
|:---|:---|
| `HrDepartmentRecord` | `fields_get` 字段接口，继承 `BaseRecord` |
| `HrDepartmentFieldName` | 字段名字面量联合（用于 `fields` 数组类型安全） |
| `HrDepartmentSearchResult` | `ModelRecord<HrDepartmentRecord>`，便于 `search_read` 结果 |

文件头注释标明来源模型；**请勿手改** `models/*.ts` 与 `index.ts`，应通过 codegen 再生。

### 4.3 `core.ts`（手工维护）

| 类型 | 用途 |
|:---|:---|
| `BaseRecord` | 所有记录的 `id`、`display_name` 与动态扩展索引 |
| `ModelRecord<T>` | 去掉只读/索引后的可变记录形状（写操作、表单状态） |
| `ModelFieldName<T>` | 从记录类型提取字段名 |
| `RpcContext` | RPC `context` 的常见字段 |

### 4.4 在应用中使用

**仅类型导入**（推荐，可被编译擦除）：

```typescript
import type { HrEmployeeRecord, MailActivityRecord } from '@odooseek/odoo-types'

// search_read 结果收窄
const rows = (await callKw('hr.employee', 'search_read', ...)) as HrEmployeeRecord[]

// 或单条 read
const emp = record as HrEmployeeRecord
const deptId = emp.department_id // [number, string] | false
```

仓库内示例：`apps/oweb/src/components/ActivityPanel.tsx` 使用 `MailActivityRecord`、`MailActivityTypeRecord`。

**注意**：

- 类型**不保证**运行时一定有值；计算字段、权限、`groups` 仍可能导致字段缺失。
- Odoo 自定义模块新增字段后，需重新 `generate` 并提交，否则 TS 与真机不一致。
- `callKw` 签名尚未全面泛型化；类型主要用于读结果、表单 state、测试与重构。

### 4.5 包消费方式

`package.json` 将入口指向 `src/generated/index.ts`。工作区包名：

```json
"@odooseek/odoo-types": "workspace:*"
```

在 `apps/oweb` 等包的 `dependencies` 中声明后，TypeScript 通过 project references / bundler 解析类型即可。

---

## 5. 工作流建议

### 5.1 日常开发（无 Odoo 变更）

- 正常 `bun run build` / `tsc`，**无需**启动 Docker。
- 使用 Git 中已提交的 `generated/` 类型。

### 5.2 对齐新 Odoo 字段或新模型

1. 启动 Docker + BFF（见 `docker/README.md`）。
2. 更新 `models.json`（若新增模型）。
3. `bun run generate`（全量）。
4. `cd apps/oweb && bun run build` 确认无类型破坏。
5. 提交 `odoo-types` 变更，PR 说明中注明 Odoo 版本/库名。

### 5.3 CI

- **默认**：依赖仓库内已提交的生成文件，CI **不**连 Odoo。
- **可选**（有 Odoo 服务的环境）：`bun run check`，防止合并后与目标库字段漂移。

### 5.4 常见问题

| 现象 | 处理 |
|:---|:---|
| 登录 401，`database "odoo" does not exist` | `ODOO_DB` 改为实际库名（如 `odoo19`） |
| `Access Denied` | 使用 Odoo 登录名（常为 `admin@admin.com`），非 `admin` |
| `index.ts` 只剩部分 export | 勿只跑 `--models`；再执行全量 `generate` |
| 某模型 `errors` 中报不存在 | 在 Odoo 安装对应模块，或从 `models.json` 移除 |
| 生成 diff 很大但逻辑未变 | 字段顺序、`selection` 枚举、帮助文案变化；可接受则提交 |

---

## 6. 与其它包的关系

```
@odooseek/odoo-client   — RPC、视图 XML 解析（运行时）
@odooseek/odoo-codegen — 依赖 odoo-client 的字段元数据类型，仅 CLI 使用
@odooseek/odoo-types   — 纯类型，被 oweb / 未来泛型 callKw 消费
odoo-web-server (Rust) — BFF，codegen 与浏览器共用会话与代理
```

- **视图 XML**（`parseFormXml` 等）描述 UI 布局；**`odoo-types`** 描述**模型字段**。二者互补，不互相替代。
- HR、Calendar 等业务对齐计划中「codegen 某模型」均指：在 `models.json` 登记 → `generate` → 在 TS 中使用 `XxxRecord`。

---

## 7. 延伸阅读

- [Codegen 技术设计（计划稿）](plans/CODEGEN_TECHNICAL_DESIGN.md) — Phase 37+ 目标、测试策略、未来 `typedCallKw` 设想  
- [HR 对齐计划](plans/HR_ALIGNMENT_PLAN.md) — HR 相关 10 个模型与前端落地项  
- [Docker 开发与 codegen 环境变量](../docker/README.md)

---

**文档版本**：1.0 · **日期**：2026-06-01
