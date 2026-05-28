# Odoo 19 CE 资产（Assets）系统 源码分析

> **来源**: Odoo 19 CE 源码 (`~/EA/odoo`)  
> **核心文件**: `assetsbundle.py`, `ir_asset.py`, `ir_qweb.py`, `web/__manifest__.py`

---

## 一、资产系统架构

### 1.1 总览

Odoo 的资产系统是一个**服务端驱动的资源打包管线**：

```
__manifest__.py ('assets' dict)
    ↓
IrAsset._get_asset_paths()           ← 收集所有模块的资产声明
    ↓
IrQWeb._get_asset_bundle()           ← 创建 AssetsBundle 实例
    ↓
AssetsBundle.css() / .js()            ← 编译、合并、压缩
    ↓
/web/assets/{checksum}/{bundle}.min.{ext}  ← 通过 HTTP 提供
```

### 1.2 关键文件

| 文件 | 路径 | 行数 | 角色 |
|------|------|------|------|
| **AssetsBundle** | `odoo/addons/base/models/assetsbundle.py` | 1-1087 | 核心打包引擎 — 收集、编译、压缩 CSS/JS/XML |
| **IrAsset** | `odoo/addons/base/models/ir_asset.py` | 1-430 | 资产路径解析 — 聚合 `__manifest__.py` 声明 |
| **IrQWeb** | `odoo/addons/base/models/ir_qweb.py` | 2597-2896 | `t-call-assets` 指令编译与 URL 生成 |
| **Binary Controller** | `odoo/addons/web/controllers/binary.py` | 90-158 | `/web/assets/` HTTP 端点 |
| **Web manifest** | `odoo/addons/web/__manifest__.py` | 31-557 | 所有核心 Bundle 定义 |

---

## 二、资产如何声明

### 2.1 `__manifest__.py` 声明

每个 Odoo 模块在 `__manifest__.py` 的 `'assets'` 字典中声明资源：

```python
# web/__manifest__.py line 49
'assets': {
    'web.assets_backend': [
        ('include', 'web._assets_core'),      # 嵌入其他 bundle
        'web/static/src/scss/primary_variables.scss',
        'web/static/src/core/**/*',            # glob 模式
    ],
    'web.assets_frontend': [
        ('include', 'web._assets_helpers'),
        'web/static/src/public/**/*',
        ('remove', 'web/static/src/legacy/**'),  # 条件移除
    ],
}
```

### 2.2 Bundle 类型

| Bundle | 用途 | Source |
|--------|------|--------|
| `web.assets_backend` | 后台管理界面 (OWL + Bootstrap) | `web/__manifest__.py:49` |
| `web.assets_frontend` | 前端网站页面 | `web/__manifest__.py:163` |
| `web.assets_frontend_minimal` | 前端关键路径 (module loader, session) | `web/__manifest__.py:152` |
| `web.report_assets_common` | 报表通用样式 | `web/__manifest__.py:255` |
| `web.report_assets_pdf` | PDF 报表专用 CSS reset | `web/__manifest__.py:316` |

### 2.3 指令类型

定义在 `ir_asset.py:17-25`：

| 指令 | 语法 | 效果 |
|------|------|------|
| `APPEND` | `'path'` (plain string) | 追加到 bundle 末尾 |
| `PREPEND` | `('prepend', 'path')` | 插入到开头 |
| `BEFORE` | `('before', 'target', 'path')` | 在目标文件之前 |
| `AFTER` | `('after', 'target', 'path')` | 在目标文件之后 |
| `REMOVE` | `('remove', 'path')` | 移除匹配的文件 |
| `REPLACE` | `('replace', 'old', 'new')` | 替换 |
| `INCLUDE` | `('include', 'bundle_name')` | 嵌入整个子 bundle |

---

## 三、`AssetsBundle` — 核心打包引擎

### 3.1 类结构

```
AssetsBundle (assetsbundle.py:41)
│
├── WebAsset (line 711)         — 基类: 内容读取 + 路径解析
│   ├── JavascriptAsset (799)   — JS: 拼接 + 分号
│   ├── XMLAsset (865)          — XML: 模板内联
│   └── StylesheetAsset (914)   — CSS: @import 内联 + url() 重写
│       ├── PreprocessedCSS (976)
│       ├── SassStylesheetAsset (998)
│       ├── ScssStylesheetAsset (1034)
│       └── LessStylesheetAsset (1078)
```

### 3.2 关键方法

| 方法 | 行号 | 功能 |
|------|------|------|
| `__init__()` | 48 | 解析文件列表，创建 Asset 对象 |
| `get_links()` | 103 | 返回 `[(css_url, None), (js_url, None)]` URL 列表 |
| `get_checksum()` | 125 | SHA512/256 → 7 字符 hex (URL version) |
| `get_asset_url()` | 143 | 构建 `/web/assets/{checksum}/{name}.min.{ext}` URL |
| `js()` | 312 | 合并所有 JS 资产 → `ir.attachment` |
| `css()` | 484 | 预处理 (SASS/LESS) + 合并 CSS → `ir.attachment` |

### 3.3 URL 格式

```
生产: /web/assets/abc1234/web.assets_backend.min.js
开发: /web/assets/debug/web.assets_backend.css
```

---

## 四、`t-call-assets` — QWeb 指令编译

### 4.1 指令位置

`_compile_directive_call_assets()` (`ir_qweb.py:2597-2645`)

### 4.2 编译逻辑

```
t-call-assets="web.assets_backend"
    ↓ 编译时
生成 Python 代码调用:
    self._get_asset_nodes(bundle, css=True, js=True, debug=False, ...)
        ↓ 调用
    self._get_asset_bundle(bundle, ...)
        ↓ 调用
    env['ir.asset']._get_asset_paths(bundle)
        ↓ 调用
    [_manifest__.py 的 'assets' dict]
        ↓ 返回
    AssetsBundle → get_links() → [('/web/assets/abc1234/min.css', None), (...)]
        ↓ 转换为
    [('link', {rel, href, type}), ('script', {src, type, defer})]
        ↓ 编译为
yield '<link rel="stylesheet" type="text/css" href="..."/>'
yield '<script type="text/javascript" src="..." defer="defer"></script>'
```

### 4.3 实际模板使用

```xml
<!-- web/views/webclient_templates.xml:44 -->
<t t-call-assets="web.assets_frontend" t-js="false"/>
<t t-call-assets="web.assets_frontend_minimal" t-css="false" defer_load="True"/>
```

### 4.4 去重机制

资产去重基于 `assetsSeen` Set，在整个渲染过程中（包括 `t-call` 子模板）跨模板生效：

```python
# ir_qweb.py _get_asset_nodes() — 内部维护已注入 bundle 集合
# 同一 bundle 在渲染过程中只注入一次
```

---

## 五、`/web/assets/` 服务端点

### 5.1 路由

```python
# web/controllers/binary.py:91
@http.route(['/web/assets/<string:unique>/<string:filename>'], 
    type='http', auth="public", readonly=True)
def content_assets(self, filename, unique, **kwargs):
```

### 5.2 流程

```
浏览器请求: GET /web/assets/abc1234/web.assets_backend.min.js
    ↓
content_assets()
    ├── 查找 ir.attachment (缓存命中 → 直接返回)
    └── 缓存未命中:
        ├── ir.asset._parse_bundle_name(filename)
        │   → 从 URL 解码 bundle 名称
        ├── ir.qweb._get_asset_bundle(bundle_name, ...)
        │   → 创建 AssetsBundle, 调用 .js() 或 .css()
        │   → 生成 ir.attachment (存储在数据库)
        └── 返回 Stream response (Content-Type + immutable Cache-Control)
```

### 5.3 缓存策略

- **生产**: `immutable, max_age=31536000` (1 年) — 基于 checksum 的 URL 永不变化
- **开发**: `no-cache` — 每次重新生成

---

## 六、对 OdooSeek 的启示

### 6.1 资产系统与 OdooSeek 的关系

| 维度 | Odoo 原生 | OdooSeek |
|------|----------|----------|
| **资源打包** | 后端 Python `AssetsBundle` | Vite (构建时) |
| **CSS** | SASS/SCSS → 编译 → 合并 | Tailwind CSS + Vite |
| **JS** | 拼接 + 压缩 → `/web/assets/` | import + Vite tree-shaking |
| **视图组件** | OWL 通过 `t-call-assets` 加载 | React 通过 `import` 加载 |
| **QWeb 模板** | 需要 `t-call-assets` | 不使用 QWeb（看板除外） |

### 6.2 为什么 OdooSeek 不需要实现资产系统

1. **React 视图不依赖 QWeb**: 列表/表单/看板卡片由 React 组件直接渲染，资源在构建时由 Vite 打包
2. **Vite 已覆盖打包**: HMR、tree-shaking、code splitting、CSS 处理 — 无需 Python 端打包
3. **Odoo 资产仅用于 QWeb 场景**: 报表 PDF、邮件模板、Website 页面

### 6.3 未来可能的对接点

| 场景 | 对接方式 |
|------|----------|
| **报表 PDF 渲染** | 可调用 Odoo 后端 `/web/assets/` 获取 CSS，或自建 React 报表 |
| **邮件模板预览** | 可加载 Odoo 资产以保持样式一致 |
| **看板卡片** | 当前已由 React 直接渲染，不需要 Odoo 资产 |

### 6.4 关键结论

> Odoo 的资产系统是为**服务端 QWeb 渲染**设计的 Python 打包管线。OdooSeek 的 React 前端使用 Vite 打包，两者处于不同层。对于看板 QWeb 模板，只需要解析 `t-if`/`t-foreach` 等**结构和逻辑指令**，不需要处理 `t-call-assets`（资源指令），因为 React 已经处理了所有资源管理。

---

## 七、完整源码索引

| 关注点 | 文件 | 行号 |
|--------|------|------|
| AssetsBundle 类定义 | `base/models/assetsbundle.py` | 41-1087 |
| WebAsset 基类 | `base/models/assetsbundle.py` | 711 |
| JavascriptAsset | `base/models/assetsbundle.py` | 799 |
| StylesheetAsset | `base/models/assetsbundle.py` | 914 |
| get_links() URL 生成 | `base/models/assetsbundle.py` | 103 |
| get_checksum() | `base/models/assetsbundle.py` | 125 |
| Asset 指令常量 | `base/models/ir_asset.py` | 17-25 |
| _get_asset_paths() | `base/models/ir_asset.py` | 129 |
| _fill_asset_paths() (解析 manifest) | `base/models/ir_asset.py` | 158 |
| _compile_directive_call_assets | `base/models/ir_qweb.py` | 2597-2645 |
| _get_asset_nodes | `base/models/ir_qweb.py` | 2737 |
| _get_asset_bundle | `base/models/ir_qweb.py` | 2788 |
| _link_to_node (tag 生成) | `base/models/ir_qweb.py` | 2797 |
| /web/assets/ 端点 | `web/controllers/binary.py` | 91 |
| web.assets_backend 定义 | `web/__manifest__.py` | 49 |
| web.assets_frontend 定义 | `web/__manifest__.py` | 163 |
| web.report_assets_* 定义 | `web/__manifest__.py` | 255-345 |
| 文件扩展名常量 | `tools/constants.py` | 3-6 |
| ANY_UNIQUE 常量 | `base/models/assetsbundle.py` | 26 |
| TRACKED_BUNDLES | `base/models/assetsbundle.py` | 46 |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**来源**: Odoo 19 CE 源码 (`~/EA/odoo`)  
**维护团队**: OdooSeek
