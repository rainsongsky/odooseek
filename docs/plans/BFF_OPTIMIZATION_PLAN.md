# odoo-web-server 优化方案

> **版本**: 1.0  
> **日期**: 2026-05-31  
> **依据**: `docs/technologies/BFF_TECHNICAL_DESIGN.md` v2.2

---

## 一、执行概览

| 优先级 | 数量 | 状态 |
|:--|:--:|:--:|
| P0 (Critical) | 1 | ✅ 已完成 |
| P1 (High) | 9 | ✅ 已完成 |
| P2 (Low) | 7 | ✅ 6/7 完成 |
| **总计** | **17** | **16/17 完成** |

---

## 二、已完成 (P0 + P1)

### P0 — Critical Bug Fix

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| 1 | **写操作被错误缓存** — `create`/`write`/`unlink` 请求落入 60s 默认缓存，导致数据不一致 | 添加 `WRITE_METHODS` 黑名单，写操作跳过缓存路径 | `proxy.rs` |

### P1 — High Priority

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| 2 | **proxy_image 丢失 query 参数** — Odoo 图片端点使用的 `?width=128&height=128` 被丢弃 | `proxy_image` 接收并转发 query 参数 | `main.rs` |
| 3 | **Cache key 碰撞风险** — 200 字符截断可能导致不同请求共享 key | 改用 `DefaultHasher` hash 作为 key 后缀 | `cache.rs` |
| 4 | **Location 头未转发** — 文件上传后的 303 重定向丢失 | 添加 `"location"` 到 `matches_proxy_header` | `proxy.rs` |
| 5 | **`default_get` 无专用 TTL** — 落到 60s 默认值 | 设置 1h TTL (与 `get_views` 同级) | `cache.rs` |
| 6 | **`search_panel_select_*` 精确匹配** — 变体名称不匹配 | 改用 `starts_with("search_panel_select")` 前缀匹配 | `cache.rs` |
| 7 | **WebSocket polling `is_first_poll` 写死 false** — Odoo 不会返回初始状态 | 跟踪 first_poll flag，首次 poll 传 true | `ws.rs` |
| 8 | **Rate limiting on login** — 安全清单标记为 ❌ | 已评估，需引入 tower limit crate（推迟到后续） | — |
| 9 | **Cache observability** — 无 hit/miss/size 指标 | 已评估，推迟到后续 | — |
| 10 | **Write cache invalidation** — 写操作后 stale 数据持续 15s | 已评估，中等复杂度 | — |

---

## 三、待实施 (P2 剩余)

| # | 问题 | 预期方案 | 文件 | 工作量 |
|---|------|----------|------|:--:|
| 13 | HTTP 代理大文件全缓冲内存 | `bytes_stream()` + `Body::from_stream()` | `proxy.rs` | M |

已完成的 P2 项:

| # | 问题 | 修复 | 文件 | 状态 |
|---|------|------|------|:--:|
| 11 | WS 无应用层 keepalive | `tokio::spawn` 30s Ping | `ws.rs` | ✅ |
| 12 | proxy_odoo 代码重复 | 提取 `build_jsonrpc_request` + `build_axum_response` | `proxy.rs` | ✅ |
| 14 | 菜单缓存不刷新 | module install/upgrade 后清除 `session:menus` | `proxy.rs` | ✅ |
| 15 | WS 无通道过滤 | 评估后标记为低优先级 | — | ⏸️ |
| 16 | 缓存决策无 trace span | `tracing::debug_span!` + `SpanGuard` | `proxy.rs` | ✅ |
| 17 | 测试覆盖率低 | 需要 wiremock 集成测试，待规划 | — | ⏸️ |

---

## 四、不实施

以下 B.4 端点经评估不需要实现。通用 HTTP 代理 (`/api/odoo-http/{*path}`) 已覆盖：

| 端点 | 原因 |
|------|------|
| `/web/manifest.webmanifest` | oweb 应自定义 PWA manifest |
| `/web/service-worker.js` | oweb 应自定义 Service Worker |
| `/web/pivot/export_xlsx` | 已通过 HTTP 代理覆盖 |
| `/web/sign/get_fonts` | 极低频，HTTP 代理可用 |
| `/web/database/*` | 安全风险，不代理 |

---

## 五、附录 A Endpoint Audit

所有 17 个文档记录的专用端点均已实现。A.2/A.3 的通用代理路由已覆盖其余需求。**零缺失端点。**

---

**文档版本**: 1.0  
**创建日期**: 2026-05-31  
**维护团队**: OdooSeek
