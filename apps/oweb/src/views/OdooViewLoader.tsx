import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { SearchBar } from '../components/SearchBar'
import { callKw } from '../lib/api'
import type { OdooFieldMeta } from '../lib/odoo-types'
import { parseSearchXml } from '../lib/xml-parser'
import { OdooFormRenderer } from './OdooFormRenderer'
import { OdooKanbanRenderer } from './OdooKanbanRenderer'
import { OdooListRenderer } from './OdooListRenderer'
import { OdooPivotRenderer } from './OdooPivotRenderer'
import { OdooViewSwitcher } from './OdooViewSwitcher'

interface ViewLoaderProps {
  model: string
  viewType: 'list' | 'form' | 'kanban' | 'pivot'
  viewId?: number
  domain?: unknown[]
  recordId?: number
  onRowClick?: (recordId: number) => void
  onBackToList?: () => void
  onSwitchView?: (v: 'list' | 'form' | 'kanban' | 'pivot') => void
  onCreateClick?: () => void
  onRecordCreated?: (newId: number) => void
}

export function OdooViewLoader({
  model,
  viewType,
  viewId,
  domain: initialDomain = [],
  recordId: _recordId,
  onRowClick,
  onBackToList,
  onSwitchView,
  onCreateClick,
  onRecordCreated,
}: ViewLoaderProps) {
  const viewsToLoad: [number | false, string][] = [
    [viewId ?? false, viewType],
    [false, 'search'], // always load search view
  ]
  const [domain, setDomain] = useState<unknown[]>(initialDomain)
  const [groupBy, setGroupBy] = useState<string[]>([])

  const {
    data: viewData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'get_views', model, viewsToLoad],
    queryFn: () =>
      callKw<{
        views: Record<string, { arch: string; id: number }>
        models: Record<string, { fields: Record<string, OdooFieldMeta> }>
      }>(model, 'get_views', [viewsToLoad], { options: { toolbar: true } }),
    staleTime: 15 * 60_000,
  })

  const { data: recordNameData } = useQuery({
    queryKey: ['odoo', 'read', model, _recordId, 'display_name'],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'read', [[_recordId], ['display_name']]),
    enabled: viewType === 'form' && !!_recordId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
        Failed to load view: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  const activeView = viewData?.views?.[viewType]
  const searchView = viewData?.views?.search
  const modelData = viewData?.models?.[model]
  const fields: Record<string, OdooFieldMeta> = modelData?.fields ?? {}
  const searchData = searchView ? parseSearchXml(searchView.arch) : null

  if (!activeView) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
        View not found: {model}.{viewType}
      </div>
    )
  }

  const handleSearch = (newDomain: unknown[]) => {
    setDomain(newDomain)
  }

  const handleGroupByChange = (groupBys: string[]) => {
    setGroupBy(groupBys)
  }

  const arch = activeView?.arch ?? ''
  const viewTitle = arch.match(/<[^ ]+\s+[^>]*string\s*=\s*"([^"]+)"/i)?.[1] || undefined
  const recordName = (recordNameData?.[0]?.display_name as string) || undefined

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface/30 px-4 py-0">
        <Breadcrumbs
          model={model}
          viewType={viewType}
          viewTitle={viewTitle}
          recordName={recordName}
          onBackToList={onBackToList}
        />
        <div className="flex items-center gap-2">
          {viewType !== 'form' && onCreateClick && (
            <button
              type="button"
              onClick={onCreateClick}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90"
            >
              Create
            </button>
          )}
          {onSwitchView && <OdooViewSwitcher currentView={viewType} onSwitch={onSwitchView} />}
        </div>
      </div>
      {(viewType === 'list' || viewType === 'kanban' || viewType === 'pivot') && (
        <div className="border-b border-border-subtle p-4">
          <SearchBar
            onSearch={handleSearch}
            onGroupByChange={handleGroupByChange}
            placeholder={`Search ${model}...`}
            searchFields={searchData?.fields}
            filters={searchData?.filters}
            groupByFilters={searchData?.groupByFilters}
          />
        </div>
      )}
      {viewType === 'list' && (
        <OdooListRenderer
          model={model}
          arch={activeView.arch}
          fields={fields}
          domain={domain}
          groupBy={groupBy}
          onRowClick={onRowClick}
        />
      )}
      {viewType === 'form' && (
        <OdooFormRenderer
          model={model}
          arch={activeView.arch}
          fields={fields}
          recordId={_recordId}
          onRecordCreated={onRecordCreated}
        />
      )}
      {viewType === 'kanban' && (
        <OdooKanbanRenderer
          model={model}
          arch={activeView.arch}
          fields={fields}
          domain={domain}
          groupBy={groupBy}
          onRecordClick={onRowClick}
        />
      )}
      {viewType === 'pivot' && (
        <OdooPivotRenderer model={model} arch={activeView.arch} fields={fields} domain={domain} />
      )}
    </div>
  )
}
