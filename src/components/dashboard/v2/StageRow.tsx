'use client'

import { ArrowUpRight } from 'lucide-react'
import { formatDueDate } from './types'
import type { Task } from './types'

interface StageRowProps {
  task: Task
}

export default function StageRow({ task }: StageRowProps) {
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
      className="group flex items-center gap-4 pl-7 pr-6 py-3.5 cursor-pointer transition-all duration-200 hover:bg-[#F8FAFB] border-b border-[#F3F4F6] last:border-b-0"
      onClick={() => (window.location.href = `/stages/${task.id}`)}
    >
      {/* Phase name */}
      <span className="text-[13px] font-semibold text-[#1F2937] min-w-0 truncate group-hover:text-[#1A8CA3] transition-colors">
        {phaseName}
      </span>

      {/* Separator */}
      <span className="w-px h-3.5 bg-[#E5E7EB] flex-shrink-0" />

      {/* Room */}
      <span className="text-[12px] text-[#9CA3AF] hidden sm:inline truncate font-medium">
        {roomName}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Due date */}
      {task.dueDate && (
        <span className={`text-[11px] font-semibold flex-shrink-0 ${
          isOverdue ? 'text-[#991B1B]' : 'text-[#9CA3AF]'
        }`}>
          {formatDueDate(task.dueDate)}
        </span>
      )}

      {/* Overdue badge */}
      {isOverdue && (
        <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-white bg-[#991B1B] px-2 py-0.5 rounded-md flex-shrink-0">
          Overdue
        </span>
      )}

      {/* Arrow */}
      <ArrowUpRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
    </div>
  )
}
