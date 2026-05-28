/// <reference types="vitest" />
import { describe, expect, test, vi } from 'vitest'
import { callKw, fieldsGet, getViews, read, readGroup, searchRead } from '../api'

describe('api', () => {
  test('searchRead generates correct args', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [{ id: 1, name: 'Test' }] }),
    })
    globalThis.fetch = mockFetch

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
    globalThis.fetch = mockFetch

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
    globalThis.fetch = mockFetch

    await callKw('ir.model', 'search_read', [[], ['name']])
    expect(mockFetch.mock.calls[0][1].credentials).toBe('include')
  })

  test('fieldsGet generates correct args', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: {} }),
    })
    globalThis.fetch = mockFetch

    await fieldsGet('res.partner', [], ['string', 'type'])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.method).toBe('fields_get')
    expect(body.params.kwargs.attributes).toEqual(['string', 'type'])
  })

  test('getViews generates correct args', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: {} }),
    })
    globalThis.fetch = mockFetch

    await getViews(
      'crm.lead',
      [
        [false, 'list'],
        [false, 'search'],
      ],
      { toolbar: true },
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.method).toBe('get_views')
    expect(body.params.args[0]).toEqual([
      [false, 'list'],
      [false, 'search'],
    ])
    expect(body.params.kwargs.options.toolbar).toBe(true)
  })

  test('readGroup generates correct args with lazy', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [] }),
    })
    globalThis.fetch = mockFetch

    await readGroup('crm.lead', [['type', '=', 'opportunity']], ['expected_revenue'], ['stage_id'])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.method).toBe('read_group')
    expect(body.params.kwargs.lazy).toBe(true)
  })

  test('throws on Odoo RPC error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: { code: 200, message: 'Access Error' } }),
    })
    globalThis.fetch = mockFetch

    await expect(callKw('model', 'method', [])).rejects.toThrow('Odoo Error')
  })

  test('throws on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })
    globalThis.fetch = mockFetch

    await expect(callKw('model', 'method', [])).rejects.toThrow('HTTP 500')
  })

  test('callKw passes kwargs correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    })
    globalThis.fetch = mockFetch

    await callKw('model', 'method', [], { key: 'value', nested: { a: 1 } })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.params.kwargs).toEqual({ key: 'value', nested: { a: 1 } })
  })

  test('getViews and readGroup return result', async () => {
    const mockResult = { views: {} }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: mockResult }),
    })
    globalThis.fetch = mockFetch

    const viewsResult = await getViews('crm.lead', [[false, 'list']])
    expect(viewsResult).toBe(mockResult)

    const groupResult = await readGroup('crm.lead', [], ['revenue'], ['stage_id'])
    expect(groupResult).toBe(mockResult)
  })
})
