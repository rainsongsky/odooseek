import { createContext, useCallback, useContext, useRef, useState } from 'react'

export interface DialogItem {
  id: number
  size: 'sm' | 'md' | 'lg' | 'xl'
  title?: string
  content: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdrop?: boolean
}

interface DialogContextValue {
  dialogs: DialogItem[]
  openDialog: (options: Omit<DialogItem, 'id'>) => number
  closeDialog: (id: number) => void
  closeAll: () => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogItem[]>([])
  const idRef = useRef(0)

  const openDialog = useCallback((options: Omit<DialogItem, 'id'>) => {
    const id = ++idRef.current
    setDialogs((prev) => [...prev, { ...options, id }])
    return id
  }, [])

  const closeDialog = useCallback((id: number) => {
    setDialogs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const closeAll = useCallback(() => {
    setDialogs([])
  }, [])

  return (
    <DialogContext.Provider value={{ dialogs, openDialog, closeDialog, closeAll }}>
      {children}
    </DialogContext.Provider>
  )
}
