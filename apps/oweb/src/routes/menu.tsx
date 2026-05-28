import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { callKw } from '../lib/api'
import { useAuth } from '../lib/auth'

interface MenuItem {
  id: number
  name: string
  action?: string
  sequence: number
  web_icon?: string
}

function parseActionRef(
  action: string | undefined,
): { type: string; id: number } | null {
  if (!action || action === 'False') return null
  const parts = action.split(',')
  const actionType = parts[0]?.trim()
  const actionId = Number(parts[1]?.trim())
  if (!actionType || !actionId) return null
  return { type: actionType, id: actionId }
}

function MenuPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [expandedMenuId, setExpandedMenuId] = useState<number | null>(null)

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

  // Resolve action refs to model names
  const actWindowIds = useMemo(() => {
    const ids: number[] = []
    if (!menus) return ids
    for (const menu of menus) {
      const ref = parseActionRef(menu.action)
      if (ref?.type === 'ir.actions.act_window') ids.push(ref.id)
    }
    return [...new Set(ids)]
  }, [menus])

  const { data: actionModels } = useQuery({
    queryKey: ['odoo', 'actions', actWindowIds],
    queryFn: () =>
      callKw<Array<{ id: number; res_model: string }>>(
        'ir.actions.act_window',
        'read',
        [actWindowIds, ['res_model']],
      ),
    enabled: actWindowIds.length > 0,
    staleTime: 15 * 60_000,
  })

  const modelMap = useMemo(() => {
    const map = new Map<number, string>()
    if (actionModels) {
      for (const action of actionModels) {
        map.set(action.id, action.res_model)
      }
    }
    return map
  }, [actionModels])

  const resolveModel = (action: string | undefined): string | null => {
    const ref = parseActionRef(action)
    if (!ref) return null
    if (ref.type === 'ir.actions.act_window') {
      return modelMap.get(ref.id) ?? null
    }
    return null
  }

  // Fetch children of expanded menu
  const { data: childMenus } = useQuery({
    queryKey: ['odoo', 'menu_children', expandedMenuId],
    queryFn: () =>
      callKw<Array<MenuItem & { action?: string }>>(
        'ir.ui.menu',
        'search_read',
        [[['parent_id', '=', expandedMenuId]], ['id', 'name', 'action', 'sequence']],
        { order: 'sequence' },
      ),
    enabled: !!expandedMenuId,
  })

  // Resolve child menu actions
  const childActIds = useMemo(() => {
    const ids: number[] = []
    if (!childMenus) return ids
    for (const menu of childMenus) {
      const ref = parseActionRef(menu.action)
      if (ref?.type === 'ir.actions.act_window') ids.push(ref.id)
    }
    return [...new Set(ids)]
  }, [childMenus])

  const { data: childActionModels } = useQuery({
    queryKey: ['odoo', 'actions', childActIds],
    queryFn: () =>
      callKw<Array<{ id: number; res_model: string }>>(
        'ir.actions.act_window',
        'read',
        [childActIds, ['res_model']],
      ),
    enabled: childActIds.length > 0,
  })

  // Find first actionable model from child menus
  const resolveChildModel = (): string | null => {
    if (!childMenus || !childActionModels) return null
    const childModelMap = new Map<number, string>()
    for (const action of childActionModels) {
      childModelMap.set(action.id, action.res_model)
    }
    for (const child of childMenus) {
      const ref = parseActionRef(child.action)
      if (ref?.type === 'ir.actions.act_window' && childModelMap.has(ref.id)) {
        return childModelMap.get(ref.id) ?? null
      }
    }
    return null
  }

  const handleMenuClick = async (menu: MenuItem) => {
    const ref = parseActionRef(menu.action)
    if (!ref) {
      setExpandedMenuId(expandedMenuId === menu.id ? null : menu.id)
      return
    }

    if (ref.type === 'ir.actions.act_window') {
      const model = resolveModel(menu.action)
      if (model) navigate({ to: '/web', search: { model } })
      return
    }

    if (ref.type === 'ir.actions.server') {
      // Run server action via /web/action/run
      try {
        const result = await fetch('/api/odoo/web/action/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'call', id: 1,
            params: { action_id: ref.id },
          }),
        }).then(r => r.json())
        if (result.result?.res_model) {
          navigate({ to: '/web', search: { model: result.result.res_model } })
        } else if (result.result === false) {
          // Server action has no return action — show notification or reload
          console.log('Server action completed')
        }
      } catch (err) {
        console.error('Failed to run server action:', err)
      }
      return
    }

    // Other action types: attempt to resolve via action read
    setExpandedMenuId(expandedMenuId === menu.id ? null : menu.id)
  }

  // Navigate to first actionable child when children are loaded
  useEffect(() => {
    if (expandedMenuId && childMenus && childActionModels) {
      const childModel = resolveChildModel()
      if (childModel) {
        navigate({ to: '/web', search: { model: childModel } })
        setExpandedMenuId(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedMenuId, childMenus, childActionModels])

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
          const model = resolveModel(menu.action)
          return (
            <button
              key={menu.id}
              type="button"
              onClick={() => handleMenuClick(menu)}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-6 text-left transition-colors ${
                model ? 'hover:border-border-default hover:bg-surface' : ''
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <span className="text-xl font-semibold">{menu.name[0]}</span>
              </div>
              <span className="text-sm font-medium text-text-primary">{menu.name}</span>
              <span className="text-[10px] text-text-muted">
                {model ?? (expandedMenuId === menu.id ? 'Loading...' : 'Menu group')}
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

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/menu')({
  component: MenuPage,
})
