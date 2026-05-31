/** Field formatting and parsing utilities for widget system. */

/** Float → HH:MM (or HH:MM:SS) time string */
export function formatFloatTime(value: number, displaySeconds = false): string {
  const totalSec = Math.round(value * 3600)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (displaySeconds)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** HH:MM (or HH:MM:SS) time string → float hours */
export function parseFloatTime(str: string): number {
  const parts = str.split(':').map(Number)
  if (parts.length === 2) return parts[0] + parts[1] / 60
  if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600
  return Number(str) || 0
}

/** Float (0-1) → percentage string */
export function formatPercentage(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`
}

/** Percentage string → float (0-1) */
export function parsePercentage(str: string): number {
  const cleaned = str.replace('%', '').trim()
  return (Number(cleaned) || 0) / 100
}

/** Date → remaining days info with color */
export function formatRemainingDays(dateValue: unknown): { text: string; color: string } {
  if (!dateValue) return { text: '', color: '' }
  const parts = String(dateValue).slice(0, 10).split('-').map(Number)
  const target = new Date(parts[0], parts[1] - 1, parts[2])
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000)
  if (diffDays === 0) return { text: 'Today', color: 'text-orange-500' }
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-orange-500' }
  if (diffDays === -1) return { text: 'Yesterday', color: 'text-red-500' }
  if (diffDays > 0)
    return {
      text: `In ${diffDays} days`,
      color: diffDays <= 7 ? 'text-orange-500' : 'text-green-500',
    }
  return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-500' }
}
