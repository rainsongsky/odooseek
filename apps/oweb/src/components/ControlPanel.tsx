import { useState } from 'react'
import { ChevronDown } from '@/lib/lucide-icons'
import type { ViewToolbar } from '../lib/odoo-types'

interface ControlPanelProps {
  toolbar?: ViewToolbar
}

export function ControlPanel({ toolbar }: ControlPanelProps) {
  const [openMenu, setOpenMenu] = useState<'print' | 'action' | null>(null)

  if (!toolbar) return null
  const hasPrint = toolbar.print?.length > 0
  const hasAction = toolbar.action?.length > 0
  if (!hasPrint && !hasAction) return null

  const handleAction = (actionId: number, type: 'print' | 'action') => {
    // TODO: implement action execution (8.4 future work)
    console.info(`ControlPanel: ${type} action ${actionId} clicked`)
    setOpenMenu(null)
  }

  return (
    <div className="flex items-center gap-1">
      {hasPrint && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpenMenu(openMenu === 'print' ? null : 'print')
            }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Print
            <ChevronDown className="h-3 w-3" />
          </button>
          {openMenu === 'print' && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border-subtle bg-surface shadow-lg">
              {toolbar.print.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAction(a.id, 'print')}
                  className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {hasAction && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpenMenu(openMenu === 'action' ? null : 'action')
            }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Action
            <ChevronDown className="h-3 w-3" />
          </button>
          {openMenu === 'action' && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border-subtle bg-surface shadow-lg">
              {toolbar.action.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAction(a.id, 'action')}
                  className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
