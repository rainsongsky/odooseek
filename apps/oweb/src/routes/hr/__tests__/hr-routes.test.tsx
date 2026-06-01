import { describe, expect, test } from 'vitest'
import { resolveHrMenuRoute } from '../../../lib/hr'
import { resolveMenuRoute } from '../../../lib/menu-navigation'

describe('HR routes (via unified menu-navigation)', () => {
  test('maps Employees menu xmlid (not display name)', () => {
    expect(resolveHrMenuRoute({ name: 'Employees', xmlid: 'hr.menu_hr_employee_payroll' })).toBe(
      '/hr/employees',
    )
    expect(resolveHrMenuRoute({ name: 'Employees' })).toBeUndefined()
  })

  test('maps Directory menu xmlid', () => {
    expect(resolveHrMenuRoute({ xmlid: 'hr.menu_hr_employee' })).toBe('/hr/directory')
  })

  test('maps department xml fragment', () => {
    expect(resolveHrMenuRoute({ name: 'X', xmlid: 'hr.menu_hr_department_kanban' })).toBe(
      '/hr/departments',
    )
  })

  test('does not route by Chinese label alone', () => {
    expect(resolveHrMenuRoute({ name: '员工' })).toBeUndefined()
    expect(resolveMenuRoute({ name: '员工', actionID: 504 })).toMatchObject({
      kind: 'web',
      action: 504,
    })
  })

  test('resolveMenuRoute for hr.employee actionPath', () => {
    expect(
      resolveMenuRoute({
        xmlid: 'hr.menu_hr_root',
        actionID: 472,
        actionPath: 'employees',
      }),
    ).toMatchObject({ kind: 'module', to: '/hr/employees' })
  })
})
