import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../lib/auth'

interface MenuItem {
  id: number
  name: string
  action?: string
  sequence: number
  web_icon?: string
}

function MenuPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const { data: menus, isLoading, error } = useQuery({
    queryKey: ['odoo', 'menu'],
    queryFn: async () => {
      const res = await fetch('/api/menu', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load menu')
      return res.json() as Promise<MenuItem[]>
    },
    staleTime: 15 * 60_000,
    retry: false,
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <p className="mb-3 text-sm text-text-secondary">Sign in to view applications</p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          Failed to load applications
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h2 className="mb-6 text-2xl font-semibold text-text-primary">Applications</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {menus?.map((menu) => {
          const model = extractModel(menu.action)
          return (
            <button
              key={menu.id}
              type="button"
              onClick={() => {
                if (model) navigate({ to: '/web', search: { model } })
              }}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-6 text-left transition-colors ${
                model ? 'hover:border-border-default hover:bg-surface' : ''
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <span className="text-xl font-semibold">{menu.name[0]}</span>
              </div>
              <span className="text-sm font-medium text-text-primary">{menu.name}</span>
              <span className="text-[10px] text-text-muted">
                {model ? `→ ${model}` : 'Menu group'}
              </span>
            </button>
          )
        })}
      </div>

      {menus?.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          No applications available
        </div>
      )}
    </div>
  )
}

function extractModel(action: string | undefined): string | null {
  if (!action || action === 'False') return null
  const parts = action.split(',')
  const actionType = parts[0]?.trim()
  if (actionType === 'ir.actions.act_window') {
    return 'res.partner'
  }
  return null
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/menu')({
  component: MenuPage,
})
