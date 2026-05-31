import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, endOfMonth, format, getDay, parse, startOfMonth, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { useCallback, useMemo, useState } from 'react'
import { dateFnsLocalizer, Calendar as RBC_Calendar } from 'react-big-calendar'
import { callKw, searchRead } from '@odooseek/odoo-client'
import { useToast } from '../hooks/useToast'
import type { OdooFieldMeta } from '@odooseek/odoo-client'
import { parseCalendarXml } from '@odooseek/odoo-client'

import 'react-big-calendar/lib/css/react-big-calendar.css'

interface CalendarRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  domain?: unknown[]
  onRecordClick?: (recordId: number) => void
}

const PALETTE = [
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#0891b2',
  '#4f46e5',
  '#c026d3',
]

const localizer = dateFnsLocalizer({
  format: format as unknown as Record<string, unknown>,
  parse: parse as unknown as Record<string, unknown>,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
})

interface CalendarEvent {
  id: number
  title: string
  start: Date
  end: Date
  record: Record<string, unknown>
  colorKey?: string
}

export function OdooCalendarRenderer({
  model,
  arch,
  fields,
  domain = [],
  onRecordClick,
}: CalendarRendererProps) {
  const calView = useMemo(() => parseCalendarXml(arch), [arch])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>(calView.mode)
  const toast = useToast()
  const queryClient = useQueryClient()

  const fieldList = useMemo(() => {
    const required = [calView.dateStart, 'display_name', 'id']
    if (calView.dateStop) required.push(calView.dateStop)
    if (calView.colorField) required.push(calView.colorField)
    for (const f of calView.fields) {
      if (!required.includes(f)) required.push(f)
    }
    return required
  }, [calView])

  const rangeStart = startOfMonth(currentDate)
  const rangeEnd = endOfMonth(addMonths(currentDate, 1))

  const dateDomain = useMemo(
    () => [
      ...domain,
      [calView.dateStart, '>=', format(rangeStart, 'yyyy-MM-dd HH:mm:ss')],
      [calView.dateStart, '<=', format(rangeEnd, 'yyyy-MM-dd HH:mm:ss')],
    ],
    [domain, calView.dateStart, rangeStart, rangeEnd],
  )

  const queryKey = ['odoo', 'calendar', model, dateDomain, fieldList]

  const { data: records, isLoading } = useQuery({
    queryKey,
    queryFn: () => searchRead<Record<string, unknown>[]>(model, dateDomain, fieldList),
    staleTime: 30_000,
  })

  const events: CalendarEvent[] = useMemo(() => {
    if (!records) return []
    return records.map((rec) => {
      const start = rec[calView.dateStart] ? new Date(rec[calView.dateStart] as string) : new Date()
      const end =
        calView.dateStop && rec[calView.dateStop]
          ? new Date(rec[calView.dateStop] as string)
          : new Date(start.getTime() + 3600_000)
      const title = (rec.display_name as string) || (rec.name as string) || `#${rec.id}`
      const colorKey = calView.colorField
        ? String(
            Array.isArray(rec[calView.colorField])
              ? (rec[calView.colorField] as unknown[])[0]
              : rec[calView.colorField],
          )
        : undefined
      return { id: rec.id as number, title, start, end, record: rec, colorKey }
    })
  }, [records, calView])

  const colorMap = useMemo(() => {
    const keys = new Set(events.map((e) => e.colorKey).filter(Boolean))
    const map = new Map<string, string>()
    let i = 0
    for (const k of keys) {
      map.set(k as string, PALETTE[i % PALETTE.length])
      i++
    }
    return map
  }, [events])

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({
      style: {
        backgroundColor: event.colorKey ? colorMap.get(event.colorKey) : '#3b82f6',
        border: 'none',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '12px',
        padding: '2px 4px',
        cursor: 'pointer',
      },
    }),
    [colorMap],
  )

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  // Create event on slot select (click empty area or drag range)
  const handleSelectSlot = useCallback(
    async ({ start, end }: { start: Date; end: Date }) => {
      if (!calView.quickCreate) return
      const values: Record<string, unknown> = {
        [calView.dateStart]: format(start, "yyyy-MM-dd HH:mm:ss"),
      }
      if (calView.dateStop) {
        values[calView.dateStop] = format(end, "yyyy-MM-dd HH:mm:ss")
      }
      try {
        await callKw(model, 'create', [values])
        invalidate()
        toast.success('Event created')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create event')
      }
    },
    [calView, model, invalidate, toast],
  )

  // Move event via drag
  const handleEventDrop = useCallback(
    async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      const values: Record<string, unknown> = {
        [calView.dateStart]: format(start, "yyyy-MM-dd HH:mm:ss"),
      }
      if (calView.dateStop) {
        values[calView.dateStop] = format(end, "yyyy-MM-dd HH:mm:ss")
      }
      try {
        await callKw(model, 'write', [[event.id], values])
        invalidate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to move event')
      }
    },
    [calView, model, invalidate, toast],
  )

  // Resize event
  const handleEventResize = useCallback(
    async ({ event, end }: { event: CalendarEvent; end: Date }) => {
      if (!calView.dateStop) return
      try {
        await callKw(model, 'write', [[event.id], {
          [calView.dateStop]: format(end, "yyyy-MM-dd HH:mm:ss"),
        }])
        invalidate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to resize event')
      }
    },
    [calView, model, invalidate, toast],
  )

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onRecordClick?.(event.id)
    },
    [onRecordClick],
  )

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-4" style={{ height: 'calc(100vh - 180px)' }}>
      <RBC_Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        view={view}
        views={['month', 'week', 'day']}
        date={currentDate}
        onNavigate={handleNavigate}
        onView={setView as (view: string) => void}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        eventPropGetter={eventPropGetter}
        popup
        style={{ height: '100%' }}
      />
    </div>
  )
}
