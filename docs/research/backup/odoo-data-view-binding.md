# Odoo 数据与视图绑定机制和原理

## 文档信息

- **创建日期**: 2025-01-XX
- **最后更新**: 2025-01-XX
- **状态**: 技术文档
- **相关文档**:
  - `docs/research/qweb-templates-tutorial.md` - QWeb 模板教程
  - `docs/research/assets-tutorial.md` - 资产系统教程
  - `docs/memo/assets-and-qweb-implementation.md` - 实现备忘录

---

## 目录

1. [概述](#概述)
2. [Odoo 原生机制](#odoo-原生机制)
3. [本项目实现机制](#本项目实现机制)
4. [数据流详解](#数据流详解)
5. [绑定原理分析](#绑定原理分析)
6. [对比总结](#对比总结)

---

## 概述

### 什么是数据与视图绑定？

**数据与视图绑定**是指将后端数据（模型记录）与前端视图（UI 组件）建立关联，实现数据的自动显示、编辑和同步更新的机制。

在 Odoo 中，数据与视图绑定涉及以下核心概念：

- **模型（Model）**：后端数据模型，定义数据结构（如 `res.partner`、`sale.order`）
- **视图（View）**：前端显示结构，定义如何展示数据（列表、表单、看板等）
- **字段（Field）**：数据模型的属性，定义数据类型和约束
- **记录（Record）**：模型的具体实例，包含实际数据

### 绑定的核心目标

1. **自动数据加载**：根据视图定义自动加载所需数据
2. **双向数据绑定**：视图变化自动更新数据，数据变化自动更新视图
3. **类型安全**：根据字段类型自动选择合适的组件
4. **权限控制**：根据用户权限控制数据的可见性和可编辑性

---

## Odoo 原生机制

### 架构概览

Odoo 原生系统使用 **OWL（Odoo Web Library）框架** 和 **QWeb 模板引擎** 实现数据与视图的绑定：

```
后端模型（Python ORM）
    ↓
RPC 接口（JSON-RPC）
    ↓
前端 OWL 组件
    ↓
QWeb 模板渲染
    ↓
DOM 更新
```

### 核心组件

#### 1. 后端模型（Model）

**位置**: `odoo/addons/*/models/*.py`

```python
from odoo import models, fields

class SaleOrder(models.Model):
    _name = 'sale.order'

    name = fields.Char(string='Order Reference', required=True)
    date_order = fields.Datetime(string='Order Date', required=True)
    partner_id = fields.Many2one('res.partner', string='Customer')
    amount_total = fields.Monetary(string='Total', compute='_compute_total')
```

**作用**：

- 定义数据结构
- 定义字段类型和约束
- 提供数据访问接口

#### 2. 视图定义（View Definition）

**位置**: `odoo/addons/*/views/*.xml` 或数据库 `ir.ui.view` 表

```xml
<!-- 列表视图定义 -->
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

<!-- 表单视图定义 -->
<record id="view_sale_order_form" model="ir.ui.view">
    <field name="name">sale.order.form</field>
    <field name="model">sale.order</field>
    <field name="arch" type="xml">
        <form string="Sales Order">
            <sheet>
                <group>
                    <field name="name"/>
                    <field name="date_order"/>
                    <field name="partner_id"/>
                </group>
                <group>
                    <field name="amount_total"/>
                </group>
            </sheet>
        </form>
    </field>
</record>
```

**作用**：

- 定义视图结构（哪些字段、如何布局）
- 存储在 `ir.ui.view` 表中
- 通过 RPC `get_views` 接口提供给前端

#### 3. OWL 组件（Component）

**位置**: `odoo/addons/web/static/src/views/*/list_view.js`

```javascript
import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";

export class ListView extends Component {
  static template = xml`
        <div class="o_list_view">
            <table>
                <thead>
                    <tr>
                        <th t-foreach="props.columns" t-as="col" t-key="col.id">
                            <t t-esc="col.string"/>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr t-foreach="props.records" t-as="record" t-key="record.id">
                        <td t-foreach="props.columns" t-as="col" t-key="col.id">
                            <Field t-props="getFieldProps(record, col)"/>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

  getFieldProps(record, column) {
    return {
      name: column.name,
      record: record,
      type: column.type,
    };
  }
}

registry.category("views").add("list", ListView);
```

**作用**：

- 使用 QWeb 模板定义组件结构
- 通过 `props` 接收数据和视图配置
- 使用 `Field` 组件渲染字段

#### 4. 数据加载流程

**OWL 组件的数据加载**：

```javascript
// 1. 组件挂载时加载视图定义
async onWillStart() {
    const { views, fields } = await this.orm.call(
        "ir.ui.view",
        "get_views",
        [[{
            model: this.props.model,
            views: [[false, "list"]],
        }]]
    );

    // 2. 解析视图定义
    this.view = views.list;
    this.fields = fields;

    // 3. 加载数据
    const records = await this.orm.searchRead(
        this.props.model,
        [],
        {
            fields: this.getFieldNames(),
            limit: 80,
        }
    );

    this.state.records = records;
}
```

### 绑定机制

#### 1. 视图定义 → 组件配置

```
XML 视图定义（ir.ui.view.arch）
    ↓
RPC: get_views
    ↓
OWL 组件接收视图配置
    ↓
解析为组件 props
```

#### 2. 数据加载 → 组件状态

```
用户操作（打开列表视图）
    ↓
OWL 组件 onWillStart
    ↓
RPC: search_read
    ↓
更新组件 state.records
    ↓
QWeb 模板自动重新渲染
```

#### 3. 字段渲染 → Field 组件

```
字段定义（fields_get）
    ↓
字段类型匹配
    ↓
选择合适的 Field 组件
    ↓
QWeb 模板渲染
```

#### 4. 数据更新 → 双向绑定

```
用户编辑字段
    ↓
Field 组件 onChange
    ↓
更新组件 state
    ↓
QWeb 模板重新渲染
    ↓
用户保存
    ↓
RPC: write
    ↓
后端更新数据库
```

### 关键特性

1. **声明式绑定**：通过 XML 视图定义声明数据绑定关系
2. **自动类型匹配**：根据字段类型自动选择 Field 组件
3. **响应式更新**：OWL 框架自动处理状态变化和视图更新
4. **模板驱动**：使用 QWeb 模板定义渲染逻辑

---

## 本项目实现机制

### 架构概览

本项目使用 **React 框架** 和 **TanStack Query** 实现数据与视图的绑定：

```
后端模型（Python ORM）
    ↓
RPC 接口（JSON-RPC）
    ↓
React Hooks（useOdooListView, useOdooFormView）
    ↓
TanStack Query（数据缓存和同步）
    ↓
React 组件渲染
    ↓
DOM 更新
```

### 核心组件

#### 1. 视图加载器（OdooViewLoader）

**位置**: `apps/web/src/lib/odoo-views/loader.ts`

```typescript
export class OdooViewLoader {
  constructor(private readonly rpcClient: OdooRpcClient) {}

  /**
   * 加载视图与字段定义
   */
  async loadView(
    model: string,
    viewType: OdooViewType,
    options: ViewLoadOptions = {},
  ): Promise<LoadViewResult> {
    // 1. 调用 RPC 获取视图定义
    const response = await this.rpcClient.executeKw<{
      fields: Record<string, OdooField>;
      views: Array<{
        id: number;
        type: string;
        arch: string;
        name?: string;
        model?: string;
      }>;
    }>(
      "ir.ui.view",
      "get_views",
      [
        [
          {
            model,
            views: [[viewId ?? false, viewType]],
            context,
          },
        ],
      ],
      {
        context,
        force_refresh: forceRefresh,
      },
    );

    // 2. 解析视图定义
    const viewPayload = response.views[0];
    const view: OdooView = {
      id: viewPayload.id,
      model: viewPayload.model || model,
      type: viewPayload.type as OdooViewType,
      arch: viewPayload.custom_arch || viewPayload.arch,
      fields: response.fields,
    };

    // 3. 解析 XML arch 为 AST
    if (loadArch) {
      const parseResult = parseViewArch(view.arch);
      view.archTree = parseResult.root;
    }

    return { view, fields: response.fields };
  }
}
```

**作用**：

- 封装视图和字段的加载逻辑
- 调用 RPC `get_views` 接口
- 解析 XML 视图定义为 AST

#### 2. 视图解析器（View Parser）

**位置**: `apps/web/src/lib/odoo-views/parsers/list-view.ts`

```typescript
export function parseListView(
  arch: string,
  fields: Record<string, OdooField>,
): { columns: ListColumn[] } {
  // 1. 解析 XML 为 AST
  const { root } = parseViewArch(arch);

  // 2. 查找 <tree> 节点
  const treeNode = findNode(root, "tree");
  if (!treeNode) {
    return { columns: [] };
  }

  // 3. 提取字段节点
  const fieldNodes = findNodes(treeNode, "field");

  // 4. 转换为列配置
  const columns: ListColumn[] = fieldNodes.map((node) => {
    const fieldName = node.attrs.name;
    const field = fields[fieldName];

    return {
      name: fieldName,
      label: field?.label || fieldName,
      type: field?.type || "char",
      width: node.attrs.width,
      sortable: node.attrs.sortable !== "0",
      // ... 其他属性
    };
  });

  return { columns };
}
```

**作用**：

- 将 XML 视图定义解析为 React 配置
- 提取字段信息和布局信息
- 生成组件可用的配置对象

#### 3. React Hooks（数据绑定）

**位置**: `apps/web/src/hooks/use-odoo-list-view.ts`

```typescript
export function useOdooListView(params: UseOdooListViewParams): UseOdooListViewResult {
  const { rpcClient, model, viewId, domain, context, limit, offset } = params;

  const loader = useMemo(() => new OdooViewLoader(rpcClient), [rpcClient]);

  // 1. 加载视图元数据（视图定义 + 字段定义）
  const metaQuery = useQuery({
    queryKey: ["odoo", "list-view", "meta", model, viewId, context],
    queryFn: async () => {
      const { view, fields } = await loader.loadView(model, "list", {
        viewId,
        loadArch: true,
        loadFields: true,
        context,
      });

      // 解析视图定义，生成列配置
      const { columns } = parseListView(view.arch, fields);

      return { view, fields, columns };
    },
  });

  // 2. 加载数据（根据视图配置的列）
  const dataQuery = useQuery({
    queryKey: [
      "odoo",
      "list-view",
      "data",
      model,
      viewId,
      domain,
      context,
      limit,
      offset,
    ],
    enabled: enabled && metaQuery.isSuccess, // 等待元数据加载完成
    queryFn: async () => {
      // 获取需要加载的字段列表
      const columnNames = metaQuery.data?.columns.map((col) => col.name) ?? undefined;

      // 调用 RPC 加载数据
      const records = await rpcClient.searchRead<Record<string, unknown>>(model, {
        domain,
        fields: columnNames, // 只加载视图需要的字段
        limit,
        offset,
        context,
      });

      return records;
    },
  });

  return {
    columns: metaQuery.data?.columns ?? [],
    fields: metaQuery.data?.fields ?? {},
    view: metaQuery.data?.view,
    records: dataQuery.data ?? [],
    isLoading: metaQuery.isLoading || dataQuery.isLoading,
    isFetching: metaQuery.isFetching || dataQuery.isFetching,
    error: metaQuery.error ?? dataQuery.error,
    refetch: () => {
      void metaQuery.refetch();
      void dataQuery.refetch();
    },
  };
}
```

**作用**：

- 封装数据加载逻辑
- 使用 TanStack Query 管理缓存和同步
- 提供响应式数据绑定

#### 4. React 组件（视图渲染）

**位置**: `apps/web/src/components/odoo-views/list-view.tsx`

```typescript
export const OdooListView: React.FC<OdooListViewProps> = ({
  rpcClient,
  model,
  viewId,
  domain,
  context,
  limit = 40,
  offset: offsetProp = 0,
}) => {
  const [offset, setOffset] = useState(offsetProp)

  // 使用 Hook 加载数据和视图配置
  const { columns, records, fields, isLoading, error, refetch } = useOdooListView({
    rpcClient,
    model,
    viewId,
    domain,
    context,
    limit,
    offset,
  })

  // 渲染表格
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.name}>{col.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            {columns.map((col) => (
              <TableCell key={col.name}>
                <OdooField
                  field={fields[col.name]}
                  value={record[col.name]}
                  onChange={(value) => {
                    // 更新本地状态
                    record[col.name] = value
                    // 触发重新渲染
                    refetch()
                  }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**作用**：

- 使用 Hook 获取数据和配置
- 根据配置动态渲染视图
- 处理用户交互

### 绑定机制

#### 1. 视图定义 → React 配置

```
XML 视图定义（ir.ui.view.arch）
    ↓
RPC: get_views
    ↓
OdooViewLoader.loadView()
    ↓
parseViewArch() → AST
    ↓
parseListView() → React 配置（columns）
    ↓
React 组件接收配置
```

#### 2. 数据加载 → React 状态

```
组件挂载
    ↓
useOdooListView Hook
    ↓
TanStack Query（metaQuery）
    ↓
RPC: get_views（视图定义）
    ↓
解析为 columns 配置
    ↓
TanStack Query（dataQuery）
    ↓
RPC: search_read（数据）
    ↓
更新 React 状态
    ↓
组件重新渲染
```

#### 3. 字段渲染 → Field 组件

```
字段定义（fields_get）
    ↓
字段类型匹配
    ↓
选择合适的 Field 组件
    ↓
React 组件渲染
```

#### 4. 数据更新 → 绑定方式（根据视图类型）

**表单视图（双向绑定）**：

```
用户编辑字段
    ↓
Field 组件 onChange
    ↓
React Hook Form setValue()
    ↓
更新表单状态（本地）
    ↓
组件重新渲染
    ↓
用户保存
    ↓
RPC: write
    ↓
后端更新数据库
    ↓
TanStack Query 自动刷新
    ↓
组件重新渲染
```

**列表视图/看板视图（单向绑定）**：

```
用户操作（点击编辑/删除）
    ↓
触发回调函数（onEdit/onDelete）
    ↓
跳转到表单视图（编辑）或执行删除操作
    ↓
RPC: write/unlink
    ↓
后端更新数据库
    ↓
TanStack Query 自动刷新
    ↓
列表/看板视图重新渲染（只读显示）
```

**注意**：只有表单视图支持双向绑定，列表视图和看板视图都是单向绑定（只读显示）。

### 关键特性

1. **配置驱动**：XML 视图定义 → React 配置 → 组件渲染
2. **类型安全**：TypeScript 类型定义确保类型安全
3. **自动缓存**：TanStack Query 自动管理数据缓存和同步
4. **响应式更新**：React Hooks 自动处理状态变化和视图更新

---

## 数据流详解

### 列表视图数据流

#### 完整流程

```
1. 用户操作
   └─> 路由变化 (/partner/list)
       └─> OdooListView 组件挂载

2. 视图元数据加载
   └─> useOdooListView Hook
       └─> metaQuery (TanStack Query)
           └─> OdooViewLoader.loadView()
               └─> RPC: ir.ui.view.get_views
                   └─> 返回: { views: [{ arch, ... }], fields: {...} }
                       └─> parseListView(arch, fields)
                           └─> 返回: { columns: [...] }

3. 数据加载
   └─> dataQuery (TanStack Query)
       └─> enabled: metaQuery.isSuccess
           └─> RPC: model.search_read
               └─> fields: columns.map(col => col.name)
                   └─> 返回: records: [{ id, name, ... }, ...]

4. 视图渲染
   └─> React 组件接收 { columns, records, fields }
       └─> 渲染 Table
           └─> columns.map() → TableHead
           └─> records.map() → TableRow
               └─> columns.map() → TableCell
                   └─> OdooField 组件
                       └─> 根据 field.type 选择组件
                           └─> 渲染字段值
```

#### 时序图

```
用户          React组件      Hook          TanStack Query    RPC Client      Odoo后端
 │              │            │                  │                │                │
 │─路由变化─────>│            │                  │                │                │
 │              │            │                  │                │                │
 │              │─挂载───────>│                  │                │                │
 │              │            │                  │                │                │
 │              │            │─metaQuery───────>│                │                │
 │              │            │                  │                │                │
 │              │            │                  │─get_views─────>│                │
 │              │            │                  │                │─JSON-RPC──────>│
 │              │            │                  │                │                │
 │              │            │                  │                │<─响应──────────│
 │              │            │                  │<─数据──────────│                │
 │              │            │                  │                │                │
 │              │            │<─{view,fields}────│                │                │
 │              │            │                  │                │                │
 │              │            │─parseListView()  │                │                │
 │              │            │                  │                │                │
 │              │            │─dataQuery───────>│                │                │
 │              │            │                  │                │                │
 │              │            │                  │─search_read───>│                │
 │              │            │                  │                │─JSON-RPC──────>│
 │              │            │                  │                │                │
 │              │            │                  │                │<─响应──────────│
 │              │            │                  │<─数据──────────│                │
 │              │            │                  │                │                │
 │              │            │<─{records}───────│                │                │
 │              │            │                  │                │                │
 │              │<─{columns, │                  │                │                │
 │              │  records}───│                  │                │                │
 │              │            │                  │                │                │
 │              │─渲染───────>│                  │                │                │
 │              │            │                  │                │                │
 │<─视图显示─────│            │                  │                │                │
```

### 表单视图数据流

#### 完整流程

```
1. 用户操作
   └─> 路由变化 (/partner/1/edit)
       └─> OdooFormView 组件挂载

2. 视图元数据加载
   └─> useOdooFormView Hook
       └─> metaQuery (TanStack Query)
           └─> OdooViewLoader.loadView()
               └─> RPC: ir.ui.view.get_views
                   └─> 返回: { views: [{ arch, ... }], fields: {...} }
                       └─> parseFormView(arch, fields)
                           └─> 返回: { formFields: [...], formGroups: [...] }

3. 记录数据加载
   └─> dataQuery (TanStack Query)
       └─> enabled: metaQuery.isSuccess && recordId
           └─> RPC: model.read([recordId])
               └─> 返回: record: { id, name, ... }

4. 表单初始化
   └─> React Hook Form
       └─> defaultValues: record
           └─> schema: buildFieldSchema(fields)

5. 视图渲染
   └─> React 组件接收 { formFields, formGroups, record, fields }
       └─> 渲染 Form
           └─> formGroups.map() → FormGroup
               └─> formFields.map() → FormField
                   └─> OdooField 组件
                       └─> 根据 field.type 选择组件
                           └─> 绑定到 React Hook Form
```

#### 数据更新流程

```
1. 用户编辑
   └─> OdooField onChange
       └─> React Hook Form setValue()
           └─> 更新本地表单状态
               └─> 组件重新渲染

2. 用户保存
   └─> form.handleSubmit()
       └─> RPC: model.write([recordId], formData)
           └─> 后端更新数据库
               └─> TanStack Query 自动刷新
                   └─> 组件重新渲染
```

---

## 绑定原理分析

### 核心原理

#### 1. 配置驱动渲染

**原理**：不同的 XML 视图定义 → 不同的 React 配置 → 同一个 React 组件 → 不同的渲染结果

**示例**：

```xml
<!-- 视图 A：销售订单列表 -->
<tree>
  <field name="name"/>
  <field name="date_order"/>
  <field name="amount_total"/>
</tree>
```

```typescript
// 解析为配置 A
const columnsA = [
  { name: "name", label: "订单号" },
  { name: "date_order", label: "订单日期" },
  { name: "amount_total", label: "总金额" },
]

// 同一个组件渲染
<OdooListView columns={columnsA} />
// 结果：显示销售订单表格（3 列）
```

```xml
<!-- 视图 B：产品列表 -->
<tree>
  <field name="name"/>
  <field name="list_price"/>
  <field name="qty_available"/>
</tree>
```

```typescript
// 解析为配置 B
const columnsB = [
  { name: "name", label: "产品名称" },
  { name: "list_price", label: "售价" },
  { name: "qty_available", label: "库存" },
]

// 同一个组件渲染
<OdooListView columns={columnsB} />
// 结果：显示产品表格（3 列，但字段不同）
```

#### 2. 字段类型自动匹配

**原理**：根据字段类型自动选择合适的 Field 组件

```typescript
// 字段定义
const field = {
  name: "name",
  type: "char",  // 文本类型
  label: "名称",
}

// 自动匹配组件
const FieldComponent = fieldRegistry.get("char") // CharField

// 渲染
<FieldComponent
  field={field}
  value={record.name}
  onChange={handleChange}
/>
```

**字段类型映射**：

| 字段类型    | Field 组件       | 说明           |
| ----------- | ---------------- | -------------- |
| `char`      | `CharField`      | 文本输入框     |
| `text`      | `TextField`      | 多行文本输入框 |
| `integer`   | `IntegerField`   | 数字输入框     |
| `float`     | `FloatField`     | 浮点数输入框   |
| `boolean`   | `BooleanField`   | 复选框         |
| `date`      | `DateField`      | 日期选择器     |
| `datetime`  | `DateTimeField`  | 日期时间选择器 |
| `selection` | `SelectionField` | 下拉选择框     |
| `many2one`  | `Many2OneField`  | 关联选择器     |
| `one2many`  | `One2ManyField`  | 关联列表       |
| `many2many` | `Many2ManyField` | 多选关联       |

#### 2.1 字段组件（odoo-fields）与数据绑定的关系

**位置**: `apps/web/src/components/odoo-fields/`

**核心作用**：字段组件是数据绑定的核心组件，负责数据的显示和编辑。

##### 字段组件的职责

1. **数据绑定接口**：
   - 接收 `value` 属性（数据 → 视图）
   - 提供 `onChange` 回调（视图 → 数据）
   - 支持 `readOnly` 模式（只读显示）

2. **类型适配**：
   - 根据字段类型自动选择合适的组件
   - 处理不同数据类型的格式化和验证

3. **双向绑定支持**：
   - 在表单视图中支持双向绑定
   - 在列表视图中只用于格式化显示（单向）

##### 在表单视图中的使用（双向绑定）

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

// 1. 从 React Hook Form 获取值（数据 → 视图）
const value = form.watch(field.name)

// 2. 渲染字段组件
<Component
  field={fields[field.name]}
  value={value} // 表单状态 → 显示值
  onChange={(val) => {
    form.setValue(field.name, val) // 用户输入 → 表单状态（双向绑定）
  }}
  readOnly={readOnly}
/>
```

**数据流向**：

```
后端数据 → React Hook Form → Field 组件 → 显示
用户输入 → Field 组件 onChange → React Hook Form → 后端数据
```

##### 在列表视图中的使用（单向绑定）

```typescript
// apps/web/src/components/odoo-views/list-view.tsx

// 只用于格式化显示，不支持编辑
const displayValue = field
  ? formatFieldValue(field, value) // 格式化值
  : String(value ?? "")

return <TableCell>{displayValue}</TableCell>
```

**数据流向**：

```
后端数据 → formatFieldValue → 显示（只读）
```

##### 字段组件接口

```typescript
// apps/web/src/lib/odoo-fields/types.ts

export interface FieldComponentProps<TValue = unknown> {
  /** 字段定义元信息 */
  field: OdooField;
  /** 当前值（数据 → 视图） */
  value: TValue;
  /** 值变更回调（视图 → 数据） */
  onChange: (value: TValue) => void;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 校验错误信息 */
  errorMessage?: string;
  /** RPC 客户端（用于关系型字段） */
  rpcClient?: OdooRpcClient;
}
```

##### 字段组件示例

```typescript
// apps/web/src/components/odoo-fields/char-field.tsx

export const CharField: FieldComponent<string> = ({
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  errorMessage,
}) => {
  return (
    <Input
      value={value ?? ""} // 数据 → 视图
      placeholder={placeholder}
      disabled={disabled || readOnly}
      onChange={(event) => onChange(event.target.value)} // 视图 → 数据
      aria-invalid={Boolean(errorMessage)}
      aria-errormessage={errorMessage}
    />
  )
}
```

#### 2.2 Widget 组件（odoo-widgets）与数据绑定的关系

**位置**: `apps/web/src/components/odoo-widgets/`

**核心作用**：Widget 组件是字段的装饰性组件，用于改变字段的显示方式，但不直接参与数据绑定。

##### Widget 组件的职责

1. **显示装饰**：
   - 改变字段的视觉呈现方式
   - 不处理数据绑定逻辑
   - 主要用于只读显示

2. **类型转换**：
   - 将字段值转换为特定的显示格式
   - 例如：Ribbon Widget 将值显示为徽章

3. **非绑定组件**：
   - Widget 组件通常不接收 `onChange` 回调
   - 主要用于展示，不参与数据编辑

##### Widget 组件的使用

```typescript
// 在表单视图中，Widget 通过 field.widget 属性指定
const componentKey = field.widget || fields[field.name]?.type || field.name;
const Component = defaultFieldRegistry.get(componentKey);

// 如果字段有 widget，优先使用 widget 组件
// 否则使用字段类型对应的 Field 组件
```

##### Widget 组件示例

```typescript
// apps/web/src/components/odoo-widgets/ribbon-widget.tsx

export const RibbonWidget: WidgetComponent = ({ value, field }) => {
  const label = (value as string) || field?.label || "Ribbon"
  return (
    <Badge className='bg-primary text-primary-foreground shadow-sm'>
      {label}
    </Badge>
  )
}
```

**特点**：

- 只接收 `value` 和 `field` 属性
- 不接收 `onChange` 回调
- 只用于显示，不参与数据绑定

##### Widget 与 Field 的区别

| 特性         | Field 组件                  | Widget 组件                       |
| ------------ | --------------------------- | --------------------------------- |
| **数据绑定** | ✅ 支持双向绑定             | ❌ 不支持（只读显示）             |
| **onChange** | ✅ 支持                     | ❌ 不支持                         |
| **用途**     | 数据编辑和显示              | 显示装饰                          |
| **使用场景** | 表单视图（编辑）            | 表单视图（只读显示）              |
| **示例**     | `CharField`、`IntegerField` | `RibbonWidget`、`SignatureWidget` |

##### Widget 组件的类型定义

```typescript
// apps/web/src/lib/odoo-widgets/types.ts

export interface WidgetComponentProps {
  /** Widget 名称 */
  widget: string;
  /** 字段定义 */
  field?: OdooField;
  /** 当前值（只读） */
  value: unknown;
  /** 不包含 onChange，因为 Widget 是只读的 */
}
```

#### 2.3 字段组件与 Widget 组件的选择逻辑

**在表单视图中的选择顺序**：

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

// 1. 优先使用 field.widget（如果指定了 Widget）
// 2. 否则使用字段类型对应的 Field 组件
const componentKey = field.widget || fields[field.name]?.type || field.name;
const Component = defaultFieldRegistry.get(componentKey);

// 3. 如果找到组件，使用组件渲染
// 4. 否则显示原始值（文本）
```

**选择逻辑流程图**：

```
字段定义
    ↓
是否有 widget 属性？
    ├─ 是 → 使用 Widget 组件（只读显示）
    └─ 否 → 使用字段类型对应的 Field 组件
                ↓
            是否有对应的 Field 组件？
                ├─ 是 → 使用 Field 组件（支持双向绑定）
                └─ 否 → 显示原始值（文本）
```

#### 2.4 总结：组件与数据绑定的关系

**字段组件（odoo-fields）**：

- ✅ **核心数据绑定组件**
- ✅ **支持双向绑定**（表单视图）
- ✅ **支持单向绑定**（列表视图，只读显示）
- ✅ **接收 value 和 onChange**

**Widget 组件（odoo-widgets）**：

- ⚠️ **装饰性组件**
- ❌ **不支持数据绑定**（只读显示）
- ❌ **不接收 onChange**
- ✅ **只用于改变显示方式**

**数据绑定关系图**：

```
表单视图（双向绑定）
    ↓
Field 组件
    ├─ value（数据 → 视图）
    └─ onChange（视图 → 数据）
        ↓
    React Hook Form
        ↓
    后端数据

列表视图（单向绑定）
    ↓
formatFieldValue（格式化）
    ↓
    显示（只读）

Widget 组件（只读显示）
    ↓
    value（只读）
    ↓
    显示（装饰）
```

#### 3. 响应式数据绑定

**原理**：使用 TanStack Query 实现响应式数据绑定

```typescript
// 1. 定义查询
const dataQuery = useQuery({
  queryKey: ["odoo", "list-view", "data", model, domain],
  queryFn: async () => {
    return await rpcClient.searchRead(model, { domain });
  },
});

// 2. 数据变化自动触发重新渲染
const { records, isLoading } = dataQuery;

// 3. 数据更新自动刷新
const { refetch } = dataQuery;

// 4. 乐观更新
const mutation = useMutation({
  mutationFn: async (data) => {
    return await rpcClient.write(model, [id], data);
  },
  onSuccess: () => {
    // 自动刷新查询
    queryClient.invalidateQueries(["odoo", "list-view", "data"]);
  },
});
```

#### 3.1 字段组件的 onChange 与 TanStack Query 的关系

**重要说明**：字段组件的 `onChange` 和 TanStack Query **不重叠**，它们负责不同的职责，并且是**协作关系**。

##### 职责划分

**字段组件的 `onChange`**：

- **职责**：处理用户输入，更新**本地表单状态**（React Hook Form）
- **作用域**：前端本地状态
- **时机**：用户编辑字段时立即触发
- **数据流向**：视图 → 本地状态

**TanStack Query**：

- **职责**：从后端获取数据，管理**数据缓存**
- **作用域**：后端数据同步
- **时机**：组件挂载时、数据保存后、手动刷新时
- **数据流向**：后端 → 缓存 → 视图

##### 协作流程

**表单视图中的完整数据流**：

```
1. 初始加载
   TanStack Query (dataQuery)
       ↓
   RPC: model.read([recordId])
       ↓
   返回: record
       ↓
   React Hook Form (defaultValues: record)
       ↓
   Field 组件 (value: form.watch(field.name))

2. 用户编辑
   用户输入
       ↓
   Field 组件 onChange
       ↓
   React Hook Form setValue(field.name, value)
       ↓
   更新本地表单状态（不涉及后端）
       ↓
   组件重新渲染（显示新值）

3. 用户保存
   form.handleSubmit()
       ↓
   RPC: model.write([recordId], formData)
       ↓
   后端更新数据库
       ↓
   保存成功后调用 refetch()
       ↓
   TanStack Query 刷新缓存
       ↓
   更新 record 数据
       ↓
   useEffect 检测到 record 变化
       ↓
   form.reset(record)（同步后端数据到表单）
```

##### 关键代码实现

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

// 1. TanStack Query 加载后端数据
const { record, refetch } = useOdooFormView({
  rpcClient,
  model,
  recordId,
  context,
})

// 2. React Hook Form 管理本地状态
const form = useForm<Record<string, unknown>>({
  defaultValues: record, // 后端数据 → 表单初始值
  resolver: zodResolver(schema),
})

// 3. 字段组件的 onChange 更新本地状态
<Component
  value={form.watch(field.name)} // 从本地状态读取
  onChange={(val) => {
    form.setValue(field.name, val) // 更新本地状态（不涉及后端）
  }}
/>

// 4. 后端数据变化时，同步到表单
useEffect(() => {
  if (record && recordId && mode !== "create") {
    form.reset(record) // 后端数据 → 表单状态
  }
}, [record, recordId, mode, formFields, fields, form])

// 5. 保存后刷新后端数据
const handleSubmit = async (values: Record<string, unknown>) => {
  await rpcClient.write(model, [recordId], values)
  void refetch() // 刷新 TanStack Query 缓存
}
```

##### 为什么不会重叠？

1. **不同的作用域**：
   - `onChange`：前端本地状态（React Hook Form）
   - TanStack Query：后端数据缓存

2. **不同的时机**：
   - `onChange`：用户输入时立即触发
   - TanStack Query：数据加载/保存后触发

3. **不同的数据流向**：
   - `onChange`：视图 → 本地状态（单向）
   - TanStack Query：后端 → 缓存 → 视图（单向）

4. **协作而非竞争**：
   - `onChange` 负责编辑中的状态
   - TanStack Query 负责已保存的数据
   - 保存成功后，TanStack Query 刷新，然后同步到表单

##### 潜在冲突与解决方案

**潜在冲突**：如果用户在编辑过程中，TanStack Query 自动刷新了数据，可能会覆盖用户的编辑。

**解决方案**：

1. **只在保存成功后刷新**：代码中只在 `handleSubmit` 成功后调用 `refetch()`
2. **使用 useEffect 同步**：只有当 `record` 变化且不是创建模式时才重置表单
3. **避免自动刷新**：表单视图的查询不会自动刷新，除非手动调用 `refetch()`

```typescript
// 表单视图的查询配置
const dataQuery = useQuery({
  queryKey: ["odoo", "form-view", "record", model, viewId, recordId, context],
  enabled: enabled && metaQuery.isSuccess && Boolean(recordId),
  queryFn: async () => {
    // 只在组件挂载或手动刷新时执行
    return await rpcClient.read(model, [recordId]);
  },
  // 不设置 refetchOnWindowFocus，避免自动刷新
  // 不设置 refetchInterval，避免定时刷新
});
```

##### 总结

| 特性         | 字段组件的 onChange | TanStack Query     |
| ------------ | ------------------- | ------------------ |
| **职责**     | 更新本地表单状态    | 管理后端数据缓存   |
| **作用域**   | 前端本地状态        | 后端数据同步       |
| **时机**     | 用户输入时          | 数据加载/保存后    |
| **数据流向** | 视图 → 本地状态     | 后端 → 缓存 → 视图 |
| **是否重叠** | ❌ 不重叠           | ❌ 不重叠          |
| **关系**     | ✅ 协作关系         | ✅ 协作关系        |

**核心要点**：

- `onChange` 和 TanStack Query **不重叠**，它们负责不同的职责
- `onChange` 负责**编辑中的状态**（本地）
- TanStack Query 负责**已保存的数据**（后端）
- 它们通过 React Hook Form 和 `useEffect` 协作，实现完整的数据绑定流程

#### 4. 双向数据绑定

**双向绑定（Two-Way Data Binding）**是指数据模型和视图之间的双向同步：

- **数据 → 视图**：当数据发生变化时，视图自动更新
- **视图 → 数据**：当用户在视图中输入时，数据自动更新

##### 什么是双向绑定？

**单向绑定（One-Way Data Binding）**：

```
数据 → 视图（只读）
```

- 数据变化时，视图更新
- 视图变化时，数据不更新
- 需要手动处理用户输入

**双向绑定（Two-Way Data Binding）**：

```
数据 ⇄ 视图（可读写）
```

- 数据变化时，视图自动更新
- 视图变化时，数据自动更新
- 自动同步，无需手动处理

##### 在本项目中的实现

**重要说明**：**只有表单视图（Form View）使用双向绑定，列表视图（List View）和看板视图（Kanban View）都是单向绑定（只读显示）。**

**表单视图（Form View）**：使用 React Hook Form 实现双向绑定

**列表视图（List View）**：单向绑定（只读显示）

- 数据 → 视图：后端数据加载后显示在表格中
- 视图 → 数据：不支持直接编辑，需要通过 `onEdit` 回调跳转到表单视图编辑

**看板视图（Kanban View）**：单向绑定（只读显示）

- 数据 → 视图：后端数据加载后显示在看板卡片中
- 视图 → 数据：不支持直接编辑，卡片移动通过 `onCardMove` 回调处理

**原理**：使用 React Hook Form 实现表单数据的双向绑定

```typescript
// 1. 初始化表单（数据 → 表单）
const form = useForm<Record<string, unknown>>({
  defaultValues: record, // 后端数据 → 表单初始值
  resolver: zodResolver(schema),
})

// 2. 表单变化 → 数据更新（视图 → 数据）
<OdooField
  field={field}
  value={form.watch(field.name)} // 表单状态 → 显示值
  onChange={(value) => {
    form.setValue(field.name, value) // 用户输入 → 表单状态
  }}
/>

// 3. 数据变化 → 表单更新（数据 → 视图）
useEffect(() => {
  if (record) {
    form.reset(record) // 后端数据变化 → 表单重置
  }
}, [record, form])

// 4. 表单提交 → 数据保存（视图 → 后端）
const onSubmit = form.handleSubmit(async (data) => {
  await rpcClient.write(model, [recordId], data) // 表单数据 → 后端保存
})
```

##### 双向绑定的完整流程

**场景：用户编辑表单字段**

```
1. 初始状态
   ┌─────────────┐
   │ 后端数据    │
   │ {name: "A"} │
   └──────┬──────┘
          │
          │ 数据 → 视图
          ↓
   ┌─────────────┐
   │ 表单状态    │
   │ {name: "A"} │
   └──────┬──────┘
          │
          │ 表单 → 显示
          ↓
   ┌─────────────┐
   │ 输入框显示  │
   │ "A"         │
   └─────────────┘

2. 用户输入 "B"
   ┌─────────────┐
   │ 输入框显示  │
   │ "B"         │ ← 用户输入
   └──────┬──────┘
          │
          │ onChange
          ↓
   ┌─────────────┐
   │ 表单状态    │
   │ {name: "B"} │ ← 自动更新
   └──────┬──────┘
          │
          │ 视图 → 数据（本地）
          ↓
   ┌─────────────┐
   │ 本地状态    │
   │ {name: "B"} │
   └─────────────┘

3. 用户保存
   ┌─────────────┐
   │ 表单状态    │
   │ {name: "B"} │
   └──────┬──────┘
          │
          │ 提交
          ↓
   ┌─────────────┐
   │ RPC: write  │
   └──────┬──────┘
          │
          │ 视图 → 后端
          ↓
   ┌─────────────┐
   │ 后端数据    │
   │ {name: "B"} │ ← 保存成功
   └──────┬──────┘
          │
          │ 后端 → 视图（刷新）
          ↓
   ┌─────────────┐
   │ 表单状态    │
   │ {name: "B"} │ ← 同步完成
   └─────────────┘
```

##### 关键代码实现

**1. 数据 → 视图（后端数据加载到表单）**

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

// 当记录数据更新时，重置表单值
useEffect(() => {
  if (record && recordId && mode !== "create") {
    const newDefaults: Record<string, unknown> = {};
    for (const field of formFields) {
      const fieldMeta = fields[field.name] ?? { name: field.name, type: "char" };
      newDefaults[field.name] =
        record[field.name] ?? // 从后端数据获取
        (fieldMeta.defaultValue !== undefined ? fieldMeta.defaultValue : "");
    }
    form.reset(newDefaults); // 数据 → 表单（重置表单值）
  }
}, [record, recordId, mode, formFields, fields, form]);
```

**2. 视图 → 数据（用户输入更新表单状态）**

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

// 渲染字段组件
{group.fields.map((field) => {
  const value = form.watch(field.name) // 表单状态 → 显示值（数据 → 视图）

  return (
    <Component
      field={field}
      value={value} // 显示当前表单值
      onChange={(value) => {
        form.setValue(field.name, value) // 用户输入 → 表单状态（视图 → 数据）
      }}
    />
  )
})}
```

**3. 视图 → 后端（表单提交保存数据）**

```typescript
// apps/web/src/components/odoo-views/form-view.tsx

const handleSubmit = async (values: Record<string, unknown>) => {
  if (effectiveMode === "create") {
    // 创建新记录
    const id = await rpcClient.create(model, values, context); // 表单 → 后端
    onSubmitSuccess?.(id);
    form.reset(defaultValues); // 重置表单
  } else if (effectiveMode === "edit" && recordId) {
    // 更新现有记录
    await rpcClient.write(model, [recordId], values, { context }); // 表单 → 后端
    onSubmitSuccess?.(recordId);
    void refetch(); // 刷新后端数据
  }
};
```

##### 双向绑定的优势

1. **自动同步**：数据变化自动更新视图，视图变化自动更新数据
2. **减少代码**：无需手动处理数据同步逻辑
3. **用户体验**：实时反馈，用户输入立即反映在界面上
4. **数据一致性**：确保视图和数据始终保持同步

##### 双向绑定的注意事项

1. **性能考虑**：频繁的数据同步可能影响性能，需要合理控制更新频率
2. **数据验证**：在数据更新前需要进行验证，避免无效数据
3. **冲突处理**：当多个用户同时编辑时，需要处理数据冲突
4. **状态管理**：需要区分"本地状态"和"后端状态"，避免不必要的同步

##### 不同视图类型的绑定方式

| 视图类型                     | 绑定方式        | 说明                                          |
| ---------------------------- | --------------- | --------------------------------------------- |
| **表单视图（Form View）**    | ✅ **双向绑定** | 使用 React Hook Form，支持数据 ↔ 视图双向同步 |
| **列表视图（List View）**    | ⚠️ **单向绑定** | 只读显示，编辑需跳转到表单视图                |
| **看板视图（Kanban View）**  | ⚠️ **单向绑定** | 只读显示，卡片移动通过回调处理                |
| **图表视图（Graph View）**   | ⚠️ **单向绑定** | 只读显示，数据可视化                          |
| **数据透视表（Pivot View）** | ⚠️ **单向绑定** | 只读显示，数据分析                            |

**为什么只有表单视图使用双向绑定？**

1. **表单视图需要编辑**：用户需要在表单中直接编辑字段值
2. **列表/看板视图主要用于浏览**：主要用于查看和筛选数据，编辑操作通过跳转到表单视图完成
3. **性能考虑**：双向绑定会增加复杂度，对于只读视图没有必要
4. **用户体验**：表单视图专注于编辑，列表/看板视图专注于浏览

##### 与单向绑定的对比

| 特性            | 单向绑定                     | 双向绑定 |
| --------------- | ---------------------------- | -------- |
| **数据 → 视图** | ✅ 自动                      | ✅ 自动  |
| **视图 → 数据** | ❌ 手动处理                  | ✅ 自动  |
| **代码复杂度**  | 较低                         | 中等     |
| **性能**        | 较好                         | 需要优化 |
| **适用场景**    | 只读视图（列表、看板、图表） | 表单编辑 |

---

## 对比总结

### 架构对比

| 方面         | Odoo 原生               | 本项目                       |
| ------------ | ----------------------- | ---------------------------- |
| **前端框架** | OWL（Odoo Web Library） | React                        |
| **模板引擎** | QWeb                    | JSX/TSX                      |
| **数据管理** | OWL 组件状态            | TanStack Query               |
| **视图定义** | XML + QWeb 模板         | XML → React 配置             |
| **字段渲染** | OWL Field 组件          | React Field 组件             |
| **数据绑定** | OWL 响应式系统          | React Hooks + TanStack Query |

### 数据流对比

#### Odoo 原生

```
XML 视图定义
    ↓
RPC: get_views
    ↓
OWL 组件接收配置
    ↓
QWeb 模板渲染
    ↓
RPC: search_read
    ↓
更新组件状态
    ↓
QWeb 模板重新渲染
```

#### 本项目

```
XML 视图定义
    ↓
RPC: get_views
    ↓
解析为 AST
    ↓
转换为 React 配置
    ↓
React 组件接收配置
    ↓
TanStack Query 加载数据
    ↓
RPC: search_read
    ↓
更新 React 状态
    ↓
React 组件重新渲染
```

### 绑定机制对比

| 特性             | Odoo 原生            | 本项目                       |
| ---------------- | -------------------- | ---------------------------- |
| **视图定义解析** | OWL 框架内置         | 自定义 XML 解析器            |
| **配置生成**     | OWL 组件直接使用     | XML → AST → React 配置       |
| **数据加载**     | OWL 组件生命周期     | React Hooks + TanStack Query |
| **缓存管理**     | OWL 框架内置         | TanStack Query 自动管理      |
| **响应式更新**   | OWL 响应式系统       | React Hooks + TanStack Query |
| **类型安全**     | JavaScript（无类型） | TypeScript（类型安全）       |

### 优势对比

#### Odoo 原生优势

1. **深度集成**：与 Odoo 后端深度集成
2. **统一框架**：使用统一的 OWL 框架
3. **模板系统**：QWeb 模板系统成熟

#### 本项目优势

1. **现代化技术栈**：使用 React、TypeScript 等现代技术
2. **类型安全**：TypeScript 提供完整的类型安全
3. **生态系统**：丰富的 React 生态系统
4. **开发体验**：更好的开发工具和调试体验
5. **性能优化**：TanStack Query 提供自动缓存和优化

---

## 总结

### 核心要点

1. **配置驱动**：XML 视图定义 → React 配置 → 组件渲染
2. **类型安全**：TypeScript 确保类型安全
3. **自动缓存**：TanStack Query 自动管理数据缓存
4. **响应式更新**：React Hooks 自动处理状态变化

### 关键差异

1. **视图定义解析**：本项目需要将 XML 解析为 React 配置
2. **数据管理**：使用 TanStack Query 替代 OWL 组件状态
3. **模板系统**：使用 JSX/TSX 替代 QWeb 模板
4. **类型安全**：TypeScript 提供完整的类型安全

### 实现建议

1. **保持兼容**：保持与 Odoo 后端 RPC 接口的兼容性
2. **类型定义**：为所有数据结构和接口定义 TypeScript 类型
3. **缓存策略**：合理配置 TanStack Query 的缓存策略
4. **错误处理**：实现完善的错误处理和用户提示

---

**最后更新**: 2025-01-XX
