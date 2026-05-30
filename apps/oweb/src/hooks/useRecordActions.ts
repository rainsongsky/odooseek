import { useMutation, useQueryClient } from '@tanstack/react-query'
import { callKw } from '../lib/api'

export function useRecordActions(model: string) {
  const queryClient = useQueryClient()

  const duplicate = useMutation({
    mutationFn: (id: number) => callKw<number>(model, 'copy', [[id]]),
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['odoo', 'data', model] })
      return newId
    },
  })

  const archive = useMutation({
    mutationFn: (ids: number[]) => callKw(model, 'action_archive', [ids]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odoo', 'data', model] })
    },
  })

  const unarchive = useMutation({
    mutationFn: (ids: number[]) => callKw(model, 'action_unarchive', [ids]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odoo', 'data', model] })
    },
  })

  return { duplicate, archive, unarchive }
}
