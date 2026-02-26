'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ArrowUpRight } from 'lucide-react'
import { formatDueDate } from '../types'
import type { Task } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ActiveStagesWidget() {
  const [expanded, setExpanded] = useState(true)
  const { data, error } = useSWR<{ tasks: Task[] }>(
    '/api/dashboard/tasks',
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load stages</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
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

  // Group by project
  const groups = tasks.reduce(
    (acc: Record<string, { projectName: string; clientName: string; tasks: Task[] }>, task) => {
      if (!acc[task.projectId]) {
        acc[task.projectId] = { projectName: task.project, clientName: task.client, tasks: [] }
      }
      acc[task.projectId].tasks.push(task)
      return acc
    },
    {}
  )

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">All caught up</p>
        <p className="text-[12px] text-gray-400 mt-0.5">No active stages assigned to you</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-auto">
        {Object.entries(groups).map(([projectId, group], groupIdx) => (
          <div key={projectId} className={groupIdx > 0 ? 'border-t border-gray-100' : ''}>
            {/* Project group header */}
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5">
              <div className="w-2 h-2 rounded-full bg-[#1A8CA3]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-800">
                {group.projectName}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">{group.clientName}</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-bold text-[#1A8CA3] bg-[#1A8CA3]/8 w-5 h-5 rounded-md flex items-center justify-center">
                {group.tasks.length}
              </span>
            </div>

            {/* Stage rows */}
            {group.tasks.map((task) => {
              const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
              const phaseName = task.stageType
                .replace('_', ' ')
                .toLowerCase()
                .replace(/\b\w/g, (l) => l.toUpperCase())
              const roomName = task.roomType
                .replace('_', ' ')
                .toLowerCase()
                .replace(/\b\w/g, (l) => l.toUpperCase())

              return (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                  onClick={() => (window.location.href = `/stages/${task.id}`)}
                >
                  <span className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                    {phaseName}
                  </span>
                  <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
                  <span className="text-[11px] text-gray-400 truncate hidden sm:inline">{roomName}</span>
                  <div className="flex-1" />
                  {task.dueDate && (
                    <span className={`text-[10px] font-semibold flex-shrink-0 ${
                      isOverdue ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {formatDueDate(task.dueDate)}
                    </span>
                  )}
                  {isOverdue && (
                    <span className="text-[8px] uppercase tracking-wider font-bold text-white bg-red-600 px-1.5 py-0.5 rounded flex-shrink-0">
                      Overdue
                    </span>
                  )}
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
