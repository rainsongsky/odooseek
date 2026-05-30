import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callKw } from '../lib/api'
import type { IrFilterRecord } from '../lib/odoo-types'

export interface SaveFilterParams {
  name: string
  model_id: string
  domain: unknown[]
  context: Record<string, unknown>
  user_ids?: number[]
  sort?: string
}

export function useFavoriteFilters(model: string | undefined) {
  const queryClient = useQueryClient()

  const filtersQuery = useQuery<IrFilterRecord[]>({
    queryKey: ['favoriteFilters', model],
    queryFn: () =>
      callKw<Array<IrFilterRecord>>('ir.filters', 'get_filters', [model]),
    enabled: !!model,
  })

  const saveMutation = useMutation({
    mutationFn: (params: SaveFilterParams) =>
      callKw('ir.filters', 'create_filter', [
        {
          name: params.name,
          model_id: params.model_id,
          domain: JSON.stringify(params.domain),
          context: params.context,
          user_ids: params.user_ids ? [[6, 0, params.user_ids]] : false,
          sort: params.sort || '',
        },
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteFilters', model] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (filterId: number) =>
      callKw('ir.filters', 'unlink', [[filterId]]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteFilters', model] })
    },
  })

  return {
    filters: filtersQuery.data ?? [],
    isLoading: filtersQuery.isLoading,
    saveFilter: saveMutation.mutate,
    deleteFilter: deleteMutation.mutate,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
