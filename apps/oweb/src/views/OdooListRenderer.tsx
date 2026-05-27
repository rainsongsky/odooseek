import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { callKw } from '../lib/api'
import type { OdooFieldMeta } from './types'
import { parseListXml } from './xml-parser'

interface ListRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
}

export function OdooListRenderer({ model, arch, fields, domain = [] }: ListRendererProps) {
  const [page, setPage] = useState(0)
  const [order, setOrder] = useState('')
  const limit = 80

  const listView = useMemo(() => parseListXml(arch), [arch])
  const visibleColumns = listView.columns.filter((c) => !c.invisible || c.invisible < 1)

  const {
    data: records,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'data', model, 'list', domain, page, limit, order],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(
        model,
        'search_read',
        [domain, visibleColumns.map((c) => c.name)],
        {
          offset: page * limit,
          limit,
          order: order || undefined,
        },
      ),
  })

  const handleSort = (fieldName: string) => {
    setOrder((prev) => {
      if (prev === fieldName) return `${fieldName} desc`
      if (prev === `${fieldName} desc`) return ''
      return fieldName
    })
    setPage(0)
  }

  const sortArrow = (fieldName: string) => {
    if (order === fieldName) return ' ↑'
    if (order === `${fieldName} desc`) return ' ↓'
    return ''
  }

  const data = records ?? []
  const hasMore = data.length === limit

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-text-primary">{listView.string || model}</h3>
        <span className="text-xs text-text-muted">
          {data.length} record{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load data'}
        </div>
      )}

      {!isLoading && !error && data.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          No records found
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface/50">
                  {visibleColumns.map((col) => {
                    const meta = fields[col.name]
                    const label = col.string || meta?.string || col.name
                    return (
                      <th
                        key={col.name}
                        onClick={() => handleSort(col.name)}
                        className="cursor-pointer whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
                      >
                        {label}
                        <span className="text-accent">{sortArrow(col.name)}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((record, i) => (
                  <tr
                    key={record.id as number}
                    className={`border-b border-border-subtle transition-colors hover:bg-hover/50 ${
                      i === data.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.name}
                        className="whitespace-nowrap px-4 py-2 text-sm text-text-primary"
                      >
                        {renderCell(record[col.name], fields[col.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-text-muted">Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function renderCell(value: unknown, _meta?: OdooFieldMeta): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? `${value[1]}` : `#${value[0]}`
  }
  return JSON.stringify(value)
}
