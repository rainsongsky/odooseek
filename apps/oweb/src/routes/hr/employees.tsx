import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { HR_EMPLOYEE_MODEL } from '../../lib/hr'

function HrEmployees() {
  return (
    <ModuleRoute
      model={HR_EMPLOYEE_MODEL}
      defaultView="kanban"
      listPath="/hr/employees"
      recordPath={(id) => `/hr/employee/${id}`}
      availableViews={['kanban', 'list', 'activity', 'graph', 'pivot']}
    />
  )
}

export const Route = createFileRoute('/hr/employees')({
  component: HrEmployees,
  beforeLoad: requireAuth,
})
