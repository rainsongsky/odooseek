import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomeMenuProvider, useHomeMenu } from '../useHomeMenu'

function wrapper({ children }: { children: React.ReactNode }) {
  return <HomeMenuProvider>{children}</HomeMenuProvider>
}

describe('useHomeMenu', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useHomeMenu(), { wrapper })
    expect(result.current.isOpen).toBe(false)
  })

  it('open() sets isOpen to true', () => {
    const { result } = renderHook(() => useHomeMenu(), { wrapper })
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('close() sets isOpen to false', () => {
    const { result } = renderHook(() => useHomeMenu(), { wrapper })
    act(() => result.current.open())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('toggle() flips isOpen', () => {
    const { result } = renderHook(() => useHomeMenu(), { wrapper })
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })
})
