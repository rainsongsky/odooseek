# Odoo 连接与模型获取架构文档

## 概述

本文档详细阐述 Odoo Web 应用中连接 Odoo 服务器和获取模型数据的完整机制，包括认证流程、会话管理、状态持久化、错误处理等核心环节。

## 目录

1. [架构概览](#架构概览)
2. [连接流程](#连接流程)
3. [认证机制](#认证机制)
4. [会话管理](#会话管理)
5. [模型查询流程](#模型查询流程)
6. [状态持久化](#状态持久化)
7. [代理配置](#代理配置)
8. [错误处理与重连机制](#错误处理与重连机制)
9. [关键组件说明](#关键组件说明)

---

## 架构概览

### 组件层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                      React 组件层                              │
│  (OdooModelsPage, OdooConnectionPage)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    React Hooks 层                            │
│  useOdooClient() ──┐                                         │
│  useOdooQuery()    ├──► useOdooStore (Zustand)              │
│  useOdooContext()  ─┘                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   业务逻辑层                                  │
│  OdooClient (封装层)                                         │
│    ├── 连接管理                                              │
│    ├── Session 管理                                          │
│    └── 查询封装                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   底层客户端层                               │
│  OdooJSONRpcClient (@hl8/odoo-json-rpc)                    │
│    ├── HTTP 请求                                             │
│    ├── JSON-RPC 协议                                         │
│    └── Cookie 管理                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   持久化层                                    │
│  IndexedDB (odooConnectionStorage, odooSessionStorage)     │
│    ├── 配置持久化                                            │
│    └── Session 持久化                                         │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

```
用户操作
   │
   ▼
React 组件
   │
   ▼
useOdooClient Hook
   │
   ├──► 初始化客户端 ──► OdooClient ──► OdooJSONRpcClient
   │
   ├──► 连接请求 ──► OdooClient.connect() ──► 认证 API
   │                                              │
   │                                              ▼
   │                                         Set-Cookie 响应
   │                                              │
   │                                              ▼
   ├──► 保存 Session ──► useOdooStore ──► IndexedDB
   │
   └──► 查询模型 ──► useOdooQuery ──► OdooClient.searchRead()
                                          │
                                          ▼
                                    OdooJSONRpcClient.searchRead()
                                          │
                                          ▼
                                    模型数据返回
```

---

## 连接流程

### 1. 初始化阶段

#### 1.1 配置恢复

应用启动时，从持久化存储中恢复连接配置：

```typescript
// 优先级：IndexedDB > localStorage
const config = (await odooConnectionStorage.get()) || getConfigFromStorage();
```

**配置来源优先级：**

1. IndexedDB (`odooConnectionStorage`)
2. localStorage (`localStorage.getItem('odoo_connection_config')`)
3. 环境变量 (`VITE_ODOO_*`)
4. 默认配置

#### 1.2 开发环境代理应用

在开发环境中，如果配置指向本地 Odoo 服务器（`localhost:8069`），自动应用 Vite 代理：

```typescript
// apps/odoo-web/src/lib/odoo/config.ts
export function applyDevProxy(config: Partial<OdooClientConfig>) {
  if (IS_DEV && isLocalOdoo) {
    return {
      ...config,
      baseUrl: "/api/odoo", // 使用代理路径
      port: undefined, // 不设置端口
    };
  }
  return config;
}
```

**代理映射：**

- 前端请求：`/api/odoo/web/session/authenticate`
- 代理转发：`http://localhost:8069/web/session/authenticate`

#### 1.3 Store 状态恢复（Hydration）

从 IndexedDB 恢复客户端和会话状态：

```typescript
// apps/odoo-web/src/stores/odoo-store.ts
async hydrate() {
  // 1. 恢复配置
  const config = await odooConnectionStorage.get();

  // 2. 恢复会话
  const session = await odooSessionStorage.get();

  // 3. 如果配置和会话都存在，尝试初始化客户端
  if (config && session) {
    const client = new OdooClient(config);
    set({ client, session, hydrated: true });
  } else if (config) {
    // 只有配置，初始化客户端但不连接
    const client = new OdooClient(config);
    set({ client, hydrated: true });
  } else {
    set({ hydrated: true });
  }
}
```

### 2. 客户端初始化

#### 2.1 useOdooClient Hook 初始化

```typescript
// apps/odoo-web/src/hooks/use-odoo-client.ts
export function useOdooClient(config, options) {
  // 1. 等待 Store 完成 Hydration
  if (!hydrated) {
    return; // 等待 hydrate 完成
  }

  // 2. 检查是否需要初始化
  const needsInit = !client && !!config;

  // 3. 初始化客户端
  if (needsInit && !hasInitialized) {
    const client = new OdooClient(config);
    await setClient(client, config);
  }
}
```

**初始化条件：**

- Store 已完成 Hydration
- 提供了有效配置
- 尚未初始化过（防止重复初始化）

#### 2.2 OdooClient 实例创建

```typescript
// apps/odoo-web/src/lib/odoo/client.ts
export class OdooClient {
  private client: OdooJSONRpcClient;
  private session: OdooSessionInfo | null = null;

  constructor(config: OdooClientConfig) {
    this.client = new OdooJSONRpcClient(config);
  }
}
```

### 3. 连接触发

#### 3.1 自动连接条件

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
const autoConnect = useMemo(() => {
  return (
    hydrated && // Store 已恢复
    !needsInit && // 不需要初始化
    !needsInitWithSession && // 不需要重新初始化
    (needsReconnect || !session) && // 需要重连或没有会话
    !!stableRestoredConfig // 有稳定配置
  );
}, [
  hydrated,
  needsInit,
  needsInitWithSession,
  needsReconnect,
  session,
  stableRestoredConfig,
]);
```

**自动连接场景：**

1. 首次连接：有配置但无会话
2. 会话过期：有客户端但会话无效
3. 会话丢失：有客户端但会话被清除

#### 3.2 手动连接

用户点击"连接"按钮时触发：

```typescript
const handleConnect = async () => {
  await connect();
};
```

---

## 认证机制

### 1. 认证请求流程

#### 1.1 底层客户端认证

```typescript
// libs/odoo-json-rpc/src/lib/client.ts
private async connectWithCredentials(config) {
  const endpoint = `${this.url}/web/session/authenticate`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // 允许 Cookie 传输
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: config.db,
        login: config.username,
        password: config.password,
      },
    }),
  });

  const { result } = await response.json();
  return result;  // OdooAuthenticateWithCredentialsResponse
}
```

#### 1.2 Session ID 提取

底层客户端尝试从多个来源提取 `session_id`：

```typescript
// libs/odoo-json-rpc/src/lib/client.ts
let sessionId: string | undefined;

// 方法1: 从响应头读取（Node.js 环境）
const cookies = response.headers.get("set-cookie");
if (cookies && cookies.includes("session_id")) {
  sessionId = extractSessionIdFromCookie(cookies);
}

// 方法2: 从 document.cookie 读取（浏览器环境）
// 浏览器需要时间处理 Set-Cookie，重试最多 10 次，每次 200ms
if (!sessionId && typeof document !== "undefined") {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cookieString = document.cookie;
    const match = cookieString.match(/session_id=([^;,\s]+)/);
    if (match) {
      sessionId = match[1].trim();
      break;
    }
  }
}

// 方法3: 从响应体读取
if (!sessionId && result?.session_id) {
  sessionId = result.session_id;
}

// 方法4: 从客户端内部属性获取
if (!sessionId && this.session_id) {
  sessionId = this.session_id;
}
```

#### 1.3 OdooClient 层 Session ID 同步

```typescript
// apps/odoo-web/src/lib/odoo/client.ts
async connect(): Promise<OdooSessionInfo> {
  const response = await this.client.connect();

  // 尝试从多个来源获取 session_id
  let sessionId: string | undefined;

  // 方法1: 从响应对象中获取
  if (response?.session_id) {
    sessionId = response.session_id;
  }

  // 方法2: 从底层客户端获取
  if (!sessionId && this.client.session_id) {
    sessionId = this.client.session_id;
  }

  // 方法3: 从浏览器 Cookie 中获取（重试最多 15 次，每次 200ms）
  if (!sessionId && typeof document !== 'undefined') {
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const cookieString = document.cookie;
      const match = cookieString.match(/session_id=([^;,\s]+)/);
      if (match) {
        sessionId = match[1].trim();
        break;
      }
    }
  }

  // 设置到底层客户端
  if (sessionId && !this.client.session_id) {
    this.client.session_id = sessionId;
  }

  return response;
}
```

### 2. Cookie 处理机制

#### 2.1 Vite 代理 Cookie 转发

```typescript
// apps/odoo-web/vite.config.ts
proxy: {
  '/api/odoo': {
    target: 'http://localhost:8069',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/odoo/, ''),
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes, req) => {
        // 修改 Set-Cookie 头，确保浏览器能正确设置
        if (proxyRes.headers['set-cookie']) {
          const cookies = Array.isArray(proxyRes.headers['set-cookie'])
            ? proxyRes.headers['set-cookie']
            : [proxyRes.headers['set-cookie']];

          proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
            return cookie
              .replace(/;\s*domain=[^;]+/gi, '')      // 移除域名限制
              .replace(/;\s*path=[^;]+/gi, '; path=/') // 设置路径为 /
              .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=Lax'); // 设置 SameSite
          });
        }
      });
    },
  },
}
```

**Cookie 修改原因：**

- 移除 `domain` 限制：允许在当前域名下设置 Cookie
- 设置 `path=/`：确保 Cookie 在整个应用下可用
- 设置 `SameSite=Lax`：允许跨站请求携带 Cookie

#### 2.2 Cookie 读取策略

由于浏览器安全限制，无法直接读取 `Set-Cookie` 响应头，因此采用以下策略：

1. **等待浏览器处理**：浏览器自动处理 `Set-Cookie` 并存储到 `document.cookie`
2. **轮询检查**：定期检查 `document.cookie` 中是否出现 `session_id`
3. **重试机制**：最多重试 15 次，每次间隔 200ms（总共最多等待 3 秒）

---

## 会话管理

### 1. Session 存储

#### 1.1 Store 中保存

```typescript
// apps/odoo-web/src/stores/odoo-store.ts
setSession: async (session) => {
  set({ session }); // Zustand 同步更新

  // 异步保存到 IndexedDB
  const expiresAt = session.exp ? session.exp * 1000 : undefined;
  await odooSessionStorage.save(session, expiresAt);
};
```

#### 1.2 IndexedDB 持久化

```typescript
// apps/odoo-web/src/lib/odoo/db.ts
export const odooSessionStorage = {
  async save(session: OdooSessionInfo, expiresAt?: number) {
    const db = await getDB();
    const tx = db.transaction(["odoo_sessions"], "readwrite");
    const store = tx.objectStore("odoo_sessions");

    await store.put({
      id: "current",
      session,
      expiresAt,
      updatedAt: Date.now(),
    });
  },

  async get(): Promise<OdooSessionInfo | null> {
    const db = await getDB();
    const tx = db.transaction(["odoo_sessions"], "readonly");
    const store = tx.objectStore("odoo_sessions");
    const data = await store.get("current");

    // 检查是否过期
    if (data?.expiresAt && Date.now() > data.expiresAt) {
      await store.delete("current");
      return null;
    }

    return data?.session || null;
  },
};
```

### 2. Session 验证

#### 2.1 过期检查

```typescript
// apps/odoo-web/src/lib/odoo/db.ts
async get() {
  const data = await store.get('current');

  // 检查过期时间
  if (data?.expiresAt && Date.now() > data.expiresAt) {
    await store.delete('current');
    return null;  // 已过期，返回 null
  }

  return data?.session || null;
}
```

#### 2.2 连接状态验证

```typescript
// apps/odoo-web/src/lib/odoo/client.ts
isConnected(): boolean {
  return this.client.is_connected && !!this.session;
}
```

### 3. Session 清除

#### 3.1 手动清除

```typescript
// apps/odoo-web/src/stores/odoo-store.ts
clearSession: async () => {
  set({ session: null, client: null }); // 清除 Store 状态

  // 清除 IndexedDB
  await odooSessionStorage.clear();
  await odooConnectionStorage.clear();
};
```

#### 3.2 认证错误时自动清除

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
useEffect(() => {
  if (error instanceof OdooAuthenticationError) {
    clearSession(); // 清除会话
    // 延迟后重新连接
    setTimeout(() => {
      connect();
    }, 1500);
  }
}, [error]);
```

---

## 模型查询流程

### 1. 查询触发

#### 1.1 useOdooQuery Hook

```typescript
// apps/odoo-web/src/hooks/use-odoo-query.ts
export function useOdooQuery(model, domain, fields, options) {
  const { client, session } = useOdooStore();

  return useQuery({
    queryKey: ["odoo", model, domain, fields, options],
    queryFn: async () => {
      if (!client) {
        throw new Error("Odoo client not initialized");
      }
      return await client.searchRead(model, domain, fields, options);
    },
    enabled: enabled && !!client && !!session, // 需要客户端和会话都存在
    retry: (failureCount, error) => {
      // 认证错误不重试，由组件处理
      if (error instanceof OdooAuthenticationError) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
```

#### 1.2 查询启用条件

```typescript
enabled: enabled && !!client && !!session;
```

**启用条件：**

- `enabled` 选项为 `true`（默认）
- 客户端已初始化
- 会话存在

### 2. 查询执行

#### 2.1 OdooClient.searchRead()

```typescript
// apps/odoo-web/src/lib/odoo/client.ts
async searchRead(model, domain, fields, options) {
  // 1. 验证连接状态
  if (!this.client.is_connected) {
    // 尝试恢复连接状态
    if (this.session) {
      this.client.is_connected = true;
      if (this.session.session_id) {
        this.client.session_id = this.session.session_id;
      }
    } else {
      throw new OdooAuthenticationError('未连接到 Odoo 服务器');
    }
  }

  // 2. 如果底层客户端没有 session_id，尝试从 Cookie 中获取
  if (!this.client.session_id && typeof document !== 'undefined') {
    const cookieString = document.cookie;
    const match = cookieString.match(/session_id=([^;,\s]+)/);
    if (match) {
      this.client.session_id = match[1].trim();
    }
  }

  // 3. 执行查询
  return await this.client.searchRead(model, domain, fields, options);
}
```

#### 2.2 底层客户端查询

```typescript
// libs/odoo-json-rpc/src/lib/client.ts
async searchRead(model, domain, fields, options) {
  // 1. 检查连接状态，如果未连接则自动连接
  if (!this.is_connected) {
    await this.connect();
  }

  // 2. 调用 call_kw 方法
  return await this.call_kw(model, 'search_read', [domain], {
    fields,
    ...options,
  });
}

async call_kw(model, method, args, kwargs) {
  // 如果有 session_id，使用 callWithSessionId
  if (this.session_id) {
    return this.callWithSessionId(model, method, args, kwargs);
  }

  // 如果有 uid，使用 callWithUid（API Key 认证）
  if (this.uid) {
    return this.callWithUid(model, method, args, kwargs);
  }

  // 如果没有 session_id 和 uid，但浏览器可能已经设置了 cookie
  // 尝试直接调用，依赖浏览器的 cookie
  return this.callWithSessionId(model, method, args, kwargs);
}
```

#### 2.3 请求发送

```typescript
// libs/odoo-json-rpc/src/lib/client.ts
private async callWithSessionId(model, method, args, kwargs) {
  const endpoint = `${this.url}/web/dataset/call_kw`;

  const headers = {
    'Content-Type': 'application/json',
  };

  // 如果有 session_id，添加到请求头
  if (this.session_id) {
    headers['X-Openerp-Session-Id'] = this.session_id;
    headers['Cookie'] = `session_id=${this.session_id}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    credentials: 'include',  // 允许 cookie 传输（即使没有显式的 session_id）
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
    }),
  });

  const { result, error } = await response.json();
  if (error) {
    throw new Error(error.data?.message || error.message);
  }

  return result;
}
```

### 3. 查询结果处理

#### 3.1 TanStack Query 缓存

```typescript
// apps/odoo-web/src/hooks/use-odoo-query.ts
return useQuery({
  queryKey: ["odoo", model, domain, fields, options],
  queryFn: async () => {
    return await client.searchRead(model, domain, fields, options);
  },
  staleTime: 5 * 60 * 1000, // 5 分钟内数据视为新鲜
  cacheTime: 10 * 60 * 1000, // 10 分钟内保留缓存
});
```

#### 3.2 错误处理

```typescript
// apps/odoo-web/src/hooks/use-odoo-query.ts
retry: (failureCount, error) => {
  // 认证错误不重试，由组件处理
  if (error instanceof OdooAuthenticationError) {
    return false;
  }
  // 其他错误重试最多 3 次
  return failureCount < 3;
},
```

---

## 状态持久化

### 1. 配置持久化

#### 1.1 IndexedDB 存储

```typescript
// apps/odoo-web/src/lib/odoo/db.ts
export const odooConnectionStorage = {
  async save(config: OdooClientConfig) {
    const db = await getDB();
    const tx = db.transaction(["odoo_connections"], "readwrite");
    const store = tx.objectStore("odoo_connections");

    await store.put({
      id: "current",
      config,
      updatedAt: Date.now(),
    });
  },

  async get(): Promise<OdooClientConfig | null> {
    const db = await getDB();
    const tx = db.transaction(["odoo_connections"], "readonly");
    const store = tx.objectStore("odoo_connections");
    const data = await store.get("current");

    return data?.config || null;
  },
};
```

#### 1.2 localStorage 回退

```typescript
// apps/odoo-web/src/lib/odoo/config.ts
export function saveConfigToStorage(config: OdooClientConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn("Failed to save config to localStorage:", error);
  }
}

export function getConfigFromStorage(): OdooClientConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
```

### 2. Session 持久化

#### 2.1 IndexedDB 存储

```typescript
// apps/odoo-web/src/lib/odoo/db.ts
export const odooSessionStorage = {
  async save(session: OdooSessionInfo, expiresAt?: number) {
    const db = await getDB();
    const tx = db.transaction(["odoo_sessions"], "readwrite");
    const store = tx.objectStore("odoo_sessions");

    await store.put({
      id: "current",
      session,
      expiresAt,
      updatedAt: Date.now(),
    });
  },

  async get(): Promise<OdooSessionInfo | null> {
    const db = await getDB();
    const tx = db.transaction(["odoo_sessions"], "readonly");
    const store = tx.objectStore("odoo_sessions");
    const data = await store.get("current");

    // 检查过期
    if (data?.expiresAt && Date.now() > data.expiresAt) {
      await store.delete("current");
      return null;
    }

    return data?.session || null;
  },
};
```

### 3. 状态恢复流程

#### 3.1 Store Hydration

```typescript
// apps/odoo-web/src/stores/odoo-store.ts
hydrate: async () => {
  // 1. 恢复配置
  const config = await odooConnectionStorage.get();

  // 2. 恢复会话
  const session = await odooSessionStorage.get();

  // 3. 如果配置存在，初始化客户端
  if (config) {
    try {
      const client = new OdooClient(config);
      set({ client, session, hydrated: true });
    } catch (error) {
      // 初始化失败，仍然设置 hydrated 为 true
      set({ session, hydrated: true });
    }
  } else {
    set({ hydrated: true });
  }
};
```

#### 3.2 组件级恢复

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
useEffect(() => {
  const restoreConfig = async () => {
    // 优先从 IndexedDB 恢复
    const indexedDbConfig = await odooConnectionStorage.get();
    if (indexedDbConfig) {
      const proxied = applyDevProxy(indexedDbConfig);
      setRestoredConfig(proxied);
      return;
    }

    // 回退到 localStorage
    const storedConfig = getConfigFromStorage();
    const defaultConfig = getDefaultConfig();
    const mergedConfig = storedConfig ? mergeConfig(defaultConfig, storedConfig) : null;
    const proxiedConfig = mergedConfig ? applyDevProxy(mergedConfig) : null;
    setRestoredConfig(proxiedConfig);
  };

  restoreConfig();
}, []);
```

---

## 代理配置

### 1. Vite 开发代理

#### 1.1 代理配置

```typescript
// apps/odoo-web/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api/odoo": {
        target: "http://localhost:8069",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/odoo/, ""),
        cookieDomainRewrite: "",
        cookiePathRewrite: "/",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req) => {
            // CORS 头设置
            proxyRes.headers["Access-Control-Allow-Origin"] = req.headers.origin || "*";
            proxyRes.headers["Access-Control-Allow-Credentials"] = "true";

            // Cookie 转发处理
            if (proxyRes.headers["set-cookie"]) {
              const cookies = Array.isArray(proxyRes.headers["set-cookie"])
                ? proxyRes.headers["set-cookie"]
                : [proxyRes.headers["set-cookie"]];

              proxyRes.headers["set-cookie"] = cookies.map((cookie) => {
                return cookie
                  .replace(/;\s*domain=[^;]+/gi, "")
                  .replace(/;\s*path=[^;]+/gi, "; path=/")
                  .replace(/;\s*SameSite=[^;]+/gi, "; SameSite=Lax");
              });
            }
          });
        },
      },
    },
  },
});
```

#### 1.2 代理作用

1. **解决 CORS 问题**：通过同源请求避免跨域限制
2. **Cookie 转发**：确保 `Set-Cookie` 响应头被正确转发和修改
3. **路径重写**：`/api/odoo/web/session/authenticate` → `http://localhost:8069/web/session/authenticate`

### 2. 代理应用逻辑

```typescript
// apps/odoo-web/src/lib/odoo/config.ts
export function applyDevProxy(config: Partial<OdooClientConfig>) {
  if (!IS_DEV) {
    return config;
  }

  const baseUrl = config.baseUrl || "";
  const port = config.port || 8069;

  const isLocalOdoo =
    (baseUrl === "http://localhost" ||
      baseUrl === "http://127.0.0.1" ||
      baseUrl === "localhost" ||
      baseUrl === "127.0.0.1" ||
      baseUrl === "") &&
    port === 8069;

  if (isLocalOdoo) {
    return {
      ...config,
      baseUrl: "/api/odoo", // 使用代理路径
      port: undefined, // 不设置端口
    };
  }

  return config;
}
```

---

## 错误处理与重连机制

### 1. 认证错误处理

#### 1.1 错误类型

```typescript
// apps/odoo-web/src/lib/odoo/errors.ts
export class OdooAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OdooAuthenticationError";
  }
}
```

#### 1.2 错误检测

```typescript
// apps/odoo-web/src/lib/odoo/client.ts
handleError(error: any) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 检测认证错误
    if (
      message.includes('session expired') ||
      message.includes('authentication failed') ||
      message.includes('unauthorized')
    ) {
      throw new OdooAuthenticationError(error.message);
    }
  }

  throw error;
}
```

#### 1.3 错误处理流程

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
useEffect(() => {
  if (error instanceof OdooAuthenticationError) {
    // 1. 清除会话
    clearSession();

    // 2. 延迟后重新连接
    setTimeout(() => {
      if (client) {
        connect();
      }
    }, 1500);
  }
}, [error, client, connect]);
```

### 2. 查询错误处理

#### 2.1 TanStack Query 重试策略

```typescript
// apps/odoo-web/src/hooks/use-odoo-query.ts
return useQuery({
  retry: (failureCount, error) => {
    // 认证错误不重试，由组件处理
    if (error instanceof OdooAuthenticationError) {
      return false;
    }
    // 其他错误重试最多 3 次
    return failureCount < 3;
  },
});
```

#### 2.2 查询失败后的处理

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
const { data, error, refetch } = useOdooQuery("ir.model", [], ["name", "model"]);

useEffect(() => {
  if (error instanceof OdooAuthenticationError) {
    // 认证错误，清除会话并重新连接
    clearSession();
    setTimeout(() => {
      connect();
    }, 1500);
  }
}, [error]);

// 连接成功后重新查询
useEffect(() => {
  if (session && !isReconnecting) {
    setTimeout(() => {
      refetch();
    }, 500);
  }
}, [session, isReconnecting, refetch]);
```

### 3. 重连机制

#### 3.1 自动重连条件

```typescript
// apps/odoo-web/src/routes/_authenticated/odoo/models.tsx
const needsReconnect = !!(storeClient && storeSession === null);
const autoConnect = useMemo(() => {
  return (
    hydrated &&
    !needsInit &&
    !needsInitWithSession &&
    (needsReconnect || !session) &&
    !!stableRestoredConfig
  );
}, [
  hydrated,
  needsInit,
  needsInitWithSession,
  needsReconnect,
  session,
  stableRestoredConfig,
]);
```

#### 3.2 重连流程

```
检测到认证错误
    │
    ▼
清除会话 (clearSession)
    │
    ▼
等待 1.5 秒
    │
    ▼
重新连接 (connect)
    │
    ▼
等待连接成功
    │
    ▼
重新查询 (refetch)
```

---

## 关键组件说明

### 1. useOdooClient Hook

**职责：**

- 管理 Odoo 客户端生命周期
- 处理客户端初始化
- 管理连接状态
- 提供连接方法

**关键逻辑：**

- 等待 Store Hydration 完成
- 防止重复初始化
- 自动连接管理

### 2. useOdooStore (Zustand)

**职责：**

- 全局状态管理
- 客户端和会话状态存储
- 状态持久化协调

**状态结构：**

```typescript
{
  client: OdooClient | null,
  session: OdooSessionInfo | null,
  hydrated: boolean,
}
```

### 3. OdooClient 封装类

**职责：**

- 封装底层客户端
- Session ID 同步
- 连接状态管理
- 查询方法封装

**关键方法：**

- `connect()`: 连接并提取 Session ID
- `searchRead()`: 查询模型数据
- `isConnected()`: 检查连接状态

### 4. OdooJSONRpcClient (底层客户端)

**职责：**

- HTTP 请求发送
- JSON-RPC 协议处理
- Cookie 管理
- 认证处理

**关键方法：**

- `connect()`: 认证并提取 Session ID
- `call_kw()`: 调用 Odoo 模型方法
- `searchRead()`: 搜索并读取记录

### 5. IndexedDB 存储服务

**职责：**

- 配置持久化
- Session 持久化
- 过期检查

**存储结构：**

- `odoo_connections`: 连接配置
- `odoo_sessions`: 会话信息

---

## 总结

### 核心流程

1. **初始化**：从持久化存储恢复配置和会话
2. **连接**：使用配置建立连接，提取 Session ID
3. **查询**：使用 Session ID 或 Cookie 查询模型数据
4. **错误处理**：检测认证错误，清除会话并重连

### 关键机制

1. **Session ID 提取**：从响应、Cookie、底层客户端多个来源提取
2. **Cookie 处理**：通过 Vite 代理转发和修改 Cookie
3. **状态持久化**：使用 IndexedDB 持久化配置和会话
4. **自动重连**：检测认证错误后自动清除会话并重连

### 最佳实践

1. **始终等待 Hydration 完成**：确保状态已恢复
2. **检查 Session 存在**：使用 Session 存在而非 `isConnected()` 判断
3. **处理认证错误**：检测到认证错误时清除会话并重连
4. **使用稳定配置**：使用 `useMemo` 稳定配置对象引用

---

## 附录

### A. 调试技巧

1. **查看控制台日志**：所有关键步骤都有详细日志
2. **检查 Network 标签**：查看请求和响应头
3. **检查 Application > Cookies**：确认 Cookie 是否被设置
4. **检查 IndexedDB**：使用浏览器开发者工具查看持久化数据

### B. 常见问题

1. **Session ID 无法提取**：检查 Cookie 是否被正确设置，查看代理配置
2. **认证错误循环**：检查 Session 是否被正确清除，查看重连逻辑
3. **查询失败**：检查 Session ID 是否存在，查看底层客户端状态

### C. 相关文件

- `apps/odoo-web/src/hooks/use-odoo-client.ts`: 客户端管理 Hook
- `apps/odoo-web/src/lib/odoo/client.ts`: Odoo 客户端封装
- `apps/odoo-web/src/stores/odoo-store.ts`: 状态管理 Store
- `apps/odoo-web/src/lib/odoo/db.ts`: 持久化存储服务
- `apps/odoo-web/vite.config.ts`: Vite 代理配置
- `libs/odoo-json-rpc/src/lib/client.ts`: 底层 JSON-RPC 客户端
