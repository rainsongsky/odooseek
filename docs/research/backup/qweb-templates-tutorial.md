# Odoo 模板与 QWeb 培训教程

**版本**: v1.0.0  
**日期**: 2025-01-27  
**目标受众**: 前端开发人员、后端开发人员、QWeb 模板开发者

## 目录

1. [Odoo 模板系统概述](#odoo-模板系统概述)
2. [QWeb 是什么](#qweb-是什么)
3. [QWeb 基础语法](#qweb-基础语法)
4. [QWeb 核心指令详解](#qweb-核心指令详解)
5. [模板继承机制](#模板继承机制)
6. [模板调用与组合](#模板调用与组合)
7. [表达式与变量](#表达式与变量)
8. [实际应用场景](#实际应用场景)
9. [最佳实践](#最佳实践)
10. [常见问题与调试](#常见问题与调试)

---

## Odoo 模板系统概述

### 重要概念区分：视图定义 vs QWeb 模板

在理解 Odoo 模板系统之前，需要明确两个相关但不同的概念：

#### 1. 视图定义（View Definition）

**视图定义**使用 XML 格式，但**不是 QWeb 模板**。它定义的是数据视图的结构（字段、布局、属性等）。

**示例：列表视图定义**

```xml
<record id="view_sale_order_tree" model="ir.ui.view">
  <field name="name">sale.order.tree</field>
  <field name="model">sale.order</field>
  <field name="arch" type="xml">
    <tree string="Sales Orders">
      <field name="name"/>
      <field name="date_order"/>
      <field name="partner_id"/>
      <field name="amount_total"/>
    </tree>
  </field>
</record>
```

**特点**：

- 使用标准的 XML 标签（`<tree>`, `<form>`, `<field>` 等）
- 定义视图的结构和配置
- **不包含 QWeb 指令**（如 `t-esc`, `t-if` 等）
- 存储在 `ir.ui.view` 模型的 `arch` 字段中

#### 2. QWeb 模板（QWeb Template）

**QWeb 模板**使用 QWeb 语法，用于渲染动态 HTML 内容。

**示例：QWeb 模板**

```xml
<t t-name="web.ListView">
  <div class="list-view">
    <table>
      <tr t-foreach="records" t-as="record">
        <td t-esc="record.name"/>
        <td t-esc="record.date_order"/>
      </tr>
    </table>
  </div>
</t>
```

**特点**：

- 使用 QWeb 指令（`t-esc`, `t-if`, `t-foreach` 等）
- 用于生成动态 HTML
- 可以访问数据和表达式

### 视图定义与 QWeb 模板的关系

#### Odoo 原生流程

在 Odoo 原生架构中，视图定义和 QWeb 模板的关系如下：

```
视图定义（XML，存储在 ir.ui.view）
    ↓
定义视图结构（字段、布局）
    ↓
OWL 组件读取视图定义
    ↓
使用 QWeb 模板渲染视图显示
    ↓
QWeb 引擎执行模板，生成 DOM
    ↓
OWL 框架更新组件状态
```

**关键点**：

- 视图定义（XML）描述结构
- QWeb 模板（XML + QWeb 指令）描述渲染逻辑
- OWL 组件使用 QWeb 模板进行渲染

#### 本项目 React 重构后的流程

本项目使用 React 重构后，采用了不同的机制：

**对于列表视图和表单视图**：

```
视图定义（XML，通过 RPC 加载）
    ↓
XML 解析器（parseViewArch）解析为 AST
    ↓
视图解析器（如 parseListView）转换为 React 配置
    ↓
React 组件直接渲染（不使用 QWeb 模板）
    ↓
生成最终的 React DOM
```

**对于看板视图（混合策略 + AST 转换方案）**：

```
视图定义（XML，通过 RPC 加载）
    ↓
XML 解析器（parseViewArch）解析为 AST
    ↓
视图解析器（parseKanbanView）：
  - 提取字段和分组信息
  - 提取 <templates> 中的 QWeb 模板
  - 使用 QWeb 编译器编译模板为 CompiledNode AST
    ↓
看板结构（列、分组、拖拽）：React 组件渲染
    ↓
卡片内容渲染：
  - 使用 renderKanbanCardToReact 函数
  - 将 QWeb CompiledNode AST 转换为 React 元素
  - 特殊处理 <field> 标签，转换为 React 字段组件
  - 支持 t-if、t-foreach 等 QWeb 指令
    ↓
生成最终的 React DOM（完全使用 React 虚拟 DOM）
```

**💡 核心原理**：

1. **配置驱动**（列表、表单视图）：
   - **不同的 XML** → **不同的 AST** → **不同的 React 配置** → **同一个 React 组件** → **不同的渲染结果**

2. **混合策略 + AST 转换**（看板视图）：
   - 视图结构（看板布局、列、拖拽）：React 组件
   - 卡片内容（卡片 HTML 布局）：QWeb 模板 AST → React 元素转换
   - 优势：完全利用 React 虚拟 DOM，性能更好，数据绑定正常

**示例说明**：

**场景 1：销售订单列表视图**

```xml
<!-- XML 视图定义 -->
<tree>
  <field name="name"/>
  <field name="date_order"/>
  <field name="amount_total"/>
</tree>
```

**处理流程**：

1. XML 解析为 AST：`{ tag: "tree", children: [...] }`
2. AST 转换为配置：`columns = [{ name: "name" }, { name: "date_order" }, { name: "amount_total" }]`
3. 同一个组件渲染：`<OdooListView columns={columns} />`
4. 结果：显示销售订单表格（3 列）

**场景 2：产品列表视图**

```xml
<!-- 不同的 XML 视图定义 -->
<tree>
  <field name="name"/>
  <field name="list_price"/>
  <field name="qty_available"/>
</tree>
```

**处理流程**：

1. XML 解析为 AST：`{ tag: "tree", children: [...] }`（结构相同，内容不同）
2. AST 转换为配置：`columns = [{ name: "name" }, { name: "list_price" }, { name: "qty_available" }]`（配置不同）
3. **同一个组件渲染**：`<OdooListView columns={columns} />`（组件相同）
4. 结果：显示产品表格（3 列，但列不同）

**关键点**：

| 阶段           | 销售订单视图           | 产品视图               | 是否相同          |
| -------------- | ---------------------- | ---------------------- | ----------------- |
| **XML 定义**   | `<field name="name"/>` | `<field name="name"/>` | ❌ 不同           |
| **AST 结构**   | `{ tag: "tree", ... }` | `{ tag: "tree", ... }` | ✅ 结构相同       |
| **React 配置** | `columns = [...]`      | `columns = [...]`      | ❌ 内容不同       |
| **React 组件** | `<OdooListView />`     | `<OdooListView />`     | ✅ **同一个组件** |
| **渲染结果**   | 订单表格               | 产品表格               | ❌ 不同           |

**设计优势**：

1. **组件复用**：一个 `OdooListView` 组件可以渲染所有列表视图
2. **配置驱动**：通过 XML 配置控制渲染，无需为每个视图编写新组件
3. **动态加载**：可以根据 `viewId` 动态加载不同的视图配置
4. **易于维护**：修改视图只需修改 XML，无需修改组件代码

#### 什么是 AST？

**AST（Abstract Syntax Tree，抽象语法树）** 是一种树形数据结构，用于表示源代码的语法结构。

**简单理解**：

- **源代码**（如 XML、JavaScript）是文本格式，难以直接处理
- **AST** 将文本转换为树形结构，便于程序分析和处理
- 每个节点代表源代码中的一个语法元素

**在本项目中的应用**：

项目将 XML 视图定义转换为 AST，然后基于 AST 生成 React 配置。

**示例：XML → AST 转换**

**原始 XML**：

```xml
<tree>
  <field name="name" string="名称"/>
  <field name="date" string="日期"/>
  <field name="amount" widget="monetary"/>
</tree>
```

**转换后的 AST**：

```typescript
{
  tag: "tree",
  attrs: {},
  children: [
    {
      tag: "field",
      attrs: { name: "name", string: "名称" },
      children: []
    },
    {
      tag: "field",
      attrs: { name: "date", string: "日期" },
      children: []
    },
    {
      tag: "field",
      attrs: { name: "amount", widget: "monetary" },
      children: []
    }
  ]
}
```

**为什么需要 AST？**

1. **结构化数据**：XML 文本难以直接处理，AST 提供结构化的数据
2. **易于遍历**：可以递归遍历 AST 节点，提取所需信息
3. **类型安全**：TypeScript 类型定义确保数据结构正确
4. **可扩展性**：可以轻松添加新的解析逻辑

**AST 在本项目中的使用流程**：

```typescript
// 1. XML 文本
const arch = `<tree><field name="name"/></tree>`;

// 2. 解析为 AST
const { root } = parseViewArch(arch);
// root 是 ViewArchAST 类型

// 3. 遍历 AST，提取信息
function parseListView(arch: string, fields: Record<string, OdooField>) {
  const { root } = parseViewArch(arch);
  const treeNode = findFirstTree(root); // 查找 <tree> 节点

  const columns: ListColumn[] = [];
  for (const child of treeNode.children) {
    if (child.tag === "field") {
      columns.push({
        name: child.attrs.name,
        label: child.attrs.string || fields[child.attrs.name]?.label,
        widget: child.attrs.widget,
      });
    }
  }
  return { columns };
}

// 4. 转换为 React 配置
const { columns } = parseListView(view.arch, fields);
// columns 用于渲染 React 组件
```

#### React 配置机制详解

**React 配置**是将 AST 转换为 React 组件可以直接使用的数据结构。它不是 React 组件本身，而是描述如何渲染组件的配置对象。

**为什么需要 React 配置？**

1. **解耦**：将视图定义（XML）与 React 组件解耦
2. **类型安全**：TypeScript 类型定义确保配置正确
3. **可复用**：配置可以在不同组件间复用
4. **易于测试**：可以独立测试配置生成逻辑

**React 配置的生成流程**：

```
AST 节点树
    ↓
视图解析器（parseListView、parseFormView 等）
    ↓
遍历 AST，提取信息
    ↓
生成 React 配置对象
    ↓
传递给 React 组件
    ↓
组件根据配置渲染
```

**不同视图类型的 React 配置**：

#### 1. 列表视图配置（ListColumn）

**AST 输入**：

```xml
<tree>
  <field name="name" string="名称"/>
  <field name="amount" widget="monetary"/>
</tree>
```

**React 配置输出**：

```typescript
interface ListColumn {
  name: string; // 字段名
  label: string; // 显示标签
  widget?: string; // Widget 类型
  attrs?: Record<string, string>; // 原始属性
}

const columns: ListColumn[] = [
  { name: "name", label: "名称", attrs: { name: "name", string: "名称" } },
  {
    name: "amount",
    label: "金额",
    widget: "monetary",
    attrs: { name: "amount", widget: "monetary" },
  },
];
```

**使用配置渲染**：

```typescript
export const OdooListView = () => {
  const { columns, records } = useOdooListView({ ... })

  return (
    <Table>
      {records.map(record => (
        <TableRow key={record.id}>
          {columns.map(col => (
            <TableCell key={col.name}>
              {formatFieldValue(record[col.name], col)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </Table>
  )
}
```

#### 2. 表单视图配置（FormField、FormGroup）

**AST 输入**：

```xml
<form>
  <group>
    <field name="name"/>
    <field name="date"/>
  </group>
  <group>
    <field name="amount"/>
  </group>
</form>
```

**React 配置输出**：

```typescript
interface FormField {
  name: string;
  label: string;
  widget?: string;
  attrs?: Record<string, string>;
  colspan?: number;
  rowspan?: number;
}

interface FormGroup {
  title?: string;
  fields: FormField[];
}

const result: FormViewParseResult = {
  fields: [
    { name: "name", label: "名称" },
    { name: "date", label: "日期" },
    { name: "amount", label: "金额" },
  ],
  groups: [
    {
      title: undefined,
      fields: [
        { name: "name", label: "名称" },
        { name: "date", label: "日期" },
      ],
    },
    {
      title: undefined,
      fields: [{ name: "amount", label: "金额" }],
    },
  ],
};
```

**使用配置渲染**：

```typescript
export const OdooFormView = () => {
  const { groups, fields } = parseFormView(view.arch, fields)

  return (
    <form>
      {groups.map((group, idx) => (
        <FormGroup key={idx} title={group.title}>
          {group.fields.map(field => (
            <FormField
              key={field.name}
              field={fields[field.name]}
              value={record[field.name]}
              onChange={handleChange}
            />
          ))}
        </FormGroup>
      ))}
    </form>
  )
}
```

#### 3. 看板视图配置（KanbanRecord）

**AST 输入**：

```xml
<kanban>
  <field name="name"/>
  <field name="stage_id"/>
  <templates>
    <t t-name="kanban-box">
      <div><field name="name"/></div>
    </t>
  </templates>
</kanban>
```

**React 配置输出**：

```typescript
interface KanbanRecord {
  name: string;
  stage_id: number;
  // ... 其他字段
}

const records: KanbanRecord[] = [
  { name: "任务1", stage_id: 1 },
  { name: "任务2", stage_id: 2 },
];
```

**配置生成的核心逻辑**：

```typescript
// 列表视图解析器示例
export function parseListView(
  arch: string,
  fields: Record<string, OdooField>,
): ListViewParseResult {
  // 1. 解析 XML 为 AST
  const { root } = parseViewArch(arch);

  // 2. 查找 <tree> 节点
  const treeNode = findFirstTree(root);

  // 3. 遍历 AST，提取字段信息
  const columns: ListColumn[] = [];
  for (const child of treeNode.children) {
    if (child.tag === "field" && child.attrs.name) {
      const fieldName = child.attrs.name;
      const field = fields[fieldName];

      // 4. 生成 React 配置对象
      columns.push({
        name: fieldName,
        label: child.attrs.string || field?.label || fieldName,
        widget: child.attrs.widget,
        attrs: child.attrs,
      });
    }
  }

  // 5. 返回配置
  return { columns };
}
```

**React 配置的优势**：

| 优势         | 说明                          |
| ------------ | ----------------------------- |
| **类型安全** | TypeScript 提供完整的类型检查 |
| **可测试**   | 配置生成逻辑可以独立测试      |
| **可缓存**   | 配置可以缓存，避免重复解析    |
| **可扩展**   | 可以轻松添加新的配置属性      |
| **解耦**     | 视图定义与 React 组件解耦     |

**配置的使用模式**：

```typescript
// 1. 在 Hook 中生成配置
export function useOdooListView(params) {
  const metaQuery = useQuery({
    queryKey: ["odoo", "list-view", "meta", model, viewId],
    queryFn: async () => {
      const { view, fields } = await loader.loadView(model, "list")
      // 生成 React 配置
      const { columns } = parseListView(view.arch, fields)
      return { view, fields, columns }
    },
  })

  // 2. 在组件中使用配置
  const { columns } = metaQuery.data

  return { columns, ... }
}

// 3. 组件根据配置渲染
export const OdooListView = () => {
  const { columns, records } = useOdooListView({ ... })

  // 使用配置渲染表格
  return (
    <Table>
      <TableHeader>
        {columns.map(col => (
          <TableHead key={col.name}>{col.label}</TableHead>
        ))}
      </TableHeader>
      <TableBody>
        {records.map(record => (
          <TableRow key={record.id}>
            {columns.map(col => (
              <TableCell key={col.name}>
                {formatFieldValue(record[col.name], col)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**配置的缓存机制**：

```typescript
// 使用 TanStack Query 缓存配置
const metaQuery = useQuery({
  queryKey: ["odoo", "list-view", "meta", model, viewId, context],
  staleTime: 60_000, // 1 分钟内使用缓存
  gcTime: 5 * 60_000, // 5 分钟后清理缓存
  queryFn: async () => {
    // 生成配置（只在首次或缓存失效时执行）
    const { columns } = parseListView(view.arch, fields);
    return { columns };
  },
});
```

**AST 节点结构**（`ViewArchAST`）：

```typescript
interface ViewArchAST {
  /** 标签名，如 "tree", "field", "form" 等 */
  tag: string;
  /** 属性映射，如 { name: "title", string: "标题" } */
  attrs: Record<string, string>;
  /** 子节点数组 */
  children: ViewArchAST[];
  /** 文本内容（仅文本节点） */
  text?: string;
}
```

**AST 的优势**：

| 优势         | 说明                           |
| ------------ | ------------------------------ |
| **结构化**   | 将文本转换为易于处理的数据结构 |
| **类型安全** | TypeScript 提供完整的类型检查  |
| **易于遍历** | 可以递归遍历节点树             |
| **可扩展**   | 可以轻松添加新的解析逻辑       |
| **性能**     | 一次解析，多次使用             |

**关键差异**：

- ✅ **保留**：视图定义（XML）的加载和解析
- ❌ **移除**：视图组件的 QWeb 模板使用（列表、表单等视图不使用 QWeb）
- ✅ **新增**：XML → AST → React 配置的转换层
- ✅ **使用**：React 组件直接渲染，而非 QWeb 模板

#### ⚠️ 重要说明：为什么还需要开发 libs/qwebjs？

虽然视图组件（列表、表单、看板等）不使用 QWeb 模板，但 `libs/qwebjs` 在项目中仍有重要用途：

**1. 报表模板渲染** ✅

报表系统需要使用 QWeb 模板来生成 HTML/PDF 报表：

```typescript
// 使用 QWeb 模板渲染报表
const SalesReport = createQWebReactComponent('qweb.report.sales')

<SalesReport
  subtitle="销售报表"
  metrics={{ revenue: { value: "$45,231.89" } }}
/>
```

**实际使用示例**：

```typescript
// apps/web/src/features/dashboard/components/qweb-report.tsx
const SalesReport = createQWebReactComponent<SalesReportContext>('qweb.report.sales')

export function QWebSalesReportCard() {
  return (
    <Card>
      <CardContent>
        <SalesReport {...context} />
      </CardContent>
    </Card>
  )
}
```

**2. 邮件模板渲染** ✅

邮件系统需要使用 QWeb 模板来生成邮件内容：

```typescript
// 使用 QWeb 模板渲染邮件
const emailHtml = qwebEngine.render("email.order.confirmation", {
  order: orderData,
  customer: customerData,
});
```

**3. Dashboard 展示组件** ✅

Dashboard 中的一些展示组件使用 QWeb 模板：

```typescript
// Dashboard 报表卡片
const SalesReportCard = createQWebReactComponent("qweb.report.sales");
const PipelineCard = createQWebReactComponent("qweb.report.pipeline");
```

**4. 模板复用** ✅

可以复用 Odoo 后端的报表模板，无需重新实现：

```typescript
// 复用 Odoo 后端的报表模板
const reportHtml = qwebEngine.render("sale.order.report", orderData);
```

**5. 服务端渲染（SSR）** ✅

在 Node.js 服务端可以使用 QWeb 生成 HTML：

```typescript
// 服务端渲染
const html = qwebEngine.render("report.template", data);
// 可以转换为 PDF 或直接返回 HTML
```

**QWeb 的使用场景划分**：

| 场景                        | 是否使用 QWeb   | 说明                                         |
| --------------------------- | --------------- | -------------------------------------------- |
| **列表视图（List View）**   | ❌ 不使用       | 使用 React 组件直接渲染                      |
| **表单视图（Form View）**   | ❌ 不使用       | 使用 React 组件直接渲染                      |
| **看板视图（Kanban View）** | ⚠️ **部分使用** | **特殊例外**：卡片内容使用 QWeb 模板定义布局 |
| **报表模板**                | ✅ 使用         | 需要 QWeb 模板生成 HTML/PDF                  |
| **邮件模板**                | ✅ 使用         | 需要 QWeb 模板生成邮件内容                   |
| **Dashboard 组件**          | ✅ 部分使用     | 某些展示组件使用 QWeb                        |
| **网站模板**                | ✅ 使用         | 网站页面可以使用 QWeb                        |

**⚠️ 重要说明：Kanban 视图的特殊性**

Kanban 视图是一个**特殊的例外情况**，因为 Odoo 的 Kanban 视图定义中，卡片布局是通过 QWeb 模板来定义的：

```xml
<kanban>
  <field name="name"/>
  <templates>
    <t t-name="card" class="row g-0">
      <main class="col-10">
        <field name="name"/>
        <span t-if="record.default_code.value">
          [<field name="default_code"/>]
        </span>
      </main>
    </t>
  </templates>
</kanban>
```

**为什么 Kanban 视图需要 QWeb？**

1. **Odoo 设计**：Odoo 的 Kanban 视图使用 `<templates>` 标签定义卡片布局，这是 Odoo 的标准设计
2. **灵活性需求**：不同模型的 Kanban 卡片布局差异很大，需要自定义 HTML 结构和样式
3. **条件渲染**：卡片中经常需要条件显示（如 `t-if`）
4. **Widget 支持**：卡片中需要渲染特殊 Widget（如 `widget="image"`）

**处理策略（AST 转换方案）**：

- **视图结构**（看板列、分组、拖拽）：使用 React 组件渲染（不使用 QWeb）
- **卡片内容**（卡片内部的 HTML 布局）：
  - 从 XML 中提取 `<templates>` 标签中的 QWeb 模板
  - 使用 QWeb 编译器将模板编译为 `CompiledNode` AST
  - 使用 `renderKanbanCardToReact` 函数将 AST 转换为 React 元素
  - 特殊处理 `<field>` 标签，转换为对应的 React 字段组件
  - 完全利用 React 虚拟 DOM，支持 React 的所有特性（事件处理、Hooks 等）

**技术优势**：

1. ✅ **完全利用 React 虚拟 DOM**：不是 HTML 字符串，而是真正的 React 元素
2. ✅ **数据绑定正常**：数据变化时 React 自动重新渲染
3. ✅ **事件处理正常**：可以使用 React 事件处理机制
4. ✅ **性能更好**：React 的 diff 算法只更新变化的部分
5. ✅ **类型安全**：TypeScript 支持完整

这样既保持了 React 的性能优势（视图结构），又能还原 Odoo 的自定义卡片布局（卡片内容）。

**为什么大部分视图组件不使用 QWeb？**

对于列表视图和表单视图：

1. **性能考虑**：React 虚拟 DOM 比 QWeb 的字符串拼接更高效
2. **类型安全**：React + TypeScript 提供更好的类型检查
3. **开发体验**：React 组件更容易调试和维护
4. **生态系统**：可以使用丰富的 React 生态库
5. **结构简单**：列表和表单的结构相对固定，可以用配置驱动的方式渲染

**为什么 Kanban 视图例外？**

Kanban 视图的卡片内容使用 QWeb 是因为：

1. **高度自定义**：每个模型的卡片布局差异很大，难以用固定组件覆盖
2. **Odoo 标准**：Odoo 的设计就是用 QWeb 模板定义卡片布局
3. **向后兼容**：需要能够正确还原 Odoo 定义的卡片模板
4. **混合策略 + AST 转换**：
   - 视图结构用 React（保持性能）
   - 卡片内容：QWeb 模板 AST → React 元素（兼顾灵活性和性能）
   - 避免了 HTML 字符串方案的性能问题，充分利用 React 虚拟 DOM

**为什么报表/邮件仍使用 QWeb？**

1. **模板复用**：可以复用 Odoo 后端的模板
2. **灵活性**：QWeb 模板更适合复杂的报表布局
3. **兼容性**：与 Odoo 后端保持一致
4. **服务端渲染**：可以在服务端生成 HTML/PDF

#### 详细对比

| 阶段         | Odoo 原生                 | 本项目 React（列表/表单）      | 本项目 React（看板）         |
| ------------ | ------------------------- | ------------------------------ | ---------------------------- |
| **视图定义** | XML（`ir.ui.view.arch`）  | XML（通过 RPC 加载）           | XML（通过 RPC 加载）         |
| **解析方式** | Odoo 后端解析 + QWeb 模板 | XML 解析器（`@xmldom/xmldom`） | XML 解析器 + QWeb 编译器     |
| **渲染方式** | QWeb 模板 + OWL 组件      | React 组件直接渲染             | QWeb AST → React 元素        |
| **模板引擎** | QWeb（JavaScript 实现）   | 不使用 QWeb                    | QWeb 编译器（AST 转换）      |
| **组件框架** | OWL（Odoo 自研）          | React（标准框架）              | React（标准框架）            |
| **数据绑定** | QWeb 表达式               | React Hooks + TanStack Query   | React Hooks + TanStack Query |
| **虚拟 DOM** | 无                        | React Virtual DOM              | React Virtual DOM            |

#### 实现示例

**1. 视图加载（相同）**

```typescript
// 两者都通过 RPC 加载视图定义
const { view, fields } = await loader.loadView(model, "list", {
  viewId,
  context,
});
// view.arch 包含 XML 视图定义
```

**2. 视图解析（不同）**

**Odoo 原生**：

```javascript
// OWL 组件使用 QWeb 模板
class ListView extends Component {
  static template = xml`
    <div class="o_list_view">
      <table>
        <tr t-foreach="props.records" t-as="record">
          <td t-esc="record.name"/>
        </tr>
      </table>
    </div>
  `;
}
```

**本项目 React（列表视图）**：

```typescript
// 解析 XML 为 React 配置
const { columns } = parseListView(view.arch, fields)

// React 组件直接渲染
export const OdooListView: React.FC<OdooListViewProps> = ({ ... }) => {
  const { columns, records } = useOdooListView({ ... })

  return (
    <Table>
      {records.map(record => (
        <TableRow key={record.id}>
          {columns.map(col => (
            <TableCell>{formatFieldValue(record[col.name], col)}</TableCell>
          ))}
        </TableRow>
      ))}
    </Table>
  )
}
```

**本项目 React（看板视图 - AST 转换方案）**：

```typescript
// 解析 XML，提取并编译 QWeb 模板
const parse = parseKanbanView(view.arch, fields)
// parse.cardTemplateAst 包含编译后的 QWeb AST

// React 组件渲染
export const KanbanCard: React.FC<KanbanCardProps> = ({
  record,
  cardTemplateAst,
  fields,
  model,
  rpcClient,
}) => {
  const cardContent = useMemo(() => {
    if (cardTemplateAst) {
      // 将 QWeb AST 转换为 React 元素
      return renderKanbanCardToReact(cardTemplateAst, {
        fields,
        record,
        model,
        rpcClient,
      })
    }
    // 向后兼容：默认布局
    return <DefaultCardLayout record={record} />
  }, [cardTemplateAst, record, fields])

  return <Card>{cardContent}</Card>
}

// renderKanbanCardToReact 函数：
// - 将 QWeb CompiledNode AST 转换为 React 元素
// - 处理 t-if、t-foreach 等 QWeb 指令
// - 特殊处理 <field> 标签，转换为 React 字段组件
```

**3. 数据获取（不同）**

**Odoo 原生**：

```javascript
// OWL 组件通过 env 获取数据
class ListView extends Component {
  setup() {
    this.records = useService('orm').searchRead(...)
  }
}
```

**本项目 React**：

```typescript
// 使用 TanStack Query 管理数据
const { records, isLoading } = useOdooListView({
  rpcClient,
  model,
  viewId,
  domain,
});
```

#### 优势与权衡

**本项目的优势**：

1. ✅ **标准化**：使用 React 标准框架，易于招聘和维护
2. ✅ **类型安全**：TypeScript 提供完整的类型检查
3. ✅ **生态系统**：可以使用丰富的 React 生态库
4. ✅ **性能优化**：React Virtual、TanStack Query 等现代工具
5. ✅ **开发体验**：更好的 IDE 支持和调试工具

**本项目的权衡**：

1. ⚠️ **QWeb 模板不支持**：无法直接使用 Odoo 的 QWeb 模板（但视图定义仍支持）
2. ⚠️ **需要重新实现**：视图渲染逻辑需要手动实现
3. ⚠️ **兼容性**：与 Odoo 原生视图扩展的兼容性需要额外处理

**QWeb 模板的使用场景**：

- ✅ **报表模板**：本项目仍可使用 QWeb 模板（通过 `libs/qwebjs`）
- ✅ **邮件模板**：可以使用 QWeb 模板
- ✅ **看板视图卡片**：使用 QWeb 模板（通过 AST 转换方案，转换为 React 元素）
- ❌ **列表/表单视图**：不使用 QWeb，改用 React 组件（配置驱动）

#### 总结

```
Odoo 原生：
视图定义（XML） → QWeb 模板 → OWL 组件 → DOM

本项目 React（列表/表单视图）：
视图定义（XML） → XML 解析 → React 配置 → React 组件 → DOM

本项目 React（看板视图）：
视图定义（XML） → XML 解析 → 提取 QWeb 模板 → 编译为 AST → React 元素转换 → React 组件 → DOM
```

#### 💡 核心理解：同一个 React 组件，不同的配置，不同的渲染结果

**你的理解完全正确！** 这是一个非常重要的设计理念：

**同一个 React 组件**（如 `OdooListView`）可以根据不同的 XML 视图定义，生成不同的配置，从而渲染出不同的结果。

**工作流程**：

```
不同的 XML 视图定义
    ↓
生成不同的 React 配置（columns）
    ↓
同一个 React 组件（OdooListView）
    ↓
根据配置渲染出不同的表格
```

**实际示例**：

**示例 1：销售订单列表视图**

```xml
<!-- XML 视图定义 A -->
<tree string="Sales Orders">
  <field name="name"/>
  <field name="date_order"/>
  <field name="partner_id"/>
  <field name="amount_total"/>
</tree>
```

**生成的配置**：

```typescript
const columnsA = [
  { name: "name", label: "订单号" },
  { name: "date_order", label: "订单日期" },
  { name: "partner_id", label: "客户" },
  { name: "amount_total", label: "总金额" },
];
```

**示例 2：产品列表视图**

```xml
<!-- XML 视图定义 B -->
<tree string="Products">
  <field name="name"/>
  <field name="list_price"/>
  <field name="qty_available"/>
  <field name="categ_id"/>
</tree>
```

**生成的配置**：

```typescript
const columnsB = [
  { name: "name", label: "产品名称" },
  { name: "list_price", label: "售价" },
  { name: "qty_available", label: "库存" },
  { name: "categ_id", label: "分类" },
];
```

**使用同一个组件渲染**：

```typescript
// 同一个组件，不同的配置
<OdooListView
  model="sale.order"
  viewId={viewIdA}  // 使用视图 A
  // 内部会生成 columnsA，渲染销售订单表格
/>

<OdooListView
  model="product.product"
  viewId={viewIdB}  // 使用视图 B
  // 内部会生成 columnsB，渲染产品表格
/>
```

**组件内部实现**：

```typescript
export const OdooListView: React.FC<OdooListViewProps> = ({ ... }) => {
  // 1. 根据 viewId 加载不同的 XML
  const { columns, records } = useOdooListView({
    model,
    viewId,  // 不同的 viewId 对应不同的 XML
    ...
  })

  // 2. 同一个组件，根据不同的 columns 渲染
  return (
    <Table>
      <TableHeader>
        {columns.map(col => (
          <TableHead key={col.name}>{col.label}</TableHead>
        ))}
      </TableHeader>
      <TableBody>
        {records.map(record => (
          <TableRow key={record.id}>
            {columns.map(col => (  // 根据 columns 动态渲染列
              <TableCell key={col.name}>
                {formatFieldValue(record[col.name], col)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**关键优势**：

1. **组件复用**：一个组件可以处理所有列表视图
2. **配置驱动**：通过 XML 配置控制渲染，无需修改组件代码
3. **动态加载**：可以根据不同的 viewId 动态加载不同的视图配置
4. **易于扩展**：新增视图只需定义 XML，无需修改组件

**对比 Odoo 原生**：

**Odoo 原生**：

- 每个视图类型可能有不同的 OWL 组件
- 每个组件有自己的 QWeb 模板
- 需要为不同的视图编写不同的组件和模板

**本项目**：

- 同一个 React 组件处理所有同类型视图
- 通过 XML 配置控制渲染
- 更少的代码，更高的复用性

**总结**：

✅ **你的理解完全正确**：

- XML 不同 → 配置不同 → 渲染结果不同
- 但都是同一个 React 组件渲染出来的
- 这是**配置驱动**的设计模式

**核心差异**：

- **原生**：视图定义 + QWeb 模板双重机制
- **本项目**：仅使用视图定义，直接转换为 React，不使用 QWeb 模板

**关键点**：

- **视图定义**：描述"视图应该包含哪些字段，如何布局"
- **QWeb 模板**：描述"如何将这些字段渲染成 HTML"

#### ⚠️ 重要澄清：Odoo 原生视图模板数据对本项目的作用

**对于视图而言，Odoo 原生的模板数据分为两类**：

**1. 视图定义（XML）** ✅ **有用**

视图定义存储在 `ir.ui.view.arch` 字段中，对本项目**非常有用**：

```xml
<!-- Odoo 原生的视图定义 -->
<tree string="Sales Orders">
  <field name="name"/>
  <field name="date_order"/>
  <field name="partner_id"/>
  <field name="amount_total"/>
</tree>
```

**本项目如何使用**：

```typescript
// 1. 通过 RPC 加载视图定义
const { view } = await loader.loadView(model, "list");
// view.arch 包含上述 XML

// 2. 解析为 AST
const { root } = parseViewArch(view.arch);

// 3. 转换为 React 配置
const { columns } = parseListView(view.arch, fields);
// columns = [
//   { name: "name", label: "名称" },
//   { name: "date_order", label: "订单日期" },
//   ...
// ]
```

**2. OWL 组件的 QWeb 模板** ❌ **没有用**

OWL 组件使用的 QWeb 模板（如 `web.ListView`、`web.FormView`）对本项目**没有作用**：

```xml
<!-- Odoo 原生的 OWL 组件 QWeb 模板 -->
<t t-name="web.ListView">
  <div class="o_list_view">
    <table>
      <tr t-foreach="props.records" t-as="record">
        <td t-esc="record.name"/>
      </tr>
    </table>
  </div>
</t>
```

**为什么没有用**：

- 本项目使用 React 组件直接渲染，不需要这些 QWeb 模板
- React 组件有自己的渲染逻辑，不依赖 OWL 的 QWeb 模板
- 这些模板是为 OWL 框架设计的，与 React 不兼容

**总结**：

| 数据类型               | 存储位置                 | 对本项目的作用 | 说明                             |
| ---------------------- | ------------------------ | -------------- | -------------------------------- |
| **视图定义（XML）**    | `ir.ui.view.arch`        | ✅ **有用**    | 用于生成 React 配置              |
| **OWL 组件 QWeb 模板** | Assets Bundle XML        | ❌ **没用**    | 本项目不使用 OWL，不需要这些模板 |
| **报表 QWeb 模板**     | `ir.ui.view` 或 XML 文件 | ✅ **有用**    | 用于报表生成（通过 libs/qwebjs） |
| **邮件 QWeb 模板**     | `ir.ui.view` 或 XML 文件 | ✅ **有用**    | 用于邮件生成（通过 libs/qwebjs） |

**实际影响**：

1. **视图定义可以复用** ✅
   - 可以从 Odoo 后端加载视图定义
   - 可以解析视图定义生成 React 配置
   - 无需重新定义视图结构

2. **OWL 模板无法复用** ❌
   - OWL 组件的 QWeb 模板对本项目没有用
   - 需要重新实现 React 组件来渲染视图
   - 但视图定义的结构信息仍然有用

**示例对比**：

**Odoo 原生需要的数据**：

```xml
<!-- 视图定义（有用） -->
<tree>
  <field name="name"/>
  <field name="date"/>
</tree>

<!-- OWL 组件模板（没用） -->
<t t-name="web.ListView">
  <div class="o_list_view">...</div>
</t>
```

**本项目实际使用的数据**：

```typescript
// ✅ 使用视图定义
const { view } = await loader.loadView(model, 'list')
const { columns } = parseListView(view.arch, fields)

// ❌ 不使用 OWL 模板
// 直接使用 React 组件渲染
<OdooListView columns={columns} records={records} />
```

### Odoo 模板的用途

Odoo 中的 QWeb 模板主要用于以下场景：

1. **前端界面渲染**
   - OWL 组件模板（渲染视图组件）
   - 动态视图渲染
   - 自定义组件模板

2. **报表生成**
   - HTML 报表
   - PDF 报表（通过 HTML → PDF 转换）
   - 邮件模板

3. **网站构建**
   - 网站页面模板
   - 网站组件模板
   - 主题定制

### Odoo 模板的存储位置

Odoo 模板可以存储在以下位置：

1. **XML 文件**（模块中）

   ```
   my_module/
   ├── views/
   │   └── templates.xml      # QWeb 模板定义
   └── report/
       └── report_templates.xml  # 报表模板
   ```

2. **数据库**（`ir.ui.view` 模型）
   - 通过界面创建和编辑的模板
   - 动态生成的模板
   - 继承和扩展的模板
   - **注意**：`ir.ui.view` 既存储视图定义，也存储 QWeb 模板

### Odoo 模板的类型

| 模板类型         | 用途               | 是否使用 QWeb | 示例                           |
| ---------------- | ------------------ | ------------- | ------------------------------ |
| **视图组件模板** | 渲染视图组件的显示 | ✅ 是         | `web.ListView`, `web.FormView` |
| **报表模板**     | 生成报表内容       | ✅ 是         | 销售订单报表、发票报表         |
| **邮件模板**     | 生成邮件内容       | ✅ 是         | 订单确认邮件、通知邮件         |
| **网站模板**     | 网站页面和组件     | ✅ 是         | 首页、产品页面                 |
| **视图定义**     | 定义视图结构       | ❌ 否         | `<tree>`, `<form>` 视图定义    |

**总结**：

- **视图定义**：使用标准 XML，定义视图结构（不是 QWeb 模板）
- **QWeb 模板**：使用 QWeb 语法，用于渲染动态内容（是模板）

---

## QWeb 是什么

### 定义

**QWeb** 是 Odoo 自研的 XML 模板引擎，是 Odoo 模板系统的核心。它提供了：

- **统一的模板语法**：前后端使用相同的语法
- **强大的指令系统**：条件、循环、变量、继承等
- **灵活的扩展机制**：模板继承、组合、调用
- **安全的表达式求值**：防止代码注入

### QWeb 的双重实现

QWeb 在 Odoo 中有两个实现：

#### 1. Python 端实现（服务器端）

- **代码位置**: `odoo/odoo/tools/qweb.py`
- **用途**:
  - 报表生成（HTML → PDF）
  - 邮件模板渲染
  - 服务器端 HTML 生成
- **特点**:
  - 在 Python 环境中执行
  - 可以访问 ORM 模型和业务逻辑
  - 支持 Python 表达式

#### 2. JavaScript 端实现（客户端）

- **代码位置**: `odoo/addons/web/static/src/core/qweb/qweb.js`
- **用途**:
  - 前端组件模板
  - 动态视图渲染
  - OWL 框架集成
- **特点**:
  - 在浏览器中执行
  - 与前端框架集成
  - 支持 JavaScript 表达式

#### 3. Node.js 实现（本项目）

- **代码位置**: `libs/qwebjs/`
- **用途**:
  - 前端应用中的模板渲染
  - React 组件集成
  - 独立的模板引擎
  - **HTML 生成**（可用于后续 PDF 转换）
- **特点**:
  - 兼容 Odoo QWeb 语法
  - 支持 TypeScript
  - 可独立使用
- **与 Odoo 原生 QWeb 的差异**：
  - ✅ **支持**：模板渲染、模板继承、所有 QWeb 指令
  - ⚠️ **缺失**：**直接的 PDF 生成能力**（Odoo 原生使用 wkhtmltopdf/WeasyPrint）
  - 💡 **替代方案**：
    1. **使用 Puppeteer/Playwright**：将 QWeb 生成的 HTML 转换为 PDF
    2. **使用其他 PDF 库**：如 pdfkit、jsPDF（功能有限）
    3. **调用后端接口**：继续使用 Odoo 后端的 PDF 生成能力（当前项目采用此方案）
    4. **使用 WeasyPrint Node.js 绑定**：如果可用的话

**PDF 生成对比**：

| 特性          | Odoo 原生 QWeb                    | 本项目 qwebjs            |
| ------------- | --------------------------------- | ------------------------ |
| **HTML 生成** | ✅ 支持                           | ✅ 支持                  |
| **PDF 生成**  | ✅ 内置（wkhtmltopdf/WeasyPrint） | ❌ 不内置                |
| **报表模板**  | ✅ 完整支持                       | ✅ 完整支持（生成 HTML） |
| **PDF 转换**  | ✅ 自动                           | ⚠️ 需要额外工具          |

**实际使用建议**：

- 对于**前端预览**：使用 qwebjs 生成 HTML 即可
- 对于**PDF 下载**：可以调用后端接口（如当前实现），或使用 Puppeteer 在前端生成
- 对于**服务端渲染**：在 Node.js 服务端使用 Puppeteer 将 HTML 转换为 PDF

### QWeb 的核心特性

1. **XML 语法**：基于 XML，易于阅读和维护
2. **指令系统**：通过 `t-*` 属性提供丰富的功能
3. **表达式求值**：支持 Python/JavaScript 风格的表达式
4. **模板继承**：通过 `inherit_id` + `xpath` 实现模板扩展
5. **模板调用**：通过 `t-call` 实现模板组合和复用
6. **国际化支持**：通过 `t-translation` 实现多语言
7. **资产注入**：通过 `t-call-assets` 注入前端资源

---

## QWeb 基础语法

### 模板定义

使用 `<t t-name="template.name">` 定义模板：

```xml
<t t-name="my.template">
  <div>
    <h1>Hello, World!</h1>
  </div>
</t>
```

**要点**：

- `t-name` 是模板的唯一标识符
- 模板名称通常使用点号分隔（如 `module.template_name`）
- 模板内容可以是任意 HTML/XML 结构

### 变量插值

#### t-esc：转义输出（推荐）

```xml
<div>
  <h1 t-esc="title"/>
  <p t-esc="description"/>
</div>
```

- **安全性**：自动转义 HTML 特殊字符，防止 XSS 攻击
- **用法**：用于输出用户输入或动态内容
- **示例**：如果 `title` 是 `"<script>alert('xss')</script>"`，会被转义为 `&lt;script&gt;...`

#### t-raw：原样输出（谨慎使用）

```xml
<div t-raw="htmlContent"/>
```

- **安全性**：不转义，直接输出 HTML
- **风险**：可能导致 XSS 攻击
- **用法**：仅用于可信的 HTML 内容（如系统生成的 HTML）

### 条件渲染

#### t-if：条件判断

```xml
<div t-if="user.isAdmin">
  <p>管理员面板</p>
</div>
```

#### t-elif：否则如果

```xml
<div t-if="user.role === 'admin'">
  <p>管理员</p>
</div>
<div t-elif="user.role === 'user'">
  <p>普通用户</p>
</div>
<div t-else="">
  <p>访客</p>
</div>
```

**表达式求值**：

- `t-if="true"` → 渲染
- `t-if="false"` → 不渲染
- `t-if="0"` → 不渲染（假值）
- `t-if="1"` → 渲染（真值）
- `t-if="''"` → 不渲染（空字符串）
- `t-if="'text'"` → 渲染（非空字符串）

### 循环渲染

#### t-foreach：遍历数组

```xml
<ul>
  <li t-foreach="items" t-as="item" t-esc="item"/>
</ul>
```

**上下文变量**：

- `item`：当前元素
- `item_index`：当前索引（从 0 开始）
- `item_first`：是否为第一个元素
- `item_last`：是否为最后一个元素
- `item_value`：当前值（用于对象遍历）
- `item_key`：当前键（用于对象遍历）

#### 遍历对象

```xml
<ul>
  <li t-foreach="users" t-as="user">
    <span t-esc="user_key"/>: <span t-esc="user_value.name"/>
  </li>
</ul>
```

---

## QWeb 核心指令详解

### 属性绑定

#### t-att-\*：动态属性

```xml
<div t-att-class="isActive ? 'active' : 'inactive'"
     t-att-id="'item-' + itemId"
     t-att-data-value="value"/>
```

**生成结果**：

```html
<div class="active" id="item-123" data-value="hello" />
```

#### t-attf-\*：格式化属性

```xml
<div t-attf-class="item #{item.type} #{item.status}"/>
```

**生成结果**（假设 `item.type = "card"`, `item.status = "active"`）：

```html
<div class="item card active" />
```

**占位符语法**：

- `#{expr}`：表达式求值
- `##`：转义的 `#`

### 变量设置

#### t-set：设置变量

```xml
<t t-set="fullName" t-value="firstName + ' ' + lastName"/>
<p t-esc="fullName"/>
```

#### t-value：变量值

```xml
<t t-set="count" t-value="items.length"/>
<p t-esc="count"/> 个项目
```

**变量作用域**：

- 变量在当前模板及其子模板中可用
- 子模板可以访问父模板的变量
- 子模板的变量不会影响父模板

### 模板调用

#### t-call：调用其他模板

```xml
<t t-call="base.template">
  <t t-set="title" t-value="'Custom Title'"/>
</t>
```

**被调用的模板**：

```xml
<t t-name="base.template">
  <div>
    <h1 t-esc="title"/>
  </div>
</t>
```

#### t-context：传递上下文

```xml
<t t-call="user.card" t-context="{'user': currentUser, 'showEmail': true}"/>
```

### 资产注入

#### t-call-assets：注入前端资源

```xml
<t t-call-assets="'web.assets_frontend'"/>
```

**详细说明**：参见 [资产培训教程](./assets-tutorial.md)

### 国际化

#### t-translation：翻译控制

```xml
<!-- 默认：翻译文本内容 -->
<div t-translation="translate">
  <p t-esc="message"/>  <!-- 会被翻译 -->
</div>

<!-- 仅翻译属性 -->
<div t-translation="attributes">
  <img t-att-alt="text"/>  <!-- alt 属性会被翻译 -->
</div>

<!-- 不翻译 -->
<div t-translation="off">
  <p t-esc="message"/>  <!-- 不会被翻译 -->
</div>
```

---

## 模板继承机制

### 什么是模板继承？

**模板继承**允许你扩展现有模板，而无需复制整个模板。这是 Odoo 模板系统最强大的特性之一。

### 继承语法

```xml
<t t-name="child.template" t-inherit="parent.template" t-inherit-mode="extension">
  <xpath expr="//div[@class='content']" position="inside">
    <p>新增内容</p>
  </xpath>
</t>
```

### 继承模式

#### extension（扩展模式，默认）

在现有模板基础上添加或修改内容：

```xml
<t t-name="sale.order.form" t-inherit="sale.order.form" t-inherit-mode="extension">
  <xpath expr="//field[@name='partner_id']" position="after">
    <field name="custom_field"/>
  </xpath>
</t>
```

#### primary（主要模式）

完全替换父模板，但保留继承链：

```xml
<t t-name="custom.template" t-inherit="base.template" t-inherit-mode="primary">
  <!-- 完全重写模板 -->
  <div>新内容</div>
</t>
```

### XPath 表达式

XPath 用于定位模板中的元素：

#### 常用 XPath 表达式

| XPath                  | 说明                     | 示例                          |
| ---------------------- | ------------------------ | ----------------------------- |
| `//tag`                | 选择所有 tag 元素        | `//div`                       |
| `//tag[@attr='value']` | 选择属性匹配的元素       | `//div[@class='content']`     |
| `//tag[@name='value']` | 选择 name 属性匹配的元素 | `//field[@name='partner_id']` |
| `//tag[1]`             | 选择第一个匹配的元素     | `//div[1]`                    |
| `//tag[last()]`        | 选择最后一个匹配的元素   | `//div[last()]`               |

#### XPath 示例

```xml
<!-- 在指定元素后插入 -->
<xpath expr="//field[@name='date_order']" position="after">
  <field name="custom_date"/>
</xpath>

<!-- 在指定元素内插入 -->
<xpath expr="//div[@class='header']" position="inside">
  <span>新标题</span>
</xpath>

<!-- 替换指定元素 -->
<xpath expr="//div[@class='old']" position="replace">
  <div class="new">新内容</div>
</xpath>

<!-- 在指定元素前插入 -->
<xpath expr="//div[@class='footer']" position="before">
  <div class="before-footer">前置内容</div>
</xpath>
```

### position 属性

| position  | 说明                   | 效果                              |
| --------- | ---------------------- | --------------------------------- |
| `inside`  | 在目标元素内部末尾插入 | `<div><原有内容/><新内容/></div>` |
| `replace` | 替换目标元素           | `<新内容/>`                       |
| `before`  | 在目标元素之前插入     | `<新内容/><目标元素/>`            |
| `after`   | 在目标元素之后插入     | `<目标元素/><新内容/>`            |

### 继承链

模板可以形成继承链：

```xml
<!-- 基础模板 -->
<t t-name="base.template">
  <div class="base">基础内容</div>
</t>

<!-- 第一层继承 -->
<t t-name="level1.template" t-inherit="base.template">
  <xpath expr="//div[@class='base']" position="inside">
    <span>第一层</span>
  </xpath>
</t>

<!-- 第二层继承 -->
<t t-name="level2.template" t-inherit="level1.template">
  <xpath expr="//div[@class='base']" position="inside">
    <span>第二层</span>
  </xpath>
</t>
```

**最终结果**：

```html
<div class="base">
  基础内容
  <span>第一层</span>
  <span>第二层</span>
</div>
```

---

## 模板调用与组合

### t-call：模板调用

`t-call` 用于在模板中调用其他模板，实现模板的组合和复用。

#### 基本用法

```xml
<t t-name="page.template">
  <div class="page">
    <t t-call="header.template"/>
    <div class="content">
      <p>页面内容</p>
    </div>
    <t t-call="footer.template"/>
  </div>
</t>
```

#### 传递变量

```xml
<t t-call="user.card">
  <t t-set="user" t-value="currentUser"/>
  <t t-set="showEmail" t-value="true"/>
</t>
```

#### t-context：传递上下文对象

```xml
<t t-call="report.template" t-context="{'records': records, 'company': company}"/>
```

### 模板组合模式

#### 1. 包含模式（Include）

将其他模板的内容包含到当前模板：

```xml
<t t-name="main.template">
  <div>
    <t t-call="sidebar.template"/>
    <div class="main-content">
      <!-- 主内容 -->
    </div>
  </div>
</t>
```

#### 2. 布局模式（Layout）

定义页面布局，内容由调用方提供：

```xml
<!-- 布局模板 -->
<t t-name="layout.template">
  <html>
    <head>
      <title t-esc="title"/>
    </head>
    <body>
      <div class="content">
        <!-- 内容由调用方提供 -->
      </div>
    </body>
  </html>
</t>

<!-- 使用布局 -->
<t t-call="layout.template">
  <t t-set="title" t-value="'My Page'"/>
  <div class="content">
    <p>实际内容</p>
  </div>
</t>
```

#### 3. 组件模式（Component）

创建可复用的组件模板：

```xml
<!-- 按钮组件 -->
<t t-name="button.component">
  <button t-att-class="'btn btn-' + type" t-att-disabled="disabled">
    <t t-esc="label"/>
  </button>
</t>

<!-- 使用组件 -->
<t t-call="button.component">
  <t t-set="type" t-value="'primary'"/>
  <t t-set="label" t-value="'Submit'"/>
  <t t-set="disabled" t-value="false"/>
</t>
```

---

## 表达式与变量

### 表达式语法

QWeb 支持类似 Python/JavaScript 的表达式语法：

#### 属性访问

```xml
<p t-esc="user.name"/>
<p t-esc="order.lines[0].product.name"/>
```

#### 方法调用

```xml
<p t-esc="items.length"/>
<p t-esc="formatCurrency(amount)"/>
```

#### 运算符

```xml
<!-- 算术运算符 -->
<p t-esc="price * quantity"/>
<p t-esc="total / items.length"/>

<!-- 比较运算符 -->
<div t-if="count > 0">有内容</div>
<div t-if="status === 'active'">激活</div>

<!-- 逻辑运算符 -->
<div t-if="isAdmin and hasPermission">显示</div>
<div t-if="isEmpty or isError">错误</div>

<!-- 三元运算符 -->
<p t-esc="isActive ? '激活' : '未激活'"/>
```

#### 字符串操作

```xml
<p t-esc="'Hello, ' + userName"/>
<p t-esc="firstName + ' ' + lastName"/>
```

### 变量作用域

#### 全局变量

传递给 `render()` 方法的上下文变量：

```typescript
engine.render("template", {
  user: { name: "John" },
  items: [1, 2, 3],
});
```

#### 局部变量

通过 `t-set` 设置的变量：

```xml
<t t-set="localVar" t-value="'local'"/>
<p t-esc="localVar"/>  <!-- 可用 -->
```

#### 循环变量

在 `t-foreach` 循环中：

```xml
<li t-foreach="items" t-as="item">
  <span t-esc="item"/>        <!-- 当前元素 -->
  <span t-esc="item_index"/>  <!-- 索引 -->
  <span t-esc="item_first"/>  <!-- 是否第一个 -->
</li>
```

### 内置变量

QWeb 提供了一些内置变量：

| 变量                | 说明                       | 示例                    |
| ------------------- | -------------------------- | ----------------------- |
| `_`                 | 下划线（用于某些特殊场景） | -                       |
| `true`, `false`     | 布尔值                     | `t-if="true"`           |
| `null`, `undefined` | 空值                       | `t-if="value !== null"` |

---

## 实际应用场景

### 场景 1：报表模板

```xml
<t t-name="sale.order.report">
  <t t-call-assets="'web.report_assets_common'"/>
  <t t-call-assets="'web.report_assets_pdf'"/>

  <div class="report">
    <div class="header">
      <h1>销售订单</h1>
      <p t-esc="company.name"/>
    </div>

    <div class="content">
      <table>
        <thead>
          <tr>
            <th>产品</th>
            <th>数量</th>
            <th>单价</th>
            <th>小计</th>
          </tr>
        </thead>
        <tbody>
          <tr t-foreach="order.lines" t-as="line">
            <td t-esc="line.product.name"/>
            <td t-esc="line.quantity"/>
            <td t-esc="formatCurrency(line.price_unit)"/>
            <td t-esc="formatCurrency(line.price_subtotal)"/>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">总计</td>
            <td t-esc="formatCurrency(order.amount_total)"/>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</t>
```

### 场景 2：邮件模板

```xml
<t t-name="order.confirmation.email">
  <div class="email">
    <h1>订单确认</h1>
    <p>尊敬的 <t t-esc="customer.name"/>，</p>
    <p>您的订单 <strong t-esc="order.name"/></strong> 已确认。</p>

    <div t-if="order.lines.length > 0">
      <h2>订单明细</h2>
      <ul>
        <li t-foreach="order.lines" t-as="line">
          <t t-esc="line.product.name"/> × <t t-esc="line.quantity"/>
        </li>
      </ul>
    </div>

    <p>总金额：<strong t-esc="formatCurrency(order.amount_total)"/></p>
  </div>
</t>
```

### 场景 3：前端组件模板

```xml
<t t-name="user.card.component">
  <div class="user-card" t-att-class="'user-card-' + user.role">
    <div class="avatar">
      <img t-att-src="user.avatar" t-att-alt="user.name"/>
    </div>
    <div class="info">
      <h3 t-esc="user.name"/>
      <p t-esc="user.email"/>
      <div t-if="user.isOnline" class="status online">在线</div>
      <div t-else="" class="status offline">离线</div>
    </div>
  </div>
</t>
```

### 场景 4：模板继承扩展

```xml
<!-- 扩展销售订单表单 -->
<t t-name="sale.order.form" t-inherit="sale.order.form" t-inherit-mode="extension">
  <!-- 在客户字段后添加自定义字段 -->
  <xpath expr="//field[@name='partner_id']" position="after">
    <field name="custom_partner_type"/>
  </xpath>

  <!-- 在订单行中添加自定义列 -->
  <xpath expr="//field[@name='order_line']//field[@name='product_id']" position="after">
    <field name="custom_product_code"/>
  </xpath>
</t>
```

---

## 最佳实践

### 1. 安全性

#### ✅ 使用 t-esc 而非 t-raw

```xml
<!-- ✅ 推荐：自动转义 -->
<p t-esc="userInput"/>

<!-- ❌ 不推荐：可能导致 XSS -->
<p t-raw="userInput"/>
```

#### ✅ 验证用户输入

即使使用 `t-esc`，也应该在业务逻辑层验证输入。

### 2. 性能优化

#### ✅ 避免深层嵌套

```xml
<!-- ✅ 推荐：扁平结构 -->
<div t-foreach="items" t-as="item">
  <span t-esc="item.name"/>
</div>

<!-- ❌ 不推荐：深层嵌套 -->
<div t-foreach="categories" t-as="category">
  <div t-foreach="category.items" t-as="item">
    <div t-foreach="item.tags" t-as="tag">
      <span t-esc="tag.name"/>
    </div>
  </div>
</div>
```

#### ✅ 使用模板缓存

```typescript
const engine = new QWebEngine({
  cacheEnabled: true, // 启用缓存
});
```

### 3. 可维护性

#### ✅ 使用有意义的模板名称

```xml
<!-- ✅ 推荐 -->
<t t-name="sale.order.report.header"/>

<!-- ❌ 不推荐 -->
<t t-name="header1"/>
```

#### ✅ 使用模板继承而非复制

```xml
<!-- ✅ 推荐：继承扩展 -->
<t t-name="custom.template" t-inherit="base.template">
  <xpath expr="//div" position="inside">
    <p>扩展内容</p>
  </xpath>
</t>

<!-- ❌ 不推荐：复制整个模板 -->
<t t-name="custom.template">
  <!-- 复制整个模板内容 -->
</t>
```

#### ✅ 将复杂逻辑移到业务层

```xml
<!-- ✅ 推荐：模板中只做展示 -->
<p t-esc="formatCurrency(amount)"/>

<!-- ❌ 不推荐：模板中包含复杂计算 -->
<p t-esc="(price * quantity * (1 + tax_rate)) - discount"/>
```

### 4. 代码组织

#### ✅ 按功能模块组织模板

```
my_module/
├── views/
│   ├── sale_templates.xml      # 销售相关模板
│   └── report_templates.xml    # 报表模板
└── report/
    └── sale_report_templates.xml
```

#### ✅ 使用注释说明模板用途

```xml
<!--
  销售订单报表模板
  用途：生成销售订单的 PDF 报表
  依赖：sale.order 模型
-->
<t t-name="sale.order.report">
  <!-- 模板内容 -->
</t>
```

### 5. 调试技巧

#### ✅ 使用调试模式

```typescript
const engine = new QWebEngine({
  debug: true, // 启用调试模式
});
```

#### ✅ 检查模板继承链

在调试模式下，可以查看模板的继承关系。

#### ✅ 验证表达式

在模板中使用表达式前，先在业务逻辑中验证表达式是否正确。

---

## 常见问题与调试

### Q1: 模板未找到错误

**错误信息**：`Template "xxx" not found`

**可能原因**：

1. 模板名称拼写错误
2. 模板未注册
3. 模板在错误的模块中

**解决方法**：

1. 检查模板名称是否正确
2. 确认模板已通过 `registerTemplate()` 注册
3. 检查模块加载顺序

### Q2: 变量未定义

**错误信息**：`Variable "xxx" is not defined`

**可能原因**：

1. 变量未传递给渲染上下文
2. 变量名拼写错误
3. 变量作用域问题

**解决方法**：

```typescript
// 确保变量在上下文中
engine.render("template", {
  user: { name: "John" }, // 确保 user 存在
});
```

### Q3: XPath 表达式无效

**错误信息**：`Invalid XPath expression`

**可能原因**：

1. XPath 语法错误
2. 目标元素不存在
3. XPath 表达式过于复杂

**解决方法**：

1. 使用简单的 XPath 表达式
2. 先验证目标元素是否存在
3. 使用浏览器开发者工具检查 DOM 结构

### Q4: 模板继承不生效

**可能原因**：

1. `inherit_id` 错误
2. XPath 表达式未匹配到元素
3. 模块加载顺序问题

**解决方法**：

1. 检查父模板名称是否正确
2. 验证 XPath 表达式
3. 检查模块依赖关系

### Q5: 表达式求值错误

**错误信息**：`Expression evaluation failed`

**可能原因**：

1. 表达式语法错误
2. 访问了不存在的属性
3. 类型不匹配

**解决方法**：

1. 简化表达式
2. 添加空值检查：`t-if="user and user.name"`
3. 在业务逻辑中预处理数据

### 调试技巧

#### 1. 启用调试模式

```typescript
const engine = new QWebEngine({
  debug: true,
  cacheEnabled: false, // 开发时禁用缓存
});
```

#### 2. 打印调试信息

```xml
<!-- 在模板中添加调试输出 -->
<div t-if="debug">
  <pre t-esc="JSON.stringify(context)"/>
</div>
```

#### 3. 检查渲染结果

```typescript
const html = engine.render("template", context);
console.log("Rendered HTML:", html);
```

#### 4. 验证模板结构

使用 XML 验证工具检查模板语法是否正确。

---

## 总结

### 核心概念

1. **Odoo 模板**：用于生成动态 HTML 的 XML 文件
2. **QWeb**：Odoo 的模板引擎，提供统一的模板语法
3. **模板继承**：通过 `inherit_id` + `xpath` 扩展模板
4. **模板调用**：通过 `t-call` 组合和复用模板
5. **表达式求值**：支持类似 Python/JavaScript 的表达式

### 关键要点

- ✅ 使用 `t-esc` 而非 `t-raw` 确保安全性
- ✅ 使用模板继承而非复制提高可维护性
- ✅ 将复杂逻辑移到业务层保持模板简洁
- ✅ 使用有意义的模板名称提高可读性
- ✅ 启用调试模式便于问题排查

### 下一步

- 阅读 [资产培训教程](./assets-tutorial.md) 了解资产系统
- 查看 [QWeb 库文档](../../libs/qwebjs/README.md) 了解 API
- 实践：创建自己的模板并集成到项目中

---

**文档状态**: 已完成  
**最后更新**: 2025-01-27  
**维护者**: L8 ERP 开发团队
