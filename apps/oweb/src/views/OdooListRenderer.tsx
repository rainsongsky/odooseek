import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { ChevronRight, Settings } from '@/lib/lucide-icons'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { ExportDialog } from '../components/ExportDialog'
import { Pagination } from '../components/Pagination'
import { useDialog } from '../hooks/useDialog'
import { useRecordActions } from '../hooks/useRecordActions'
import { callKw, readGroup } from '../lib/api'
import { getDecorationClass } from '../lib/expression-evaluator'
import type { FieldElement, OdooFieldMeta, ReadGroupResult, ViewField } from '../lib/odoo-types'
import { parseListXml } from '../lib/xml-parser'
import { getFieldWidget } from './field-widgets'

interface ListRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  groupBy?: string[]
  onRowClick?: (recordId: number) => void
}

interface InlineEditState {
  mode: 'idle' | 'editing' | 'creating'
  recordId?: number
  values: Record<string, unknown>
}

function viewFieldToFieldElement(vf: ViewField): FieldElement {
  return {
    type: 'field',
    name: vf.name,
    widget: vf.widget,
    string: vf.string,
    readonly: vf.readonly,
    required: vf.required,
  }
}

export function OdooListRenderer({
  model,
  arch,
  fields,
  domain = [],
  groupBy = [],
  onRowClick,
}: ListRendererProps) {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const confirmDialog = useConfirmDialog()
  const { openDialog, closeDialog } = useDialog()
  const { archive: recordArchive, unarchive: recordUnarchive } = useRecordActions(model)
  const hasActiveField = 'active' in fields
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(80)
  const [order, setOrder] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const colMenuRef = useRef<HTMLDivElement>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const listView = useMemo(() => parseListXml(arch), [arch])
  const allVisibleColumns = listView.columns.filter((c) => !c.invisible || c.invisible < 1)

  // Initialize hidden columns from optional="hide" attributes
  useEffect(() => {
    const hidden = new Set(listView.columns.filter((c) => c.optional === 'hide').map((c) => c.name))
    setHiddenCols(hidden)
  }, [listView])
  const visibleColumns = allVisibleColumns.filter((c) => !hiddenCols.has(c.name))
  const groupByActive = groupBy.length > 0
  const isEditable = !!listView.editable && !groupByActive
  const hasHandle = allVisibleColumns.some((c) => c.widget === 'handle')
  const [dragRow, setDragRow] = useState<number | null>(null)
  const [dragOverRow, setDragOverRow] = useState<number | null>(null)

  const [inlineEdit, setInlineEdit] = useState<InlineEditState>({
    mode: 'idle',
    values: {},
  })
  const [focusCol, setFocusCol] = useState(0)

  const editableColIndices = useMemo(
    () =>
      visibleColumns
        .map((col, i) => ({ col, i }))
        .filter(({ col }) => {
          const meta = fields[col.name]
          return !meta?.readonly && !col.readonly
        })
        .map(({ i }) => i),
    [visibleColumns, fields],
  )

  const moveFocus = useCallback(
    (direction: 1 | -1) => {
      setFocusCol((prev) => {
        const idx = editableColIndices.indexOf(prev)
        const next = idx + direction
        if (next < 0 || next >= editableColIndices.length) return prev
        return editableColIndices[next]
      })
    },
    [editableColIndices],
  )

  // keyboard handler is defined below after handleInlineSave/handleInlineCancel

  const {
    data: groupedData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'data', model, 'list', domain, groupBy, offset, limit, order],
    queryFn: () =>
      groupByActive
        ? readGroup<ReadGroupResult[]>(
            model,
            domain,
            visibleColumns.map((c) => c.name),
            groupBy,
          )
        : callKw<Array<Record<string, unknown>>>(
            model,
            'search_read',
            [domain, visibleColumns.map((c) => c.name)],
            {
              offset,
              limit,
              order: order || undefined,
            },
          ),
  })

  const handleSort = (fieldName: string) => {
    setOrder((prev) => {
      if (prev === fieldName) return `${fieldName} desc`
      if (prev === `${fieldName} desc`) return ''
      return fieldName
    })
    setOffset(0)
    setSelectedIds(new Set())
  }

  const sortArrow = (fieldName: string) => {
    if (order === fieldName) return ' ↑'
    if (order === `${fieldName} desc`) return ' ↓'
    return ''
  }

  const data = (groupedData ?? []) as unknown[]
  const groupData = groupByActive ? (groupedData as ReadGroupResult[] | undefined) : null

  const aggregates = useMemo(() => {
    const result: Record<string, { label: string; value: number }> = {}
    const rows = data as Array<Record<string, unknown>>
    if (!rows.length || groupData) return result
    for (const col of visibleColumns) {
      if (!col.sum) continue
      const meta = fields[col.name]
      if (!meta || !['integer', 'float', 'monetary'].includes(meta.type)) continue
      const total = rows.reduce((sum, r) => sum + (Number(r[col.name]) || 0), 0)
      result[col.name] = { label: col.sum, value: total }
    }
    return result
  }, [data, visibleColumns, fields, groupData])

  const { data: totalCount } = useQuery({
    queryKey: ['odoo', 'count', model, domain],
    queryFn: () => callKw<number>(model, 'search_count', [domain]),
    enabled: !groupByActive,
    staleTime: 30_000,
  })

  const invalidateList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['odoo', 'data', model] })
    queryClient.invalidateQueries({ queryKey: ['odoo', 'count', model] })
  }, [queryClient, model])

  const saveMutation = useMutation({
    mutationFn: ({
      mode,
      values,
      recordId,
    }: {
      mode: 'editing' | 'creating'
      values: Record<string, unknown>
      recordId?: number
    }) =>
      mode === 'editing' && recordId
        ? callKw(model, 'write', [[recordId], values])
        : callKw(model, 'create', [values]),
    onSuccess: () => {
      setInlineEdit({ mode: 'idle', values: {} })
      invalidateList()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (recordId: number) => callKw(model, 'unlink', [[recordId]]),
    onSuccess: () => invalidateList(),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => callKw(model, 'unlink', [ids]),
    onSuccess: () => {
      setSelectedIds(new Set())
      invalidateList()
    },
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: number[]) => recordArchive.mutateAsync(ids),
    onSuccess: () => {
      setSelectedIds(new Set())
      invalidateList()
    },
  })

  const bulkUnarchiveMutation = useMutation({
    mutationFn: (ids: number[]) => recordUnarchive.mutateAsync(ids),
    onSuccess: () => {
      setSelectedIds(new Set())
      invalidateList()
    },
  })

  const resequenceMutation = useMutation({
    mutationFn: ({ ids, field }: { ids: number[]; field: string }) =>
      callKw(model, 'resequence', [field, ids], {}),
    onSuccess: () => invalidateList(),
  })

  const handleDrop = useCallback(
    (fromIdx: number, toIdx: number) => {
      const rows = data as Array<Record<string, unknown>>
      const rowsCopy = [...rows]
      const [moved] = rowsCopy.splice(fromIdx, 1)
      rowsCopy.splice(toIdx, 0, moved)
      const sequenceField = visibleColumns.find((c) => c.name === 'sequence')?.name ?? 'sequence'
      const ids = rowsCopy.map((r) => r.id as number)
      resequenceMutation.mutate({ ids, field: sequenceField })
      setDragRow(null)
      setDragOverRow(null)
    },
    [data, visibleColumns, resequenceMutation],
  )

  const handleRowClick = useCallback(
    (record: Record<string, unknown>) => {
      if (!isEditable) {
        onRowClick?.(record.id as number)
        return
      }
      setInlineEdit({
        mode: 'editing',
        recordId: record.id as number,
        values: { ...record },
      })
      setFocusCol(editableColIndices[0] ?? 0)
    },
    [isEditable, onRowClick, editableColIndices],
  )

  const handleInlineChange = useCallback((fieldName: string, value: unknown) => {
    setInlineEdit((prev) => ({
      ...prev,
      values: { ...prev.values, [fieldName]: value },
    }))
  }, [])

  const handleInlineSave = useCallback(() => {
    if (inlineEdit.mode === 'idle') return
    saveMutation.mutate({
      mode: inlineEdit.mode as 'editing' | 'creating',
      values: inlineEdit.values,
      recordId: inlineEdit.recordId,
    })
  }, [inlineEdit, saveMutation])

  const handleInlineCancel = useCallback(() => {
    setInlineEdit({ mode: 'idle', values: {} })
  }, [])

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (inlineEdit.mode === 'idle') return
      if (e.key === 'Escape') {
        e.preventDefault()
        handleInlineCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleInlineSave()
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const idx = editableColIndices.indexOf(focusCol)
        if (idx < editableColIndices.length - 1) {
          moveFocus(1)
        }
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const idx = editableColIndices.indexOf(focusCol)
        if (idx > 0) {
          moveFocus(-1)
        }
      }
    },
    [
      inlineEdit.mode,
      handleInlineCancel,
      handleInlineSave,
      editableColIndices,
      focusCol,
      moveFocus,
    ],
  )

  const handleAddRow = useCallback(() => {
    const defaults: Record<string, unknown> = {}
    for (const col of visibleColumns) {
      const meta = fields[col.name]
      if (meta) defaults[col.name] = defaultForType(meta.type)
    }
    setInlineEdit({ mode: 'creating', values: defaults })
  }, [visibleColumns, fields])

  // Column management (14.1)
  const toggleColumn = useCallback((name: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  // Close column menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [colMenuOpen])

  // Group expand queries (14.2)
  const expandedGroupList = useMemo(() => [...expandedGroups], [expandedGroups])
  const expandedQueries = useQueries({
    queries: expandedGroupList.map((index) => ({
      queryKey: ['odoo', 'group-records', model, index, groupData?.[index]?.__domain, order],
      queryFn: () =>
        callKw<Array<Record<string, unknown>>>(
          model,
          'search_read',
          [groupData?.[index]?.__domain ?? [], visibleColumns.map((c) => c.name)],
          { limit: 80, order: order || undefined },
        ),
      enabled: !!groupData?.[index] && expandedGroups.has(index),
      staleTime: 30_000,
    })),
  })

  const toggleGroupExpand = useCallback((index: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // Column resize handler
  const startResize = useCallback(
    (colName: string, e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = colWidths[colName] ?? 120
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        setColWidths((prev) => ({ ...prev, [colName]: Math.max(60, startWidth + delta) }))
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [colWidths],
  )

  const handleExportClick = useCallback(() => {
    const records = data as Array<Record<string, unknown>>
    if (!records.length) return
    const dialogId = openDialog({
      size: 'lg',
      title: `Export ${listView.string || model}`,
      content: (
        <ExportDialog
          model={model}
          fields={fields}
          data={records}
          selectedIds={selectedIds.size > 0 ? selectedIds : undefined}
          onClose={() => closeDialog(dialogId)}
        />
      ),
    })
  }, [data, openDialog, closeDialog, model, listView.string, fields, selectedIds])

  const editableFieldElements = useMemo(
    () => visibleColumns.map(viewFieldToFieldElement),
    [visibleColumns],
  )

  const pageRecordIds = useMemo(
    () => (data as Array<Record<string, unknown>>).map((r) => r.id as number),
    [data],
  )

  const allSelected = pageRecordIds.length > 0 && pageRecordIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0 && !allSelected
  const [lastSelectedIdx, setLastSelectedIdx] = useState(-1)

  const { data: allMatchingIds } = useQuery({
    queryKey: ['odoo', 'allIds', model, domain],
    queryFn: () => callKw<number[]>(model, 'search', [domain]),
    enabled:
      selectedIds.size > 0 && !groupByActive && !!totalCount && selectedIds.size < totalCount,
    staleTime: 30_000,
  })

  const selectAllAcrossPages = useCallback(() => {
    if (allMatchingIds) {
      setSelectedIds(new Set(allMatchingIds))
    }
  }, [allMatchingIds])

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pageRecordIds))
    }
  }, [allSelected, pageRecordIds])

  const toggleRow = useCallback(
    (id: number, shiftKey: boolean, index: number) => {
      setSelectedIds((prev) => {
        if (shiftKey && lastSelectedIdx >= 0 && !groupByActive) {
          const rows = data as Array<Record<string, unknown>>
          const start = Math.min(lastSelectedIdx, index)
          const end = Math.max(lastSelectedIdx, index)
          const rangeIds = rows.slice(start, end + 1).map((r) => r.id as number)
          const next = new Set(prev)
          for (const rid of rangeIds) next.add(rid)
          return next
        }
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setLastSelectedIdx(index)
    },
    [data, lastSelectedIdx, groupByActive],
  )

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{listView.string || model}</h3>
          {!groupByActive && data.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportClick}
                className="rounded border border-border-default px-2 py-0.5 text-[10px] text-text-muted hover:bg-hover hover:text-text-primary"
              >
                Export
              </button>
              <div ref={colMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setColMenuOpen(!colMenuOpen)
                  }}
                  className="rounded border border-border-default p-1 text-text-muted hover:bg-hover hover:text-text-primary"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {colMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border-subtle bg-surface p-2 shadow-lg">
                    <div className="mb-1 text-[10px] font-medium uppercase text-text-muted">
                      Columns
                    </div>
                    {allVisibleColumns.map((col) => {
                      const meta = fields[col.name]
                      const label = col.string || meta?.string || col.name
                      return (
                        <label
                          key={col.name}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-text-primary hover:bg-hover"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(col.name)}
                            onChange={() => toggleColumn(col.name)}
                            className="accent-accent"
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditable && inlineEdit.mode === 'idle' && listView.create !== false && (
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90"
            >
              Add
            </button>
          )}
          <span className="text-xs text-text-muted">
            {groupByActive
              ? `${groupData?.length ?? 0} groups`
              : totalCount != null
                ? `${offset + 1}-${Math.min(offset + data.length, totalCount)} / ${totalCount}`
                : `${data.length} record${data.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : t('list.failedToLoad')}
        </div>
      )}

      {!isLoading && !error && data.length === 0 && inlineEdit.mode !== 'creating' && (
        <div className="rounded-lg border border-border-subtle bg-surface/50 py-12 text-center text-sm text-text-muted">
          {t('list.noRecords')}
        </div>
      )}

      {(!isLoading && !error && data.length > 0) || inlineEdit.mode === 'creating' ? (
        <>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2">
              <span className="text-xs font-medium text-accent">
                {selectedIds.size} selected
                {!groupByActive && !!totalCount && selectedIds.size < totalCount && (
                  <>
                    {' — '}
                    <button
                      type="button"
                      onClick={selectAllAcrossPages}
                      className="text-accent underline hover:no-underline"
                    >
                      Select all {totalCount} records
                    </button>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  confirmDialog({
                    title: 'Delete Records',
                    message: `Are you sure you want to delete ${selectedIds.size} selected record(s)?`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                    onConfirm: () => bulkDeleteMutation.mutate([...selectedIds]),
                  })
                }}
                disabled={bulkDeleteMutation.isPending}
                className="rounded border border-red-400/30 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-400/10 disabled:opacity-50"
              >
                Delete
              </button>
              {hasActiveField && (
                <button
                  type="button"
                  onClick={() => bulkArchiveMutation.mutate([...selectedIds])}
                  disabled={bulkArchiveMutation.isPending}
                  className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover disabled:opacity-50"
                >
                  Archive
                </button>
              )}
              {hasActiveField && (
                <button
                  type="button"
                  onClick={() => bulkUnarchiveMutation.mutate([...selectedIds])}
                  disabled={bulkUnarchiveMutation.isPending}
                  className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover disabled:opacity-50"
                >
                  Unarchive
                </button>
              )}
              <button
                type="button"
                onClick={handleExportClick}
                className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded px-2 py-0.5 text-[11px] text-text-muted hover:text-text-primary"
              >
                Clear
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full" onKeyDown={handleTableKeyDown}>
              <thead>
                <tr className="border-b border-border-subtle bg-surface/50">
                  <th className="w-10 px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                      onChange={toggleAll}
                      className="accent-accent"
                    />
                  </th>
                  {visibleColumns.map((col, ci) => {
                    const meta = fields[col.name]
                    const label = col.string || meta?.string || col.name
                    const width = colWidths[col.name]
                    return (
                      <th
                        key={`h-${col.name}-${ci}`}
                        onClick={() => !groupByActive && handleSort(col.name)}
                        className={`relative whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors ${!groupByActive ? 'cursor-pointer hover:text-text-primary' : ''}`}
                        style={width ? { width, minWidth: 60 } : undefined}
                      >
                        {label}
                        {!groupByActive && (
                          <span className="text-accent">{sortArrow(col.name)}</span>
                        )}
                        {!groupByActive && (
                          <div
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent/30"
                            onMouseDown={(e) => startResize(col.name, e)}
                          />
                        )}
                      </th>
                    )
                  })}
                  {isEditable && <th className="w-20 px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {inlineEdit.mode === 'creating' && (
                  <InlineEditRow
                    columns={visibleColumns}
                    fieldElements={editableFieldElements}
                    fields={fields}
                    values={inlineEdit.values}
                    onChange={handleInlineChange}
                    onSave={handleInlineSave}
                    onCancel={handleInlineCancel}
                    isSaving={saveMutation.isPending}
                  />
                )}
                {groupByActive && groupData
                  ? groupData.map((group, i) => {
                      const countKey = `${visibleColumns[0]?.name ?? 'id'}_count`
                      const count = group[countKey] ?? 0
                      const isExpanded = expandedGroups.has(i)
                      const queryIdx = expandedGroupList.indexOf(i)
                      const groupRecords =
                        queryIdx >= 0 ? expandedQueries[queryIdx]?.data : undefined
                      return (
                        <React.Fragment key={`g-${i}`}>
                          <tr
                            onClick={() => toggleGroupExpand(i)}
                            className={`border-b border-border-subtle bg-surface/30 transition-colors hover:bg-hover/30 cursor-pointer`}
                          >
                            <td className="w-10 px-2 py-2">
                              <ChevronRight
                                className={`h-3.5 w-3.5 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </td>
                            {visibleColumns.map((col, ci) => {
                              const countColKey = `${col.name}_count`
                              const val = group[countColKey] ?? group[col.name]
                              return (
                                <td
                                  key={`gd-${col.name}-${ci}`}
                                  className="whitespace-nowrap px-4 py-2 text-sm text-text-primary"
                                >
                                  <span className="font-medium">
                                    {renderCell(val, fields[col.name])}
                                  </span>
                                  <span className="ml-1.5 rounded bg-hover px-1 py-0.5 text-[10px] text-text-muted">
                                    {String(count)}
                                  </span>
                                </td>
                              )
                            })}
                          </tr>
                          {isExpanded &&
                            groupRecords &&
                            groupRecords.length > 0 &&
                            groupRecords.map((record) => {
                              const recordId = record.id as number
                              const rowDeco = getDecorationClass(
                                listView.decorations as unknown as Record<string, unknown>,
                                record,
                              )
                              return (
                                <tr
                                  key={`gr-${recordId}`}
                                  onClick={() => handleRowClick(record)}
                                  className={[
                                    'border-b border-border-subtle bg-root/50 transition-colors hover:bg-hover/50',
                                    selectedIds.has(recordId) ? 'bg-accent/5' : '',
                                    !isEditable && onRowClick ? 'cursor-pointer' : '',
                                    rowDeco,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  <td
                                    className="w-10 px-2 py-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(recordId)}
                                      onChange={() => toggleRow(recordId, false, 0)}
                                      className="accent-accent"
                                    />
                                  </td>
                                  {visibleColumns.map((col, ci) => {
                                    const cellDeco = getDecorationClass(
                                      col as unknown as Record<string, unknown>,
                                      record,
                                    )
                                    return (
                                      <td
                                        key={`grd-${col.name}-${ci}`}
                                        className={[
                                          'whitespace-nowrap px-4 py-2 text-sm text-text-primary',
                                          cellDeco,
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                      >
                                        {renderCell(record[col.name], fields[col.name])}
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          {isExpanded && !groupRecords && (
                            <tr>
                              <td
                                colSpan={visibleColumns.length + 1}
                                className="px-4 py-2 text-center text-xs text-text-muted"
                              >
                                <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  : (data as Array<Record<string, unknown>>).map((record, i) => {
                      const recordId = record.id as number
                      const isEditing =
                        inlineEdit.mode === 'editing' && inlineEdit.recordId === recordId
                      const rowDeco = getDecorationClass(
                        listView.decorations as unknown as Record<string, unknown>,
                        record,
                      )
                      return (
                        <tr
                          key={recordId}
                          draggable={hasHandle && !isEditing}
                          onDragStart={
                            hasHandle
                              ? (e) => {
                                  setDragRow(i)
                                  e.dataTransfer.effectAllowed = 'move'
                                }
                              : undefined
                          }
                          onDragOver={
                            hasHandle
                              ? (e) => {
                                  e.preventDefault()
                                  setDragOverRow(i)
                                }
                              : undefined
                          }
                          onDragEnd={
                            hasHandle
                              ? () => {
                                  setDragRow(null)
                                  setDragOverRow(null)
                                }
                              : undefined
                          }
                          onDrop={
                            hasHandle
                              ? () => {
                                  if (dragRow !== null && dragRow !== i) handleDrop(dragRow, i)
                                }
                              : undefined
                          }
                          onClick={() => !isEditing && handleRowClick(record)}
                          className={[
                            'border-b border-border-subtle transition-colors hover:bg-hover/50',
                            isEditing ? 'bg-accent/5' : '',
                            selectedIds.has(recordId) ? 'bg-accent/5' : '',
                            !isEditable && onRowClick ? 'cursor-pointer' : '',
                            isEditable ? 'cursor-pointer' : '',
                            dragOverRow === i && dragRow !== null
                              ? 'border-t-2 border-t-accent'
                              : '',
                            i === data.length - 1 && inlineEdit.mode !== 'creating'
                              ? 'border-b-0'
                              : '',
                            rowDeco,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <td className="w-10 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(recordId)}
                              onChange={() => toggleRow(recordId, false, i)}
                              onClick={(e) => toggleRow(recordId, e.shiftKey, i)}
                              className="accent-accent"
                            />
                          </td>
                          {visibleColumns.map((col, ci) => {
                            const cellDeco = getDecorationClass(
                              col as unknown as Record<string, unknown>,
                              record,
                            )
                            const meta = fields[col.name]
                            const isReadonly = meta?.readonly || col.readonly

                            if (isEditing && !isReadonly) {
                              const Widget = getFieldWidget(
                                editableFieldElements[ci],
                                meta?.type ?? 'char',
                              )
                              return (
                                <td
                                  key={`d-${col.name}-${ci}`}
                                  className="whitespace-nowrap px-1 py-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {createElement(Widget, {
                                    field: editableFieldElements[ci],
                                    value: inlineEdit.values[col.name],
                                    onChange: (v: unknown) => handleInlineChange(col.name, v),
                                    readOnly: false,
                                    meta,
                                  })}
                                </td>
                              )
                            }

                            return (
                              <td
                                key={`d-${col.name}-${ci}`}
                                className={[
                                  'whitespace-nowrap px-4 py-2 text-sm text-text-primary',
                                  cellDeco,
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {renderCell(record[col.name], fields[col.name])}
                              </td>
                            )
                          })}
                          {isEditing && (
                            <td
                              className="flex items-center gap-1 px-2 py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={handleInlineSave}
                                disabled={saveMutation.isPending}
                                className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                              >
                                {saveMutation.isPending ? '...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleInlineCancel}
                                className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover"
                              >
                                Cancel
                              </button>
                            </td>
                          )}
                          {isEditable && !isEditing && (
                            <td
                              className="px-2 py-1 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {listView.delete !== false && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    confirmDialog({
                                      title: 'Delete Record',
                                      message: 'Are you sure you want to delete this record?',
                                      confirmLabel: 'Delete',
                                      variant: 'danger',
                                      onConfirm: () => deleteMutation.mutate(recordId),
                                    })
                                  }}
                                  className="text-xs text-text-muted hover:text-red-500"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
              </tbody>
              {Object.keys(aggregates).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border-subtle bg-surface/50 font-semibold">
                    <td className="w-10 px-2 py-2" />
                    {visibleColumns.map((col) => {
                      const agg = aggregates[col.name]
                      if (!agg) return <td key={`f-${col.name}`} className="px-4 py-2" />
                      const meta = fields[col.name]
                      const formatted =
                        meta?.type === 'integer'
                          ? String(Math.round(agg.value))
                          : agg.value.toFixed(2).replace(/\.00$/, '')
                      return (
                        <td
                          key={`f-${col.name}`}
                          className="whitespace-nowrap px-4 py-2 text-sm text-text-primary"
                        >
                          {agg.label}: {formatted}
                        </td>
                      )
                    })}
                    {isEditable && <td className="w-20 px-2 py-2" />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!groupByActive && totalCount != null && (
            <Pagination
              offset={offset}
              total={totalCount}
              limit={limit}
              onPageChange={setOffset}
              onLimitChange={(newLimit) => {
                setLimit(newLimit)
                setOffset(0)
              }}
            />
          )}
        </>
      ) : null}
    </div>
  )
}

function InlineEditRow({
  columns,
  fieldElements,
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  columns: ViewField[]
  fieldElements: FieldElement[]
  fields: Record<string, OdooFieldMeta>
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  return (
    <tr className="border-b border-border-subtle bg-accent/5">
      <td className="w-10 px-2 py-2" />
      {columns.map((col, ci) => {
        const meta = fields[col.name]
        const isReadonly = meta?.readonly || col.readonly
        const Widget = getFieldWidget(fieldElements[ci], meta?.type ?? 'char')
        return (
          <td key={`new-${col.name}-${ci}`} className="whitespace-nowrap px-1 py-0.5">
            {createElement(Widget, {
              field: fieldElements[ci],
              value: values[col.name],
              onChange: (v: unknown) => onChange(col.name, v),
              readOnly: isReadonly,
              meta,
            })}
          </td>
        )
      })}
      <td className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {isSaving ? '...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover"
        >
          Cancel
        </button>
      </td>
    </tr>
  )
}

function defaultForType(type: string): unknown {
  if (type === 'boolean') return false
  if (type === 'integer' || type === 'float' || type === 'monetary') return 0
  return false
}

function renderCell(value: unknown, meta?: OdooFieldMeta): string {
  if (value === null || value === undefined || value === false) return ''
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (typeof value === 'string') {
    if (meta?.type === 'binary' || (value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value))) {
      return '📎 File'
    }
    if (meta?.selection) {
      const pair = meta.selection.find(([k]) => k === value)
      if (pair) return pair[1]
    }
    return value
  }
  if (typeof value === 'number') {
    if (meta?.type === 'monetary') return value.toFixed(2)
    return String(value)
  }

  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    return value[1] ? String(value[1]) : `#${value[0]}`
  }

  if (Array.isArray(value) && value.length > 2) {
    const count = Math.floor(value.length / 2)
    return `${count} record${count !== 1 ? 's' : ''}`
  }

  return JSON.stringify(value)
}
