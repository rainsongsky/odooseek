import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/maintenance/request/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/maintenance/request/$id"!</div>
}
