import { useSearch } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { OdooViewLoader } from '../views/OdooViewLoader'
import { OdooViewSwitcher } from '../views/OdooViewSwitcher'

interface WebSearch {
  model?: string
  viewType?: string
}

function WebPage() {
  const search = useSearch({ from: '/web' }) as WebSearch
  const model = search.model ?? 'res.partner'
  const [viewType, setViewType] = useState<'list' | 'form' | 'kanban'>(
    (search.viewType as 'list' | 'form' | 'kanban') ?? 'list',
  )
  const [recordId, setRecordId] = useState<number | undefined>()

  const handleRowClick = useCallback((id: number) => {
    setRecordId(id)
    setViewType('form')
  }, [])

  const handleSwitchView = useCallback((v: 'list' | 'form' | 'kanban') => {
    setViewType(v)
    if (v === 'list') setRecordId(undefined)
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <OdooViewSwitcher currentView={viewType} onSwitch={handleSwitchView} />
      <OdooViewLoader
        model={model}
        viewType={viewType}
        recordId={recordId}
        onRowClick={handleRowClick}
      />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/web')({
  component: WebPage,
  validateSearch: (search: Record<string, unknown>) => search,
})
