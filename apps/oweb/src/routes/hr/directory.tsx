import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { HR_EMPLOYEE_PUBLIC_MODEL } from '../../lib/hr'

function HrDirectory() {
  return (
    <ModuleRoute
      model={HR_EMPLOYEE_PUBLIC_MODEL}
      defaultView="kanban"
      domain={[['active', '=', true]]}
      listPath="/hr/directory"
      recordPath={(id) => `/hr/employee/${id}`}
    />
  )
}

export const Route = createFileRoute('/hr/directory')({
  component: HrDirectory,
  beforeLoad: requireAuth,
})
