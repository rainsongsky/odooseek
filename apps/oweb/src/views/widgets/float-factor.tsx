import type { FieldWidgetProps } from './index'

export function FloatFactorWidget({ value, onChange, readOnly, field }: FieldWidgetProps) {
  const num = Number(value ?? 0)
  const opts = (field.options as Record<string, unknown>) ?? {}
  const step = Number(opts.step ?? opts.factor ?? 1)
  const min = opts.min !== undefined ? Number(opts.min) : undefined
  const max = opts.max !== undefined ? Number(opts.max) : undefined

  if (readOnly) {
    return <span className="text-sm text-text-primary">{num}</span>
  }

  const adjust = (delta: number) => {
    let next = num + delta * step
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(Number(next.toFixed(4)))
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => adjust(-1)}
        className="flex h-6 w-6 items-center justify-center rounded border border-border-default text-text-muted hover:bg-hover"
      >
        −
      </button>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={num}
        onChange={(e) => onChange(e.target.value !== '' ? Number(e.target.value) : null)}
        className="w-20 border-0 border-b border-border-default bg-transparent px-1 py-2 text-center text-sm text-text-primary focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={() => adjust(1)}
        className="flex h-6 w-6 items-center justify-center rounded border border-border-default text-text-muted hover:bg-hover"
      >
        +
      </button>
    </div>
  )
}
