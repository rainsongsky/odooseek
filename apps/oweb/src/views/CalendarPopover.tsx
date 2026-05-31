import type { OdooFieldMeta } from '@odooseek/odoo-client'
import { callKw, evalModifier } from '@odooseek/odoo-client'
import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RecurrencePolicy } from '../components/RecurrenceUpdateDialog'
import { RecurrenceUpdateDialog } from '../components/RecurrenceUpdateDialog'
import type { CalendarEvent } from './OdooCalendarRenderer'

interface CalendarPopoverProps {
  event: CalendarEvent
  model: string
  fields: Record<string, OdooFieldMeta>
  dateStartField: string
  dateStopField?: string
  allDayField?: string
  archFields: string[]
  fieldAttrs?: Record<string, { invisible?: string }>
  onClose: () => void
  onEdit: (recordId: number) => void
  onDelete: (recordId: number) => void
  onInvalidate?: () => void
}

function formatFieldValue(value: unknown, meta: OdooFieldMeta): string {
  if (value === null || value === undefined || value === false) return ''
  if (meta.type === 'many2one' || meta.type === 'many2many') {
    if (Array.isArray(value) && value.length >= 2) {
      return String(value[1])
    }
    return ''
  }
  if (meta.type === 'selection') {
    if (Array.isArray(value) && value.length >= 2) {
      return String(value[1])
    }
    return String(value)
  }
  if (meta.type === 'datetime') {
    try {
      return format(new Date(String(value)), 'MMM d, yyyy h:mm a')
    } catch {
      return String(value)
    }
  }
  if (meta.type === 'date') {
    try {
      return format(new Date(String(value)), 'MMM d, yyyy')
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function CalendarPopover({
  event,
  model,
  fields,
  dateStartField,
  dateStopField,
  allDayField,
  archFields,
  fieldAttrs,
  onClose,
  onEdit,
  onDelete,
  onInvalidate,
}: CalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [recurrenceDialog, setRecurrenceDialog] = useState<'edit' | 'delete' | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const record = event.record

  const videocallUrl = (record?.videocall_location as string) || undefined

  const attendeeCount = (record?.attendees_count as number) || 0
  const acceptedCount = (record?.accepted_count as number) || 0
  const declinedCount = (record?.declined_count as number) || 0
  const _tentativeCount = (record?.tentative_count as number) || 0

  const handleRsvp = useCallback(
    async (action: string) => {
      setRsvpLoading(true)
      try {
        await callKw(model, `action_${action}`, [[event.id], {}])
        onInvalidate?.()
        onClose()
      } catch {
        // handled by parent
      } finally {
        setRsvpLoading(false)
      }
    },
    [model, event.id, onInvalidate, onClose],
  )

  const visibleFields = useMemo(() => {
    return archFields
      .filter((fname) => {
        if (
          fname === dateStartField ||
          fname === dateStopField ||
          fname === allDayField ||
          fname === 'display_name' ||
          fname === 'id' ||
          fname === 'attendees_count' ||
          fname === 'accepted_count' ||
          fname === 'declined_count' ||
          fname === 'tentative_count' ||
          fname === 'current_status' ||
          fname === 'is_highlighted' ||
          fname === 'effective_privacy' ||
          fname === 'privacy' ||
          fname === 'recurrency' ||
          fname === 'recurrence_display_name' ||
          fname === 'user_can_edit' ||
          fname === 'is_organizer_alone'
        )
          return false
        const attrs = fieldAttrs?.[fname]
        if (attrs?.invisible && record) {
          return !evalModifier(String(attrs.invisible), record)
        }
        return true
      })
      .map((fname) => ({
        name: fname,
        meta: fields[fname],
        value: record?.[fname],
      }))
      .filter((f) => {
        const isEmpty =
          f.value === null || f.value === undefined || f.value === false || f.value === ''
        if (isEmpty) return false
        if (Array.isArray(f.value) && f.value.length === 0) return false
        return true
      })
  }, [archFields, fieldAttrs, fields, record, dateStartField, dateStopField, allDayField])

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  useEffect(() => {
    const el = popoverRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const top = Math.min(event.start.getTime(), Date.now())
      ? Math.min(window.scrollY + vh / 2 - rect.height / 2, window.scrollY + vh - rect.height - 16)
      : window.scrollY + vh / 3
    const left = Math.max(
      16,
      Math.min(window.scrollX + vw / 2 - rect.width / 2, window.scrollX + vw - rect.width - 16),
    )
    setPosition({ top, left })
  }, [event.start])

  const startStr = event.allDay
    ? format(event.start, 'EEE, MMM d, yyyy')
    : format(event.start, 'EEE, MMM d, yyyy h:mm a')
  const endStr = event.allDay
    ? format(new Date(event.end.getTime() - 86400000), 'EEE, MMM d, yyyy')
    : format(event.end, 'h:mm a')

  const timeDisplay = event.allDay
    ? startStr === endStr
      ? startStr
      : `${startStr} - ${endStr}`
    : `${startStr} - ${endStr}`

  const handleDelete = useCallback(async () => {
    if (event.isRecurring) {
      setRecurrenceDialog('delete')
      return
    }
    try {
      await callKw(model, 'unlink', [[event.id]])
      onDelete(event.id)
    } catch {
      // handled by parent via query invalidation
    }
  }, [model, event.id, event.isRecurring, onDelete])

  const handleRecurrenceConfirm = useCallback(
    (policy: RecurrencePolicy) => {
      setRecurrenceDialog(null)
      if (recurrenceDialog === 'delete') {
        callKw(model, 'unlink', [[event.id]], { context: { recurrence_update: policy } })
          .then(() => onDelete(event.id))
          .catch(() => {})
      } else if (recurrenceDialog === 'edit') {
        onClose()
        onEdit(event.id)
      }
    },
    [model, event.id, recurrenceDialog, onDelete, onEdit, onClose],
  )

  const handleRecurrenceCancel = useCallback(() => {
    setRecurrenceDialog(null)
  }, [])

  const handleEdit = useCallback(() => {
    if (event.isRecurring) {
      setRecurrenceDialog('edit')
      return
    }
    onEdit(event.id)
  }, [event.id, event.isRecurring, onEdit])

  const hasRsvp = event.attendeeStatus && !event.isOrganizer && attendeeCount > 0

  const privacyIcon =
    event.effectivePrivacy === 'private'
      ? '\u{1F512}'
      : event.effectivePrivacy === 'confidential'
        ? '\u{1F6E1}'
        : null

  const rsvpLabels = [
    {
      action: 'accept',
      label: 'Yes',
      cls: 'bg-accent text-root hover:opacity-90',
    },
    {
      action: 'tentative',
      label: 'Maybe',
      cls: 'bg-accent-bright/20 text-accent-bright hover:bg-accent-bright/30',
    },
    {
      action: 'decline',
      label: 'No',
      cls: 'border border-border-subtle text-text-secondary hover:bg-hover',
    },
  ]

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
      <div
        ref={popoverRef}
        className="absolute rounded-xl border border-border-subtle bg-surface p-5 shadow-2xl"
        style={{
          top: position.top,
          left: position.left,
          pointerEvents: 'auto',
          minWidth: 360,
          maxWidth: 440,
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {privacyIcon && <span className="flex-shrink-0 text-sm">{privacyIcon}</span>}
            <h3
              className={`text-base font-semibold text-text truncate ${event.isHighlighted ? 'text-text-primary' : ''}`}
            >
              {event.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 text-text-muted hover:bg-hover hover:text-text-primary"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {event.isRecurring && (
          <div className="mb-3 flex items-center gap-2 text-sm text-accent-bright">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="5.5" />
              <path d="M10 7l-3 1.5V4" />
            </svg>
            <span>Recurring{event.recurrenceName ? `: ${event.recurrenceName}` : ' event'}</span>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2 text-sm text-text-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4v3l2 2" />
          </svg>
          <span>{timeDisplay}</span>
        </div>

        {videocallUrl && (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="10,5 14,3 14,11 10,9" />
              <rect x="0.5" y="3.5" width="9" height="7" rx="1" />
            </svg>
            <a
              href={videocallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              Join Video Call
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(videocallUrl)
                setCopyFeedback(true)
                setTimeout(() => setCopyFeedback(false), 1500)
              }}
              className="rounded-md px-1.5 py-0.5 text-xs text-text-muted hover:bg-surface-hover"
            >
              {copyFeedback ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {event.effectivePrivacy && (
          <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
            <span className="mt-px text-xs">{privacyIcon}</span>
            <span className="capitalize">{event.effectivePrivacy}</span>
          </div>
        )}

        {attendeeCount > 0 && (
          <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="5" cy="3" r="2" />
              <path d="M1 13v-1a4 4 0 014-4" />
              <circle cx="9.5" cy="4.5" r="2" />
              <path d="M13 13v-1a3 3 0 00-3.5-3" />
            </svg>
            <span>{attendeeCount} attendees</span>
            {acceptedCount > 0 && <span className="text-accent">({acceptedCount} accepted)</span>}
            {declinedCount > 0 && (
              <span className="text-text-muted">({declinedCount} declined)</span>
            )}
          </div>
        )}

        {event.attendeeStatus && (
          <div
            className={`mb-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              event.attendeeStatus === 'accepted'
                ? 'bg-accent/10 text-accent'
                : event.attendeeStatus === 'declined'
                  ? 'bg-hover text-text-muted line-through'
                  : event.attendeeStatus === 'tentative'
                    ? 'bg-accent-bright/10 text-accent-bright'
                    : 'bg-accent-overlay-bg text-text-secondary'
            }`}
          >
            {event.attendeeStatus === 'accepted' && '✓ '}
            {event.attendeeStatus === 'declined' && '✗ '}
            {event.attendeeStatus === 'tentative' && '? '}
            {event.attendeeStatus === 'accepted'
              ? 'Accepted'
              : event.attendeeStatus === 'declined'
                ? 'Declined'
                : event.attendeeStatus === 'tentative'
                  ? 'Tentative'
                  : 'Awaiting'}
          </div>
        )}

        {visibleFields.map((field) => (
          <div key={field.name} className="mb-2 flex items-start gap-2 text-sm">
            <span className="mt-px flex-shrink-0 text-text-muted">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              {field.meta && (
                <div className="text-xs text-text-muted">{field.meta.string || field.name}</div>
              )}
              <div className="truncate text-text">{formatFieldValue(field.value, field.meta)}</div>
            </div>
          </div>
        ))}

        {hasRsvp && (
          <div className="mt-3 flex gap-2 border-t border-border-subtle pt-3">
            {rsvpLabels.map((rsvp) => (
              <button
                key={rsvp.action}
                type="button"
                onClick={() => handleRsvp(rsvp.action)}
                disabled={rsvpLoading}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${rsvp.cls} disabled:opacity-50`}
              >
                {rsvp.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={handleEdit}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-root hover:opacity-90"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-muted hover:bg-hover hover:text-text-primary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="inline-block"
            >
              <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V4" />
            </svg>
          </button>
        </div>
      </div>
      {recurrenceDialog && (
        <RecurrenceUpdateDialog
          mode={recurrenceDialog}
          onConfirm={handleRecurrenceConfirm}
          onCancel={handleRecurrenceCancel}
        />
      )}
    </div>
  )
}
