import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  test('renders range display and navigation buttons', () => {
    render(
      <Pagination
        offset={0}
        total={100}
        limit={40}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('1-40')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('«')).toBeInTheDocument()
    expect(screen.getByText('‹')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
    expect(screen.getByText('»')).toBeInTheDocument()
  })

  test('displays correct range for middle page', () => {
    render(
      <Pagination
        offset={40}
        total={100}
        limit={40}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('41-80')).toBeInTheDocument()
  })

  test('displays correct range for last page with partial records', () => {
    render(
      <Pagination
        offset={80}
        total={100}
        limit={40}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('81-100')).toBeInTheDocument()
  })

  test('shows 0 records when total is 0', () => {
    render(
      <Pagination offset={0} total={0} limit={40} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    )

    expect(screen.getByText('0 records')).toBeInTheDocument()
  })

  test('disables first/prev on first page', () => {
    render(
      <Pagination
        offset={0}
        total={200}
        limit={80}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('«')).toBeDisabled()
    expect(screen.getByText('‹')).toBeDisabled()
    expect(screen.getByText('›')).not.toBeDisabled()
    expect(screen.getByText('»')).not.toBeDisabled()
  })

  test('disables next/last on last page', () => {
    render(
      <Pagination
        offset={160}
        total={200}
        limit={80}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('«')).not.toBeDisabled()
    expect(screen.getByText('‹')).not.toBeDisabled()
    expect(screen.getByText('›')).toBeDisabled()
    expect(screen.getByText('»')).toBeDisabled()
  })

  test('calls onPageChange with correct offsets on navigation click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        offset={80}
        total={300}
        limit={80}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('«'))
    expect(onPageChange).toHaveBeenLastCalledWith(0)

    onPageChange.mockClear()

    await user.click(screen.getByText('»'))
    expect(onPageChange).toHaveBeenCalledWith(220)

    onPageChange.mockClear()

    await user.click(screen.getByText('‹'))
    expect(onPageChange).toHaveBeenCalledWith(0)

    onPageChange.mockClear()

    await user.click(screen.getByText('›'))
    expect(onPageChange).toHaveBeenCalledWith(160)
  })

  test('enters edit mode on range click', async () => {
    const user = userEvent.setup()
    render(
      <Pagination
        offset={0}
        total={100}
        limit={40}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('1-40'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  test('confirms page change on Enter', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        offset={0}
        total={200}
        limit={40}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('1-40'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '50')
    await user.keyboard('{Enter}')

    expect(onPageChange).toHaveBeenCalledWith(40)
  })

  test('cancels edit mode on Escape', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        offset={0}
        total={200}
        limit={40}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('1-40'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(onPageChange).not.toHaveBeenCalled()
  })

  test('clamps entered value to valid range', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        offset={0}
        total={100}
        limit={40}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('1-40'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '999')
    await user.keyboard('{Enter}')

    // max offset = 100 - 40 = 60, entered 999 -> offset 998, clamped to 60
    expect(onPageChange).toHaveBeenCalledWith(60)
  })

  test('renders page size selector', () => {
    const onLimitChange = vi.fn()
    render(
      <Pagination
        offset={0}
        total={200}
        limit={80}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    )

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('80')
    // Use getAllByText since total "200" also appears in the pager display
    expect(screen.getAllByText('40').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('200').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1)
  })

  test('calls onLimitChange when page size changed', async () => {
    const user = userEvent.setup()
    const onLimitChange = vi.fn()
    render(
      <Pagination
        offset={0}
        total={200}
        limit={80}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox'), '200')
    expect(onLimitChange).toHaveBeenCalledWith(200)
  })
})
