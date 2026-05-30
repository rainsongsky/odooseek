import {
  BarChart3,
  CalendarDays,
  Columns3,
  LayoutList,
  Table,
  TrendingUp,
} from '@/lib/lucide-icons'
import type { ViewType } from '../lib/odoo-types'
import { prefetchView } from './OdooViewLoader'

interface ViewSwitcherProps {
  currentView: ViewType
  onSwitch: (view: ViewType) => void
  availableViews?: ViewType[]
}

const VIEWS: {
  type: ViewType
  icon: React.ComponentType<{ className?: string }>
  label: string
}[] = [
  { type: 'list', icon: Table, label: 'List' },
  { type: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { type: 'pivot', icon: BarChart3, label: 'Pivot' },
  { type: 'graph', icon: TrendingUp, label: 'Graph' },
  { type: 'kanban', icon: Columns3, label: 'Kanban' },
  { type: 'form', icon: LayoutList, label: 'Form' },
]

export function OdooViewSwitcher({ currentView, onSwitch, availableViews }: ViewSwitcherProps) {
  const visible = (
    availableViews ? VIEWS.filter((v) => availableViews.includes(v.type)) : VIEWS
  ).filter((v) => v.type !== 'form')
  return (
    <div className="flex items-center justify-end gap-1">
      {visible.map((v) => {
        const active = currentView === v.type
        const Icon = v.icon
        return (
          <button
            key={v.type}
            type="button"
            onClick={() => onSwitch(v.type)}
            onMouseEnter={() => prefetchView(v.type)}
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
