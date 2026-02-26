'use client'

import { useState } from 'react'
import { ChevronDown, Layers, CheckCircle } from 'lucide-react'
import StageRow from './StageRow'
import { StageRowSkeleton } from './SkeletonLoader'
import type { Task } from './types'

interface ActiveStagesSectionProps {
  tasks: Task[]
  isLoading: boolean
}

export default function ActiveStagesSection({ tasks, isLoading }: ActiveStagesSectionProps) {
  const [expanded, setExpanded] = useState(true)

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

  const projectCount = Object.keys(groups).length

  return (
    <div className="relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 overflow-hidden">
      {/* Bold teal left accent */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#1A8CA3]" />

      {/* ── HEADER ── */}
      <div className="pl-7 pr-6 pt-5 pb-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1A8CA3] flex items-center justify-center shadow-[0_2px_8px_rgba(26,140,163,0.35)]">
            <Layers className="w-5 h-5 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#1F2937]">Active Stages</h2>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              {tasks.length} {tasks.length === 1 ? 'stage' : 'stages'} across {projectCount} {projectCount === 1 ? 'project' : 'projects'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#9CA3AF] hover:text-[#1A8CA3] hover:bg-[#1A8CA3]/5 transition-all uppercase tracking-[0.06em]"
        >
          {expanded ? 'Collapse' : 'Expand'}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
        {isLoading ? (
          <div className="pl-7">
            {[1, 2, 3, 4].map((i) => <StageRowSkeleton key={i} />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3]/8 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#1A8CA3]/40" />
            </div>
            <p className="text-[15px] font-semibold text-[#1F2937]">All caught up</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">No active stages assigned to you</p>
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(groups).map(([projectId, group], groupIdx) => (
              <div key={projectId} className={groupIdx > 0 ? 'mt-1' : ''}>
                {/* Project group header */}
                <div className="flex items-center gap-3 pl-7 pr-6 pt-4 pb-2">
                  <div className="w-2 h-2 rounded-full bg-[#1A8CA3] shadow-[0_0_6px_rgba(26,140,163,0.4)]" />
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#1F2937]">
                    {group.projectName}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] font-medium">
                    {group.clientName}
                  </span>
                  <div className="flex-1 h-px bg-[#E5E7EB]" />
                  <span className="text-[11px] font-bold text-[#1A8CA3] bg-[#1A8CA3]/8 w-6 h-6 rounded-lg flex items-center justify-center">
                    {group.tasks.length}
                  </span>
                </div>

                {/* Stage rows */}
                {group.tasks.map((task) => (
                  <StageRow key={task.id} task={task} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
