import { createFileRoute, redirect } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function AccountingMoves() {
  return <OdooViewLoader model="account.move" viewType="list" />
}

export const Route = createFileRoute('/accounting/moves')({
  component: AccountingMoves,
  beforeLoad: async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'include' })
      if (!res.ok) throw redirect({ to: '/login' })
      if (!(await res.json()).authenticated) throw redirect({ to: '/login' })
    } catch (e) {
      if (e instanceof Response || e instanceof redirect) throw e
      throw redirect({ to: '/login' })
    }
  },
})
