declare module 'react-big-calendar' {
  import type { Component, ReactNode, CSSProperties, SyntheticEvent } from 'react'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Calendar extends Component<any, any> {}

  export function dateFnsLocalizer(config: Record<string, unknown>): unknown
}

declare module 'react-big-calendar/lib/addons/dragAndDrop' {
  import type { ComponentType } from 'react'
  import type { Calendar } from 'react-big-calendar'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default function withDragAndDrop<T>(calendar: ComponentType<T>): ComponentType<T & Record<string, unknown>>
}
