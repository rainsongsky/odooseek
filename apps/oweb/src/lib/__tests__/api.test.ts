import { describe, expect, test } from 'vitest'
import { callKw, searchRead, fieldsGet, read } from '../api'

describe('api', () => {
  test('searchRead generates correct args', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [{ id: 1, name: 'Test' }] }),
    })
    global.fetch = mockFetch

    const result = await searchRead('res.partner', [], ['id', 'name'])
    expect(result).toEqual([{ id: 1, name: 'Test' }])

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.model).toBe('res.partner')
    expect(body.params.method).toBe('search_read')
    expect(body.params.args[0]).toEqual([])
    expect(body.params.args[1]).toEqual(['id', 'name'])
  })

  test('read generates correct args with ids', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [{ id: 1 }] }),
    })
    global.fetch = mockFetch

    await read('res.partner', [1, 2], ['id'])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.args[0]).toEqual([1, 2])
    expect(body.params.args[1]).toEqual(['id'])
  })

  test('callKw includes credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    })
    global.fetch = mockFetch

    await callKw('ir.model', 'search_read', [[], ['name']])
    expect(mockFetch.mock.calls[0][1].credentials).toBe('include')
  })

  test('fieldsGet generates correct args', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: {} }),
    })
    global.fetch = mockFetch

    await fieldsGet('res.partner', [], ['string', 'type'])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.method).toBe('fields_get')
    expect(body.params.kwargs.attributes).toEqual(['string', 'type'])
  })
})
