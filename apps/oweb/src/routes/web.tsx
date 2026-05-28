import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { OdooViewLoader } from '../views/OdooViewLoader'
import { OdooViewSwitcher } from '../views/OdooViewSwitcher'

interface WebSearch {
  model?: string
  viewType?: string
}

function WebPage() {
  const search = useSearch({ from: '/web' }) as WebSearch
  const model = search.model ?? 'res.partner'
  const [viewType, setViewType] = useState<string>(search.viewType ?? 'list')

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <OdooViewSwitcher
        currentView={viewType as 'list' | 'form' | 'kanban'}
        onSwitch={setViewType}
      />
      <OdooViewLoader model={model} viewType={viewType as 'list' | 'form' | 'kanban'} />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/web')({
  component: WebPage,
  validateSearch: (search: Record<string, unknown>) => search,
})
