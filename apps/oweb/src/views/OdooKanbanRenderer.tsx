import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import { callKw } from '../lib/api'
import { evalCondition, getValue } from '../lib/expression-evaluator'
import type { KanbanTemplateNode, OdooFieldMeta, ViewField } from '../lib/odoo-types'
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
  const templateNodes = kanbanView.templateNodes
  const groupBy = kanbanView.defaultGroupBy ?? 'stage_id'
  const highlightColor = kanbanView.highlightColor

  // Ensure groupBy field is always included in search_read
  const searchFields = kanbanView.fields.includes(groupBy)
    ? kanbanView.fields
    : [...kanbanView.fields, groupBy]

  // 1. Fetch all records
  const { data: records, isLoading } = useQuery({
    queryKey: ['odoo', 'kanban', model, domain, groupBy],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'search_read', [domain, searchFields], {
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
            templateNodes={templateNodes}
            fields={fields}
            highlightColor={highlightColor}
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
  templateNodes,
  fields,
  highlightColor,
  onRecordClick,
  onDrop,
}: {
  title: string
  stageId: number
  count: number
  records: Record<string, unknown>[]
  cardFields: ViewField[]
  templateNodes?: KanbanTemplateNode[]
  fields: Record<string, OdooFieldMeta>
  highlightColor?: string
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
            templateNodes={templateNodes}
            fields={fields}
            highlightColor={highlightColor}
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
  templateNodes,
  fields,
  highlightColor,
  onClick,
}: {
  record: Record<string, unknown>
  cardFields: ViewField[]
  templateNodes?: KanbanTemplateNode[]
  fields: Record<string, OdooFieldMeta>
  highlightColor?: string
  onClick?: (id: number) => void
}) {
  const colorIdx = highlightColor ? Number(record[highlightColor]) : 0
  const borderColor = colorIdx > 0 ? KANBAN_COLORS[Math.min(colorIdx, KANBAN_COLORS.length - 1)] : undefined

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('recordId', String(record.id))}
      onClick={() => onClick?.(record.id as number)}
      className="cursor-pointer rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:border-border-default"
      style={borderColor ? { borderLeftWidth: 3, borderLeftColor: borderColor } : undefined}
    >
      {templateNodes && templateNodes.length > 0 ? (
        templateNodes.map((node, i) => <KanbanNode key={i} node={node} record={record} fields={fields} />)
      ) : cardFields.length > 0 ? (
        cardFields.map((f) => {
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
        })
      ) : (
        <span className="text-sm font-medium text-text-primary">{record.name as string}</span>
      )}
    </div>
  )
}

const KANBAN_COLORS = [
  '', '#a9a9a9', '#2ecc71', '#3498db', '#e67e22', '#9b59b6',
  '#1abc9c', '#f39c12', '#e74c3c', '#7f8c8d', '#0d6efd', '#d63384',
]

function KanbanNode({ node, record, fields }: {
  node: KanbanTemplateNode
  record: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
}) {
  switch (node.type) {
    case 'field': {
      const meta = fields[node.name]
      if (!meta) return null
      const Widget = getFieldWidget({ type: 'field', name: node.name, widget: node.widget }, meta.type)
      return (
        <div className={node.class}>
          <Widget
            field={{ type: 'field', name: node.name, widget: node.widget }}
            value={record[node.name]}
            onChange={() => {}}
            readOnly
          />
        </div>
      )
    }
    case 'condition': {
      if (node.if) {
        if (!evalCondition(node.if, record)) {
          // Try elif/else children
          const alt = node.children.find((c) => c.type === 'condition')
          if (alt) return <KanbanNode node={alt} record={record} fields={fields} />
          return null
        }
        return <>{node.children.filter((c) => c.type !== 'condition').map((c, i) => <KanbanNode key={i} node={c} record={record} fields={fields} />)}</>
      }
      if (node.elif) {
        if (evalCondition(node.elif, record)) {
          return <>{node.children.filter((c) => c.type !== 'condition').map((c, i) => <KanbanNode key={i} node={c} record={record} fields={fields} />)}</>
        }
        // Try next elif/else
        const next = node.children.find((c) => c.type === 'condition')
        if (next) return <KanbanNode node={next} record={record} fields={fields} />
        return null
      }
      // t-else — always true
      return <>{node.children.filter((c) => c.type !== 'condition').map((c, i) => <KanbanNode key={i} node={c} record={record} fields={fields} />)}</>
    }
    case 'loop': {
      const list = getValue(node.foreach, record)
      if (!Array.isArray(list)) return null
      return <>{list.map((item, i) => {
        const loopRecord: Record<string, unknown> = { ...record }
        if (Array.isArray(item)) {
          loopRecord[node.as] = item[1] ?? item[0]
        } else {
          loopRecord[node.as] = item
        }
        return node.children.map((c, j) => <KanbanNode key={`${i}-${j}`} node={c} record={loopRecord} fields={fields} />)
      })}</>
    }
    case 'output': {
      const val = getValue(node.expr, record)
      return <span>{val != null ? String(val) : ''}</span>
    }
    case 'html':
      return React.createElement(
        node.tag,
        { className: node.class, key: undefined },
        ...node.children.map((c, i) => <KanbanNode key={i} node={c} record={record} fields={fields} />),
      )
    case 'text':
      return <>{node.content}</>
    case 'footer':
      return (
        <div className="mt-2 border-t border-border-subtle pt-2 text-xs text-text-muted">
          {node.children.map((c, i) => <KanbanNode key={i} node={c} record={record} fields={fields} />)}
        </div>
      )
  }
}
