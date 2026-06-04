import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { FLEET_ACTION_XML_ID, FLEET_VEHICLE_MODEL, fleetVehicleRecordPath } from '../../lib/fleet'

function FleetVehicles() {
  return (
    <ModuleRoute
      model={FLEET_VEHICLE_MODEL}
      actionXmlId={FLEET_ACTION_XML_ID.vehicles}
      listPath="/fleet/vehicles"
      recordPath={fleetVehicleRecordPath}
    />
  )
}

export const Route = createFileRoute('/fleet/vehicles')({
  component: FleetVehicles,
  beforeLoad: requireAuth,
})
