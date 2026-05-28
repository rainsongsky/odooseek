import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, test } from 'vitest'
import type { FieldElement } from '../../lib/odoo-types'
import { getFieldWidget, PriorityWidget, TYPE_WIDGETS } from '../field-widgets'

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
      'char',
      'text',
      'integer',
      'float',
      'monetary',
      'boolean',
      'date',
      'datetime',
      'selection',
      'many2one',
      'many2many',
      'one2many',
      'binary',
      'image',
      'html',
      'reference',
    ]
    for (const type of expectedTypes) {
      expect(TYPE_WIDGETS[type]).toBeDefined()
    }
  })

  test('resolves widget=priority via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'priority' }, 'integer')
    expect(Widget).toBe(PriorityWidget)
    expect(Widget).not.toBe(TYPE_WIDGETS.integer)
  })

  test('resolves widget=statusbar via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'statusbar' }, 'char')
    expect(Widget).toBe(TYPE_WIDGETS.state)
  })

  test('resolves widget=state via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'state' }, 'char')
    expect(Widget).toBe(TYPE_WIDGETS.state)
  })

  test('TYPE_WIDGETS includes priority type', () => {
    expect(TYPE_WIDGETS.priority).toBeDefined()
    expect(TYPE_WIDGETS.priority).toBe(PriorityWidget)
  })

  test('TYPE_WIDGETS includes state type', () => {
    expect(TYPE_WIDGETS.state).toBeDefined()
  })

  test('CharWidget renders input with value', () => {
    const CharWidget = TYPE_WIDGETS.char
    render(
      createElement(CharWidget, {
        field: baseField,
        value: 'hello',
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByDisplayValue('hello')).toBeTruthy()
  })

  test('BooleanWidget renders checkbox', () => {
    const BooleanWidget = TYPE_WIDGETS.boolean
    render(
      createElement(BooleanWidget, {
        field: baseField,
        value: true,
        onChange: () => {},
        readOnly: false,
      }),
    )
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  test('SelectionWidget renders options', () => {
    const SelectionWidget = TYPE_WIDGETS.selection
    render(
      createElement(SelectionWidget, {
        field: baseField,
        value: 'draft',
        onChange: () => {},
        readOnly: false,
        meta: {
          selection: [
            ['draft', 'Draft'],
            ['done', 'Done'],
          ],
        },
      }),
    )
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })

  test('DatetimeWidget converts format', () => {
    const DatetimeWidget = TYPE_WIDGETS.datetime
    render(
      createElement(DatetimeWidget, {
        field: baseField,
        value: '2024-01-15 10:30:00',
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByDisplayValue('2024-01-15T10:30')).toBeTruthy()
  })

  test('DateWidget renders in readOnly mode', () => {
    const DateWidget = TYPE_WIDGETS.date
    render(
      createElement(DateWidget, {
        field: baseField,
        value: '2024-01-15',
        onChange: () => {},
        readOnly: true,
      }),
    )
    expect(screen.getByText('2024-01-15')).toBeTruthy()
  })

  test('maps binary type to BinaryWidget', () => {
    const Widget = getFieldWidget(baseField, 'binary')
    expect(Widget).toBe(TYPE_WIDGETS.binary)
    expect(Widget).not.toBe(TYPE_WIDGETS.many2one)
  })

  test('maps image widget to BinaryWidget', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'image' }, 'binary')
    expect(Widget).toBe(TYPE_WIDGETS.image)
  })

  test('BinaryWidget renders file input in edit mode', () => {
    const BinaryWidget = TYPE_WIDGETS.binary
    render(
      createElement(BinaryWidget, {
        field: baseField,
        value: null,
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  test('BinaryWidget renders dash for empty value in readOnly', () => {
    const BinaryWidget = TYPE_WIDGETS.binary
    render(
      createElement(BinaryWidget, {
        field: baseField,
        value: false,
        onChange: () => {},
        readOnly: true,
      }),
    )
    expect(screen.getByText('—')).toBeTruthy()
  })

  test('BinaryWidget renders image preview for image widget', () => {
    const BinaryWidget = TYPE_WIDGETS.image
    render(
      createElement(BinaryWidget, {
        field: { ...baseField, widget: 'image' },
        value:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        onChange: () => {},
        readOnly: true,
      }),
    )
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toContain('data:image/png;base64,')
  })

  test('Many2ManyWidget renders tags in readOnly mode', () => {
    const Many2ManyWidget = TYPE_WIDGETS.many2many
    render(
      createElement(Many2ManyWidget, {
        field: baseField,
        value: [
          [1, 'Tag A'],
          [2, 'Tag B'],
        ],
        onChange: () => {},
        readOnly: true,
      }),
    )
    expect(screen.getByText('Tag A')).toBeInTheDocument()
    expect(screen.getByText('Tag B')).toBeInTheDocument()
  })

  test('Many2ManyWidget renders dash for empty value in readOnly', () => {
    const Many2ManyWidget = TYPE_WIDGETS.many2many
    render(
      createElement(Many2ManyWidget, {
        field: baseField,
        value: [],
        onChange: () => {},
        readOnly: true,
      }),
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('Many2ManyWidget renders remove buttons in edit mode', () => {
    const Many2ManyWidget = TYPE_WIDGETS.many2many
    render(
      createElement(Many2ManyWidget, {
        field: baseField,
        value: [[1, 'Tag A']],
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByText('Tag A')).toBeInTheDocument()
    expect(screen.getByText('×')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a tag...')).toBeInTheDocument()
  })
})
