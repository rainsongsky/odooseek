import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

function CrmLeads() {
  return <ModuleRoute model="crm.lead" defaultView="list" domain={[['type', '=', 'lead']]} />
}
export const Route = createFileRoute('/crm/leads')({ component: CrmLeads, beforeLoad: requireAuth })
