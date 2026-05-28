import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SearchFilter, SearchGroupBy, ViewField } from '../lib/odoo-types'

interface SearchBarProps {
  onSearch: (domain: unknown[]) => void
  onGroupByChange?: (groupBys: string[]) => void
  placeholder?: string
  searchFields?: ViewField[]
  filters?: SearchFilter[]
  groupByFilters?: SearchGroupBy[]
}

function combineDomains(domainGroups: unknown[][]): unknown[] {
  const nonEmpty = domainGroups.filter((g) => g.length > 0)
  if (nonEmpty.length === 0) return []
  if (nonEmpty.length === 1) return nonEmpty[0]

  const result: unknown[] = []
  for (let i = 0; i < nonEmpty.length - 1; i++) {
    result.push('&')
  }
  for (const g of nonEmpty) {
    for (const item of g) {
      result.push(item)
    }
  }
  return result
}

export function SearchBar({
  onSearch,
  onGroupByChange,
  placeholder = 'Search...',
  searchFields,
  filters = [],
  groupByFilters = [],
}: SearchBarProps) {
  const [keyword, setKeyword] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [activeGroupBys, setActiveGroupBys] = useState<string[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const advancedFields = searchFields?.length
    ? searchFields.map((f) => ({ name: f.name, label: f.string || f.name }))
    : [
        { name: 'name', label: 'Name' },
        { name: 'id', label: 'ID' },
        { name: 'create_date', label: 'Created' },
        { name: 'write_date', label: 'Updated' },
      ]

  const [field, setField] = useState(advancedFields[0]?.name ?? 'name')
  const [operator, setOperator] = useState('ilike')
  const [value, setValue] = useState('')
  const [keywordDomain, setKeywordDomain] = useState<unknown[]>([])

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const activeFilterDomains = useMemo(() => {
    return filters
      .filter((f) => f.domain.length > 0 && activeFilters.has(f.name || f.string))
      .map((f) => f.domain)
  }, [filters, activeFilters])

  const domainFilters = filters.filter((f) => f.domain.length > 0)
  const separators = filters.filter((f) => f.domain.length === 0)

  const toggleFilter = useCallback(
    (filter: SearchFilter) => {
      const key = filter.name || filter.string
      const next = new Set(activeFilters)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setActiveFilters(next)

      const newFilterDomains = filters
        .filter((f) => f.domain.length > 0 && next.has(f.name || f.string))
        .map((f) => f.domain)
      const domain = combineDomains([...newFilterDomains, keywordDomain])
      onSearch(domain)
    },
    [activeFilters, filters, keywordDomain, onSearch],
  )

  const toggleGroupBy = useCallback(
    (gb: SearchGroupBy) => {
      const fieldRef = gb.interval ? `${gb.fieldName}:${gb.interval}` : gb.fieldName
      setActiveGroupBys((prev) => {
        const next = prev.includes(fieldRef) ? prev.filter((f) => f !== fieldRef) : [fieldRef]
        onGroupByChange?.(next)
        return next
      })
    },
    [onGroupByChange],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = keyword.trim()
      if (!trimmed) {
        const domain = combineDomains(activeFilterDomains)
        setKeywordDomain([])
        onSearch(domain)
        return
      }
      const kwDomain = [[field, operator, trimmed]]
      setKeywordDomain(kwDomain)
      const domain = combineDomains([...activeFilterDomains, kwDomain])
      onSearch(domain)
    },
    [keyword, field, operator, activeFilterDomains, onSearch],
  )

  const handleReset = useCallback(() => {
    setKeyword('')
    setValue('')
    setKeywordDomain([])
    setActiveFilters(new Set())
    setActiveGroupBys([])
    onSearch([])
    onGroupByChange?.([])
  }, [onSearch, onGroupByChange])

  const handleAdvancedSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) {
        const domain = combineDomains(activeFilterDomains)
        setKeywordDomain([])
        onSearch(domain)
        return
      }
      const kwDomain = [[field, operator, trimmed]]
      setKeywordDomain(kwDomain)
      const domain = combineDomains([...activeFilterDomains, kwDomain])
      onSearch(domain)
    },
    [field, operator, value, activeFilterDomains, onSearch],
  )

  const activeFilterFacets = domainFilters.filter((f) => activeFilters.has(f.name || f.string))
  const activeGroupByFacets = groupByFilters.filter((gb) => {
    const ref = gb.interval ? `${gb.fieldName}:${gb.interval}` : gb.fieldName
    return activeGroupBys.includes(ref)
  })

  const hasAny = activeFilterFacets.length > 0 || activeGroupByFacets.length > 0 || !!keyword

  return (
    <div className="relative space-y-2">
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border-default bg-surface transition-colors focus-within:border-accent">
          <span className="pl-3 text-text-muted">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 px-2 py-1">
            {activeFilterFacets.map((f) => (
              <span
                key={`facet-f-${f.name || f.string}`}
                className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
              >
                <span className="max-w-[8rem] truncate">{f.string}</span>
                <button
                  type="button"
                  onClick={() => toggleFilter(f)}
                  className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] hover:bg-accent/20"
                >
                  ×
                </button>
              </span>
            ))}
            {activeGroupByFacets.map((gb) => {
              const ref = gb.interval ? `${gb.fieldName}:${gb.interval}` : gb.fieldName
              return (
                <span
                  key={`facet-gb-${ref}`}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600/10 px-1.5 py-0.5 text-xs text-emerald-600"
                >
                  <span className="max-w-[8rem] truncate">{gb.string}</span>
                  <button
                    type="button"
                    onClick={() => toggleGroupBy(gb)}
                    className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] hover:bg-emerald-600/20"
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={hasAny ? '' : placeholder}
              className="min-w-[80px] flex-1 border-0 bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>

          <div className="flex shrink-0 items-center self-stretch">
            {(domainFilters.length > 0 || groupByFilters.length > 0) && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu((v) => !v)}
                  className="flex h-full items-center gap-1 rounded-r-lg border-0 border-l border-border-default px-2 text-xs text-text-secondary transition-colors hover:bg-hover"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
                  </svg>
                  <span className="hidden sm:inline">Filters</span>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
                    <div className="space-y-3">
                      {domainFilters.length > 0 && (
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            Filters
                          </div>
                          {domainFilters.map((f) => {
                            const key = f.name || f.string
                            return (
                              <label
                                key={`menu-f-${key}`}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-text-primary transition-colors hover:bg-hover"
                              >
                                <input
                                  type="checkbox"
                                  checked={activeFilters.has(key)}
                                  onChange={() => toggleFilter(f)}
                                  className="h-3.5 w-3.5 rounded accent-accent"
                                />
                                {f.string}
                              </label>
                            )
                          })}
                        </div>
                      )}
                      {separators.length > 0 &&
                        domainFilters.length > 0 &&
                        groupByFilters.length > 0 && (
                          <div className="border-t border-border-subtle" />
                        )}
                      {groupByFilters.length > 0 && (
                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <line x1="6" y1="3" x2="6" y2="15" />
                              <circle cx="18" cy="6" r="3" />
                              <circle cx="6" cy="18" r="3" />
                              <path d="M18 9v12" />
                            </svg>
                            Group By
                          </div>
                          {groupByFilters.map((gb) => {
                            const ref = gb.interval
                              ? `${gb.fieldName}:${gb.interval}`
                              : gb.fieldName
                            return (
                              <label
                                key={`menu-gb-${gb.name || gb.string}`}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-text-primary transition-colors hover:bg-hover"
                              >
                                <input
                                  type="checkbox"
                                  checked={activeGroupBys.includes(ref)}
                                  onChange={() => toggleGroupBy(gb)}
                                  className="h-3.5 w-3.5 rounded accent-emerald-600"
                                />
                                {gb.string}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          onClick={handleSubmit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {showAdvanced && (
        <form onSubmit={handleAdvancedSubmit} className="flex gap-2">
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {advancedFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {[
              ['ilike', 'contains'],
              ['=', 'equals'],
              ['!=', 'not equal'],
              ['>', 'greater than'],
              ['<', 'less than'],
            ].map(([op, label]) => (
              <option key={op} value={op}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            className="flex-1 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            Filter
          </button>
        </form>
      )}
    </div>
  )
}
