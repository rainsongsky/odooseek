import { createFileRoute, useParams } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function SaleOrderDetail() {
  const { id } = useParams({ from: '/sale/order/$id' })
  return <OdooViewLoader model="sale.order" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/sale/order/$id')({
  component: SaleOrderDetail,
  beforeLoad: requireAuth,
})
