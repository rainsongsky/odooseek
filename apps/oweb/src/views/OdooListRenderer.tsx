import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'use-intl'
import { callKw, readGroup } from '../lib/api'
import { getDecorationClass } from '../lib/expression-evaluator'
import type { OdooFieldMeta, ReadGroupResult } from '../lib/odoo-types'
import { parseListXml } from '../lib/xml-parser'

interface ListRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  groupBy?: string[]
  onRowClick?: (recordId: number) => void
}

export function OdooListRenderer({
  model,
  arch,
  fields,
  domain = [],
  groupBy = [],
  onRowClick,
}: ListRendererProps) {
  const t = useTranslations()
  const [page, setPage] = useState(0)
  const [order, setOrder] = useState('')
  const limit = 80

  const listView = useMemo(() => parseListXml(arch), [arch])
  const visibleColumns = listView.columns.filter((c) => !c.invisible || c.invisible < 1)
  const groupByActive = groupBy.length > 0

  const {
    data: groupedData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'data', model, 'list', domain, groupBy, page, limit, order],
    queryFn: () =>
      groupByActive
        ? readGroup<ReadGroupResult[]>(
            model,
            domain,
            visibleColumns.map((c) => c.name),
            groupBy,
          )
        : callKw<Array<Record<string, unknown>>>(
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

  const data = (groupedData ?? []) as unknown[]
  const hasMore = !groupByActive && data.length === limit
  const groupData = groupByActive ? (groupedData as ReadGroupResult[] | undefined) : null

  const { data: totalCount } = useQuery({
    queryKey: ['odoo', 'count', model, domain],
    queryFn: () => callKw<number>(model, 'search_count', [domain]),
    enabled: !groupByActive,
    staleTime: 30_000,
  })

  const exportCSV = useCallback(() => {
    const records = data as Array<Record<string, unknown>>
    if (!records.length) return

    const csvRows: string[] = []
    // Header
    csvRows.push(
      visibleColumns
        .map((c) => {
          const meta = fields[c.name]
          return `"${c.string || meta?.string || c.name}"`
        })
        .join(','),
    )
    // Data
    for (const r of records) {
      csvRows.push(
        visibleColumns
          .map((c) => {
            const v = r[c.name]
            const str = v == null ? '' : Array.isArray(v) ? (v[1] ?? v[0]) : String(v)
            return `"${String(str).replace(/"/g, '""')}"`
          })
          .join(','),
      )
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, visibleColumns, fields, model])

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{listView.string || model}</h3>
          {!groupByActive && data.length > 0 && (
            <button
              type="button"
              onClick={exportCSV}
              className="rounded border border-border-default px-2 py-0.5 text-[10px] text-text-muted hover:bg-hover hover:text-text-primary"
            >
              Export
            </button>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {groupByActive
            ? `${groupData?.length ?? 0} groups`
            : totalCount != null
              ? `${page * limit + 1}-${Math.min(page * limit + data.length, totalCount)} / ${totalCount}`
              : `${data.length} record${data.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : t('list.failedToLoad')}
        </div>
      )}

      {!isLoading && !error && data.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          {t('list.noRecords')}
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface/50">
                  {visibleColumns.map((col, ci) => {
                    const meta = fields[col.name]
                    const label = col.string || meta?.string || col.name
                    return (
                      <th
                        key={`h-${col.name}-${ci}`}
                        onClick={() => !groupByActive && handleSort(col.name)}
                        className={`whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors ${!groupByActive ? 'cursor-pointer hover:text-text-primary' : ''}`}
                      >
                        {label}
                        {!groupByActive && (
                          <span className="text-accent">{sortArrow(col.name)}</span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {groupByActive && groupData
                  ? groupData.map((group, i) => {
                      const countKey = `${visibleColumns[0]?.name ?? 'id'}_count`
                      const count = group[countKey] ?? 0
                      return (
                        <tr
                          key={`g-${i}`}
                          className={`border-b border-border-subtle bg-surface/30 transition-colors hover:bg-hover/30 ${i === groupData.length - 1 ? 'border-b-0' : ''}`}
                        >
                          {visibleColumns.map((col, ci) => {
                            const countColKey = `${col.name}_count`
                            const val = group[countColKey] ?? group[col.name]
                            return (
                              <td
                                key={`gd-${col.name}-${ci}`}
                                className="whitespace-nowrap px-4 py-2 text-sm text-text-primary"
                              >
                                <span className="font-medium">
                                  {renderCell(val, fields[col.name])}
                                </span>
                                <span className="ml-1.5 rounded bg-hover px-1 py-0.5 text-[10px] text-text-muted">
                                  {String(count)}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  : (data as Array<Record<string, unknown>>).map((record, i) => {
                      const rowDeco = getDecorationClass(
                        listView.decorations as unknown as Record<string, unknown>,
                        record,
                      )
                      return (
                        <tr
                          key={record.id as number}
                          onClick={() => onRowClick?.(record.id as number)}
                          className={[
                            'border-b border-border-subtle transition-colors hover:bg-hover/50',
                            onRowClick ? 'cursor-pointer' : '',
                            i === data.length - 1 ? 'border-b-0' : '',
                            rowDeco,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {visibleColumns.map((col, ci) => {
                            const cellDeco = getDecorationClass(
                              col as unknown as Record<string, unknown>,
                              record,
                            )
                            return (
                              <td
                                key={`d-${col.name}-${ci}`}
                                className={[
                                  'whitespace-nowrap px-4 py-2 text-sm text-text-primary',
                                  cellDeco,
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {renderCell(record[col.name], fields[col.name])}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>

          {!groupByActive && (
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('list.prev')}
              </button>
              <span className="text-xs text-text-muted">{t('list.page', { page: page + 1 })}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('list.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function renderCell(value: unknown, meta?: OdooFieldMeta): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (typeof value === 'string') {
    // selection: look up display label
    if (meta?.selection) {
      const pair = meta.selection.find(([k]) => k === value)
      if (pair) return pair[1]
    }
    return value
  }
  if (typeof value === 'number') {
    // monetary: show with 2 decimal places
    if (meta?.type === 'monetary') return value.toFixed(2)
    return String(value)
  }

  // many2one: [id, "display_name"]
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? String(value[1]) : `#${value[0]}`
  }

  // many2many: [id1, "name1", id2, "name2", ...]
  if (Array.isArray(value) && value.length > 2) {
    const count = Math.floor(value.length / 2)
    return `${count} record${count !== 1 ? 's' : ''}`
  }

  return JSON.stringify(value)
}
