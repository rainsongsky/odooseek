import { createFileRoute, useParams } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmLeadDetail() {
  const { id } = useParams({ from: '/crm/lead/$id' })
  return <OdooViewLoader model="crm.lead" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/crm/lead/$id')({
  component: CrmLeadDetail,
})
