# Odoo 连接指南

## 服务器状态

根据 `docker/docker-compose.yml` 配置，Odoo 服务器运行在：

- **服务器地址**: `http://localhost`
- **端口**: `8069`
- **完整 URL**: `http://localhost:8069`

## 连接配置

### 默认连接信息

在 `apps/odoo-web` 应用中连接 Odoo 时，使用以下配置：

```typescript
{
  baseUrl: 'http://localhost',
  port: 8069,
  db: 'odoo19',  // 或您创建的数据库名称
  username: 'admin',
  password: 'admin'  // 或您设置的密码
}
```

### 首次连接步骤

1. **访问连接配置页面**
   - 启动应用后，访问 `/odoo/connection`
   - 或从侧边栏菜单：`Odoo` > `连接配置`

2. **填写连接信息**
   - 服务器地址: `http://localhost`
   - 端口: `8069`
   - 数据库名称: 首次使用需要先创建数据库
   - 用户名: `admin`（默认）
   - 密码: `admin`（默认，建议修改）

3. **创建数据库（如需要）**
   - 如果还没有创建数据库，访问 `http://localhost:8069`
   - Odoo 会显示数据库管理界面
   - 创建新数据库，设置管理员密码

4. **连接测试**
   - 填写完信息后，点击"连接"按钮
   - 连接成功后会自动跳转到模型浏览器页面

## 数据库创建

### 通过 Web 界面创建

1. 访问 `http://localhost:8069`
2. 如果看到数据库管理界面，填写：
   - 数据库名称（例如：`odoo19`）
   - 管理员邮箱
   - 管理员密码
   - 语言和国家
3. 点击"创建数据库"

### 通过命令行创建

```bash
# 进入 Odoo 容器
docker exec -it docker-web-1 bash

# 使用 Odoo 命令行创建数据库
odoo-bin -d odoo19 --stop-after-init --init=base
```

## 常见问题

### 1. 连接失败：Failed to fetch

**问题描述**：
浏览器控制台显示 "Failed to fetch" 错误，通常是网络请求失败。

**可能原因**：

1. **CORS 问题**（最常见）：浏览器阻止了跨域请求
2. **服务器未运行**：Odoo 服务器未启动或无法访问
3. **地址错误**：服务器地址或端口配置不正确
4. **网络问题**：防火墙或网络配置阻止了连接

**解决方案**：

#### 方案 1：使用 Vite 代理（推荐，开发环境）

Vite 已配置代理 `/api/odoo`，但 Odoo 客户端直接连接到服务器。需要修改配置使用代理：

1. 在连接配置页面，将服务器地址改为：
   - 服务器地址：`http://localhost`（或使用相对路径）
   - 端口：`5173`（Vite 开发服务器端口）
   - 或者使用代理路径：`/api/odoo`

2. 或者修改 Odoo 客户端配置，使其在开发环境自动使用代理。

#### 方案 2：确认 Odoo 服务器运行状态

```bash
# 检查容器状态
cd /home/arligle/odoo-erp/docker
docker-compose ps

# 查看 Odoo 日志
docker-compose logs web --tail 50

# 测试服务器是否可访问
curl http://localhost:8069

# 重启服务
docker-compose restart web
```

#### 方案 3：检查 CORS 配置

确认 Odoo 的 CORS 配置正确：

- 检查 `docker/config/odoo.conf` 中的 CORS 设置
- 确认 `odoo_cors_management` 模块已加载
- 查看 Odoo 日志确认 CORS 模块已启用

#### 方案 4：使用浏览器直接测试

在浏览器中访问 `http://localhost:8069`，确认：

- 能看到 Odoo 登录界面或数据库管理界面
- 没有网络错误

### 2. 认证失败：用户名或密码错误

**检查项**：

- 确认数据库已创建
- 确认用户名和密码正确
- 检查数据库是否已初始化

**解决方案**：

- 访问 `http://localhost:8069` 确认数据库存在
- 使用数据库管理界面重置密码
- 或创建新数据库

### 3. CORS 错误

**问题根源**：

- Odoo 默认 CORS 配置只允许：`Origin, X-Requested-With, Content-Type, Accept, Authorization`
- `odoo-json-rpc` 库使用 `X-Openerp-Session-Id` 请求头（大写 `X`）
- Odoo 配置中可能只有 `x-openerp-session-id`（小写 `x`）
- CORS 预检请求中头部名称大小写敏感，导致预检失败

**解决方案**：

#### 方案 1：使用 Vite 代理（开发环境，推荐）✅

**已自动启用**：在开发环境中，如果连接 `localhost:8069`，会自动使用 Vite 代理路径 `/api/odoo`。

**优势**：

- ✅ 无需修改 Odoo 服务器配置
- ✅ 自动处理 CORS 问题
- ✅ 支持 `X-Openerp-Session-Id` 请求头
- ✅ 自动提取和转发 Cookie

**验证**：

- 连接配置页面会显示提示："开发环境已自动启用 Vite 代理"
- 浏览器 Network 标签中，请求 URL 应为 `/api/odoo/...`

#### 方案 2：修复 Odoo 服务器 CORS 配置（生产环境）

如果直接连接 Odoo 服务器（不使用代理），需要修改 Odoo 配置：

**修改 `docker/config/odoo.conf`**：

```ini
[cors]
allowed_headers = Origin,Content-Type,Accept,Authorization,X-Requested-With,X-CSRF-Token,x-openerp-session-id,X-Openerp-Session-Id
```

**修改 `docker/docker-compose.yml`**：

```yaml
environment:
  - CORS_ALLOWED_HEADERS=Origin,Content-Type,Accept,Authorization,X-Requested-With,x-openerp-session-id,X-Openerp-Session-Id
```

**说明**：

- 必须同时包含 `x-openerp-session-id`（小写）和 `X-Openerp-Session-Id`（大写）
- 因为 CORS 预检请求中头部名称大小写敏感

**如果仍有问题**：

- 检查 `docker/config/odoo.conf` 中的 CORS 配置
- 确认 `server_wide_modules` 包含 `odoo_cors_management`
- 查看 Odoo 日志确认模块已加载
- 检查浏览器控制台的 Network 标签，查看预检请求（OPTIONS）的响应头

### 4. 数据库不存在

**解决方案**：

1. 访问 `http://localhost:8069`
2. 在数据库管理界面创建新数据库
3. 记录数据库名称，在连接配置中使用

## 测试连接

### 使用浏览器测试

1. 访问 `http://localhost:8069`
2. 应该看到 Odoo 登录界面或数据库管理界面
3. 如果能正常访问，说明服务器运行正常

### 使用应用测试

1. 启动 `apps/odoo-web` 应用
2. 访问 `/odoo/connection` 页面
3. 填写连接信息并点击"连接"
4. 查看连接状态和错误信息

## 开发环境配置

### 环境变量（可选）

可以在 `.env` 文件中设置默认连接信息：

```env
VITE_ODOO_BASE_URL=http://localhost
VITE_ODOO_PORT=8069
VITE_ODOO_DB=odoo19
VITE_ODOO_USERNAME=admin
VITE_ODOO_PASSWORD=admin
```

然后在代码中读取：

```typescript
const config = {
  baseUrl: import.meta.env.VITE_ODOO_BASE_URL || "http://localhost",
  port: parseInt(import.meta.env.VITE_ODOO_PORT || "8069"),
  db: import.meta.env.VITE_ODOO_DB || "odoo19",
  username: import.meta.env.VITE_ODOO_USERNAME || "admin",
  password: import.meta.env.VITE_ODOO_PASSWORD || "admin",
};
```

## 安全建议

1. **生产环境**：
   - 不要使用 `*` 作为 CORS 允许源
   - 使用强密码
   - 启用 HTTPS
   - 限制数据库访问

2. **开发环境**：
   - 使用默认配置即可
   - 注意不要将敏感信息提交到版本控制

## 相关文档

- [Phase 1 实施总结](./PHASE1_IMPLEMENTATION_SUMMARY.md)
- [React Frontend Refactoring Plan](./REACT_FRONTEND_REFACTORING_PLAN.md)
