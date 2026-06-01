// Placeholder until `bun run generate` in @odooseek/odoo-codegen (requires live Odoo).

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.employee */
export interface HrEmployeeRecord extends BaseRecord {
  name: string
  active: boolean
  department_id: [number, string] | false
  job_id: [number, string] | false
  job_title: string | false
  parent_id: [number, string] | false
  child_ids: number[]
  work_email: string | false
  work_phone: string | false
  mobile_phone: string | false
  barcode: string | false
  image_128: string | false
  image_1920: string | false
  hr_presence_state: string | false
  hr_icon_display: string | false
  current_version_id: number | false
  version_ids: number[]
  versions_count: number | false
}

export type HrEmployeeFieldName = ModelFieldName<HrEmployeeRecord>
export type HrEmployeeSearchResult = ModelRecord<HrEmployeeRecord>[]
