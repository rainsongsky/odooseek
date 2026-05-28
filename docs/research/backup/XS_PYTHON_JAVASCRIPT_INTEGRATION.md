# Odoo 模块中 Python 与 JavaScript 混合架构机制详解

## 概述

Odoo 是一个全栈 ERP 框架，其核心特性之一是在同一个模块（addon）中可以同时包含 Python 后端代码和 JavaScript 前端代码。这种设计允许开发者在单一模块中实现完整的功能，无需分离前后端项目。本文档详细阐述这种混合架构的机制和原理。

## 目录结构

```
odoo/addons/web/
├── __init__.py                    # Python 模块初始化
├── __manifest__.py                # 模块清单文件（定义 assets）
├── controllers/                   # Python 后端控制器
│   ├── __init__.py
│   ├── view.py                    # 视图相关 API
│   ├── webclient.py               # Web 客户端控制器
│   └── ...
├── models/                        # Python 数据模型
│   ├── __init__.py
│   └── ir_ui_view.py              # 视图模型扩展
├── static/                        # 前端静态资源目录
│   ├── src/                       # JavaScript 源代码
│   │   ├── core/                  # 核心框架代码
│   │   ├── views/                 # 视图组件
│   │   ├── webclient/             # Web 客户端代码
│   │   └── ...
│   ├── lib/                       # 第三方 JavaScript 库
│   ├── tests/                     # JavaScript 测试
│   └── ...
└── views/                         # XML 视图定义
    └── ...
```

## 核心机制

### 1. 静态资源服务机制

#### 1.1 HTTP 路由处理

Odoo 的 HTTP 框架会自动处理静态资源请求。当浏览器请求 `/web/static/src/views/view.js` 时，Odoo 会通过以下流程处理：

**代码位置**: `odoo/odoo/http.py`

```python
def _serve_static(self):
    """ Serve a static file from the file system. """
    module, _, path = self.httprequest.path[1:].partition('/static/')
    try:
        directory = root.static_path(module)
        if not directory:
            raise NotFound(f'Module "{module}" not found.\n')
        filepath = werkzeug.security.safe_join(directory, path)
        debug = (
            'assets' in self.session.debug and
            ' wkhtmltopdf ' not in self.httprequest.user_agent.string
        )
        res = Stream.from_path(filepath, public=True).get_response(
            max_age=0 if debug else STATIC_CACHE,
            content_security_policy=None,
        )
        root.set_csp(res)
        return res
    except OSError:
        raise NotFound(f'File "{path}" not found in module {module}.\n')
```

**处理流程**：

1. **路径解析**: 从 URL 中提取模块名（如 `web`）和文件路径（如 `src/views/view.js`）
2. **模块查找**: 通过 `root.static_path(module)` 查找模块的 `static` 目录
3. **文件定位**: 使用 `safe_join` 安全地拼接文件路径
4. **缓存控制**: 根据调试模式决定是否启用缓存
5. **文件返回**: 返回文件内容，设置适当的 MIME 类型和 CSP 策略

#### 1.2 模块静态路径映射

**代码位置**: `odoo/odoo/http.py` - `Application.static_path()`

```python
def static_path(self, module_name: str) -> str | None:
    """
    Map module names to their absolute ``static`` path on the file
    system.
    """
    manifest = module_manager.Manifest.for_addon(module_name, display_warning=False)
    return manifest.static_path if manifest is not None else None
```

该方法通过模块清单文件（`__manifest__.py`）获取模块的静态资源目录路径。

### 2. Assets Bundle 系统

#### 2.1 概述

Assets Bundle 是 Odoo 的核心资源管理系统，它负责：

- **资源收集**: 从多个模块收集 JavaScript、CSS、XML 模板文件
- **依赖管理**: 处理模块间的依赖关系和加载顺序
- **打包优化**: 在生产环境合并、压缩资源文件
- **缓存管理**: 通过版本号控制资源缓存

#### 2.2 清单文件配置

**代码位置**: `odoo/addons/web/__manifest__.py`

每个模块的 `__manifest__.py` 文件中可以定义 `assets` 字典，声明资源包（bundle）：

```python
{
    'name': 'Web',
    'assets': {
        'web.assets_backend': [
            # 包含其他 bundle
            ('include', 'web._assets_core'),

            # 单个文件
            'web/static/src/core/utils/transitions.scss',

            # 通配符匹配
            'web/static/src/views/**/*',

            # 排除文件
            ('remove', 'web/static/src/views/graph/**'),

            # 在指定位置后插入
            ('after', 'web/static/src/scss/utils.scss', 'web/static/src/custom.scss'),
        ],
    }
}
```

**资源指令类型**：

- `'path'`: 直接添加文件或匹配模式
- `('include', 'bundle_name')`: 包含其他 bundle
- `('remove', 'path')`: 移除匹配的文件
- `('prepend', 'path')`: 在 bundle 开头插入
- `('append', 'path')`: 在 bundle 末尾追加
- `('before', 'target', 'path')`: 在目标文件前插入
- `('after', 'target', 'path')`: 在目标文件后插入

#### 2.3 资源路径解析

**代码位置**: `odoo/odoo/addons/base/models/ir_asset.py`

`IrAsset` 模型负责解析和收集资源路径：

```python
def _get_asset_paths(self, bundle, assets_params):
    """
    Fetches all asset file paths from a given list of addons matching a
    certain bundle.

    Asset loading is performed as follows:

    1. All 'ir.asset' records matching the given bundle and with a sequence
       strictly less than 16 are applied.

    2. The manifests of the given addons are checked for assets declaration
       for the given bundle. If any, they are read sequentially and their
       operations are applied to the current list.

    3. After all manifests have been parsed, the remaining 'ir.asset'
       records matching the bundle are also applied to the current list.
    """
    installed = self._get_installed_addons_list()
    addons = self._get_active_addons_list(**assets_params)

    asset_paths = AssetPaths()
    addons = self._topological_sort(tuple(addons))

    self._fill_asset_paths(bundle, asset_paths, [], addons, installed, **assets_params)
    return asset_paths.list
```

**处理顺序**：

1. **数据库记录优先**: 处理 `ir.asset` 模型中序列号 < 16 的记录
2. **清单文件处理**: 按模块依赖顺序处理各模块的 `__manifest__.py` 中的 assets 声明
3. **数据库记录补充**: 处理剩余的 `ir.asset` 记录（序列号 >= 16）

#### 2.4 Bundle 编译与打包

**代码位置**: `odoo/odoo/addons/base/models/assetsbundle.py`

`AssetsBundle` 类负责资源的编译、合并和打包：

```python
class AssetsBundle(object):
    def __init__(self, name, files, external_assets=(), env=None,
                 css=True, js=True, debug_assets=False, rtl=False,
                 assets_params=None, autoprefix=False):
        self.name = name
        self.javascripts = []
        self.templates = []
        self.stylesheets = []
        self.files = files
        # ...
```

**JavaScript 打包流程**：

```python
def js(self):
    is_minified = not self.is_debug_assets
    extension = 'min.js' if is_minified else 'js'
    js_attachment = self.get_attachments(extension)

    if not js_attachment:
        template_bundle = ''
        if self.templates:
            templates = self.generate_xml_bundle()
            template_bundle = textwrap.dedent(f"""
                odoo.define("{self.name}.bundle.xml", ["@web/core/templates"], function(require) {{
                    "use strict";
                    const {{ checkPrimaryTemplateParents, registerTemplate, registerTemplateExtension }} = require("@web/core/templates");
                    {templates}
                }});
            """)

        if is_minified:
            content_bundle = ';\n'.join(asset.minify() for asset in self.javascripts)
            content_bundle += template_bundle
            js_attachment = self.save_attachment(extension, content_bundle)
        else:
            js_attachment = self.js_with_sourcemap(template_bundle=template_bundle)

    return js_attachment[0]
```

**关键步骤**：

1. **文件收集**: 从 `files` 列表中读取所有 JavaScript 文件
2. **模板处理**: 将 XML 模板转换为 JavaScript 代码
3. **代码转换**: 使用 `js_transpiler` 转换 ES6+ 代码（如需要）
4. **压缩优化**: 生产环境使用 `rjsmin` 压缩代码
5. **保存附件**: 将打包后的文件保存到 `ir.attachment` 模型
6. **版本控制**: 通过内容哈希生成唯一版本号

**CSS 打包流程**：

```python
def css(self):
    is_minified = not self.is_debug_assets
    extension = 'min.css' if is_minified else 'css'
    attachments = self.get_attachments(extension)
    if attachments:
        return attachments

    css = self.preprocess_css()
    # ... 错误处理 ...

    if is_minified:
        css_attachment = self.save_attachment(extension, css)
    else:
        css_attachment = self.css_with_sourcemap(css)

    return css_attachment
```

**CSS 预处理**：

- SCSS/SASS 编译（通过外部工具）
- `@import` 语句解析和合并
- RTL（从右到左）支持
- Autoprefixer 自动添加浏览器前缀

#### 2.5 资源版本与缓存

**版本号生成**：

```python
def get_version(self, asset_type):
    """Returns the version of the bundle for the given asset type."""
    checksums = []
    for asset in self.get_assets(asset_type):
        checksums.append(asset.get_checksum())
    return hashlib.sha1(''.join(checksums).encode()).hexdigest()[:7]
```

版本号基于所有资源文件的校验和生成，确保文件变更时版本号自动更新。

**缓存策略**：

- **开发模式**: `max_age=0`，禁用缓存，实时反映代码变更
- **生产模式**: 使用长期缓存，通过版本号 URL 参数控制更新
- **Bundle 变更通知**: 通过 `bus.bus` 向客户端发送更新通知

### 3. Python 与 JavaScript 的协作

#### 3.1 后端 API 提供

**代码位置**: `odoo/addons/web/controllers/view.py`

Python 控制器通过 `@route` 装饰器定义 API 端点：

```python
class View(Controller):
    @route('/web/view/edit_custom', type='jsonrpc', auth="user")
    def edit_custom(self, custom_id, arch):
        """
        Edit a custom view

        :param int custom_id: the id of the edited custom view
        :param str arch: the edited arch of the custom view
        :returns: dict with acknowledged operation (result set to True)
        """
        custom_view = request.env['ir.ui.view.custom'].sudo().browse(custom_id)
        if not custom_view.user_id == request.env.user:
            raise AccessError(_(
                "Custom view %(view)s does not belong to user %(user)s",
                view=custom_id,
                user=self.env.user.login,
            ))
        custom_view.write({'arch': arch})
        return {'result': True}
```

**路由类型**：

- `type='http'`: 标准 HTTP 请求/响应
- `type='json'`: JSON-RPC 2.0 请求
- `type='jsonrpc'`: 兼容旧版 JSON-RPC

#### 3.2 前端 API 调用

JavaScript 代码通过 RPC 调用后端 API：

```javascript
// 使用 Odoo 的 RPC 服务
import { rpc } from "@web/core/network/rpc";

async function editCustomView(customId, arch) {
  const result = await rpc("/web/view/edit_custom", {
    params: {
      custom_id: customId,
      arch: arch,
    },
  });
  return result;
}
```

#### 3.3 数据模型交互

**后端模型定义**：

```python
# odoo/addons/web/models/ir_ui_view.py
class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    def get_view_info(self):
        """返回视图类型信息供前端使用"""
        return self._get_view_info()
```

**前端数据获取**：

```javascript
// 通过 ORM 服务获取数据
import { useService } from "@web/core/utils/hooks";

function MyComponent() {
  const orm = useService("orm");

  async function loadView(viewId) {
    const viewInfo = await orm.call("ir.ui.view", "get_view_info", [viewId]);
    return viewInfo;
  }
}
```

### 4. 模块依赖与加载顺序

#### 4.1 模块依赖声明

在 `__manifest__.py` 中声明依赖：

```python
{
    'name': 'Web',
    'depends': ['base'],  # 依赖 base 模块
    'auto_install': True,  # 自动安装
}
```

#### 4.2 资源加载顺序

资源加载遵循模块依赖的拓扑排序：

1. **基础模块优先**: `base` 模块的资源先加载
2. **依赖链顺序**: 按照依赖关系依次加载
3. **同层模块顺序**: 相同依赖层级的模块按字母顺序加载

**代码位置**: `odoo/odoo/addons/base/models/ir_asset.py`

```python
def _fill_asset_paths(self, bundle, asset_paths, seen, addons, installed, **assets_params):
    # ...
    addons = self._topological_sort(tuple(addons))

    for addon in addons:
        for command in Manifest.for_addon(addon)['assets'].get(bundle, ()):
            directive, target, path_def = self._process_command(command)
            self._process_path(bundle, directive, target, path_def, ...)
```

### 5. 开发模式与生产模式

#### 5.1 开发模式特性

**启用方式**: 在 URL 中添加 `?debug=assets` 参数

**特性**：

- **未压缩代码**: 保持原始格式，便于调试
- **Source Maps**: 生成 source map 文件，支持浏览器调试
- **实时更新**: 禁用缓存，代码变更立即生效
- **单独文件**: 不合并文件，每个文件独立加载

#### 5.2 生产模式特性

**特性**：

- **代码压缩**: 使用 `rjsmin` 压缩 JavaScript
- **文件合并**: 多个文件合并为单个 bundle
- **长期缓存**: 通过版本号 URL 实现缓存控制
- **性能优化**: 减少 HTTP 请求，提升加载速度

### 6. XML 模板系统

#### 6.1 模板定义

XML 模板文件定义前端组件的结构：

```xml
<!-- web/static/src/views/list/list_view.xml -->
<templates>
    <t t-name="web.ListView">
        <div class="o_list_view">
            <table class="o_list_table table">
                <!-- ... -->
            </table>
        </div>
    </t>
</templates>
```

#### 6.2 模板编译

XML 模板会被编译为 JavaScript 代码：

```python
def generate_xml_bundle(self):
    """将 XML 模板转换为 JavaScript 注册代码"""
    content = []
    for block in self.xml():
        if block["type"] == "templates":
            for (element, url, inherit_from) in block["templates"]:
                template = get_template(element)
                content.append(f'registerTemplate("{name}", `{url}`, `{template}`);')
        else:
            for inherit_from, elements in block["extensions"].items():
                for (element, url) in elements:
                    template = get_template(element)
                    content.append(f'registerTemplateExtension("{inherit_from}", `{url}`, `{template}`);')
    return '\n'.join(content)
```

#### 6.3 模板继承

Odoo 支持模板继承机制：

```xml
<!-- 扩展模板 -->
<t t-name="web.ListView" t-inherit="web.ListView" t-inherit-mode="extension">
    <xpath expr="//table" position="inside">
        <div class="custom-content">Custom content</div>
    </xpath>
</t>
```

### 7. QWeb 模板引擎：前后端统一的模板系统

QWeb 是 Odoo 自研的模板引擎，它在 Python 后端和 JavaScript 前端都有实现，是连接前后端的重要桥梁。

#### 7.1 QWeb 的双重实现

**Python 端实现**（服务器端渲染）：

- **代码位置**: `odoo/odoo/tools/qweb.py`
- **用途**: 报表生成、邮件模板、服务器端 HTML 渲染
- **特点**: 在 Python 环境中执行，可以访问 ORM 模型和业务逻辑

**JavaScript 端实现**（客户端渲染）：

- **代码位置**: `odoo/addons/web/static/src/core/qweb/qweb.js`
- **用途**: 前端组件模板、动态视图渲染
- **特点**: 在浏览器中执行，与 OWL 框架集成

#### 7.2 QWeb 在前后端集成中的作用

**1. 统一的模板语法**

前后端使用相同的 QWeb 语法，降低了学习成本：

```xml
<!-- 前后端通用的 QWeb 语法 -->
<t t-name="example.template">
    <div t-if="condition">
        <span t-esc="value"/>
        <ul>
            <li t-foreach="items" t-as="item" t-esc="item.name"/>
        </ul>
    </div>
</t>
```

**2. 服务器端报表渲染**

Python 控制器使用 QWeb 渲染报表：

```python
# odoo/addons/web/controllers/report.py
from odoo.http import request
from odoo.tools import qweb

class ReportController(Controller):
    @route('/report/html/<report_name>', type='http', auth='user')
    def report_html(self, report_name, **kwargs):
        # 获取报表数据
        report = request.env['ir.actions.report']._get_report_from_name(report_name)
        records = request.env[report.model].browse(kwargs.get('docids', []))

        # 使用 QWeb 渲染模板
        html = request.env['ir.qweb']._render(
            report.report_name,
            {'docs': records, 'o': request.env}
        )
        return request.make_response(html)
```

**3. 前端组件模板**

JavaScript 组件使用 QWeb 模板：

```javascript
// web/static/src/views/list/list_view.js
import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";

export class ListView extends Component {
  static template = "web.ListView";
  // ...
}

// web/static/src/views/list/list_view.xml
<templates>
  <t t-name="web.ListView">
    <div class="o_list_view">
      <table class="o_list_table">
        <thead>
          <tr>
            <th t-foreach="props.columns" t-as="col" t-esc="col.label" />
          </tr>
        </thead>
        <tbody>
          <tr t-foreach="props.records" t-as="record">
            <td t-foreach="props.columns" t-as="col">
              <t t-esc="record[col.name]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </t>
</templates>;
```

#### 7.3 QWeb 模板的存储与加载

**存储位置**：

1. **数据库存储**（`ir.ui.view` 模型）：
   - 视图定义存储在数据库中
   - 支持动态修改和继承
   - 代码位置: `odoo/addons/base/models/ir_ui_view.py`

2. **文件系统存储**（XML 文件）：
   - 模块的 `views/` 目录或 `static/src/**/*.xml`
   - 在模块安装时加载到数据库
   - 支持版本控制和代码审查

**加载流程**：

```python
# odoo/odoo/addons/base/models/ir_ui_view.py
class IrUiView(models.Model):
    _name = 'ir.ui.view'

    def _read_template(self, template_id):
        """读取模板内容"""
        view = self.browse(template_id)
        return view.arch

    def _get_view(self, view_id, model=None):
        """获取视图，包括继承链"""
        view = self.browse(view_id)
        # 处理继承链
        arch = self._apply_inheritance_specs(view.arch, view.inherit_id)
        return arch
```

#### 7.4 QWeb 模板编译机制

**前端模板编译**（Assets Bundle 中）：

```python
# odoo/odoo/addons/base/models/assetsbundle.py
def generate_xml_bundle(self):
    """将 XML 模板编译为 JavaScript 代码"""
    content = []
    for block in self.xml():
        if block["type"] == "templates":
            for (element, url, inherit_from) in block["templates"]:
                # 提取模板内容
                template_xml = etree.tostring(element, encoding='unicode')
                # 生成 JavaScript 注册代码
                content.append(
                    f'registerTemplate("{name}", `{url}`, `{template_xml}`);'
                )
        elif block["type"] == "extensions":
            for inherit_from, elements in block["extensions"].items():
                for (element, url) in elements:
                    template_xml = etree.tostring(element, encoding='unicode')
                    content.append(
                        f'registerTemplateExtension("{inherit_from}", `{url}`, `{template_xml}`);'
                    )
    return '\n'.join(content)
```

**后端模板渲染**（Python QWeb）：

```python
# odoo/odoo/tools/qweb.py
class QWeb:
    def render(self, template_id, values=None, **options):
        """渲染 QWeb 模板"""
        # 1. 获取模板内容
        arch = self._get_template(template_id)

        # 2. 解析模板为 AST
        ast = self._parse(arch)

        # 3. 编译为 Python 函数
        compiled = self._compile(ast)

        # 4. 执行渲染
        return compiled(values or {})
```

#### 7.5 QWeb 表达式求值

**Python 端表达式**：

```python
# QWeb 表达式在 Python 环境中求值
# 可以访问 ORM 模型、方法、属性
<t t-esc="record.name"/>                    # 访问记录字段
<t t-esc="record.compute_field()"/>         # 调用方法
<t t-esc="sum(line.amount for line in lines)"/>  # Python 表达式
```

**JavaScript 端表达式**：

```javascript
// QWeb 表达式在 JavaScript 环境中求值
// 可以访问组件 props、state、env
<t t-esc="props.value"/>                    // 访问 props
<t t-esc="state.count"/>                    // 访问状态
<t t-esc="env.services.orm"/>               // 访问服务
<t t-esc="items.map(i => i.name).join(',')"/> // JavaScript 表达式
```

#### 7.6 QWeb 模板继承与扩展

**继承机制**：

```xml
<!-- 基础模板 -->
<t t-name="base.template">
    <div class="container">
        <div class="header">Header</div>
        <div class="content">
            <t t-slot="content">Default content</t>
        </div>
    </div>
</t>

<!-- 扩展模板 -->
<t t-name="extended.template" t-inherit="base.template" t-inherit-mode="extension">
    <xpath expr="//div[@class='content']" position="inside">
        <div class="custom-section">Custom content</div>
    </xpath>
</t>
```

**继承模式**：

- `extension`: 在原有模板基础上扩展（默认）
- `primary`: 创建新模板，但可以引用原模板
- `before`/`after`: 在指定位置插入内容

#### 7.7 QWeb 与 RPC 数据交互

**后端提供数据**：

```python
# 控制器提供数据给 QWeb 模板
class ReportController(Controller):
    @route('/report/custom', type='http', auth='user')
    def custom_report(self, **kwargs):
        # 准备数据
        data = {
            'records': request.env['res.partner'].search([]),
            'company': request.env.company,
            'user': request.env.user,
        }
        # 渲染模板
        html = request.env['ir.qweb']._render('my_module.custom_report', data)
        return request.make_response(html)
```

**前端获取数据**：

```javascript
// 前端组件通过 RPC 获取数据，然后传递给 QWeb 模板
import { Component, useState, onWillStart } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";

export class MyComponent extends Component {
  static template = "my_module.MyComponent";

  setup() {
    this.state = useState({ records: [] });

    onWillStart(async () => {
      // 通过 RPC 获取数据
      this.state.records = await rpc("/web/dataset/call_kw", {
        params: {
          model: "res.partner",
          method: "search_read",
          args: [[]],
          kwargs: {},
        },
      });
    });
  }
}
```

```xml
<!-- 模板使用数据 -->
<t t-name="my_module.MyComponent">
    <div t-foreach="state.records" t-as="record">
        <span t-esc="record.name"/>
    </div>
</t>
```

#### 7.8 QWeb 在报表生成中的完整流程

```
1. 用户请求报表
   ↓
2. Python 控制器接收请求
   ↓
3. 从 ir.actions.report 获取报表配置
   ↓
4. 查询业务数据（ORM）
   ↓
5. 准备渲染上下文（包含数据、公司信息、用户信息等）
   ↓
6. 使用 Python QWeb 渲染模板
   - 解析 QWeb 语法
   - 执行表达式求值
   - 生成 HTML
   ↓
7. 应用报表样式（CSS）
   ↓
8. 转换为 PDF（wkhtmltopdf/WeasyPrint）
   ↓
9. 返回 PDF 文件
```

#### 7.9 QWeb 指令详解

**核心指令**：

| 指令        | 说明               | 示例                                         |
| ----------- | ------------------ | -------------------------------------------- |
| `t-esc`     | 转义输出（安全）   | `<span t-esc="value"/>`                      |
| `t-raw`     | 原始输出（需谨慎） | `<div t-raw="html_content"/>`                |
| `t-if`      | 条件渲染           | `<div t-if="condition">...</div>`            |
| `t-foreach` | 循环渲染           | `<li t-foreach="items" t-as="item">...</li>` |
| `t-set`     | 设置变量           | `<t t-set="name" t-value="expression"/>`     |
| `t-call`    | 调用模板           | `<t t-call="other.template"/>`               |
| `t-att-*`   | 动态属性           | `<div t-att-class="css_class"/>`             |
| `t-attf-*`  | 格式化属性         | `<div t-attf-class="prefix-{{value}}"/>`     |

**属性指令**：

```xml
<!-- 动态设置属性 -->
<div t-att-id="record.id" t-att-class="record.active ? 'active' : 'inactive'">
    Content
</div>

<!-- 格式化属性 -->
<div t-attf-id="item-{{index}}-{{record.id}}">
    Content
</div>
```

#### 7.10 QWeb 最佳实践

**1. 安全性**：

- 优先使用 `t-esc` 而非 `t-raw`
- 对用户输入进行验证和转义
- 避免在模板中执行危险操作

**2. 性能**：

- 避免在模板中进行复杂计算
- 将业务逻辑放在 Python 模型或 JavaScript 组件中
- 使用 `t-set` 缓存计算结果

**3. 可维护性**：

- 使用模板继承而非复制
- 保持模板简洁，复杂逻辑提取到方法中
- 使用有意义的模板名称

**4. 前后端一致性**：

- 保持前后端 QWeb 语法一致
- 注意表达式环境的差异（Python vs JavaScript）
- 测试前后端渲染结果的一致性

### 8. 资源加载流程

#### 7.1 完整加载流程

```
1. 浏览器请求页面
   ↓
2. Odoo 渲染 HTML 模板（包含 assets bundle 引用）
   ↓
3. 浏览器解析 HTML，发现 <script> 和 <link> 标签
   ↓
4. 请求 assets bundle URL: /web/assets/{version}/{bundle_name}.js
   ↓
5. Odoo 检查缓存，如不存在则：
   a. 解析 __manifest__.py 中的 assets 配置
   b. 收集所有相关文件
   c. 编译 SCSS、转换 JavaScript
   d. 合并、压缩（生产模式）
   e. 保存到 ir.attachment
   ↓
6. 返回打包后的资源文件
   ↓
7. 浏览器执行 JavaScript，初始化前端应用
   ↓
8. 前端通过 RPC 调用后端 API 获取数据
   ↓
9. 渲染视图，用户交互
```

#### 7.2 Bundle URL 格式

**开发模式**:

```
/web/assets/debug/web.assets_backend.js
```

**生产模式**:

```
/web/assets/abc1234/web.assets_backend.min.js
```

其中 `abc1234` 是版本号（7 位哈希值）。

### 8. 扩展机制

#### 8.1 模块扩展 Assets

其他模块可以通过 `__manifest__.py` 扩展现有 bundle：

```python
# 在自定义模块中
{
    'name': 'My Custom Module',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            # 在 web.assets_backend 中添加自定义文件
            'my_module/static/src/js/custom.js',
            'my_module/static/src/css/custom.scss',
        ],
    }
}
```

#### 8.2 数据库扩展 Assets

通过 `ir.asset` 模型动态添加资源：

```python
self.env['ir.asset'].create({
    'name': 'Custom Asset',
    'bundle': 'web.assets_backend',
    'path': 'my_module/static/src/js/custom.js',
    'directive': 'append',
})
```

### 9. 最佳实践

#### 9.1 目录组织

```
my_module/
├── static/
│   ├── src/
│   │   ├── js/          # JavaScript 文件
│   │   ├── css/         # CSS 文件
│   │   ├── scss/        # SCSS 文件
│   │   └── xml/         # XML 模板
│   └── lib/             # 第三方库
```

#### 9.2 命名规范

- **Bundle 命名**: `{module_name}.assets_{purpose}`
- **文件命名**: 使用小写字母和下划线
- **组件命名**: 遵循 Odoo 前端框架规范

#### 9.3 性能优化

- **按需加载**: 使用 lazy bundle 延迟加载非关键资源
- **代码分割**: 将大型功能拆分为独立 bundle
- **资源压缩**: 生产环境启用压缩和合并

### 10. 调试技巧

#### 10.1 启用调试模式

在 URL 中添加参数：

```
?debug=assets
```

#### 10.2 查看 Bundle 内容

访问：

```
/web/assets/debug/web.assets_backend.js
```

#### 10.3 检查资源加载

- 浏览器开发者工具 → Network 标签
- 查看资源请求和响应
- 检查 Source Maps（开发模式）

### 11. 常见问题

#### 11.1 资源未加载

**可能原因**：

- 文件路径错误
- Bundle 名称拼写错误
- 模块未安装或未激活

**解决方法**：

- 检查 `__manifest__.py` 中的 assets 配置
- 确认文件存在于 `static/` 目录
- 重启 Odoo 服务并更新模块

#### 11.2 缓存问题

**解决方法**：

- 开发时使用 `?debug=assets`
- 清除浏览器缓存
- 重启 Odoo 服务清除服务器端缓存

#### 11.3 依赖顺序问题

**解决方法**：

- 检查模块依赖声明
- 使用 `('before', ...)` 或 `('after', ...)` 指令调整顺序
- 查看模块加载日志

### 12. 总结

Odoo 的 Python 与 JavaScript 混合架构通过以下机制实现：

1. **统一的模块系统**: 每个 addon 是一个独立单元，可包含前后端代码
2. **约定目录结构**: `static/` 目录存放前端资源，其他目录存放 Python 代码
3. **资源发现机制**: Odoo 自动扫描 `static/` 目录并提供 HTTP 服务
4. **Assets Bundle 系统**: 统一管理资源打包、压缩、缓存
5. **清单文件配置**: `__manifest__.py` 统一管理模块元数据和资源声明
6. **RPC 通信机制**: 前后端通过 JSON-RPC 协议通信

这种设计使得开发者可以在单一模块中实现完整功能，提高了开发效率和代码可维护性。

## 参考资源

- **核心代码**:
  - `odoo/odoo/http.py` - HTTP 请求处理
  - `odoo/odoo/addons/base/models/assetsbundle.py` - Assets Bundle 实现
  - `odoo/odoo/addons/base/models/ir_asset.py` - 资源路径解析
  - `odoo/addons/web/__manifest__.py` - Assets 配置示例

- **相关文档**:
  - Odoo 官方文档: Assets Management
  - Odoo 开发文档: Module Development
