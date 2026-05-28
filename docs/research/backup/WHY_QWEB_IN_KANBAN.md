# 为什么需要集成 QWeb 到 Kanban 视图

## ⚠️ 重要说明：与文档的关系

本文档解释了为什么 **Kanban 视图是一个例外情况**，需要集成 QWeb 模板引擎，而其他视图（列表、表单）不需要。

参考文档 `docs/research/qweb-templates-tutorial.md` 中说明了：

- **列表视图和表单视图**：不使用 QWeb，直接使用 React 组件渲染（配置驱动）
- **看板视图**：**特殊例外**，卡片内容需要使用 QWeb 模板引擎

**这不是矛盾，而是有意的设计选择**。

---

## 📊 问题现状

### 当前 Kanban 视图的实现

当前 `KanbanCard` 组件使用**固定的通用布局**：

```typescript
// apps/web/src/components/odoo-views/kanban-card.tsx
<Card>
  <CardHeader>
    <CardTitle>{title}</CardTitle>  // 只显示名称
  </CardHeader>
  <CardContent>
    {entries.slice(0, 4).map((key) => (  // 简单的字段列表
      <div>
        <span>{key}</span>
        <span>{data[key]}</span>
      </div>
    ))}
  </CardContent>
</Card>
```

**问题**：

- ❌ 布局是固定的，无法自定义
- ❌ 所有卡片都使用相同的布局
- ❌ 无法处理复杂的字段显示（如 widget）
- ❌ 无法支持条件渲染
- ❌ 无法还原 Odoo 中定义的卡片样式

---

## 🎯 Odoo Kanban 视图的真实需求

### Odoo XML 中的卡片定义

Odoo 使用 **QWeb 模板**来定义卡片的自定义布局：

```xml
<kanban>
  <field name="activity_state"/>
  <field name="color"/>
  <templates>
    <t t-name="card" class="row g-0">
      <!-- 左侧主要内容区 -->
      <main class="col-10 pe-2">
        <div class="d-flex mb-1 h5">
          <!-- 收藏按钮 -->
          <field class="me-1" name="is_favorite" widget="boolean_favorite" nolabel="1"/>
          <!-- 产品名称 -->
          <field name="name"/>
        </div>
        <!-- 条件显示：只有当 default_code 存在时才显示 -->
        <span t-if="record.default_code.value">
          [<field name="default_code"/>]
        </span>
        <!-- 价格显示 -->
        <span>Price: <field name="lst_price"/></span>
      </main>
      <!-- 右侧图片区 -->
      <aside class="col-2">
        <field name="image_128" widget="image"
               options="{'img_class': 'o_image_64_contain mw-100'}"
               alt="Product"/>
      </aside>
    </t>
  </templates>
</kanban>
```

**这个模板定义的特点**：

1. ✅ **自定义布局结构**：使用 `<main>` 和 `<aside>` 定义左右布局
2. ✅ **条件渲染**：`t-if="record.default_code.value"` 条件显示
3. ✅ **Widget 支持**：`widget="boolean_favorite"`, `widget="image"`
4. ✅ **CSS 类**：`class="row g-0"`, `class="col-10 pe-2"` 等
5. ✅ **复杂嵌套**：可以嵌套 div、span 等 HTML 元素

---

## 🔍 对比分析

### 当前实现 vs Odoo 定义

| 特性         | Odoo XML 定义                                 | 当前 React 实现          | 差距        |
| ------------ | --------------------------------------------- | ------------------------ | ----------- |
| **布局**     | 自定义（main/aside）                          | 固定（Card/CardContent） | ❌ 无法还原 |
| **条件显示** | `t-if` 指令                                   | 不支持                   | ❌ 无法还原 |
| **Widget**   | `widget="image"`, `widget="boolean_favorite"` | 不支持                   | ❌ 无法还原 |
| **样式类**   | `class="row g-0"`                             | 固定的 Tailwind 类       | ❌ 无法还原 |
| **字段显示** | 自定义位置和格式                              | 简单列表                 | ❌ 无法还原 |
| **图片显示** | `<field widget="image">`                      | 不支持                   | ❌ 无法还原 |
| **收藏按钮** | `<field widget="boolean_favorite">`           | 不支持                   | ❌ 无法还原 |

---

## 💡 为什么需要 QWeb 模板引擎

### QWeb 的作用

QWeb 模板引擎可以：

1. **解析模板语法**
   - 解析 `<templates>`, `<t t-name="card">` 标签
   - 识别 QWeb 指令：`t-if`, `t-foreach`, `t-esc`, `t-raw` 等
   - 处理表达式：`record.default_code.value`

2. **渲染自定义布局**
   - 将 XML 模板转换为 HTML
   - 保留原始的结构和样式类
   - 支持嵌套的 HTML 元素

3. **支持动态逻辑**
   - 条件渲染（`t-if`）
   - 循环渲染（`t-foreach`）
   - 表达式求值

4. **字段渲染集成**
   - 解析 `<field>` 标签
   - 识别 `widget` 属性
   - 可以调用对应的 Widget 组件渲染

---

## 📈 集成 QWeb 后的效果

### 还原度提升

**当前还原度**：~30%

- ✅ 基本布局（卡片网格）
- ✅ 字段提取
- ✅ 分组功能
- ❌ 自定义卡片布局
- ❌ Widget 支持
- ❌ 条件渲染

**集成 QWeb 后预期还原度**：~80%

- ✅ 基本布局
- ✅ 字段提取
- ✅ 分组功能
- ✅ **自定义卡片布局**（通过 QWeb 模板）
- ✅ **Widget 支持**（通过 QWeb 解析字段）
- ✅ **条件渲染**（通过 QWeb 指令）

---

## 🎯 具体收益

### 1. 能够还原 Odoo 定义的卡片样式

**之前**：

```
┌─────────────────┐
│ 产品名称         │
├─────────────────┤
│ default_code: A │
│ lst_price: 100  │
│ ...             │
└─────────────────┘
```

**之后**（还原 Odoo 定义）：

```
┌───────────────────────┐
│ ⭐ 产品名称            │
│    [A-001]            │
│    Price: $100.00     │
│                       │
│              [图片]    │
└───────────────────────┘
```

### 2. 支持条件显示

```xml
<!-- 只有当 default_code 存在时才显示 -->
<span t-if="record.default_code.value">
  [<field name="default_code"/>]
</span>
```

### 3. 支持 Widget 渲染

```xml
<!-- 收藏按钮 -->
<field name="is_favorite" widget="boolean_favorite"/>

<!-- 图片显示 -->
<field name="image_128" widget="image"/>
```

### 4. 支持复杂布局

```xml
<main class="col-10 pe-2">
  <!-- 左侧内容 -->
</main>
<aside class="col-2">
  <!-- 右侧图片 -->
</aside>
```

---

## 🔧 技术实现方式

### 集成步骤

1. **解析模板**
   - 在 `kanban-view-parser.ts` 中提取 `<templates>` 标签
   - 找到 `<t t-name="card">` 模板定义
   - 将模板 XML 传递给 QWeb 引擎

2. **渲染卡片**
   - 使用 QWeb 引擎渲染模板
   - 传入记录数据作为上下文
   - 处理 `<field>` 标签，调用对应的 Widget 组件

3. **组件集成**
   - 在 `KanbanCard` 组件中使用 QWeb 渲染结果
   - 或者创建新的组件来渲染 QWeb 模板

### 示例代码结构

```typescript
// 解析 Kanban 视图
const kanbanNode = parseKanbanView(arch);

// 提取 QWeb 模板
const cardTemplate = kanbanNode.templates?.find((t) => t.name === "card");

// 使用 QWeb 引擎渲染
const qweb = createQWebEngine();
const html = qweb.render("card", {
  record: {
    id: record.id,
    name: record.data.name,
    default_code: record.data.default_code,
    // ...
  },
});

// 渲染为 React 组件（或使用 dangerouslySetInnerHTML）
```

---

## 📊 总结

### 核心原因

1. **Odoo 的 Kanban 视图使用 QWeb 模板定义卡片布局**
   - 这不是可选的，而是 Odoo 的标准方式
   - 每个 Kanban 视图都有自己的卡片模板
   - **这是 Kanban 视图的特殊性，与其他视图不同**

2. **当前的固定布局无法满足需求**
   - 无法还原 Odoo 中定义的复杂布局
   - 无法支持条件渲染和 Widget

3. **QWeb 引擎已经存在**
   - `libs/qwebjs` 已经实现了 QWeb 模板引擎
   - 只需要集成到 Kanban 视图中即可

4. **显著提升还原度**
   - 从 ~30% 提升到 ~80%
   - 能够正确还原大部分 Odoo Kanban 视图

### 为什么 Kanban 视图是例外？

**设计原则**：

| 视图类型     | 结构特点               | 渲染策略                                                            | 原因                               |
| ------------ | ---------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| **列表视图** | 固定的表格结构         | React 组件（配置驱动）                                              | 结构简单，可以用配置覆盖所有情况   |
| **表单视图** | 固定的表单结构         | React 组件（配置驱动）                                              | 结构相对固定，可以用配置驱动       |
| **看板视图** | **卡片内容高度自定义** | **混合策略**：<br/>- 视图结构：React 组件<br/>- 卡片内容：QWeb 模板 | 卡片布局差异太大，需要模板引擎支持 |

**混合策略的优势**：

1. **性能**：视图结构（列、分组、拖拽）使用 React，保持高性能
2. **灵活性**：卡片内容使用 QWeb，可以还原任意自定义布局
3. **兼容性**：能够正确还原 Odoo 定义的卡片模板

### 结论

**集成 QWeb 到 Kanban 视图是必须的**，因为：

- Odoo 的 Kanban 视图核心就是基于 QWeb 模板的
- 没有 QWeb 支持，就无法正确还原 Odoo 定义的卡片布局
- QWeb 引擎已经开发完成，集成成本相对较低
- 能够大幅提升视图还原度
- **这是 Kanban 视图的特殊需求，与列表/表单视图的设计策略不同**
