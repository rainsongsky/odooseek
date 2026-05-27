import { OdooListView } from '../components/OdooListView'
import { useAuth } from '../lib/auth'

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
      <div className="rounded-xl border border-border-subtle bg-surface/50 px-6 py-4">
        <dl className="flex gap-6 text-xs">
          <div>
            <dt className="text-text-muted">User</dt>
            <dd className="text-text-primary">{session.username ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">DB</dt>
            <dd className="text-text-primary">{session.db ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">UID</dt>
            <dd className="text-text-primary">{session.uid ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <OdooListView
        model="res.partner"
        fields={[
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
          { name: 'phone', label: 'Phone' },
          { name: 'company_id', label: 'Company' },
        ]}
        limit={20}
      />
    </div>
  )
}
