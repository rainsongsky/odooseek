import type {
  OdooActivityData,
  OdooActivityGroupCell,
  OdooActivityTypeInfo,
  OdooFieldMeta,
  ParsedActivityView,
  ViewField,
} from '@odooseek/odoo-client'
import { callKw, parseActivityXml, read } from '@odooseek/odoo-client'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { resolveOdooImageFromRecord } from '../lib/odoo-image'

const ACTIVITY_RECORD_FILTER: unknown[] = ['activity_ids.active', 'in', [true, false]]

const STATE_CELL_CLASS: Record<string, string> = {
  planned: 'bg-emerald-600 text-white',
  today: 'bg-amber-500 text-white',
  overdue: 'bg-red-600 text-white',
  done: 'bg-gray-400 text-gray-900',
}

interface ActivityRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  onRecordClick?: (id: number) => void
}

function activityGroupFor(
  grouped: OdooActivityData['grouped_activities'],
  resId: number,
  typeId: number,
): OdooActivityGroupCell | undefined {
  const byRes = grouped[resId] ?? grouped[String(resId)]
  if (!byRes) return undefined
  return byRes[typeId] ?? byRes[String(typeId)]
}

function formatReportingDate(value: string | false | null | undefined): string {
  if (!value || typeof value !== 'string') return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

function activityCount(group: OdooActivityGroupCell): number {
  return Object.values(group.count_by_state ?? {}).reduce((sum, n) => sum + n, 0)
}

function summaryText(group: OdooActivityGroupCell): string {
  const parts = (group.summaries ?? []).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : ''
}

function ActivityRecordBox({
  model,
  record,
  boxFields,
  onClick,
}: {
  model: string
  record: Record<string, unknown>
  boxFields: ViewField[]
  onClick?: () => void
}) {
  const recordId = record.id as number
  const avatarSrc = resolveOdooImageFromRecord(record, model, recordId, ['avatar_128', 'image_128'])

  const lines =
    boxFields.length > 0
      ? boxFields.map((f) => {
          const raw = record[f.name]
          let text = ''
          if (Array.isArray(raw) && raw.length === 2) text = String(raw[1] ?? '')
          else if (raw != null && raw !== false) text = String(raw)
          return { key: f.name, text, bold: f.class?.includes('fw-bold') || f.name === 'name' }
        })
      : [
          {
            key: 'name',
            text: String(record.display_name ?? record.name ?? `#${recordId}`),
            bold: true,
          },
        ]

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-[220px] cursor-pointer items-center gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-hover"
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface text-xs text-text-muted">
          ?
        </div>
      )}
      <div className="min-w-0 flex-1">
        {lines.map((line) => (
          <div
            key={line.key}
            className={`truncate text-sm ${line.bold ? 'font-semibold text-text-primary' : 'text-text-muted'}`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </button>
  )
}

function ActivityCell({ group }: { group: OdooActivityGroupCell }) {
  const state = group.state || 'planned'
  const cellClass = STATE_CELL_CLASS[state] ?? 'bg-surface text-text-primary'
  const count = activityCount(group)
  const summary = summaryText(group)
  const dateLabel = formatReportingDate(group.reporting_date)

  return (
    <div
      className={`flex h-full min-h-[4.5rem] cursor-default flex-col justify-between p-2 text-xs ${cellClass}`}
      title={summary || undefined}
    >
      {summary ? (
        <div className="line-clamp-2 opacity-90">{summary}</div>
      ) : (
        <div className="flex-1" />
      )}
      <div className="mt-2 flex items-end justify-between gap-1">
        <span>{dateLabel}</span>
        {count > 1 ? (
          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{count}</span>
        ) : null}
      </div>
    </div>
  )
}

function ActivityTypeHeader({ type }: { type: OdooActivityTypeInfo }) {
  return (
    <th className="min-w-[100px] border border-border-subtle bg-surface/50 p-3 text-left text-xs font-medium text-text-primary">
      {type.name}
    </th>
  )
}

export function OdooActivityRenderer({
  model,
  arch,
  fields,
  domain = [],
  onRecordClick,
}: ActivityRendererProps) {
  const parsed: ParsedActivityView = useMemo(() => parseActivityXml(arch), [arch])

  const activityDomain = useMemo(() => [...domain, ...ACTIVITY_RECORD_FILTER], [domain])

  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['odoo', 'activity-data', model, activityDomain],
    queryFn: () =>
      callKw<OdooActivityData>('mail.activity', 'get_activity_data', [], {
        res_model: model,
        domain: activityDomain,
        limit: 100,
        offset: 0,
        fetch_done: false,
      }),
    staleTime: 30_000,
  })

  const readFields = useMemo(() => {
    const names = new Set<string>([...parsed.fields, ...parsed.boxFields.map((f) => f.name)])
    names.add('display_name')
    if (!names.has('avatar_128') && !names.has('image_128')) names.add('avatar_128')
    return [...names]
  }, [parsed])

  const resIds = activityData?.activity_res_ids ?? []

  const { data: records, isLoading: loadingRecords } = useQuery({
    queryKey: ['odoo', 'activity-records', model, resIds, readFields],
    queryFn: async () => {
      if (resIds.length === 0) return []
      const rows = await read<Record<string, unknown>[]>(model, resIds, readFields)
      const byId = new Map(rows.map((r) => [r.id as number, r]))
      return resIds.map((id) => byId.get(id)).filter((r): r is Record<string, unknown> => !!r)
    },
    enabled: resIds.length > 0,
    staleTime: 30_000,
  })

  const activityTypes = activityData?.activity_types ?? []
  const grouped = activityData?.grouped_activities ?? {}

  if (loadingActivity || loadingRecords) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (activityTypes.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-text-muted">
        No activity types configured for this model.
      </div>
    )
  }

  if (!records?.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-text-muted">
        No records with activities match the current filters.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <table className="mb-8 w-full min-w-[600px] border-collapse border border-border-subtle bg-surface text-sm">
        <thead>
          <tr>
            <th className="min-w-[240px] border border-border-subtle bg-surface/50 p-3" />
            {activityTypes.map((type) => (
              <ActivityTypeHeader key={type.id} type={type} />
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const resId = record.id as number
            return (
              <tr key={resId} className="border-t border-border-subtle">
                <td className="border border-border-subtle p-0 align-middle">
                  <ActivityRecordBox
                    model={model}
                    record={record}
                    boxFields={parsed.boxFields}
                    fields={fields}
                    onClick={() => onRecordClick?.(resId)}
                  />
                </td>
                {activityTypes.map((type) => {
                  const group = activityGroupFor(grouped, resId, type.id)
                  return (
                    <td
                      key={type.id}
                      className="h-px border border-border-subtle p-0 align-stretch"
                    >
                      {group?.state ? (
                        <ActivityCell group={group} />
                      ) : (
                        <div className="flex h-full min-h-[4.5rem] items-center justify-center text-text-muted hover:bg-hover">
                          <span className="text-lg opacity-0 transition-opacity hover:opacity-100">
                            +
                          </span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface/80">
            <td colSpan={activityTypes.length + 1} className="border border-border-subtle p-3">
              <span className="text-xs text-text-muted">+ Schedule activity (coming soon)</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
