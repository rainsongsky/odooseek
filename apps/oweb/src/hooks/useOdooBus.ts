import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${protocol}//${location.host}/ws/events`)

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer = setTimeout(connect, 5000)
      }

      ws.onmessage = (e) => {
        try {
          const event: BusNotification = JSON.parse(e.data)
          setEvents((prev) => [...prev.slice(-49), event])

          // Auto-refresh related model data when records are created/modified
          const model = event.message?.payload?.model
          if (model) {
            queryClient.invalidateQueries({
              queryKey: ['odoo', 'data', model],
            })
          }
        } catch {
          // Ignore malformed messages
        }
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [queryClient])

  return { connected, events }
}
