import { describe, expect, test } from 'vitest'
import { passesXmlGroups } from '../field-access'

describe('passesXmlGroups', () => {
  const session = {
    groups: { 'hr.group_hr_user': 10 },
    is_admin: false,
    is_system: false,
  }

  test('empty groups attr allows all', () => {
    expect(passesXmlGroups(undefined, session)).toBe(true)
  })

  test('user with matching group passes', () => {
    expect(passesXmlGroups('hr.group_hr_user', session)).toBe(true)
  })

  test('user without matching group fails', () => {
    expect(passesXmlGroups('hr.group_hr_manager', session)).toBe(false)
  })

  test('comma-separated OR semantics', () => {
    expect(passesXmlGroups('hr.group_hr_manager,hr.group_hr_user', session)).toBe(true)
  })
})
