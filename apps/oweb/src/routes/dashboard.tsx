import { useQuery } from '@tanstack/react-query'
import { getSession } from '../lib/api'

export function DashboardPage() {
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['odoo', 'session'],
    queryFn: getSession,
    retry: false,
  })

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      <div className="w-full max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-semibold text-text-primary">
          Dashboard
        </h2>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-border-default bg-surface p-6 text-center">
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
        )}

        {session && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface/50 p-6">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">
                Session Information
              </h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">User ID</dt>
                  <dd className="text-text-primary">{session.uid}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Username</dt>
                  <dd className="text-text-primary">{session.username}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Database</dt>
                  <dd className="text-text-primary">{session.db}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Session</dt>
                  <dd className="font-mono text-text-primary">
                    {session.session_id.slice(0, 16)}...
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface/50 p-6">
              <h3 className="mb-1 text-sm font-semibold text-text-primary">
                Welcome to OdooSeek
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                You are now connected to the Odoo backend. Use the navigation
                to explore modules, views, and data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
