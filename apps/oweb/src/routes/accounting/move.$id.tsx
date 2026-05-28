import { createFileRoute, redirect, useParams } from '@tanstack/react-router'
import { OdooViewLoader } from '../../views/OdooViewLoader'

function AccountingMoveDetail() {
  const { id } = useParams({ from: '/accounting/move/$id' })
  return <OdooViewLoader model="account.move" viewType="form" recordId={Number(id)} />
}

export const Route = createFileRoute('/accounting/move/$id')({
  component: AccountingMoveDetail,
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
