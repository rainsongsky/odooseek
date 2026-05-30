export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${dim} animate-spin rounded-full border-2 border-accent border-t-transparent`} />
    </div>
  )
}
