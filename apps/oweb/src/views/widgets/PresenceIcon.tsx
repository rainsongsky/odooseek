import type { FieldWidgetProps } from './index'

const PRESENCE_CONFIG: Record<string, { className: string; title: string }> = {
  present: { className: 'bg-success', title: 'Present' },
  absent: { className: 'bg-text-muted', title: 'Absent' },
  away: { className: 'bg-warning', title: 'Away' },
  out_of_working_hour: { className: 'bg-border-default', title: 'Off Hours' },
}

export function resolvePresenceState(record?: Record<string, unknown>, value?: unknown): string {
  const fromField =
    (value as string) ||
    (record?.hr_presence_state as string) ||
    (record?.hr_icon_display as string)
  if (fromField && PRESENCE_CONFIG[fromField]) return fromField
  return 'absent'
}

export function PresenceIcon({ value, readOnly, record }: FieldWidgetProps) {
  const state = resolvePresenceState(record, value)
  const cfg = PRESENCE_CONFIG[state] ?? PRESENCE_CONFIG.absent

  const dot = (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-surface ${cfg.className}`}
      title={cfg.title}
    />
  )

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
        {dot}
        {cfg.title}
      </span>
    )
  }

  return dot
}

/** Kanban avatar overlay (bottom-right). */
export function PresenceIconOverlay({ record }: { record: Record<string, unknown> }) {
  const state = resolvePresenceState(record)
  const cfg = PRESENCE_CONFIG[state] ?? PRESENCE_CONFIG.absent
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${cfg.className}`}
      title={cfg.title}
      aria-hidden
    />
  )
}
