# OdooSeek 业务逻辑对齐分析（续）

> **来源**: Odoo 19 CE 源码  
> **日期**: 2026-05-28

---

## 一、Action 系统缺口

### 1.1 当前状态

```typescript
// menu.tsx — 仅处理 ir.actions.act_window
if (ref?.type === 'ir.actions.act_window')
  callKw('ir.actions.act_window', 'read', [[id], ['res_model']])
// 其他动作类型直接跳过
```

### 1.2 Odoo 实际行为

6 种动作类型，每种有独立解析链：

```
ir.actions.act_window → _get_action_dict() → {type, views, res_model, domain, context}
ir.actions.server    → /web/action/run → safe_eval(Python code) → 子动作
ir.actions.client    → action_registry lookup → {type, tag, params}
ir.actions.act_url   → {type, url, target} → window.open/navigate
ir.actions.report    → {type, report_name, report_type} → PDF/HTML
ir.actions.act_window_close → {type} → 关闭对话框
```

**ir_actions.py 源码**:
- `ir.actions.server.run()` (line 1149): `_get_eval_context` → `_run` → `_get_runner` → `_run_action_code_multi` / `_run_action_multi`
- 6 种 state: code, object_write, object_create, object_copy, webhook, multi
- `/web/action/run` 端点调用 `run()` → 可能返回子动作 dict → 客户端递归 `doAction()`

### 1.3 缺失影响

- **CRM "My Pipeline"**: 是 `ir.actions.server` → 无法解析
- **菜单项**指向 `ir.actions.server` 的 → 点击无反应
- **按钮/向导**触发 server action → 无法执行

---

## 二、Many2one 搜索下拉缺口

### 2.1 当前状态

```typescript
function Many2OneWidget({ value }: FieldWidgetProps) {
  // 仅显示: [42, "Display Name"] 或 "—"
  return <span>{display}</span>
}
```

### 2.2 Odoo 实际行为

3 种 RPC 接口:

| 接口 | 用途 | 返回 |
|------|------|------|
| `web_name_search(name, domain, limit, specification)` | 自动补全下拉 | `[{id, display_name, __formatted_display_name}]` |
| `name_search(name, domain, limit)` | "更多"搜索 | `[[id, display_name], ...]` |
| `name_create(name)` | 快速创建 | `(id, display_name)` |

**OWL 组件**: `Many2XAutocomplete` (relational_utils.js:198-593)
- 阈值触发 (`searchThreshold` 默认 1)
- 防抖搜索 (`debounce` 默认 300ms)
- 缓存空结果
- "Create" / "Create and Edit" / "Search more" 操作

### 2.3 缺失影响

- 所有 many2one 字段无法搜索选择
- `partner_id` 必须手动输入 ID
- `stage_id` 只能通过拖拽看板修改

---

## 三、优化优先级

| 优先级 | 修复 | 工时 | 影响 |
|:---:|------|------|------|
| **P0** | Server Action 解析 | 0.5d | 菜单完整性 |
| **P0** | Many2one 搜索下拉 | 1d | 所有表单可用性 |
| P2 | ir.actions.client | 0.3d | 客户端动作 |
| P2 | ir.actions.report | 0.5d | 报表下载 |

---

**文档版本**: 1.0  
**来源**: `ir_actions.py`, `action_service.js`, `relational_utils.js`
