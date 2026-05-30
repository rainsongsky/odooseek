import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function AccountingMoves() {
  return <OdooViewLoader model="account.move" viewType="list" />
}

export const Route = createFileRoute('/accounting/moves')({
  component: AccountingMoves,
  beforeLoad: requireAuth,
})
