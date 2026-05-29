import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { readGroup } from '../lib/api'
import type { OdooFieldMeta, ReadGroupResult } from '../lib/odoo-types'
import { parseGraphXml } from '../lib/xml-parser'

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

interface GraphRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
}

export function OdooGraphRenderer({ model, arch, fields, domain = [] }: GraphRendererProps) {
  const graphView = useMemo(() => parseGraphXml(arch), [arch])

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
  const chartData = data.map((row) => {
    const label = String(row[firstRowField ?? ''] ?? '')
    const entry: Record<string, unknown> = { name: label }
    for (const m of graphView.measures) {
      const key = m.name === '__count' ? '__count' : m.name
      entry[key] = Number(row[key] ?? 0)
    }
    return entry
  })

  const measureKeys = graphView.measures.map((m) => m.name)

  return (
    <div className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{graphView.string || model}</h3>
      <div style={{ width: '100%', height: 320 }}>
        {graphView.graphType === 'pie' ? (
          <PieChart width={600} height={320}>
            <Pie
              data={chartData}
              dataKey={measureKeys[0] ?? '__count'}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : graphView.graphType === 'line' ? (
          <LineChartContent
            data={chartData}
            measureKeys={measureKeys}
            measures={graphView.measures}
          />
        ) : (
          <BarChart width={600} height={320} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default, #e5e7eb)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {measureKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={graphView.measures[i]?.string || key}
                stackId={graphView.stacked ? 'stack' : undefined}
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </BarChart>
        )}
      </div>
    </div>
  )
}

function LineChartContent({
  data,
  measureKeys,
  measures,
}: {
  data: Record<string, unknown>[]
  measureKeys: string[]
  measures: { name: string; string?: string }[]
}) {
  return (
    <LineChart width={600} height={320} data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default, #e5e7eb)" />
      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend />
      {measureKeys.map((key, i) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          name={measures[i]?.string || key}
          stroke={COLORS[i % COLORS.length]}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      ))}
    </LineChart>
  )
}
