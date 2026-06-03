import type { FieldWidgetProps } from './index'

export function WebsiteRedirectWidget({ field, value }: FieldWidgetProps) {
  const opts = (field.options as Record<string, unknown>) ?? {}
  const url = String(value ?? opts.url ?? '')
  const label = (opts.label as string) ?? field.string ?? 'Open'

  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded bg-accent px-3 py-1 text-xs font-medium text-on-accent hover:bg-accent/90"
    >
      {label}
    </a>
  )
}
