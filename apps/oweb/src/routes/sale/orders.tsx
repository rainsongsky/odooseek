import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

function SaleOrders() {
  return <ModuleRoute model="sale.order" defaultView="list" />
}
export const Route = createFileRoute('/sale/orders')({
  component: SaleOrders,
  beforeLoad: requireAuth,
})
