import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

function AccountingMoves() {
  return <ModuleRoute model="account.move" defaultView="list" />
}
export const Route = createFileRoute('/accounting/moves')({
  component: AccountingMoves,
  beforeLoad: requireAuth,
})
