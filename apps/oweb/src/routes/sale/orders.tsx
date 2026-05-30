import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function SaleOrders() {
  return <OdooViewLoader model="sale.order" viewType="list" />
}

export const Route = createFileRoute('/sale/orders')({
  component: SaleOrders,
  beforeLoad: requireAuth,
})
