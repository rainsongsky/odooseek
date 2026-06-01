/** True when value is Odoo-style base64 (may start with `/9j/` for JPEG). */
function isBase64ImagePayload(raw: string): boolean {
  return raw.length >= 4 && /^[A-Za-z0-9+/=]+$/.test(raw)
}

function base64DataUrl(raw: string): string {
  let mime = 'image/png'
  if (raw.startsWith('iVBORw0KGgo')) mime = 'image/png'
  else if (raw.startsWith('/9j/') || raw.startsWith('9j/')) mime = 'image/jpeg'
  return `data:${mime};base64,${raw}`
}

/** Normalize Odoo binary / base64 / URL image field values for <img src>. */
function normalizeRawImage(raw: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw
  // Only pass through known app paths — not `/9j/...` JPEG base64
  if (raw.startsWith('/api/') || raw.startsWith('/web/')) return raw
  if (isBase64ImagePayload(raw)) return base64DataUrl(raw)
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
