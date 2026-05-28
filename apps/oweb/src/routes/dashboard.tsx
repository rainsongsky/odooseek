import { useQuery } from '@tanstack/react-query'
import { callKw } from '../lib/api'
import { useAuth } from '../lib/auth'
import { OdooViewLoader } from '../views/OdooViewLoader'

function DashboardPage() {
  const { isAuthenticated, session } = useAuth()

  // Resolve home_action_id (if any) to the user's home model
  const { data: homeModel } = useQuery({
    queryKey: ['odoo', 'home_action', session.home_action_id],
    queryFn: async () => {
      const homeActionId = Number(session.home_action_id)
      if (!homeActionId || homeActionId === 0) return null
      const actions = await callKw<Array<{ res_model: string }>>(
        'ir.actions.act_window',
        'read',
        [[Number(homeActionId)], ['res_model']],
      )
      return actions[0]?.res_model ?? null
    },
    enabled: isAuthenticated && !!session.home_action_id,
    staleTime: 15 * 60_000,
  })

  const model = homeModel ?? 'res.partner'

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="w-full max-w-2xl rounded-lg border border-border-default bg-surface p-6 text-center">
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
      <div className="flex items-center gap-4 border-b border-border-subtle bg-surface/50 px-6 py-3">
        <span className="text-xs text-text-muted">{session.name ?? session.username}</span>
        <span className="text-xs text-text-muted">{session.db}</span>
      </div>

      <OdooViewLoader model={model} viewType="list" />
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
