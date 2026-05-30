import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ActivityPanel } from '../components/ActivityPanel'
import { Chatter } from '../components/Chatter'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { callKw } from '../lib/api'
import { evalModifier, getDecorationClass as getDecoClass } from '../lib/expression-evaluator'
import type { ButtonElement, FormElement, HeaderElement, OdooFieldMeta } from '../lib/odoo-types'
import { parseFormXml } from '../lib/xml-parser'
import { getFieldWidget } from './field-widgets'

export interface OdooFormRendererRef {
  save: () => Promise<void>
}

interface FormRendererProps {
  model: string
  arch: string
  fields: Record<string, OdooFieldMeta>
  recordId?: number
  onRecordCreated?: (newId: number) => void
  onDirtyChange?: (dirty: boolean) => void
}

export const OdooFormRenderer = forwardRef(function OdooFormRenderer(
  { model, arch, fields, recordId, onRecordCreated, onDirtyChange }: FormRendererProps,
  ref: React.Ref<OdooFormRendererRef>,
) {
  const queryClient = useQueryClient()
  const confirmDialog = useConfirmDialog()
  const formLayout = useMemo(() => parseFormXml(arch), [arch])
  const [editMode, setEditMode] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null)
  const onchangeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const baselineRef = useRef<Record<string, unknown>>({})
  const newRecordId = !recordId ? 0 : recordId

  const headerElement = formLayout.elements.find((e): e is HeaderElement => e.type === 'header')
  const nonHeaderElements = formLayout.elements.filter((e) => e.type !== 'header')

  const { data: record } = useQuery({
    queryKey: ['odoo', 'read', model, recordId],
    queryFn: () =>
      callKw<Array<Record<string, unknown>>>(model, 'read', [[recordId], Object.keys(fields)]),
    enabled: !!recordId,
  })

  useEffect(() => {
    if (record?.[0]) {
      baselineRef.current = { ...record[0] }
    }
  }, [record])

  const isDirty = useMemo(() => {
    if (!editMode) return false
    const baseline = baselineRef.current
    if (!baseline || Object.keys(baseline).length === 0) return false
    return Object.keys(formValues).some((k) => formValues[k] !== baseline[k])
  }, [formValues, editMode])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const triggerOnchange = useCallback(
    (fieldNames: string[], values: Record<string, unknown>) => {
      clearTimeout(onchangeTimer.current)
      onchangeTimer.current = setTimeout(async () => {
        const fieldsSpec: Record<string, unknown> = {}
        for (const [k, meta] of Object.entries(fields))
          fieldsSpec[k] = meta.onChange ? { onChange: true } : {}
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
          baselineRef.current = { ...defaults }
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
        baselineRef.current = { ...formValues }
        queryClient.invalidateQueries({ queryKey: ['odoo', 'read', model, recordId] })
        setEditMode(false)
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    },
  })

  const handleChange = (name: string, value: unknown) => {
    setFormValues((prev) => {
      const next = { ...prev, [name]: value }
      triggerOnchange([name], next)
      return next
    })
  }

  const handleSave = useCallback(async (): Promise<void> => {
    const missing: string[] = []
    for (const [name, meta] of Object.entries(fields)) {
      if (meta.required && !formValues[name]) missing.push(meta.string || name)
    }
    if (missing.length > 0) {
      setSaveError(`Required: ${missing.join(', ')}`)
      return
    }
    setSaveError(null)
    await saveMutation.mutateAsync(formValues)
  }, [fields, formValues, saveMutation])

  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

  const handleActionButton = useCallback(
    (btn: ButtonElement) => {
      if (!newRecordId) return

      const executeAction = () => {
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
      }

      if (btn.confirm) {
        confirmDialog({
          title: 'Confirm',
          message: btn.confirm,
          confirmLabel: 'OK',
          variant: 'warning',
          onConfirm: executeAction,
        })
        return
      }

      executeAction()
    },
    [model, newRecordId, record, recordId, queryClient, confirmDialog],
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
        editMode={editMode}
        isDirty={isDirty}
        justSaved={justSaved}
        saveError={saveError}
        onEdit={() => {
          if (record?.[0]) {
            setFormValues({ ...record[0] })
            setEditMode(true)
          }
        }}
        onSave={handleSave}
        onCancel={() => {
          setFormValues({ ...baselineRef.current })
          setEditMode(false)
        }}
        isSaving={saveMutation.isPending}
      />

      {saveError && (
        <div className="mx-auto max-w-[860px] mt-2 rounded border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-400">
          {saveError}
        </div>
      )}
      {warning && (
        <div className="mx-auto max-w-[860px] mt-2 rounded border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs text-yellow-400">
          <span className="font-medium">{warning.title}</span>: {warning.message}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-0">
        <div className="o_form_sheet mx-auto max-w-[860px] border-y border-border-subtle bg-surface px-6 py-5">
          <FormLayoutNode
            elements={nonHeaderElements}
            record={currentRecord}
            fields={fields}
            model={model}
            editMode={editMode}
            onChange={handleChange}
          />
        </div>
        <div className="mx-auto max-w-[860px]">
          <ActivityPanel model={model} recordId={recordId} />
          <Chatter model={model} recordId={recordId} />
        </div>
      </div>
    </div>
  )
})

function HeaderBar({
  headerElement,
  stateField,
  currentRecord,
  onAction,
  editMode,
  isDirty,
  justSaved,
  saveError,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  headerElement?: HeaderElement
  stateField?: OdooFieldMeta
  currentRecord?: Record<string, unknown>
  onAction: (btn: ButtonElement) => void
  editMode: boolean
  isDirty: boolean
  justSaved: boolean
  saveError: string | null
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  const stateSelection = stateField?.selection ?? []
  const stateValue = currentRecord?.state as string | undefined
  const stateIdx = stateSelection.findIndex(([k]) => k === stateValue)

  const visibleButtons = headerElement
    ? headerElement.buttons.filter((btn) => isButtonVisible(btn, currentRecord))
    : []

  const hasContent = stateSelection.length > 1 || visibleButtons.length > 0 || editMode

  if (!hasContent) {
    return (
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-2">
        <div className="flex items-center gap-2">
          <span />
        </div>
        <ActionButtons
          editMode={editMode}
          isDirty={isDirty}
          justSaved={justSaved}
          saveError={saveError}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          isSaving={isSaving}
        />
      </div>
    )
  }

  return (
    <div className="border-b border-border-subtle bg-surface px-6 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {stateSelection.length > 1 && (
            <div className="flex items-center">
              {stateSelection.map(([key, label], i) => {
                const isCurrent = key === stateValue
                const isPast = stateIdx >= 0 && i < stateIdx
                const isFirst = i === 0
                const isLast = i === stateSelection.length - 1
                return (
                  <div key={key} className="flex items-center">
                    <span
                      className={`px-3 py-1 text-[11px] font-medium ${
                        isCurrent
                          ? 'bg-accent text-white'
                          : isPast
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-gray-100 text-text-muted'
                      } ${isFirst && !isCurrent ? 'rounded-l' : ''} ${isLast && !isCurrent ? 'rounded-r' : ''} ${isCurrent && isFirst ? 'rounded-l' : ''} ${isCurrent && isLast ? 'rounded-r' : ''}`}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {visibleButtons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleButtons.map((btn, i) => (
                <button
                  key={`${btn.name}-${i}`}
                  type="button"
                  onClick={() => onAction(btn)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    btn.class?.includes('btn-primary')
                      ? 'bg-accent text-white hover:bg-accent/90 rounded'
                      : 'text-text-secondary hover:bg-hover rounded'
                  }`}
                >
                  {btn.icon && <span className="mr-1">{btn.icon}</span>}
                  {btn.string || btn.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <ActionButtons
          editMode={editMode}
          isDirty={isDirty}
          justSaved={justSaved}
          saveError={saveError}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
}

function ActionButtons({
  editMode,
  isDirty,
  justSaved,
  saveError,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}: {
  editMode: boolean
  isDirty: boolean
  justSaved: boolean
  saveError: string | null
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {saveError && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Invalid
        </span>
      )}
      {isDirty && (
        <span className="flex items-center gap-1 text-xs text-amber-500">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Unsaved
        </span>
      )}
      {justSaved && !isDirty && (
        <span className="flex items-center gap-1 text-xs text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Saved
        </span>
      )}
      {editMode ? (
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs font-medium text-text-secondary hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="rounded bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90"
        >
          Edit
        </button>
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
  pages: { string: string; invisible?: string; elements: FormElement[] }[]
  record?: Record<string, unknown>
  fields: Record<string, OdooFieldMeta>
  model: string
  editMode?: boolean
  onChange?: (n: string, v: unknown) => void
  level: number
}) {
  const [activePage, setActivePage] = useState(0)
  const visiblePages = useMemo(
    () => pages.filter((p) => !evalModifier(p.invisible, record)),
    [pages, record],
  )
  const safeActive = Math.min(activePage, visiblePages.length - 1)
  return (
    <div className="mt-4">
      <div className="flex border-b border-border-subtle">
        {visiblePages.map((page, pi) => (
          <button
            key={pi}
            type="button"
            onClick={() => setActivePage(pi)}
            className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              pi === safeActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
            }`}
          >
            {page.string}
          </button>
        ))}
      </div>
      <div className="py-4">
        {visiblePages[safeActive] && (
          <FormLayoutNode
            elements={visiblePages[safeActive].elements}
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
            if (evalModifier(el.invisible, record)) return null
            const cols = el.col ?? 2
            return (
              <div key={i} className="mb-4">
                {el.string && (
                  <div className="mb-2 text-xs font-semibold text-text-secondary">{el.string}</div>
                )}
                <div
                  className="grid gap-x-6 gap-y-2"
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
              </div>
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
            if (evalModifier(el.invisible, record)) return null
            if (editMode && SYSTEM_FIELDS.has(el.name)) return null
            const Widget = getFieldWidget(el, meta.type)
            let fieldReadonly = !!meta.readonly
            if (el.readonly !== undefined) {
              fieldReadonly =
                typeof el.readonly === 'string' ? evalModifier(el.readonly, record) : el.readonly
            }
            const readOnly = !editMode || fieldReadonly
            let fieldRequired = !!meta.required
            if (el.required !== undefined) {
              fieldRequired =
                typeof el.required === 'string' ? evalModifier(el.required, record) : el.required
            }
            const deco = getDecoClass(el as unknown as Record<string, unknown>, record)
            if (el.nolabel) {
              return (
                <div key={i} className={deco}>
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
            return (
              <div
                key={i}
                className={`grid items-baseline gap-x-3 ${deco ?? ''}`}
                style={{ gridTemplateColumns: 'auto 1fr' }}
              >
                <label className="truncate text-xs font-medium text-text-secondary py-1 text-right">
                  {el.string || meta.string || el.name}
                  {editMode && fieldRequired && <span className="ml-0.5 text-red-400">*</span>}
                </label>
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
