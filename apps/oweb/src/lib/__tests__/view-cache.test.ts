/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cacheKey, getCachedViews, setCachedViews } from '../view-cache'

const store: Record<string, string> = {}

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
    store[k] = v
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((k: string) => {
    delete store[k]
  })
  vi.spyOn(Storage.prototype, 'key').mockImplementation((idx: number) => {
    const keys = Object.keys(store)
    return keys[idx] ?? null
  })
  Object.defineProperty(Storage.prototype, 'length', {
    get: () => Object.keys(store).length,
    configurable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const k of Object.keys(store)) delete store[k]
})

describe('view-cache', () => {
  test('getCachedViews returns null for missing key', () => {
    expect(getCachedViews('nonexistent')).toBeNull()
  })

  test('setCachedViews then getCachedViews returns data', () => {
    const key = cacheKey('res.partner', [[false, 'list']])
    const data = { views: { list: { arch: '<list>', id: 1 } } }
    setCachedViews(key, data)
    expect(getCachedViews(key)).toEqual(data)
  })

  test('TTL expiry returns null', () => {
    const key = cacheKey('res.partner', [[false, 'list']])
    const data = { views: {} }

    // Manually insert an expired entry
    const prefix = 'oweb_views_'
    store[prefix + key] = JSON.stringify({ timestamp: Date.now() - 2 * 60 * 60 * 1000, data })

    expect(getCachedViews(key)).toBeNull()
    // Verify the expired item was removed
    expect(store[prefix + key]).toBeUndefined()
  })

  test('LRU eviction removes oldest entries', () => {
    // Fill more than MAX_ENTRIES (20)
    for (let i = 0; i < 25; i++) {
      const key = `model${i}:f:list`
      setCachedViews(key, { i })
    }

    // The oldest 5 should have been evicted
    const prefix = 'oweb_views_'
    for (let i = 0; i < 5; i++) {
      expect(store[`${prefix}model${i}:f:list`]).toBeUndefined()
    }

    // The newest 20 should still be present
    for (let i = 5; i < 25; i++) {
      expect(store[`${prefix}model${i}:f:list`]).toBeDefined()
    }
  })

  test('cacheKey generates consistent keys', () => {
    const views: [number | false, string][] = [
      [false, 'list'],
      [false, 'search'],
    ]
    expect(cacheKey('res.partner', views)).toBe('res.partner:f:list,f:search')
    expect(cacheKey('crm.lead', [[42, 'form']])).toBe('crm.lead:42:form')
  })

  test('getCachedViews returns null on corrupt data', () => {
    const prefix = 'oweb_views_'
    const key = 'test:corrupt'
    store[prefix + key] = 'not-valid-json{{{'
    expect(getCachedViews(key)).toBeNull()
  })
})
