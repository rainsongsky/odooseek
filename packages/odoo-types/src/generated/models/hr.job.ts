// Auto-generated from hr.job (Odoo fields_get)
// DO NOT EDIT — run `bun run generate` in @odooseek/odoo-codegen to regenerate

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** hr.job */
export interface HrJobRecord extends BaseRecord {
  /** Active */
  active: boolean
  /** Allowed User */
  allowed_user_ids: number[] /* res.users */ | false
  /** Company */
  company_id: [number, string] /* res.company */ | false
  /** Employment Type */
  contract_type_id: [number, string] /* hr.contract.type */ | false
  /** Created on */
  create_date: string | false
  /** Created by */
  create_uid: [number, string] /* res.users */ | false
  /** Current Job Skill */
  current_job_skill_ids: number[] /* hr.job.skill */
  /** Department */
  department_id: [number, string] /* hr.department */ | false
  /** Job Description */
  description: string | false
  /** Employees */
  employee_ids: number[] /* hr.employee */
  /** Total Forecasted Employees — Expected number of employees for this job position after new recruitment. */
  expected_employees: number | false
  /** Has Message */
  has_message: boolean
  /** Skills */
  job_skill_ids: number[] /* hr.job.skill */
  /** Attachment Count */
  message_attachment_count: number | false
  /** Followers */
  message_follower_ids: number[] /* mail.followers */
  /** Message Delivery error — If checked, some messages have a delivery error. */
  message_has_error: boolean
  /** Number of errors — Number of messages with delivery error */
  message_has_error_counter: number | false
  /** SMS Delivery error — If checked, some messages have a delivery error. */
  message_has_sms_error: boolean
  /** Messages */
  message_ids: number[] /* mail.message */
  /** Is Follower */
  message_is_follower: boolean
  /** Action Needed — If checked, new messages require your attention. */
  message_needaction: boolean
  /** Number of Actions — Number of messages requiring action */
  message_needaction_counter: number | false
  /** Followers (Partners) */
  message_partner_ids: number[] /* res.partner */ | false
  /** Job Position */
  name: string
  /** Current Number of Employees — Number of employees currently occupying this job position. */
  no_of_employee: number | false
  /** Target — Number of new employees you expect to recruit. */
  no_of_recruitment: number | false
  /** Ratings */
  rating_ids: number[] /* rating.rating */
  /** Requirements */
  requirements: string | false
  /** Sequence */
  sequence: number | false
  /** Skill */
  skill_ids: number[] /* hr.skill */ | false
  /** Recruiter — The Recruiter will be the default value for all Applicants in this job             position. The Recruiter is automatically added to all meetings with the Applicant. */
  user_id: [number, string] /* res.users */ | false
  /** Website Messages — Website communication history */
  website_message_ids: number[] /* mail.message */
  /** Last Updated on */
  write_date: string | false
  /** Last Updated by */
  write_uid: [number, string] /* res.users */ | false
}

/** Field names for hr.job */
export type HrJobFieldName = ModelFieldName<HrJobRecord>

/** Typed search_read result */
export type HrJobSearchResult = ModelRecord<HrJobRecord>
