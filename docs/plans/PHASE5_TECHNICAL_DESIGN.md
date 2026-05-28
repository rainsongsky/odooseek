# Phase 5 技术方案 — OdooFormRenderer 编辑模式

> **优先级**: P0 (表单当前为只读)  
> **前置**: Phase 2 (OdooFormRenderer), Phase 4 (看板 QWeb)  
> **状态**: 📋 待启动

---

## 一、现状分析

### 1.1 当前问题

`OdooFormRenderer` 目前所有字段以 `readOnly={true}` 渲染：

```tsx
// OdooFormRenderer.tsx:164
<Widget
  field={el}
  value={record?.[el.name]}
  onChange={() => {}}         // ← 空操作
  readOnly={readOnly}          // ← 始终 true
/>
```

### 1.2 好消息：Widget 已支持编辑

`field-widgets.tsx` 中所有 15 种 Widget 已实现 `onChange` + `readOnly` 属性，无需重写 Widget 层。只需：

1. **表单状态管理** — 用 `useState` 维护可编辑的字段值
2. **编辑/只读切换** — Edit 按钮 + 模式切换
3. **保存逻辑** — `callKw('write')` + 乐观更新
4. **缺失的编辑 Widget** — Date/Selection/Many2One 当前仅显示，需要可编辑 UI

| type | 当前 display | 编辑 UI |
|------|:---:|------|
| char | `<input>` ✅ | 已支持 |
| text | `<textarea>` ✅ | 已支持 |
| integer | `<input type="number">` ✅ | 已支持 |
| float/monetary | `<input type="number" step="0.01">` ✅ | 已支持 |
| boolean | `<input type="checkbox">` ✅ | 已支持 |
| **date/datetime** | `<span>` ❌ | `<input type="date">` / `<input type="datetime-local">` |
| **selection** | `<span>` ❌ | `<select>` |
| **many2one** | `<span>` ❌ | `<select>` / 搜索下拉（后续 Phase） |
| many2many | `<span>` ❌ | 复选框列表（后续 Phase） |
| one2many | `<span>` ❌ | 内联表格（后续 Phase） |
| binary | `<span>` ❌ | `<input type="file">`（后续 Phase） |
| html | `<textarea>` ✅ | 已支持 |

---

## 二、技术方案

### 2.1 表单状态管理

```typescript
// OdooFormRenderer 新增状态
const [editMode, setEditMode] = useState(false)
const [formValues, setFormValues] = useState<Record<string, unknown>>({})
const [saving, setSaving] = useState(false)

// 进入编辑模式：从 record 初始化
function handleEdit() {
  if (record?.[0]) {
    setFormValues({ ...record[0] })
    setEditMode(true)
  }
}

// 字段变更处理
function handleChange(name: string, value: unknown) {
  setFormValues(prev => ({ ...prev, [name]: value }))
}

// 保存
async function handleSave() {
  setSaving(true)
  await callKw(model, 'write', [[recordId], formValues])
  queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
  setEditMode(false)
  setSaving(false)
}

// 取消
function handleCancel() {
  setEditMode(false)
}
```

### 2.2 工具栏

```tsx
<div className="mb-4 flex items-center justify-between">
  <h3>{formLayout.string || model}</h3>
  <div className="flex gap-2">
    {editMode ? (
      <>
        <button onClick={handleCancel} className="btn-ghost">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </>
    ) : (
      <button onClick={handleEdit} className="btn-primary">Edit</button>
    )}
  </div>
</div>
```

### 2.3 Widget 集成

```tsx
// FormLayoutNode 中 field 渲染变更
case 'field': {
  const meta = fields[el.name]
  if (!meta) return null
  if (el.invisible && el.invisible >= 1) return null
  
  const Widget = getFieldWidget(el, meta.type)
  const readOnly = !editMode || el.readonly || meta.readonly
  
  return (
    <div key={i}>
      {!el.nolabel && (
        <label>{el.string || meta.string || el.name}</label>
      )}
      <Widget
        field={el}
        value={editMode ? formValues[el.name] : record?.[0]?.[el.name]}
        onChange={(v) => handleChange(el.name, v)}
        readOnly={readOnly}
      />
    </div>
  )
}
```

### 2.4 字段编辑 UI 扩展

| 类型 | 编辑组件 | 实现 |
|------|---------|------|
| **date** | `<input type="date">` | 互斥显示：`readOnly ? <span> : <input type="date" value={...}>` |
| **datetime** | `<input type="datetime-local">` | 同上 |
| **selection** | `<select>` | `readOnly ? <span> : <select>{options.map(...)}</select>` — options 来自 `fields[name].selection` |

### 2.5 安全规则

```
编辑模式下：
  只读字段 (readonly=True)    → 显示为不可编辑
  系统字段 (id, create_date)  → 不渲染
  required 字段               → 显示红色星号，保存前校验
```

---

## 三、任务分解

| # | 任务 | 说明 | 工时 |
|---|------|------|------|
| 5.1 | 表单状态 + Edit/Save/Cancel 工具栏 | `useState` formValues + `useMutation` write | 1d |
| 5.2 | DateWidget / DatetimeWidget / SelectionWidget 编辑 UI | `<input type="date">` + `<select>` | 0.5d |
| 5.3 | required 校验 + 视觉提示 | 必填星号 + 保存前校验 | 0.3d |
| 5.4 | 测试 | 编辑模式切换、保存、取消 | 0.3d |

**共 2.1 天**

后续 Phase:
- many2one 搜索下拉 (Phase 6)
- one2many / many2many 内联编辑 (Phase 7)

---

## 四、完成标准

```
[ ] Edit 按钮进入编辑模式，字段变为可编辑
[ ] Cancel 恢复原始值并退出编辑
[ ] Save → callKw('write', [[id], values]) → 刷新记录
[ ] date/datetime/selection 有编辑 UI
[ ] required 字段显示星号
[ ] readonly 字段在编辑模式仍不可编辑
[ ] 3 个新测试通过
[ ] 构建通过
```

---

**文档版本**: 1.0  
**创建日期**: 2026-05-28  
**维护团队**: OdooSeek
