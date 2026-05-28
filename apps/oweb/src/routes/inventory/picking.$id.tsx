import { createFileRoute, redirect, useParams } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function InventoryPickingDetail() {
  const { id } = useParams({ from: '/inventory/picking/$id' })
  return <OdooViewLoader model="stock.picking" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/inventory/picking/$id')({
  component: InventoryPickingDetail,
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'include' })
      if (!res.ok) throw redirect({ to: '/login' })
      if (!(await res.json()).authenticated) throw redirect({ to: '/login' })
    } catch (e) {
      if (e instanceof Response || e instanceof redirect) throw e
      throw redirect({ to: '/login' })
    }
  },
})
