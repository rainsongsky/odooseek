const FALLBACK = [
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-info)',
  'var(--color-accent-bright)',
  '#06b6d4',
  '#ec4899',
]

/** Chart series colors derived from theme CSS variables. */
export function getChartColors(): string[] {
  if (typeof document === 'undefined') return FALLBACK
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return [
    read('--color-accent', '#6366f1'),
    read('--color-success', '#10b981'),
    read('--color-warning', '#f59e0b'),
    read('--color-danger', '#ef4444'),
    read('--color-info', '#3b82f6'),
    read('--color-accent-bright', '#8b5cf6'),
    '#06b6d4',
    '#ec4899',
  ]
}
