import { createFileRoute, redirect } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmLeads() {
  return <OdooViewLoader model="crm.lead" viewType="list" domain={[['type', '=', 'lead']]} />
}

export const Route = createFileRoute('/crm/leads')({
  component: CrmLeads,
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
