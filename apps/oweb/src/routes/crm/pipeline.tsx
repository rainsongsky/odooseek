import { createFileRoute } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmPipeline() {
  return <OdooViewLoader model="crm.lead" viewType="kanban" domain={[['type', '=', 'opportunity']]} />
}

export const Route = createFileRoute('/crm/pipeline')({
  component: CrmPipeline,
})
