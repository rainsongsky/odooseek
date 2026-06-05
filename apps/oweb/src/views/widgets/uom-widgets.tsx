import { FloatTimeWidget } from './basic'
import type { FieldWidgetProps } from './index'

export function TimesheetUomWidget(props: FieldWidgetProps) {
  return <FloatTimeWidget {...props} />
}

export function Many2OneUomWidget({ value, readOnly, meta, field }: FieldWidgetProps) {
  const display =
    Array.isArray(value) && value.length === 2
      ? `${value[1]}${meta?.relation ? '' : ''}`
      : value
        ? String(value)
        : ''

  if (readOnly) {
    return <span className="text-sm text-text-primary">{display || '—'}</span>
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={display}
        onChange={() => {}}
        readOnly
        placeholder={field.placeholder || 'Search...'}
        className="w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
      />
    </div>
  )
}
