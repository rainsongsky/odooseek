import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { callKw, fieldsGet } from '../lib/api'
import type { FieldElement, O2mCommand, OdooFieldMeta, ViewField } from '../lib/odoo-types'

export interface FieldWidgetProps {
  field: FieldElement
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean
  meta?: { selection?: [string, string][]; type?: string; relation?: string }
}

function CharWidget({ field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={field.placeholder}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function TextWidget({ field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <textarea
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={field.placeholder}
      rows={3}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function IntegerWidget({ field: _field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="number"
      value={value != null ? Number(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      readOnly={readOnly}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function FloatWidget({ field: _field, value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="number"
      step="0.01"
      value={value != null ? Number(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      readOnly={readOnly}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none read-only:bg-transparent read-only:text-text-secondary"
    />
  )
}

function BooleanWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  return (
    <input
      type="checkbox"
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
      disabled={readOnly}
      className="h-4 w-4 cursor-pointer rounded accent-accent"
    />
  )
}

function DateWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  if (readOnly) {
    return (
      <span className="text-sm text-text-primary">{value ? String(value).slice(0, 10) : ''}</span>
    )
  }
  return (
    <input
      type="date"
      value={value ? String(value).slice(0, 10) : ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    />
  )
}

function DatetimeWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  if (readOnly) {
    return (
      <span className="text-sm text-text-primary">{value ? String(value).slice(0, 19) : ''}</span>
    )
  }
  const dt = value ? String(value).slice(0, 19) : ''
  // Convert "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
  const local = dt ? dt.replace(' ', 'T').slice(0, 16) : ''
  return (
    <input
      type="datetime-local"
      value={local}
      onChange={(e) => onChange(`${e.target.value.replace('T', ' ')}:00`)}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    />
  )
}

function SelectionWidget({ field: _field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  if (readOnly) {
    return <span className="text-sm text-text-primary">{value != null ? String(value) : ''}</span>
  }
  if (!meta?.selection?.length) {
    return <span className="text-sm text-text-primary">{value != null ? String(value) : ''}</span>
  }
  return (
    <select
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="">--</option>
      {meta.selection.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

function Many2OneWidget({ field: _field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Array<{ id: number; display_name: string }>>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
        const res = await callKw<Array<{ id: number; display_name: string }>>(
          relation,
          'web_name_search',
          [],
          { name: q, operator: 'ilike', limit: 8, specification: { display_name: {} } },
        )
        setResults(res ?? [])
      }, 200)
    },
    [meta?.relation],
  )

  if (readOnly) {
    return <span className="text-sm text-text-primary">{display || '—'}</span>
  }

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
        placeholder={_field.placeholder || 'Search...'}
        className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
      />
      {open && (results.length > 0 || search.trim()) && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border-subtle bg-surface shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => {
                onChange([r.id, r.display_name])
                setOpen(false)
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-hover/50"
            >
              {r.display_name}
            </button>
          ))}
          {search.trim() &&
            !results.some((r) => r.display_name.toLowerCase() === search.trim().toLowerCase()) && (
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

function BinaryWidget({ field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isImage =
    field.widget === 'image' ||
    (meta?.type === 'binary' &&
      (field.name?.includes('image') ||
        field.name?.includes('photo') ||
        field.name?.includes('avatar')))

  const filenameField = (field.options as Record<string, unknown>)?.filename as string | undefined
  const base64 = value as string | false | null | undefined
  const hasValue = base64 != null && base64 !== false && base64 !== ''

  if (readOnly) {
    if (isImage && hasValue) {
      return (
        <img
          src={`data:image/png;base64,${base64}`}
          alt={field.string || field.name}
          className="max-h-32 max-w-32 rounded border border-border-subtle object-contain"
        />
      )
    }
    if (hasValue) {
      return (
        <span className="text-sm text-text-primary">
          {filenameField ? `📎 ${filenameField}` : '📎 File attached'}
        </span>
      )
    }
    return <span className="text-sm text-text-muted">—</span>
  }

  return (
    <div className="flex flex-col gap-2">
      {isImage && hasValue && (
        <img
          src={`data:image/png;base64,${base64}`}
          alt={field.string || field.name}
          className="max-h-32 max-w-32 rounded border border-border-subtle object-contain"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              const b64 = dataUrl.split(',')[1]
              onChange(b64)
            }
            reader.readAsDataURL(file)
          }}
          className="text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-accent/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange(false)}
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-hover"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Many2ManyWidget({ field: _field, value, onChange, readOnly, meta }: FieldWidgetProps) {
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

export function PriorityWidget({ value, readOnly, onChange }: FieldWidgetProps) {
  const stars = Number(value) || 0
  const max = 3
  if (readOnly) {
    return (
      <span className="inline-flex gap-0.5 text-sm">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < stars ? 'text-amber-500' : 'text-border-default'}>
            ★
          </span>
        ))}
      </span>
    )
  }
  return (
    <div className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className={`text-sm ${i < stars ? 'text-amber-500' : 'text-border-default hover:text-amber-400'}`}
        >
          {i < stars ? '★' : '☆'}
        </button>
      ))}
      {stars > 0 && (
        <button type="button" onClick={() => onChange(0)} className="ml-1 text-xs text-text-muted">
          ✕
        </button>
      )}
    </div>
  )
}

function StateBadgeWidget({ value, meta }: FieldWidgetProps) {
  const val = String(value ?? '')
  if (!val) return <span className="text-sm text-text-muted">—</span>
  const selection = meta?.selection ?? []
  const pair = selection.find(([k]) => k === val)
  const label = pair?.[1] ?? val
  const colors: Record<string, string> = {
    draft: 'bg-border-default text-text-secondary',
    done: 'bg-emerald-500/10 text-emerald-500',
    cancel: 'bg-red-500/10 text-red-500',
    posted: 'bg-blue-500/10 text-blue-500',
    confirmed: 'bg-blue-500/10 text-blue-500',
    new: 'bg-border-default text-text-secondary',
    assigned: 'bg-amber-500/10 text-amber-500',
    won: 'bg-emerald-500/10 text-emerald-500',
    lost: 'bg-red-500/10 text-red-500',
  }
  const color =
    colors[val.toLowerCase()] ?? 'bg-surface text-text-primary border border-border-default'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

// ── One2ManyWidget ──────────────────────────────────────────────────

function One2ManyWidget({ field, value, onChange, readOnly, meta }: FieldWidgetProps) {
  const relation = meta?.relation
  const subViewList = field.subViews?.list
  const columnDefs = subViewList?.columns

  // Auto-discover fields when no sub-view is defined
  const { data: autoFields } = useQuery({
    queryKey: ['odoo', 'fields_get', relation],
    queryFn: () => fieldsGet<Record<string, OdooFieldMeta>>(relation!, [], ['string', 'type', 'relation', 'selection']),
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
      callKw<Array<Record<string, unknown>>>(relation!, 'read', [ids, fieldNames]),
    enabled: !!relation && ids.length > 0 && fieldNames.length > 0,
  })

  // Local ORM commands for pending changes
  const [pendingCommands, setPendingCommands] = useState<O2mCommand[]>([])

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
    const cmds = [...pendingCommands, [0, 0, defaults] as O2mCommand]
    emitChange(cmds)
  }, [relation, fieldNames, pendingCommands, emitChange])

  // Merge server records with pending commands
  const displayRecords = useMemo(() => {
    const base = (records ?? []).map((r) => ({ ...r }))
    for (const cmd of pendingCommands) {
      if (cmd[0] === 0 && cmd[2]) {
        base.push({ id: `new_${Date.now()}_${Math.random()}`, ...cmd[2] } as Record<string, unknown>)
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

  if (!relation) return <span className="text-sm text-text-muted">—</span>

  return (
    <div className="rounded-lg border border-border-subtle">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {!isLoading && displayRecords.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-text-muted">No records</div>
      )}

      {!isLoading && displayRecords.length > 0 && columns.length > 0 && (
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
              {!readOnly && subViewList?.delete !== false && (
                <th className="w-8 px-1 py-1.5" />
              )}
            </tr>
          </thead>
          <tbody>
            {displayRecords.map((record) => (
              <tr
                key={String(record.id)}
                className="border-b border-border-subtle last:border-b-0"
              >
                {columns.map((col, i) => (
                  <td
                    key={`o2m-d-${col.name}-${i}`}
                    className="whitespace-nowrap px-3 py-1.5 text-sm text-text-primary"
                  >
                    {renderO2mCell(record[col.name], autoFields?.[col.name])}
                  </td>
                ))}
                {!readOnly && subViewList?.delete !== false && (
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const rid = record.id as number
                        if (typeof rid === 'number') handleDelete(rid)
                      }}
                      className="text-xs text-text-muted hover:text-red-500"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

function normalizeO2mValue(value: unknown): number[] {
  if (!value) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (typeof value[0] === 'number') return value as number[]
  }
  return []
}

function renderO2mCell(value: unknown, meta?: OdooFieldMeta): string {
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

// ── Widget Registry ─────────────────────────────────────────────────

export const TYPE_WIDGETS: Record<string, React.ComponentType<FieldWidgetProps>> = {
  char: CharWidget,
  text: TextWidget,
  integer: IntegerWidget,
  float: FloatWidget,
  monetary: FloatWidget,
  boolean: BooleanWidget,
  date: DateWidget,
  datetime: DatetimeWidget,
  selection: SelectionWidget,
  priority: PriorityWidget,
  state: StateBadgeWidget,
  many2one: Many2OneWidget,
  many2many: Many2ManyWidget,
  one2many: One2ManyWidget,
  binary: BinaryWidget,
  image: BinaryWidget,
  html: TextWidget,
  reference: Many2OneWidget,
}

export function getFieldWidget(
  field: FieldElement,
  type: string,
): React.ComponentType<FieldWidgetProps> {
  // widget attribute from XML arch overrides type-based selection
  if (field.widget && WIDGET_OVERRIDES[field.widget]) {
    return WIDGET_OVERRIDES[field.widget]
  }
  if (field.widget && TYPE_WIDGETS[field.widget]) {
    return TYPE_WIDGETS[field.widget]
  }
  return TYPE_WIDGETS[type] ?? CharWidget
}

const WIDGET_OVERRIDES: Record<string, React.ComponentType<FieldWidgetProps>> = {
  priority: PriorityWidget,
  state: StateBadgeWidget,
  statusbar: StateBadgeWidget,
}
