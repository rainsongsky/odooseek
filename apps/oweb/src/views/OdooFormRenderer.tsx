import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { callKw } from '../lib/api'
import { parseFormXml } from '../lib/xml-parser'
import { getFieldWidget } from './field-widgets'
import type { FormElement, OdooFieldMeta } from '../lib/odoo-types'

interface FormRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  recordId?: number
}

export function OdooFormRenderer({ model, arch, fields, recordId }: FormRendererProps) {
  const queryClient = useQueryClient()
  const formLayout = useMemo(() => parseFormXml(arch), [arch])
    const [editMode, setEditMode] = useState(false)
    const [formValues, setFormValues] = useState<Record<string, unknown>>({})
    const [saveError, setSaveError] = useState<string | null>(null)

  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () => {
      const fieldNames = Object.keys(fields)
      return callKw<Array<Record<string, unknown>>>(model, 'read', [[recordId], fieldNames])
    },
    enabled: !!recordId,
  })

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      callKw(model, 'write', [[recordId], values]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
      setEditMode(false)
    },
  })

  const handleEdit = () => {
    if (record?.[0]) {
      setFormValues({ ...record[0] })
      setEditMode(true)
    }
  }

  const handleCancel = () => {
    setEditMode(false)
  }

  const handleChange = (name: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    // Validate required fields
    const missing: string[] = []
    for (const [name, meta] of Object.entries(fields)) {
      if (meta.required && !formValues[name]) {
        missing.push(meta.string || name)
      }
    }
    if (missing.length > 0) {
      setSaveError(`Required: ${missing.join(', ')}`)
      return
    }
    setSaveError(null)
    saveMutation.mutate(formValues)
  }

  if (!formLayout) {
    return <div className="p-6 text-sm text-text-muted">Failed to parse form XML</div>
  }

  const currentRecord = editMode ? formValues : record?.[0]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{formLayout.string || model}</h3>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-400">
          {saveError}
        </div>
      )}
      <FormLayoutNode
        elements={formLayout.elements}
        record={currentRecord}
        fields={fields}
        model={model}
        editMode={editMode}
        onChange={handleChange}
      />
    </div>
  )
}

interface NodeProps {
  elements: FormElement[]
  record?: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
  model: string
  editMode?: boolean
  onChange?: (name: string, value: unknown) => void
  level?: number
}

function NotebookRenderer({
  pages,
  record,
  fields,
  model,
  editMode,
  onChange,
  level,
}: {
  pages: { string: string; elements: FormElement[] }[]
  record?: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
  model: string
  editMode?: boolean
  onChange?: (name: string, value: unknown) => void
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
            editMode={editMode}
            onChange={onChange}
            level={level + 1}
          />
        )}
      </div>
    </div>
  )
}

function FormLayoutNode({ elements, record, fields, model, editMode, onChange, level = 0 }: NodeProps) {
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
                editMode={editMode}
                onChange={onChange}
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
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                >
                  <FormLayoutNode
                    elements={el.elements}
                    record={record}
                    fields={fields}
                    model={model}
                    editMode={editMode}
                    onChange={onChange}
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
                editMode={editMode}
                onChange={onChange}
                level={level}
              />
            )
          case 'field': {
            const meta = fields[el.name]
            if (!meta) return null
            if (el.invisible && el.invisible >= 1) return null
            // Skip system fields in edit mode
            if (editMode && SYSTEM_FIELDS.has(el.name)) return null
            const Widget = getFieldWidget(el, meta.type)
            const readOnly = !editMode || !!(el.readonly ?? meta.readonly)
            return (
              <div key={i}>
                {!el.nolabel && (
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {el.string || meta.string || el.name}
                    {editMode && meta.required && <span className="ml-0.5 text-red-400">*</span>}
                  </label>
                )}
                <Widget
                  field={el}
                  value={record?.[el.name]}
                  onChange={(v) => onChange?.(el.name, v)}
                  readOnly={readOnly}
                  meta={meta}
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

const SYSTEM_FIELDS = new Set(['id', 'create_date', 'create_uid', 'write_date', 'write_uid', 'display_name'])
