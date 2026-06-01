import { createFileRoute } from '@tanstack/react-router'
import { ModuleRoute } from '../../components/ModuleRoute'
import { requireAuth } from '../../lib/auth'
import { HR_DEPARTMENT_MODEL } from '../../lib/hr'

function HrDepartments() {
  return (
    <ModuleRoute
      model={HR_DEPARTMENT_MODEL}
      defaultView="kanban"
      listPath="/hr/departments"
      recordPath={(id) => `/hr/department/${id}`}
    />
  )
}

export const Route = createFileRoute('/hr/departments')({
  component: HrDepartments,
  beforeLoad: requireAuth,
})
