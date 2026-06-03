import { useCallback, useRef, useState } from 'react'
import type { FieldWidgetProps } from './index'

export function FilterableSelectionWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const selection = meta?.selection ?? []
  const currentVal = String(value ?? '')

  const filtered = selection.filter(([, label]) =>
    label.toLowerCase().includes(search.toLowerCase()),
  )

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
    setFocusIdx(-1)
  }, [])

  if (readOnly) {
    const pair = selection.find(([k]) => k === currentVal)
    return (
      <span className="text-sm text-text-primary">
        {pair?.[1] ?? (value ? String(value) : '—')}
      </span>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < filtered.length) {
      e.preventDefault()
      onChange(filtered[focusIdx][0])
      close()
    } else if (e.key === 'Escape') {
      close()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? search : (selection.find(([k]) => k === currentVal)?.[1] ?? '')}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          setFocusIdx(-1)
        }}
        onFocus={() => {
          setOpen(true)
          setSearch('')
        }}
        onBlur={() => setTimeout(close, 200)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none placeholder:text-text-muted"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
          {filtered.map(([key, label], i) => (
            <button
              key={key}
              type="button"
              onMouseDown={() => {
                onChange(key)
                close()
              }}
              className={`w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-hover/50 ${
                i === focusIdx ? 'bg-hover/50' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
