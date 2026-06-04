/** Maintenance module constants and route helpers. */

export const MAINTENANCE_REQUEST_MODEL = 'maintenance.request'
export const MAINTENANCE_EQUIPMENT_MODEL = 'maintenance.equipment'

export const MAINTENANCE_ACTION_XML_ID = {
  requests: 'maintenance.maintenance_request_action',
  equipment: 'maintenance.equipment_action',
} as const

export function maintenanceRequestRecordPath(id: number): string {
  return `/maintenance/request/${id}`
}

export function maintenanceEquipmentRecordPath(id: number): string {
  return `/maintenance/equipment/${id}`
}

export function resolveMaintenanceRecordPath(model: string, id: number): string | undefined {
  if (model === MAINTENANCE_REQUEST_MODEL) return maintenanceRequestRecordPath(id)
  if (model === MAINTENANCE_EQUIPMENT_MODEL) return maintenanceEquipmentRecordPath(id)
  return undefined
}
