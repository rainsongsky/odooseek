// Placeholder until `bun run generate` in @odooseek/odoo-codegen (requires live Odoo).

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.version */
export interface HrVersionRecord extends BaseRecord {
  employee_id: [number, string] /* hr.employee */
  date_version: string
  contract_date_start: string | false
  contract_date_end: string | false
  department_id: [number, string] | false
  job_id: [number, string] | false
  wage: number | false
  is_current: boolean
  is_future: boolean
  is_past: boolean
  is_in_contract: boolean
}

export type HrVersionFieldName = ModelFieldName<HrVersionRecord>
export type HrVersionSearchResult = ModelRecord<HrVersionRecord>[]
