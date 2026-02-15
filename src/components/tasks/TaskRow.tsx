'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Calendar,
  MessageSquare,
  CheckSquare,
} from 'lucide-react'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { statusConfig, type TaskData, type TaskStatus, type TaskPriority } from './types'

interface TaskRowProps {
  task: TaskData
  onClick: (task: TaskData) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  showProject?: boolean
}

const statusCycle: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

function getNextStatus(current: TaskStatus): TaskStatus {
  const idx = statusCycle.indexOf(current)
  if (idx === -1) return 'TODO'
  return statusCycle[(idx + 1) % statusCycle.length]
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email[0].toUpperCase()
}

function getDueDateInfo(dueDate: string | null): {
  label: string
  className: string
} | null {
  if (!dueDate) return null

  const due = new Date(dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  const formatted = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  if (diffDays < 0) {
    return { label: formatted, className: 'text-red-600' }
  }
  if (diffDays === 0) {
    return { label: 'Today', className: 'text-yellow-600' }
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', className: 'text-yellow-600' }
  }
  return { label: formatted, className: 'text-gray-500' }
}

export function TaskRow({
  task,
  onClick,
  onStatusChange,
  onPriorityChange,
  showProject = false,
}: TaskRowProps) {
  const dueDateInfo = useMemo(() => getDueDateInfo(task.dueDate), [task.dueDate])
  const config = statusConfig[task.status]

  const subtaskTotal = task._count.subtasks
  const subtaskCompleted = task.completedSubtasks ?? 0

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
    >
      {/* Status circle - clickable to cycle */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'h-5 w-5 rounded-full border-2 shrink-0 transition-colors',
                task.status === 'DONE'
                  ? 'bg-green-500 border-green-500'
                  : task.status === 'IN_PROGRESS'
                  ? 'border-blue-500 bg-blue-100'
                  : task.status === 'REVIEW'
                  ? 'border-yellow-500 bg-yellow-100'
                  : task.status === 'CANCELLED'
                  ? 'border-red-400 bg-red-100'
                  : 'border-gray-300 hover:border-gray-400'
              )}
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(task.id, getNextStatus(task.status))
              }}
              aria-label={`Status: ${config.label}. Click to change.`}
            >
              {task.status === 'DONE' && (
                <svg
                  className="h-full w-full text-white"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 8L7 11L12 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {config.label} - Click to change to{' '}
              {statusConfig[getNextStatus(task.status)].label}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Title */}
      <span
        className={cn(
          'flex-1 min-w-0 text-sm font-medium truncate',
          task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900',
          task.status === 'CANCELLED' && 'text-gray-400 line-through'
        )}
      >
        {task.title}
      </span>

      {/* Project name */}
      {showProject && (
        <span className="hidden sm:inline-flex shrink-0 text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5 w-[120px] truncate">
          {task.project.name}
        </span>
      )}

      {/* Assignee */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-[100px]">
        {task.assignedTo ? (
          <>
            <Avatar className="h-5 w-5">
              {task.assignedTo.image && (
                <AvatarImage
                  src={task.assignedTo.image}
                  alt={task.assignedTo.name || task.assignedTo.email}
                />
              )}
              <AvatarFallback className="text-[9px] bg-purple-100 text-purple-700">
                {getInitials(task.assignedTo.name, task.assignedTo.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600 truncate max-w-[70px]">
              {task.assignedTo.name || task.assignedTo.email}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">Unassigned</span>
        )}
      </div>

      {/* Due date */}
      <div className="hidden md:flex items-center gap-1 shrink-0 w-[90px]">
        {dueDateInfo ? (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              dueDateInfo.className
            )}
          >
            <Calendar className="h-3 w-3" />
            {dueDateInfo.label}
          </span>
        ) : (
          <span className="text-xs text-gray-300">No date</span>
        )}
      </div>

      {/* Priority */}
      <div className="hidden md:block shrink-0 w-[80px]">
        <TaskPriorityBadge priority={task.priority} size="sm" />
      </div>

      {/* Subtask progress */}
      <div className="hidden lg:flex items-center gap-1 shrink-0 w-[44px]">
        {subtaskTotal > 0 ? (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <CheckSquare className="h-3 w-3" />
            {subtaskCompleted}/{subtaskTotal}
          </span>
        ) : null}
      </div>

      {/* Comment count */}
      <div className="hidden lg:flex items-center shrink-0 w-[32px]">
        {task._count.comments > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gray-400">
            <MessageSquare className="h-3 w-3" />
            {task._count.comments}
          </span>
        )}
      </div>
    </div>
  )
}
