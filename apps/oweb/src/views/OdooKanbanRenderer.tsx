import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { callKw } from '../lib/api'
import type { OdooFieldMeta, ViewField } from '../lib/odoo-types'
import { parseKanbanFields, parseKanbanXml } from '../lib/xml-parser'
import { getFieldWidget } from './field-widgets'

interface KanbanRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  onRecordClick?: (id: number) => void
}

export function OdooKanbanRenderer({
  model,
  arch,
  fields,
  domain = [],
  onRecordClick,
}: KanbanRendererProps) {
  const queryClient = useQueryClient()
  const kanbanView = useMemo(() => parseKanbanXml(arch), [arch])
  const cardFields = useMemo(
    () => (kanbanView.template ? parseKanbanFields(kanbanView.template) : []),
    [kanbanView.template],
  )
  const groupBy = kanbanView.defaultGroupBy ?? 'stage_id'

  // 1. Fetch all records
  const { data: records, isLoading } = useQuery({
    queryKey: ['odoo', 'kanban', model, domain, groupBy],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'search_read', [[domain], kanbanView.fields], {
        limit: 200,
      }),
  })

  // 2. Fetch stages for column headers
  const { data: stages } = useQuery({
    queryKey: ['odoo', 'stages'],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(
        'crm.stage',
        'search_read',
        [[], ['name', 'sequence', 'color']],
        { order: 'sequence' },
      ),
    enabled: groupBy === 'stage_id',
  })

  // 3. Group records by groupBy field
  const groups = useMemo(() => {
    const map = new Map<number, Record<string, unknown>[]>()
    if (!records) return map
    for (const r of records) {
      const stageVal = r[groupBy] as [number, string] | number | undefined
      const stageId =
        Array.isArray(stageVal) ? stageVal[0] : typeof stageVal === 'number' ? stageVal : 0
      if (!map.has(stageId)) map.set(stageId, [])
      map.get(stageId)!.push(r)
    }
    return map
  }, [records, groupBy])

  // Column order: follow stage sequence if available, else group IDs
  const columnOrder = useMemo(() => {
    if (stages?.length) return stages.map((s) => s.id as number)
    return [...groups.keys()].sort()
  }, [stages, groups])

  const handleDragEnd = async (recordId: number, newStageId: number) => {
    // Optimistic update
    queryClient.setQueryData(['odoo', 'kanban', model, domain, groupBy], (old: Record<string, unknown>[] | undefined) => {
      if (!old) return old
      return old.map((r) => {
        const currentStage = r[groupBy]
        const currentStageId = Array.isArray(currentStage) ? currentStage[0] : currentStage
        if (r.id === recordId) {
          return { ...r, [groupBy]: [newStageId, ''] }
        }
        return r
      })
    })

    // Server update
    await callKw(model, 'write', [[recordId], { [groupBy]: newStageId }]).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['odoo', 'kanban', model, domain, groupBy] })
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {columnOrder.map((colId) => {
        const colRecords = groups.get(colId) ?? []
        const stageName =
          stages?.find((s) => s.id === colId)?.name ?? (colRecords[0]?.[groupBy] as [number, string])?.[1] ?? `#${colId}`

        return (
          <KanbanColumn
            key={colId}
            stageId={colId}
            title={String(stageName)}
            count={colRecords.length}
            records={colRecords}
            cardFields={cardFields}
            fields={fields}
            onRecordClick={onRecordClick}
            onDrop={handleDragEnd}
          />
        )
      })}
    </div>
  )
}

function KanbanColumn({
  title,
  stageId,
  count,
  records,
  cardFields,
  fields,
  onRecordClick,
  onDrop,
}: {
  title: string
  stageId: number
  count: number
  records: Record<string, unknown>[]
  cardFields: ViewField[]
  fields: Record<string, OdooFieldMeta>
  onRecordClick?: (id: number) => void
  onDrop: (recordId: number, newStageId: number) => void
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col rounded-lg border border-border-subtle bg-surface/30">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">{count}</span>
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto p-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const recordId = Number(e.dataTransfer.getData('recordId'))
          if (recordId) onDrop(recordId, stageId)
        }}
      >
        {records.map((record) => (
          <KanbanCard
            key={record.id as number}
            record={record}
            cardFields={cardFields}
            fields={fields}
            onClick={onRecordClick}
          />
        ))}
      </div>
    </div>
  )
}

function KanbanCard({
  record,
  cardFields,
  fields,
  onClick,
}: {
  record: Record<string, unknown>
  cardFields: ViewField[]
  fields: Record<string, OdooFieldMeta>
  onClick?: (id: number) => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('recordId', String(record.id))}
      onClick={() => onClick?.(record.id as number)}
      className="cursor-pointer rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:border-border-default"
    >
      {cardFields.map((f) => {
        const meta = fields[f.name]
        if (!meta) return null
        if (f.invisible && f.invisible >= 1) return null
        const Widget = getFieldWidget({ type: 'field', name: f.name, widget: f.widget }, meta.type)
        return (
          <div key={f.name}>
            <Widget
              field={{ type: 'field', name: f.name, widget: f.widget }}
              value={record[f.name]}
              onChange={() => {}}
              readOnly
            />
          </div>
        )
      })}
      {cardFields.length === 0 && (
        <span className="text-sm font-medium text-text-primary">{record.name as string}</span>
      )}
    </div>
  )
}
