import { describe, expect, test } from 'vitest'
import { mapFieldType } from '../type-mapper'
import type { OdooFieldMeta } from '@odooseek/odoo-client'

function meta(overrides: Partial<OdooFieldMeta> = {}): OdooFieldMeta {
  return {
    type: 'char',
    name: 'test_field',
    string: 'Test Field',
    required: false,
    readonly: false,
    ...overrides,
  }
}

describe('mapFieldType', () => {
  test('char → string', () => {
    expect(mapFieldType(meta({ type: 'char' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('integer → number', () => {
    expect(mapFieldType(meta({ type: 'integer' }))).toEqual({ tsType: 'number', isNullable: true })
  })

  test('boolean → never nullable', () => {
    expect(mapFieldType(meta({ type: 'boolean' }))).toEqual({ tsType: 'boolean', isNullable: false })
  })

  test('boolean → not nullable even when required=false', () => {
    // booleans are special: Odoo always sends true/false
    expect(mapFieldType(meta({ type: 'boolean', required: false })).isNullable).toBe(false)
  })

  test('required char → not nullable', () => {
    expect(mapFieldType(meta({ type: 'char', required: true }))).toEqual({
      tsType: 'string',
      isNullable: false,
    })
  })

  test('many2one → [number, string]', () => {
    const result = mapFieldType(meta({ type: 'many2one', relation: 'res.partner' }))
    expect(result.tsType).toContain('[number, string]')
    expect(result.tsType).toContain('res.partner')
    expect(result.isNullable).toBe(true)
  })

  test('one2many → never nullable', () => {
    const result = mapFieldType(meta({ type: 'one2many' }))
    expect(result.tsType).toContain('number[]')
    expect(result.isNullable).toBe(false)
  })

  test('selection with options → union type', () => {
    const result = mapFieldType(
      meta({
        type: 'selection',
        selection: [
          ['draft', 'Draft'],
          ['confirmed', 'Confirmed'],
        ],
      }),
    )
    expect(result.tsType).toBe("'draft' | 'confirmed'")
    expect(result.isNullable).toBe(true)
  })

  test('selection empty → string', () => {
    expect(mapFieldType(meta({ type: 'selection', selection: [] }))).toEqual({
      tsType: 'string',
      isNullable: true,
    })
  })

  test('unknown type → unknown', () => {
    const result = mapFieldType(meta({ type: 'custom_field' }))
    expect(result.tsType).toBe('unknown')
  })

  test('float → number', () => {
    expect(mapFieldType(meta({ type: 'float' }))).toEqual({ tsType: 'number', isNullable: true })
  })

  test('monetary → number', () => {
    expect(mapFieldType(meta({ type: 'monetary' }))).toEqual({ tsType: 'number', isNullable: true })
  })

  test('date → string', () => {
    expect(mapFieldType(meta({ type: 'date' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('datetime → string', () => {
    expect(mapFieldType(meta({ type: 'datetime' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('text → string', () => {
    expect(mapFieldType(meta({ type: 'text' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('html → string', () => {
    expect(mapFieldType(meta({ type: 'html' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('binary → string', () => {
    expect(mapFieldType(meta({ type: 'binary' }))).toEqual({ tsType: 'string', isNullable: true })
  })

  test('many2many → number[] with relation comment', () => {
    const result = mapFieldType(
      meta({ type: 'many2many', relation: 'res.partner.category' }),
    )
    expect(result.tsType).toContain('number[]')
    expect(result.tsType).toContain('res.partner.category')
  })
})
