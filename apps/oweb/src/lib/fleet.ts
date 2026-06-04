/** Fleet module constants and route helpers. */

export const FLEET_VEHICLE_MODEL = 'fleet.vehicle'

export const FLEET_ACTION_XML_ID = {
  vehicles: 'fleet.fleet_vehicle_action',
} as const

export function fleetVehicleRecordPath(id: number): string {
  return `/fleet/vehicle/${id}`
}

export function resolveFleetRecordPath(model: string, id: number): string | undefined {
  if (model === FLEET_VEHICLE_MODEL) return fleetVehicleRecordPath(id)
  return undefined
}
