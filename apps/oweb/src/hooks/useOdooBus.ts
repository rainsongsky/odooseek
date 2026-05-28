import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface BusNotification {
  id: number
  message: {
    type: string
    payload?: {
      model?: string
      id?: number
      ids?: number[]
    }
  }
}

export function useOdooBus() {
  const [events, setEvents] = useState<BusNotification[]>([])
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws/events`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!cancelled) setConnected(true)
      }

      ws.onclose = () => {
        if (!cancelled) {
          setConnected(false)
          reconnectRef.current = setTimeout(connect, 5000)
        }
      }

      ws.onmessage = (e) => {
        if (cancelled) return
        try {
          const event: BusNotification = JSON.parse(e.data)
          setEvents((prev) => [...prev.slice(-49), event])
          const model = event.message?.payload?.model
          if (model) {
            queryClient.invalidateQueries({ queryKey: ['odoo', 'data', model] })
          }
        } catch {
          // Ignore malformed messages
        }
      }
    }

    // Delay connection to avoid StrictMode double-mount race
    const timer = setTimeout(connect, 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [queryClient])

  return { connected, events }
}
