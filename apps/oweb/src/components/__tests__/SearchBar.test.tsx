import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { SearchFilter, SearchGroupBy } from '../../lib/odoo-types'
import { SearchBar } from '../SearchBar'

const mockFilters: SearchFilter[] = [
  { name: 'draft', string: 'Draft', domain: [['state', '=', 'draft']] },
  { name: 'done', string: 'Done', domain: [['state', '=', 'done']] },
]
const mockGroupBys: SearchGroupBy[] = [{ name: 'stage', string: 'Stage', fieldName: 'stage_id' }]

describe('SearchBar', () => {
  test('renders search input with placeholder', () => {
    render(<SearchBar onSearch={vi.fn()} placeholder="Search leads..." />)
    expect(screen.getByPlaceholderText('Search leads...')).toBeTruthy()
  })

  test('does not show filter dropdown when no filters', () => {
    render(<SearchBar onSearch={vi.fn()} />)
    expect(screen.queryByText('Filters')).toBeNull()
  })

  test('shows filter dropdown when filters provided', () => {
    render(<SearchBar onSearch={vi.fn()} filters={mockFilters} />)
    expect(screen.getByText('Filters')).toBeTruthy()
  })

  test('Search button triggers onSearch with keyword domain', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'test' },
    })
    fireEvent.click(screen.getByText('Search'))
    expect(onSearch).toHaveBeenCalledWith(
      expect.arrayContaining([expect.arrayContaining(['name', 'ilike', 'test'])]),
    )
  })

  test('Reset button clears and calls onSearch with empty domain', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'something' },
    })
    fireEvent.click(screen.getByText('Reset'))
    expect(onSearch).toHaveBeenCalledWith([])
  })

  test('Advanced toggle shows advanced search form', () => {
    render(<SearchBar onSearch={vi.fn()} />)
    fireEvent.click(screen.getByText('Advanced'))
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Filter')).toBeTruthy()
  })

  test('toggling a filter calls onSearch with filter domain', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} filters={mockFilters} groupByFilters={mockGroupBys} />)
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByText('Draft'))
    expect(onSearch).toHaveBeenCalledWith([['state', '=', 'draft']])
  })

  test('toggling groupBy calls onGroupByChange', () => {
    const onGroupByChange = vi.fn()
    render(
      <SearchBar
        onSearch={vi.fn()}
        onGroupByChange={onGroupByChange}
        filters={mockFilters}
        groupByFilters={mockGroupBys}
      />,
    )
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByText('Stage'))
    expect(onGroupByChange).toHaveBeenCalledWith(['stage_id'])
  })
})
