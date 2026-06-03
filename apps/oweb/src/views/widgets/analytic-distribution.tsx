import { callKw } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { FieldWidgetProps } from './index'

interface DistributionItem {
  accountId: number
  accountName: string
  percentage: number
}

function parseDistribution(value: unknown): DistributionItem[] {
  if (!value || typeof value !== 'object') return []
  const entries = Object.entries(value as Record<string, number>)
  return entries.map(([id, pct]) => ({
    accountId: Number(id),
    accountName: '',
    percentage: pct,
  }))
}

function buildDistribution(items: DistributionItem[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    if (item.accountId && item.percentage > 0) {
      result[String(item.accountId)] = item.percentage
    }
  }
  return result
}

export function AnalyticDistributionWidget({ value, onChange, readOnly }: FieldWidgetProps) {
  const items = parseDistribution(value)

  const accountIds = items.map((i) => i.accountId).filter((id) => id > 0)

  const { data: accounts } = useQuery({
    queryKey: ['odoo', 'read', 'account.analytic.account', accountIds],
    queryFn: async () => {
      if (accountIds.length === 0) return []
      return callKw<Array<{ id: number; name: string }>>('account.analytic.account', 'read', [
        accountIds,
        ['id', 'name'],
      ])
    },
    enabled: accountIds.length > 0,
    staleTime: 60_000,
  })

  const enriched: DistributionItem[] = items.map((item) => {
    const acc = accounts?.find((a) => a.id === item.accountId)
    return { ...item, accountName: acc?.name ?? `#${item.accountId}` }
  })

  const total = enriched.reduce((sum, i) => sum + i.percentage, 0)

  const updateItem = useCallback(
    (idx: number, pct: number) => {
      const next = [...enriched]
      next[idx] = { ...next[idx], percentage: Math.max(0, Math.min(100, pct)) }
      onChange(buildDistribution(next))
    },
    [enriched, onChange],
  )

  if (readOnly) {
    if (enriched.length === 0) return <span className="text-sm text-text-muted">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {enriched.map((item) => (
          <span
            key={item.accountId}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
          >
            {item.accountName} <span className="text-text-muted">{item.percentage}%</span>
          </span>
        ))}
        {enriched.length > 1 && <span className="text-xs text-text-muted">{total}%</span>}
      </div>
    )
  }

  if (enriched.length === 0) {
    return <span className="text-sm text-text-muted">No analytic distribution</span>
  }

  return (
    <div className="flex flex-col gap-1">
      {enriched.map((item, i) => (
        <div key={item.accountId} className="flex items-center gap-2">
          <span className="w-32 truncate text-xs text-text-primary">{item.accountName}</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={item.percentage}
              onChange={(e) => updateItem(i, e.target.value !== '' ? Number(e.target.value) : 0)}
              className="w-16 rounded border border-border-default px-1 py-0.5 text-xs text-right focus:border-accent focus:outline-none"
            />
            <span className="text-xs text-text-muted">%</span>
          </div>
        </div>
      ))}
      <span className="text-xs text-text-muted">
        Total: {total}%
        {total !== 100 && <span className="ml-1 text-warning">(should be 100%)</span>}
      </span>
    </div>
  )
}
