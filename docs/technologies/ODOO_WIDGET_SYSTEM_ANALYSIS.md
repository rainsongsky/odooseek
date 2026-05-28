# Odoo 19 CE Widget 系统 源码分析

> **来源**: Odoo 19 CE 源码 (`~/EA/odoo`)  
> **核心文件**: `field.js` (registry + mapping), `ir_qweb_fields.py` (QWeb server-side)

---

## 一、两套独立的 Widget 系统

Odoo 有**两层 Widget**，分别服务于不同的渲染上下文：

```
┌──────────────────────────────────────────────────────┐
│              客户端 Widget (OWL)                       │
│  field.js → fieldRegistry → React-like Components     │
│  用于: form / list / kanban 交互视图                   │
│  注册: registry.category("fields").add("monetary",...) │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              服务端 Widget (Python)                    │
│  ir_qweb_fields.py → ir.qweb.field.* 模型              │
│  用于: 报表 / 邮件 / Website QWeb 渲染                  │
│  注册: 继承 models.AbstractModel, _name='ir.qweb.field.X'│
└──────────────────────────────────────────────────────┘
```

**两者独立**——客户端 `widget="monetary"` 与服务器 `ir.qweb.field.monetary` 没有代码共享，仅名称约定一致。

---

## 二、客户端 Widget 系统

### 2.1 注册表架构

**`web/static/src/core/registry.js:64-206`** — `Registry` 类：
- `registry.add(key, value)` — 注册
- `registry.get(key)` — 查找
- `registry.category("fields")` — 创建子注册表

**`web/static/src/views/fields/field.js:15`** — 全局字段注册表：
```javascript
const fieldRegistry = registry.category("fields");
```

### 2.2 Widget 查找算法

**`field.js:122-143`** — `getFieldFromRegistry(fieldType, widget, viewType, jsClass)`:

```
有 widget 属性:
  1. jsClass.widgetName     (如 "crm_kanban.many2one_avatar")
  2. viewType.widgetName    (如 "form.many2many_tags")
  3. widgetName              (如 "monetary")

无 widget 属性 (回退到 field type):
  1. jsClass.fieldType
  2. viewType.fieldType     (如 "list.char" 与 "form.char" 可有不同注册)
  3. fieldType              (如 "char")
  4. DefaultField (空组件)
  
兼容性: 如果 widget.supportedTypes 不包含 fieldType，发出 console.warn
```

### 2.3 注册条目接口

每个注册条目是一个描述对象，核心字段：

```javascript
{
  component: Component,         // OWL 组件类 (唯一必填)
  supportedTypes: ["float", "monetary"],  // 可选：支持的类型
  supportedOptions: [...],      // 可选：支持的 t-options
  extractProps: (fieldInfo) => ({...}),  // 可选：从 fieldInfo 提取 props
  // ... 共 16 个可选字段
}
```

### 2.4 核心源码

| 文件 | 行号 | 内容 |
|------|------|------|
| `web/static/src/core/registry.js` | 64-209 | Registry 类 + 全局 singleton |
| `web/static/src/views/fields/field.js` | 15 | `fieldRegistry` 创建 |
| | 122-143 | `getFieldFromRegistry()` 查找算法 |
| | 224-355 | `Field.parseFieldNode()` — 从 XML `<field>` 解析 |

---

## 三、客户端 Widget 目录

### 3.1 完整 Widget 列表 (60+)

**目录**: `odoo/addons/web/static/src/views/fields/`

| 类别 | Widget 名 | 文件 | 行 |
|------|----------|------|-----|
| **基础输入** | `char` | `char/char_field.js` | 126 |
| | `text` | `text/text_field.js` | 124 |
| | `integer` | `integer/integer_field.js` | 126 |
| | `float` | `float/float_field.js` | 160 |
| | `boolean` | `boolean/boolean_field.js` | 38 |
| **布尔变体** | `boolean_toggle` | `boolean_toggle/boolean_toggle_field.js` | 42 |
| | `boolean_icon` | `boolean_icon/boolean_icon_field.js` | 39 |
| | `boolean_favorite` | `boolean_favorite/boolean_favorite_field.js` | 62 |
| **选择** | `selection` | `selection/selection_field.js` | 133 |
| | `radio` | `radio/radio_field.js` | 97 |
| | `selection_badge` | `badge_selection/badge_selection_field.js` | 119 |
| | `label_selection` | `label_selection/label_selection_field.js` | 44 |
| | `filterable_selection` | `selection/filterable_selection_field.js` | 77 |
| | `state_selection` | `state_selection/state_selection_field.js` | 106 |
| **关联** | `many2one` | `many2one/many2one_field.js` | 122 |
| | `many2one_avatar` | `many2one_avatar/many2one_avatar_field.js` | 33 |
| | `many2one_avatar_user` | `mail/../many2one_avatar_user_field.js` | 63 |
| | `many2one_barcode` | `many2one_barcode/many2one_barcode_field.js` | 23 |
| | `many2many_tags` | `many2many_tags/many2many_tags_field.js` | 281 |
| | `form.many2many_tags` | 同上 | 390 |
| | `many2many_tags_avatar` | `many2many_tags_avatar/many2many_tags_avatar_field.js` | 42 |
| | `many2many_checkboxes` | `many2many_checkboxes/many2many_checkboxes_field.js` | 90 |
| | `one2many` / `many2many` | `x2many/x2many_field.js` | 351-352 |
| **货币/数字** | `monetary` | `monetary/monetary_field.js` | 132 |
| | `percentage` | `percentage/percentage_field.js` | 60 |
| | `float_time` | `float_time/float_time_field.js` | 62 |
| | `float_factor` | `float_factor/float_factor_field.js` | 42 |
| | `float_toggle` | `float_toggle/float_toggle_field.js` | 102 |
| **特殊字段** | `url` / `form.url` | `url/url_field.js` | 60-71 |
| | `phone` / `form.phone` | `phone/phone_field.js` | 40-51 |
| | `email` / `form.email` | `email/email_field.js` | 37-48 |
| | `image` | `image/image_field.js` | 313 |
| | `binary` / `list.binary` | `binary/binary_field.js` | 105-106 |
| | `html` | `html/html_field.js` | 13 |
| | `json` | `json/json_field.js` | 24 |
| | `reference` | `reference/reference_field.js` | 247 |
| | `domain` | `domain/domain_field.js` | 341 |
| | `properties` | `properties/properties_field.js` | 1007 |
| **看板/表单特定** | `priority` | `priority/priority_field.js` | 111 |
| | `statusbar` | `statusbar/statusbar_field.js` | 371 |
| | `handle` | `handle/handle_field.js` | 27 |
| | `badge` | `badge/badge_field.js` | 66 |
| | `statinfo` | `stat_info/stat_info_field.js` | 66 |
| | `kanban_activity` | `mail/../kanban_activity/kanban_activity.js` | 32 |
| **颜色/图表** | `color` | `color/color_field.js` | 26 |
| | `color_picker` | `color_picker/color_picker_field.js` | 36 |
| | `kanban_color_picker` | `kanban_color_picker/kanban_color_picker_field.js` | 31 |
| | `gauge` | `gauge/gauge_field.js` | 129 |
| | `percentpie` | `percent_pie/percent_pie_field.js` | 33 |
| | `progressbar` | `progress_bar/progress_bar_field.js` | 166 |
| | `kanban.progressbar` | `progress_bar/kanban_progress_bar_field.js` | 15 |
| **文件/签名** | `signature` | `signature/signature_field.js` | 180 |
| | `pdf_viewer` | `pdf_viewer/pdf_viewer_field.js` | 112 |
| | `ace` / `code` | `ace/ace_field.js` | 82-83 |
| | `image_url` | `image_url/image_url_field.js` | 68 |
| | `attachment_image` | `attachment_image/attachment_image_field.js` | 18 |
| | `copy_clipboard` | `copy_clipboard/copy_clipboard_field.js` | 96-114 |
| **工具** | `contact_image` | `contact_image/contact_image_field.js` | 47 |
| | `remaining_days` | `remaining_days/remaining_days_field.js` | 96 |
| | `daterange` | `datetime/` | — |

---

## 四、服务端 Widget 系统

### 4.1 架构

`ir.qweb.field.*` 模型（`ir_qweb_fields.py`）—— 用于 QWeb 模板中的 `<t t-field="..." t-options-widget="...">`。

**名称映射**（`ir_qweb.py:2692`）:
```python
field_options['type'] = field_options.get('widget', field.type)
```
然后查找模型: `ir.qweb.field.{field_options['type']}`。

### 4.2 21 种服务端 Widget

**`base/models/ir_qweb_fields.py`**:

| 模型名 | 类 | 行 |
|--------|-----|-----|
| `ir.qweb.field` | IrQwebField (基类) | 47 |
| `ir.qweb.field.integer` | Integer | 184 |
| `ir.qweb.field.float` | Float | 205 |
| `ir.qweb.field.date` | Date | 250 |
| `ir.qweb.field.datetime` | Datetime | 268 |
| `ir.qweb.field.text` | Text | 326 |
| `ir.qweb.field.selection` | Selection | 339 |
| `ir.qweb.field.many2one` | Many2one | 368 |
| `ir.qweb.field.many2many` | Many2many | 383 |
| `ir.qweb.field.one2many` | One2many | 396 |
| `ir.qweb.field.html` | Html | 409 |
| `ir.qweb.field.image` | Image | 429 |
| `ir.qweb.field.image_url` | Image_Url | 469 |
| `ir.qweb.field.monetary` | Monetary | 482 |
| `ir.qweb.field.float_time` | Float_Time | 588 |
| `ir.qweb.field.time` | Time | 603 |
| `ir.qweb.field.duration` | Duration | 629 |
| `ir.qweb.field.relative` | Relative | 736 |
| `ir.qweb.field.barcode` | Barcode | 768 |
| `ir.qweb.field.contact` | Contact | 812 |
| `ir.qweb.field.qweb` | Qweb (嵌套) | 889 |

---

## 五、Field type vs Widget — 两维映射

### 5.1 Odoo 的映射规则

| 维度 | 来源 | 作用 |
|------|------|------|
| **Field type** | Python Model (`fields.Char()`, `fields.Many2one()`) | ORM 行为: 存储、校验、关系 |
| **Widget** | View XML (`<field widget="...">`) | 渲染行为: 如何显示和编辑 |

### 5.2 查找优先级

```
1. 显式 widget 属性 → widgetRegistry[widget]
2. 无 widget 属性 → widgetRegistry[field.type]
3. 都找不到 → DefaultField
```

### 5.3 OdooSeek 当前映射

```typescript
// field-widgets.tsx — 仅按 field type 映射
TYPE_WIDGETS: Record<string, ComponentType> = {
  char: CharWidget,
  many2one: Many2OneWidget,
  monetary: FloatWidget,     // ← 未区分 widget
  ...
}
```

### 5.4 OdooSeek 改造建议

应支持两层查找：先看 `field.widget`，回退到 `field.type`：

```typescript
export function getFieldWidget(field: FieldElement, type: string) {
  if (field.widget && WIDGET_OVERRIDES[field.widget]) {
    return WIDGET_OVERRIDES[field.widget]
  }
  return TYPE_WIDGETS[type] ?? CharWidget
}
```

---

## 六、关键源码索引

| 关注点 | 文件 | 行号 |
|--------|------|------|
| Registry 类 | `web/static/src/core/registry.js` | 64-209 |
| fieldRegistry 创建 | `web/static/src/views/fields/field.js` | 15 |
| Widget 查找算法 | `web/static/src/views/fields/field.js` | 122-143 |
| XML `<field>` 解析 | `web/static/src/views/fields/field.js` | 224-355 |
| 字段注册入口对象规范 | `web/static/src/views/fields/field.js` | 65-115 |
| 服务端 QWeb field 基类 | `base/models/ir_qweb_fields.py` | 47 |
| Widget → 模型名映射 | `base/models/ir_qweb.py` | 2692 |
| `_get_field()` 方法 | `base/models/ir_qweb.py` | 2679-2709 |
| `_get_widget()` 方法 | `base/models/ir_qweb.py` | 2711-2735 |
| avatar 自动检测 (many2one) | `web/static/.../field.js` | 197-202 |
| avatar 自动检测 (list) | `mail/static/.../list_renderer.js` | 9-11 |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**来源**: Odoo 19 CE 源码 (`~/EA/odoo`)  
**维护团队**: OdooSeek
