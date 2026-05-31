import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'
function SaleOrders() {
  return <ModuleRoute model="sale.order" defaultView="list" />
}
export const Route = createFileRoute("/sale/orders")({component: SaleOrders, beforeLoad: requireAuth})
