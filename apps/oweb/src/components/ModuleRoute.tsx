import type { ViewType } from '@odooseek/odoo-client'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAutosaveGuard } from '../hooks/useAutosaveGuard'
import type { OdooFormRendererRef } from '../views/OdooFormRenderer'
import { OdooViewLoader } from '../views/OdooViewLoader'

interface ModuleRouteProps {
  model: string
  defaultView: ViewType
  domain?: unknown[]
  recordId?: number
  /** Navigate to this path when opening a record form (deep link). */
  recordPath?: (id: number) => string
  /** Navigate here when leaving form view (optional). */
  listPath?: string
  /** View modes shown in the switcher (from Odoo action `view_mode`). */
  availableViews?: ViewType[]
}

export function ModuleRoute({
  model,
  defaultView,
  domain,
  recordId: initialRecordId,
  recordPath,
  listPath,
  availableViews,
}: ModuleRouteProps) {
  const navigate = useNavigate()
  const [viewType, setViewType] = useState<ViewType>(defaultView)
  const [recordId, setRecordId] = useState<number | undefined>(initialRecordId)
  const [isFormDirty, setIsFormDirty] = useState(false)
  const formRef = useRef<OdooFormRendererRef>(null)

  useEffect(() => {
    setRecordId(initialRecordId)
    if (initialRecordId) setViewType('form')
  }, [initialRecordId])

  const handleRowClick = useCallback(
    (id: number) => {
      if (recordPath) {
        navigate({ to: recordPath(id) })
        return
      }
      setRecordId(id)
      setViewType('form')
    },
    [navigate, recordPath],
  )

  const handleSwitchView = useCallback(
    (v: ViewType) => {
      setViewType(v)
      if (v !== 'form') {
        setRecordId(undefined)
        if (listPath && v === defaultView) navigate({ to: listPath })
      }
    },
    [defaultView, listPath, navigate],
  )

  const handleBackToList = useCallback(() => {
    if (listPath) {
      navigate({ to: listPath })
      return
    }
    setViewType(defaultView)
    setRecordId(undefined)
  }, [defaultView, listPath, navigate])

  const handleCreateClick = useCallback(() => {
    setViewType('form')
    setRecordId(undefined)
  }, [])

  const handleRecordCreated = useCallback(
    (newId: number) => {
      if (recordPath) {
        navigate({ to: recordPath(newId) })
        return
      }
      setRecordId(newId)
    },
    [navigate, recordPath],
  )

  useAutosaveGuard({
    isDirty: isFormDirty,
    onSave: async () => {
      await formRef.current?.save()
    },
    enabled: viewType === 'form',
  })

  return (
    <OdooViewLoader
      model={model}
      viewType={viewType}
      domain={domain}
      recordId={recordId}
      onRowClick={handleRowClick}
      onBackToList={handleBackToList}
      onSwitchView={handleSwitchView}
      onCreateClick={handleCreateClick}
      onRecordCreated={handleRecordCreated}
      onDirtyChange={setIsFormDirty}
      formRef={formRef}
      availableViews={availableViews}
    />
  )
}
