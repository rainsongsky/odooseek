import { describe, expect, test } from 'vitest'
import {
  formatFloatTime,
  formatPercentage,
  formatRemainingDays,
  parseFloatTime,
  parsePercentage,
} from '../field-formatters'

describe('field-formatters', () => {
  describe('formatFloatTime', () => {
    test('formats 0 → 00:00', () => {
      expect(formatFloatTime(0)).toBe('00:00')
    })

    test('formats 1.5 → 01:30', () => {
      expect(formatFloatTime(1.5)).toBe('01:30')
    })

    test('formats 8.25 → 08:15', () => {
      expect(formatFloatTime(8.25)).toBe('08:15')
    })

    test('formats with seconds', () => {
      expect(formatFloatTime(1.5, true)).toBe('01:30:00')
    })

    test('rounds to nearest second', () => {
      expect(formatFloatTime(1 / 3600, true)).toBe('00:00:01')
    })
  })

  describe('parseFloatTime', () => {
    test('parses HH:MM', () => {
      expect(parseFloatTime('01:30')).toBeCloseTo(1.5)
    })

    test('parses HH:MM:SS', () => {
      expect(parseFloatTime('01:30:30')).toBeCloseTo(1.508, 2)
    })

    test('parses numeric string', () => {
      expect(parseFloatTime('2')).toBe(2)
    })

    test('returns 0 for invalid', () => {
      expect(parseFloatTime('')).toBe(0)
    })
  })

  describe('formatPercentage', () => {
    test('formats 0.5 → 50.00%', () => {
      expect(formatPercentage(0.5)).toBe('50.00%')
    })

    test('formats with custom digits', () => {
      expect(formatPercentage(0.1234, 1)).toBe('12.3%')
    })
  })

  describe('parsePercentage', () => {
    test('parses 50% → 0.5', () => {
      expect(parsePercentage('50')).toBeCloseTo(0.5)
    })

    test('parses with % sign', () => {
      expect(parsePercentage('50%')).toBeCloseTo(0.5)
    })

    test('returns 0 for invalid', () => {
      expect(parsePercentage('')).toBeCloseTo(0)
    })
  })

  describe('formatRemainingDays', () => {
    test('returns empty for falsy value', () => {
      expect(formatRemainingDays(null)).toEqual({ text: '', color: '' })
      expect(formatRemainingDays('')).toEqual({ text: '', color: '' })
    })

    test('shows Today for same day', () => {
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const result = formatRemainingDays(today)
      expect(result.text).toBe('Today')
      expect(result.color).toBe('text-orange-500')
    })

    test('shows overdue for past date', () => {
      const result = formatRemainingDays('2020-01-01')
      expect(result.text).toContain('overdue')
      expect(result.color).toBe('text-red-500')
    })

    test('shows In X days for future date', () => {
      const future = new Date()
      future.setDate(future.getDate() + 30)
      const result = formatRemainingDays(future.toISOString().slice(0, 10))
      expect(result.text).toContain('In')
      expect(result.text).toContain('days')
    })
  })
})
