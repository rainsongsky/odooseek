import type { ViewType } from '@odooseek/odoo-client'
import { useCallback, useRef, useState } from 'react'
import { useAutosaveGuard } from '../hooks/useAutosaveGuard'
import type { OdooFormRendererRef } from '../views/OdooFormRenderer'
import { OdooViewLoader } from '../views/OdooViewLoader'

interface ModuleRouteProps {
  model: string
  defaultView: ViewType
  domain?: unknown[]
  recordId?: number
}

export function ModuleRoute({
  model,
  defaultView,
  domain,
  recordId: initialRecordId,
}: ModuleRouteProps) {
  const [viewType, setViewType] = useState<ViewType>(defaultView)
  const [recordId, setRecordId] = useState<number | undefined>(initialRecordId)
  const [isFormDirty, setIsFormDirty] = useState(false)
  const formRef = useRef<OdooFormRendererRef>(null)

  const handleRowClick = useCallback((id: number) => {
    setRecordId(id)
    setViewType('form')
  }, [])

  const handleSwitchView = useCallback((v: ViewType) => {
    setViewType(v)
    if (v !== 'form') setRecordId(undefined)
  }, [])

  const handleBackToList = useCallback(() => {
    setViewType(defaultView)
    setRecordId(undefined)
  }, [defaultView])

  const handleCreateClick = useCallback(() => {
    setViewType('form')
    setRecordId(undefined)
  }, [])

  const handleRecordCreated = useCallback((newId: number) => {
    setRecordId(newId)
  }, [])

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
    />
  )
}
