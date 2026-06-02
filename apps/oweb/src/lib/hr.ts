/** HR module constants and route/menu helpers. */

import { resolveMenuRoute } from './menu-navigation'

export const HR_EMPLOYEE_MODEL = 'hr.employee'
export const HR_EMPLOYEE_PUBLIC_MODEL = 'hr.employee.public'
export const HR_DEPARTMENT_MODEL = 'hr.department'
export const HR_VERSION_MODEL = 'hr.version'

/** Fields safe for directory / public employee views (Odoo hr.employee.public). */
export const HR_DIRECTORY_FIELDS = [
  'id',
  'display_name',
  'name',
  'active',
  'department_id',
  'job_id',
  'job_title',
  'parent_id',
  'coach_id',
  'work_email',
  'work_phone',
  'mobile_phone',
  'work_location_id',
  'company_id',
  'category_ids',
  'color',
  'image_128',
  'image_256',
] as const

/** @deprecated Use `resolveMenuRoute` from `menu-navigation.ts` (xmlid/actionPath/actionID). */
export function resolveHrMenuRoute(menu: {
  name?: string
  xmlid?: string
  actionID?: number | false
  actionPath?: string | false
}): string | undefined {
  const target = resolveMenuRoute({
    name: menu.name,
    xmlid: menu.xmlid,
    actionID: menu.actionID,
    actionPath: menu.actionPath,
  })
  return target?.kind === 'module' ? target.to : undefined
}

export function hrEmployeeRecordPath(id: number): string {
  return `/hr/employee/${id}`
}

export function hrDepartmentRecordPath(id: number): string {
  return `/hr/department/${id}`
}

export function resolveHrRecordPath(model: string, id: number): string | undefined {
  if (model === HR_EMPLOYEE_MODEL || model === HR_EMPLOYEE_PUBLIC_MODEL) {
    return hrEmployeeRecordPath(id)
  }
  if (model === HR_DEPARTMENT_MODEL) return hrDepartmentRecordPath(id)
  return undefined
}

export { navigateHrOrAction, navigateMenuEntry } from './menu-navigation'

export const HR_TRANSIENT_WIZARD_MODELS = new Set([
  'hr.departure.wizard',
  'hr.bank.account.allocation.wizard',
  'hr.version.wizard',
])
