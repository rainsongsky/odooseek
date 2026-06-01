import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { DialogProvider } from '../../hooks/useDialog'
import { useConfirmDialog } from '../ConfirmDialog'
import { DialogContainer } from '../Dialog'

function ConfirmTrigger({
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void | Promise<void>
}) {
  const confirmDialog = useConfirmDialog()
  return (
    <button
      type="button"
      data-testid="trigger"
      onClick={() =>
        confirmDialog({
          title,
          message,
          confirmLabel,
          cancelLabel,
          variant,
          onConfirm,
        })
      }
    >
      Open Confirm
    </button>
  )
}

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <DialogProvider>
      {children}
      <DialogContainer />
    </DialogProvider>
  )
}

describe('ConfirmDialog', () => {
  test('calling confirmDialog opens a dialog with title and message', () => {
    const wrapper = createWrapper()
    render(<ConfirmTrigger title="Confirm Action" message="Are you sure?" onConfirm={() => {}} />, {
      wrapper,
    })

    fireEvent.click(screen.getByTestId('trigger'))

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  test('clicking Cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const wrapper = createWrapper()
    render(<ConfirmTrigger title="Delete?" message="Really?" onConfirm={onConfirm} />, {
      wrapper,
    })

    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Delete?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Delete?')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('clicking Confirm calls onConfirm then closes', async () => {
    const onConfirm = vi.fn()
    const wrapper = createWrapper()
    render(<ConfirmTrigger title="Save?" message="Save changes?" onConfirm={onConfirm} />, {
      wrapper,
    })

    fireEvent.click(screen.getByTestId('trigger'))
    expect(screen.getByText('Save?')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Save?')).not.toBeInTheDocument()
    })
  })

  test("variant='danger' renders red confirm button", () => {
    const wrapper = createWrapper()
    render(
      <ConfirmTrigger
        title="Delete Item"
        message="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {}}
      />,
      { wrapper },
    )

    fireEvent.click(screen.getByTestId('trigger'))

    const confirmBtn = screen.getByRole('button', { name: 'Delete' })
    expect(confirmBtn).toBeInTheDocument()
    expect(confirmBtn.className).toContain('bg-danger')
  })

  test('uses custom confirm and cancel labels', () => {
    const wrapper = createWrapper()
    render(
      <ConfirmTrigger
        title="Custom Labels"
        message="Test"
        confirmLabel="Yes, proceed"
        cancelLabel="No, go back"
        onConfirm={() => {}}
      />,
      { wrapper },
    )

    fireEvent.click(screen.getByTestId('trigger'))

    expect(screen.getByRole('button', { name: 'Yes, proceed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, go back' })).toBeInTheDocument()
  })
})
