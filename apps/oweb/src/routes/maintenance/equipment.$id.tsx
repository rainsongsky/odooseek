import { createFileRoute, redirect } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { MAINTENANCE_EQUIPMENT_MODEL, maintenanceEquipmentRecordPath } from '../../lib/maintenance'

function MaintenanceEquipmentForm() {
  const { id } = Route.useParams()
  const recordId = Number(id)
  if (!Number.isFinite(recordId) || recordId <= 0) {
    return <div className="p-6 text-sm text-text-muted">Invalid equipment id</div>
  }
  return (
    <ModuleRoute
      model={MAINTENANCE_EQUIPMENT_MODEL}
      fallbackView="form"
      recordId={recordId}
      listPath="/maintenance/equipment"
      recordPath={maintenanceEquipmentRecordPath}
    />
  )
}

export const Route = createFileRoute('/maintenance/equipment/$id')({
  component: MaintenanceEquipmentForm,
  beforeLoad: requireAuth,
  parseParams: ({ id }) => {
    const n = Number(id)
    if (!Number.isFinite(n) || n <= 0) throw redirect({ to: '/maintenance/equipment' })
    return { id: String(n) }
  },
})
