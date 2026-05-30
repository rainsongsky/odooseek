import { describe, expect, test } from 'vitest'
import type { OdooFieldMeta } from '../odoo-types'
import { DEFAULT_COL_WIDTH, FIELD_TYPE_WIDTHS, renderCell } from '../list-formatters'

describe('FIELD_TYPE_WIDTHS', () => {
  test('covers common field types', () => {
    expect(FIELD_TYPE_WIDTHS.boolean).toBe(50)
    expect(FIELD_TYPE_WIDTHS.integer).toBe(80)
    expect(FIELD_TYPE_WIDTHS.float).toBe(90)
    expect(FIELD_TYPE_WIDTHS.monetary).toBe(110)
    expect(FIELD_TYPE_WIDTHS.date).toBe(110)
    expect(FIELD_TYPE_WIDTHS.datetime).toBe(160)
    expect(FIELD_TYPE_WIDTHS.selection).toBe(120)
    expect(FIELD_TYPE_WIDTHS.many2one).toBe(160)
    expect(FIELD_TYPE_WIDTHS.many2many).toBe(140)
    expect(FIELD_TYPE_WIDTHS.handle).toBe(40)
  })

  test('DEFAULT_COL_WIDTH is 160', () => {
    expect(DEFAULT_COL_WIDTH).toBe(160)
  })
})

describe('renderCell', () => {
  test('null/undefined/false returns empty string', () => {
    expect(renderCell(null)).toBe('')
    expect(renderCell(undefined)).toBe('')
    expect(renderCell(false)).toBe('')
  })

  test('boolean true shows checkmark', () => {
    expect(renderCell(true)).toBe('✓')
  })

  test('boolean false shows empty', () => {
    expect(renderCell(false)).toBe('')
  })

  test('string returns as-is', () => {
    expect(renderCell('hello')).toBe('hello')
  })

  test('html type strips tags', () => {
    const meta = { type: 'html' } as OdooFieldMeta
    expect(renderCell('<b>Bold</b> text', meta)).toBe('Bold text')
  })

  test('binary-like base64 string shows file icon', () => {
    const longBase64 = 'A'.repeat(101)
    expect(renderCell(longBase64)).toBe('📎 File')
  })

  test('selection value resolves label', () => {
    const meta = {
      type: 'selection',
      selection: [
        ['draft', 'Draft'],
        ['done', 'Done'],
      ],
    } as OdooFieldMeta
    expect(renderCell('draft', meta)).toBe('Draft')
    expect(renderCell('done', meta)).toBe('Done')
  })

  test('monetary formats with 2 decimals and thousands separator', () => {
    const meta = { type: 'monetary' } as OdooFieldMeta
    const result = renderCell(1234.5, meta)
    expect(result).toContain('1,234.50')
  })

  test('float strips trailing .00', () => {
    const meta = { type: 'float' } as OdooFieldMeta
    expect(renderCell(5.0, meta)).toBe('5')
  })

  test('float keeps meaningful decimals', () => {
    const meta = { type: 'float' } as OdooFieldMeta
    expect(renderCell(3.14, meta)).toBe('3.14')
  })

  test('integer uses locale string', () => {
    const meta = { type: 'integer' } as OdooFieldMeta
    const result = renderCell(1000, meta)
    expect(result).toContain('1')
    expect(result).toContain('000')
  })

  test('many2one [id, name] returns name', () => {
    expect(renderCell([42, 'Partner Name'])).toBe('Partner Name')
  })

  test('many2one [id, ""] returns #id', () => {
    expect(renderCell([42, ''])).toBe('#42')
  })

  test('many2many array shows record count', () => {
    expect(renderCell([1, 'a', 2, 'b', 3, 'c'])).toBe('3 records')
  })

  test('unknown value JSON-stringifies', () => {
    expect(renderCell({ foo: 1 })).toBe('{"foo":1}')
  })
})
