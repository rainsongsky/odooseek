import { createFileRoute } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmLeads() {
  return <OdooViewLoader model="crm.lead" viewType="list" domain={[['type', '=', 'lead']]} />
}

export const Route = createFileRoute('/crm/leads')({
  component: CrmLeads,
})
