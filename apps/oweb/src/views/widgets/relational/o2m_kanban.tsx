/* biome-disable lint/a11y/noStaticElementInteractions: kanban cards use conditional role */
/* biome-disable lint/security/noDangerouslySetInnerHtml: Odoo kanban templates are server-sanitized */
import type { OdooFieldMeta } from '@odooseek/odoo-client'
import { callKw } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { renderO2mCellText } from './shared'

interface O2mKanbanProps {
  relation: string
  ids: number[]
  template: string
  templateFields: string[]
  fields: Record<string, OdooFieldMeta>
  readOnly?: boolean
  canCreate?: boolean
  canDelete?: boolean
  onAdd: () => void
  onDelete: (recordId: number) => void
  onClick?: (recordId: number) => void
}

export function O2mKanbanView({
  relation,
  ids,
  template,
  templateFields,
  fields,
  readOnly,
  canCreate,
  canDelete,
  onAdd,
  onDelete,
  onClick,
}: O2mKanbanProps) {
  const { data: records, isLoading } = useQuery({
    queryKey: ['odoo', 'read', relation, ids, templateFields],
    queryFn: () => callKw<Array<Record<string, unknown>>>(relation, 'read', [ids, templateFields]),
    enabled: ids.length > 0,
  })

  const renderedCards = useMemo(() => {
    if (!records) return []
    return records.map((record) => renderKanbanTemplate(template, record, fields))
  }, [records, template, fields])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-subtle">
      {records && records.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record, idx) => (
            <div
              key={String(record.id)}
              role={onClick ? 'button' : 'group'}
              tabIndex={onClick ? 0 : undefined}
              onClick={onClick ? () => onClick(record.id as number) : undefined}
              onKeyDown={
                onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onClick(record.id as number)
                      }
                    }
                  : undefined
              }
              className={`group relative rounded-lg border border-border-subtle bg-surface p-3 text-left text-sm${onClick ? ' cursor-pointer transition-colors hover:border-border-default' : ''}`}
            >
              <div
                className="o2m-kanban-content"
                dangerouslySetInnerHTML={{ __html: renderedCards[idx] }}
              />
              {!readOnly && canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(record.id as number)
                  }}
                  className="absolute right-1 top-1 rounded p-1 text-xs text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-text-muted">No records</div>
      )}
      {!readOnly && canCreate && (
        <div className="border-t border-border-subtle px-3 py-1.5">
          <button
            type="button"
            onClick={onAdd}
            className="text-xs font-medium text-accent hover:text-accent/80"
          >
            Add a card
          </button>
        </div>
      )}
    </div>
  )
}

function renderKanbanTemplate(
  template: string,
  record: Record<string, unknown>,
  fields: Record<string, OdooFieldMeta>,
): string {
  return template.replace(
    /<field\s+name="([^"]+)"(?:\s+widget="([^"]*)")?\s*\/?\s*>/g,
    (_match, fieldName: string, _widget?: string) => {
      const value = record[fieldName]
      const meta = fields[fieldName]
      const text = renderO2mCellText(value, meta)
      return `<span class="o_field o_field_${meta?.type ?? 'char'}">${escapeHtml(text)}</span>`
    },
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
