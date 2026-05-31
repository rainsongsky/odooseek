import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/auth'
import { ModuleRoute } from '../../components/ModuleRoute'

function AccountingMoveForm() {
  const { id } = Route.useParams()
  return <ModuleRoute model="account.move" defaultView="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/accounting/move/$id')({
  component: AccountingMoveForm,
  beforeLoad: requireAuth,
})
