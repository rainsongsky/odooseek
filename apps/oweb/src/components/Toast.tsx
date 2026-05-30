import { useToast } from '../hooks/useToast'

const TYPE_STYLES: Record<string, string> = {
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
  error: 'border-red-400/30 bg-red-400/10 text-red-400',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
  info: 'border-accent/30 bg-accent/10 text-accent-bright',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-slide-in flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${TYPE_STYLES[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="opacity-60 hover:opacity-100"
          >
            x
          </button>
        </div>
      ))}
    </div>
  )
}
