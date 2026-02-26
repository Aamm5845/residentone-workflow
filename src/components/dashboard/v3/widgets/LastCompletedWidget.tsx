'use client'

import useSWR from 'swr'
import Image from 'next/image'
import { formatPhaseName, formatRelativeDate } from '../types'
import type { LastCompletedPhase } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function LastCompletedWidget() {
  const { data, error } = useSWR<{ data: LastCompletedPhase | null }>(
    '/api/dashboard/last-completed-phase',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-2/3 bg-gray-200 rounded" />
        <div className="h-3 w-1/2 bg-gray-100 rounded" />
        <div className="flex items-center gap-2 mt-3">
          <div className="w-8 h-8 rounded-full bg-gray-200" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  const phase = data.data

  if (!phase) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">No completions yet</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Recently completed phases will appear here</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <h3 className="text-[16px] font-semibold text-gray-900 leading-snug">
          {formatPhaseName(phase.stageType)}
        </h3>
        <p className="text-[12px] text-gray-400 mt-0.5">
          {phase.projectName} · {phase.roomName || phase.roomType}
        </p>
      </div>

      {/* Completed by */}
      <div className="flex items-center gap-2.5 mt-3">
        <div className="w-8 h-8 rounded-full bg-[#1A8CA3] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0 overflow-hidden ring-2 ring-[#1A8CA3]/15">
          {phase.completedBy.image ? (
            <Image
              src={phase.completedBy.image}
              alt={phase.completedBy.name}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span>{phase.completedBy.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className="text-[12px] font-medium text-gray-700">{phase.completedBy.name}</p>
          <p className="text-[10px] text-gray-400">{formatRelativeDate(phase.completedAt)}</p>
        </div>
      </div>
    </div>
  )
}
