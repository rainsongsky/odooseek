import { describe, expect, test } from 'vitest'
import { parseWebSearch } from '../web-search'

describe('parseWebSearch', () => {
  test('coerces action query string to number', () => {
    expect(parseWebSearch({ action: '472' }).action).toBe(472)
  })

  test('drops invalid action', () => {
    expect(parseWebSearch({ action: 'nope' }).action).toBeUndefined()
  })
})
