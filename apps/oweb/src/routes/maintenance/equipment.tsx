import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import {
  MAINTENANCE_ACTION_XML_ID,
  MAINTENANCE_EQUIPMENT_MODEL,
  maintenanceEquipmentRecordPath,
} from '../../lib/maintenance'

function MaintenanceEquipment() {
  return (
    <ModuleRoute
      model={MAINTENANCE_EQUIPMENT_MODEL}
      actionXmlId={MAINTENANCE_ACTION_XML_ID.equipment}
      listPath="/maintenance/equipment"
      recordPath={maintenanceEquipmentRecordPath}
    />
  )
}

export const Route = createFileRoute('/maintenance/equipment')({
  component: MaintenanceEquipment,
  beforeLoad: requireAuth,
})
