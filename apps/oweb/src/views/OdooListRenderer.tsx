import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createElement, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'use-intl'
import { Pagination } from '../components/Pagination'
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
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(80)
  const [order, setOrder] = useState('')

  const listView = useMemo(() => parseListXml(arch), [arch])
  const visibleColumns = listView.columns.filter((c) => !c.invisible || c.invisible < 1)
  const groupByActive = groupBy.length > 0
  const isEditable = !!listView.editable && !groupByActive

  const [inlineEdit, setInlineEdit] = useState<InlineEditState>({
    mode: 'idle',
    values: {},
  })

  const {
    data: groupedData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['odoo', 'data', model, 'list', domain, groupBy, page, limit, order],
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
              offset: page * limit,
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
    setPage(0)
  }

  const sortArrow = (fieldName: string) => {
    if (order === fieldName) return ' ↑'
    if (order === `${fieldName} desc`) return ' ↓'
    return ''
  }

  const data = (groupedData ?? []) as unknown[]
  const groupData = groupByActive ? (groupedData as ReadGroupResult[] | undefined) : null

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
    mutationFn: ({ mode, values, recordId }: { mode: 'editing' | 'creating'; values: Record<string, unknown>; recordId?: number }) =>
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
    },
    [isEditable, onRowClick],
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

  const handleAddRow = useCallback(() => {
    const defaults: Record<string, unknown> = {}
    for (const col of visibleColumns) {
      const meta = fields[col.name]
      if (meta) defaults[col.name] = defaultForType(meta.type)
    }
    setInlineEdit({ mode: 'creating', values: defaults })
  }, [visibleColumns, fields])

  const exportCSV = useCallback(() => {
    const records = data as Array<Record<string, unknown>>
    if (!records.length) return

    const csvRows: string[] = []
    csvRows.push(
      visibleColumns
        .map((c) => {
          const meta = fields[c.name]
          return `"${c.string || meta?.string || c.name}"`
        })
        .join(','),
    )
    for (const r of records) {
      csvRows.push(
        visibleColumns
          .map((c) => {
            const v = r[c.name]
            const str = v == null ? '' : Array.isArray(v) ? (v[1] ?? v[0]) : String(v)
            return `"${String(str).replace(/"/g, '""')}"`
          })
          .join(','),
      )
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, visibleColumns, fields, model])

  const editableFieldElements = useMemo(
    () => visibleColumns.map(viewFieldToFieldElement),
    [visibleColumns],
  )

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{listView.string || model}</h3>
          {!groupByActive && data.length > 0 && (
            <button
              type="button"
              onClick={exportCSV}
              className="rounded border border-border-default px-2 py-0.5 text-[10px] text-text-muted hover:bg-hover hover:text-text-primary"
            >
              Export
            </button>
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
                ? `${page * limit + 1}-${Math.min(page * limit + data.length, totalCount)} / ${totalCount}`
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
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface/50">
                  {visibleColumns.map((col, ci) => {
                    const meta = fields[col.name]
                    const label = col.string || meta?.string || col.name
                    return (
                      <th
                        key={`h-${col.name}-${ci}`}
                        onClick={() => !groupByActive && handleSort(col.name)}
                        className={`whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors ${!groupByActive ? 'cursor-pointer hover:text-text-primary' : ''}`}
                      >
                        {label}
                        {!groupByActive && (
                          <span className="text-accent">{sortArrow(col.name)}</span>
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
                      return (
                        <tr
                          key={`g-${i}`}
                          className={`border-b border-border-subtle bg-surface/30 transition-colors hover:bg-hover/30 ${i === groupData.length - 1 ? 'border-b-0' : ''}`}
                        >
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
                      )
                    })
                  : (data as Array<Record<string, unknown>>).map((record, i) => {
                      const recordId = record.id as number
                      const isEditing = inlineEdit.mode === 'editing' && inlineEdit.recordId === recordId
                      const rowDeco = getDecorationClass(
                        listView.decorations as unknown as Record<string, unknown>,
                        record,
                      )
                      return (
                        <tr
                          key={recordId}
                          onClick={() => !isEditing && handleRowClick(record)}
                          className={[
                            'border-b border-border-subtle transition-colors hover:bg-hover/50',
                            isEditing ? 'bg-accent/5' : '',
                            !isEditable && onRowClick ? 'cursor-pointer' : '',
                            isEditable ? 'cursor-pointer' : '',
                            i === data.length - 1 && inlineEdit.mode !== 'creating' ? 'border-b-0' : '',
                            rowDeco,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {visibleColumns.map((col, ci) => {
                            const cellDeco = getDecorationClass(
                              col as unknown as Record<string, unknown>,
                              record,
                            )
                            const meta = fields[col.name]
                            const isReadonly = meta?.readonly || col.readonly

                            if (isEditing && !isReadonly) {
                              const Widget = getFieldWidget(editableFieldElements[ci], meta?.type ?? 'char')
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
                            <td className="flex items-center gap-1 px-2 py-1" onClick={(e) => e.stopPropagation()}>
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
                            <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                              {listView.delete !== false && (
                                <button
                                  type="button"
                                  onClick={() => deleteMutation.mutate(recordId)}
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
            </table>
          </div>

          {!groupByActive && totalCount != null && (
            <Pagination
              page={page}
              total={totalCount}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(newLimit) => {
                setLimit(newLimit)
                setPage(0)
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
