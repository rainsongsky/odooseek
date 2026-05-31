import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { OdooFieldMeta } from '@odooseek/odoo-client'
import { OdooKanbanRenderer } from '../OdooKanbanRenderer'

const { mockCallKw, mockReadGroup } = vi.hoisted(() => ({
  mockCallKw: vi.fn(),
  mockReadGroup: vi.fn(),
}))

vi.mock('@odooseek/odoo-client', async (original) => {
  const actual = await original()
  return {
    ...actual as Record<string, unknown>,
    ...{
  callKw: mockCallKw,
  readGroup: mockReadGroup,
}
  }
})
vi.mock('../../components/ConfirmDialog', () => ({
  useConfirmDialog: () => vi.fn(),
}))

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const simpleKanbanArch = `<kanban>
  <field name="name"/>
  <field name="expected_revenue"/>
  <field name="partner_id"/>
  <templates>
    <t t-name="card">
      <field name="name" class="fw-bold"/>
      <field name="expected_revenue"/>
    </t>
  </templates>
</kanban>`

const kanbanFields: Record<string, OdooFieldMeta> = {
  name: { name: 'name', type: 'char', string: 'Name', required: true, readonly: false, store: true, searchable: true, sortable: true },
  expected_revenue: { name: 'expected_revenue', type: 'monetary', string: 'Revenue', required: false, readonly: false, store: true, searchable: true, sortable: true },
  partner_id: { name: 'partner_id', type: 'many2one', string: 'Partner', required: false, readonly: false, relation: 'res.partner', store: true, searchable: true, sortable: true },
}

const sampleRecords = [
  { id: 1, name: 'Opportunity A', expected_revenue: 5000, partner_id: [1, 'Company A'] },
  { id: 2, name: 'Opportunity B', expected_revenue: 3000, partner_id: [2, 'Company B'] },
]

describe('OdooKanbanRenderer', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockCallKw.mockReset()
    mockReadGroup.mockReset()
    mockCallKw.mockResolvedValue(sampleRecords)
    mockReadGroup.mockResolvedValue([])
  })

  test('renders kanban cards from search_read data', async () => {
    mockCallKw.mockResolvedValue(sampleRecords)

    render(
      <OdooKanbanRenderer
        model="crm.lead"
        arch={simpleKanbanArch}
        fields={kanbanFields}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Opportunity A')).toBeInTheDocument()
    })
    expect(screen.getByText('Opportunity B')).toBeInTheDocument()
  })

  test('renders columns when groupBy is set', async () => {
    render(
      <OdooKanbanRenderer
        model="crm.lead"
        arch={simpleKanbanArch}
        fields={kanbanFields}
        groupBy={['partner_id']}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getAllByText('Opportunity A').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Opportunity B').length).toBeGreaterThan(0)
    })
  })

  test('shows loading state initially', () => {
    mockCallKw.mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <OdooKanbanRenderer
        model="crm.lead"
        arch={simpleKanbanArch}
        fields={kanbanFields}
      />,
      { wrapper },
    )

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
