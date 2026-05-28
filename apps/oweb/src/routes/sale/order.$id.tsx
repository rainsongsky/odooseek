import { createFileRoute, redirect, useParams } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function SaleOrderDetail() {
  const { id } = useParams({ from: '/sale/order/$id' })
  return <OdooViewLoader model="sale.order" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/sale/order/$id')({
  component: SaleOrderDetail,
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
