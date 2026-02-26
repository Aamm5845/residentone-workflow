'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import type { MyTask } from '../types'
import { formatDueDate } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  TODO:        { label: 'To Do',       dot: 'bg-gray-300',    text: 'text-gray-400' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-[#1A8CA3]',  text: 'text-[#1A8CA3]' },
  REVIEW:      { label: 'Review',      dot: 'bg-gray-500',    text: 'text-gray-500' },
}

export default function MyTasksWidget() {
  const [expanded, setExpanded] = useState(false)
  const { data, error } = useSWR<{ tasks: MyTask[] }>(
    '/api/dashboard/my-tasks',
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load tasks</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3.5 w-3/4 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const tasks = data.tasks || []
  const collapsedLimit = 5
  const visibleTasks = expanded ? tasks : tasks.slice(0, collapsedLimit)
  const hiddenCount = tasks.length - collapsedLimit

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">All clear</p>
        <p className="text-[12px] text-gray-400 mt-0.5">No open tasks right now</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {visibleTasks.map((task, idx) => {
          const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
          const status = statusConfig[task.status] || statusConfig.TODO

          return (
            <div
              key={task.id}
              className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
              onClick={() => (window.location.href = `/tasks/${task.id}`)}
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-medium text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                  {task.title}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-400 truncate">{task.project.name}</span>
                  <span className="w-px h-2 bg-gray-200 flex-shrink-0" />
                  <span className={`text-[11px] font-medium ${status.text}`}>{status.label}</span>
                </div>
              </div>
              {task.dueDate && (
                <span className={`text-[10px] font-semibold flex-shrink-0 ${
                  isOverdue ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {formatDueDate(task.dueDate)}
                </span>
              )}
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
            </div>
          )
        })}
      </div>

      {/* Show more / footer */}
      <div className="flex-shrink-0 border-t border-gray-100 flex items-center justify-between px-4 py-2">
        {hiddenCount > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>+{hiddenCount} more <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        ) : (
          <span className="text-[11px] text-gray-400">{tasks.length} tasks</span>
        )}
        <Link
          href="/tasks?tab=assigned_to_me"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          All Tasks <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
