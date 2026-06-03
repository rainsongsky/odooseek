import { describe, expect, test } from 'vitest'
import { type GroupCheckSession, hasGroup } from '../auth'

describe('hasGroup', () => {
  const session: GroupCheckSession = {
    is_admin: false,
    is_system: false,
    groups: { 'hr.group_hr_manager': 1 },
  }

  test('returns true for matching group', () => {
    expect(hasGroup('hr.group_hr_manager', session)).toBe(true)
  })

  test('returns false for non-matching group', () => {
    expect(hasGroup('hr.group_hr_user', session)).toBe(false)
  })

  test('returns true when is_admin', () => {
    expect(hasGroup('any.group', { is_admin: true, is_system: false })).toBe(true)
  })

  test('returns true when is_system', () => {
    expect(hasGroup('any.group', { is_system: true, is_admin: false })).toBe(true)
  })

  test('returns false when no session', () => {
    expect(hasGroup('hr.group_hr_user', undefined)).toBe(false)
  })

  test('returns false when empty groups', () => {
    expect(hasGroup('hr.group_hr_user', { is_admin: false, is_system: false, groups: {} })).toBe(
      false,
    )
  })
})
