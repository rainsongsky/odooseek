import { describe, expect, test } from 'vitest'
import { PresenceIcon, resolvePresenceState } from '../PresenceIcon'

describe('resolvePresenceState', () => {
  test('uses value when known', () => {
    expect(resolvePresenceState(undefined, 'away')).toBe('away')
  })

  test('reads from record fields', () => {
    expect(resolvePresenceState({ hr_presence_state: 'present' })).toBe('present')
  })

  test('defaults to absent', () => {
    expect(resolvePresenceState({}, 'unknown_xyz')).toBe('absent')
  })
})

describe('PresenceIcon', () => {
  test('renders present state', () => {
    const result = PresenceIcon({
      field: {} as never,
      value: 'present',
      onChange: () => {},
      readOnly: true,
    })
    expect(result).toBeTruthy()
  })
})
