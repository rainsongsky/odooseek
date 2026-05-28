import { describe, expect, it } from 'vitest'
import { getAccent, getPreset, PRESETS } from '../presets.ts'
import { hexToRgb } from '../theme-engine.ts'

describe('hexToRgb', () => {
  it('converts red', () => {
    expect(hexToRgb('#ff0000')).toBe('255, 0, 0')
  })

  it('converts black', () => {
    expect(hexToRgb('#000000')).toBe('0, 0, 0')
  })

  it('converts white', () => {
    expect(hexToRgb('#ffffff')).toBe('255, 255, 255')
  })

  it('handles no hash prefix', () => {
    expect(hexToRgb('d4a574')).toBe('212, 165, 116')
  })
})

describe('presets', () => {
  it('getPreset returns matching preset', () => {
    const preset = getPreset('dark-gold')
    expect(preset.isDark).toBe(true)
    expect(preset.name).toBe('Dark Gold')
  })

  it('getPreset returns first preset for unknown id', () => {
    expect(getPreset('nonexistent')).toBe(PRESETS[0])
  })

  it('getAccent returns matching swatch', () => {
    const swatch = getAccent(getPreset('dark-gold'), 'ocean')
    expect(swatch.id).toBe('ocean')
  })

  it('getAccent falls back to default accent', () => {
    const swatch = getAccent(getPreset('dark-gold'), 'nonexistent')
    expect(swatch.id).toBe('gold')
  })
})
