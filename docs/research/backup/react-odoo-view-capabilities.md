# React 版本 Odoo 视图还原能力评估

本文档评估当前 React 实现对 Odoo XML 视图定义的还原能力。

## 📊 总体支持情况

### ✅ 已支持的视图类型

| 视图类型            | 解析器                       | React 组件             | 支持程度                      |
| ------------------- | ---------------------------- | ---------------------- | ----------------------------- |
| **List (列表)**     | ✅ `list-view-parser.ts`     | ✅ `list-view.tsx`     | 🟢 基础功能完整               |
| **Form (表单)**     | ✅ `form-view-parser.ts`     | ✅ `form-view.tsx`     | 🟡 基础功能完整，高级功能缺失 |
| **Kanban (看板)**   | ✅ `kanban-view-parser.ts`   | ✅ `kanban-view.tsx`   | 🟡 基础布局支持，模板不支持   |
| **Graph (图表)**    | ✅ `graph-view-parser.ts`    | ✅ `graph-view.tsx`    | 🟢 基础功能完整               |
| **Pivot (透视表)**  | ✅ `pivot-view-parser.ts`    | ✅ `pivot-view.tsx`    | 🟢 基础功能完整               |
| **Calendar (日历)** | ✅ `calendar-view-parser.ts` | ✅ `calendar-view.tsx` | 🟢 基础功能完整               |
| **Gantt (甘特图)**  | ✅ `gantt-view-parser.ts`    | ✅ `gantt-view.tsx`    | 🟢 基础功能完整               |
| **Search (搜索)**   | ❌ 未实现                    | ❌ 未实现              | 🔴 未实现                     |

---

## 📋 详细功能对比

### 1. Form View (表单视图)

#### ✅ 已支持的功能

| 功能                  | 状态 | 说明                         |
| --------------------- | ---- | ---------------------------- |
| 基本字段渲染          | ✅   | 支持所有基本字段类型         |
| `<group>` 分组        | ✅   | 支持字段分组显示             |
| `colspan` / `rowspan` | ✅   | 支持字段跨列/跨行            |
| `widget` 属性         | ✅   | 支持字段 widget 属性（基础） |
| `readonly` 属性       | ✅   | 通过权限系统支持             |
| `invisible` 属性      | ✅   | 通过权限系统支持（简单条件） |
| 表单验证              | ✅   | 使用 Zod schema              |
| 创建/编辑/只读模式    | ✅   | 支持三种模式切换             |
| 表单保存              | ✅   | 支持数据保存                 |
| 权限控制              | ✅   | 集成权限系统                 |

#### ❌ 未支持的功能

| 功能                                 | Odoo XML 示例                                                                                                         | 缺失原因                                       | 优先级 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| **`<notebook>` / `<page>` 多标签页** | `xml <notebook> <page string="General">...</page> <page string="Sales">...</page> </notebook> `                       | 解析器未处理 notebook/page 标签                | 🔴 高  |
| **`<button_box>` 按钮框**            | `xml <div class="oe_button_box"> <button class="oe_stat_button">...</button> </div> `                                 | 未解析按钮框结构                               | 🟡 中  |
| **`<chatter>` 讨论区**               | `xml <chatter/> `                                                                                                     | 未实现 chatter 组件                            | 🟡 中  |
| **复杂 `invisible` 表达式**          | `xml <field invisible="type != 'combo'"/> <field invisible="product_variant_count > 1 and not is_product_variant"/> ` | 当前只支持简单的域表达式，不支持 Python 表达式 | 🔴 高  |
| **`<label>` 标签**                   | `xml <label for="weight"/> `                                                                                          | 未解析 label 标签                              | 🟢 低  |
| **`<div>` 容器**                     | `xml <div class="o_row">...</div> `                                                                                   | 未解析自定义 div 结构                          | 🟡 中  |
| **特殊 Widget**                      | `widget="image"`, `widget="boolean_favorite"`, `widget="monetary"`                                                    | 部分 widget 未实现                             | 🔴 高  |
| **`<widget>` 标签**                  | `xml <widget name="web_ribbon" title="Archived"/> `                                                                   | 未解析 widget 标签                             | 🟡 中  |
| **字段 `options` JSON**              | `xml <field options="{'no_create': True, 'edit_tags': True}"/> `                                                      | 未解析 options 属性                            | 🟡 中  |
| **字段 `domain` / `context`**        | `xml <field domain="[('type', '=', 'service')]"/> `                                                                   | 字段定义中有，但未在视图解析中使用             | 🟡 中  |
| **字段 `required` 条件**             | `xml <field required="type == 'binary'"/> `                                                                           | 不支持条件必填                                 | 🟢 低  |

#### 实际还原示例对比

**Odoo XML 定义**（来自 `product_template_form_view`）：

```xml
<form>
  <sheet>
    <div class="oe_button_box">
      <button class="oe_stat_button" name="action_open_documents">
        <field string="Documents" name="product_document_count" widget="statinfo"/>
      </button>
    </div>
    <widget name="web_ribbon" title="Archived" invisible="active"/>
    <field name="image_1920" widget="image" class="oe_avatar"/>
    <div class="oe_title">
      <h1>
        <field name="is_favorite" widget="boolean_favorite"/>
        <field name="name" widget="text"/>
      </h1>
    </div>
    <notebook>
      <page string="General Information">
        <group>
          <field name="type" widget="radio"/>
          <field name="combo_ids" widget="many2many_tags"
                 invisible="type != 'combo'"/>
        </group>
      </page>
      <page string="Sales">
        <group>
          <field name="description_sale"/>
        </group>
      </page>
    </notebook>
  </sheet>
  <chatter/>
</form>
```

**当前 React 实现能还原的部分**：

- ✅ `<field>` 基本字段
- ✅ `<group>` 分组
- ❌ `<notebook>` / `<page>` - **不会渲染为标签页**
- ❌ `<button_box>` - **不会渲染按钮框**
- ❌ `<widget>` - **不会渲染特殊 widget**
- ❌ `<chatter>` - **不会渲染讨论区**
- ❌ 复杂 `invisible` - **条件表达式不会生效**

---

### 2. List View (列表视图)

#### ✅ 已支持的功能

| 功能                    | 状态 | 说明              |
| ----------------------- | ---- | ----------------- |
| 基本列定义              | ✅   | 支持字段列        |
| `string` 属性（列标题） | ✅   | 支持自定义列标题  |
| `widget` 属性           | ✅   | 支持列 widget     |
| 字段排序                | ✅   | 支持默认排序      |
| 分页                    | ✅   | 支持分页          |
| 行操作                  | ✅   | 支持编辑/删除操作 |
| 权限控制                | ✅   | 支持字段权限      |

#### ❌ 未支持的功能

| 功能                      | Odoo XML 示例                                                  | 缺失原因               | 优先级 |
| ------------------------- | -------------------------------------------------------------- | ---------------------- | ------ |
| **`multi_edit` 批量编辑** | `xml <list multi_edit="1"> `                                   | 组件不支持批量编辑模式 | 🟡 中  |
| **`duplicate` 复制控制**  | `xml <list duplicate="false"> `                                | 未实现                 | 🟢 低  |
| **`sample` 示例数据**     | `xml <list sample="1"> `                                       | 未实现                 | 🟢 低  |
| **`optional` 可选列**     | `xml <field optional="show"/> <field optional="hide"/> `       | 未实现列显示/隐藏控制  | 🟡 中  |
| **`column_invisible`**    | `xml <field column_invisible="True"/> `                        | 未实现列可见性控制     | 🟡 中  |
| **`<control>` 控件**      | `xml <control> <create name="add_product_price"/> </control> ` | 未实现自定义控件       | 🟡 中  |

---

### 3. Kanban View (看板视图)

#### ✅ 已支持的功能

| 功能                    | 状态 | 说明               |
| ----------------------- | ---- | ------------------ |
| 基本看板布局            | ✅   | 支持卡片网格布局   |
| `<field>` 字段提取      | ✅   | 提取需要的字段列表 |
| `default_group_by` 分组 | ✅   | 支持按字段分组     |
| 拖拽排序                | ✅   | 支持卡片拖拽       |
| 卡片点击                | ✅   | 支持卡片点击事件   |

#### ❌ 未支持的功能

| 功能                       | Odoo XML 示例                                                                | 缺失原因                                                   | 优先级 |
| -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| **QWeb 模板解析**          | `xml <templates> <t t-name="card"> <field name="name"/> </t> </templates> `  | **关键缺失**：未实现 QWeb 模板引擎，无法解析自定义卡片布局 | 🔴 高  |
| **`<progressbar>` 进度条** | `xml <progressbar field="activity_state" colors='{"planned": "success"}'/> ` | 未实现进度条组件                                           | 🟡 中  |
| **`sample` 示例数据**      | `xml <kanban sample="1"> `                                                   | 未实现                                                     | 🟢 低  |
| **`records_draggable`**    | `xml <kanban records_draggable="0"> `                                        | 已支持，但需在组件中配置                                   | 🟢 低  |
| **`js_class` 自定义 JS**   | `xml <kanban js_class="product_kanban_catalog"> `                            | 不支持自定义 JavaScript 类                                 | 🟡 中  |

#### 实际还原示例对比

**Odoo XML 定义**（来自 `product_kanban_view`）：

```xml
<kanban sample="1" default_order="is_favorite desc, default_code, name, id">
  <field name="activity_state"/>
  <field name="color"/>
  <progressbar field="activity_state" colors='{"planned": "success", "today": "warning", "overdue": "danger"}'/>
  <templates>
    <t t-name="card" class="row g-0">
      <main class="col-10 pe-2">
        <div class="d-flex mb-1 h5">
          <field class="me-1" name="is_favorite" widget="boolean_favorite" nolabel="1"/>
          <field name="name"/>
        </div>
        <span t-if="record.default_code.value">
          [<field name="default_code"/>]
        </span>
        <span>Price: <field name="lst_price"/></span>
      </main>
      <aside class="col-2">
        <field name="image_128" widget="image"/>
      </aside>
    </t>
  </templates>
</kanban>
```

**当前 React 实现能还原的部分**：

- ✅ `<field>` 字段提取 - **可以提取字段列表**
- ✅ `default_group_by` - **支持分组**
- ❌ `<templates>` - **无法解析 QWeb 模板，使用通用卡片布局**
- ❌ `<progressbar>` - **不会渲染进度条**
- ❌ `widget="boolean_favorite"` - **不会渲染收藏按钮**
- ❌ `widget="image"` - **不会渲染图片**
- ❌ `t-if` 条件 - **无法处理 QWeb 条件语句**

---

### 4. Search View (搜索视图)

#### ❌ 完全未实现

| 功能     | Odoo XML 示例                                                     | 状态      |
| -------- | ----------------------------------------------------------------- | --------- |
| 搜索字段 | `xml <field name="name" filter_domain="[...]"/> `                 | ❌ 未实现 |
| 过滤器   | `xml <filter string="Goods" domain="[('type', '=', 'consu')]"/> ` | ❌ 未实现 |
| 分组     | `xml <group> <filter context="{'group_by':'type'}"/> </group> `   | ❌ 未实现 |
| 搜索面板 | `xml <searchpanel> <field name="categ_id"/> </searchpanel> `      | ❌ 未实现 |

---

## 🎯 还原能力总结

### 🟢 可以完全还原的视图类型

- **Graph View**（图表视图）
- **Pivot View**（透视表视图）
- **Calendar View**（日历视图）
- **Gantt View**（甘特图视图）

这些视图相对简单，主要依赖字段和配置，当前实现已经足够。

### 🟡 可以部分还原的视图类型

#### List View（列表视图）

- **还原度：~70%**
- ✅ 基本列定义和布局
- ✅ 字段渲染和排序
- ❌ 批量编辑、可选列等高级功能

#### Form View（表单视图）

- **还原度：~50%**
- ✅ 基本字段和分组
- ✅ 简单布局（colspan/rowspan）
- ❌ **多标签页（notebook/page）** - **关键缺失**
- ❌ 按钮框、讨论区等高级组件
- ❌ 复杂条件表达式

#### Kanban View（看板视图）

- **还原度：~30%**
- ✅ 基本布局和分组
- ✅ 拖拽功能
- ❌ **QWeb 模板解析** - **关键缺失**
- ❌ 自定义卡片布局
- ❌ 进度条等特殊组件

### 🔴 无法还原的视图类型

#### Search View（搜索视图）

- **还原度：0%**
- 完全未实现

---

## 🚧 关键缺失功能（按优先级）

### 🔴 高优先级（影响核心功能）

1. **QWeb 模板引擎**（Kanban View 必需）
   - 需要实现 QWeb 模板解析器
   - 支持 `<templates>`, `<t t-name="card">`, `t-if`, `t-foreach` 等
   - 复杂度：⭐⭐⭐⭐⭐

2. **Notebook/Page 多标签页**（Form View 必需）
   - 解析 `<notebook>` 和 `<page>` 标签
   - 渲染为标签页组件（如 Tabs）
   - 复杂度：⭐⭐⭐

3. **复杂 invisible 表达式**
   - 支持 Python 表达式解析（如 `type != 'combo'`）
   - 需要实现表达式求值引擎
   - 复杂度：⭐⭐⭐⭐

4. **特殊 Widget 实现**
   - `widget="image"` - 图片上传/显示
   - `widget="boolean_favorite"` - 收藏按钮
   - `widget="monetary"` - 货币字段
   - `widget="many2many_tags"` - 多对多标签
   - 复杂度：⭐⭐⭐

### 🟡 中优先级（增强体验）

5. **Button Box（按钮框）**
6. **Chatter（讨论区）**
7. **Progressbar（进度条）**
8. **List View 批量编辑**
9. **Widget 标签解析**

### 🟢 低优先级（锦上添花）

10. 其他细节功能...

---

## 💡 建议

### 短期（快速提升还原度）

1. **实现 Notebook/Page 支持** - 可以快速提升 Form View 还原度到 ~70%
2. **实现常见 Widget** - 提升字段渲染质量
3. **实现 Search View 基础功能** - 补全核心视图类型

### 中期（完善核心功能）

4. **实现 QWeb 模板引擎** - 这是 Kanban View 完全还原的关键
5. **实现复杂表达式解析** - 支持动态显示/隐藏逻辑

### 长期（完整还原）

6. **实现所有高级功能**
7. **性能优化**
8. **完整测试覆盖**

---

## 📝 结论

**当前 React 版本可以部分还原 Odoo XML 视图，但距离完全还原还有较大差距。**

- **简单视图**（Graph、Pivot、Calendar、Gantt）：✅ 可以很好还原
- **中等复杂度视图**（List、基础 Form）：🟡 可以还原核心功能，但缺少高级特性
- **复杂视图**（带 Notebook 的 Form、带 QWeb 的 Kanban）：🔴 只能还原部分功能

**如果要实现接近 Odoo 的视图还原度，需要重点投入：**

1. QWeb 模板引擎（最复杂但最关键）
2. Notebook/Page 多标签页支持
3. 复杂表达式解析引擎
4. 完整的 Widget 组件库
