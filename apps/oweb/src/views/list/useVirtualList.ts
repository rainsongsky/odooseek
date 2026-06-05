import { useVirtualizer } from '@tanstack/react-virtual'
import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'

interface UseVirtualListOptions {
  data: unknown[]
  containerRef: RefObject<HTMLDivElement | null>
  isEditing: (index: number) => boolean
  overscan?: number
}

export function useVirtualList({
  data,
  containerRef,
  isEditing,
  overscan = 10,
}: UseVirtualListOptions) {
  const measureCbMap = useRef(new Map<number, (el: HTMLElement | null) => void>())

  const estimateSize = useCallback((index: number) => (isEditing(index) ? 72 : 40), [isEditing])

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan,
  })

  const measureElement = useCallback(
    (el: HTMLElement | null, index: number) => {
      virtualizer.measureElement(el)
      measureCbMap.current.set(index, (e) => virtualizer.measureElement(e))
    },
    [virtualizer],
  )

  return {
    virtualizer,
    visibleItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measureElement,
  }
}
