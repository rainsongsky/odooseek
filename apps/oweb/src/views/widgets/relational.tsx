import type { FieldElement, O2mCommand, OdooFieldMeta, ViewField } from '@odooseek/odoo-client'
import { callKw, evalCondition, fieldsGet, parseDomainString } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { FieldWidgetProps } from './index'
import { getFieldWidget, NOOP } from './index'

function normalizeM2mValue(value: unknown): [number, string][] {
  if (!value) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (Array.isArray(value[0])) return value as [number, string][]
    const pairs: [number, string][] = []
    for (let i = 0; i < value.length - 1; i += 2) {
      if (typeof value[i] === 'number') {
        pairs.push([value[i] as number, String(value[i + 1] ?? '')])
      }
    }
    return pairs
  }
  return []
}

function encodeM2mValue(tags: [number, string][]): unknown {
  return [[6, 0, tags.map(([id]) => id)]]
}

function normalizeO2mValue(value: unknown): number[] {
  if (!value) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (typeof value[0] === 'number') return value as number[]
  }
  return []
}

function renderO2mCellText(value: unknown, meta?: OdooFieldMeta): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') {
    if (meta?.type === 'monetary') return value.toFixed(2)
    return String(value)
  }
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? String(value[1]) : `#${value[0]}`
  }
  return JSON.stringify(value)
}

/** Render a cell using the appropriate widget for rich display. */
function O2mCellDisplay({
  col,
  value,
  meta,
  record,
  relation,
}: {
  col: ViewField
  value: unknown
  meta?: OdooFieldMeta
  record: Record<string, unknown>
  relation: string
}) {
  const fieldType = meta?.type ?? 'char'
  const Widget = getFieldWidget(col as FieldElement, fieldType)

  // Simple text fallback for basic types that don't need interactive widgets
  if (
    !col.widget &&
    ['char', 'text', 'integer', 'float', 'monetary', 'date', 'datetime', 'html'].includes(fieldType)
  ) {
    const text = renderO2mCellText(value, meta)
    // Detect color hex values (field name contains 'color' or value is #RRGGBB)
    if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-text-primary">
          <span
            className="inline-block h-3 w-3 rounded-sm border border-border-default"
            style={{ backgroundColor: value }}
          />
          {text}
        </span>
      )
    }
    return <span className="text-sm text-text-primary">{text}</span>
  }

  return (
    <Widget
      field={col as FieldElement}
      value={value}
      onChange={NOOP}
      readOnly
      meta={{
        selection: meta?.selection as [string, string][] | undefined,
        type: meta?.type,
        relation: meta?.relation,
      }}
      record={record}
      model={relation}
      recordId={record.id as number}
    />
  )
}

/** Editable inline cell for o2m rows. */
function O2mCellEdit({
  col,
  value,
  onChange,
  meta,
  record,
  relation,
}: {
  col: ViewField
  value: unknown
  onChange: (val: unknown) => void
  meta?: OdooFieldMeta
  record: Record<string, unknown>
  relation: string
}) {
  const fieldType = meta?.type ?? 'char'
  const Widget = getFieldWidget(col as FieldElement, fieldType)

  return (
    <Widget
      field={col as FieldElement}
      value={value}
      onChange={onChange}
      readOnly={false}
      meta={{
        selection: meta?.selection as [string, string][] | undefined,
        type: meta?.type,
        relation: meta?.relation,
      }}
      record={record}
      model={relation}
    />
  )
}

export function Many2OneWidget({
  field: _field,
  value,
  onChange,
  readOnly,
  meta,
}: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Array<{ id: number; display_name: string }>>([])
  const [focusIdx, setFocusIdx] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)
  const opts = (_field.options as Record<string, unknown>) ?? {}
  const noCreate = opts.no_create === true || opts.no_create === '1'
  const noOpen = opts.no_open === true || opts.no_open === '1'

  const display =
    Array.isArray(value) && value.length === 2 ? `${value[1] ?? ''}` : value ? `#${value}` : ''

  const doSearch = useCallback(
    (q: string) => {
      if (!meta?.relation || q.length < 1) {
        setResults([])
        return
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const relation = meta?.relation
        if (!relation) return
        const domain = parseDomainString(typeof meta.domain === 'string' ? meta.domain : null)
        const baseDomain = domain && domain.length > 0 ? domain : []
        const res = await callKw<{ records: Array<{ id: number; display_name: string }> }>(
          relation,
          'web_search_read',
          [],
          {
            domain: [...baseDomain, ['display_name', 'ilike', q]],
            specification: { display_name: {} },
            limit: 8,
          },
        )
        setResults(res?.records ?? [])
        setFocusIdx(-1)
      }, 200)
    },
    [meta?.relation, meta?.domain],
  )

  if (readOnly) {
    if (display && !noOpen) {
      return <span className="text-sm text-accent cursor-pointer">{display}</span>
    }
    return <span className="text-sm text-text-primary">{display || '—'}</span>
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < results.length) {
      e.preventDefault()
      const r = results[focusIdx]
      onChange([r.id, r.display_name])
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const canCreate =
    !noCreate &&
    search.trim() &&
    !results.some((r) => r.display_name.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? search : display}
        onChange={(e) => {
          setSearch(e.target.value)
          doSearch(e.target.value)
        }}
        onFocus={() => {
          setOpen(true)
          setSearch('')
          doSearch('')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={_field.placeholder || 'Search...'}
        className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none placeholder:text-text-muted"
      />
      {open && (results.length > 0 || canCreate) && (
        <div
          ref={listRef}
          className="absolute z-10 mt-1 w-full rounded-lg border border-border-subtle bg-surface shadow-lg"
        >
          {results.map((r, ri) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => {
                onChange([r.id, r.display_name])
                setOpen(false)
              }}
              className={`w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-hover/50 ${
                ri === focusIdx ? 'bg-hover/50' : ''
              }`}
            >
              {r.display_name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={async () => {
                if (!meta?.relation) return
                const newId = await callKw<number>(meta.relation, 'create', [
                  { name: search.trim() },
                ])
                onChange([newId, search.trim()])
                setOpen(false)
              }}
              className="w-full border-t border-border-subtle px-3 py-1.5 text-left text-sm text-accent hover:bg-accent/10"
            >
              Create "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Many2ManyWidget({
  field: _field,
  value,
  onChange,
  readOnly,
  meta,
}: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Array<[number, string]>>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tags = normalizeM2mValue(value)

  const doSearch = useCallback(
    (q: string) => {
      if (!meta?.relation || q.length < 1) {
        setResults([])
        return
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const relation = meta?.relation
        if (!relation) return
        const res = await callKw<Array<{ id: number; display_name: string }>>(
          relation,
          'web_name_search',
          [],
          { name: q, operator: 'ilike', limit: 8, specification: { display_name: {} } },
        )
        setResults((res ?? []).map((r) => [r.id, r.display_name] as [number, string]))
      }, 200)
    },
    [meta?.relation],
  )

  if (readOnly) {
    if (tags.length === 0) return <span className="text-sm text-text-muted">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map(([id, name]) => (
          <span
            key={id}
            className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
          >
            {name || `#${id}`}
          </span>
        ))}
      </div>
    )
  }

  const addTag = (id: number, name: string) => {
    if (tags.some(([tid]) => tid === id)) return
    const newTags = [...tags, [id, name] as [number, string]]
    onChange(encodeM2mValue(newTags))
    setSearch('')
    setOpen(false)
  }

  const removeTag = (id: number) => {
    const newTags = tags.filter(([tid]) => tid !== id)
    onChange(encodeM2mValue(newTags))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map(([id, name]) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
          >
            {name || `#${id}`}
            <button
              type="button"
              onClick={() => removeTag(id)}
              className="ml-0.5 text-accent/60 hover:text-accent"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            doSearch(e.target.value)
          }}
          onFocus={() => {
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Add a tag..."
          className="w-full rounded-lg border border-border-default bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
        />
        {open && results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border-subtle bg-surface shadow-lg">
            {results.map(([id, name]) => (
              <button
                key={id}
                type="button"
                onMouseDown={() => addTag(id, name)}
                className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-hover/50"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── One2ManyWidget ──────────────────────────────────────────────────

export function One2ManyWidget({ field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  const relation = meta?.relation
  const subViewList = field.subViews?.list
  const columnDefs = subViewList?.columns
  const editable = !readOnly && subViewList?.editable
  const decorations = subViewList?.decorations ?? {}

  // Auto-discover fields when no sub-view is defined
  const { data: autoFields } = useQuery({
    queryKey: ['odoo', 'fields_get', relation],
    queryFn: () =>
      fieldsGet<Record<string, OdooFieldMeta>>(
        relation as string,
        [],
        ['string', 'type', 'relation', 'selection'],
      ),
    enabled: !!relation && !columnDefs,
  })

  const columns = useMemo<ViewField[]>(() => {
    if (columnDefs) return columnDefs
    if (!autoFields) return []
    return Object.entries(autoFields)
      .filter(([name]) => !['id', 'display_name', 'create_date', 'write_date'].includes(name))
      .slice(0, 6)
      .map(([name, f]) => ({ name, string: f.string, widget: f.widget }))
  }, [columnDefs, autoFields])

  const fieldNames = useMemo(() => columns.map((c) => c.name), [columns])

  // Resolve record IDs to full data
  const ids = normalizeO2mValue(value)
  const { data: records, isLoading } = useQuery({
    queryKey: ['odoo', 'read', relation, ids, fieldNames],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(relation as string, 'read', [ids, fieldNames]),
    enabled: !!relation && ids.length > 0 && fieldNames.length > 0,
  })

  // Local ORM commands for pending changes
  const [pendingCommands, setPendingCommands] = useState<O2mCommand[]>([])

  // Inline editing state: which record row is being edited
  const [editingId, setEditingId] = useState<unknown>(null)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({})
  const tempIdCounter = useRef(0)

  const emitChange = useCallback(
    (commands: O2mCommand[]) => {
      setPendingCommands(commands)
      if (commands.length > 0) {
        onChange(commands)
      } else {
        onChange(ids.length > 0 ? [[6, 0, ids]] : false)
      }
    },
    [onChange, ids],
  )

  const handleDelete = useCallback(
    (recordId: number) => {
      const cmds = [...pendingCommands, [2, recordId] as O2mCommand]
      emitChange(cmds)
    },
    [pendingCommands, emitChange],
  )

  const handleAddRow = useCallback(async () => {
    if (!relation) return
    const defaults = await callKw<Record<string, unknown>>(relation, 'default_get', [fieldNames])
    const tempId = -++tempIdCounter.current
    if (editable) {
      setEditValues(defaults)
      setEditingId(tempId)
    }
    const cmds = [...pendingCommands, [0, tempId, defaults] as O2mCommand]
    emitChange(cmds)
  }, [relation, fieldNames, pendingCommands, emitChange, editable])

  const handleCellChange = useCallback((_recordId: unknown, colName: string, val: unknown) => {
    setEditValues((prev) => ({ ...prev, [colName]: val }))
  }, [])

  const handleSaveEdit = useCallback(
    (recordId: unknown) => {
      const isNew = typeof recordId === 'number' && recordId < 0
      if (isNew) {
        const cmds = pendingCommands.map((cmd) => {
          if (cmd[0] === 0 && cmd[1] === recordId)
            return [0, recordId, { ...cmd[2], ...editValues }] as O2mCommand
          return cmd
        })
        emitChange(cmds)
      } else {
        const hasUpdate = pendingCommands.some((c) => c[0] === 1 && c[1] === recordId)
        let cmds: O2mCommand[]
        if (hasUpdate) {
          cmds = pendingCommands.map((cmd) => {
            if (cmd[0] === 1 && cmd[1] === recordId)
              return [1, recordId, { ...(cmd[2] ?? {}), ...editValues }] as O2mCommand
            return cmd
          })
        } else {
          cmds = [...pendingCommands, [1, recordId, editValues] as O2mCommand]
        }
        emitChange(cmds)
      }
      setEditingId(null)
      setEditValues({})
    },
    [pendingCommands, editValues, emitChange],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValues({})
  }, [])

  const handleStartEdit = useCallback(
    (record: Record<string, unknown>) => {
      const rid = record.id
      setEditingId(rid)
      const initialValues: Record<string, unknown> = {}
      for (const col of columns) {
        initialValues[col.name] = record[col.name]
      }
      setEditValues(initialValues)
    },
    [columns],
  )

  // Merge server records with pending commands
  const displayRecords = useMemo(() => {
    const base = (records ?? []).map((r) => ({ ...r }))
    for (const cmd of pendingCommands) {
      if (cmd[0] === 0 && cmd[2]) {
        base.push({ id: cmd[1], ...cmd[2] } as Record<string, unknown>)
      } else if (cmd[0] === 2) {
        const delIdx = base.findIndex((r) => r.id === cmd[1])
        if (delIdx >= 0) base.splice(delIdx, 1)
      } else if (cmd[0] === 1 && cmd[2]) {
        const upd = base.find((r) => r.id === cmd[1])
        if (upd) Object.assign(upd, cmd[2])
      }
    }
    return base
  }, [records, pendingCommands])

  // Compute decoration class for a row
  const getRowClass = useCallback(
    (record: Record<string, unknown>) => {
      if (!decorations || Object.keys(decorations).length === 0) return ''
      let cls = ''
      for (const [expr, className] of Object.entries(decorations)) {
        if (evalCondition(expr, record)) cls += ` ${className}`
      }
      return cls.trim()
    },
    [decorations],
  )

  if (!relation) return <span className="text-sm text-text-muted">—</span>

  return (
    <div className="rounded-lg border border-border-subtle">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {!isLoading && displayRecords.length === 0 && !editable && (
        <div className="px-4 py-6 text-center text-sm text-text-muted">No records</div>
      )}

      {(!isLoading && displayRecords.length > 0 && columns.length > 0) || editable ? (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-surface/50">
              {columns.map((col, i) => {
                const colMeta = autoFields?.[col.name]
                return (
                  <th
                    key={`o2m-h-${col.name}-${i}`}
                    className="whitespace-nowrap px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                  >
                    {col.string || colMeta?.string || col.name}
                  </th>
                )
              })}
              {(!readOnly || editable) && subViewList?.delete !== false && (
                <th className="w-8 px-1 py-1.5" />
              )}
            </tr>
          </thead>
          <tbody>
            {displayRecords.map((record) => {
              const rowId = record.id
              const isEditing = editingId === rowId
              const decoClass = getRowClass(record)

              return (
                <tr
                  key={String(rowId)}
                  className={`border-b border-border-subtle last:border-b-0 ${isEditing ? 'bg-accent/5' : ''} ${decoClass}`}
                  onDoubleClick={() => editable && !isEditing && handleStartEdit(record)}
                >
                  {columns.map((col, i) => {
                    const colMeta = autoFields?.[col.name]
                    const cellValue = isEditing ? editValues[col.name] : record[col.name]

                    return (
                      <td
                        key={`o2m-d-${col.name}-${i}`}
                        className="whitespace-nowrap px-1 py-1 text-sm text-text-primary"
                      >
                        {isEditing ? (
                          <O2mCellEdit
                            col={col}
                            value={cellValue}
                            onChange={(val) => handleCellChange(rowId, col.name, val)}
                            meta={colMeta}
                            record={isEditing ? editValues : record}
                            relation={relation}
                          />
                        ) : (
                          <O2mCellDisplay
                            col={col}
                            value={cellValue}
                            meta={colMeta}
                            record={record}
                            relation={relation}
                          />
                        )}
                      </td>
                    )
                  })}
                  {(!readOnly || editable) && subViewList?.delete !== false && (
                    <td className="px-1 py-1.5 text-center">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(rowId)}
                            className="text-xs text-accent hover:text-accent/80"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-xs text-text-muted hover:text-danger"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const rid = rowId as number
                            if (typeof rid === 'number' && rid < 0) {
                              const cmds = pendingCommands.filter(
                                (cmd) => !(cmd[0] === 0 && cmd[1] === rid),
                              )
                              emitChange(cmds)
                            } else if (typeof rid === 'number') {
                              handleDelete(rid)
                            }
                          }}
                          className="text-xs text-text-muted hover:text-danger"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}

      {!readOnly && subViewList?.create !== false && (
        <div className="border-t border-border-subtle px-3 py-1.5">
          <button
            type="button"
            onClick={handleAddRow}
            className="text-xs font-medium text-accent hover:text-accent/80"
          >
            Add a row
          </button>
        </div>
      )}
    </div>
  )
}

// ── Many2OneAvatarWidget ─────────────────────────────────────────────

export function Many2OneAvatarWidget({
  value,
  readOnly,
  onChange,
  meta,
  field,
  ...props
}: FieldWidgetProps) {
  const arrValue = Array.isArray(value) ? value : value ? [value, String(value)] : [null, '']
  const [id, name] = arrValue as [number | null, string]
  const relation = meta?.relation

  const { data: avatarData } = useQuery({
    queryKey: ['odoo', 'avatar', relation, id],
    queryFn: () =>
      callKw<Array<{ avatar_128: string }>>(relation as string, 'read', [[id], ['avatar_128']]),
    enabled: readOnly && !!relation && !!id,
    staleTime: 60_000,
  })

  if (readOnly) {
    const avatar = avatarData?.[0]?.avatar_128
    return (
      <div className="flex items-center gap-2">
        {avatar ? (
          <img
            src={`data:image/png;base64,${avatar}`}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
            {(name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm text-text-primary">{name || (id ? `#${id}` : '')}</span>
      </div>
    )
  }

  return (
    <Many2OneWidget
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      meta={meta}
      field={field}
      {...props}
    />
  )
}

// ── Attachment Image Widget ────────────────────────────────────────

export function AttachmentImageWidget({ value, readOnly, meta }: FieldWidgetProps) {
  if (readOnly) {
    if (!value) return <span className="text-sm text-text-muted">—</span>
    if (Array.isArray(value) && value.length >= 1) {
      const name = value.length >= 2 ? String(value[1]) : ''
      return (
        <img
          src={`/api/web/image/${value[0]}`}
          alt={name}
          className="max-h-32 max-w-32 rounded border border-border-subtle object-contain"
        />
      )
    }
    return <span className="text-sm text-text-primary">{String(value)}</span>
  }
  return (
    <Many2OneWidget
      value={value}
      onChange={NOOP}
      readOnly={false}
      field={{ type: 'field', name: 'attachment_id' }}
      meta={meta}
    />
  )
}

// ── Many2Many Checkboxes Widget (Phase 24) ──────────────────────────

export function Many2ManyCheckboxesWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const relation = meta?.relation
  const tags = normalizeM2mValue(value)
  const selectedIds = useMemo(() => new Set(tags.map(([id]) => id)), [tags])

  const { data: options } = useQuery({
    queryKey: ['odoo', 'name_search', relation],
    queryFn: async () => {
      const res = await callKw<Array<{ id: number; display_name: string }>>(
        relation as string,
        'web_name_search',
        [],
        { name: '', limit: 100, specification: { display_name: {} } },
      )
      return Array.isArray(res) ? res : []
    },
    enabled: !!relation,
  })

  const toggle = (id: number, name: string) => {
    const newTags = selectedIds.has(id)
      ? tags.filter(([tid]) => tid !== id)
      : [...tags, [id, name] as [number, string]]
    onChange(encodeM2mValue(newTags))
  }

  return (
    <div className="flex flex-col gap-1">
      {options?.map?.((opt: { id: number; display_name: string }) => (
        <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.has(opt.id)}
            onChange={() => toggle(opt.id, opt.display_name)}
            disabled={readOnly}
            className="accent-accent"
          />
          {opt.display_name}
        </label>
      ))}
    </div>
  )
}

// ── Many2Many Tags Avatar Widget (Phase 24) ────────────────────────

export function Many2ManyTagsAvatarWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const relation = meta?.relation
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<[number, string]>>([])
  const tags = normalizeM2mValue(value)

  const doSearch = useCallback(
    async (q: string) => {
      if (!relation || !q.trim()) {
        setSearchResults([])
        return
      }
      const res = await callKw<Array<{ id: number; display_name: string }>>(
        relation,
        'web_name_search',
        [],
        { name: q, operator: 'ilike', limit: 10, specification: { display_name: {} } },
      )
      const records = Array.isArray(res) ? res : []
      setSearchResults(
        records.map(
          (r: { id: number; display_name: string }) => [r.id, r.display_name] as [number, string],
        ),
      )
    },
    [relation],
  )

  const removeTag = (id: number) => {
    const newTags = tags.filter(([tid]) => tid !== id)
    onChange(encodeM2mValue(newTags))
  }

  const addTag = (id: number, name: string) => {
    if (tags.some(([tid]) => tid === id)) return
    const newTags = [...tags, [id, name] as [number, string]]
    onChange(encodeM2mValue(newTags))
    setSearch('')
    setSearchResults([])
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {tags.map(([id, name]) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 pl-0.5 pr-2 py-0.5 text-xs"
          >
            <img
              src={`/api/web/image/${relation}/${id}/avatar_128`}
              alt=""
              className="h-4 w-4 rounded-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <span className="text-accent">{name || `#${id}`}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeTag(id)}
                className="ml-0.5 text-accent/60 hover:text-accent"
              >
                x
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              doSearch(e.target.value)
            }}
            placeholder="Search..."
            className="w-full rounded border border-border-default bg-root px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full rounded border border-border-subtle bg-surface shadow-lg">
              {searchResults.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => addTag(id, name)}
                  className="block w-full px-2 py-1 text-left text-xs text-text-primary hover:bg-hover"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
