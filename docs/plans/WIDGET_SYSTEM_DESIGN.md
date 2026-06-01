# Widget 系统技术设计

> **版本**: 2.0  
> **日期**: 2026-06-01  
> **状态**: Phase 24–26 通用 Widget ✅ 已实现；HR 专用 Widget ✅ 已实现（基础版）  
> **对照**: Odoo 19 企业版字段组件（约 87 个 / 13000+ 行 JS）  
> **相关**: [HR 对齐计划](HR_ALIGNMENT_PLAN.md)、[`@odooseek/odoo-client` 字段格式化](../../packages/odoo-client/src/field-formatters.ts)

---

## 一、目标与范围

Oweb 表单 / 看板 / O2M 子表通过 **Widget 注册表** 将 Odoo arch 中的 `<field widget="...">` 映射为 React 组件，在保持与 Odoo Web 行为接近的前提下：

- 支持只读与编辑两种模式；
- 关系字段（M2O/M2M/O2M）可搜索、创建、内嵌列表编辑；
- 模块专属 widget（如 HR 组织图、版本时间线）可插件式注册。

**不在本系统内实现**（见第七节）：`domain`、`properties`、`signature`、`ace`、Google/iframe 等重型或低频组件。

---

## 二、现状概览（as-built）

### 2.1 代码位置

实现位于 **`apps/oweb/src/views/widgets/`**（非历史草案中的 `field-widgets.tsx`）。

```
apps/oweb/src/views/widgets/
├── index.ts              # FieldWidgetProps、注册表、getFieldWidget、NOOP、FIELD_INPUT_CLASS
├── basic.tsx             # char/text/数值/日期/html 等
├── selection.tsx         # selection、priority、statusbar、radio、badge 类
├── relational/           # 关系字段（已拆分，原单文件 ~934 行）
│   ├── shared.tsx        # M2M/O2M 归一化、O2mCellDisplay/Edit
│   ├── many2one.tsx      # Many2One、Many2OneAvatar
│   ├── many2many.tsx     # Many2Many、checkboxes、tags_avatar、attachment_image
│   ├── one2many.tsx      # One2Many 内嵌列表 + ORM commands
│   └── index.ts
├── media.tsx             # binary、image / contact_image
├── utility.tsx           # email/phone/url、tags、ribbon、rotting 等
├── OrgChart.tsx          # HR 组织图
├── PresenceIcon.tsx      # HR 考勤状态点（含 Kanban overlay）
├── BadgeWidget.tsx       # HR 工牌打印
├── VersionTimeline.tsx   # HR 版本时间线
└── __tests__/            # getFieldWidget、OrgChart 算法、Presence 等
```

**消费方**：

| 模块 | 用法 |
|------|------|
| `OdooFormRenderer.tsx` | `getFieldWidget(el, meta.type)` 渲染表单字段 |
| `OdooKanbanRenderer.tsx` | 卡片字段 + `PresenceIconOverlay` |
| `relational/one2many.tsx` | O2M 单元格内复用 `getFieldWidget` + `NOOP` |

### 2.2 注册表规模（约 2026-06）

| 表 | 数量 | 说明 |
|:---|:---:|:---|
| `TYPE_WIDGETS` | 18 | 按 Odoo 字段 `type` 回退（char、many2one、one2many…） |
| `WIDGET_OVERRIDES` | 38+ | 按 arch `widget="..."` 优先匹配 |
| `WIDGET_ALIASES` | 7 | Odoo 模块命名与内部 key 不一致时的别名（HR 等） |

### 2.3 与 Odoo 19 企业版差距（摘要）

| 分类 | 企业版约 | Oweb 现状 |
|------|:---:|:---|
| 基础字段 | 14 | ✅ 覆盖主类型 |
| 关系字段 | 12 | ✅ M2O/M2M/O2M + avatar/tags/checkboxes |
| 选择/状态 | 8 | ✅ statusbar、radio、badge 系列 |
| 布尔变体 | 4 | ✅ toggle、favorite、icon |
| 图片/媒体 | 5 | ✅ 部分（无 pdf_viewer） |
| 工具/格式 | 7 | ✅ float_time、percentage、remaining_days 等 |
| 高级 | 4 | ❌ domain、properties、signature、field_selector |
| HR 专属 | 若干 | ⚠️ 组织图/工牌/版本/考勤为简化实现 |

---

## 三、核心架构

### 3.1 `FieldWidgetProps`

```typescript
// apps/oweb/src/views/widgets/index.ts
export interface FieldWidgetProps {
  field: FieldElement          // XML arch 字段节点（含 widget、options、subViews）
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean
  meta?: {
    selection?: [string, string][]
    type?: string
    relation?: string
    domain?: unknown
  }
  record?: Record<string, unknown>  // 整行记录（domain、工牌、组织图等）
  model?: string
  recordId?: number
}
```

表单层另通过 `passesXmlGroups`（`lib/field-access.ts`）按 arch `groups` 隐藏字段；Widget 内不重复做权限矩阵。

### 3.2 解析顺序：`getFieldWidget`

```mermaid
flowchart TD
  A[field.widget + fields_get type] --> B{resolveWidgetOverride}
  B -->|WIDGET_OVERRIDES 或 WIDGET_ALIASES| C[专用组件]
  B -->|未命中| D{TYPE_WIDGETS[field.widget]?}
  D -->|是| E[按 widget 名作 type 回退]
  D -->|否| F{TYPE_WIDGETS[type]?}
  F -->|是| G[按字段类型]
  F -->|否| H[CharWidget]
```

```typescript
// 实际逻辑（index.ts）
export function getFieldWidget(field: FieldElement, type: string) {
  const override = resolveWidgetOverride(field.widget) // OVERRIDES + ALIASES
  if (override) return override
  if (field.widget && TYPE_WIDGETS[field.widget]) return TYPE_WIDGETS[field.widget]
  return TYPE_WIDGETS[type] ?? CharWidget
}
```

**HR 别名示例**（Odoo arch 名 → 内部 key）：

| arch `widget` | 解析为 |
|:---|:---|
| `hr_org_chart` / `hr_department_chart` | `OrgChartWidget` |
| `hr_presence_status` / `hr_icon_display` | `PresenceIcon` |
| `hr_version_timeline` | `VersionTimeline` |
| `employee_badge` / `hr_employee_badge` | `BadgeWidget`（`badge_print`） |

### 3.3 共享工具

| 工具 | 位置 | 用途 |
|:---|:---|:---|
| `NOOP` | `widgets/index.ts` | O2M/Kanban 只读单元格 `onChange` |
| `FIELD_INPUT_CLASS` | `widgets/index.ts` | Odoo 19 底部边框输入样式 |
| `formatFloatTime` / `parseFloatTime` 等 | `@odooseek/odoo-client` → `field-formatters.ts` | float_time、percentage、remaining_days |
| `resolveOdooImageSrc` / `resolveOdooImageFromRecord` | `apps/oweb/src/lib/odoo-image.ts` | 头像/工牌/组织图 URL（base64、/api/web/image） |
| `DOMPurify` | `basic.tsx` `HtmlWidget` | 只读 HTML 消毒 |

**图片规则**：`raw === false` 表示 Odoo 明确无图，**不**回退 `/api/web/image`；仅当 `raw` 为 `undefined`/`null` 时用 model+id 拼 URL。

### 3.4 关系字段模块（`relational/`）

| 文件 | 职责 |
|:---|:---|
| `shared.tsx` | `normalizeM2mValue`、`encodeM2mValue`、`normalizeO2mValue`；O2M 单元格 Display/Edit |
| `many2one.tsx` | `web_search_read` 下拉、快速创建、`Many2OneAvatar` |
| `many2many.tsx` | 标签、checkboxes、tags_avatar、`attachment_image` |
| `one2many.tsx` | 子列表 arch 或 `fields_get` 自动列；`O2mCommand` 本地编辑；`evalCondition` 行装饰 |

---

## 四、已实施 Widget 清单

### Phase 24 — P0 通用（✅）

| # | widget | 组件 | 文件 |
|:---:|:---|:---|:---|
| 1 | `statusbar` | `StatusbarWidget` | `selection.tsx` |
| 2 | `radio` | `RadioWidget` | `selection.tsx` |
| 3 | `many2many_checkboxes` | `Many2ManyCheckboxesWidget` | `relational/many2many.tsx` |
| 4 | `many2many_tags_avatar` | `Many2ManyTagsAvatarWidget` | `relational/many2many.tsx` |

### Phase 25 — P1 格式化（✅）

| # | widget | 组件 | 格式化来源 |
|:---:|:---|:---|:---|
| 5 | `float_time` | `FloatTimeWidget` | `odoo-client/field-formatters` |
| 6 | `percentage` | `PercentageWidget` | 同上 |
| 7 | `selection_badge` | `BadgeSelectionWidget` | `selection.tsx` |
| 8 | `label_selection` | `LabelSelectionWidget` | `selection.tsx` |
| 9 | `state_selection` | `StateSelectionWidget` | `selection.tsx` |

### Phase 26 — P2 实用（✅）

| # | widget | 组件 | 文件 |
|:---:|:---|:---|:---|
| 10 | `boolean_favorite` | `BooleanFavoriteWidget` | `utility.tsx` |
| 11 | `boolean_icon` | `BooleanIconWidget` | `utility.tsx` |
| 12 | `copy_clipboard` | `CopyClipboardWidget` | `utility.tsx` |
| 13 | `remaining_days` | `RemainingDaysWidget` | `utility.tsx` |
| 14 | `image_url` | `ImageUrlWidget` | `utility.tsx` |
| 15 | `percentpie` | `PercentPieWidget` | `utility.tsx` |

### 早期 / 其它已注册（✅）

`priority`、`boolean_toggle`、`many2one_avatar`、`email`、`phone`、`url`、`many2many_tags`、`handle`、`color_picker`、`progressbar`、`attachment_image`、`contact_image`、`web_ribbon`、`kanban_activity`、`rotting`、`BadgeWidget`（`widget="Badge"`）等 — 见 `index.ts` 中 `WIDGET_OVERRIDES`。

### HR 专用（✅ 基础版）

| widget（含别名） | 组件 | 行为摘要 | 差距 |
|:---|:---|:---|:---|
| `org_chart` / `hr_*_chart` | `OrgChartWidget` | 经理链 + 部门成员；点击跳转 `/hr/employee/:id`；`maxDepth=5` | 非 Odoo `web_graph` / d3；无缩放 |
| `presence_icon` / `hr_*_presence*` | `PresenceIcon` | 状态点 + Kanban overlay | 依赖后端计算字段 |
| `version_timeline` | `VersionTimeline` | 接 `HrVersionProvider`；历史只读预览 | 无 Provider 时单独 `useVersioning` |
| `badge_print` / `employee_badge` | `BadgeWidget` | React 打印窗口 | 非 Odoo QWeb-PDF 报告 |

版本时间线：表单由 `HrVersionProvider` 包裹时，Widget 内 **`useVersioning(..., { enabled: false })`**，避免重复请求 `hr.version`。

---

## 五、测试与质量

| 范围 | 文件 | 说明 |
|:---|:---|:---|
| 注册表 / 别名 | `widgets/__tests__/getFieldWidget.test.ts` | HR alias、回退 |
| 关系 + 通用 UI | `views/__tests__/field-widgets.test.tsx` | 67+ 用例，含 M2O Avatar |
| 组织图算法 | `widgets/__tests__/OrgChart.test.tsx` | `findOrgRootId`、`buildTree`、`resolveDepartmentOrgRootId` |
| 考勤 | `widgets/__tests__/PresenceIcon.test.tsx` | `resolvePresenceState` |
| 图片 URL | `lib/__tests__/odoo-image.test.ts` | base64、false、web/image |
| 格式化 | `packages/odoo-client/src/__tests__/field-formatters.test.ts` | float_time、remaining_days |

```bash
cd apps/oweb
bun run build
bun run lint
bun run test    # 含 field-widgets + widgets 子目录
```

手动：在 Form/Kanban 上切换只读/编辑，确认 M2O 搜索、O2M 增删改、statusbar 点击、HR 组织图导航。

---

## 六、扩展指南

### 6.1 新增 Widget

1. 在合适子模块实现 `function XxxWidget(props: FieldWidgetProps)`。
2. 在 `index.ts` 的 `WIDGET_OVERRIDES` 注册；若 Odoo arch 名与 key 不同，增加 `WIDGET_ALIASES`。
3. 在 `field-widgets.test.tsx` 或 `widgets/__tests__/` 增加解析与渲染冒烟测试。
4. 若需 RPC，使用 `@tanstack/react-query` + `callKw` / `searchRead`，`queryKey` 建议 `['odoo', ...]`。

### 6.2 新增关系类 Widget

优先放入 `relational/many2one.tsx` 或 `many2many.tsx`；O2M 列展示逻辑放 `shared.tsx` 的 `O2mCell*`。

### 6.3 类型安全（可选）

业务记录可逐步改为 `import type { HrEmployeeRecord } from '@odooseek/odoo-types'`，见 [`docs/ODOO_CODEGEN_AND_TYPES.md`](../ODOO_CODEGEN_AND_TYPES.md)。

---

## 七、暂不实现

| Widget / 能力 | 原因 |
|:---|:---|
| `ace` / `ir_ui_view_ace` | 需 CodeMirror 等编辑器集成 |
| `google_slide_viewer` | 外部 API |
| `iframe_wrapper` | 安全面 |
| `journal_dashboard_graph` | 会计专属 |
| `dynamic_placeholder` | 营销专属 |
| `kanban_color_picker` | 看板内专用，非 Form 字段 |
| `timezone_mismatch` | 低频 |
| `json_checkboxes` | 低频 |
| `domain` | 体量大，需独立设计 |
| `properties` | 体量大，需独立设计 |
| `signature` | 需 Canvas 签名库 |
| `field_selector` | 工具栏场景 |
| `reference`（增强） | 多模型切换复杂 |
| `pdf_viewer` | PDF.js |
| `gauge` | 仪表盘 SVG |
| HR 组织图 d3 / Odoo 报告 PDF 工牌 | 见 HR 计划后续 Phase |

---

## 八、后续演进（建议）

| 优先级 | 项 | 说明 |
|:---:|:---|:---|
| P1 | O2M / M2M 单测 | 覆盖 `normalizeM2mValue`、command 合并 |
| P2 | `domain` / `properties` | 独立设计文档 + 分包 |
| P2 | Widget 与 `groups` | 敏感字段（如 `wage`）在 Widget 层二次隐藏 |
| P3 | 类型化 `callKw` | 与 `odoo-types` 泛型包装联动 |
| P3 | HR 工牌 PDF | 对接 Odoo `report` 或保留双轨 |

---

## 九、变更记录

| 版本 | 日期 | 说明 |
|:---:|:---|:---|
| 1.0 | 2026-06-01 | 初稿：Phase 24–26 规划与伪代码 |
| 2.0 | 2026-06-01 | 对齐 as-built：`views/widgets/` 目录、relational 拆分、`odoo-image`、HR Widget、`WIDGET_ALIASES`、测试与格式化包位置修正 |
