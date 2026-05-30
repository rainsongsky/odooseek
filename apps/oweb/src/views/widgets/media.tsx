import { useRef, useState } from 'react'
import type { FieldWidgetProps } from './index'

export function BinaryWidget({ field, value, onChange, readOnly, meta, record }: FieldWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isImage =
    field.widget === 'image' ||
    (meta?.type === 'binary' &&
      (field.name?.includes('image') ||
        field.name?.includes('photo') ||
        field.name?.includes('avatar')))

  if (isImage) {
    return (
      <ImageFieldWidget
        field={field}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        meta={meta}
      />
    )
  }

  const opts = (field.options as Record<string, unknown>) ?? {}
  const filenameField = opts.filename as string | undefined
  const acceptFilter = opts.accept as string | undefined
  const base64 = value as string | false | null | undefined
  const hasValue = base64 != null && base64 !== false && base64 !== ''
  const fileName = filenameField ? String(record?.[filenameField] ?? '') : ''
  const fileSize = hasValue && typeof base64 === 'string' ? Math.round((base64.length * 3) / 4) : 0
  const sizeLabel =
    fileSize > 1048576
      ? `${(fileSize / 1048576).toFixed(1)} MB`
      : fileSize > 1024
        ? `${Math.round(fileSize / 1024)} KB`
        : fileSize > 0
          ? `${fileSize} B`
          : ''

  if (readOnly) {
    if (hasValue) {
      return (
        <span className="text-sm text-text-primary">
          📎 {fileName || 'File attached'}
          {sizeLabel && <span className="ml-1 text-text-muted">({sizeLabel})</span>}
        </span>
      )
    }
    return <span className="text-sm text-text-muted">—</span>
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={acceptFilter}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            onChange(dataUrl.split(',')[1])
          }
          reader.readAsDataURL(file)
        }}
        className="text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-accent/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange(false)}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-hover"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export function ImageFieldWidget({
  field,
  value,
  onChange,
  readOnly,
  model,
  recordId,
}: FieldWidgetProps) {
  const [zoomed, setZoomed] = useState(false)
  const opts = (field.options as Record<string, unknown>) ?? {}
  const maxW = Number(opts.max_width) || 1024
  const maxH = Number(opts.max_height) || 1024
  const base64 = value as string | false | null | undefined
  const hasBase64 = base64 != null && base64 !== false && base64 !== ''

  // Prefer base64 data; fallback to Odoo /web/image URL when record exists
  const src = hasBase64
    ? `data:image/png;base64,${base64}`
    : model && recordId
      ? `/api/web/image/${model}/${recordId}/${field.name}`
      : ''

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxW) {
        height *= maxW / width
        width = maxW
      }
      if (height > maxH) {
        width *= maxH / height
        height = maxH
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
      const b64 = canvas.toDataURL('image/png').split(',')[1]
      onChange(b64)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  if (readOnly) {
    if (!src) return <span className="text-sm text-text-muted">—</span>
    return (
      <>
        <img
          src={src}
          alt={field.string || field.name}
          onClick={() => setZoomed(true)}
          className="max-h-32 max-w-32 cursor-zoom-in rounded border border-border-subtle object-contain hover:opacity-90 transition-opacity"
        />
        {zoomed && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
            onClick={() => setZoomed(false)}
          >
            <img
              src={src}
              alt={field.string || field.name}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {src && (
        <img
          src={src}
          alt={field.string || field.name}
          className="max-h-32 max-w-32 rounded border border-border-subtle object-contain"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-accent/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-accent hover:file:bg-accent/20"
        />
        {hasBase64 && (
          <button
            type="button"
            onClick={() => onChange(false)}
            className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary hover:bg-hover"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
