import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'

function CrmPipeline() {
  return <ModuleRoute model="crm.lead" defaultView="kanban" domain={[['type', '=', 'opportunity']]} />
}

export const Route = createFileRoute('/crm/pipeline')({
  component: CrmPipeline,
  beforeLoad: requireAuth,
})
