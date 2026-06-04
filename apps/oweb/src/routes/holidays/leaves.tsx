import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { HR_HOLIDAYS_ACTION_XML_ID, HR_LEAVE_MODEL, hrLeaveRecordPath } from '../../lib/holidays'

function HolidaysLeaves() {
  return (
    <ModuleRoute
      model={HR_LEAVE_MODEL}
      actionXmlId={HR_HOLIDAYS_ACTION_XML_ID.leaves}
      listPath="/holidays/leaves"
      recordPath={hrLeaveRecordPath}
    />
  )
}

export const Route = createFileRoute('/holidays/leaves')({
  component: HolidaysLeaves,
  beforeLoad: requireAuth,
})
