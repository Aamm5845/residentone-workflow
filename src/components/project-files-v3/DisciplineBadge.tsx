'use client'

import { getDisciplineConfig } from './v3-constants'

interface DisciplineBadgeProps {
  discipline: string | null
  size?: 'sm' | 'md'
}

export function DisciplineBadge({ discipline, size = 'sm' }: DisciplineBadgeProps) {
  const config = getDisciplineConfig(discipline)
  if (!config) return null

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.color}`} />
      {config.shortLabel}
    </span>
  )
}
