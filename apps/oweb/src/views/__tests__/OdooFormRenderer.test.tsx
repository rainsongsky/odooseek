import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { OdooFieldMeta } from '../../lib/odoo-types'
import { OdooFormRenderer } from '../OdooFormRenderer'

const mockCallKw = vi.fn()
vi.mock('../../lib/api', () => ({
  callKw: (...args: any[]) => mockCallKw(...args),
}))

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const formArch = `<form string="Partner">
  <sheet>
    <group col="2">
      <field name="name" required="1"/>
      <field name="email"/>
      <field name="state"/>
    </group>
  </sheet>
</form>`

const fields: Record<string, OdooFieldMeta> = {
  name: {
    name: 'name',
    type: 'char',
    string: 'Name',
    required: true,
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
  state: {
    name: 'state',
    type: 'selection',
    string: 'Status',
    required: false,
    readonly: false,
    store: true,
    searchable: true,
    sortable: true,
    selection: [
      ['draft', 'Draft'],
      ['confirmed', 'Confirmed'],
      ['done', 'Done'],
    ],
  },
}

const readResult = [{ id: 1, name: 'Test', email: 't@e.com', state: 'draft' }]

describe('OdooFormRenderer', () => {
  beforeEach(() => {
    mockCallKw.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  test('renders form title in read-only mode', async () => {
    mockCallKw.mockResolvedValue(readResult)
    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    expect(screen.getByText('Partner')).toBeInTheDocument()
  })

  test('clicking Edit shows Save and Cancel', async () => {
    const user = userEvent.setup()
    mockCallKw.mockResolvedValue(readResult)
    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Edit'))

    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  test('Cancel returns to read-only', async () => {
    const user = userEvent.setup()
    mockCallKw.mockResolvedValue(readResult)
    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Edit'))
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })

  test('Save triggers write for existing record', async () => {
    const user = userEvent.setup()
    mockCallKw.mockImplementation((_model: string, method: string) => {
      if (method === 'read') return Promise.resolve(readResult)
      if (method === 'write') return Promise.resolve(true)
      return Promise.resolve(undefined)
    })

    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Edit'))
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      const writeCall = mockCallKw.mock.calls.find((c: any[]) => c[1] === 'write')
      expect(writeCall).toBeDefined()
      expect(writeCall?.[0]).toBe('res.partner')
      expect(writeCall?.[2][0]).toEqual([1])
    })
  })

  test('Save triggers create for new record', async () => {
    const user = userEvent.setup()
    mockCallKw.mockImplementation((_model: string, method: string) => {
      if (method === 'default_get') return Promise.resolve({ name: '', email: '', state: false })
      if (method === 'onchange') return Promise.resolve({ value: {} })
      if (method === 'create') return Promise.resolve(42)
      return Promise.resolve(undefined)
    })

    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument()
    })

    const nameInput = screen.getAllByRole('textbox')[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'New Partner')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      const createCall = mockCallKw.mock.calls.find((c: any[]) => c[1] === 'create')
      expect(createCall).toBeDefined()
      expect(createCall?.[0]).toBe('res.partner')
    })
  })

  test('required validation shows error', async () => {
    const user = userEvent.setup()
    mockCallKw.mockImplementation((_model: string, method: string) => {
      if (method === 'default_get') return Promise.resolve({ name: '', email: '', state: false })
      if (method === 'onchange') return Promise.resolve({ value: {} })
      return Promise.resolve(undefined)
    })

    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText(/Required/)).toBeInTheDocument()
    })
  })

  test('shows statusbar when state field has selection', async () => {
    mockCallKw.mockResolvedValue([{ id: 1, name: 'Test', email: 't@e.com', state: 'confirmed' }])

    render(<OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  test('shows notebook tabs', async () => {
    const notebookArch = `<form string="Product">
      <sheet>
        <notebook>
          <page string="General"><field name="name"/></page>
          <page string="Sales"><field name="email"/></page>
        </notebook>
      </sheet>
    </form>`

    mockCallKw.mockResolvedValue([
      { id: 1, name: 'Test Product', email: 'p@e.com', state: 'draft' },
    ])

    render(
      <OdooFormRenderer
        model="product.template"
        arch={notebookArch}
        fields={fields}
        recordId={1}
      />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Sales')).toBeInTheDocument()
  })

  test('renders header action buttons', async () => {
    const headerArch = `<form string="Lead">
      <header>
        <button name="action_confirm" type="object" string="Confirm" class="btn-primary"/>
        <button name="action_cancel" type="object" string="Cancel"/>
      </header>
      <sheet><field name="name"/></sheet>
    </form>`

    mockCallKw.mockResolvedValue(readResult)
    render(<OdooFormRenderer model="crm.lead" arch={headerArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('hides button when states does not match', async () => {
    const statesArch = `<form string="Lead">
      <header>
        <button name="action_confirm" type="object" string="Confirm" states="draft"/>
        <button name="action_done" type="object" string="Done" states="confirmed"/>
      </header>
      <sheet><field name="name"/></sheet>
    </form>`

    mockCallKw.mockResolvedValue([{ id: 1, name: 'Test', email: 't@e.com', state: 'confirmed' }])
    render(<OdooFormRenderer model="crm.lead" arch={statesArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  test('clicking object button calls callKw with method', async () => {
    const user = userEvent.setup()
    const headerArch = `<form string="Lead">
      <header>
        <button name="action_won" type="object" string="Mark as Won"/>
      </header>
      <sheet><field name="name"/></sheet>
    </form>`

    mockCallKw.mockImplementation((_model: string, method: string) => {
      if (method === 'read') return Promise.resolve(readResult)
      if (method === 'action_won') return Promise.resolve(true)
      if (method === 'onchange') return Promise.resolve({ value: {} })
      return Promise.resolve(undefined)
    })

    render(<OdooFormRenderer model="crm.lead" arch={headerArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Mark as Won')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Mark as Won'))

    await waitFor(() => {
      const actionCall = mockCallKw.mock.calls.find((c: any[]) => c[1] === 'action_won')
      expect(actionCall).toBeDefined()
      expect(actionCall?.[0]).toBe('crm.lead')
      expect(actionCall?.[2]).toEqual([[1]])
    })
  })

  test('clicking action button calls ir.actions.server run', async () => {
    const user = userEvent.setup()
    const headerArch = `<form string="Lead">
      <header>
        <button name="42" type="action" string="Run Report"/>
      </header>
      <sheet><field name="name"/></sheet>
    </form>`

    mockCallKw.mockImplementation((_model: string, method: string) => {
      if (method === 'read') return Promise.resolve(readResult)
      if (method === 'run') return Promise.resolve(true)
      if (method === 'onchange') return Promise.resolve({ value: {} })
      return Promise.resolve(undefined)
    })

    render(<OdooFormRenderer model="crm.lead" arch={headerArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Run Report')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Run Report'))

    await waitFor(() => {
      const actionCall = mockCallKw.mock.calls.find(
        (c: any[]) => c[0] === 'ir.actions.server' && c[1] === 'run',
      )
      expect(actionCall).toBeDefined()
      expect(actionCall?.[2]).toEqual([[42]])
    })
  })

  test('sheet uses max-w-[860px] for layout', async () => {
    mockCallKw.mockResolvedValue(readResult)
    const { container } = render(
      <OdooFormRenderer model="res.partner" arch={formArch} fields={fields} recordId={1} />,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    const sheet = container.querySelector('.o_form_sheet')
    expect(sheet).toBeInTheDocument()
    expect(sheet?.className).toContain('max-w-[860px]')
  })

  test('header with statusbar and buttons renders in header area', async () => {
    const fullArch = `<form string="Lead">
      <header>
        <button name="action_confirm" type="object" string="Confirm" states="draft" class="btn-primary"/>
      </header>
      <sheet><field name="name"/></sheet>
    </form>`

    mockCallKw.mockResolvedValue([{ id: 1, name: 'Test', email: 't@e.com', state: 'draft' }])
    render(<OdooFormRenderer model="crm.lead" arch={fullArch} fields={fields} recordId={1} />, {
      wrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })
})
