import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  test('renders page info and navigation buttons', () => {
    render(
      <Pagination page={0} total={200} limit={80} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    )

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('«')).toBeInTheDocument()
    expect(screen.getByText('‹')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
    expect(screen.getByText('»')).toBeInTheDocument()
  })

  test('disables first/prev on first page', () => {
    render(
      <Pagination page={0} total={200} limit={80} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    )

    expect(screen.getByText('«')).toBeDisabled()
    expect(screen.getByText('‹')).toBeDisabled()
    expect(screen.getByText('›')).not.toBeDisabled()
    expect(screen.getByText('»')).not.toBeDisabled()
  })

  test('disables next/last on last page', () => {
    render(
      <Pagination page={2} total={200} limit={80} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    )

    expect(screen.getByText('«')).not.toBeDisabled()
    expect(screen.getByText('‹')).not.toBeDisabled()
    expect(screen.getByText('›')).toBeDisabled()
    expect(screen.getByText('»')).toBeDisabled()
  })

  test('calls onPageChange on navigation click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={1}
        total={300}
        limit={80}
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('«'))
    expect(onPageChange).toHaveBeenCalledWith(0)

    await user.click(screen.getByText('»'))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByText('‹'))
    expect(onPageChange).toHaveBeenCalledWith(0)

    await user.click(screen.getByText('›'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('renders page size selector', () => {
    const onLimitChange = vi.fn()
    render(
      <Pagination
        page={0}
        total={200}
        limit={80}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    )

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('80')
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  test('calls onLimitChange when page size changed', async () => {
    const user = userEvent.setup()
    const onLimitChange = vi.fn()
    render(
      <Pagination
        page={0}
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
