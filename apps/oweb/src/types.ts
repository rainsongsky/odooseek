export interface OdooUser {
  id: number
  name: string
  login: string
  email: string
  lang: string
  tz: string
  company_id: [number, string]
}

export interface OdooSession {
  uid: number
  session_id: string
  user_context: Record<string, unknown>
  db: string
  username: string
}

export interface OdooRecord {
  id: number
  display_name: string
  [key: string]: unknown
}

export interface OdooViewField {
  name: string
  string: string
  type: string
  required: boolean
  readonly: boolean
  invisible: boolean
}

export interface OdooAction {
  id: number
  name: string
  type: string
  xml_id: string
  res_model: string
  view_mode: string
}

export interface OdooMenu {
  id: number
  name: string
  action: string
  parent_id: [number, string]
  children: [number, string][]
  sequence: number
}
