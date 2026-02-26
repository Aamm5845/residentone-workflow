'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckSquare, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { TaskRowSkeleton } from './SkeletonLoader'
import { formatDueDate } from './types'
import type { MyTask } from './types'

interface MyTasksCardProps {
  tasks: MyTask[]
  isLoading: boolean
}

const statusConfig: Record<string, { label: string; dot: string; ring: string; text: string }> = {
  TODO:        { label: 'To Do',       dot: 'bg-[#D1D5DB]',  ring: '',                       text: 'text-[#9CA3AF]' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-[#1A8CA3]',  ring: 'ring-4 ring-[#1A8CA3]/15', text: 'text-[#1A8CA3]' },
  REVIEW:      { label: 'Review',      dot: 'bg-[#6B7280]',  ring: 'ring-4 ring-[#6B7280]/10', text: 'text-[#6B7280]' },
}

export default function MyTasksCard({ tasks, isLoading }: MyTasksCardProps) {
  const [expanded, setExpanded] = useState(false)
  const collapsedLimit = 4
  const visibleTasks = expanded ? tasks : tasks.slice(0, collapsedLimit)
  const hiddenCount = tasks.length - collapsedLimit

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 overflow-hidden flex flex-col">
      {/* ── HEADER with solid teal bar ── */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#1A8CA3]" />
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A8CA3] flex items-center justify-center shadow-[0_2px_8px_rgba(26,140,163,0.35)]">
              <CheckSquare className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F2937]">My Tasks</h2>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{tasks.length} active</p>
            </div>
          </div>
          <Link
            href="/tasks?tab=assigned_to_me"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A8CA3]/8 text-[11px] font-semibold text-[#1A8CA3] hover:bg-[#1A8CA3]/15 hover:text-[#136F82] transition-all uppercase tracking-[0.06em]"
          >
            All Tasks <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="mx-6 h-px bg-[#E5E7EB]" />

      {isLoading ? (
        <div className="flex-1 p-3">
          {[1, 2, 3].map((i) => <TaskRowSkeleton key={i} />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-14 px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3]/8 flex items-center justify-center mb-4">
            <CheckSquare className="w-6 h-6 text-[#1A8CA3]/40" />
          </div>
          <p className="text-[15px] font-semibold text-[#1F2937]">All clear</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">No open tasks right now</p>
        </div>
      ) : (
        <div className="flex-1">
          {visibleTasks.map((task, idx) => {
            const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false
            const status = statusConfig[task.status] || statusConfig.TODO

            return (
              <div
                key={task.id}
                className={`group flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-all duration-200 hover:bg-[#F8FAFB] ${
                  idx > 0 ? 'border-t border-[#F3F4F6]' : ''
                }`}
                onClick={() => (window.location.href = `/tasks/${task.id}`)}
              >
                {/* Status indicator */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${status.dot} ${status.ring}`} />
                  {task.priority === 'URGENT' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#991B1B]" />
                  )}
                  {task.priority === 'HIGH' && (
                    <div className="w-1 h-1 rounded-full bg-[#9CA3AF]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-[#1F2937] truncate group-hover:text-[#1A8CA3] transition-colors">
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[#D1D5DB] truncate">
                      {task.project.name}
                    </span>
                    <span className="w-px h-2.5 bg-[#E5E7EB]" />
                    <span className={`text-[11px] font-semibold ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Due date */}
                {task.dueDate && (
                  <span className={`text-[11px] font-semibold flex-shrink-0 px-2 py-0.5 rounded ${
                    isOverdue
                      ? 'text-[#991B1B] bg-[#991B1B]/6'
                      : 'text-[#9CA3AF]'
                  }`}>
                    {formatDueDate(task.dueDate)}
                  </span>
                )}

                {/* Arrow */}
                <ArrowUpRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
              </div>
            )
          })}

          {/* Show more button */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-6 py-3.5 border-t border-[#E5E7EB] text-[12px] font-semibold text-[#1A8CA3] hover:text-[#136F82] hover:bg-[#1A8CA3]/[0.03] transition-all flex items-center justify-center gap-1.5"
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>+{hiddenCount} more tasks <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
