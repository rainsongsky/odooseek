import { useState } from 'react'

interface DataExportProps {
  model: string
  onClose: () => void
}

export function DataExportDialog({ model, onClose }: DataExportProps) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')

  const handleExport = () => {
    const exportData: Record<string, unknown> = { model, import_compat: true }
    const url = `/api/odoo-http/web/export/${format}?data=${encodeURIComponent(JSON.stringify(exportData))}`
    window.open(url, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-xs rounded-xl border border-border-subtle bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Export All</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <div className="mb-4 flex gap-2">
            {(['csv', 'xlsx'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium ${
                  format === f
                    ? 'bg-accent text-white'
                    : 'border border-border-default text-text-secondary hover:bg-hover'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
