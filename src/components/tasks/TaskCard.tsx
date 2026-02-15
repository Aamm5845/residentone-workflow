'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Calendar,
  MessageSquare,
  Paperclip,
  CheckSquare,
} from 'lucide-react'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import type { TaskData, TaskStatus } from './types'

interface TaskCardProps {
  task: TaskData
  onClick: (task: TaskData) => void
  onStatusChange?: (taskId: string, status: TaskStatus) => void
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

export function TaskCard({ task, onClick, onStatusChange }: TaskCardProps) {
  const dueDateInfo = useMemo(() => getDueDateInfo(task.dueDate), [task.dueDate])

  const subtaskTotal = task._count.subtasks
  const subtaskCompleted = task.completedSubtasks ?? 0
  const subtaskProgress =
    subtaskTotal > 0 ? Math.round((subtaskCompleted / subtaskTotal) * 100) : 0

  return (
    <div
      className="group rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
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
      {/* Priority badge */}
      <div className="mb-2">
        <TaskPriorityBadge priority={task.priority} size="sm" />
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
        {task.title}
      </h4>

      {/* Subtask progress bar */}
      {subtaskTotal > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <CheckSquare className="h-3 w-3" />
              {subtaskCompleted}/{subtaskTotal}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                subtaskProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom row: metadata + assignee */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-2.5">
          {/* Due date */}
          {dueDateInfo && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                dueDateInfo.className
              )}
            >
              <Calendar className="h-3 w-3" />
              {dueDateInfo.label}
            </span>
          )}

          {/* Comments */}
          {task._count.comments > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MessageSquare className="h-3 w-3" />
              {task._count.comments}
            </span>
          )}

          {/* Attachments */}
          {task._count.attachments > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Paperclip className="h-3 w-3" />
              {task._count.attachments}
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        {task.assignedTo && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6">
                  {task.assignedTo.image && (
                    <AvatarImage
                      src={task.assignedTo.image}
                      alt={task.assignedTo.name || task.assignedTo.email}
                    />
                  )}
                  <AvatarFallback className="text-[10px] bg-purple-100 text-purple-700">
                    {getInitials(task.assignedTo.name, task.assignedTo.email)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{task.assignedTo.name || task.assignedTo.email}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}
