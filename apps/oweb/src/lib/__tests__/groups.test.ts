import { describe, expect, test } from 'vitest'
import { parseSessionGroups, userHasGroup } from '../groups'

describe('groups', () => {
  test('parseSessionGroups accepts object map', () => {
    expect(parseSessionGroups({ 'hr.group_hr_user': 42 })).toEqual({ 'hr.group_hr_user': 42 })
  })

  test('userHasGroup respects admin bypass', () => {
    expect(userHasGroup({}, 'hr.group_hr_user', { isAdmin: true })).toBe(true)
  })

  test('userHasGroup checks xml_id key', () => {
    expect(
      userHasGroup({ 'hr.group_hr_manager': 1 }, 'hr.group_hr_manager', { isAdmin: false }),
    ).toBe(true)
    expect(userHasGroup({ 'hr.group_hr_manager': 1 }, 'hr.group_hr_user', { isAdmin: false })).toBe(
      false,
    )
  })
})
