import type { ReadGroupResult } from '@odooseek/odoo-client'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useMemo } from 'react'

export interface FlatItem {
  type: 'group-header' | 'record' | 'load-more'
  key: string
  data: unknown
  depth: number
  groupId: string
}

interface UseVirtualGroupedListOptions {
  groups: ReadGroupResult[]
  expandedGroups: Set<string>
  groupQueryMap: Record<string, Record<string, unknown>>
  groupLimit: number
  groupExtraLimits: Record<string, number>
  containerRef: React.RefObject<HTMLDivElement | null>
  overscan?: number
}

function flattenGroups(
  groups: ReadGroupResult[],
  expandedGroups: Set<string>,
  groupQueryMap: Record<string, Record<string, unknown>>,
  groupLimit: number,
  groupExtraLimits: Record<string, number>,
  depth: number,
  parentPath: string,
): FlatItem[] {
  const items: FlatItem[] = []

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const path = parentPath ? `${parentPath}-${gi}` : String(gi)
    const groupArr = group as unknown as unknown[]
    const groupCount = groupArr[groupArr.length - 1] as number

    items.push({
      type: 'group-header',
      key: `gh-${path}`,
      data: group,
      depth,
      groupId: path,
    })

    if (expandedGroups.has(path)) {
      const queryResult = groupQueryMap[path]
      if (queryResult) {
        const hasSubGroups = queryResult.__subGroups
        if (hasSubGroups) {
          const subGroups = queryResult.__subGroups as ReadGroupResult[]
          items.push(
            ...flattenGroups(
              subGroups,
              expandedGroups,
              groupQueryMap,
              groupLimit,
              groupExtraLimits,
              depth + 1,
              path,
            ),
          )
        } else {
          const records = queryResult.records as Array<Record<string, unknown>> | undefined
          if (records) {
            for (const record of records) {
              items.push({
                type: 'record',
                key: `r-${record.id}`,
                data: record,
                depth,
                groupId: path,
              })
            }
          }
          // Check if "load more" is needed
          if (records && records.length < groupCount) {
            items.push({
              type: 'load-more',
              key: `lm-${path}`,
              data: group,
              depth,
              groupId: path,
            })
          }
        }
      }
    }
  }

  return items
}

const ITEM_HEIGHTS: Record<FlatItem['type'], number> = {
  'group-header': 36,
  record: 40,
  'load-more': 32,
}

export function useVirtualGroupedList({
  groups,
  expandedGroups,
  groupQueryMap,
  groupLimit,
  groupExtraLimits,
  containerRef,
  overscan = 10,
}: UseVirtualGroupedListOptions) {
  const flatItems = useMemo(
    () => flattenGroups(groups, expandedGroups, groupQueryMap, groupLimit, groupExtraLimits, 0, ''),
    [groups, expandedGroups, groupQueryMap, groupLimit, groupExtraLimits],
  )

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => ITEM_HEIGHTS[flatItems[index]?.type ?? 'record'],
    overscan,
  })

  const measureElement = useCallback(
    (el: HTMLElement | null) => virtualizer.measureElement(el),
    [virtualizer],
  )

  return {
    virtualizer,
    flatItems,
    visibleItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    measureElement,
  }
}
