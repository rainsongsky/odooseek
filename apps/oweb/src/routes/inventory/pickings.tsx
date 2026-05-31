import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'
function InventoryPickings() {
  return <ModuleRoute model="stock.picking" defaultView="list" />
}
export const Route = createFileRoute("/inventory/pickings")({component: InventoryPickings, beforeLoad: requireAuth})
