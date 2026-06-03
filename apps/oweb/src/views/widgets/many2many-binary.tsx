import { callKw } from '@odooseek/odoo-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { resolveOdooImageSrc } from '../../lib/odoo-image'
import type { FieldWidgetProps } from './index'

interface Attachment {
  id: number
  name: string
  mimetype?: string
  file_size?: number
  checksum?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Many2ManyBinaryWidget({ value, onChange, readOnly, meta }: FieldWidgetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const ids: number[] = Array.isArray(value)
    ? value
        .filter(
          (v): v is number =>
            typeof v === 'number' || (Array.isArray(v) && typeof v[0] === 'number'),
        )
        .map((v) => (Array.isArray(v) ? v[0] : v))
    : []

  const { data: attachments = [] } = useQuery({
    queryKey: ['odoo', 'read', 'ir.attachment', ids],
    queryFn: async () => {
      if (ids.length === 0) return []
      return callKw<Attachment[]>('ir.attachment', 'read', [
        ids,
        ['name', 'mimetype', 'file_size', 'checksum'],
      ])
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  })

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      setUploading(true)

      const newIds: number[] = [...ids]
      for (const file of Array.from(files)) {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''))
        const newId = await callKw<number>('ir.attachment', 'create', [
          {
            name: file.name,
            datas: base64,
            mimetype: file.type || 'application/octet-stream',
            res_model: meta?.relation,
          },
        ])
        newIds.push(newId)
      }

      onChange(newIds.length === 1 ? newIds[0] : newIds)
      queryClient.invalidateQueries({ queryKey: ['odoo', 'read', 'ir.attachment', ids] })
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [ids, onChange, queryClient, meta?.relation],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      const newIds = ids.filter((i) => i !== id)
      onChange(newIds.length === 0 ? false : newIds)
      // Unlink attachment from Odoo
      callKw('ir.attachment', 'unlink', [[id]]).catch(() => {})
    },
    [ids, onChange],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const src = resolveOdooImageSrc({
            raw: att.checksum ? `ir.attachment/${att.id}/datas` : undefined,
            model: 'ir.attachment',
            recordId: att.id,
            field: 'datas',
          })
          const isImage = att.mimetype?.startsWith('image/')
          return (
            <div
              key={att.id}
              className="flex w-32 flex-col rounded border border-border-subtle bg-surface overflow-hidden"
            >
              {isImage && src ? (
                <img src={src} alt={att.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center bg-elevated text-2xl text-text-muted">
                  📄
                </div>
              )}
              <div className="flex flex-col gap-0.5 p-1.5">
                <span className="truncate text-[11px] text-text-primary" title={att.name}>
                  {att.name}
                </span>
                {att.file_size != null && (
                  <span className="text-[10px] text-text-muted">{formatSize(att.file_size)}</span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id)}
                    className="text-[10px] text-text-muted hover:text-danger text-left"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!readOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 self-start text-xs text-accent hover:underline disabled:text-text-muted"
          >
            {uploading ? 'Uploading...' : '+ Add files'}
          </button>
        </>
      )}
    </div>
  )
}
