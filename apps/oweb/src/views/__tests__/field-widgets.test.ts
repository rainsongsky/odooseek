import { describe, expect, test } from 'vitest'
import { TYPE_WIDGETS, getFieldWidget } from '../field-widgets'
import type { FieldElement } from '../types'

const baseField: FieldElement = {
  type: 'field',
  name: 'test_field',
}

describe('field-widgets', () => {
  test('maps char type to CharWidget', () => {
    const Widget = getFieldWidget(baseField, 'char')
    expect(Widget).toBe(TYPE_WIDGETS.char)
  })

  test('maps text type to TextWidget', () => {
    const Widget = getFieldWidget(baseField, 'text')
    expect(Widget).toBe(TYPE_WIDGETS.text)
  })

  test('maps integer type to IntegerWidget', () => {
    const Widget = getFieldWidget(baseField, 'integer')
    expect(Widget).toBe(TYPE_WIDGETS.integer)
  })

  test('maps boolean type to BooleanWidget', () => {
    const Widget = getFieldWidget(baseField, 'boolean')
    expect(Widget).toBe(TYPE_WIDGETS.boolean)
  })

  test('maps date type to DateWidget', () => {
    const Widget = getFieldWidget(baseField, 'date')
    expect(Widget).toBe(TYPE_WIDGETS.date)
  })

  test('maps many2one type to Many2OneWidget', () => {
    const Widget = getFieldWidget(baseField, 'many2one')
    expect(Widget).toBe(TYPE_WIDGETS.many2one)
  })

  test('maps many2many type to Many2ManyWidget', () => {
    const Widget = getFieldWidget(baseField, 'many2many')
    expect(Widget).toBe(TYPE_WIDGETS.many2many)
  })

  test('maps selection type to SelectionWidget', () => {
    const Widget = getFieldWidget(baseField, 'selection')
    expect(Widget).toBe(TYPE_WIDGETS.selection)
  })

  test('maps unknown type to CharWidget (fallback)', () => {
    const Widget = getFieldWidget(baseField, 'unknown_type')
    expect(Widget).toBe(TYPE_WIDGETS.char)
  })

  test('all declared widget types exist', () => {
    const expectedTypes = [
      'char', 'text', 'integer', 'float', 'monetary',
      'boolean', 'date', 'datetime', 'selection',
      'many2one', 'many2many', 'one2many',
      'binary', 'html', 'reference',
    ]
    for (const type of expectedTypes) {
      expect(TYPE_WIDGETS[type]).toBeDefined()
    }
  })
})
