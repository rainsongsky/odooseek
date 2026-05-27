import { useAuth } from '../lib/auth'
import { OdooViewLoader } from '../views/OdooViewLoader'

export function DashboardPage() {
  const { isAuthenticated, session } = useAuth()

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

      <OdooViewLoader model="res.partner" viewType="list" />
    </div>
  )
}
