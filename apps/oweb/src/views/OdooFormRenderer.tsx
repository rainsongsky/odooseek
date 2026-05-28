import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { callKw } from '../lib/api'
import { evalModifier, getDecorationClass as getDecoClass } from '../lib/expression-evaluator'
import type { ButtonElement, FormElement, HeaderElement, OdooFieldMeta } from '../lib/odoo-types'
import { parseFormXml } from '../lib/xml-parser'
import { getFieldWidget } from './field-widgets'

interface FormRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  recordId?: number
  onRecordCreated?: (newId: number) => void
}

export function OdooFormRenderer({
  model,
  arch,
  fields,
  recordId,
  onRecordCreated,
}: FormRendererProps) {
  const queryClient = useQueryClient()
  const formLayout = useMemo(() => parseFormXml(arch), [arch])
  const [editMode, setEditMode] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null)
  const onchangeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const newRecordId = !recordId ? 0 : recordId

  const headerElement = formLayout.elements.find((e): e is HeaderElement => e.type === 'header')
  const nonHeaderElements = formLayout.elements.filter((e) => e.type !== 'header')

  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'read', [[recordId], Object.keys(fields)]),
    enabled: !!recordId,
  })

  const triggerOnchange = useCallback(
    (fieldNames: string[], values: Record<string, unknown>) => {
      clearTimeout(onchangeTimer.current)
      onchangeTimer.current = setTimeout(async () => {
        const fieldsSpec: Record<string, unknown> = {}
        for (const k of Object.keys(fields)) fieldsSpec[k] = {}
        const result = await callKw<{
          value?: Record<string, unknown>
          warning?: { title: string; message: string; type: string }
        }>(
          model,
          'onchange',
          [newRecordId ? [newRecordId] : [], values, fieldNames, fieldsSpec],
          {},
        )
        if (result.value) {
          const normalized: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(result.value))
            normalized[k] = normalizeOnchangeValue(v, fields[k]?.type)
          setFormValues((prev) => ({ ...prev, ...normalized }))
        }
        if (result.warning) {
          setWarning(result.warning)
          setTimeout(() => setWarning(null), 5000)
        }
      }, 300)
    },
    [model, newRecordId, fields],
  )

  useEffect(() => {
    if (!recordId && !record) {
      callKw<Record<string, unknown>>(model, 'default_get', [Object.keys(fields)], {})
        .then((defaults) => {
          setFormValues(defaults)
          setEditMode(true)
          triggerOnchange([], defaults)
        })
        .catch(() => {
          setEditMode(true)
        })
    }
  }, [model, recordId, triggerOnchange, record, fields])

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      newRecordId
        ? callKw(model, 'write', [[newRecordId], values])
        : callKw(model, 'create', [values]),
    onSuccess: (result) => {
      if (!newRecordId && typeof result === 'number') {
        onRecordCreated?.(result)
      } else {
        queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
        setEditMode(false)
      }
    },
  })

  const handleChange = (name: string, value: unknown) => {
    setFormValues((prev) => {
      const next = { ...prev, [name]: value }
      triggerOnchange([name], next)
      return next
    })
  }

  const handleSave = () => {
    const missing: string[] = []
    for (const [name, meta] of Object.entries(fields)) {
      if (meta.required && !formValues[name]) missing.push(meta.string || name)
    }
    if (missing.length > 0) {
      setSaveError(`Required: ${missing.join(', ')}`)
      return
    }
    setSaveError(null)
    saveMutation.mutate(formValues)
  }

  const handleActionButton = useCallback(
    (btn: ButtonElement) => {
      if (!newRecordId) return
      if (btn.confirm && !window.confirm(btn.confirm)) return

      if (btn.buttonType === 'edit') {
        if (record?.[0]) {
          setFormValues({ ...record[0] })
          setEditMode(true)
        }
        return
      }

      if (btn.buttonType === 'object') {
        callKw(model, btn.name, [[newRecordId]])
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
          })
          .catch((err: unknown) => {
            setSaveError(err instanceof Error ? err.message : 'Action failed')
          })
      } else if (btn.buttonType === 'action') {
        const actionId = Number(btn.name)
        callKw('ir.actions.server', 'run', [[actionId]])
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
          })
          .catch((err: unknown) => {
            setSaveError(err instanceof Error ? err.message : 'Action failed')
          })
      }
    },
    [model, newRecordId, record, recordId, queryClient],
  )

  if (!formLayout)
    return <div className="p-6 text-sm text-text-muted">Failed to parse form XML</div>

  const currentRecord = editMode ? formValues : record?.[0]

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <HeaderBar
        headerElement={headerElement}
        stateField={fields.state}
        currentRecord={currentRecord}
        onAction={handleActionButton}
      />

      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-2">
        <h3 className="text-lg font-semibold text-text-primary">{formLayout.string || model}</h3>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-hover/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (record?.[0]) {
                  setFormValues({ ...record[0] })
                  setEditMode(true)
                }
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mx-6 mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-400">
          {saveError}
        </div>
      )}
      {warning && (
        <div className="mx-6 mt-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs text-yellow-400">
          <span className="font-medium">{warning.title}</span>: {warning.message}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="o_form_sheet mx-auto max-w-[860px] rounded-lg border border-border-subtle bg-surface p-6">
          <FormLayoutNode
            elements={nonHeaderElements}
            record={currentRecord}
            fields={fields}
            model={model}
            editMode={editMode}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  )
}

function HeaderBar({
  headerElement,
  stateField,
  currentRecord,
  onAction,
}: {
  headerElement?: HeaderElement
  stateField?: OdooFieldMeta
  currentRecord?: Record<string, unknown>
  onAction: (btn: ButtonElement) => void
}) {
  const stateSelection = stateField?.selection ?? []
  const stateValue = currentRecord?.state as string | undefined
  const stateIdx = stateSelection.findIndex(([k]) => k === stateValue)

  const visibleButtons = headerElement
    ? headerElement.buttons.filter((btn) => isButtonVisible(btn, currentRecord))
    : []

  if (stateSelection.length <= 1 && visibleButtons.length === 0) return null

  return (
    <div className="border-b border-border-subtle bg-surface px-6 py-3">
      {stateSelection.length > 1 && (
        <div className="mb-3 flex items-center gap-1">
          {stateSelection.map(([key, label], i) => {
            const isCurrent = key === stateValue
            const isPast = stateIdx >= 0 && i < stateIdx
            return (
              <div key={key} className="flex items-center gap-1">
                {i > 0 && (
                  <div className={`h-0.5 w-4 ${isPast ? 'bg-emerald-500' : 'bg-border-default'}`} />
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    isCurrent
                      ? 'bg-accent text-white'
                      : isPast
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-hover text-text-muted'
                  }`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {visibleButtons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleButtons.map((btn) => (
            <button
              key={btn.name}
              type="button"
              onClick={() => onAction(btn)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium ${
                btn.class?.includes('btn-primary')
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'border border-border-default text-text-secondary hover:bg-hover/50'
              }`}
            >
              {btn.icon && <span className="mr-1.5">{btn.icon}</span>}
              {btn.string || btn.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function isButtonVisible(btn: ButtonElement, record?: Record<string, unknown>): boolean {
  if (btn.invisible && evalModifier(btn.invisible, record)) return false
  if (btn.states) {
    const allowedStates = btn.states.split(',').map((s) => s.trim())
    const currentState = record?.state as string | undefined
    if (!currentState || !allowedStates.includes(currentState)) return false
  }
  return true
}

function normalizeOnchangeValue(v: unknown, fieldType?: string): unknown {
  if (fieldType === 'many2one' && v === false) return null
  return v
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
  onChange?: (n: string, v: unknown) => void
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
            className={`px-3 py-1.5 text-xs font-medium ${pi === activePage ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-text-primary'}`}
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

function FormLayoutNode({
  elements,
  record,
  fields,
  model,
  editMode,
  onChange,
  level = 0,
}: NodeProps) {
  return (
    <>
      {elements.map((el, i) => {
        switch (el.type) {
          case 'header':
            return null
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
          case 'button':
            return null
          case 'group': {
            const cols = el.col ?? 2
            return (
              <fieldset key={i} className="mb-4 rounded-lg border border-border-subtle p-4">
                {el.string && (
                  <legend className="px-2 text-xs font-medium text-text-secondary">
                    {el.string}
                  </legend>
                )}
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
            if (evalModifier(el.invisible !== undefined ? String(el.invisible) : undefined, record))
              return null
            if (editMode && SYSTEM_FIELDS.has(el.name)) return null
            const Widget = getFieldWidget(el, meta.type)
            const readOnly =
              !editMode ||
              evalModifier(el.readonly !== undefined ? String(el.readonly) : undefined, record) ||
              !!meta.readonly
            const deco = getDecoClass(el as unknown as Record<string, unknown>, record)
            return (
              <div key={i} className={deco}>
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

const SYSTEM_FIELDS = new Set([
  'id',
  'create_date',
  'create_uid',
  'write_date',
  'write_uid',
  'display_name',
])
