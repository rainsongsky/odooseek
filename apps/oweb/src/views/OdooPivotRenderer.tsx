import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { callKw } from '../lib/api'
import type { OdooFieldMeta, PivotField, ReadGroupResult } from '../lib/odoo-types'
import { parsePivotXml } from '../lib/xml-parser'

interface PivotRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
}

function fieldRef(f: PivotField): string {
  return f.interval ? `${f.name}:${f.interval}` : f.name
}

function measureAgg(field: string, op?: string): string {
  if (field === '__count') return '__count'
  return `${field}${op ? `:${op}` : ':sum'}`
}

export function OdooPivotRenderer({ model, arch, fields, domain = [] }: PivotRendererProps) {
  const pivotView = useMemo(() => parsePivotXml(arch), [arch])

  const groupByFields = useMemo(() => {
    return [...pivotView.rowFields.map(fieldRef), ...pivotView.colFields.map(fieldRef)]
  }, [pivotView])

  const measureFields = useMemo(() => {
    return pivotView.measures.map((m) => measureAgg(m.name, m.operator))
  }, [pivotView])

  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const f of pivotView.rowFields) {
      labels[fieldRef(f)] = f.string || fields[f.name]?.string || f.name
    }
    for (const f of pivotView.colFields) {
      labels[fieldRef(f)] = f.string || fields[f.name]?.string || f.name
    }
    for (const m of pivotView.measures) {
      labels[m.name] = m.string || fields[m.name]?.string || m.name
    }
    return labels
  }, [pivotView, fields])

  const { data, isLoading } = useQuery({
    queryKey: ['odoo', 'pivot', model, domain, groupByFields, measureFields],
    queryFn: () =>
      callKw<ReadGroupResult[]>(model, 'read_group', [domain, measureFields, groupByFields], {
        lazy: false,
        limit: 500,
      }),
    staleTime: 30_000,
  })

  // Build cross-tab in memory
  const { rowKeys, colKeys, cellMap } = useMemo(() => {
    const rows = new Map<string, Record<string, unknown>>()
    const cols = new Set<string>()
    const cells = new Map<string, Record<string, unknown>>()

    if (!data) return { rowKeys: [] as string[], colKeys: [] as string[], cellMap: cells }

    const rowFields = pivotView.rowFields.map(fieldRef)
    const colFields = pivotView.colFields.map(fieldRef)

    for (const group of data) {
      const rowKey = rowFields.map((f) => String(group[f] ?? '')).join('|||')
      const colKey = colFields.map((f) => String(group[f] ?? '')).join('|||')

      const combinedKey = `${rowKey}:::${colKey}`
      cells.set(combinedKey, group)

      if (rowKey) rows.set(rowKey, group)
      if (colKey) cols.add(colKey)
    }

    const sortedCols = [...cols].sort()
    const sortedRows = [...rows.keys()].sort()

    return { rowKeys: sortedRows, colKeys: sortedCols, cellMap: cells }
  }, [data, pivotView])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
        No data
      </div>
    )
  }

  const rowFields = pivotView.rowFields
  const colFields = pivotView.colFields

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{pivotView.string}</h3>

      <div className="overflow-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface/50">
              {/* Row header labels */}
              {rowFields.map((rf) => (
                <th
                  key={`rh-${rf.name}`}
                  className="whitespace-nowrap border-r border-border-subtle px-3 py-2 text-left text-xs font-semibold text-text-secondary"
                >
                  {fieldLabels[fieldRef(rf)]}
                </th>
              ))}
              {/* Measure headers under each col group */}
              {colKeys.map((colKey) => {
                const parts = colKey.split('|||')
                return pivotView.measures.map((m) => (
                  <th
                    key={`ch-${colKey}-${m.name}`}
                    className="whitespace-nowrap border-r border-border-subtle px-3 py-2 text-right text-xs font-semibold text-text-secondary"
                  >
                    {colFields
                      .map((cf, i) => {
                        const val = parts[i] ?? ''
                        const meta = fields[cf.name]
                        const label = meta?.selection?.find(([k]) => k === val)?.[1] ?? val
                        return label
                      })
                      .join(' / ')}{' '}
                    {fieldLabels[m.name]}
                  </th>
                ))
              })}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rowKey) => {
              const parts = rowKey.split('|||')
              return (
                <tr
                  key={rowKey}
                  className="border-b border-border-subtle transition-colors hover:bg-hover/30"
                >
                  {/* Row labels */}
                  {rowFields.map((rf, i) => {
                    const val = parts[i] ?? ''
                    const meta = fields[rf.name]
                    // Many2one display: if value looks like "DisplayName (id)" or just the name
                    const displayVal = meta?.selection?.find(([k]) => k === val)?.[1] ?? val
                    return (
                      <td
                        key={`rd-${rf.name}-${rowKey}`}
                        className="whitespace-nowrap border-r border-border-subtle px-3 py-1.5 text-xs text-text-primary"
                        style={{ paddingLeft: `${i * 16 + 12}px` }}
                      >
                        {displayVal || '—'}
                      </td>
                    )
                  })}
                  {/* Cell values */}
                  {colKeys.map((colKey) => {
                    const cellKey = `${rowKey}:::${colKey}`
                    const cell = cellMap.get(cellKey)
                    return pivotView.measures.map((m) => {
                      const fieldName = measureAgg(m.name, m.operator)
                      const value = cell?.[fieldName]
                      return (
                        <td
                          key={`cd-${rowKey}-${colKey}-${m.name}`}
                          className="whitespace-nowrap border-r border-border-subtle px-3 py-1.5 text-right text-xs text-text-primary"
                        >
                          {formatMeasure(value, m.name)}
                        </td>
                      )
                    })
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-text-muted">{data.length} groups</div>
    </div>
  )
}

function formatMeasure(value: unknown, measureName: string): string {
  if (value === null || value === undefined) return '—'
  if (measureName === '__count') return String(value)
  if (typeof value === 'number') {
    return value % 1 === 0 ? String(value) : value.toFixed(2)
  }
  return String(value)
}
