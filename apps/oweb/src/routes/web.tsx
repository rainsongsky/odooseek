import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { resolveAction } from '../lib/api'
import { OdooViewLoader } from '../views/OdooViewLoader'

interface WebSearch {
  model?: string
  action?: number
  viewType?: string
}

type ViewType = 'list' | 'form' | 'kanban' | 'pivot' | 'graph' | 'calendar'

function WebPage() {
  const search = useSearch({ from: '/web' }) as WebSearch
  const [viewType, setViewType] = useState<ViewType>(
    (search.viewType as ViewType) ?? 'list',
  )
  const [recordId, setRecordId] = useState<number | undefined>()

  const { data: actionData, isLoading: resolvingAction } = useQuery({
    queryKey: ['odoo', 'action', search.action],
    queryFn: () => resolveAction(search.action!),
    enabled: !!search.action && !search.model,
    staleTime: 15 * 60_000,
  })

  const model = search.model ?? actionData?.model ?? 'res.partner'
  const actionViewModes = actionData?.viewMode

  const availableViews = useMemo(() => {
    if (!actionViewModes) return undefined
    return actionViewModes.split(',').map((v) => v.trim() as ViewType).filter((v) => ['list','form','kanban','pivot','graph','calendar'].includes(v))
  }, [actionViewModes])

  // Use first available view mode as default when resolving action
  const defaultView = availableViews?.[0] ?? 'list'
  const effectiveViewType = viewType ?? defaultView

  const handleRowClick = useCallback((id: number) => {
    setRecordId(id)
    setViewType('form')
  }, [])

  const handleSwitchView = useCallback((v: ViewType) => {
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

  if (resolvingAction) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <OdooViewLoader
        model={model}
        viewType={effectiveViewType}
        recordId={recordId}
        availableViews={availableViews}
        onRowClick={handleRowClick}
        onBackToList={handleBackToList}
        onSwitchView={handleSwitchView}
        onCreateClick={handleCreateClick}
        onRecordCreated={handleRecordCreated}
      />
    </div>
  )
}

export const Route = createFileRoute('/web')({
  component: WebPage,
  validateSearch: (search: Record<string, unknown>) => search,
})
