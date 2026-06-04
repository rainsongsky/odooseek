import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/holidays/')({
  beforeLoad: () => {
    throw redirect({ to: '/holidays/leaves' })
  },
})
