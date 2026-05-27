import { useQuery } from '@tanstack/react-query'

interface MenuItem {
  id: number
  name: string
  action?: string
  sequence: number
  web_icon?: string
}

export function MenuPage() {
  const { data: menus, isLoading } = useQuery({
    queryKey: ['odoo', 'menu'],
    queryFn: async () => {
      const res = await fetch('/api/menu', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load menu')
      return res.json() as Promise<MenuItem[]>
    },
    staleTime: 15 * 60_000,
    retry: false,
  })

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h2 className="mb-6 text-2xl font-semibold text-text-primary">Applications</h2>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {menus?.map((menu) => (
          <div
            key={menu.id}
            className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-6 text-left"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <span className="text-xl font-semibold">{menu.name[0]}</span>
            </div>
            <span className="text-sm font-medium text-text-primary">{menu.name}</span>
            <span className="text-[10px] text-text-muted">{menu.action ?? 'No action'}</span>
          </div>
        ))}
      </div>

      {menus?.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          No applications available
        </div>
      )}
    </div>
  )
}
