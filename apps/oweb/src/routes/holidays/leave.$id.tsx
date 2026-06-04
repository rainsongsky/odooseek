import { createFileRoute, redirect } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { HR_LEAVE_MODEL, hrLeaveRecordPath } from '../../lib/holidays'

function HolidayLeaveForm() {
  const { id } = Route.useParams()
  const recordId = Number(id)
  if (!Number.isFinite(recordId) || recordId <= 0) {
    return <div className="p-6 text-sm text-text-muted">Invalid leave id</div>
  }
  return (
    <ModuleRoute
      model={HR_LEAVE_MODEL}
      fallbackView="form"
      recordId={recordId}
      listPath="/holidays/leaves"
      recordPath={hrLeaveRecordPath}
    />
  )
}

export const Route = createFileRoute('/holidays/leave/$id')({
  component: HolidayLeaveForm,
  beforeLoad: requireAuth,
  parseParams: ({ id }) => {
    const n = Number(id)
    if (!Number.isFinite(n) || n <= 0) throw redirect({ to: '/holidays/leaves' })
    return { id: String(n) }
  },
})
