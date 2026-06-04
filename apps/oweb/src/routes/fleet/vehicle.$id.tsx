import { createFileRoute, redirect } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { FLEET_VEHICLE_MODEL, fleetVehicleRecordPath } from '../../lib/fleet'

function FleetVehicleForm() {
  const { id } = Route.useParams()
  const recordId = Number(id)
  if (!Number.isFinite(recordId) || recordId <= 0) {
    return <div className="p-6 text-sm text-text-muted">Invalid vehicle id</div>
  }
  return (
    <ModuleRoute
      model={FLEET_VEHICLE_MODEL}
      fallbackView="form"
      recordId={recordId}
      listPath="/fleet/vehicles"
      recordPath={fleetVehicleRecordPath}
    />
  )
}

export const Route = createFileRoute('/fleet/vehicle/$id')({
  component: FleetVehicleForm,
  beforeLoad: requireAuth,
  parseParams: ({ id }) => {
    const n = Number(id)
    if (!Number.isFinite(n) || n <= 0) throw redirect({ to: '/fleet/vehicles' })
    return { id: String(n) }
  },
})
