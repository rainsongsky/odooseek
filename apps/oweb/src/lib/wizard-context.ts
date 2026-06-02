/** Enrich Odoo wizard context with defaults expected by HR transient models. */
export function enrichWizardContext(context: Record<string, unknown>): Record<string, unknown> {
  const activeId = context.active_id as number | undefined
  const enriched = { ...context }
  if (activeId && context.active_model === 'hr.employee') {
    enriched.default_employee_id = activeId
  }
  return enriched
}

type WizardFieldDef = { type?: string }

/** Map Odoo read() values to form state. */
export function recordToWizardValues(
  record: Record<string, unknown>,
  fieldNames: string[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const name of fieldNames) {
    const raw = record[name]
    if (raw === false || raw == null) {
      values[name] = ''
      continue
    }
    if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === 'number') {
      values[name] = raw[0]
      continue
    }
    values[name] = raw
  }
  return values
}

/** Coerce form values for wizard write(). */
export function wizardValuesToWrite(
  values: Record<string, unknown>,
  fieldDefs: Record<string, WizardFieldDef>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(values)) {
    if (value === '' || value === undefined) continue
    const type = fieldDefs[name]?.type
    if (type === 'many2one') {
      const id = Number(value)
      if (Number.isFinite(id)) out[name] = id
      continue
    }
    if (type === 'boolean') {
      out[name] = Boolean(value)
      continue
    }
    out[name] = value
  }
  return out
}
