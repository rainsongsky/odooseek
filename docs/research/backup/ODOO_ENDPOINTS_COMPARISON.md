# Odoo 端点对比：/jsonrpc vs /web/dataset/call_kw

## 概述

Odoo 提供了两种不同的 JSON-RPC 端点用于 API 调用，它们都使用 **JSON-RPC 2.0 协议**，但对应不同的认证方式和使用场景。本文档详细阐述这两个端点的差异、使用场景以及技术实现细节。

## 重要说明

**两个端点都使用 JSON-RPC 2.0 协议**

两个端点都遵循 JSON-RPC 2.0 规范，请求格式都包含：

- `jsonrpc: "2.0"` - 协议版本
- `method: "call"` - 方法名
- `params` - 参数对象
- `id` - 请求 ID

**它们的区别在于**：

1. **端点路径不同**：`/jsonrpc` vs `/web/dataset/call_kw`
2. **认证方式不同**：API Key（uid + api_key）vs Session ID（Cookie）
3. **参数结构不同**：一个通过 `service.method` 调用，另一个直接传 `model.method`

## 两个端点

### 1. `/jsonrpc` 端点

**用途**：用于 API Key 认证（无状态认证）

**端点路径**：`{baseUrl}/jsonrpc`

**认证方式**：

- 使用 `uid`（用户 ID）和 `api_key`（API 密钥）
- 无状态认证，每次请求都需要传递 `uid` 和 `api_key`
- 不依赖 Cookie 或 Session

**请求格式**（JSON-RPC 2.0）：

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      "database_name",
      uid,
      "api_key",
      "model_name",
      "method_name",
      [args],
      {kwargs}
    ]
  },
  "id": 1234567890
}
```

**协议**：JSON-RPC 2.0

**特点**：

- ✅ 无状态：不需要维护会话
- ✅ 适合服务器端应用：不依赖浏览器 Cookie
- ✅ 适合自动化脚本：可以长期使用 API Key
- ❌ 安全性较低：API Key 需要妥善保管
- ❌ 不支持 Web 会话：无法利用 Odoo Web 的会话管理

**使用场景**：

1. **服务器端应用**：后端服务、定时任务、批处理脚本
2. **自动化集成**：第三方系统集成、数据同步
3. **API 客户端**：移动应用、桌面应用（非浏览器环境）
4. **长期运行的服务**：不需要用户交互的后台服务

**示例代码**：

```typescript
// 使用 API Key 认证
const client = new OdooJSONRpc({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  uid: 2,
  api_key: "your-api-key",
});

await client.connect();
// 底层库会使用 /jsonrpc 端点
const records = await client.searchRead("product.template", [], ["name"]);
```

---

### 2. `/web/dataset/call_kw` 端点

**用途**：用于用户名密码认证（有状态认证）

**端点路径**：`{baseUrl}/web/dataset/call_kw`

**认证方式**：

- 使用 `session_id`（会话 ID）通过 Cookie 传递
- 有状态认证，通过浏览器 Cookie 管理会话
- 依赖 `X-Openerp-Session-Id` 请求头和 Cookie

**请求格式**（JSON-RPC 2.0）：

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "model_name",
    "method": "method_name",
    "args": [args],
    "kwargs": {kwargs}
  },
  "id": 1234567890
}
```

**协议**：JSON-RPC 2.0

**请求头**：

```
X-Openerp-Session-Id: {session_id}
Cookie: session_id={session_id}
```

**特点**：

- ✅ 安全性高：会话由 Odoo 服务器管理，支持过期和撤销
- ✅ 支持 Web 会话：可以访问 Web 相关的上下文和权限
- ✅ 适合浏览器应用：自动管理 Cookie，用户体验好
- ✅ 支持会话过期：可以设置会话过期时间
- ❌ 有状态：需要维护会话状态
- ❌ 依赖 Cookie：在非浏览器环境中需要手动管理

**使用场景**：

1. **Web 前端应用**：React、Vue、Angular 等单页应用
2. **浏览器扩展**：Chrome 扩展、Firefox 扩展
3. **用户交互应用**：需要用户登录和权限管理的应用
4. **Odoo Web 客户端**：Odoo 官方的 Web 客户端

**示例代码**：

```typescript
// 使用用户名密码认证
const client = new OdooJSONRpc({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  username: "admin",
  password: "admin",
});

await client.connect();
// 底层库会使用 /web/dataset/call_kw 端点
// session_id 通过 Cookie 自动传递
const records = await client.searchRead("product.template", [], ["name"]);
```

---

## 核心差异对比

| 特性           | `/jsonrpc`                | `/web/dataset/call_kw`             |
| -------------- | ------------------------- | ---------------------------------- |
| **协议**       | JSON-RPC 2.0              | JSON-RPC 2.0                       |
| **端点路径**   | `/jsonrpc`                | `/web/dataset/call_kw`             |
| **认证方式**   | `uid` + `api_key`         | `session_id` (Cookie)              |
| **状态管理**   | 无状态                    | 有状态（会话）                     |
| **请求头**     | 不需要特殊请求头          | `X-Openerp-Session-Id`             |
| **Cookie**     | 不使用 Cookie             | 依赖 Cookie                        |
| **参数结构**   | `service.method` + `args` | `model.method` + `args` + `kwargs` |
| **安全性**     | 较低（API Key 长期有效）  | 较高（会话可过期）                 |
| **适用环境**   | 服务器端、非浏览器        | 浏览器、Web 应用                   |
| **会话管理**   | 无                        | 支持会话过期、撤销                 |
| **Web 上下文** | 不支持                    | 支持（权限、上下文）               |
| **实现复杂度** | 简单                      | 较复杂（需要管理 Cookie）          |

---

## 技术实现细节

### 底层库的选择逻辑

在 `@hl8/odoo-json-rpc` 库中，`call_kw` 方法会根据以下逻辑选择端点：

```typescript
async call_kw(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  // 1. 检查连接状态，如果未连接则自动连接
  if (!this.is_connected) {
    await this.connect();
  }

  // 2. 优先使用 session_id（如果存在）
  if (this.session_id) {
    return this.callWithSessionId(model, method, args, kwargs); // /web/dataset/call_kw
  }

  // 3. 其次使用 uid（如果存在）
  if (this.uid) {
    return this.callWithUid(model, method, args, kwargs); // /jsonrpc
  }

  // 4. 默认使用 session_id（依赖浏览器 Cookie）
  return this.callWithSessionId(model, method, args, kwargs); // /web/dataset/call_kw
}
```

### 问题根源

**为什么会出现使用错误端点的问题？**

1. **底层库的 `connect()` 方法**：
   - 当使用用户名密码认证时，如果响应中没有 `username` 字段，底层库会设置 `this.uid = result.uid`
   - 这导致后续调用 `call_kw` 时，会优先检查 `this.uid`，从而使用 `/jsonrpc` 端点

2. **自动连接机制**：
   - 如果 `is_connected` 为 `false`，`call_kw` 会自动调用 `connect()`
   - 这可能会重新设置 `uid`，导致使用错误的端点

3. **状态不一致**：
   - `session_id` 可能没有正确设置到底层客户端
   - `uid` 可能被意外设置，导致优先级判断错误

### 我们的解决方案

在 `OdooClient` 封装中，我们实现了以下修复：

1. **`ensureCorrectEndpoint()` 方法**：

   ```typescript
   private ensureCorrectEndpoint(): void {
     // 1. 确保 is_connected 为 true，防止自动连接
     if (!this.client.is_connected) {
       if (this.session) {
         this.client.is_connected = true;
         if ((this.session as any)?.session_id) {
           (this.client as any).session_id = (this.session as any).session_id;
         }
       }
     }

     // 2. 无条件清除 uid，强制使用 session_id 端点
     if ((this.client as any).uid) {
       (this.client as any).uid = undefined;
       if ((this.client as any).auth_response?.uid) {
         delete (this.client as any).auth_response.uid;
       }
     }
   }
   ```

2. **在所有方法调用前执行**：
   - 在 `search()`、`read()`、`create()`、`write()`、`unlink()` 等方法中
   - 在调用底层方法之前，先调用 `ensureCorrectEndpoint()`
   - 确保始终使用 `/web/dataset/call_kw` 端点

3. **`connect()` 方法中的修复**：
   - 在连接成功后，立即清除 `uid`
   - 确保后续调用不会使用 `/jsonrpc` 端点

---

## 本应用的选择

**本应用仅使用 `/web/dataset/call_kw` 端点，不支持 `/jsonrpc` 端点。**

所有代码都已优化，确保：

- ✅ 所有请求都使用 `/web/dataset/call_kw` 端点
- ✅ 不支持 API Key 认证
- ✅ 配置中即使有 `apiKey`，也会被忽略
- ✅ 所有方法调用前都会清除 `uid`，强制使用 `session_id`

### 为什么选择 `/web/dataset/call_kw`？

在我们的 Odoo Web 应用中，我们选择使用 `/web/dataset/call_kw` 端点，原因如下：

### 1. **安全性**

- 会话可以设置过期时间，提高安全性
- 支持会话撤销，用户可以主动登出
- 不暴露 API Key，降低泄露风险

### 2. **用户体验**

- 浏览器自动管理 Cookie，用户无需手动处理
- 支持"记住我"功能，可以设置长期会话
- 与 Odoo Web 客户端行为一致

### 3. **功能完整性**

- 支持 Web 相关的上下文和权限
- 可以访问用户偏好设置
- 支持多数据库切换（通过会话）

### 4. **符合 Web 应用场景**

- 我们的应用是浏览器端的 Web 应用
- 需要用户登录和权限管理
- 需要利用浏览器的 Cookie 机制

---

## 最佳实践

### 1. 服务器端应用

```typescript
// ✅ 推荐：使用 API Key 认证
const client = new OdooJSONRpc({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  uid: 2,
  api_key: process.env.ODOO_API_KEY, // 从环境变量读取
});

// 底层库会自动使用 /jsonrpc 端点
```

### 2. Web 前端应用

```typescript
// ✅ 推荐：使用用户名密码认证
const client = new OdooJSONRpc({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  username: "admin",
  password: "admin",
});

// 底层库会自动使用 /web/dataset/call_kw 端点
// 通过我们的 OdooClient 封装，确保始终使用正确的端点
```

### 3. 混合场景

```typescript
// 如果需要在同一应用中支持两种认证方式
// 可以创建两个不同的客户端实例

// Web 前端：使用用户名密码
const webClient = new OdooClient({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  username: "admin",
  password: "admin",
});

// 后台任务：使用 API Key
const apiClient = new OdooClient({
  baseUrl: "http://localhost",
  port: 8069,
  db: "odoo19",
  uid: 2,
  api_key: process.env.ODOO_API_KEY,
});
```

---

## 常见问题

### Q1: 为什么我的请求使用了 `/jsonrpc` 而不是 `/web/dataset/call_kw`？

**A**: 可能的原因：

1. 底层库的 `connect()` 方法设置了 `uid`
2. `session_id` 没有正确设置到底层客户端
3. `is_connected` 为 `false`，触发了自动连接

**解决方案**：

- 使用我们的 `OdooClient` 封装，它会自动确保使用正确的端点
- 检查 `connect()` 方法是否正确清除了 `uid`
- 确保 `session_id` 被正确设置

### Q2: 可以在同一应用中混用两种端点吗？

**A**: 可以，但不推荐。建议：

- 为不同的使用场景创建不同的客户端实例
- Web 前端使用用户名密码认证（`/web/dataset/call_kw`）
- 后台任务使用 API Key 认证（`/jsonrpc`）

### Q3: 如何切换认证方式？

**A**:

- 创建新的客户端实例，使用不同的配置
- 不要在同一客户端实例上切换认证方式
- 切换前先调用 `disconnect()` 清理状态

### Q4: 会话过期后如何处理？

**A**:

- 监听 `OdooAuthenticationError` 异常
- 清除当前会话，重新连接
- 使用 `connectWithRetry()` 方法自动重试

---

## Postman Collection 文档分析

### 概述

项目文档中包含一份 **Odoo JSONRPC over REST** Postman Collection（`docs/Odoo JSONRPC over REST.postman_collection (1).json`），该文档演示了如何通过 REST API 使用 JSONRPC 与 Odoo 进行交互。

### Postman Collection 使用的端点

**Postman Collection 使用 `/jsonrpc` 端点**，这是 Odoo 的通用 JSON-RPC 端点。

#### 认证方式

Postman Collection 使用 `common.authenticate` 方法进行认证：

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "common",
    "method": "authenticate",
    "args": [
      "{{db}}",
      "{{username}}",
      "{{password}}",
      {}
    ]
  },
  "id": {{request_id}}
}
```

认证成功后返回 `uid`（用户 ID），后续请求使用 `uid` + `password` 进行认证。

#### ORM 方法调用

Postman Collection 通过 `object.execute_kw` 调用 ORM 方法：

```json
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "service": "object",
    "method": "execute_kw",
    "args": [
      "{{db}}",
      "{{uid}}",
      "{{password}}",
      "res.partner",
      "search",
      [[]]
    ],
    "id": {{request_id}}
  }
}
```

### 与本项目实现的对比

| 特性         | Postman Collection                                            | 本项目实现                                                         |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| **端点路径** | `/jsonrpc`                                                    | `/web/dataset/call_kw`                                             |
| **认证方式** | `common.authenticate` 返回 `uid`，后续使用 `uid` + `password` | `/web/session/authenticate`，使用 `session_id` (Cookie)            |
| **认证端点** | `/jsonrpc` (service: `common`)                                | `/web/session/authenticate`                                        |
| **状态管理** | 无状态（每次请求传递 `uid` + `password`）                     | 有状态（通过 Cookie 管理 `session_id`）                            |
| **参数结构** | `params.service` + `params.method` + `params.args`            | `params.model` + `params.method` + `params.args` + `params.kwargs` |
| **请求头**   | 不需要特殊请求头                                              | `X-Openerp-Session-Id` + Cookie                                    |
| **适用场景** | API 测试、服务器端集成、自动化脚本                            | Web 前端应用、浏览器环境                                           |

### 兼容性说明

虽然项目中的 `OdooRpcClient.call()` 方法支持 `/jsonrpc` 端点：

```typescript
// apps/web/src/lib/odoo-rpc/client.ts
const response = await this.httpClient.post<JsonRpcResponse<T>>("/jsonrpc", request);
```

但项目的认证实现使用的是 `/web/session/authenticate` 端点，与 Postman Collection 的认证方式不同。

### 适用性分析

#### ✅ 适用场景

1. **API 测试与调试**
   - 快速验证 Odoo API 调用
   - 测试不同的 ORM 方法
   - 调试 API 参数和响应

2. **学习参考**
   - 了解 Odoo JSON-RPC 调用格式
   - 理解 `common` 和 `object` 服务的用法
   - 学习搜索域（domain）的构建方式

3. **服务器端集成开发**
   - 作为服务器端集成的参考
   - 了解无状态认证的实现方式
   - 参考 API Key 认证的使用方法

4. **故障排查**
   - 对比项目实现与标准调用
   - 验证 API 端点的可用性
   - 测试不同认证方式的差异

#### ⚠️ 注意事项

1. **认证方式不同**
   - **Postman Collection**：使用 `common.authenticate` 返回 `uid`，后续请求使用 `uid` + `password`
   - **本项目实现**：使用 `/web/session/authenticate`，依赖 Session Cookie

2. **端点路径不同**
   - **Postman Collection**：`/jsonrpc`
   - **本项目实现**：主要使用 `/web/dataset/call_kw`

3. **参数结构差异**
   - **Postman Collection**：`params.service` + `params.method` + `params.args`
   - **本项目实现**：直接调用模型方法，参数结构更简化

4. **状态管理差异**
   - **Postman Collection**：无状态，每次请求都传递认证信息
   - **本项目实现**：有状态，通过 Cookie 管理会话

### 使用建议

1. **作为参考文档**
   - 保留该文档作为学习和参考
   - 用于理解 Odoo JSON-RPC 协议的标准格式
   - 了解 `common` 和 `object` 服务的用法

2. **区分使用场景**
   - 在项目文档中明确标注端点差异
   - 避免混淆不同的认证方式
   - 根据实际需求选择合适的端点

3. **统一支持（可选）**
   - 如需统一，可考虑在项目中增加对 `/jsonrpc` 端点的完整支持
   - 目前 `call` 方法已支持 `/jsonrpc` 端点，但认证方式不同
   - 可以添加 `common.authenticate` 方法的支持

### Postman Collection 主要内容

Postman Collection 包含以下功能模块：

1. **登录和通用服务（Logging in）**
   - 检查服务器版本（`common.version`）
   - 用户认证（`common.authenticate`）

2. **对象/模型服务（Object Service）**
   - 检查访问权限（`check_access_rights`）
   - 搜索记录（`search`、`search_count`、`name_search`）
   - 读取记录（`read`、`read_group`、`search_read`）
   - 创建记录（`create`）
   - 更新记录（`write`）
   - 删除记录（`unlink`）

### 总结

**Postman Collection 文档适用于本项目，但需要注意以下差异：**

- ✅ **适用**：作为 API 测试、学习参考和故障排查的工具
- ⚠️ **注意**：认证方式和端点路径与项目实现不同
- 💡 **建议**：保留作为参考文档，在项目文档中明确标注差异

**关键区别：**

- Postman Collection 使用 `/jsonrpc` 端点和 `uid` + `password` 认证（无状态）
- 本项目使用 `/web/dataset/call_kw` 端点和 `session_id` Cookie 认证（有状态）

---

## 总结

- **`/jsonrpc`**：适合服务器端应用、自动化脚本，使用 API Key 认证
- **`/web/dataset/call_kw`**：适合 Web 前端应用、浏览器环境，使用用户名密码认证

在我们的 Odoo Web 应用中，我们选择使用 `/web/dataset/call_kw` 端点，并通过 `ensureCorrectEndpoint()` 方法确保始终使用正确的端点，避免因底层库的状态管理问题导致使用错误的端点。

---

## 相关文档

- [Odoo 连接架构文档](./ODOO_CONNECTION_ARCHITECTURE.md)
- [并发问题分析](./CONCURRENCY_ANALYSIS.md)
- [业务逻辑审查](./BUSINESS_LOGIC_REVIEW.md)
- [优化总结](./OPTIMIZATION_SUMMARY.md)
