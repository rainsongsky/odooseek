import type { FieldElement, ListColumn, OdooFieldMeta } from '@odooseek/odoo-client'
import { createElement } from 'react'
import { getFieldWidget } from '../widgets'
import { isNonField } from './listUtils'

export function InlineEditRow({
  columns,
  fieldElements,
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  isSaving,
  validationErrors = {},
}: {
  columns: ListColumn[]
  fieldElements: (FieldElement | null)[]
  fields: Record<string, OdooFieldMeta>
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  validationErrors?: Record<string, string>
}) {
  return (
    <tr className="border-b border-border-subtle bg-accent/5">
      <td className="w-10 px-2 py-2" />
      {columns.map((col, ci) => {
        if (isNonField(col)) {
          return <td key={`new-${ci}`} className="px-2 py-2" />
        }
        const meta = fields[col.name]
        const isReadonly = meta?.readonly || col.readonly
        const fe = fieldElements[ci] as FieldElement
        const Widget = getFieldWidget(fe, meta?.type ?? 'char')
        const errMsg = validationErrors[col.name]
        const hasRequiredErr = errMsg === 'Required'
        const hasTypeErr = !!errMsg && !hasRequiredErr
        const errRing = hasRequiredErr
          ? ' ring-1 ring-danger ring-inset'
          : hasTypeErr
            ? ' ring-1 ring-warning ring-inset'
            : ''
        return (
          <td
            key={`new-${col.name}-${ci}`}
            className={`whitespace-nowrap px-1 py-0.5${errRing}`}
            title={errMsg ?? undefined}
          >
            {createElement(Widget, {
              field: fe,
              value: values[col.name],
              onChange: (v: unknown) => onChange(col.name, v),
              readOnly: isReadonly,
              meta,
            })}
          </td>
        )
      })}
      <td className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
        >
          {isSaving ? '...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-secondary hover:bg-hover"
        >
          Cancel
        </button>
      </td>
    </tr>
  )
}
