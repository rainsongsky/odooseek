import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'
function CrmLeads() {
  return <ModuleRoute model="crm.lead" defaultView="list" domain={[["type", "=", "lead"]]} />
}
export const Route = createFileRoute("/crm/leads")({component: CrmLeads, beforeLoad: requireAuth})
