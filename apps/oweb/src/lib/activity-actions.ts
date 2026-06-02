import type { OdooAction } from '@odooseek/odoo-client'

/** Transient models opened as dialogs must be created before the form loads. */
export const ACTIVITY_DIALOG_WIZARD_MODELS = new Set(['mail.activity.schedule'])

export function parseActionContext(context: OdooAction['context']): Record<string, unknown> {
  if (!context) return {}
  if (typeof context === 'object') return { ...context }
  if (typeof context === 'string') {
    try {
      const parsed = JSON.parse(context.replace(/'/g, '"')) as Record<string, unknown>
      return parsed ?? {}
    } catch {
      return {}
    }
  }
  return {}
}

export function mailActivityFormAction(opts: {
  resModel: string
  resId: number
  activityTypeId?: number
  activityId?: number
  title?: string
}): OdooAction {
  const context: Record<string, unknown> = {
    default_res_model: opts.resModel,
    default_res_id: opts.resId,
  }
  if (opts.activityTypeId != null) {
    context.default_activity_type_id = opts.activityTypeId
  }
  return {
    type: 'ir.actions.act_window',
    name: opts.title ?? 'Schedule Activity',
    res_model: 'mail.activity',
    view_mode: 'form',
    views: [[false, 'form']],
    target: 'new',
    res_id: opts.activityId,
    context,
  }
}

export function mailActivityScheduleAction(opts: {
  resModel: string
  resIds: number[]
  activityTypeId?: number
  title?: string
}): OdooAction {
  const context: Record<string, unknown> = {
    active_model: opts.resModel,
    active_ids: opts.resIds,
    active_id: opts.resIds[0],
  }
  if (opts.activityTypeId != null) {
    context.default_activity_type_id = opts.activityTypeId
  }
  const multi = opts.resIds.length > 1
  return {
    type: 'ir.actions.act_window',
    name: opts.title ?? (multi ? 'Schedule Activity On Selected Records' : 'Schedule Activity'),
    res_model: 'mail.activity.schedule',
    view_mode: 'form',
    views: [[false, 'form']],
    target: 'new',
    context,
  }
}
