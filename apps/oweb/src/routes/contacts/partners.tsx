import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'

const PARTNER_MODEL = 'res.partner'

function ContactsPartners() {
  return (
    <ModuleRoute
      model={PARTNER_MODEL}
      defaultView="kanban"
      listPath="/contacts/partners"
      recordPath={(id) => `/contacts/partner/${id}`}
    />
  )
}

export const Route = createFileRoute('/contacts/partners')({
  component: ContactsPartners,
  beforeLoad: requireAuth,
})
