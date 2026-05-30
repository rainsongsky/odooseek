import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmLeads() {
  return <OdooViewLoader model="crm.lead" viewType="list" domain={[['type', '=', 'lead']]} />
}

export const Route = createFileRoute('/crm/leads')({
  component: CrmLeads,
  beforeLoad: requireAuth,
})
