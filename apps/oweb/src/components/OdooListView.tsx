import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { SearchBar } from './SearchBar'

interface FieldDef {
  name: string
  label: string
}

interface OdooListViewProps {
  model: string
  fields: FieldDef[]
  domain?: unknown[]
  limit?: number
}

export function OdooListView({
  model,
  fields,
  domain: initialDomain = [],
  limit = 80,
}: OdooListViewProps) {
  const [page, setPage] = useState(0)
  const [order, setOrder] = useState<string>('')
  const [domain, setDomain] = useState<unknown[]>(initialDomain)
  const [keyword, setKeyword] = useState('')

  const offset = page * limit

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['odoo', 'list', model, domain, offset, limit, order],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        model,
        domain,
        fields: fields.map((f) => f.name),
        offset,
        limit,
      }
      if (order) {
        params.sort = order
      }
      const res = await fetch('/api/odoo/web/dataset/search_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            path: '/web/dataset/search_read',
            kwargs: params,
          },
          id: 1,
        }),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      if (json.error) {
        throw new Error(json.error.message || 'Odoo API error')
      }
      return (json.result ?? []) as Record<string, unknown>[]
    },
    retry: false,
  })

  const handleSearch = (newDomain: unknown[]) => {
    setDomain(newDomain)
    setKeyword('')
    setPage(0)
  }

  const handleSort = (fieldName: string) => {
    if (order === fieldName) {
      setOrder(`${fieldName} desc`)
    } else if (order === `${fieldName} desc`) {
      setOrder('')
    } else {
      setOrder(fieldName)
    }
    setPage(0)
  }

  const sortIndicator = (fieldName: string) => {
    if (order === fieldName) return ' ↑'
    if (order === `${fieldName} desc`) return ' ↓'
    return ''
  }

  const records = data ?? []
  const hasMore = records.length === limit

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{model}</h3>
        <span className="text-xs text-text-muted">
          {records.length} record{records.length !== 1 ? 's' : ''}
          {keyword && (
            <>
              {' '}
              — <span className="text-accent">"{keyword}"</span>
            </>
          )}
        </span>
      </div>

      <SearchBar onSearch={handleSearch} placeholder={`Search ${model}...`} />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load data'}
          <button type="button" onClick={() => refetch()} className="ml-3 cursor-pointer underline">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && records.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          No records found
        </div>
      )}

      {!isLoading && !error && records.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface/50">
                  {fields.map((f) => (
                    <th
                      key={f.name}
                      onClick={() => handleSort(f.name)}
                      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {f.label}
                      <span className="text-accent">{sortIndicator(f.name)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record, i) => (
                  <tr
                    key={record.id as number}
                    className={`border-b border-border-subtle transition-colors hover:bg-hover/50 ${
                      i === records.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    {fields.map((f) => (
                      <td key={f.name} className="px-4 py-2.5 text-sm text-text-primary">
                        {renderCell(record[f.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted">Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value) && value.length === 2) {
    return `${value[0]} / ${value[1]}`
  }
  return JSON.stringify(value)
}
