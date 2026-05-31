import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

function CrmPipeline() {
  return (
    <ModuleRoute model="crm.lead" defaultView="kanban" domain={[['type', '=', 'opportunity']]} />
  )
}

export const Route = createFileRoute('/crm/pipeline')({
  component: CrmPipeline,
  beforeLoad: requireAuth,
})
