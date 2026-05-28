import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { OdooFieldMeta } from '../../lib/odoo-types'
import { OdooListRenderer } from '../OdooListRenderer'

const mockCallKw = vi.fn()
const mockReadGroup = vi.fn()
vi.mock('../../lib/api', () => ({
  callKw: (...args: any[]) => mockCallKw(...args),
  readGroup: (...args: any[]) => mockReadGroup(...args),
}))

vi.mock('../../lib/expression-evaluator', () => ({
  getDecorationClass: () => '',
}))

vi.mock('use-intl', () => ({
  useTranslations: () => (key: string, params?: any) => {
    const map: Record<string, string> = {
      'list.noRecords': 'No records',
      'list.prev': 'Prev',
      'list.next': 'Next',
      'list.page': `Page ${params?.page ?? 1}`,
      'list.failedToLoad': 'Failed to load',
    }
    return map[key] ?? key
  },
}))

let queryClient: QueryClient
let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const listArch = `<list string="Contacts">
  <field name="name"/>
  <field name="email"/>
</list>`

const fields: Record<string, OdooFieldMeta> = {
  name: {
    name: 'name',
    type: 'char',
    string: 'Name',
    required: false,
    readonly: false,
    store: true,
    searchable: true,
    sortable: true,
  },
  email: {
    name: 'email',
    type: 'char',
    string: 'Email',
    required: false,
    readonly: false,
    store: true,
    searchable: true,
    sortable: true,
  },
}

describe('OdooListRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWrapper()
  })

  test('renders table header with column labels', async () => {
    mockCallKw
      .mockResolvedValueOnce([{ id: 1, name: 'Test', email: 't@t.com' }])
      .mockResolvedValueOnce(1)

    render(<OdooListRenderer model="res.partner" arch={listArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
    })
  })

  test('renders data rows', async () => {
    mockCallKw
      .mockResolvedValueOnce([
        { id: 1, name: 'Alice', email: 'a@b.com' },
        { id: 2, name: 'Bob', email: 'b@c.com' },
      ])
      .mockResolvedValueOnce(2)

    render(<OdooListRenderer model="res.partner" arch={listArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  test('clicking row triggers onRowClick', async () => {
    const onRowClick = vi.fn()
    mockCallKw
      .mockResolvedValueOnce([
        { id: 1, name: 'Alice', email: 'a@b.com' },
        { id: 2, name: 'Bob', email: 'b@c.com' },
      ])
      .mockResolvedValueOnce(2)

    render(
      <OdooListRenderer
        model="res.partner"
        arch={listArch}
        fields={fields}
        onRowClick={onRowClick}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Alice').closest('tr')!)
    expect(onRowClick).toHaveBeenCalledWith(1)
  })

  test('shows no records message for empty data', async () => {
    mockCallKw.mockResolvedValueOnce([]).mockResolvedValueOnce(0)

    render(<OdooListRenderer model="res.partner" arch={listArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('No records')).toBeInTheDocument()
    })
  })

  test('shows grouped data when groupBy is active', async () => {
    mockReadGroup.mockResolvedValueOnce([
      { name: 'Alice', name_count: 3, __domain: [], __context: {} },
    ])

    render(
      <OdooListRenderer model="res.partner" arch={listArch} fields={fields} groupBy={['name']} />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('1 groups')).toBeInTheDocument()
    })
  })

  test('Export button is present with data', async () => {
    mockCallKw
      .mockResolvedValueOnce([{ id: 1, name: 'Alice', email: 'a@b.com' }])
      .mockResolvedValueOnce(1)

    render(<OdooListRenderer model="res.partner" arch={listArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })
})
