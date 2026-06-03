import { callKw, parseDomainString } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { resolveOdooImageSrc } from '../../../lib/odoo-image'
import type { FieldWidgetProps } from '../index'

export function Many2OneWidget({
  field: _field,
  value,
  onChange,
  readOnly,
  meta,
}: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const closeDropdown = useCallback(() => {
    openRef.current = false
    setOpen(false)
  }, [])
  const [results, setResults] = useState<Array<{ id: number; display_name: string }>>([])
  const [focusIdx, setFocusIdx] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)
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
        if (!relation || !openRef.current) return
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
      closeDropdown()
    } else if (e.key === 'Escape') {
      closeDropdown()
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
          openRef.current = true
          setOpen(true)
          setSearch('')
          doSearch('')
        }}
        onBlur={() =>
          setTimeout(() => {
            openRef.current = false
            setOpen(false)
          }, 200)
        }
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
                closeDropdown()
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
                closeDropdown()
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
    const avatarSrc = resolveOdooImageSrc({
      raw: avatarData?.[0]?.avatar_128,
      model: relation,
      recordId: id ?? undefined,
      field: 'avatar_128',
    })
    return (
      <div className="flex items-center gap-2">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-6 w-6 rounded-full object-cover" />
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
