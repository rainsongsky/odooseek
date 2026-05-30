import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function InventoryPickings() {
  return <OdooViewLoader model="stock.picking" viewType="list" />
}

export const Route = createFileRoute('/inventory/pickings')({
  component: InventoryPickings,
  beforeLoad: requireAuth,
})
