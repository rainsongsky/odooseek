import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { ChevronDown, Home, LogIn, LogOut, Settings } from '@/lib/lucide-icons'
import { useAuth } from '../lib/auth'
import {
  fetchMenus,
  getAppSections,
  getApps,
  type MenusData,
  type MenuTreeNode,
  type OdooMenuEntry,
} from '../lib/menu-service'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const t = useTranslations()
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const currentSearch = routerState.location.search as Record<string, unknown>
  const { isAuthenticated, session, refetch } = useAuth()

  const [appsOpen, setAppsOpen] = useState(false)
  const [currentAppId, setCurrentAppId] = useState<number | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null)
  const appsRef = useRef<HTMLDivElement>(null)

  const { data: menus } = useQuery<MenusData>({
    queryKey: ['odoo', 'menus'],
    queryFn: fetchMenus,
    staleTime: 15 * 60_000,
    enabled: isAuthenticated,
  })

  const apps = menus ? getApps(menus) : []
  const currentApp = currentAppId ? menus?.[String(currentAppId)] : null
  const sections = currentApp && menus ? getAppSections(menus, currentAppId!) : []

  useEffect(() => {
    if (!menus) return
    if (currentPath === '/web') {
      const actionId = currentSearch?.action as number | undefined
      if (actionId) {
        for (const app of apps) {
          if (app.actionID === actionId) {
            setCurrentAppId(app.id as number)
            return
          }
          const sections = getAppSections(menus, app.id as number)
          if (sections.some((s) => s.actionID === actionId)) {
            setCurrentAppId(app.id as number)
            return
          }
        }
      }
    }
  }, [currentPath, currentSearch, menus, apps])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const keyMap: Record<string, string> = { h: '/', d: '/dashboard', ',': '/settings' }
      const target = keyMap[e.key]
      if (target) navigate({ to: target })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (appsRef.current && !appsRef.current.contains(e.target as Node)) {
        setAppsOpen(false)
      }
      setOpenSubmenu(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleAppClick = (app: OdooMenuEntry) => {
    setCurrentAppId(app.id as number)
    setAppsOpen(false)
    if (app.actionID) {
      navigate({ to: '/web', search: { action: app.actionID } })
    } else {
      navigate({ to: '/menu' })
    }
  }

  const handleSectionClick = (section: MenuTreeNode) => {
    if (section.children.length > 0 && section.actionID === false) {
      setOpenSubmenu(openSubmenu === section.id ? null : section.id)
      return
    }
    if (section.actionID) {
      navigate({ to: '/web', search: { action: section.actionID } })
    }
  }

  const settingsActive = currentPath === '/settings'

  return (
    <header className="flex items-center justify-between border-b border-border-subtle bg-root px-5 py-2">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="text-[15px] font-semibold tracking-tight text-accent hover:opacity-80"
        >
          OdooSeek
        </Link>

        {isAuthenticated && (
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                currentPath === '/'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary'
              }`}
            >
              <Home className="h-4 w-4" />
            </Link>

            <div ref={appsRef} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setAppsOpen(!appsOpen)
                }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              >
                <span>{currentApp?.name ?? t('nav.apps')}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${appsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {appsOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
                  {apps.map((app) => (
                    <button
                      key={String(app.id)}
                      type="button"
                      onClick={() => handleAppClick(app)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-hover/50 ${
                        currentAppId === app.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                      }`}
                    >
                      {app.webIconData ? (
                        <img
                          src={app.webIconData}
                          alt=""
                          className="h-6 w-6 rounded object-contain"
                        />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-bold text-accent">
                          {app.name.charAt(0)}
                        </span>
                      )}
                      <span className="font-medium">{app.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sections.length > 0 && (
              <div className="ml-2 flex items-center gap-0.5 border-l border-border-subtle pl-2">
                {sections.map((section) => (
                  <div key={section.id} className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSectionClick(section)
                      }}
                      className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                        section.children.length > 0 && section.actionID === false
                          ? 'text-text-secondary hover:bg-hover hover:text-text-primary'
                          : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                      }`}
                    >
                      {section.name}
                    </button>

                    {openSubmenu === section.id && section.children.length > 0 && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-border-subtle bg-surface shadow-lg">
                        {section.children.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (sub.actionID) {
                                navigate({ to: '/web', search: { action: sub.actionID } })
                              }
                              setOpenSubmenu(null)
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-hover/50"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isAuthenticated ? (
          <>
            <span className="px-2.5 py-1.5 text-xs text-text-secondary">
              {session.name ?? session.username ?? t('nav.user')}
            </span>
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              onClick={() => {
                fetch('/api/session/logout', { method: 'POST', credentials: 'include' }).then(() =>
                  refetch(),
                )
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>{t('nav.logout')}</span>
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          >
            <LogIn className="h-4 w-4" />
            <span>{t('nav.connect')}</span>
          </Link>
        )}
        <Link
          to="/settings"
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            settingsActive
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{t('nav.settings')}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
