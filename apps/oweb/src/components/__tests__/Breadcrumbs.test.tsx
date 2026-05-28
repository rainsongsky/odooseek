import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Breadcrumbs } from '../Breadcrumbs'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

describe('Breadcrumbs', () => {
  test('shows 2-level for list view', () => {
    render(<Breadcrumbs model="crm.lead" viewType="list" viewTitle="Leads" />)
    expect(screen.getByText('CRM')).toBeVisible()
    expect(screen.getByText('Leads')).toBeVisible()
  })

  test('shows 3-level for form view', () => {
    render(
      <Breadcrumbs model="crm.lead" viewType="form" viewTitle="Leads" recordName="Test Lead" />,
    )
    expect(screen.getByText('CRM')).toBeVisible()
    expect(screen.getByText('Leads')).toBeVisible()
    expect(screen.getByText('Test Lead')).toBeVisible()
  })

  test('clicking app name calls navigate', async () => {
    const user = userEvent.setup()
    render(<Breadcrumbs model="crm.lead" viewType="list" viewTitle="Leads" />)
    await user.click(screen.getByText('CRM'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/menu' })
  })

  test('clicking view title calls onBackToList', async () => {
    const user = userEvent.setup()
    const onBackToList = vi.fn()
    render(
      <Breadcrumbs
        model="crm.lead"
        viewType="form"
        viewTitle="Leads"
        onBackToList={onBackToList}
      />,
    )
    await user.click(screen.getByText('Leads'))
    expect(onBackToList).toHaveBeenCalled()
  })
})
