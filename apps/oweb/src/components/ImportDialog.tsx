import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { callKw } from '@odooseek/odoo-client'

interface ImportPreviewRow {
  id: number
  values: Record<string, string>
  errors?: Record<string, string>
}

interface ImportOptions {
  headers: boolean
  advanced: boolean
  separator: string
  encoding: string
}

export function ImportDialog({
  model,
  onClose,
}: {
  model: string
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing'>('upload')
  const [preview, setPreview] = useState<{
    headers: string[]
    rows: ImportPreviewRow[]
    options: ImportOptions
    importId: number
  } | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('ufile', file)
      formData.append('model', model)

      const res = await fetch('/api/odoo-http/base_import/set_file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const html = await res.text()

      // Odoo returns HTML with JSON embedded: <script>window.parent.$.jstree.rollback(...)</script>
      // Extract the JSON from the HTML response
      const jsonMatch = html.match(/jstree\.rollback\(({.*})\)/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1])
        return { importId: data.import_id as number }
      }
      throw new Error('Failed to parse import response')
    },
    onSuccess: (data) => {
      // Parse preview
      callKw<{
        headers: Array<{ id: string; name: string }>
        preview: Array<{ id: number; values: Record<string, string> }>
        options: ImportOptions
      }>('base_import.import', 'parse_preview', [[data.importId], { limit: 10 }])
        .then((result) => {
          if (result) {
            setPreview({
              headers: result.headers.map((h) => h.id),
              rows: result.preview.map((r) => ({
                id: r.id,
                values: r.values,
              })),
              options: result.options,
              importId: data.importId,
            })
            const mapping: Record<string, string> = {}
            for (const h of result.headers) {
              if (result.preview[0]?.values[h.id]) {
                mapping[h.id] = h.id
              }
            }
            setFieldMapping(mapping)
            setStep('mapping')
          }
        })
        .catch((err) => setError(err.message))
    },
    onError: (err) => setError(err.message),
  })

  const executeMutation = useMutation({
    mutationFn: () =>
      callKw('base_import.import', 'execute_import', [
        [preview!.importId],
        { fields: fieldMapping },
      ]),
    onSuccess: () => {
      onClose()
    },
    onError: (err) => setError(err.message),
  })

  const handleExecute = () => {
    setStep('importing')
    executeMutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-2xl rounded-xl border border-border-subtle bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Import Records</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            ×
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-3 rounded border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="text-center">
              <p className="mb-4 text-sm text-text-secondary">Upload a CSV or XLSX file</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                }}
                className="text-sm"
              />
              {uploadMutation.isPending && (
                <div className="mt-4 text-xs text-text-muted">Uploading and parsing...</div>
              )}
            </div>
          )}

          {step === 'mapping' && preview && (
            <>
              <p className="mb-3 text-xs text-text-secondary">
                Map CSV columns to {model} fields ({preview.rows.length} rows preview)
              </p>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      {preview.headers.map((h) => (
                        <th key={h} className="px-2 py-1 text-left text-text-secondary">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 10).map((row) => (
                      <tr key={row.id} className="border-b border-border-subtle/50">
                        {preview.headers.map((h) => (
                          <td key={h} className="px-2 py-1 text-text-primary">{row.values[h] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={executeMutation.isPending}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {executeMutation.isPending ? 'Importing...' : 'Import'}
                </button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="mt-3 text-sm text-text-secondary">Importing records...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
