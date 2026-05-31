import type { OdooFieldMeta, ReadGroupResult } from '@odooseek/odoo-client'
import { parseGraphXml, readGroup } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  type PieLabelRenderProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown } from '../lib/lucide-icons'

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
]

type ChartType = 'bar' | 'line' | 'pie' | 'area'
type SortOrder = 'none' | 'asc' | 'desc'

interface GraphRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
}

export function OdooGraphRenderer({ model, arch, fields, domain = [] }: GraphRendererProps) {
  const graphView = useMemo(() => parseGraphXml(arch), [arch])

  const [chartType, setChartType] = useState<ChartType>(graphView.graphType)
  const [activeMeasure, setActiveMeasure] = useState(graphView.measures[0]?.name ?? '__count')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')

  const groupByFields = graphView.rowFields.map((f) =>
    f.interval ? `${f.name}:${f.interval}` : f.name,
  )

  const aggregateFields = graphView.measures.filter((m) => m.name !== '__count').map((m) => m.name)
  if (aggregateFields.length === 0) aggregateFields.push('__count')

  const fieldsToQuery = [...groupByFields, ...aggregateFields]

  const {
    data: rawData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'graph', model, domain, groupByFields, aggregateFields],
    queryFn: () => readGroup<ReadGroupResult[]>(model, domain, fieldsToQuery, groupByFields, 0, 0),
  })

  const toggleSort = useCallback(() => {
    setSortOrder((prev) => (prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none'))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
        {error instanceof Error ? error.message : 'Failed to load graph data'}
      </div>
    )
  }

  const data = rawData ?? []
  const firstRowField = graphView.rowFields[0]?.name

  let chartData = data.map((row) => {
    const label = String(row[firstRowField ?? ''] ?? '')
    const entry: Record<string, unknown> = { name: label }
    for (const m of graphView.measures) {
      const key = m.name === '__count' ? '__count' : m.name
      entry[key] = Number(row[key] ?? 0)
    }
    return entry
  })

  // Sort by active measure
  if (sortOrder !== 'none') {
    chartData = [...chartData].sort((a, b) => {
      const va = Number(a[activeMeasure] ?? 0)
      const vb = Number(b[activeMeasure] ?? 0)
      return sortOrder === 'asc' ? va - vb : vb - va
    })
  }

  const allMeasureKeys = graphView.measures.map((m) => m.name)
  const activeMeasureMeta = graphView.measures.find((m) => m.name === activeMeasure)
  const activeMeasureLabel = activeMeasureMeta?.string || activeMeasure

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        <h3 className="mr-auto text-sm font-semibold text-text-primary">
          {graphView.string || model}
        </h3>

        {/* Chart type selector */}
        <Dropdown label={chartType.charAt(0).toUpperCase() + chartType.slice(1)}>
          {(['bar', 'line', 'pie', 'area'] as ChartType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setChartType(t)}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-hover ${
                chartType === t ? 'font-medium text-accent' : 'text-text-primary'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} Chart
            </button>
          ))}
        </Dropdown>

        {/* Measure selector (only if multiple measures) */}
        {graphView.measures.length > 1 && (
          <Dropdown label={activeMeasureLabel}>
            {graphView.measures.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => setActiveMeasure(m.name)}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-hover ${
                  activeMeasure === m.name ? 'font-medium text-accent' : 'text-text-primary'
                }`}
              >
                {m.string || m.name}
              </button>
            ))}
          </Dropdown>
        )}

        {/* Sort toggle */}
        <button
          type="button"
          onClick={toggleSort}
          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
          title={`Sort: ${sortOrder === 'none' ? 'Unsorted' : sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
        >
          Sort{sortOrder !== 'none' ? ` ${sortOrder === 'asc' ? '↑' : '↓'}` : ''}
        </button>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={340}>
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={activeMeasure}
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(props: PieLabelRenderProps) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { name, percent } = props as any
                  return `${name ?? ''}: ${(((percent as number) ?? 0) * 100).toFixed(0)}%`
                }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}>
                <Label
                  value={activeMeasureLabel}
                  angle={-90}
                  position="insideLeft"
                  style={{ fontSize: 11 }}
                />
              </YAxis>
              <Tooltip />
              <Legend />
              {allMeasureKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={graphView.measures[i]?.string || key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}>
                <Label
                  value={activeMeasureLabel}
                  angle={-90}
                  position="insideLeft"
                  style={{ fontSize: 11 }}
                />
              </YAxis>
              <Tooltip />
              <Legend />
              {allMeasureKeys.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={graphView.measures[i]?.string || key}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.3}
                  stackId={graphView.stacked ? 'stack' : undefined}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}>
                <Label
                  value={activeMeasureLabel}
                  angle={-90}
                  position="insideLeft"
                  style={{ fontSize: 11 }}
                />
              </YAxis>
              <Tooltip />
              <Legend />
              {allMeasureKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={graphView.measures[i]?.string || key}
                  stackId={graphView.stacked ? 'stack' : undefined}
                  fill={COLORS[i % COLORS.length]}
                  label={{ position: 'top', fontSize: 10, fill: 'var(--color-text-secondary)' }}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Simple dropdown with click-outside-to-close. */
function Dropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-md border border-border-subtle bg-surface py-1 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
