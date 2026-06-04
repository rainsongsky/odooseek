/** HR Holidays module constants and route helpers. */

export const HR_LEAVE_MODEL = 'hr.leave'
export const HR_LEAVE_TYPE_MODEL = 'hr.leave.type'
export const HR_LEAVE_ALLOCATION_MODEL = 'hr.leave.allocation'

export const HR_HOLIDAYS_ACTION_XML_ID = {
  leaves: 'hr_leave_action',
  allocations: 'hr_leave_allocation_action',
} as const

export function hrLeaveRecordPath(id: number): string {
  return `/holidays/leave/${id}`
}

export function resolveHolidaysRecordPath(model: string, id: number): string | undefined {
  if (model === HR_LEAVE_MODEL) return hrLeaveRecordPath(id)
  return undefined
}
