// Auto-generated from hr.job (Odoo fields_get)
// DO NOT EDIT — run `bun run generate` in @odooseek/odoo-codegen to regenerate

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.job */
export interface HrJobRecord extends BaseRecord {
  /** Is Follower */
  message_is_follower: boolean
  /** Followers */
  message_follower_ids: number[] /* mail.followers */
  /** Followers (Partners) */
  message_partner_ids: number[] /* res.partner */ | false
  /** Messages */
  message_ids: number[] /* mail.message */
  /** Has Message */
  has_message: boolean
  /** Action Needed — If checked, new messages require your attention. */
  message_needaction: boolean
  /** Number of Actions — Number of messages requiring action */
  message_needaction_counter: number | false
  /** Message Delivery error — If checked, some messages have a delivery error. */
  message_has_error: boolean
  /** Number of errors — Number of messages with delivery error */
  message_has_error_counter: number | false
  /** Attachment Count */
  message_attachment_count: number | false
  /** Ratings */
  rating_ids: number[] /* rating.rating */
  /** Website Messages — Website communication history */
  website_message_ids: number[] /* mail.message */
  /** SMS Delivery error — If checked, some messages have a delivery error. */
  message_has_sms_error: boolean
  /** Active */
  active: boolean
  /** Job Position */
  name: string
  /** Sequence */
  sequence: number | false
  /** Total Forecasted Employees — Expected number of employees for this job position after new recruitment. */
  expected_employees: number | false
  /** Current Number of Employees — Number of employees currently occupying this job position. */
  no_of_employee: number | false
  /** Target — Number of new employees you expect to recruit. */
  no_of_recruitment: number | false
  /** Employees */
  employee_ids: number[] /* hr.employee */
  /** Job Description */
  description: string | false
  /** Requirements */
  requirements: string | false
  /** Recruiter — The Recruiter will be the default value for all Applicants in this job             position. The Recruiter is automatically added to all meetings with the Applicant. */
  user_id: [number, string] /* res.users */ | false
  /** Allowed User */
  allowed_user_ids: number[] /* res.users */ | false
  /** Department */
  department_id: [number, string] /* hr.department */ | false
  /** Company */
  company_id: [number, string] /* res.company */ | false
  /** Employment Type */
  contract_type_id: [number, string] /* hr.contract.type */ | false
  /** Created by */
  create_uid: [number, string] /* res.users */ | false
  /** Created on */
  create_date: string | false
  /** Last Updated by */
  write_uid: [number, string] /* res.users */ | false
  /** Last Updated on */
  write_date: string | false
  /** Skills */
  job_skill_ids: number[] /* hr.job.skill */
  /** Current Job Skill */
  current_job_skill_ids: number[] /* hr.job.skill */
  /** Skill */
  skill_ids: number[] /* hr.skill */ | false
}

/** Field names for hr.job */
export type HrJobFieldName = ModelFieldName<HrJobRecord>

/** Typed search_read result */
export type HrJobSearchResult = ModelRecord<HrJobRecord>
