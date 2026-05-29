import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../lib/auth'
import {
  fetchMenus,
  getAppSections,
  getApps,
  type MenusData,
  type OdooMenuEntry,
} from '../lib/menu-service'
import '../styles/odoo-icons.css'

const ICON_FALLBACK: Record<string, string> = {
  CRM: 'oi oi-suitcase',
  Sales: 'oi oi-suitcase-plus',
  Inventory: 'oi oi-transfer',
  Invoicing: 'oi oi-numpad',
  Accounting: 'oi oi-numpad',
  Purchase: 'oi oi-panel-right',
  Contacts: 'oi oi-users',
  Project: 'oi oi-star-plus',
  Discuss: 'oi oi-activity',
  Calendar: 'oi oi-schedule-today',
  Settings: 'oi oi-settings-adjust',
  Apps: 'oi oi-apps',
}

function getAppIconClass(app: OdooMenuEntry): string | null {
  if (ICON_FALLBACK[app.name]) return ICON_FALLBACK[app.name]
  for (const [name, icon] of Object.entries(ICON_FALLBACK)) {
    if (app.name.toLowerCase().includes(name.toLowerCase())) return icon
  }
  return null
}

function MenuPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const {
    data: menus,
    isLoading,
    error,
  } = useQuery<MenusData>({
    queryKey: ['odoo', 'menus'],
    queryFn: fetchMenus,
    staleTime: 15 * 60_000,
    retry: false,
    enabled: isAuthenticated,
  })

  const apps = menus ? getApps(menus) : []

  const handleAppClick = (app: OdooMenuEntry) => {
    if (app.actionID) {
      navigate({ to: '/web', search: { action: app.actionID } })
    } else if (app.children.length > 0 && menus) {
      const sections = getAppSections(menus, app.id as number)
      const firstWithAction = sections.find((s) => s.actionID)
      if (firstWithAction?.actionID) {
        navigate({ to: '/web', search: { action: firstWithAction.actionID } })
      }
    }
  }

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
        {apps.map((app) => {
          const iconClass = getAppIconClass(app)
          return (
            <button
              key={String(app.id)}
              type="button"
              onClick={() => handleAppClick(app)}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-6 text-left transition-colors hover:border-border-default hover:bg-surface"
            >
              {app.webIconData ? (
                <img
                  src={app.webIconData}
                  alt={app.name}
                  className="h-12 w-12 rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  {iconClass ? (
                    <i className={`${iconClass} text-xl`} />
                  ) : (
                    <span className="text-xl font-semibold">{app.name[0]}</span>
                  )}
                </div>
              )}
              <span className="text-sm font-medium text-text-primary">{app.name}</span>
              {app.actionID && (
                <span className="text-[10px] text-text-muted">#{app.actionID}</span>
              )}
            </button>
          )
        })}
      </div>

      {apps.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          No applications available
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/menu')({
  component: MenuPage,
})
