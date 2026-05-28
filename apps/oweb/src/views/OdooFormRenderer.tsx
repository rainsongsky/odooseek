import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { callKw } from '../lib/api'
import { parseFormXml } from './xml-parser'
import { getFieldWidget } from './field-widgets'
import type { FormElement, OdooFieldMeta } from './types'

interface FormRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  recordId?: number
}

export function OdooFormRenderer({ model, arch, fields, recordId }: FormRendererProps) {
  const formLayout = useMemo(() => parseFormXml(arch), [arch])

  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () => {
      const fieldNames = Object.keys(fields)
      return callKw<Array<Record<string, unknown>>>(model, 'read', [[recordId], fieldNames])
    },
    enabled: !!recordId,
  })

  if (!formLayout) {
    return <div className="p-6 text-sm text-text-muted">Failed to parse form XML</div>
  }

  return (
    <div className="p-6">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">{formLayout.string || model}</h3>
      <FormLayoutNode
        elements={formLayout.elements}
        record={record?.[0]}
        fields={fields}
        model={model}
      />
    </div>
  )
}

interface NodeProps {
  elements: FormElement[]
  record?: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
  model: string
  level?: number
}

function NotebookRenderer({
  pages,
  record,
  fields,
  model,
  level,
}: {
  pages: { string: string; elements: FormElement[] }[]
  record?: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
  model: string
  level: number
}) {
  const [activePage, setActivePage] = useState(0)

  return (
    <div className="mb-4">
      <div className="flex gap-1 border-b border-border-subtle">
        {pages.map((page, pi) => (
          <button
            key={pi}
            type="button"
            onClick={() => setActivePage(pi)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              pi === activePage
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {page.string}
          </button>
        ))}
      </div>
      <div className="p-4">
        {pages[activePage] && (
          <FormLayoutNode
            elements={pages[activePage].elements}
            record={record}
            fields={fields}
            model={model}
            level={level + 1}
          />
        )}
      </div>
    </div>
  )
}

function FormLayoutNode({ elements, record, fields, model, level = 0 }: NodeProps) {
  return (
    <>
      {elements.map((el, i) => {
        switch (el.type) {
          case 'sheet':
            return (
              <FormLayoutNode
                key={i}
                elements={el.elements}
                record={record}
                fields={fields}
                model={model}
                level={level + 1}
              />
            )
          case 'group': {
            const cols = el.col ?? 2
            return (
              <fieldset key={i} className="mb-4 rounded-lg border border-border-subtle p-4">
                {el.string && (
                  <legend className="px-2 text-xs font-medium text-text-secondary">
                    {el.string}
                  </legend>
                )}
                <div
                  className={`grid gap-4`}
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                  <FormLayoutNode
                    elements={el.elements}
                    record={record}
                    fields={fields}
                    model={model}
                    level={level + 1}
                  />
                </div>
              </fieldset>
            )
          }
          case 'notebook':
            return (
              <NotebookRenderer
                key={i}
                pages={el.pages}
                record={record}
                fields={fields}
                model={model}
                level={level}
              />
            )
          case 'field': {
            const meta = fields[el.name]
            if (!meta) return null
            if (el.invisible && el.invisible >= 1) return null
            const Widget = getFieldWidget(el, meta.type)
            const readOnly = el.readonly || meta.readonly || !record
            return (
              <div key={i}>
                {!el.nolabel && (
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {el.string || meta.string || el.name}
                  </label>
                )}
                <Widget
                  field={el}
                  value={record?.[el.name]}
                  onChange={() => {}}
                  readOnly={readOnly}
                />
              </div>
            )
          }
          case 'separator':
            return <hr key={i} className="my-2 border-border-subtle" />
          case 'newline':
            return <div key={i} className="col-span-full" />
          case 'label':
            return (
              <span key={i} className="text-sm font-medium text-text-primary">
                {el.string}
              </span>
            )
          default:
            return null
        }
      })}
    </>
  )
}
