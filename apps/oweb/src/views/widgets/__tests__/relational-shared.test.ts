import { describe, expect, test } from 'vitest'
import { encodeM2mValue, normalizeM2mValue, normalizeO2mValue } from '../relational/shared'

describe('normalizeM2mValue', () => {
  test('returns empty array for falsy value', () => {
    expect(normalizeM2mValue(false)).toEqual([])
    expect(normalizeM2mValue(null)).toEqual([])
    expect(normalizeM2mValue(undefined)).toEqual([])
  })

  test('parses [[6, 0, [1, 2, 3]]] format', () => {
    const input = [[6, 0, [1, 2, 3]]]
    // normalizeM2mValue sees Array.isArray(input) → true
    // Array.isArray(input[0]) → true → returns as-is
    expect(normalizeM2mValue(input)).toEqual(input)
  })

  test('parses flat [id, display_name] tuples', () => {
    const input = [
      [1, 'Admin'],
      [2, 'Demo'],
    ]
    // Array.isArray(input[0]) → true → returns as-is
    expect(normalizeM2mValue(input)).toEqual(input)
  })

  test('parses flat number array into pairs', () => {
    // i=0: [1, '2']; i=2: value.length-1=3, i=2 < 3, but value[3] is undefined → pair [3, '']
    // Loop: i<3, i+=2: i=0 ok, i=2 ok (2 < 3)
    // Actually for [1, 2, 3, 4]: length=4, i<3: i=0→[1,'2'], i=2→[3,'4']
    // For [1, 2, 3]: length=3, i<2: i=0→[1,'2'], i=2 fails (2<2 is false)
    expect(normalizeM2mValue([1, 2])).toEqual([[1, '2']])
    expect(normalizeM2mValue([1, 2, 3, 4])).toEqual([
      [1, '2'],
      [3, '4'],
    ])
  })

  test('returns empty for single id', () => {
    // Only one number → i=0: value[1] is not a number → returns []
    expect(normalizeM2mValue([5])).toEqual([])
  })
})

describe('encodeM2mValue', () => {
  test('encodes tags to [[6, 0, ids]] format', () => {
    const tags: Array<[number, string]> = [
      [1, 'A'],
      [2, 'B'],
    ]
    expect(encodeM2mValue(tags)).toEqual([[6, 0, [1, 2]]])
  })

  test('returns [[6, 0, []]] for empty tags', () => {
    // encodeM2mValue always returns [[6, 0, ids]], even for empty
    expect(encodeM2mValue([])).toEqual([[6, 0, []]])
  })
})

describe('normalizeO2mValue', () => {
  test('returns empty array for falsy', () => {
    expect(normalizeO2mValue(false)).toEqual([])
    expect(normalizeO2mValue(undefined)).toEqual([])
  })

  test('extracts IDs from numeric arrays', () => {
    expect(normalizeO2mValue([10, 20])).toEqual([10, 20])
  })

  test('returns empty for non-numeric-first-element arrays', () => {
    // [[6, 0, ids]] has first element [6, 0, ...] which is array, not number
    expect(normalizeO2mValue([[6, 0, [10, 20]]])).toEqual([])
  })
})
