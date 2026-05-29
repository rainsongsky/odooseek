declare module 'react-big-calendar' {
  import type { Component, ReactNode, CSSProperties, SyntheticEvent } from 'react'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Calendar extends Component<any, any> {}

  export function dateFnsLocalizer(config: Record<string, unknown>): unknown
}
