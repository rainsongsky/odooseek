import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { ViewToolbar } from '../../lib/odoo-types'
import { ControlPanel } from '../ControlPanel'

vi.mock('@/lib/lucide-icons', () => ({
  ChevronDown: () => <span>v</span>,
}))

const toolbarWithPrint: ViewToolbar = {
  print: [
    { id: 1, name: 'Invoice PDF', binding_view_types: 'list,form' },
    { id: 2, name: 'Delivery Slip', binding_view_types: 'form' },
  ],
  action: [],
}

const toolbarWithAction: ViewToolbar = {
  print: [],
  action: [
    { id: 10, name: 'Export', binding_view_types: 'list' },
    { id: 11, name: 'Merge', binding_view_types: 'list,kanban' },
  ],
}

const toolbarWithBoth: ViewToolbar = {
  print: [{ id: 1, name: 'Invoice PDF' }],
  action: [{ id: 10, name: 'Export' }],
}

describe('ControlPanel', () => {
  test('renders Print dropdown with items', () => {
    render(<ControlPanel toolbar={toolbarWithPrint} />)
    expect(screen.getByText('Print')).toBeInTheDocument()
  })

  test('renders Action dropdown with items', () => {
    render(<ControlPanel toolbar={toolbarWithAction} />)
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  test('renders both Print and Action', () => {
    render(<ControlPanel toolbar={toolbarWithBoth} />)
    expect(screen.getByText('Print')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  test('does not render when toolbar is undefined', () => {
    const { container } = render(<ControlPanel />)
    expect(container.innerHTML).toBe('')
  })

  test('does not render when toolbar has empty arrays', () => {
    const { container } = render(<ControlPanel toolbar={{ print: [], action: [] }} />)
    expect(container.innerHTML).toBe('')
  })

  test('clicking Print opens dropdown with items', async () => {
    const user = userEvent.setup()
    render(<ControlPanel toolbar={toolbarWithPrint} />)

    await user.click(screen.getByText('Print'))
    expect(screen.getByText('Invoice PDF')).toBeInTheDocument()
    expect(screen.getByText('Delivery Slip')).toBeInTheDocument()
  })

  test('clicking Action opens dropdown with items', async () => {
    const user = userEvent.setup()
    render(<ControlPanel toolbar={toolbarWithAction} />)

    await user.click(screen.getByText('Action'))
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('Merge')).toBeInTheDocument()
  })
})
