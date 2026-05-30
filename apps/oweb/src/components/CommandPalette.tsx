import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { fetchMenus, flattenMenuItems, type MenusData } from '../lib/menu-service'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fetch menus for search
  const { data: menus } = useQuery<MenusData>({
    queryKey: ['odoo', 'menus'],
    queryFn: fetchMenus,
    enabled: open && isAuthenticated,
    staleTime: 15 * 60_000,
  })

  const commands = useMemo(() => {
    if (!menus || !query.trim()) return []
    const all = flattenMenuItems(menus, 'root')
    const q = query.toLowerCase()
    return all
      .filter(({ menu, path }) => {
        const fullPath = path.join(' / ').toLowerCase()
        return fullPath.includes(q) || menu.name.toLowerCase().includes(q)
      })
      .slice(0, 10)
      .map(({ menu, path }) => ({
        id: `menu-${menu.id}`,
        label: menu.name,
        path: path.join(' / '),
        execute: () => {
          if (menu.actionID) {
            navigate({ to: '/web', search: { action: menu.actionID } })
          }
          setOpen(false)
          setQuery('')
        },
      }))
  }, [menus, query, navigate])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[20vh]"
      onClick={() => {
        setOpen(false)
        setQuery('')
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menus..."
            autoFocus
            className="w-full border-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>
        {commands.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-1">
            {commands.map((cmd) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  onClick={cmd.execute}
                  className="flex w-full flex-col px-4 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="text-sm font-medium text-text-primary">{cmd.label}</span>
                  <span className="text-xs text-text-muted">{cmd.path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">No results</div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            Type to search menus...
          </div>
        )}
      </div>
    </div>
  )
}
