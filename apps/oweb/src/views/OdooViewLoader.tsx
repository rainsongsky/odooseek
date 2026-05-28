import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { callKw } from '../lib/api'
import { SearchBar } from '../components/SearchBar'
import { parseSearchXml } from '../lib/xml-parser'
import { OdooFormRenderer } from './OdooFormRenderer'
import { OdooKanbanRenderer } from './OdooKanbanRenderer'
import { OdooListRenderer } from './OdooListRenderer'
import type { OdooFieldMeta } from '../lib/odoo-types'

interface ViewLoaderProps {
  model: string
  viewType: 'list' | 'form' | 'kanban'
  viewId?: number
  domain?: unknown[]
  recordId?: number
  onRowClick?: (recordId: number) => void
}

export function OdooViewLoader({
  model,
  viewType,
  viewId,
  domain: initialDomain = [],
  recordId: _recordId,
  onRowClick,
}: ViewLoaderProps) {
  const viewsToLoad: [number | false, string][] = [
    [viewId ?? false, viewType],
    [false, 'search'], // always load search view
  ]
  const [domain, setDomain] = useState<unknown[]>(initialDomain)
  const [keyword, setKeyword] = useState('')

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

  const handleSearch = (newDomain: unknown[], kw: string) => {
    setDomain(newDomain)
    setKeyword(kw)
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {(viewType === 'list' || viewType === 'kanban') && (
        <div className="border-b border-border-subtle p-4">
          <SearchBar
            onSearch={handleSearch}
            placeholder={`Search ${model}...`}
            searchFields={searchData?.fields}
          />
          {keyword && (
            <span className="mt-1 inline-block text-xs text-text-muted">
              Filtered by: <span className="text-accent">"{keyword}"</span>
              <button
                type="button"
                onClick={() => handleSearch(initialDomain, '')}
                className="ml-2 cursor-pointer underline"
              >
                clear
              </button>
            </span>
          )}
        </div>
      )}
      {viewType === 'list' && (
        <OdooListRenderer model={model} arch={activeView.arch} fields={fields} domain={domain} onRowClick={onRowClick} />
      )}
      {viewType === 'form' && (
        <OdooFormRenderer model={model} arch={activeView.arch} fields={fields} recordId={_recordId} />
      )}
      {viewType === 'kanban' && (
        <OdooKanbanRenderer model={model} arch={activeView.arch} fields={fields} domain={domain} onRecordClick={onRowClick} />
      )}
    </div>
  )
}
