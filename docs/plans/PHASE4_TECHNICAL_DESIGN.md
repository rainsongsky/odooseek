# Phase 4 开发计划 — 看板 QWeb 语义支持 + 交互增强

> **优先级**: P0 (阻塞看板真实可用)  
> **前置**: Phase 3 完成, QWeb 引擎分析完成  
> **状态**: 📋 待启动

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

## 二、任务分解

### 4.1 Kanban 卡片结构解析器 (`xml-parser.ts` 扩展)

将 `parseKanbanFields()` 从"提取所有 field"升级为"解析模板结构树"：

```typescript
// 当前 (扁平)
parseKanbanFields(template) → ViewField[]
// 目标 (树状)
parseKanbanTemplate(template) → KanbanTemplateNode[]
```

```
KanbanTemplateNode:
├── type: 'field'           → { name, widget, class, invisible }
├── type: 'condition'       → { if: "record.expected_revenue", children: [...] }
├── type: 'loop'            → { foreach: "record.tag_ids", as: "tag", children: [...] }
├── type: 'html'            → { tag: 'div', class: '...', children: [...] }
├── type: 'output'          → { expr: "...", widget: "..." }
├── type: 'template-call'   → { name: "..." }       (暂跳过)
├── type: 'footer'          → { children: [...] }    (卡片底部特殊渲染)
└── type: 'widget'          → { name: "web_ribbon", ... }  (暂跳过)
```

**解析逻辑**（与 Odoo QWeb AST 对齐）：

| Odoo QWeb | KanbanTemplateNode |
|-----------|-------------------|
| `<field .../>` | `{ type: 'field', name }` |
| `<t t-if="expr">` | `{ type: 'condition', if: 'expr', children: [...] }` |
| `<t t-elif="expr">` | sibling to `condition` with `elif` |
| `<t t-else="">` | sibling to `condition` with `else: true` |
| `<t t-foreach="expr" t-as="var">` | `{ type: 'loop', foreach: 'expr', as: 'var' }` |
| `<t t-out="expr"/>` | `{ type: 'output', expr }` |
| `<div>`, `<span>`, etc. | `{ type: 'html', tag: 'div', children }` |
| `text()` 文本节点 | `{ type: 'text', content }` |
| `<footer>` | `{ type: 'footer' }` `+ children` |

**预计工时**: 1 天

### 4.2 KanbanCard 树状渲染器

替换当前的线性 Widget 渲染为递归树渲染：

```typescript
function KanbanNode({ node, record, fields }: NodeProps) {
  switch (node.type) {
    case 'field': return <FieldWidget name={node.name} value={record[node.name]} .../>
    case 'condition':
      if (evalCondition(node.if, record)) return <>{node.children.map(...)}</>
      if (node.elif) return <>{node.elif.children.map(...)}</>
      if (node.else) return <>{node.else.children.map(...)}</>
      return null
    case 'loop':
      const list = getValue(node.foreach, record)
      return <>{list.map((item, i) => <KanbanNode node={node.children[0]} record={item} .../>)}</>
    case 'html':
      return <node.tag className={...}>{node.children.map(...)}</>
    case 'output':
      return <span>{String(getValue(node.expr, record))}</span>
    case 'text':
      return <>{node.content}</>
    case 'footer':
      return <div className="kanban-footer">{node.children.map(...)}</div>
  }
}
```

**表达式求值器**:

```typescript
// 轻量级安全表达式求值（不实现完整 QWeb 表达式引擎）
function evalCondition(expr: string, record: Record<string, unknown>): boolean {
  // 支持: record.field_name, !record.field_name, record.field_name == value
  // 不支持: 数学运算、函数调用、复杂逻辑（这些留给后端 domain）
}

function getValue(expr: string, record: Record<string, unknown>): unknown {
  // 支持: record.field_name
}
```

**预计工时**: 1 天

### 4.3 表达式求值安全机制

关键约束：表达式在客户端执行，来自 Odoo XML 定义（不是用户输入），但必须在受控范围内：

1. 仅允许访问 `record.*` 路径
2. 白名单运算符: `==`, `!=`, `>`, `<`, `&&`, `||`, `!`, `+`, `-`
3. 禁止: `eval()`, `Function()`, 成员访问链超过 1 层

**预计工时**: 0.5 天

### 4.4 卡片 `highlight_color` 支持

Odoo `<kanban highlight_color="color">` — 卡片有颜色标记（来自 `color` 字段的 0-11 索引）：

```typescript
const COLORS = ['', '#a9a9a9', '#2ecc71', '#3498db', '#e67e22', '#9b59b6', 
                '#1abc9c', '#f39c12', '#e74c3c', '#7f8c8d', '#0d6efd', '#d63384']

function getCardColor(record: Record<string, unknown>): string | undefined {
  const colorIndex = Number(record['color'])
  return colorIndex > 0 ? COLORS[colorIndex] : undefined
}
```

**预计工时**: 0.3 天

### 4.5 测试

扩展现有测试覆盖：

| 测试 | 内容 |
|------|------|
| `parseKanbanTemplate()` | 解析含 t-if, t-foreach, t-else 等指令的模板 |
| `evalCondition()` | 基本表达式: 真/假/比较 |
| `getValue()` | 字段值提取 |
| `KanbanNode` 渲染 | 条件、循环、footer 分区的快照测试 |

**预计工时**: 0.5 天

---

## 三、完成标准

```
[ ] parseKanbanTemplate() 解析 <t t-if>, <t t-foreach>, <t t-elif>, <t t-else>
[ ] parseKanbanTemplate() 解析 <footer> 独立分区
[ ] KanbanNode 树状渲染器替换线性 Widget
[ ] 表达式求值器 evalCondition / getValue (受控安全)
[ ] highlight_color 卡片颜色渲染
[ ] Odoo CRM 看板卡片与 Odoo 官方效果一致
[ ] 5 个新测试通过
[ ] 现有 19 个测试仍通过
[ ] 构建通过
```

---

## 四、总计

| 任务 | 工时 |
|------|------|
| 4.1 卡片结构解析器 | 1 天 |
| 4.2 树状渲染器 | 1 天 |
| 4.3 表达式求值器 | 0.5 天 |
| 4.4 highlight_color | 0.3 天 |
| 4.5 测试 | 0.5 天 |
| **合计** | **3.3 天** |

---

## 五、后续计划 (Phase 5+)

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

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
