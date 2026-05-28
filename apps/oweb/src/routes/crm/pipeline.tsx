import { createFileRoute, redirect } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmPipeline() {
  return (
    <OdooViewLoader model="crm.lead" viewType="kanban" domain={[['type', '=', 'opportunity']]} />
  )
}

export const Route = createFileRoute('/crm/pipeline')({
  component: CrmPipeline,
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'include' })
      if (!res.ok) throw redirect({ to: '/login' })
      const data = await res.json()
      if (!data.authenticated) throw redirect({ to: '/login' })
    } catch (e) {
      if (e instanceof Response || e instanceof redirect) throw e
      throw redirect({ to: '/login' })
    }
  },
})
