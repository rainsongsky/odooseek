# QWeb Node.js 平替库可行性分析

## 执行摘要

本文档评估开发一个 Node.js 版本的 QWeb 模板引擎库的可行性，该库旨在平替 Odoo 原生的 QWeb 实现，支持在 Node.js 环境中渲染 QWeb 模板，并可与 React、Next.js 等现代前端框架集成。

**核心结论**：✅ **高度可行，建议实施**。开发一个独立的 QWeb Node.js 库可以解决多个关键问题：服务端渲染（SSR）、PDF 生成、模板复用、与 React 的集成等。虽然需要一定的工作量，但技术栈成熟，实现路径清晰。

**可行性评分**：**8.5/10**（10 分为完全可行）

## 一、背景与动机

### 1.1 当前挑战

在 React 前端替代 Odoo Web 的过程中，遇到以下问题：

1. **模板系统不兼容**
   - Odoo 使用 QWeb XML 模板系统
   - React 使用 JSX/TSX 模板系统
   - 视图定义存储在数据库（`ir.ui.view`），使用 QWeb 语法

2. **服务端渲染需求**
   - 报表生成需要服务端渲染（PDF 生成）
   - SEO 优化可能需要 SSR
   - 初始页面加载性能优化

3. **模板复用困难**
   - Odoo 后端的报表模板无法直接在前端使用
   - 需要重复实现相同的模板逻辑

4. **模板继承系统缺失**
   - QWeb 的 `inherit_id + xpath` 继承机制在 React 中难以实现
   - 模板扩展和定制需要重新设计

### 1.2 解决方案

开发一个独立的 **QWeb Node.js 库**（如 `@qwebjs/core`），实现以下目标：

1. ✅ **兼容 Odoo QWeb 语法**：支持所有 QWeb 指令（t-esc, t-if, t-foreach 等）
2. ✅ **支持模板继承**：实现 `inherit_id + xpath` 机制
3. ✅ **Node.js 环境运行**：可在服务端渲染模板
4. ✅ **React 集成**：提供 React 组件包装器，将 QWeb 模板转换为 React 组件
5. ✅ **独立可复用**：可作为独立 npm 包发布，不依赖 Odoo

## 二、技术可行性分析

### 2.1 QWeb 核心功能拆解

#### 2.1.1 基础语法特性

| 功能           | 复杂度                     | 实现难度 | 必要性 |
| -------------- | -------------------------- | -------- | ------ |
| **变量插值**   | `t-esc`, `t-raw`           | 低       | P0     |
| **条件渲染**   | `t-if`, `t-elif`, `t-else` | 低       | P0     |
| **循环渲染**   | `t-foreach`, `t-as`        | 中       | P0     |
| **属性绑定**   | `t-att-*`, `t-attf-*`      | 中       | P0     |
| **变量设置**   | `t-set`, `t-value`         | 低       | P0     |
| **模板调用**   | `t-call`                   | 中       | P0     |
| **表达式求值** | Python/JS 表达式           | 高       | P0     |

#### 2.1.2 高级特性

| 功能           | 复杂度               | 实现难度 | 必要性 |
| -------------- | -------------------- | -------- | ------ |
| **模板继承**   | `inherit_id + xpath` | 高       | P1     |
| **模板注册表** | 模板查找和缓存       | 中       | P0     |
| **上下文传递** | `t-context`          | 中       | P1     |
| **调试工具**   | `t-log`, `t-debug`   | 低       | P2     |
| **国际化**     | `t-translation`      | 中       | P1     |
| **资源注入**   | `t-call-assets`      | 中       | P2     |

### 2.2 技术实现路径

#### 2.2.1 方案一：纯 JavaScript 实现（推荐）

**架构设计**：

```
@qwebjs/core
├── parser/          # XML 解析器（使用 xmldom 或类似库）
├── compiler/        # 模板编译器（将 QWeb 模板编译为 AST）
├── runtime/         # 运行时引擎（执行编译后的模板）
├── registry/        # 模板注册表
└── utils/           # 工具函数（表达式求值、XPath 处理等）

@qwebjs/react       # React 集成层（可选）
└── QWebComponent   # React 组件包装器
```

**核心实现示例**：

```typescript
// @qwebjs/core/src/engine.ts
import { parseXML } from "./parser";
import { compileTemplate } from "./compiler";
import { TemplateRegistry } from "./registry";

export class QWebEngine {
  private registry: TemplateRegistry;

  constructor() {
    this.registry = new TemplateRegistry();
  }

  /**
   * 注册模板
   */
  registerTemplate(
    name: string,
    xml: string,
    options?: {
      inheritId?: string;
      priority?: number;
    },
  ) {
    const ast = parseXML(xml);
    const compiled = compileTemplate(ast);
    this.registry.add(name, compiled, options);
  }

  /**
   * 渲染模板
   */
  render(templateName: string, context: Record<string, any>): string {
    const template = this.registry.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    // 处理模板继承
    const finalTemplate = this.resolveInheritance(template);

    // 执行渲染
    return this.execute(finalTemplate, context);
  }

  /**
   * 处理模板继承（inherit_id + xpath）
   */
  private resolveInheritance(template: CompiledTemplate): CompiledTemplate {
    if (!template.inheritId) {
      return template;
    }

    const parent = this.registry.get(template.inheritId);
    if (!parent) {
      throw new Error(`Parent template "${template.inheritId}" not found`);
    }

    // 使用 XPath 定位修改点
    return this.applyInheritance(parent, template);
  }

  /**
   * 执行编译后的模板
   */
  private execute(template: CompiledTemplate, context: Record<string, any>): string {
    // 实现模板执行逻辑
    // 处理 t-esc, t-if, t-foreach 等指令
    return this.evaluateAST(template.ast, context);
  }
}
```

**表达式求值实现**：

```typescript
// @qwebjs/core/src/utils/expression.ts
import { evaluate } from "@qwebjs/expression-parser";

/**
 * 安全的表达式求值
 * 支持类似 Python 的表达式语法（兼容 Odoo）
 */
export function evaluateExpression(expr: string, context: Record<string, any>): any {
  try {
    // 使用自定义表达式解析器
    // 支持 Python 风格的表达式（如：record.field.name, items.filter(...)）
    return evaluate(expr, context, {
      // 安全选项：限制可用的全局对象
      allowGlobals: false,
      // 自定义函数库
      functions: {
        len: (arr: any[]) => arr?.length || 0,
        str: (val: any) => String(val),
        // ... 更多 Odoo 常用函数
      },
    });
  } catch (error) {
    throw new Error(`Expression evaluation error: ${expr} - ${error.message}`);
  }
}
```

**模板编译器实现**：

```typescript
// @qwebjs/core/src/compiler/index.ts
import { Node } from "xmldom";

export interface CompiledNode {
  type: "element" | "text" | "directive";
  tag?: string;
  attributes?: Record<string, string | CompiledExpression>;
  children?: CompiledNode[];
  directive?: string; // t-if, t-foreach, t-esc 等
  expression?: CompiledExpression;
}

export interface CompiledExpression {
  type: "expr" | "raw";
  code: string; // 编译后的 JavaScript 代码
}

export function compileTemplate(xmlNode: Node, parentContext?: string): CompiledNode {
  const compiled: CompiledNode = {
    type: "element",
    tag: xmlNode.nodeName,
    attributes: {},
    children: [],
  };

  // 处理属性
  if (xmlNode.attributes) {
    for (let i = 0; i < xmlNode.attributes.length; i++) {
      const attr = xmlNode.attributes[i];
      const name = attr.name;
      const value = attr.value;

      if (name.startsWith("t-")) {
        // QWeb 指令
        compiled.directive = name;
        compiled.expression = compileExpression(value, parentContext);
      } else if (name.startsWith("t-att-")) {
        // 属性绑定
        const attrName = name.substring(6); // 去掉 't-att-' 前缀
        compiled.attributes![attrName] = compileExpression(value, parentContext);
      } else {
        // 普通属性
        compiled.attributes![name] = value;
      }
    }
  }

  // 处理子节点
  for (let i = 0; i < xmlNode.childNodes.length; i++) {
    const child = xmlNode.childNodes[i];
    if (child.nodeType === 1) {
      // Element node
      compiled.children!.push(compileTemplate(child as Node, parentContext));
    } else if (child.nodeType === 3) {
      // Text node
      // 检查是否包含表达式（使用 {{ }} 语法）
      const textContent = child.textContent || "";
      if (textContent.includes("{{")) {
        // 处理文本中的表达式
        compiled.children!.push({
          type: "text",
          expression: compileTextExpression(textContent, parentContext),
        });
      } else {
        compiled.children!.push({
          type: "text",
          text: textContent,
        });
      }
    }
  }

  return compiled;
}
```

#### 2.2.2 方案二：基于现有模板引擎扩展

**可选方案**：

1. **基于 Handlebars/Mustache**：修改语法以支持 QWeb 指令
2. **基于 EJS**：扩展以支持 XML 模板和继承
3. **基于 Pug**：转换为 QWeb 语法

**评估**：❌ **不推荐**

- 现有模板引擎的设计理念与 QWeb 差异较大
- 需要大量修改才能支持 QWeb 特性（特别是模板继承）
- 不如从零开始实现，可控性更高

### 2.3 React 集成方案

#### 2.3.1 方案一：编译时转换（推荐）

将 QWeb 模板编译为 React 组件：

```typescript
// @qwebjs/react/src/compiler.tsx
import { QWebEngine } from '@qwebjs/core'
import { useMemo } from 'react'

/**
 * 将 QWeb 模板编译为 React 组件
 */
export function createQWebComponent(
  templateName: string,
  engine: QWebEngine
) {
  return function QWebComponent({ context }: { context: Record<string, any> }) {
    const html = useMemo(() => {
      return engine.render(templateName, context)
    }, [templateName, context])

    return <div dangerouslySetInnerHTML={{ __html: html }} />
  }
}
```

**问题**：使用 `dangerouslySetInnerHTML` 会失去 React 的虚拟 DOM 优势。

#### 2.3.2 方案二：AST 转换（更优）

将 QWeb AST 转换为 React JSX AST：

```typescript
// @qwebjs/react/src/react-compiler.tsx
import { CompiledNode } from '@qwebjs/core'
import * as React from 'react'

/**
 * 将 QWeb AST 转换为 React 元素
 */
export function compileToReact(
  node: CompiledNode,
  context: Record<string, any>
): React.ReactElement {
  // 处理指令
  if (node.directive === 't-if') {
    const condition = evaluateExpression(node.expression!.code, context)
    if (!condition) return null
  }

  if (node.directive === 't-foreach') {
    const items = evaluateExpression(node.expression!.code, context)
    return (
      <>
        {items.map((item: any, index: number) => (
          <React.Fragment key={index}>
            {compileToReact(node, { ...context, [node.as]: item, index })}
          </React.Fragment>
        ))}
      </>
    )
  }

  if (node.directive === 't-esc') {
    const value = evaluateExpression(node.expression!.code, context)
    return <>{escapeHtml(String(value))}</>
  }

  // 处理普通元素
  const props: Record<string, any> = {}
  if (node.attributes) {
    for (const [key, value] of Object.entries(node.attributes)) {
      if (typeof value === 'string') {
        props[key] = value
      } else {
        // 表达式属性
        props[key] = evaluateExpression(value.code, context)
      }
    }
  }

  const children = node.children?.map(child => compileToReact(child, context)) || []

  return React.createElement(node.tag || 'div', props, ...children)
}
```

**优势**：

- ✅ 完全利用 React 的虚拟 DOM
- ✅ 支持 React 的所有特性（hooks、context 等）
- ✅ 性能更好
- ✅ 类型安全（TypeScript 支持）

### 2.4 模板继承实现

**核心挑战**：实现 `inherit_id + xpath` 机制

```typescript
// @qwebjs/core/src/inheritance.ts
import { xpath } from "xpath";
import { DOMParser } from "@xmldom/xmldom";

export interface InheritanceRule {
  xpath: string; // XPath 表达式，定位修改点
  position?: "inside" | "replace" | "before" | "after";
  content: Node; // 要插入/替换的内容
}

/**
 * 应用模板继承
 */
export function applyInheritance(parentTemplate: string, childTemplate: string): string {
  const parser = new DOMParser();
  const parentDoc = parser.parseFromString(parentTemplate, "text/xml");
  const childDoc = parser.parseFromString(childTemplate, "text/xml");

  // 解析继承规则（从 childTemplate 中的 xpath 节点）
  const rules = parseInheritanceRules(childDoc);

  // 应用每个规则
  for (const rule of rules) {
    const nodes = xpath.select(rule.xpath, parentDoc) as Node[];

    for (const targetNode of nodes) {
      switch (rule.position) {
        case "inside":
          // 在目标节点内部追加
          rule.content.childNodes.forEach((child) => {
            targetNode.appendChild(child.cloneNode(true));
          });
          break;
        case "replace":
          // 替换目标节点
          targetNode.parentNode?.replaceChild(rule.content.cloneNode(true), targetNode);
          break;
        case "before":
          // 在目标节点之前插入
          targetNode.parentNode?.insertBefore(rule.content.cloneNode(true), targetNode);
          break;
        case "after":
          // 在目标节点之后插入
          const nextSibling = targetNode.nextSibling;
          if (nextSibling) {
            targetNode.parentNode?.insertBefore(
              rule.content.cloneNode(true),
              nextSibling,
            );
          } else {
            targetNode.parentNode?.appendChild(rule.content.cloneNode(true));
          }
          break;
      }
    }
  }

  return parentDoc.toString();
}
```

## 三、工作量评估

### 3.1 核心功能开发

| 功能模块                         | 工作量（人天） | 优先级 | 难度 |
| -------------------------------- | -------------- | ------ | ---- |
| **XML 解析器**                   | 3-5            | P0     | 中   |
| - XML 解析（使用 xmldom）        | 1-2            | P0     | 低   |
| - QWeb 指令识别                  | 2-3            | P0     | 中   |
| **表达式求值引擎**               | 5-8            | P0     | 高   |
| - 表达式解析器                   | 2-3            | P0     | 高   |
| - Python 风格表达式支持          | 2-3            | P0     | 高   |
| - 安全沙箱实现                   | 1-2            | P0     | 中   |
| **模板编译器**                   | 8-12           | P0     | 高   |
| - AST 生成                       | 3-5            | P0     | 高   |
| - 指令编译（t-if, t-foreach 等） | 3-5            | P0     | 中   |
| - 属性编译（t-att-\*）           | 2-2            | P0     | 中   |
| **运行时引擎**                   | 5-8            | P0     | 中   |
| - AST 执行器                     | 3-5            | P0     | 中   |
| - 上下文管理                     | 2-3            | P0     | 低   |
| **模板注册表**                   | 2-3            | P0     | 低   |
| - 模板存储和查找                 | 1-2            | P0     | 低   |
| - 缓存机制                       | 1-1            | P0     | 低   |
| **模板继承系统**                 | 8-12           | P1     | 高   |
| - XPath 支持                     | 3-5            | P1     | 中   |
| - 继承规则解析                   | 2-3            | P1     | 中   |
| - 继承应用逻辑                   | 3-4            | P1     | 高   |
| **React 集成**                   | 10-15          | P1     | 中高 |
| - QWeb → React AST 转换          | 5-8            | P1     | 高   |
| - React 组件生成                 | 3-5            | P1     | 中   |
| - Hooks 支持                     | 2-2            | P2     | 中   |
| **测试和文档**                   | 5-8            | P0     | 低   |
| - 单元测试                       | 3-5            | P0     | 低   |
| - 集成测试                       | 2-3            | P0     | 低   |
| - API 文档                       | 1-1            | P0     | 低   |

**总计**：**46-71 人天**（约 2.5-4 个月，1 人）

### 3.2 分阶段实施建议

#### 第一阶段：核心功能（1.5-2 个月）

- ✅ XML 解析器
- ✅ 表达式求值引擎（基础）
- ✅ 模板编译器（核心指令）
- ✅ 运行时引擎（基础）
- ✅ 模板注册表
- ✅ 基础测试

**里程碑**：能够渲染简单的 QWeb 模板（变量插值、条件、循环）

#### 第二阶段：高级特性（1-1.5 个月）

- ✅ 模板继承系统
- ✅ 完整的表达式支持
- ✅ 所有 QWeb 指令支持
- ✅ 错误处理和调试工具

**里程碑**：能够处理复杂的 QWeb 模板（包括继承）

#### 第三阶段：React 集成（0.5-1 个月）

- ✅ React AST 转换
- ✅ React 组件生成
- ✅ 性能优化

**里程碑**：可以在 React 项目中使用 QWeb 模板

## 四、技术选型

### 4.1 依赖库

| 库名                      | 用途                   | 替代方案                   |
| ------------------------- | ---------------------- | -------------------------- |
| `@xmldom/xmldom`          | XML 解析               | `fast-xml-parser`, `jsdom` |
| `xpath`                   | XPath 支持（模板继承） | `xpath-dom`                |
| `acorn` / `@babel/parser` | 表达式解析             | 自研解析器                 |
| `vm2` / `isolated-vm`     | 安全沙箱（表达式求值） | 自研限制器                 |

### 4.2 项目结构

```
qwebjs/
├── packages/
│   ├── core/              # 核心库
│   │   ├── src/
│   │   │   ├── parser/
│   │   │   ├── compiler/
│   │   │   ├── runtime/
│   │   │   ├── registry/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── react/             # React 集成（可选）
│   │   ├── src/
│   │   │   ├── compiler.tsx
│   │   │   └── component.tsx
│   │   └── package.json
│   └── cli/               # CLI 工具（可选）
│       └── src/
├── examples/              # 示例项目
├── tests/                 # 集成测试
├── package.json           # Monorepo 管理
└── README.md
```

## 五、优势分析

### 5.1 技术优势

1. **模板复用**
   - ✅ 可以在 Node.js 和浏览器环境中使用相同的模板
   - ✅ 支持服务端渲染（SSR）和客户端渲染
   - ✅ 报表模板可以直接在 Node.js 中渲染

2. **与 Odoo 兼容**
   - ✅ 支持 Odoo 的 QWeb 语法
   - ✅ 可以复用现有的 Odoo 模板
   - ✅ 降低学习成本

3. **现代化集成**
   - ✅ 可以集成到 React、Next.js 等现代框架
   - ✅ 支持 TypeScript
   - ✅ 可以作为独立 npm 包发布

4. **灵活性**
   - ✅ 可以自定义表达式函数
   - ✅ 可以扩展指令系统
   - ✅ 可以集成到不同的渲染目标（HTML、PDF 等）

### 5.2 业务优势

1. **降低开发成本**
   - ✅ 不需要重写所有视图模板
   - ✅ 可以复用 Odoo 的报表模板
   - ✅ 减少前后端模板不一致的问题

2. **提升开发效率**
   - ✅ 开发人员可以继续使用熟悉的 QWeb 语法
   - ✅ 模板可以在不同环境中复用
   - ✅ 支持模板继承，减少重复代码

3. **更好的维护性**
   - ✅ 模板逻辑集中管理
   - ✅ 易于测试和调试
   - ✅ 可以独立版本控制

## 六、挑战与风险

### 6.1 技术挑战

#### 1. 表达式求值 ⚠️ 高风险

**挑战**：

- Odoo 使用 Python 风格的表达式（如：`record.field.name`、`items.filter(...)`）
- 需要实现安全的表达式求值（防止代码注入）
- 需要支持复杂的表达式语法

**缓解措施**：

- 使用成熟的表达式解析库（如 `acorn`）
- 实现严格的安全沙箱
- 提供白名单机制限制可用的函数和属性

#### 2. 模板继承 ⚠️ 高风险

**挑战**：

- XPath 支持复杂
- 继承规则的优先级和顺序需要正确实现
- 性能可能受影响

**缓解措施**：

- 使用成熟的 XPath 库（如 `xpath`）
- 实现继承链缓存
- 提供性能测试和优化

#### 3. React 集成 ⚠️ 中风险

**挑战**：

- QWeb 的 XML 模板与 React 的 JSX 理念不同
- 需要处理事件绑定、状态管理等 React 特性
- 性能优化（避免不必要的重渲染）

**缓解措施**：

- 使用 AST 转换而非 HTML 字符串
- 利用 React.memo 优化组件
- 提供性能测试和最佳实践文档

### 6.2 兼容性风险

#### 1. Odoo 版本兼容性 ⚠️ 中风险

**风险**：Odoo 的 QWeb 实现可能在不同版本间有差异

**缓解措施**：

- 建立兼容性测试套件
- 文档化支持的 Odoo 版本
- 提供版本检测和警告机制

#### 2. 功能完整性 ⚠️ 低风险

**风险**：可能无法完全支持所有 QWeb 特性

**缓解措施**：

- 优先实现核心功能
- 明确不支持的特性列表
- 提供扩展机制允许用户自定义

## 七、实施建议

### 7.1 开发策略

#### 1. 最小可行产品（MVP）

**第一阶段目标**：

- ✅ 支持基础 QWeb 语法（t-esc, t-if, t-foreach）
- ✅ 能够在 Node.js 中渲染模板
- ✅ 基本测试覆盖

**时间**：3-4 周

#### 2. 逐步完善

- ✅ 添加更多指令支持
- ✅ 实现模板继承
- ✅ React 集成
- ✅ 性能优化

### 7.2 开发流程

1. **原型验证**（1 周）
   - 实现最简单的模板渲染（变量插值）
   - 验证技术可行性

2. **核心功能开发**（4-6 周）
   - 按照优先级逐步实现功能
   - 每个功能完成后进行测试

3. **React 集成**（2-3 周）
   - 实现 React AST 转换
   - 集成测试

4. **优化和文档**（1-2 周）
   - 性能优化
   - 编写文档和示例

### 7.3 发布策略

1. **内部使用**
   - 先在项目内部使用
   - 收集反馈和问题

2. **开源发布**
   - 发布到 npm（如 `@qwebjs/core`）
   - 提供完整的文档和示例
   - 建立社区支持

## 八、成功标准

### 8.1 功能完整性

- ✅ 支持所有核心 QWeb 指令
- ✅ 支持模板继承（inherit_id + xpath）
- ✅ 表达式求值安全可靠
- ✅ 能够渲染 Odoo 的标准报表模板

### 8.2 性能指标

- ✅ 模板编译时间 < 100ms（中等复杂度模板）
- ✅ 模板渲染时间 < 50ms（1000 条数据）
- ✅ 内存占用合理（无内存泄漏）

### 8.3 兼容性

- ✅ 能够渲染 Odoo 19.0 的标准模板
- ✅ 与 Odoo 原生 QWeb 输出一致（至少 95%）

### 8.4 开发体验

- ✅ TypeScript 类型支持完整
- ✅ 文档清晰完整
- ✅ 示例代码充足
- ✅ 错误提示友好

## 九、结论与建议

### 9.1 可行性结论

**总体评估**：✅ **高度可行，强烈建议实施**

**理由**：

1. 技术栈成熟，有丰富的库支持（XML 解析、XPath、表达式解析）
2. QWeb 语法相对简单，核心功能可以实现
3. 可以显著降低 React 替代方案的实施成本
4. 可以作为独立项目，长期维护和复用

### 9.2 实施建议

#### 立即开始

1. ✅ 建立项目结构（Monorepo）
2. ✅ 实现原型（简单的模板渲染）
3. ✅ 验证技术可行性

#### 短期目标（2 个月）

1. ✅ 完成核心功能（解析、编译、渲染）
2. ✅ 支持基础 QWeb 指令
3. ✅ 能够在 Node.js 中渲染模板

#### 中期目标（4 个月）

1. ✅ 实现模板继承系统
2. ✅ React 集成
3. ✅ 完整的测试覆盖

#### 长期目标（6 个月+）

1. ✅ 开源发布
2. ✅ 社区建设
3. ✅ 持续优化和维护

### 9.3 最终建议

**建议采用分阶段实施策略**：

1. 先实现 MVP，验证核心功能
2. 逐步添加高级特性
3. 最后实现 React 集成

**预期收益**：

- ✅ 显著降低 React 替代方案的实施成本
- ✅ 可以复用 Odoo 的模板代码
- ✅ 支持服务端渲染和 PDF 生成
- ✅ 可以作为独立项目长期维护

**预期成本**：

- ⚠️ 开发工作量：2.5-4 个月（1 人）
- ⚠️ 维护成本：需要跟进 Odoo 更新和社区反馈
- ⚠️ 学习成本：团队需要理解 QWeb 的内部实现

## 十、参考资料

- [Odoo QWeb 官方文档](https://www.odoo.com/documentation/master/developer/reference/frontend/qweb.html)
- [QWeb 模板引擎概览](./qweb_overview.md)
- [React 前端替代 Odoo Web 可行性评估](./REACT_FRONTEND_REPLACEMENT_FEASIBILITY.md)
- [XML DOM 解析库对比](https://www.npmjs.com/package/@xmldom/xmldom)
- [XPath 实现库](https://www.npmjs.com/package/xpath)
