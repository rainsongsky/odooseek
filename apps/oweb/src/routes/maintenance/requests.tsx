import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import {
  MAINTENANCE_ACTION_XML_ID,
  MAINTENANCE_REQUEST_MODEL,
  maintenanceRequestRecordPath,
} from '../../lib/maintenance'

function MaintenanceRequests() {
  return (
    <ModuleRoute
      model={MAINTENANCE_REQUEST_MODEL}
      actionXmlId={MAINTENANCE_ACTION_XML_ID.requests}
      listPath="/maintenance/requests"
      recordPath={maintenanceRequestRecordPath}
    />
  )
}

export const Route = createFileRoute('/maintenance/requests')({
  component: MaintenanceRequests,
  beforeLoad: requireAuth,
})
