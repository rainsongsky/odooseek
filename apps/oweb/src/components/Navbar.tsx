import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { BarChart3, Home, LogIn, LogOut, Menu, Settings } from '@/lib/lucide-icons'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, shortcut: 'H' },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, shortcut: 'D' },
  { to: '/menu', label: 'Modules', icon: Menu, shortcut: 'M' },
]

export function Navbar() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (item: NavItem) => {
    if (item.to === '/') return currentPath === '/'
    return currentPath.startsWith(item.to)
  }

  const { isAuthenticated, session, refetch } = useAuth()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()

      const keyMap: Record<string, string> = {
        h: '/',
        d: '/dashboard',
        ',': '/settings',
      }
      const target = keyMap[e.key]
      if (target) {
        navigate({ to: target })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const settingsActive = currentPath === '/settings'

  return (
    <header className="flex items-center justify-between border-b border-dashed border-border-subtle bg-root px-5 py-3">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <svg className="h-7 w-7 text-accent" viewBox="0 0 32 32" fill="currentColor">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.6" />
            <circle cx="20" cy="20" r="4" fill="currentColor" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight text-accent">OdooSeek</span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                }`}
                title={`${item.label} (Ctrl+${item.shortcut})`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        {isAuthenticated ? (
          <>
            <span className="px-2.5 py-1.5 text-xs text-text-secondary">
              {session.name ?? session.username ?? 'User'}
            </span>
            <Link
              to="/login"
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              onClick={() => {
                fetch('/api/session/logout', {
                  method: 'POST',
                  credentials: 'include',
                }).then(() => refetch())
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          >
            <LogIn className="h-4 w-4" />
            <span>Connect</span>
          </Link>
        )}
        <Link
          to="/settings"
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            settingsActive
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
