import { Columns3, LayoutList, Table } from '@/lib/lucide-icons'

interface ViewSwitcherProps {
  currentView: 'list' | 'form' | 'kanban'
  onSwitch: (view: 'list' | 'form' | 'kanban') => void
}

const VIEWS: {
  type: 'list' | 'form' | 'kanban'
  icon: React.ComponentType<{ className?: string }>
  label: string
}[] = [
  { type: 'list', icon: Table, label: 'List' },
  { type: 'form', icon: LayoutList, label: 'Form' },
  { type: 'kanban', icon: Columns3, label: 'Kanban' },
]

export function OdooViewSwitcher({ currentView, onSwitch }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border-subtle bg-surface/30 px-4 py-1.5">
      {VIEWS.map((v) => {
        const active = currentView === v.type
        const Icon = v.icon
        return (
          <button
            key={v.type}
            type="button"
            onClick={() => onSwitch(v.type)}
            className={`flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
