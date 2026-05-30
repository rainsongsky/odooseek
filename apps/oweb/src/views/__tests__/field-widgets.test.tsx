import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { FieldElement } from '../../lib/odoo-types'
import { getFieldWidget, PriorityWidget, TYPE_WIDGETS } from '../field-widgets'

const mockCallKw = vi.fn()
vi.mock('../../lib/api', () => ({
  callKw: (...args: unknown[]) => mockCallKw(...args),
}))

let queryClient: QueryClient

const queryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const baseField: FieldElement = {
  type: 'field',
  name: 'test_field',
}

describe('field-widgets', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockCallKw.mockReset()
  })

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

  test('maps one2many to One2ManyWidget (not Many2ManyWidget)', () => {
    expect(TYPE_WIDGETS.one2many).toBeDefined()
    expect(TYPE_WIDGETS.one2many).not.toBe(TYPE_WIDGETS.many2many)
  })

  // ── BooleanToggleWidget ──────────────────────────────────────────────

  test('resolves widget=boolean_toggle via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    expect(Widget).not.toBe(TYPE_WIDGETS.boolean)
  })

  test('BooleanToggleWidget readonly true shows "Yes" badge', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    render(
      createElement(Widget, {
        field: baseField,
        value: true,
        onChange: () => {},
        readOnly: true,
      }),
    )
    const badge = screen.getByText('Yes')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('bg-emerald-500/10')
    expect(badge.className).toContain('text-emerald-500')
  })

  test('BooleanToggleWidget readonly false shows "No" badge', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    render(
      createElement(Widget, {
        field: baseField,
        value: false,
        onChange: () => {},
        readOnly: true,
      }),
    )
    const badge = screen.getByText('No')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('bg-border-default/30')
    expect(badge.className).toContain('text-text-muted')
  })

  test('BooleanToggleWidget edit mode renders button with role=switch', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    render(
      createElement(Widget, {
        field: baseField,
        value: true,
        onChange: () => {},
        readOnly: false,
      }),
    )
    const btn = screen.getByRole('switch')
    expect(btn).toBeTruthy()
  })

  test('BooleanToggleWidget clicking toggles value', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    const onChange = vi.fn()
    render(
      createElement(Widget, {
        field: baseField,
        value: true,
        onChange,
        readOnly: false,
      }),
    )
    const btn = screen.getByRole('switch')
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('BooleanToggleWidget aria-checked matches value', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'boolean_toggle' }, 'boolean')
    const { rerender } = render(
      createElement(Widget, {
        field: baseField,
        value: true,
        onChange: () => {},
        readOnly: false,
      }),
    )
    let btn = screen.getByRole('switch') as HTMLButtonElement
    expect(btn.getAttribute('aria-checked')).toBe('true')

    rerender(
      createElement(Widget, {
        field: baseField,
        value: false,
        onChange: () => {},
        readOnly: false,
      }),
    )
    btn = screen.getByRole('switch') as HTMLButtonElement
    expect(btn.getAttribute('aria-checked')).toBe('false')
  })

  // ── EmailWidget ────────────────────────────────────────────────────

  test('resolves widget=email via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'email' }, 'char')
    expect(Widget).not.toBe(TYPE_WIDGETS.char)
  })

  test('EmailWidget readonly renders mailto link', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'email' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: 'user@example.com',
        onChange: () => {},
        readOnly: true,
      }),
    )
    const link = screen.getByText('user@example.com') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.href).toBe('mailto:user@example.com')
  })

  test('EmailWidget edit mode renders text input', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'email' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: 'user@example.com',
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByDisplayValue('user@example.com')).toBeTruthy()
  })

  test('EmailWidget empty value in readonly renders input fallback', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'email' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: '',
        onChange: () => {},
        readOnly: true,
      }),
    )
    // Empty value should fall through to CharWidget input
    const input = screen.getByDisplayValue('')
    expect(input).toBeTruthy()
    expect(input.tagName).toBe('INPUT')
  })

  // ── PhoneWidget ────────────────────────────────────────────────────

  test('resolves widget=phone via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'phone' }, 'char')
    expect(Widget).not.toBe(TYPE_WIDGETS.char)
  })

  test('PhoneWidget readonly renders tel link', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'phone' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: '+1234567890',
        onChange: () => {},
        readOnly: true,
      }),
    )
    const link = screen.getByText('+1234567890') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.href).toBe('tel:+1234567890')
  })

  test('PhoneWidget edit mode renders text input', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'phone' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: '+1234567890',
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByDisplayValue('+1234567890')).toBeTruthy()
  })

  // ── UrlWidget ──────────────────────────────────────────────────────

  test('resolves widget=url via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'url' }, 'char')
    expect(Widget).not.toBe(TYPE_WIDGETS.char)
  })

  test('UrlWidget readonly renders external link with target=_blank', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'url' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: 'https://example.com',
        onChange: () => {},
        readOnly: true,
      }),
    )
    const link = screen.getByText('https://example.com') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.href).toBe('https://example.com/')
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')
  })

  test('UrlWidget edit mode renders text input', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'url' }, 'char')
    render(
      createElement(Widget, {
        field: baseField,
        value: 'https://example.com',
        onChange: () => {},
        readOnly: false,
      }),
    )
    expect(screen.getByDisplayValue('https://example.com')).toBeTruthy()
  })

  // ── Many2OneAvatarWidget ─────────────────────────────────────────────

  test('resolves widget=many2one_avatar via WIDGET_OVERRIDES', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'many2one_avatar' }, 'many2one')
    expect(Widget).not.toBe(TYPE_WIDGETS.many2one)
  })

  test('Many2OneAvatarWidget readonly with avatar data renders img tag', async () => {
    mockCallKw.mockResolvedValue([{ avatar_128: 'dGVzdGF2YXRhcg==' }])
    const Widget = getFieldWidget({ ...baseField, widget: 'many2one_avatar' }, 'many2one')
    render(
      createElement(Widget, {
        field: baseField,
        value: [42, 'John Doe'],
        onChange: () => {},
        readOnly: true,
        meta: { relation: 'res.users' },
      }),
      { wrapper: queryWrapper },
    )
    await waitFor(() => {
      const img = document.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img?.getAttribute('src')).toContain('data:image/png;base64,dGVzdGF2YXRhcg==')
    })
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  test('Many2OneAvatarWidget readonly without avatar renders initials circle', async () => {
    mockCallKw.mockResolvedValue([{ avatar_128: false }])
    const Widget = getFieldWidget({ ...baseField, widget: 'many2one_avatar' }, 'many2one')
    render(
      createElement(Widget, {
        field: baseField,
        value: [42, 'Alice'],
        onChange: () => {},
        readOnly: true,
        meta: { relation: 'res.users' },
      }),
      { wrapper: queryWrapper },
    )
    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument()
    })
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('Many2OneAvatarWidget edit mode delegates to Many2OneWidget (renders input)', () => {
    const Widget = getFieldWidget({ ...baseField, widget: 'many2one_avatar' }, 'many2one')
    render(
      createElement(Widget, {
        field: baseField,
        value: [42, 'Bob'],
        onChange: () => {},
        readOnly: false,
        meta: { relation: 'res.users' },
      }),
      { wrapper: queryWrapper },
    )
    expect(screen.getByDisplayValue('Bob')).toBeTruthy()
    expect(screen.getByDisplayValue('Bob').tagName).toBe('INPUT')
  })
})
