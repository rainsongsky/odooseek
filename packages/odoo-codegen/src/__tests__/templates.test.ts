import { describe, expect, test } from 'vitest'
import { renderBarrelExport, renderModelFile } from '../templates'
import type { TsProperty } from '../type-mapper'

describe('renderModelFile', () => {
  test('generates interface for simple model', () => {
    const props: TsProperty[] = [
      { name: 'name', type: 'string', optional: false, doc: 'Name' },
      { name: 'email', type: 'string', optional: true, doc: 'Email' },
    ]
    const result = renderModelFile('res.partner', props)
    expect(result).toContain('export interface ResPartnerRecord extends BaseRecord')
    expect(result).toContain("  name: string")
    expect(result).toContain("  email: string")
  })

  test('filters out id and display_name', () => {
    const props: TsProperty[] = [
      { name: 'id', type: 'number', optional: false, doc: 'ID' },
      { name: 'display_name', type: 'string', optional: true, doc: 'Display' },
      { name: 'code', type: 'string', optional: false, doc: 'Code' },
    ]
    const result = renderModelFile('res.company', props)
    expect(result).toContain('code: string')
    expect(result).not.toContain('id:')
    expect(result).not.toContain('display_name:')
  })

  test('generates type name from dotted model', () => {
    const result = renderModelFile('account.move.line', [])
    expect(result).toContain('AccountMoveLineRecord')
    expect(result).toContain('AccountMoveLineFieldName')
    expect(result).toContain('AccountMoveLineSearchResult')
  })

  test('includes DO NOT EDIT header', () => {
    const result = renderModelFile('test.model', [])
    expect(result).toContain('Auto-generated')
    expect(result).toContain('DO NOT EDIT')
  })
})

describe('renderBarrelExport', () => {
  test('generates barrel exports for multiple models', () => {
    const result = renderBarrelExport(['res.partner', 'sale.order'])
    expect(result).toContain('ResPartnerRecord')
    expect(result).toContain('ResPartnerFieldName')
    expect(result).toContain('SaleOrderRecord')
    expect(result).toContain("from './models/res.partner'")
    expect(result).toContain("from './models/sale.order'")
  })

  test('handles empty model list', () => {
    const result = renderBarrelExport([])
    expect(result).toContain('Auto-generated barrel export')
    expect(result.split('\n').filter((l) => l.startsWith('export')).length).toBe(0)
  })
})
