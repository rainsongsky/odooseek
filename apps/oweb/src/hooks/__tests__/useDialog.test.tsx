import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { DialogProvider, useDialog } from '../useDialog'

function wrapper({ children }: { children: ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>
}

describe('useDialog', () => {
  test('starts with empty dialogs', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })
    expect(result.current.dialogs).toEqual([])
  })

  test('openDialog adds a dialog', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    act(() => {
      result.current.openDialog({
        size: 'md',
        title: 'Test',
        content: 'Hello',
      })
    })

    expect(result.current.dialogs).toHaveLength(1)
    expect(result.current.dialogs[0].title).toBe('Test')
    expect(result.current.dialogs[0].size).toBe('md')
    expect(result.current.dialogs[0].id).toBe(1)
  })

  test('openDialog returns the dialog id', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    let id: number
    act(() => {
      id = result.current.openDialog({ size: 'sm', content: 'x' })
    })

    expect(id!).toBe(1)
  })

  test('openDialog generates sequential ids', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    act(() => {
      result.current.openDialog({ size: 'md', content: 'a' })
      result.current.openDialog({ size: 'md', content: 'b' })
      result.current.openDialog({ size: 'md', content: 'c' })
    })

    expect(result.current.dialogs.map((d) => d.id)).toEqual([1, 2, 3])
  })

  test('closeDialog removes by id', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    act(() => {
      result.current.openDialog({ size: 'md', content: 'a' })
      result.current.openDialog({ size: 'md', content: 'b' })
    })

    act(() => {
      result.current.closeDialog(1)
    })

    expect(result.current.dialogs).toHaveLength(1)
    expect(result.current.dialogs[0].content).toBe('b')
  })

  test('closeAll removes all dialogs', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    act(() => {
      result.current.openDialog({ size: 'md', content: 'a' })
      result.current.openDialog({ size: 'md', content: 'b' })
    })

    act(() => {
      result.current.closeAll()
    })

    expect(result.current.dialogs).toEqual([])
  })

  test('closeDialog with unknown id does nothing', () => {
    const { result } = renderHook(() => useDialog(), { wrapper })

    act(() => {
      result.current.openDialog({ size: 'md', content: 'a' })
    })

    act(() => {
      result.current.closeDialog(999)
    })

    expect(result.current.dialogs).toHaveLength(1)
  })

  test('throws if used outside provider', () => {
    // suppress console.error for the expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useDialog())
    }).toThrow('useDialog must be used within DialogProvider')

    spy.mockRestore()
  })
})
