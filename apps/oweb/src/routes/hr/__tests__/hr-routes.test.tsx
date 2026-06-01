import { describe, expect, test } from 'vitest'
import { resolveHrMenuRoute } from '../../../lib/hr'

describe('HR routes', () => {
  test('maps Employees menu label', () => {
    expect(resolveHrMenuRoute({ name: 'Employees' })).toBe('/hr/employees')
  })

  test('maps Directory menu label', () => {
    expect(resolveHrMenuRoute({ name: 'Directory' })).toBe('/hr/directory')
  })

  test('maps department xml fragment', () => {
    expect(resolveHrMenuRoute({ name: 'X', xmlid: 'hr.menu_hr_department_kanban' })).toBe(
      '/hr/departments',
    )
  })
})
