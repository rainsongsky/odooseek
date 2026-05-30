import { createFileRoute, useParams } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function InventoryPickingDetail() {
  const { id } = useParams({ from: '/inventory/picking/$id' })
  return <OdooViewLoader model="stock.picking" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/inventory/picking/$id')({
  component: InventoryPickingDetail,
  beforeLoad: requireAuth,
})
