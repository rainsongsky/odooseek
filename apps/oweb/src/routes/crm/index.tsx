import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/crm/')({
  beforeLoad: () => {
    throw redirect({ to: '/crm/pipeline' })
  },
})
