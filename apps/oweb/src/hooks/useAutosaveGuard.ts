import { useEffect } from 'react'

export function useAutosaveGuard(options: {
  isDirty: boolean
  onSave: () => Promise<void>
  enabled: boolean
}) {
  useEffect(() => {
    if (!options.enabled || !options.isDirty) return
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        options.onSave()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [options.isDirty, options.onSave, options.enabled])
}
