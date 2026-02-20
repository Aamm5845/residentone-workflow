'use client'

interface RevisionIndicatorProps {
  revisionNumber: number
  isLatest: boolean
  size?: 'sm' | 'md'
}

export function RevisionIndicator({ revisionNumber, isLatest, size = 'sm' }: RevisionIndicatorProps) {
  const sizeClasses = size === 'sm' ? 'text-xs h-6 min-w-6 px-1.5' : 'text-sm h-7 min-w-7 px-2'

  if (isLatest) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
      >
        R{revisionNumber}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}
    >
      R{revisionNumber}
    </span>
  )
}

interface EmptyRevisionCellProps {
  size?: 'sm' | 'md'
}

export function EmptyRevisionCell({ size = 'sm' }: EmptyRevisionCellProps) {
  const sizeClasses = size === 'sm' ? 'text-xs h-6 min-w-6' : 'text-sm h-7 min-w-7'

  return (
    <span className={`inline-flex items-center justify-center text-gray-300 ${sizeClasses}`}>
      —
    </span>
  )
}
