# odoo-core 技术设计文档

> **版本**: 1.0  
> **日期**: 2026-05-31  
> **定位**: OdooSeek 项目的 Rust 共享类型与错误基础设施

---

## 一、设计目标

### 1.1 核心定位

`odoo-core` 是 OdooSeek 项目的 **类型契约层**，为所有依赖 Odoo JSON-RPC 通信的 Rust 组件提供统一的类型定义和错误模型。

```
odoo-core (shared lib)
    ├── types.rs      →  JSON-RPC 协议类型、Session、Login
    ├── error.rs      →  统一错误枚举
    └── config.rs     →  服务器配置

    ↓ 被依赖

odoo-web-server (bin)    未来可能的其他 crate
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **最小依赖** | 仅 `serde` + `serde_json` + `thiserror` 三个强制依赖 |
| **类型即文档** | 每个 struct 对应 Odoo API 的一种契约格式 |
| **错误封闭** | 所有下游错误类型可通过 `From` trait 转换为 `OdooError` |
| **序列化优先** | 所有对外类型实现 `Serialize`/`Deserialize`，确保前后端契约一致 |
| **零业务逻辑** | 仅定义数据类型，不包含任何网络调用或业务处理 |

---

## 二、模块说明

### 2.1 `types.rs` — JSON-RPC 协议类型

#### 2.1.1 JsonRpcRequest / JsonRpcResponse

```rust
pub struct JsonRpcRequest {
    pub jsonrpc: &'static str,     // "2.0"
    pub id: u64,                   // 单调递增
    pub method: String,
    pub params: serde_json::Value,
}

pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    pub data: Option<serde_json::Value>,
}
```

**用途**: 定义 JSON-RPC 2.0 协议的请求/响应/错误格式。当前 `JsonRpcRequest` 支持 `Serialize`（构造请求），`JsonRpcResponse` 支持 `Deserialize`（解析响应）。

> **注意**: `odoo-web-server` 当前使用 `serde_json::json!()` 宏手动构建 JSON-RPC 请求体，而非直接序列化 `JsonRpcRequest`。这两种方式等效，但宏方式更灵活。未来如果出现多个 crate 需要构造 RPC 请求，统一使用此类型将减少代码重复。

#### 2.1.2 SessionInfo

Odoo 19 CE `session_info()` 返回的会话数据。17 个强类型字段 + `#[serde(flatten)] extra` 捕获未知字段：

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `authenticated` | `bool` | derived | `uid.is_some()` |
| `uid` | `Option<i64>` | `session_info.uid` | 用户 ID |
| `name` | `Option<String>` | `session_info.name` | 显示名称 |
| `username` | `Option<String>` | `session_info.username` | 登录名 |
| `db` | `Option<String>` | `session_info.db` | 数据库名 |
| `is_admin` | `Option<bool>` | `session_info.is_admin` | 管理员标志 |
| `is_system` | `Option<bool>` | `session_info.is_system` | 系统用户（root） |
| `partner_id` | `Option<i64>` | `session_info.partner_id` | 关联联系人 ID |
| `partner_display_name` | `Option<String>` | `session_info.partner_display_name` | 联系人名称 |
| `server_version` | `Option<String>` | `session_info.server_version` | 如 `"19.0+e"` |
| `server_version_info` | `Option<Vec<Value>>` | `session_info.server_version_info` | 结构化版本 |
| `user_context` | `Option<Value>` | `session_info.user_context` | `{"lang","tz","uid"}` |
| `user_companies` | `Option<Value>` | `session_info.user_companies` | 公司列表 |
| `web_base_url` | `Option<String>` | `session_info["web.base.url"]` | 基础 URL |
| `home_action_id` | `Option<Value>` | `session_info.home_action_id` | 首页动作 |
| `active_ids_limit` | `Option<i64>` | `session_info.active_ids_limit` | 选中记录上限 |
| `max_file_upload_size` | `Option<i64>` | `session_info.max_file_upload_size` | 上传限制 |
| `groups` | `Option<Value>` | `session_info.groups` | 用户组权限 |
| `extra` | `Value` | `#[serde(flatten)]` | 其他所有字段 |

**关键方法**:
- `SessionInfo::anonymous()` — 返回 `authenticated: false` 的空会话
- `SessionInfo::default()` — 所有字段 `None`/`false`

#### 2.1.3 LoginRequest

```rust
pub struct LoginRequest {
    pub db: String,         // 数据库名
    pub login: String,      // 用户名或邮箱
    password: String,       // ⚠️ 私有字段，Debug 显示 "***"
}
```

**安全措施**: 密码字段为 `private`，手动实现 `Debug` 输出 `"***"`。序列化时自动跳过 (`#[serde(skip_serializing)]`)，防止日志/错误信息泄露密码。

### 2.2 `error.rs` — 错误类型

```rust
#[derive(Error, Debug)]
pub enum OdooError {
    Http(#[from] reqwest::Error),           // 网络层错误
    Unreachable(String),                     // 服务不可达
    Api { code: i64, message: String, data: Option<Value> },  // Odoo API 错误
    InvalidResponse(String),                 // 响应解析失败
    Config(String),                          // 配置错误
    NotAuthenticated,                        // 未认证
    Deserialization(#[from] serde_json::Error),  // JSON 反序列化失败
}

pub type OdooResult<T> = Result<T, OdooError>;
```

**变体使用场景**:

| 变体 | 触发条件 | HTTP Status |
|------|----------|:----------:|
| `Http` | `reqwest` 请求失败（DNS/TLS/连接） | 502 |
| `Unreachable` | Odoo 不可达或超时 | 502 |
| `Api { code: 100 }` | Session 过期 | 401 |
| `Api { code: N }` | Odoo 业务逻辑错误 | 200 |
| `InvalidResponse` | 响应无法解析 | 500 |
| `Config` | 配置缺失/无效 | 500 |
| `NotAuthenticated` | 未携带有效 Cookie | 401 |
| `Deserialization` | JSON 解析失败 | 500 |

### 2.3 `config.rs` — 服务器配置

```rust
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub odoo_url: String,
    pub odoo_db: Option<String>,
    pub frontend_dir: String,
    pub log_level: String,
}
```

通过 `from_env()` 从环境变量加载，提供合理默认值。

---

## 三、依赖关系

```
[workspace.dependencies]
├── serde 1.x (derive)      — 序列化/反序列化
├── serde_json 1.x           — JSON 格式
├── thiserror 2.x            — 错误派生宏
└── reqwest 0.12             — 网络错误类型 (OdooError::Http)
```

| 依赖 | 用途 | 是否可选 |
|------|------|:--:|
| `serde` | 所有对外类型的序列化 | ❌ 必须 |
| `serde_json` | JSON 格式支持 | ❌ 必须 |
| `thiserror` | Error 派生宏 | ❌ 必须 |
| `reqwest` | `From<reqwest::Error>` 转换 | ❌ odoo-web-server 需要 |

---

## 四、测试覆盖

15 个单元测试，覆盖所有公开类型：

| 模块 | 测试数 | 覆盖内容 |
|------|:--:|------|
| `types.rs` | 12 | JSON-RPC 序列化/反序列化、SessionInfo、LoginRequest |
| `error.rs` | 2 | OdooError Display/From 转换 |
| `config.rs` | 3 | 默认值、环境变量解析 |

**未覆盖**：
- `config.rs` 的非法值错误路径
- `OdooError` 的 `Api`/`InvalidResponse`/`Config`/`Unreachable` Display
- `SessionInfo` 的 `#[serde(flatten)]` extra 字段保留

---

## 五、能力边界

### 5.1 包含

- JSON-RPC 2.0 协议的核心数据结构
- Odoo 认证与会话管理的类型契约
- 统一的错误类型体系
- 服务器配置的环境加载

### 5.2 不包含

| 范围 | 说明 |
|------|------|
| Odoo ORM 方法调用 | 由 `odoo-web-server` 的 proxy 层处理 |
| 业务模型类型 (res.partner, etc.) | 数量太大，且 Odoo 版本间不一致 |
| 网络请求 | 属于 `odoo-web-server` 的职责 |
| 缓存逻辑 | `odoo-web-server` 的 `cache.rs` |
| 事件通知类型 | `odoo-web-server` 的 `ws.rs` |
| 菜单/UI 数据类型 | 前端 `menu-service.ts` 有自己的类型系统 |

### 5.3 未来扩展方向

| 扩展 | 优先级 | 说明 |
|------|:------:|------|
| `OdooSearchParams` | P1 | 统一搜索参数类型（model, domain, fields, offset, limit, order） |
| `OdooDomain` 构建器 | P2 | 类型安全的 domain 表达式构建 |
| `OdooVersion` | P2 | 结构化版本号用于特性检测 |
| `OdooId` newtype | P3 | 区分不同模型的 ID |
| `OdooMenu`/`OdooAction` | P3 | 菜单和动作的类型定义 |

---

## 六、使用示例

```rust
use odoo_core::types::{SessionInfo, LoginRequest};
use odoo_core::error::OdooError;

// 构造匿名会话
let info = SessionInfo::anonymous();
assert!(!info.authenticated);

// 反序列化登录请求
let raw = r#"{"db":"odoo","login":"admin","password":"secret"}"#;
let req: LoginRequest = serde_json::from_str(raw)?;
assert_eq!(req.login, "admin");

// 错误处理
let err = OdooError::Api {
    code: 100,
    message: "Session expired".into(),
    data: None,
};
match err {
    OdooError::Api { code: 100, .. } => println!("Session expired → redirect to login"),
    _ => println!("Other error"),
}
```

---

## 七、与 odoo-web-server 的集成

```
odoo-core 类型                        odoo-web-server 使用位置
─────────────────                    ──────────────────────────
SessionInfo                          session.rs, helpers.rs
LoginRequest                         session.rs (login)
OdooError                            session.rs, proxy.rs, menu.rs, report.rs, ws.rs
ServerConfig                         main.rs
```

**未使用的类型** (保留备用):
- `JsonRpcRequest` — BFF 使用宏构建请求，未序列化此类型
- `JsonRpcResponse` — BFF 直接操作 `serde_json::Value`
- `JsonRpcError` — 概念嵌入在 `OdooError::Api` 中
- `OdooResult<T>` — BFF 使用自己的 `AppError` 封装

---

**文档版本**: 1.0  
**创建日期**: 2026-05-31  
**维护团队**: OdooSeek
