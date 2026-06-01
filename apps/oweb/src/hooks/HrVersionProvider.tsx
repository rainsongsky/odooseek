import { read } from '@odooseek/odoo-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { HR_EMPLOYEE_MODEL, HR_VERSION_MODEL } from '../lib/hr'
import { useVersioning, type VersionInfo } from './useVersioning'

interface HrVersionContextValue {
  employeeId: number | undefined
  versions: VersionInfo[]
  currentVersionId: number | null
  selectedVersionId: number | null
  isLoading: boolean
  isReadonlyPreview: boolean
  previewRecord: Record<string, unknown> | undefined
  selectVersion: (versionId: number) => void
  goToCurrent: () => void
}

const HrVersionContext = createContext<HrVersionContextValue | null>(null)

const VERSION_TO_EMPLOYEE_FIELDS: Record<string, string> = {
  department_id: 'department_id',
  job_id: 'job_id',
  wage: 'wage',
  contract_date_start: 'contract_date_start',
  contract_date_end: 'contract_date_end',
  employee_type: 'employee_type',
  contract_type_id: 'contract_type_id',
}

export function HrVersionProvider({
  employeeId,
  children,
}: {
  employeeId: number | undefined
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const {
    versions,
    currentVersionId,
    selectedVersionId,
    isLoading,
    selectVersion: setSelected,
    goToCurrent: clearSelected,
  } = useVersioning(employeeId)

  const isReadonlyPreview =
    selectedVersionId != null &&
    currentVersionId != null &&
    selectedVersionId !== currentVersionId

  const { data: previewRecord } = useQuery({
    queryKey: ['odoo', 'hr', 'version-preview', selectedVersionId],
    queryFn: async () => {
      if (!selectedVersionId || !isReadonlyPreview) return undefined
      const rows = await read<Array<Record<string, unknown>>>(HR_VERSION_MODEL, [selectedVersionId], [
        'id',
        'display_name',
        'date_version',
        'department_id',
        'job_id',
        'wage',
        'contract_date_start',
        'contract_date_end',
        'employee_type',
        'contract_type_id',
        'additional_note',
      ])
      return rows[0]
    },
    enabled: isReadonlyPreview,
    staleTime: 60_000,
  })

  const selectVersion = useCallback(
    async (versionId: number) => {
      const version = versions.find((v) => v.id === versionId)
      if (!version || !employeeId) return

      if (version.isCurrent) {
        clearSelected()
        return
      }

      if (version.isFuture) {
        setSelected(versionId)
        await import('@odooseek/odoo-client').then(({ callKw }) =>
          callKw(HR_EMPLOYEE_MODEL, 'write', [[employeeId], { current_version_id: versionId }]),
        )
        queryClient.invalidateQueries({ queryKey: ['odoo', 'read', HR_EMPLOYEE_MODEL, employeeId] })
        queryClient.invalidateQueries({ queryKey: ['odoo', 'hr', 'versions', employeeId] })
        clearSelected()
        return
      }

      setSelected(versionId)
    },
    [versions, employeeId, clearSelected, setSelected, queryClient],
  )

  const goToCurrent = useCallback(() => {
    clearSelected()
  }, [clearSelected])

  const value = useMemo<HrVersionContextValue>(
    () => ({
      employeeId,
      versions,
      currentVersionId,
      selectedVersionId,
      isLoading,
      isReadonlyPreview,
      previewRecord,
      selectVersion,
      goToCurrent,
    }),
    [
      employeeId,
      versions,
      currentVersionId,
      selectedVersionId,
      isLoading,
      isReadonlyPreview,
      previewRecord,
      selectVersion,
      goToCurrent,
    ],
  )

  return <HrVersionContext.Provider value={value}>{children}</HrVersionContext.Provider>
}

export function useHrVersion(): HrVersionContextValue | null {
  return useContext(HrVersionContext)
}

/** Merge version preview fields into employee record for readonly display. */
export function mergeVersionPreviewIntoRecord(
  employee: Record<string, unknown>,
  version: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!version) return employee
  const merged = { ...employee }
  for (const [vKey, eKey] of Object.entries(VERSION_TO_EMPLOYEE_FIELDS)) {
    if (version[vKey] !== undefined) merged[eKey] = version[vKey]
  }
  return merged
}
