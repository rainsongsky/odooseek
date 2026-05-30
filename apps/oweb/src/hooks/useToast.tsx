import { createContext, useCallback, useContext, useRef, useState } from 'react'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (type: ToastItem['type'], message: string) => void
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return {
    toasts: ctx.toasts,
    removeToast: ctx.removeToast,
    success: (msg: string) => ctx.addToast('success', msg),
    error: (msg: string) => ctx.addToast('error', msg),
    warning: (msg: string) => ctx.addToast('warning', msg),
    info: (msg: string) => ctx.addToast('info', msg),
  }
}

const MAX_TOASTS = 5
const DISMISS_MS = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = ++idRef.current
      setToasts((prev) => {
        const next = [...prev, { id, type, message }]
        return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next
      })
      const timer = setTimeout(() => removeToast(id), DISMISS_MS)
      timers.current.set(id, timer)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}
