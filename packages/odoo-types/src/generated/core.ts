/**
 * Core utility types for auto-generated model definitions.
 * DO NOT EDIT — these are shared by all generated model files.
 */

/** Utility: strip readonly and dynamic index for mutable record types */
export type ModelRecord<T> = T extends {
  readonly id: infer ID
  readonly display_name: infer DN
}
  ? { id: ID; display_name: DN } & Omit<
      {
        [K in keyof T as K extends 'id' | 'display_name'
          ? never
          : K]: T[K]
      },
      keyof { [key: string]: unknown }
    >
  : T

/** Utility: extract string literal union of field names from a record type */
export type ModelFieldName<T> = keyof {
  [K in keyof T as K extends
    | `readonly ${string}`
    | keyof { [key: string]: unknown }
    ? never
    : K]: T[K]
} &
  string

/** Base record shape that all generated models extend */
export interface BaseRecord {
  readonly id: number
  readonly display_name: string
  readonly [key: string]: unknown
}

/** Typed context for RPC calls */
export interface RpcContext {
  active_id?: number
  active_ids?: number[]
  active_model?: string
  lang?: string
  tz?: string
  uid?: number
  [key: string]: unknown
}
