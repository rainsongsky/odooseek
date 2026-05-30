import { useQuery } from '@tanstack/react-query'
import { lazy, useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { ControlPanel } from '../components/ControlPanel'
import { useRecordActions } from '../hooks/useRecordActions'
import { useToast } from '../hooks/useToast'
import { callKw } from '../lib/api'
import type { OdooFieldMeta, ViewToolbar } from '../lib/odoo-types'
import { generateReport } from '../lib/report'
import { cacheKey, getCachedViews, setCachedViews } from '../lib/view-cache'
import { parseSearchXml } from '../lib/xml-parser'
import { OdooListRenderer } from './OdooListRenderer'

// Lazy-loaded views — only fetched when the user switches to that view type
const OdooFormRenderer = lazy(() =>
  import('./OdooFormRenderer').then((m) => ({ default: m.OdooFormRenderer })),
)
const OdooKanbanRenderer = lazy(() =>
  import('./OdooKanbanRenderer').then((m) => ({ default: m.OdooKanbanRenderer })),
)
const OdooPivotRenderer = lazy(() =>
  import('./OdooPivotRenderer').then((m) => ({ default: m.OdooPivotRenderer })),
)
const OdooGraphRenderer = lazy(() =>
  import('./OdooGraphRenderer').then((m) => ({ default: m.OdooGraphRenderer })),
)
const OdooCalendarRenderer = lazy(() =>
  import('./OdooCalendarRenderer').then((m) => ({ default: m.OdooCalendarRenderer })),
)

type OdooFormRendererRef = React.ComponentRef<typeof OdooFormRenderer>

// Prefetch map: preload view chunks on hover so switching is instant
const viewPrefetchers: Record<string, () => Promise<unknown>> = {
  form: () => import('./OdooFormRenderer'),
  kanban: () => import('./OdooKanbanRenderer'),
  pivot: () => import('./OdooPivotRenderer'),
  graph: () => import('./OdooGraphRenderer'),
  calendar: () => import('./OdooCalendarRenderer'),
}

export function prefetchView(type: string) {
  viewPrefetchers[type]?.()
}

type ViewType = 'list' | 'form' | 'kanban' | 'pivot' | 'graph' | 'calendar'

interface ViewLoaderProps {
  model: string
  viewType: ViewType
  viewId?: number
  domain?: unknown[]
  recordId?: number
  availableViews?: ViewType[]
  onRowClick?: (recordId: number) => void
  onBackToList?: () => void
  onSwitchView?: (v: ViewType) => void
  onCreateClick?: () => void
  onRecordCreated?: (newId: number) => void
  onDirtyChange?: (dirty: boolean) => void
  formRef?: React.Ref<OdooFormRendererRef>
}

export function OdooViewLoader({
  model,
  viewType,
  viewId,
  domain: initialDomain = [],
  recordId: _recordId,
  availableViews,
  onRowClick,
  onBackToList,
  onSwitchView,
  onCreateClick,
  onRecordCreated,
  onDirtyChange,
  formRef,
}: ViewLoaderProps) {
  const viewsToLoad = useMemo<[number | false, string][]>(
    () => [
      [viewId ?? false, viewType],
      [false, 'search'],
    ],
    [viewId, viewType],
  )
  const ck = useMemo(() => cacheKey(model, viewsToLoad), [model, viewsToLoad])
  const [domain, setDomain] = useState<unknown[]>(initialDomain)
  const [groupBy, setGroupBy] = useState<string[]>([])
  const toast = useToast()
  const { duplicate, archive, unarchive } = useRecordActions(model)

  type ViewData = {
    views: Record<string, { arch: string; id: number; toolbar?: ViewToolbar }>
    models: Record<string, { fields: Record<string, OdooFieldMeta> }>
  }

  const {
    data: viewData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'get_views', model, viewsToLoad],
    queryFn: () =>
      callKw<ViewData>(model, 'get_views', [viewsToLoad], { options: { toolbar: true } }),
    staleTime: 15 * 60_000,
    initialData: (): ViewData | undefined => (getCachedViews(ck) as ViewData | null) ?? undefined,
  })

  useEffect(() => {
    if (viewData) setCachedViews(ck, viewData)
  }, [viewData, ck])

  const { data: recordNameData } = useQuery({
    queryKey: ['odoo', 'read', model, _recordId, 'display_name'],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'read', [[_recordId], ['display_name']]),
    enabled: viewType === 'form' && !!_recordId,
    staleTime: 30_000,
  })

  const handlePrintAction = useCallback(
    async (actionId: number) => {
      try {
        const ids = _recordId ? [_recordId] : []
        await generateReport(actionId, ids.length > 0 ? ids : [0])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to generate report')
      }
    },
    [_recordId, toast],
  )

  const handleDuplicate = useCallback(() => {
    if (!_recordId) return
    duplicate.mutate(_recordId, {
      onSuccess: (newId) => {
        toast.success('Record duplicated')
        onRecordCreated?.(newId)
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to duplicate record')
      },
    })
  }, [_recordId, duplicate, toast, onRecordCreated])

  const handleArchive = useCallback(() => {
    if (!_recordId) return
    archive.mutate([_recordId], {
      onSuccess: () => {
        toast.success('Record archived')
        onBackToList?.()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to archive record')
      },
    })
  }, [_recordId, archive, toast, onBackToList])

  const handleUnarchive = useCallback(() => {
    if (!_recordId) return
    unarchive.mutate([_recordId], {
      onSuccess: () => {
        toast.success('Record unarchived')
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to unarchive record')
      },
    })
  }, [_recordId, unarchive, toast])

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
  const toolbar = activeView?.toolbar
  const hasActiveField = 'active' in fields

  const showSearch =
    viewType === 'list' ||
    viewType === 'kanban' ||
    viewType === 'pivot' ||
    viewType === 'graph' ||
    viewType === 'calendar'

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <ControlPanel
        breadcrumbs={{ model, viewType, viewTitle, recordName, onBackToList }}
        searchProps={
          showSearch
            ? {
                visible: true,
                model,
                onSearch: handleSearch,
                onGroupByChange: handleGroupByChange,
                placeholder: `Search ${model}...`,
                searchFields: searchData?.fields,
                filters: searchData?.filters,
                groupByFilters: searchData?.groupByFilters,
              }
            : { visible: false, onSearch: () => {} }
        }
        toolbar={toolbar}
        currentView={viewType}
        availableViews={availableViews}
        onSwitchView={onSwitchView}
        onCreateClick={onCreateClick}
        showCreate={!!onCreateClick}
        onPrintAction={handlePrintAction}
        model={model}
        selectedIds={_recordId ? [_recordId] : []}
        onDuplicate={viewType === 'form' && _recordId ? handleDuplicate : undefined}
        onArchive={viewType === 'form' && _recordId ? handleArchive : undefined}
        onUnarchive={viewType === 'form' && _recordId ? handleUnarchive : undefined}
        hasActiveField={hasActiveField}
      />
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
        <Suspense fallback={<ViewSkeleton />}>
          <OdooFormRenderer
            ref={formRef}
            model={model}
            arch={activeView.arch}
            fields={fields}
            recordId={_recordId}
            onRecordCreated={onRecordCreated}
            onDirtyChange={onDirtyChange}
          />
        </Suspense>
      )}
      {viewType === 'kanban' && (
        <Suspense fallback={<ViewSkeleton />}>
          <OdooKanbanRenderer
            model={model}
            arch={activeView.arch}
            fields={fields}
            domain={domain}
            groupBy={groupBy}
            onRecordClick={onRowClick}
          />
        </Suspense>
      )}
      {viewType === 'pivot' && (
        <Suspense fallback={<ViewSkeleton />}>
          <OdooPivotRenderer model={model} arch={activeView.arch} fields={fields} domain={domain} />
        </Suspense>
      )}
      {viewType === 'graph' && (
        <Suspense fallback={<ViewSkeleton />}>
          <OdooGraphRenderer model={model} arch={activeView.arch} fields={fields} domain={domain} />
        </Suspense>
      )}
      {viewType === 'calendar' && (
        <Suspense fallback={<ViewSkeleton />}>
          <OdooCalendarRenderer
            model={model}
            arch={activeView.arch}
            fields={fields}
            domain={domain}
            onRecordClick={onRowClick}
          />
        </Suspense>
      )}
    </div>
  )
}

function ViewSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  )
}
