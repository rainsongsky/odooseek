import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { callKw } from '../lib/api'
import { ArrowUpDown, Download, FlipHorizontal } from '../lib/lucide-icons'
import type { OdooFieldMeta, PivotField, PivotMeasure, ReadGroupResult } from '../lib/odoo-types'
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

type SortState = { field: string; dir: 'asc' | 'desc' } | null

export function OdooPivotRenderer({ model, arch, fields, domain = [] }: PivotRendererProps) {
  const pivotView = useMemo(() => parsePivotXml(arch), [arch])

  const [flipped, setFlipped] = useState(false)
  const [activeMeasures, setActiveMeasures] = useState<string[]>(
    pivotView.measures.map((m) => m.name),
  )
  const [sort, setSort] = useState<SortState>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // When flipped, swap row/col fields
  const rowFields = flipped ? pivotView.colFields : pivotView.rowFields
  const colFields = flipped ? pivotView.rowFields : pivotView.colFields

  const groupByFields = useMemo(() => {
    return [...rowFields.map(fieldRef), ...colFields.map(fieldRef)]
  }, [rowFields, colFields])

  const measureFields = useMemo(() => {
    return pivotView.measures
      .filter((m) => activeMeasures.includes(m.name))
      .map((m) => measureAgg(m.name, m.operator))
  }, [pivotView, activeMeasures])

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

    const rowFieldRefs = rowFields.map(fieldRef)
    const colFieldRefs = colFields.map(fieldRef)

    for (const group of data) {
      const rowKey = rowFieldRefs.map((f) => String(group[f] ?? '')).join('|||')
      const colKey = colFieldRefs.map((f) => String(group[f] ?? '')).join('|||')

      const combinedKey = `${rowKey}:::${colKey}`
      cells.set(combinedKey, group)

      if (rowKey) rows.set(rowKey, group)
      if (colKey) cols.add(colKey)
    }

    let sortedCols = [...cols].sort()
    let sortedRows = [...rows.keys()].sort()

    // Sort rows by measure value if sort active
    if (sort) {
      const sortAgg = measureAgg(sort.field, pivotView.measures.find((m) => m.name === sort.field)?.operator)
      const firstCol = sortedCols[0] ?? ''
      const dir = sort.dir === 'asc' ? 1 : -1
      sortedRows.sort((a, b) => {
        const va = Number(cells.get(`${a}:::${firstCol}`)?.[sortAgg] ?? 0)
        const vb = Number(cells.get(`${b}:::${firstCol}`)?.[sortAgg] ?? 0)
        return (va - vb) * dir
      })
    }

    return { rowKeys: sortedRows, colKeys: sortedCols, cellMap: cells }
  }, [data, rowFields, colFields, sort, pivotView, measureFields])

  const toggleMeasure = useCallback((name: string) => {
    setActiveMeasures((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }, [])

  const toggleRowExpand = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }, [])

  const toggleSort = useCallback(
    (measureName: string) => {
      setSort((prev) => {
        if (!prev || prev.field !== measureName) return { field: measureName, dir: 'desc' }
        if (prev.dir === 'desc') return { field: measureName, dir: 'asc' }
        return null
      })
    },
    [],
  )

  const handleExportCsv = useCallback(() => {
    if (!data?.length) return
    const visibleMeasures = pivotView.measures.filter((m) => activeMeasures.includes(m.name))
    const headers = [
      ...rowFields.map((rf) => fieldLabels[fieldRef(rf)]),
      ...colKeys.flatMap((colKey) =>
        visibleMeasures.map((m) => {
          const colLabel = colFields
            .map((cf, i) => {
              const parts = colKey.split('|||')
              const val = parts[i] ?? ''
              return fields[cf.name]?.selection?.find(([k]) => k === val)?.[1] ?? val
            })
            .join('/')
          return `${colLabel} ${fieldLabels[m.name]}`
        }),
      ),
    ]
    const rows = rowKeys.map((rowKey) => {
      const parts = rowKey.split('|||')
      const rowVals = rowFields.map((rf, i) => {
        const val = parts[i] ?? ''
        const meta = fields[rf.name]
        return meta?.selection?.find(([k]) => k === val)?.[1] ?? val
      })
      const cellVals = colKeys.flatMap((colKey) => {
        const cellKey = `${rowKey}:::${colKey}`
        const cell = cellMap.get(cellKey)
        return visibleMeasures.map((m) => {
          const fieldName = measureAgg(m.name, m.operator)
          return formatMeasure(cell?.[fieldName], m.name)
        })
      })
      return [...rowVals, ...cellVals]
    })

    const csvContent = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pivotView.string || model}_pivot.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, rowKeys, colKeys, cellMap, pivotView, activeMeasures, rowFields, colFields, fieldLabels, fields, model])

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

  const visibleMeasures = pivotView.measures.filter((m) => activeMeasures.includes(m.name))

  // Compute totals
  const totals = new Map<string, number>()
  for (const m of visibleMeasures) {
    const fieldName = measureAgg(m.name, m.operator)
    let sum = 0
    for (const cell of cellMap.values()) {
      sum += Number(cell[fieldName] ?? 0)
    }
    totals.set(m.name, sum)
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        <h3 className="mr-auto text-sm font-semibold text-text-primary">{pivotView.string}</h3>

        {/* Measure toggles */}
        {pivotView.measures.length > 1 && (
          <div className="flex items-center gap-1">
            {pivotView.measures.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => toggleMeasure(m.name)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  activeMeasures.includes(m.name)
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface text-text-muted hover:bg-hover'
                }`}
              >
                {fieldLabels[m.name]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setFlipped((v) => !v)}
          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-hover"
          title="Flip axes"
        >
          <FlipHorizontal className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-hover"
          title="Export CSV"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="overflow-auto rounded-lg border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface/50">
                {rowFields.map((rf) => (
                  <th
                    key={`rh-${rf.name}`}
                    className="whitespace-nowrap border-r border-border-subtle px-3 py-2 text-left text-xs font-semibold text-text-secondary"
                  >
                    {fieldLabels[fieldRef(rf)]}
                  </th>
                ))}
                {colKeys.map((colKey) => {
                  const parts = colKey.split('|||')
                  return visibleMeasures.map((m) => (
                    <th
                      key={`ch-${colKey}-${m.name}`}
                      className="whitespace-nowrap border-r border-border-subtle px-3 py-2 text-right text-xs font-semibold text-text-secondary"
                    >
                      {colFields
                        .map((cf, i) => {
                          const val = parts[i] ?? ''
                          return fields[cf.name]?.selection?.find(([k]) => k === val)?.[1] ?? val
                        })
                        .join(' / ')}{' '}
                      {fieldLabels[m.name]}
                    </th>
                  ))
                })}
                {/* Totals column */}
                {visibleMeasures.map((m) => (
                  <th
                    key={`ch-total-${m.name}`}
                    className="whitespace-nowrap border-l-2 border-border-subtle px-3 py-2 text-right text-xs font-bold text-text-secondary"
                  >
                    Total {fieldLabels[m.name]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((rowKey) => {
                const parts = rowKey.split('|||')
                const isExpanded = expandedRows.has(rowKey)
                // Row totals
                const rowTotals = new Map<string, number>()
                for (const m of visibleMeasures) {
                  const fieldName = measureAgg(m.name, m.operator)
                  let sum = 0
                  for (const colKey of colKeys) {
                    sum += Number(cellMap.get(`${rowKey}:::${colKey}`)?.[fieldName] ?? 0)
                  }
                  rowTotals.set(m.name, sum)
                }

                return (
                  <tr
                    key={rowKey}
                    className="border-b border-border-subtle transition-colors hover:bg-hover/30"
                  >
                    {rowFields.map((rf, i) => {
                      const val = parts[i] ?? ''
                      const meta = fields[rf.name]
                      const displayVal = meta?.selection?.find(([k]) => k === val)?.[1] ?? val
                      return (
                        <td
                          key={`rd-${rf.name}-${rowKey}`}
                          className="whitespace-nowrap border-r border-border-subtle px-3 py-1.5 text-xs text-text-primary"
                          style={{ paddingLeft: `${i * 16 + 12}px` }}
                        >
                          {/* Expand button on first row field */}
                          {i === 0 && (
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(rowKey)}
                              className="mr-1 inline-block text-text-muted hover:text-text-primary"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          )}
                          {displayVal || '—'}
                        </td>
                      )
                    })}
                    {colKeys.map((colKey) => {
                      const cellKey = `${rowKey}:::${colKey}`
                      const cell = cellMap.get(cellKey)
                      return visibleMeasures.map((m) => {
                        const fieldName = measureAgg(m.name, m.operator)
                        const value = cell?.[fieldName]
                        return (
                          <td
                            key={`cd-${rowKey}-${colKey}-${m.name}`}
                            className={`whitespace-nowrap border-r border-border-subtle px-3 py-1.5 text-right text-xs ${
                              sort?.field === m.name ? 'font-medium text-text-primary' : 'text-text-primary'
                            }`}
                          >
                            {formatMeasure(value, m.name)}
                          </td>
                        )
                      })
                    })}
                    {/* Row totals */}
                    {visibleMeasures.map((m) => (
                      <td
                        key={`ct-${rowKey}-${m.name}`}
                        className="whitespace-nowrap border-l-2 border-border-subtle px-3 py-1.5 text-right text-xs font-medium text-text-primary"
                      >
                        {formatMeasure(rowTotals.get(m.name), m.name)}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {/* Grand total row */}
              <tr className="border-t-2 border-border-subtle bg-surface/50 font-medium">
                {rowFields.map((rf, i) => (
                  <td
                    key={`gt-${rf.name}`}
                    className="border-r border-border-subtle px-3 py-2 text-xs text-text-primary"
                    style={{ paddingLeft: `${i * 16 + 12}px` }}
                  >
                    {i === 0 ? 'Total' : ''}
                  </td>
                ))}
                {colKeys.map((colKey) =>
                  visibleMeasures.map((m) => {
                    const fieldName = measureAgg(m.name, m.operator)
                    let sum = 0
                    for (const rowKey of rowKeys) {
                      sum += Number(cellMap.get(`${rowKey}:::${colKey}`)?.[fieldName] ?? 0)
                    }
                    return (
                      <td
                        key={`gc-${colKey}-${m.name}`}
                        className="whitespace-nowrap border-r border-border-subtle px-3 py-2 text-right text-xs text-text-primary"
                      >
                        {formatMeasure(sum, m.name)}
                      </td>
                    )
                  }),
                )}
                {/* Grand total corner */}
                {visibleMeasures.map((m) => (
                  <td
                    key={`gtc-${m.name}`}
                    className="whitespace-nowrap border-l-2 border-border-subtle px-3 py-2 text-right text-xs font-bold text-text-primary"
                  >
                    {formatMeasure(totals.get(m.name), m.name)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}
