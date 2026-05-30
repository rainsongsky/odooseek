import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutosaveGuard } from '../useAutosaveGuard'

describe('useAutosaveGuard', () => {
  test('does not save when not dirty', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosaveGuard({ isDirty: false, onSave, enabled: true }))
    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onSave).not.toHaveBeenCalled()
  })

  test('saves when dirty and visibility changes to hidden', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosaveGuard({ isDirty: true, onSave, enabled: true }))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onSave).toHaveBeenCalled()
  })

  test('does not save when disabled', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosaveGuard({ isDirty: true, onSave, enabled: false }))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onSave).not.toHaveBeenCalled()
  })
})
