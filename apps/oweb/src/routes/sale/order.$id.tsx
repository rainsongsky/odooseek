import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'

function SaleOrderForm() {
  const { id } = Route.useParams()
  return <ModuleRoute model="sale.order" defaultView="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/sale/order/$id')({
  component: SaleOrderForm,
  beforeLoad: requireAuth,
})
