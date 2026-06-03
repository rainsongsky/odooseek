import { useCallback, useRef, useState } from 'react'
import type { FieldWidgetProps } from './index'

const MODES = ['python', 'xml', 'javascript', 'qweb', 'scss', 'json', 'text'] as const

function CodeEditorInner({
  value,
  onChange,
  readOnly,
  mode,
}: {
  value: unknown
  onChange: (v: unknown) => void
  readOnly?: boolean
  mode: string
}) {
  const text = String(value ?? '')
  const lines = text.split('\n')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newText = `${text.slice(0, start)}  ${text.slice(end)}`
        onChange(newText)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        })
      }
    },
    [readOnly, text, onChange],
  )

  return (
    <div className="flex font-mono text-xs">
      <div className="select-none pr-2 pt-2 text-right text-text-muted border-r border-border-subtle">
        {lines.map((_, i) => (
          <div key={i} className="leading-5">
            {i + 1}
          </div>
        ))}
      </div>
      {readOnly ? (
        <pre className="flex-1 overflow-auto px-2 pt-2 text-text-primary">{text}</pre>
      ) : (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 resize-none overflow-auto border-0 bg-transparent px-2 pt-2 text-text-primary leading-5 outline-none"
          rows={Math.max(5, lines.length)}
        />
      )}
    </div>
  )
}

export function CodeEditorWidget({ value, onChange, readOnly, field }: FieldWidgetProps) {
  const opts = (field.options as Record<string, unknown>) ?? {}
  const [mode, setMode] = useState<string>((opts.mode as string) ?? 'text')

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded border border-border-default bg-transparent px-1 py-0 text-xs text-text-secondary"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-text-muted">
          {readOnly ? 'read-only' : `${String(value ?? '').length} chars`}
        </span>
      </div>
      <div className="rounded border border-border-subtle bg-surface overflow-hidden">
        <CodeEditorInner value={value} onChange={onChange} readOnly={readOnly} mode={mode} />
      </div>
    </div>
  )
}
