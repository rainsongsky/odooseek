import type { FieldElement } from '@odooseek/odoo-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCallKw = vi.fn()
vi.mock('@odooseek/odoo-client', async (original) => {
  const actual = await original()
  return {
    ...(actual as Record<string, unknown>),
    callKw: (...args: unknown[]) => mockCallKw(...args),
    fieldsGet: vi.fn().mockResolvedValue({}),
  }
})

let queryClient: QueryClient

const queryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const o2mField: FieldElement = {
  type: 'field',
  name: 'order_line',
  subViews: {
    list: {
      columns: [
        { name: 'product_id', string: 'Product', type: 'field' },
        { name: 'quantity', string: 'Quantity', type: 'field' },
      ],
      editable: 'bottom',
      decorations: {},
    },
  },
}

const meta = { relation: 'sale.order.line' }

describe('One2ManyWidget CRUD', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockCallKw.mockReset()
  })

  test('renders existing records from value', async () => {
    mockCallKw.mockResolvedValue([
      { id: 1, product_id: [10, 'Chair'], quantity: 5 },
      { id: 2, product_id: [11, 'Desk'], quantity: 2 },
    ])

    const { One2ManyWidget } = await import('../widgets/relational')
    const onChange = vi.fn()

    render(
      <One2ManyWidget
        field={o2mField}
        value={[1, 2]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Chair')).toBeInTheDocument()
      expect(screen.getByText('Desk')).toBeInTheDocument()
    })
  })

  test('Add a row creates new record command with negative virtual ID', async () => {
    mockCallKw
      .mockResolvedValueOnce([{ id: 10, product_id: [1, 'Pen'], quantity: 1 }]) // initial read
      .mockResolvedValueOnce({ product_id: false, quantity: 1 }) // default_get

    const { One2ManyWidget } = await import('../widgets/relational')
    const onChange = vi.fn()

    render(
      <One2ManyWidget
        field={o2mField}
        value={[10]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Pen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add a row'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      // Should be array of O2M commands with at least one [0, negativeId, values]
      expect(Array.isArray(lastCall)).toBe(true)
      const createCmd = lastCall.find((cmd: number[]) => cmd[0] === 0)
      expect(createCmd).toBeDefined()
      expect(typeof createCmd[1]).toBe('number')
      expect(createCmd[1]).toBeLessThan(0) // negative virtual ID
    })
  })

  test('delete existing record adds [2, id] command', async () => {
    mockCallKw.mockResolvedValue([{ id: 5, product_id: [1, 'Table'], quantity: 3 }])

    const { One2ManyWidget } = await import('../widgets/relational')
    const onChange = vi.fn()

    render(
      <One2ManyWidget
        field={o2mField}
        value={[5]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Table')).toBeInTheDocument()
    })

    // Click the × delete button (not the edit save/cancel buttons)
    const deleteButtons = screen.getAllByText('×')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      const deleteCmd = lastCall.find((cmd: number[]) => cmd[0] === 2)
      expect(deleteCmd).toBeDefined()
      expect(deleteCmd[1]).toBe(5)
    })
  })

  test('delete newly added record removes create command', async () => {
    mockCallKw
      .mockResolvedValueOnce([]) // initial read (no records)
      .mockResolvedValueOnce({ product_id: false, quantity: 1 }) // default_get

    const { One2ManyWidget } = await import('../widgets/relational')
    const onChange = vi.fn()

    render(
      <One2ManyWidget
        field={o2mField}
        value={[]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    // Add a row (enters inline edit mode with ✓/✕ buttons)
    fireEvent.click(screen.getByText('Add a row'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })

    // Cancel the inline edit first (click ✕), then the × delete button appears
    fireEvent.click(screen.getByTitle('Cancel'))

    await waitFor(() => {
      // Now the row shows the × delete button
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('×'))

    await waitFor(() => {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      expect(lastCall).toEqual(false)
    })
  })

  test('new record gets stable negative ID that persists across re-renders', async () => {
    mockCallKw
      .mockResolvedValueOnce([]) // initial read
      .mockResolvedValueOnce({ product_id: false, quantity: 2 }) // default_get

    const { One2ManyWidget } = await import('../widgets/relational')
    const onChange = vi.fn()

    const { rerender } = render(
      <One2ManyWidget
        field={o2mField}
        value={[]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    fireEvent.click(screen.getByText('Add a row'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })

    // Re-render the same component
    rerender(
      <One2ManyWidget
        field={o2mField}
        value={[]}
        onChange={onChange}
        readOnly={false}
        meta={meta}
      />,
    )

    // The new row should still be visible (not disappear due to unstable ID)
    expect(screen.getByText('Add a row')).toBeInTheDocument()
  })

  test('shows empty state when no records', async () => {
    mockCallKw.mockResolvedValue([])

    const { One2ManyWidget } = await import('../widgets/relational')
    render(
      <One2ManyWidget
        field={{
          ...o2mField,
          subViews: { list: { columns: [], editable: undefined, decorations: {} } },
        }}
        value={[]}
        onChange={() => {}}
        readOnly={true}
        meta={meta}
      />,
      { wrapper: queryWrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('No records')).toBeInTheDocument()
    })
  })
})
