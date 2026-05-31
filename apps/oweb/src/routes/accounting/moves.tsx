import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'
function AccountingMoves() {
  return <ModuleRoute model="account.move" defaultView="list" />
}
export const Route = createFileRoute("/accounting/moves")({component: AccountingMoves, beforeLoad: requireAuth})
