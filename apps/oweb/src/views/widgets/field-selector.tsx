import { fieldsGet } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { FieldWidgetProps } from './index'

const TYPE_ICONS: Record<string, string> = {
  char: 'Aa',
  text: '¶',
  html: '<>',
  integer: '#',
  float: '#',
  monetary: '$',
  boolean: '☑',
  date: '📅',
  datetime: '🕐',
  selection: '☰',
  many2one: '→',
  many2many: '⇉',
  one2many: '⇶',
  binary: '📎',
}

export function FieldSelectorWidget({ value, onChange, readOnly, model }: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const selected: string[] = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : typeof value === 'string'
      ? [value]
      : []

  const { data: fieldData } = useQuery({
    queryKey: ['odoo', 'fields_get', model],
    queryFn: () =>
      fieldsGet<Record<string, { string: string; type: string }>>(
        model as string,
        [],
        ['string', 'type'],
      ),
    enabled: !!model,
    staleTime: 600_000,
  })

  const fields = useMemo(() => {
    if (!fieldData) return []
    return Object.entries(fieldData)
      .map(([name, f]) => ({ name, label: f.string || name, type: f.type }))
      .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
  }, [fieldData, search])

  const toggle = useCallback(
    (name: string) => {
      if (selected.includes(name)) {
        onChange(selected.filter((n) => n !== name))
      } else {
        onChange([...selected, name])
      }
    },
    [selected, onChange],
  )

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1">
        {selected.length === 0 && <span className="text-sm text-text-muted">—</span>}
        {selected.map((name) => (
          <span key={name} className="rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">
            {fieldData?.[name]?.string || name}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search fields..."
        className="rounded border border-border-default bg-transparent px-2 py-1 text-xs focus:border-accent focus:outline-none"
      />
      <div className="max-h-48 overflow-auto rounded border border-border-subtle bg-surface">
        {fields.map((f) => {
          const isSelected = selected.includes(f.name)
          return (
            <button
              key={f.name}
              type="button"
              onClick={() => toggle(f.name)}
              className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-hover/50 ${
                isSelected ? 'bg-accent/10' : ''
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded text-[10px] ${
                  isSelected ? 'bg-accent text-on-accent' : 'bg-elevated text-text-muted'
                }`}
              >
                {isSelected ? '✓' : (TYPE_ICONS[f.type] ?? '?')}
              </span>
              <span>{f.label}</span>
              <span className="ml-auto text-[10px] text-text-muted">{f.name}</span>
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div className="text-xs text-text-muted">{selected.length} field(s) selected</div>
      )}
    </div>
  )
}
