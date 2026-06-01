import { describe, expect, test } from 'vitest'
import { mailActivityFormAction, mailActivityScheduleAction } from '../activity-actions'

describe('activity-actions', () => {
  test('mailActivityFormAction sets defaults', () => {
    const action = mailActivityFormAction({
      resModel: 'hr.employee',
      resId: 7,
      activityTypeId: 3,
    })
    expect(action.res_model).toBe('mail.activity')
    expect(action.target).toBe('new')
    expect(action.context).toMatchObject({
      default_res_model: 'hr.employee',
      default_res_id: 7,
      default_activity_type_id: 3,
    })
  })

  test('mailActivityScheduleAction sets active_ids', () => {
    const action = mailActivityScheduleAction({
      resModel: 'hr.employee',
      resIds: [1, 2, 3],
    })
    expect(action.res_model).toBe('mail.activity.schedule')
    expect(action.context).toMatchObject({
      active_model: 'hr.employee',
      active_ids: [1, 2, 3],
      active_id: 1,
    })
  })
})
