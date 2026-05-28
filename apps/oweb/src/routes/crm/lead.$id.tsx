import { createFileRoute, redirect, useParams } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function CrmLeadDetail() {
  const { id } = useParams({ from: '/crm/lead/$id' })
  return <OdooViewLoader model="crm.lead" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/crm/lead/$id')({
  component: CrmLeadDetail,
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
