import { describe, expect, test } from 'vitest'
import { getChartColors } from '../chart-colors'

describe('getChartColors', () => {
  test('returns 8 colors', () => {
    const colors = getChartColors()
    expect(colors).toHaveLength(8)
  })

  test('each color is a non-empty string', () => {
    const colors = getChartColors()
    for (const c of colors) {
      expect(typeof c).toBe('string')
      expect(c.length).toBeGreaterThan(0)
    }
  })

  test('contains fallback hex colors', () => {
    const colors = getChartColors()
    // Last two are hardcoded hex colors
    expect(colors[6]).toBe('#06b6d4')
    expect(colors[7]).toBe('#ec4899')
  })
})
