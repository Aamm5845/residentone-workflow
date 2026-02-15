'use client'

import { cn } from '@/lib/utils'
import { priorityConfig, type TaskPriority } from './types'

interface TaskPriorityBadgeProps {
  priority: TaskPriority
  size?: 'sm' | 'md'
}

export function TaskPriorityBadge({ priority, size = 'md' }: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        config.bgColor,
        config.color,
        config.borderColor,
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
