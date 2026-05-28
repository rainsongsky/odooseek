import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sale/')({
  beforeLoad: () => {
    throw redirect({ to: '/sale/orders' })
  },
})
