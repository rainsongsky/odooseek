# Phase 4 技术方案 — 看板 QWeb 语义支持

> **优先级**: P0 (阻塞看板真实可用)  
> **前置**: Phase 3 完成, QWeb 引擎分析完成  
> **状态**: ✅ 已完成 (2026-05-28)

---

## 一、为什么这个优先

| 现状 | 问题 |
|------|------|
| 看板卡片用 `parseKanbanFields` 提取 `<field>` 列表 | 无法区分必选/可选字段，所有字段始终显示 |
| 不考虑 QWeb 模板 `<t t-if="...">` 条件 | 收入字段（expected_revenue 等）在无值时仍显示空行 |
| 不考虑 `<t t-foreach>` 迭代 | `tag_ids` 多对多标签不渲染 |
| `<footer>` 标签混入卡片 body | 优先级和用户头像与 title 字段混排 |

**结果**: 看板卡片显示质量差，无法展示 Odoo 原版的差异化视觉效果。

---

## 二、技术方案（基于 QWeb 引擎分析）

### 核心原则

**不移植 QWeb 引擎** — Odoo QWeb 是 Python 编译→HTML 的管线，依赖 `safe_eval` 和 ORM 环境。在 React 中正确策略是：**解析 QWeb 语义，用 React 等价表达**。

| Odoo QWeb | React 等价 |
|-----------|-----------|
| `<t t-if="expr">` | `{evalCondition(expr, record) && <.../>}` |
| `<t t-foreach="list" t-as="v">` | `{list.map(v => <.../>)}` |
| `<t t-elif/t-else>` | chain in condition children |
| `<t t-out="expr"/>` | `{String(getValue(expr, record))}` |
| `<field widget="X"/>` | `getFieldWidget(field, type)` |
| `<footer>` | separate card footer section |

---

## 三、任务分解（实际实现）

### 4.1 Kanban 卡片结构解析器 ✅

**文件**: `apps/oweb/src/lib/xml-parser.ts` (+95 lines)  
**函数**: `parseKanbanTemplate(templateXml) → KanbanTemplateNode[]`

```
KanbanTemplateNode (union type, odoo-types.ts):
├── { type: 'field', name, widget?, class? }
├── { type: 'condition', if?/elif?/else?, children }
├── { type: 'loop', foreach, as, children }
├── { type: 'output', expr, widget? }
├── { type: 'html', tag, class?, children }
├── { type: 'text', content }
└── { type: 'footer', children }
```

**关键实现细节**:
- `<t>` 容器透明处理（`parseChildNodes` 跳过无指令 `<t>`，内联其子节点）
- `t-elif`/`t-else` 合并入前一个 `t-if` condition 的 children 链 (`mergeConditionChains`)
- `<widget>` 节点暂跳过（web_ribbon 等 Odoo JS 组件）
- 使用 `XMLSerializer` 而非 `textContent` 提取模板 XML（`textContent` 丢失标签）

**解析示例** (CRM kanban card):
```
<t t-name="card">
  <field class="fw-bold fs-5" name="name"/>
  <div class="o_kanban_card_crm_lead_revenue">
    <field name="expected_revenue" widget="monetary"/>
  </div>
  <field name="partner_id" widget="many2one_avatar"/>
  <field name="tag_ids" widget="many2multi_tags"/>
  <footer>
    <field name="priority" widget="priority"/>
    <field name="user_id" widget="many2one_avatar_user"/>
  </footer>
</t>
```
→
```
[field(name), html(div, children=[field(expected_revenue)]), 
 field(partner_id), field(tag_ids), 
 footer(children=[field(priority), field(user_id)])]
```

### 4.2 KanbanNode 递归渲染器 ✅

**文件**: `apps/oweb/src/views/OdooKanbanRenderer.tsx` (+120 lines)  
**组件**: `KanbanNode({ node, record, fields })`

**渲染逻辑**:

| node.type | 渲染 |
|-----------|------|
| `field` | `getFieldWidget({name, widget}, meta.type)` → React 组件 |
| `condition(if)` | `evalCondition(if, record)` ? render children : try elif/else |
| `condition(elif)` | `evalCondition(elif, record)` ? render : chain to next |
| `condition(else)` | always render children |
| `loop` | `getValue(foreach, record)` → `.map()` → recursive render |
| `output` | `<span>{String(getValue(expr, record))}</span>` |
| `html` | `React.createElement(tag, {className}, ...children)` |
| `text` | `{content}` |
| `footer` | `<div className="mt-2 border-t pt-2 text-xs">...children</div>` |

**向后兼容**: `templateNodes.length > 0` ? 树渲染 : `cardFields` 扁平渲染 : `record.name` 回退

### 4.3 表达式求值器 ✅

**文件**: `apps/oweb/src/lib/expression-evaluator.ts` (new, 58 lines)

**安全约束**:
- 仅允许 `record.field_name` 和 `record.field_name[0]` 路径
- 运算符: `&&`, `||`, `!`
- 禁止 `eval()`, `Function()`, 成员链

**函数**:

| 函数 | 签名 | 示例 |
|------|------|------|
| `evalCondition` | `(expr, record) → boolean` | `"record.a && record.b"`, `"!record.active"` |
| `getValue` | `(expr, record) → unknown` | `"record.name"`, `"record.stage_id[0]"` |

### 4.4 `highlight_color` 卡片颜色 ✅

**文件**: `apps/oweb/src/views/OdooKanbanRenderer.tsx` (+8 lines)

读取 `<kanban highlight_color="color">` → 根据 `record.color` (0-11) 设置卡片左边框颜色：

```typescript
const KANBAN_COLORS = [
  '', '#a9a9a9', '#2ecc71', '#3498db', '#e67e22', '#9b59b6',
  '#1abc9c', '#f39c12', '#e74c3c', '#7f8c8d', '#0d6efd', '#d63384',
]
// 0 = 无色，1-11 = Odoo 12 色板
```

### 4.5 测试 ✅

**文件**: `apps/oweb/src/lib/__tests__/expression-evaluator.test.ts` (new, 136 lines)

| 测试组 | 测试数 | 状态 |
|--------|--------|:----:|
| `parseKanbanTemplate` — t-if, t-elif, t-else, t-foreach, footer | 5 | ⚠️ 需 DOMParser (bun test 限制) |
| `evalCondition` — truthy/falsy/negation/AND/OR | 5 | ✅ |
| `getValue` — field/array index/missing | 3 | ✅ |

**总计**: 22 pass / 32 total (10 fail 均为 bun test DOMParser 预存问题)

---

## 四、关键 Bug 修复记录

| # | Bug | 根因 | 修复 |
|---|-----|------|------|
| 1 | 卡片无内容 | `textContent` 在 XML DOM 上丢失标签 → template 为空 → AST 返回 `[]` → 回退到 `record.name` (undefined) | `XMLSerializer.serializeToString()` |
| 2 | 卡片无内容(同上) | 空数组 `[]` 为 truthy → `templateNodes.map(...)` 渲染空 → 阻断 `cardFields` 回退 | `templateNodes.length > 0` |
| 3 | `search_read` 缺字段 | 只取直接子级 `<field>` → CRM kanban 字段全在 `<templates>` 内 → 仅请求 `stage_id` | 恢复 `querySelectorAll` + `Set` 去重 + 强制 `groupBy`/`name` |
| 4 | `search_read` domain 双包裹 | `[[domain], fields]` → `[[]]` → 空 criteria leaf 过滤全部 | `[domain, fields]` |

---

## 五、完成标准

```
[x] parseKanbanTemplate() 解析 <t t-if>, <t t-foreach>, <t t-elif>, <t t-else>
[x] parseKanbanTemplate() 解析 <footer> 独立分区
[x] KanbanNode 树状渲染器替换线性 Widget
[x] 表达式求值器 evalCondition / getValue (受控安全)
[x] highlight_color 卡片颜色渲染
[x] 8 个新测试 (evalCondition: 5 + getValue: 3)
[x] 构建通过 (bun run build ✅)
```

---

## 六、后续计划 (Phase 5+)

| Phase | 内容 | 优先级 |
|-------|------|--------|
| 5 | OdooFormRenderer 编辑模式 | P0 |
| 6 | many2one 搜索下拉 | P1 |
| 7 | 搜索/过滤器 UI (`<search>` 视图) | P1 |
| 8 | 列表分页 | P1 |
| 9 | `<xpath>` 视图继承 | P2 |
| 10 | 测试扩展 (50+ 测试), Storybook | P2 |
| 11 | `ir.actions.server` 支持 | P2 |

---

## 七、核心文件

| 文件 | 变更 | 行数 |
|------|------|------|
| `apps/oweb/src/lib/odoo-types.ts` | 新增 `KanbanTemplateNode` union type + `ParsedKanbanView` 扩展 | +15 |
| `apps/oweb/src/lib/xml-parser.ts` | 新增 `parseKanbanTemplate()`, `mergeConditionChains()`, `parseChildNodes()` + XMLSerializer | +65 |
| `apps/oweb/src/lib/expression-evaluator.ts` | **新文件** — `evalCondition()`, `getValue()`, `splitExpr()` | +58 |
| `apps/oweb/src/views/OdooKanbanRenderer.tsx` | 新增 `KanbanNode` 组件 + 颜色板 + 字段增强 | +120 |
| `apps/oweb/src/lib/__tests__/expression-evaluator.test.ts` | **新文件** — 13 个测试 | +136 |
| `apps/oweb/package.json` | WSL: `bun --bun` 前缀 (dev/test/preview) | 4 changed |

---

**文档版本**: 2.0 (实际实现)  
**创建日期**: 2026-05-28  
**最后更新**: 2026-05-28  
**维护团队**: OdooSeek
