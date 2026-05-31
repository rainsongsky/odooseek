import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'

function CrmLeadForm() {
  const { id } = Route.useParams()
  return <ModuleRoute model="crm.lead" defaultView="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/crm/lead/$id')({
  component: CrmLeadForm,
  beforeLoad: requireAuth,
})
