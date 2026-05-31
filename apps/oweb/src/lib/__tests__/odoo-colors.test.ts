import { describe, expect, it } from 'vitest'
import { getOdooIndexedColor, ODOO_INDEXED_COLORS } from '../odoo-colors'

describe('getOdooIndexedColor', () => {
  it('maps integer index to palette color', () => {
    expect(getOdooIndexedColor(3)).toBe(ODOO_INDEXED_COLORS[3])
  })

  it('maps many2one id string to palette color', () => {
    expect(getOdooIndexedColor('5')).toBe(ODOO_INDEXED_COLORS[5])
  })

  it('returns undefined for zero index', () => {
    expect(getOdooIndexedColor(0)).toBeUndefined()
  })

  it('passes through hex colors', () => {
    expect(getOdooIndexedColor('#ff0000')).toBe('#ff0000')
  })

  it('clamps index to palette length', () => {
    expect(getOdooIndexedColor(999)).toBe(ODOO_INDEXED_COLORS[ODOO_INDEXED_COLORS.length - 1])
  })
})
