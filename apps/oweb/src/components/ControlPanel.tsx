import type { ViewToolbar, ViewType } from '@odooseek/odoo-client'
import { useState } from 'react'
import { ChevronDown, Filter } from '@/lib/lucide-icons'
import { OdooViewSwitcher } from '../views/OdooViewSwitcher'
import { Breadcrumbs } from './Breadcrumbs'
import { Pagination } from './Pagination'
import { SearchBar, type SearchBarProps } from './SearchBar'

interface BreadcrumbProps {
  model: string
  viewType: string
  viewTitle?: string
  recordName?: string
  onBackToList?: () => void
}

interface PagerProps {
  offset: number
  total: number
  limit: number
  onPageChange: (offset: number) => void
  onLimitChange: (limit: number) => void
}

export interface ControlPanelProps {
  breadcrumbs?: BreadcrumbProps
  searchProps?: SearchBarProps & { visible?: boolean }
  pagerProps?: PagerProps & { visible?: boolean }
  toolbar?: ViewToolbar
  model?: string
  selectedIds?: number[]
  currentView?: ViewType
  availableViews?: ViewType[]
  onSwitchView?: (v: ViewType) => void
  onCreateClick?: () => void
  showCreate?: boolean
  // Record actions for Action menu
  onDuplicate?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete?: () => void
  hasActiveField?: boolean
  // Callbacks for toolbar actions
  onPrintAction?: (actionId: number) => void
  onActionExecuted?: (actionId: number) => void
  onImport?: () => void
  onExport?: () => void
  /** Mobile drawer toggle for left SearchPanel (visible only below md). */
  searchPanelToggle?: { visible: boolean; open: boolean; onToggle: () => void }
}

export function ControlPanel({
  breadcrumbs,
  searchProps,
  pagerProps,
  toolbar,
  currentView,
  availableViews,
  onSwitchView,
  onCreateClick,
  showCreate = false,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  hasActiveField,
  onPrintAction,
  onActionExecuted,
  onImport,
  onExport,
  selectedIds,
  searchPanelToggle,
}: ControlPanelProps) {
  const [openMenu, setOpenMenu] = useState<'print' | 'action' | null>(null)

  const hasPrint = (toolbar?.print?.length ?? 0) > 0
  const hasAction =
    (toolbar?.action?.length ?? 0) > 0 ||
    !!onDuplicate ||
    !!onArchive ||
    !!onUnarchive ||
    !!onDelete
  const showMenus = hasPrint || hasAction
  const showSearch = searchProps?.visible !== false && searchProps
  const showPager = pagerProps?.visible !== false && pagerProps
  const showViewSwitcher = !!onSwitchView && !!availableViews

  const handlePrintAction = (actionId: number) => {
    onPrintAction?.(actionId)
    setOpenMenu(null)
  }

  const handleActionExecuted = (actionId: number) => {
    onActionExecuted?.(actionId)
    setOpenMenu(null)
  }

  return (
    <div className="flex shrink-0 flex-col">
      {/* Row 1: Breadcrumbs (left) + View Switcher + Menus + Create (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface/30 px-4 py-0">
        {breadcrumbs && (
          <Breadcrumbs
            model={breadcrumbs.model}
            viewType={breadcrumbs.viewType}
            viewTitle={breadcrumbs.viewTitle}
            recordName={breadcrumbs.recordName}
            onBackToList={breadcrumbs.onBackToList}
          />
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {showMenus && (
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
                      {toolbar?.print.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handlePrintAction(a.id)}
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
                      {toolbar?.action?.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => handleActionExecuted(a.id)}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                        >
                          {a.name}
                        </button>
                      ))}
                      {onDuplicate && (
                        <button
                          type="button"
                          onClick={() => {
                            onDuplicate()
                            setOpenMenu(null)
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                        >
                          Duplicate
                        </button>
                      )}
                      {onArchive && (
                        <button
                          type="button"
                          onClick={() => {
                            onArchive()
                            setOpenMenu(null)
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                        >
                          Archive
                        </button>
                      )}
                      {onUnarchive && hasActiveField && (
                        <button
                          type="button"
                          onClick={() => {
                            onUnarchive()
                            setOpenMenu(null)
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary hover:bg-hover/50"
                        >
                          Unarchive
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            onDelete()
                            setOpenMenu(null)
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-danger hover:bg-danger/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {showCreate && onCreateClick && currentView !== 'form' && (
            <button
              type="button"
              onClick={onCreateClick}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent/90"
            >
              Create
            </button>
          )}
          {onImport && currentView !== 'form' && (
            <button
              type="button"
              onClick={onImport}
              className="rounded-lg border border-border-default px-3 py-1 text-xs font-medium text-text-secondary hover:bg-hover"
            >
              Import
            </button>
          )}
          {onExport && currentView !== 'form' && (
            <button
              type="button"
              onClick={onExport}
              className="rounded-lg border border-border-default px-3 py-1 text-xs font-medium text-text-secondary hover:bg-hover"
            >
              Export
            </button>
          )}
          {showViewSwitcher && (
            <OdooViewSwitcher
              currentView={currentView ?? 'list'}
              onSwitch={onSwitchView}
              availableViews={availableViews}
            />
          )}
        </div>
      </div>

      {/* Row 2: Search bar (full width, only when visible) */}
      {showSearch && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border-subtle p-4">
          {searchPanelToggle?.visible && (
            <button
              type="button"
              onClick={searchPanelToggle.onToggle}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium md:hidden ${
                searchPanelToggle.open
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border-default text-text-secondary hover:bg-hover'
              }`}
              aria-expanded={searchPanelToggle.open}
              aria-label="Toggle category filters"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
            </button>
          )}
          <div className="min-w-0 flex-1">
            <SearchBar
              onSearch={searchProps.onSearch}
              onGroupByChange={searchProps.onGroupByChange}
              placeholder={searchProps.placeholder}
              searchFields={searchProps.searchFields}
              filters={searchProps.filters}
              groupByFilters={searchProps.groupByFilters}
              model={searchProps.model}
            />
          </div>
        </div>
      )}

      {/* Row 3: Pager (left) + Selection info (right) */}
      {showPager && (
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
          <Pagination
            offset={pagerProps?.offset}
            total={pagerProps?.total}
            limit={pagerProps?.limit}
            onPageChange={pagerProps?.onPageChange}
            onLimitChange={pagerProps?.onLimitChange}
          />
          {selectedIds && selectedIds.length > 0 && (
            <span className="text-xs text-text-muted">{selectedIds.length} selected</span>
          )}
        </div>
      )}
    </div>
  )
}
