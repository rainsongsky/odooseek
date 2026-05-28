import { useSearch } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { OdooViewLoader } from '../views/OdooViewLoader'

interface WebSearch {
  model?: string
  viewType?: string
}

function WebPage() {
  const search = useSearch({ from: '/web' }) as WebSearch
  const model = search.model ?? 'res.partner'
  const [viewType, setViewType] = useState<'list' | 'form' | 'kanban' | 'pivot'>(
    (search.viewType as 'list' | 'form' | 'kanban' | 'pivot') ?? 'list',
  )
  const [recordId, setRecordId] = useState<number | undefined>()

  const handleRowClick = useCallback((id: number) => {
    setRecordId(id)
    setViewType('form')
  }, [])

  const handleSwitchView = useCallback((v: 'list' | 'form' | 'kanban' | 'pivot') => {
    setViewType(v)
    if (v !== 'form') setRecordId(undefined)
  }, [])

  const handleBackToList = useCallback(() => {
    setViewType('list')
    setRecordId(undefined)
  }, [])

  const handleCreateClick = useCallback(() => {
    setViewType('form')
    setRecordId(undefined)
  }, [])

  const handleRecordCreated = useCallback((newId: number) => {
    setRecordId(newId)
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <OdooViewLoader
        model={model}
        viewType={viewType}
        recordId={recordId}
        onRowClick={handleRowClick}
        onBackToList={handleBackToList}
        onSwitchView={handleSwitchView}
        onCreateClick={handleCreateClick}
        onRecordCreated={handleRecordCreated}
      />
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/web')({
  component: WebPage,
  validateSearch: (search: Record<string, unknown>) => search,
})
