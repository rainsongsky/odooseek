import { createFileRoute, useParams } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function AccountingMoveDetail() {
  const { id } = useParams({ from: '/accounting/move/$id' })
  return <OdooViewLoader model="account.move" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/accounting/move/$id')({
  component: AccountingMoveDetail,
  beforeLoad: requireAuth,
})
