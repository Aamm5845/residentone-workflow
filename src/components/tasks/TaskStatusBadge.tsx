'use client'

import { cn } from '@/lib/utils'
import { statusConfig, type TaskStatus } from './types'

interface TaskStatusBadgeProps {
  status: TaskStatus
  size?: 'sm' | 'md'
}

export function TaskStatusBadge({ status, size = 'md' }: TaskStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          config.dotColor,
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
        )}
      />
      {config.label}
    </span>
  )
}
