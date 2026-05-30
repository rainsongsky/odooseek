export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  )
}
