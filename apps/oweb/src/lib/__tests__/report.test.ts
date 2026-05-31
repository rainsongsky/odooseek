/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { generateReport } from '../report'

describe('generateReport', () => {
  const mockOpen = vi.fn()
  const originalOpen = window.open
  const mockFetch = vi.fn()

  function mockCallKwResponse(result: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.open = mockOpen
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    window.open = originalOpen
    vi.unstubAllGlobals()
  })

  test('calls callKw with correct args to read the report action', async () => {
    mockCallKwResponse([
      {
        report_name: 'sale.report_saleorder',
        report_type: 'pdf',
        model: 'sale.order',
        binding_view_types: 'form',
      },
    ])

    await generateReport(42, [1, 2, 3])

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string)
    expect(body.params).toEqual({
      model: 'ir.actions.report',
      method: 'read',
      args: [[42], ['report_name', 'report_type', 'model', 'binding_view_types']],
      kwargs: {},
    })
  })

  test('opens a new window with the correct URL for PDF', async () => {
    mockCallKwResponse([
      {
        report_name: 'sale.report_saleorder',
        report_type: 'pdf',
        model: 'sale.order',
      },
    ])

    await generateReport(42, [1, 2])

    expect(mockOpen).toHaveBeenCalledTimes(1)
    const url = mockOpen.mock.calls[0][0]
    expect(url).toContain('/api/report/download?')
    expect(url).toContain('report_id=42')
    expect(url).toContain('ids=1%2C2')
    expect(url).toContain('report_type=pdf')
    expect(mockOpen.mock.calls[0][1]).toBe('_blank')
  })

  test('opens a new window with xlsx extension when report_type is xlsx', async () => {
    mockCallKwResponse([
      {
        report_name: 'account.report_invoice',
        report_type: 'xlsx',
        model: 'account.move',
      },
    ])

    await generateReport(99, [10])

    const url = mockOpen.mock.calls[0][0]
    expect(url).toContain('report_type=xlsx')
  })

  test('defaults to pdf when report_type is empty', async () => {
    mockCallKwResponse([
      {
        report_name: 'sale.report_saleorder',
        report_type: '',
        model: 'sale.order',
      },
    ])

    await generateReport(42, [1])

    const url = mockOpen.mock.calls[0][0]
    expect(url).toContain('report_type=pdf')
  })

  test('throws if report action not found', async () => {
    mockCallKwResponse([])

    await expect(generateReport(999, [1])).rejects.toThrow('Report action 999 not found')
  })

  test('throws if report action is undefined', async () => {
    mockCallKwResponse([undefined])

    await expect(generateReport(123, [1])).rejects.toThrow('Report action 123 not found')
  })
})
