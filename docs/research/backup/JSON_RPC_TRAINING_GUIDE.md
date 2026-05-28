## JSON-RPC 2.0 培训教程（面向技术人员）

- **适用对象**：前端/后端开发、测试、运维、接口联调人员
- **学习目标**：
  - 理解 JSON-RPC 2.0 的核心概念与报文结构
  - 能独立完成 JSON-RPC 的调用、调试、错误处理、批量请求、通知
  - 能在工程中落地：鉴权、超时重试、幂等、安全、日志与链路追踪
- **版本信息**：v1（2025-12-18）

### 目录

- 1. JSON-RPC 是什么（为什么用它）
  - 1.3 从实现原理看：RPC 与 HTTP/HTTPS 的关系
- 2. JSON-RPC 2.0 报文规范（必须掌握）
- 3. 请求与响应示例（联调模板）
- 4. Notification（通知：不需要响应）
- 5. Batch（批量请求：一次发多个调用）
- 6. 调用方式（curl/TypeScript 最小实现）
- 7. 联调与排障清单（常见坑）
- 8. 安全与治理（生产环境必讲）
- 9. 实操训练（建议 1 天课程）
- 10.（可选）结合项目的落地建议
- 11.（扩展）JSON-RPC 与 GraphQL 的区别

---

## 1. JSON-RPC 是什么（为什么用它）

### 1.1 定义

**JSON-RPC** 是一种使用 **JSON** 作为消息格式的远程过程调用（RPC）协议。常见实现为 **JSON-RPC 2.0**。

### 1.2 与 REST 的常见差异（联调时必须明确）

- **REST**：围绕资源（URL）与动词（GET/POST/PUT/DELETE）
- **JSON-RPC**：围绕“方法调用”（`method`），请求多为 **POST**，URL 往往固定（例如 `/rpc`、`/jsonrpc`）

JSON-RPC 的常见优势：

- **接口形态统一**：一个入口 + 多个方法
- **贴近业务动作**：方法名表达“做什么”
- **内置批量调用**与**通知（无返回）**能力

### 1.3 从实现原理看：RPC 与 HTTP/HTTPS 的关系

- **结论**：在 Web 场景中，JSON-RPC 绝大多数情况下是**跑在 HTTP/HTTPS 之上的应用层协议**：通常使用 **HTTP POST**，把 JSON-RPC 报文放在 **HTTP Body** 中发送到一个固定入口（例如 `/jsonrpc`），响应体再返回 JSON-RPC 的结果（`result`）或错误（`error`）。
- **RPC 不等于传输协议**：RPC 描述的是“像调用本地函数一样调用远端方法”的交互语义；HTTP/HTTPS 负责“把消息可靠地传过去并拿回响应”。
- **JSON-RPC 2.0 不限定承载协议**：规范只规定 JSON 报文结构与语义，理论上也可以跑在 WebSocket、TCP、消息队列等承载之上；但工程上最常见的是 HTTP/HTTPS。
- **对比提示**：例如 gRPC 往往基于 **HTTP/2**（并使用 protobuf 等序列化），也是 RPC，但不属于 JSON-RPC。
- **联调注意事项**：不要只看 HTTP 状态码判断成功/失败（HTTP 200 也可能返回 JSON-RPC `error`）；同时要关注 `Content-Type`、鉴权头、超时与重试策略是否满足幂等要求。

---

## 2. JSON-RPC 2.0 报文规范（必须掌握）

JSON-RPC 2.0 请求对象包含关键字段：

- **`jsonrpc`**：固定为 `"2.0"`
- **`method`**：方法名（字符串）
- **`params`**：参数（可选，数组或对象）
- **`id`**：请求标识（可选；有 `id` 才需要响应；用于关联请求与响应）

响应对象两种形态（二选一）：

- **成功**：`result`
- **失败**：`error`（含 `code`、`message`、可选 `data`）

---

## 3. 请求与响应示例（联调模板）

### 3.1 基本调用（成功）

请求：

```json
{
  "jsonrpc": "2.0",
  "method": "sum",
  "params": [1, 2, 3],
  "id": "req-1001"
}
```

成功响应：

```json
{
  "jsonrpc": "2.0",
  "result": 6,
  "id": "req-1001"
}
```

### 3.2 命名参数（推荐：可读性/兼容性更好）

```json
{
  "jsonrpc": "2.0",
  "method": "createUser",
  "params": { "name": "Alice", "role": "admin" },
  "id": "req-1002"
}
```

### 3.3 错误响应（必须按规范处理）

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { "method": "xxx.yyy" }
  },
  "id": "req-1003"
}
```

常见标准错误码（节选）：

- **-32700**：Parse error（JSON 解析失败）
- **-32600**：Invalid Request（结构不合法）
- **-32601**：Method not found（方法不存在）
- **-32602**：Invalid params（参数不合法）
- **-32603**：Internal error（服务端内部错误）

---

## 4. Notification（通知：不需要响应）

适用场景：埋点、异步触发、日志上报等“只发不等”。

```json
{
  "jsonrpc": "2.0",
  "method": "trackEvent",
  "params": { "event": "page_view" }
}
```

要点：

- **没有 `id`** 就是通知
- 服务端**不能**对通知返回 JSON-RPC 响应（HTTP 层可能仍返回 200/204）

---

## 5. Batch（批量请求：一次发多个调用）

```json
[
  { "jsonrpc": "2.0", "method": "sum", "params": [1, 2], "id": "b1" },
  { "jsonrpc": "2.0", "method": "sum", "params": [3, 4], "id": "b2" },
  { "jsonrpc": "2.0", "method": "trackEvent", "params": { "event": "x" } }
]
```

要点：

- 批量里可以混合“普通请求”和“通知”
- 响应是数组，且**顺序不保证与请求一致**（以 `id` 关联）
- 纯通知批量：服务端可能返回空响应体

---

## 6. 调用方式（curl/TypeScript 最小实现）

### 6.1 curl（快速验证联调）

```bash
curl -sS -X POST "http://localhost:8080/jsonrpc" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"sum","params":[1,2,3],"id":"req-1"}'
```

### 6.2 TypeScript（客户端最小实现骨架）

```ts
type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown[] | Record<string, unknown>;
  id?: JsonRpcId;
};

type JsonRpcSuccess<T> = { jsonrpc: "2.0"; result: T; id: JsonRpcId };
type JsonRpcError = { code: number; message: string; data?: unknown };
type JsonRpcFailure = { jsonrpc: "2.0"; error: JsonRpcError; id: JsonRpcId };
type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export async function jsonRpcCall<T>(
  url: string,
  req: JsonRpcRequest,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  const body = (await res.json()) as JsonRpcResponse<T>;

  if ("error" in body) {
    throw new Error(`JSON-RPC error ${body.error.code}: ${body.error.message}`);
  }
  return body.result;
}
```

---

## 7. 联调与排障清单（常见坑）

- **Content-Type**：必须是 `application/json`（有些服务端对 charset 也敏感）
- **`jsonrpc` 字段**：必须严格为 `"2.0"`
- **`id` 类型**：建议用字符串（便于链路追踪），通知不带 `id`
- **错误处理**：不要只看 HTTP 状态码，JSON-RPC 可能 HTTP 200 但 `error` 不为空
- **批量响应乱序**：只能靠 `id` 关联，不能靠数组顺序
- **超时与重试**：重试要考虑幂等（尤其是创建/写入类方法）
- **日志**：客户端与服务端都应记录 `id`、`method`、耗时、错误码

---

## 8. 安全与治理（生产环境必讲）

- **传输安全**：强制 HTTPS / 内网 mTLS（视场景）
- **鉴权**：Token/Cookie/签名（统一在网关或中间件层处理）
- **权限控制**：方法级权限（谁能调用哪些 `method`）
- **速率限制**：按用户/应用/方法做限流，避免批量滥用
- **输入校验**：`params` 必须做 schema 校验与类型检查
- **错误信息**：对外错误信息避免泄露内部栈/SQL；内部日志保留详细 `data`

---

## 9. 实操训练（建议 1 天课程，可直接上课）

### 9.1 课程安排（6–7 小时）

- **模块 A（1h）**：协议与报文结构（请求/响应/错误）
- **模块 B（1h）**：通知与批量、id 关联与乱序处理
- **模块 C（2h）**：实现客户端封装（超时、重试、日志、类型）
- **模块 D（1h）**：调试方法（curl/Postman/抓包/日志定位）
- **模块 E（1h）**：安全与治理（鉴权、限流、输入校验、审计）

### 9.2 练习题（可做考核）

- **练习 1**：用 curl 调用 `sum`，构造一次成功与一次 `-32602` 参数错误
- **练习 2**：实现一个 `jsonRpcCall`，要求：
  - 自动生成 `id`（UUID 或递增均可）
  - 统一把错误转换为“可读的中文错误消息”（用于 UI/日志）
  - 记录耗时与 method
- **练习 3**：实现 batch：并发发起 5 个请求，按 `id` 汇总结果（处理乱序）
- **练习 4**：为“写操作”设计幂等键（例如 `request_id`），避免重试重复创建

---

## 10.（可选）结合项目的落地建议

如果你的项目已存在 JSON-RPC 客户端与接口契约（例如前端 `rpc-client` 与 JSON 定义文件），建议培训时补充一段“项目实战”：

- **接口契约**：以统一的接口定义文件/类型作为单一事实来源，避免口头对齐
- **统一错误语义**：把服务端 `error.code` 映射为中文可读错误，并保留 `data` 供排障
- **测试策略**：对关键方法做集成测试（覆盖超时、重试、权限不足、参数非法）

---

## 11.（扩展）JSON-RPC 与 GraphQL 的区别

### 11.1 核心定位不同

- **JSON-RPC**：一种 **RPC 协议**（“调用远端方法”）。请求核心是 `method + params`，服务端执行方法后返回 `result` 或 `error`。
- **GraphQL**：一种 **查询语言 + 运行时规范**（“按字段取数据”）。请求核心是 `query/mutation/subscription`，客户端声明需要哪些字段，服务端按 schema 解析与执行。

### 11.2 接口形态与契约

- **JSON-RPC**：
  - **契约中心**：方法名（`method`）+ 参数结构（`params`）
  - **调用形态**：通常一个入口（如 `/jsonrpc`）承载多个方法
  - **强类型**：协议本身不提供类型系统（工程里常用 TypeScript 类型、JSON Schema 或自定义契约补齐）
- **GraphQL**：
  - **契约中心**：强类型 **Schema（SDL）**
  - **调用形态**：通常一个入口（如 `/graphql`）承载所有查询/变更
  - **强类型**：类型、字段、输入、枚举、非空、列表等内建；工具链成熟（可生成类型与文档）

### 11.3 返回数据形状由谁决定

- **JSON-RPC**：一般由服务端方法决定返回结构；客户端只能选择调用哪个方法、传哪些参数。
- **GraphQL**：客户端可精确选择字段与嵌套结构，减少 over-fetch/under-fetch。

### 11.4 错误模型

- **JSON-RPC**：失败走统一 `error: { code, message, data? }`；成功走 `result`；`id` 用于关联请求与响应。
- **GraphQL**：响应通常包含 `data` 与 `errors`（允许“部分成功”）；错误可定位到字段路径。

### 11.5 批量与网络交互能力

- **JSON-RPC**：协议层内建 **batch** 与 **notification（无返回）**。
- **GraphQL**：规范本身不强调 batch（常由客户端/网关实现，例如合并查询、persisted queries 等）；订阅（subscription）常配合 WebSocket。

### 11.6 何时选哪个（快速判断）

- **更适合 JSON-RPC**：
  - 以“业务动作/命令式接口”为主（创建、提交、审批等）
  - 希望治理简单：按方法做权限、限流、审计、日志
  - 已有稳定的方法体系或后端框架天然暴露 RPC（例如 ERP/中台场景常见）
- **更适合 GraphQL**：
  - 多端对同一数据的字段需求差异很大
  - 页面需要一次拿到复杂嵌套数据，减少多次请求与拼装
  - 强依赖类型契约与自动化工具链（类型生成、查询校验、文档）
