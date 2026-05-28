export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      <div className="w-full max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-semibold text-text-primary">Settings</h2>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-subtle bg-surface/50 p-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Odoo Connection</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-secondary">API Endpoint</dt>
                <dd className="font-mono text-text-primary">/api/odoo/jsonrpc</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Proxy Mode</dt>
                <dd className="text-text-primary">Nginx Same-Origin</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Auth Method</dt>
                <dd className="text-text-primary">Session Cookie</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface/50 p-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Technology Stack</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'React 19',
                'TypeScript 6',
                'TanStack Router',
                'TanStack Query',
                'Vite 8',
                'Bun',
                'Tailwind CSS 4',
                'Lucide Icons',
              ].map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-[11px] text-text-secondary"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
