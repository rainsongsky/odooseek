import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { callKw } from '../lib/api'
import { useAuth } from '../lib/auth'

interface QuickAction {
  label: string
  model: string
  view: string
  icon: string
  color: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'CRM',
    model: 'crm.lead',
    view: 'list',
    icon: 'oi oi-suitcase',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    label: 'Sales',
    model: 'sale.order',
    view: 'list',
    icon: 'oi oi-suitcase-plus',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    label: 'Inventory',
    model: 'stock.picking',
    view: 'list',
    icon: 'oi oi-transfer',
    color: 'bg-amber-500/10 text-amber-500',
  },
  {
    label: 'Accounting',
    model: 'account.move',
    view: 'list',
    icon: 'oi oi-numpad',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    label: 'Contacts',
    model: 'res.partner',
    view: 'list',
    icon: 'oi oi-users',
    color: 'bg-teal-500/10 text-teal-500',
  },
  {
    label: 'Pipeline',
    model: 'crm.lead',
    view: 'kanban',
    icon: 'oi oi-view-kanban',
    color: 'bg-rose-500/10 text-rose-500',
  },
]

const STATS_MODELS = [
  { model: 'crm.lead', domain: [['type', '=', 'lead']], label: 'Leads' },
  { model: 'crm.lead', domain: [['type', '=', 'opportunity']], label: 'Opportunities' },
  { model: 'sale.order', domain: [], label: 'Sale Orders' },
  { model: 'stock.picking', domain: [], label: 'Pickings' },
]

function StatCard({ model, domain, label }: { model: string; domain: unknown[]; label: string }) {
  const { data: count } = useQuery({
    queryKey: ['odoo', 'count', model, domain, 'dashboard'],
    queryFn: () => callKw<number>(model, 'search_count', [domain]),
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:border-border-default">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="mt-1 text-2xl font-bold text-text-primary">
        {count != null ? count.toLocaleString() : '—'}
      </span>
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, session } = useAuth()
  const homeModel = useMemo(() => {
    const homeActionId = Number(session.home_action_id)
    return homeActionId && homeActionId !== 0 ? null : 'res.partner'
  }, [session.home_action_id])

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="w-full max-w-md rounded-lg border border-border-default bg-surface p-6 text-center">
          <p className="mb-3 text-sm text-text-secondary">
            Not authenticated. Connect to an Odoo database to get started.
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Connect to Odoo
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface/50 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">Dashboard</span>
          <span className="text-xs text-text-muted">{session.db}</span>
        </div>
        <span className="text-xs text-text-muted">{session.name ?? session.username}</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={`${action.model}-${action.view}`}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/web',
                      search: { model: action.model, viewType: action.view },
                    })
                  }
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:border-border-default hover:bg-surface/80"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}
                  >
                    <i className={`${action.icon} text-lg`} />
                  </div>
                  <span className="text-xs font-medium text-text-primary">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Overview</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS_MODELS.map((stat) => (
                <StatCard
                  key={`${stat.model}-${stat.label}`}
                  model={stat.model}
                  domain={stat.domain}
                  label={stat.label}
                />
              ))}
            </div>
          </div>

          {homeModel && (
            <div className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
              <span className="text-xs text-text-muted">
                Your home app is {homeModel}.{' '}
                <button
                  type="button"
                  onClick={() => navigate({ to: '/web', search: { model: homeModel } })}
                  className="text-accent underline"
                >
                  Open
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'include' })
      if (!res.ok) throw redirect({ to: '/login' })
      const data = await res.json()
      if (!data.authenticated) throw redirect({ to: '/login' })
    } catch (e) {
      if (e instanceof Response || e instanceof redirect) throw e
      throw redirect({ to: '/login' })
    }
  },
})
