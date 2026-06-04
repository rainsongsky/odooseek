import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { PlsTooltipWidget } from '../pls-tooltip'

const mockCallKw = vi.fn()
vi.mock('@odooseek/odoo-client', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@odooseek/odoo-client')
  return { ...actual, callKw: (...args: unknown[]) => mockCallKw(...args) }
})

function withQuery(ui: React.ReactNode) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  )
}

describe('PlsTooltipWidget', () => {
  test('hides when readOnly', () => {
    const { container } = render(
      withQuery(
        <PlsTooltipWidget
          field={{ name: 'probability', type: 'float', string: 'Probability' } as any}
          value={50}
          onChange={vi.fn()}
          readOnly={true}
          record={{ id: 1 }}
        />,
      ),
    )
    expect(container.innerHTML).toBe('')
  })

  test('hides when no record id', () => {
    const { container } = render(
      withQuery(
        <PlsTooltipWidget
          field={{ name: 'probability', type: 'float', string: 'Probability' } as any}
          value={50}
          onChange={vi.fn()}
          readOnly={false}
          record={{}}
        />,
      ),
    )
    expect(container.innerHTML).toBe('')
  })

  test('renders button when editable with record', () => {
    render(
      withQuery(
        <PlsTooltipWidget
          field={{ name: 'probability', type: 'float', string: 'Probability' } as any}
          value={50}
          onChange={vi.fn()}
          readOnly={false}
          record={{ id: 1 }}
        />,
      ),
    )
    expect(screen.getByRole('button')).toBeDefined()
  })
})
