// Placeholder until `bun run generate` in @odooseek/odoo-codegen (requires live Odoo).
// DO NOT EDIT manually except to unblock CI — regenerate from Odoo fields_get.

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.employee.public — directory-safe fields */
export interface HrEmployeePublicRecord extends BaseRecord {
  name: string
  active: boolean
  department_id: [number, string] /* hr.department */ | false
  job_id: [number, string] /* hr.job */ | false
  job_title: string | false
  parent_id: [number, string] /* hr.employee */ | false
  work_email: string | false
  work_phone: string | false
  mobile_phone: string | false
  image_128: string | false
  image_256: string | false
  color: number | false
  category_ids: number[] /* hr.employee.category */ | false
}

export type HrEmployeePublicFieldName = ModelFieldName<HrEmployeePublicRecord>
export type HrEmployeePublicSearchResult = ModelRecord<HrEmployeePublicRecord>[]
