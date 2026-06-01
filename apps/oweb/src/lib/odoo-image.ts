/** Normalize Odoo binary / base64 / URL image field values for <img src>. */
function normalizeRawImage(raw: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('/')) return raw
  if (/^[A-Za-z0-9+/=]+$/.test(raw)) return `data:image/png;base64,${raw}`
  return undefined
}

export function resolveOdooImageSrc(opts: {
  raw?: string | false | null
  model?: string
  recordId?: number
  /** Field segment in `/api/web/image/{model}/{id}/{field}` (default `image_128`). */
  field?: string
}): string | undefined {
  const field = opts.field ?? 'image_128'
  if (opts.raw === false) return undefined
  if (opts.raw != null && opts.raw !== '') {
    const normalized = normalizeRawImage(String(opts.raw))
    if (normalized) return normalized
  }
  if (opts.raw == null && opts.model && opts.recordId) {
    return `/api/web/image/${opts.model}/${opts.recordId}/${field}`
  }
  return undefined
}

/** Read image from record fields, then fall back to web/image URL. */
export function resolveOdooImageFromRecord(
  record?: Record<string, unknown>,
  model?: string,
  recordId?: number,
  fieldNames: string[] = ['image_128', 'avatar_128'],
): string | undefined {
  for (const name of fieldNames) {
    const raw = record?.[name] as string | false | undefined
    const src = resolveOdooImageSrc({ raw, model, recordId, field: name })
    if (src) return src
  }
  return resolveOdooImageSrc({ model, recordId })
}
