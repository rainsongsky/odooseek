// Placeholder until `bun run generate` in @odooseek/odoo-codegen (requires live Odoo).

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.department */
export interface HrDepartmentRecord extends BaseRecord {
  name: string
  active: boolean
  parent_id: [number, string] | false
  child_ids: number[]
  manager_id: [number, string] /* hr.employee */ | false
  member_ids: number[]
}

export type HrDepartmentFieldName = ModelFieldName<HrDepartmentRecord>
export type HrDepartmentSearchResult = ModelRecord<HrDepartmentRecord>[]
