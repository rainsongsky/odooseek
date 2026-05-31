import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { Suspense, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { OdooAction } from '../lib/api'
import { callKw } from '../lib/api'
import type { OdooFieldMeta } from '../lib/odoo-types'
import type { OdooFormRendererRef } from '../views/OdooFormRenderer'

interface FormDialogItem {
  id: number
  action: OdooAction
}

interface FormDialogOverlayProps {
  dialogs: FormDialogItem[]
  onClose: (id: number) => void
  parentModel: string
}

export type { FormDialogItem }

export function FormDialogOverlay({ dialogs, onClose, parentModel }: FormDialogOverlayProps) {
  if (dialogs.length === 0) return null
  return (
    <>
      {dialogs.map((item, idx) => (
        <FormDialogBody
          key={item.id}
          item={item}
          onClose={onClose}
          parentModel={parentModel}
          zIndex={60 + idx * 10}
        />
      ))}
    </>
  )
}

function FormDialogBody({
  item,
  onClose,
  parentModel,
  zIndex,
}: {
  item: FormDialogItem
  onClose: (id: number) => void
  parentModel: string
  zIndex: number
}) {
  const queryClient = useQueryClient()
  const formRef = useRef<OdooFormRendererRef>(null)
  const action = item.action
  const model = action.res_model ?? parentModel
  const viewId =
    action.views && action.views.length > 0 && action.views[0][0]
      ? action.views[0][0]
      : undefined

  const { data: viewData, isLoading } = useQuery({
    queryKey: ['odoo', 'dialog', 'get_views', model, item.id],
    queryFn: async () => {
      const data = await callKw<{
        views: Record<string, { arch: string; id: number }>
        models: Record<string, { fields: Record<string, OdooFieldMeta> }>
      }>(model, 'get_views', [[viewId ?? false, 'form']], { options: { toolbar: false } })
      return data
    },
    staleTime: 5 * 60_000,
  })

  const handleClose = useCallback(() => {
    onClose(item.id)
    queryClient.invalidateQueries({ queryKey: ['odoo', 'data', parentModel] })
    queryClient.invalidateQueries({ queryKey: ['odoo', 'search_read', parentModel] })
  }, [item.id, onClose, queryClient, parentModel])

  const activeView = viewData?.views?.form
  const fields: Record<string, OdooFieldMeta> = viewData?.models?.[model]?.fields ?? {}

  const title = action.name ?? action.display_name ?? model

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="flex items-start justify-center min-h-full p-4 pt-12 pointer-events-none">
        <div className="relative w-full max-w-[800px] rounded-xl border border-border-subtle bg-surface shadow-2xl max-h-[85vh] flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
            <button
              type="button"
              onClick={handleClose}
              className="text-text-muted hover:text-text-primary text-lg leading-none shrink-0 ml-2"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : !activeView ? (
              <div className="p-8 text-center text-sm text-text-muted">
                <p>View not found for {model}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-3 rounded bg-accent px-3 py-1 text-xs text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                }
              >
                <FormDialogInner
                  ref={formRef}
                  model={model}
                  arch={activeView.arch}
                  fields={fields}
                  onClose={handleClose}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const FormDialogInner = React.lazy(() =>
  import('../views/OdooFormRenderer').then((mod) => {
    const Inner = React.forwardRef(function Inner(
      props: {
        model: string
        arch: string
        fields: Record<string, OdooFieldMeta>
        onClose: () => void
      },
      ref: React.Ref<OdooFormRendererRef>,
    ) {
      const handleAction = useCallback(
        (act: OdooAction) => {
          if (act.type === 'ir.actions.act_window_close') {
            props.onClose()
          }
        },
        [props.onClose],
      )
      return mod.OdooFormRenderer({
        model: props.model,
        arch: props.arch,
        fields: props.fields,
        onAction: handleAction,
        ref,
      })
    })
    Inner.displayName = 'FormDialogInner'
    return { default: Inner }
  }),
)
