import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { OdooFieldMeta } from '../../lib/odoo-types'
import { OdooGraphRenderer } from '../OdooGraphRenderer'

const mockCallKw = vi.fn()
vi.mock('../../lib/api', () => ({
  callKw: (...args: unknown[]) => mockCallKw(...args),
  readGroup: (...args: unknown[]) => mockCallKw(...args),
}))

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const barArch = `<graph string="Sales">
  <field name="stage_id" type="row"/>
  <field name="amount" type="measure" operator="sum"/>
</graph>`

const fields: Record<string, OdooFieldMeta> = {
  stage_id: {
    name: 'stage_id',
    type: 'many2one',
    string: 'Stage',
    required: false,
    readonly: false,
    store: true,
    searchable: true,
    sortable: true,
  },
  amount: {
    name: 'amount',
    type: 'float',
    string: 'Amount',
    required: false,
    readonly: false,
    store: true,
    searchable: true,
    sortable: true,
  },
}

describe('OdooGraphRenderer', () => {
  test('renders graph title', async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockCallKw.mockResolvedValue([
      { stage_id: 'New', amount: 1000 },
      { stage_id: 'Won', amount: 5000 },
    ])

    render(<OdooGraphRenderer model="crm.lead" arch={barArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
    })
  })

  test('shows loading spinner', () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockCallKw.mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <OdooGraphRenderer model="crm.lead" arch={barArch} fields={fields} />,
      { wrapper },
    )

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  test('shows error on failure', async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockCallKw.mockRejectedValue(new Error('Network error'))

    render(<OdooGraphRenderer model="crm.lead" arch={barArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
