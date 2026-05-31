# OdooSeek 整体提升优化方案

> **版本**: 1.0  
> **日期**: 2026-06-01  
> **当前状态**: BFF 85% 端点覆盖, 前端 80% 功能覆盖, 16/17 BFF 优化完成

---

## 一、当前评估

| 维度 | 覆盖率 | 评级 | 关键差距 |
|------|:------:|:----:|------|
| BFF 端点 | 85% | A | 仅流式传输未实现 |
| 前端视图 | 100% | A | 7 种视图全覆盖 |
| 前端 Widget | 47% (41/87) | C | 46 个边缘字段类型缺失 |
| 国际化 | 30% | D | 仅 en/zh 硬编码 |
| 认证 | 80% | B | 缺 OAuth/SSO |
| 测试 | 442 用例 | C | BFF 缺 集成测试 |
| 文档 | 10 份 | A | 全面 |
| **综合** | **~80%** | **B+** | |

---

## 二、优化路线图

```
Phase A: 生产就绪 (P0) — 2 周
Phase B: 企业级功能 (P1) — 3 周
Phase C: 质量提升 (P2) — 2 周
Phase D: 体验增强 (P3) — 2 周
```

---

## Phase A — 生产就绪 (P0)

### A1. 国际化 (i18n) — 3 天

| 任务 | 文件 | 工作量 |
|------|------|:--:|
| 前端从 BFF 加载翻译 | `lib/i18n.tsx` | M |
| BFF 翻译代理缓存 | `proxy.rs` | S |
| 添加 fr/de/es 语言文件 | `lib/locales/` | S |
| 多语言登录页 | `routes/login.tsx` | S |
| 多语言 Navbar/ControlPanel | `components/` | M |

**技术方案**: `i18n.tsx` 在 `useAuth()` 获取 `session.user_context.lang` 后，调用 `GET /api/translations?lang=fr_FR&mods=web,sale,crm` 加载服务端翻译，与本地 locale 文件合并。

### A2. OAuth2/SSO 登录 — 2 天

| 任务 | 文件 | 工作量 |
|------|------|:--:|
| OAuth 回调路由 | `routes/auth/oauth-callback.tsx` | M |
| 登录页 OAuth 按钮 | `routes/login.tsx` | S |
| BFF OAuth 代理 | `main.rs` (proxied via generic HTTP) | S |
| Token 管理 | `lib/auth.tsx` | M |

**技术方案**: 前端向 `/api/odoo-http/auth_oauth/signin` 发起请求，BFF 代理到 Odoo。Odoo 完成 OAuth 后重定向到 `/auth/oauth/callback`。前端解析 URL hash 中的 `access_token`，调用 `POST /api/session/login` 完成登录。

### A3. Docker 部署验证 — 1 天

| 任务 | 工作量 |
|------|:--:|
| 验证 `docker-compose up` 完整链路 | S |
| 添加 `make dev` / `make prod` 快捷命令 | S |
| 健康检查脚本 | S |

### A4. 错误监控增强 — 1 天

| 任务 | 工作量 |
|------|:--:|
| 全局 `window.onerror` + `unhandledrejection` 监听 | S |
| 错误边界组件完善 | S |
| BFF 请求日志结构化 (tracing span) | S |

**Phase A 总计: 7 天**

---

## Phase B — 企业级功能 (P1)

### B1. 数据导入 (CSV Import) — 3 天

| 任务 | 文件 | 工作量 |
|------|------|:--:|
| 文件上传组件 | `components/FileUpload.tsx` | M |
| Import 预览 UI | `components/ImportPreview.tsx` | M |
| BFF 上传代理 | `proxy.rs` (via generic HTTP) | S |
| 导入进度跟踪 | `hooks/useImport.ts` | M |

**技术方案**: 文件上传通过 `POST /api/odoo-http/base_import/set_file` (multipart) 代理到 Odoo。预览和列映射通过 Odoo 的 `base_import.import` 模型 JSON-RPC 调用。最终导入调用 `execute_import`。

### B2. XLSX 导出 — 1.5 天

| 任务 | 文件 | 工作量 |
|------|------|:--:|
| 导出格式选择 UI | `components/ExportDialog.tsx` | M |
| BFF 导出代理 | 已通过 `GET /api/odoo-http/web/export/xlsx` | S |
| 列选择器 | `components/ExportColumnSelector.tsx` | M |

### B3. 更多 Widget — 3 天

优先补全高频使用的 Widget:

| Widget | 字段类型 | 工作量 |
|--------|----------|:--:|
| `signature` | 签名 | M |
| `gauge` | 仪表盘 | M |
| `domain` | 域选择器 | M |
| `properties` | 属性定义 | M |
| `kanban_activity` | 看板活动摘要 | S |
| `web_ribbon` | 角标 | S |
| `date_range_picker` | 日期范围 | M |

### B4. Context 链路完善 — 1 天

| 任务 | 工作量 |
|------|:--:|
| URL → OdooViewLoader → Form context 贯通 | M |
| `default_get` context 注入 | S |
| Search context 持久化 | S |

**Phase B 总计: 8.5 天**

---

## Phase C — 质量提升 (P2)

### C1. BFF 集成测试 — 3 天

| 任务 | 文件 | 工作量 |
|------|------|:--:|
| wiremock 模拟 Odoo 服务 | `tests/` | M |
| Session API 测试 | `tests/session_test.rs` | S |
| Proxy 测试 | `tests/proxy_test.rs` | M |
| Cache 测试 | `tests/cache_test.rs` | S |
| Report 测试 | `tests/report_test.rs` | S |

### C2. 前端关键视图测试 — 2 天

| 任务 | 工作量 |
|------|:--:|
| OdooViewLoader 测试 (require URL mock) | M |
| OdooListRenderer 测试扩展 | M |
| OdooFormRenderer 测试扩展 | S |

### C3. 性能优化 — 2 天

| 任务 | 工作量 |
|------|:--:|
| recharts 按需导入 (仅 Graph 视图) | M |
| react-big-calendar 按需导入 | S |
| TanStack Query 缓存策略审查 | S |
| Lighthouse 审计 | S |

**Phase C 总计: 7 天**

---

## Phase D — 体验增强 (P3)

### D1. 深色模式完善 — 1 天

| 任务 | 工作量 |
|------|:--:|
| 补充暗色主题变量 (所有组件) | M |
| 自动跟随系统主题 | S |

### D2. 快捷键系统 — 1 天

| 任务 | 工作量 |
|------|:--:|
| Ctrl+K 全局搜索 | M |
| Ctrl+S 保存 | S |
| Ctrl+Enter 提交 | S |

### D3. 动画/过渡 — 1 天

| 任务 | 工作量 |
|------|:--:|
| 页面切换过渡动画 | S |
| 表单提交反馈动画 | S |
| Toast 出入场动画 | S |

### D4. 移动端适配优化 — 1 天

| 任务 | 工作量 |
|------|:--:|
| 响应式表单布局 (mobile-first) | M |
| 触摸友好的按钮尺寸 | S |
| Kanban 横向滑动指示 | S |

**Phase D 总计: 4 天**

---

## 三、优先级矩阵

```
                    高影响
                      │
        A1 (i18n)     │  A2 (OAuth)   B1 (Import)
        A3 (Docker)   │  A4 (Error)   B2 (XLSX)
                      │  B3 (Widget)  B4 (Context)
        C3 (Perf)     │  C1 (Test)    C2 (Test)
        D2 (Shortcut) │  D1 (Dark)    D3 (Anim)
                      │  D4 (Mobile)
                      │
        低影响 ────────────────────── 高影响
                      │
                      │
                      │
                    低投入
```

**推荐执行顺序**: Phase A → Phase B1/B2 → Phase C1/C3 → Phase D

---

## 四、里程碑

| Phase | 目标 | 预期完成 | 交付物 |
|-------|------|----------|--------|
| A | 生产可用 | 第 1-2 周 | 多语言支持 + OAuth 登录 + Docker 一键部署 |
| B | 企业就绪 | 第 3-5 周 | CSV 导入 + XLSX 导出 + Widget 补全 |
| C | 质量达标 | 第 6-7 周 | BFF 测试 60%+ + 前端测试 500+ |
| D | 体验优秀 | 第 8-9 周 | 暗色模式 + 快捷键 + 动画 |

---

## 五、资源估算

| 阶段 | 工作量 | 人数 | 工期 |
|------|:------:|:---:|:---:|
| Phase A | 7 天 | 1 | 2 周 |
| Phase B | 8.5 天 | 1 | 3 周 |
| Phase C | 7 天 | 1 | 2 周 |
| Phase D | 4 天 | 1 | 2 周 |
| **总计** | **26.5 天** | 1 | **9 周** |

---

**文档版本**: 1.0  
**创建日期**: 2026-06-01  
**维护团队**: OdooSeek
