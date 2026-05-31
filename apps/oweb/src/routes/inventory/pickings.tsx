import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

function InventoryPickings() {
  return <ModuleRoute model="stock.picking" defaultView="list" />
}
export const Route = createFileRoute('/inventory/pickings')({
  component: InventoryPickings,
  beforeLoad: requireAuth,
})
