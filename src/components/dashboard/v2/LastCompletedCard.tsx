'use client'

import Image from 'next/image'
import { Award, ArrowUpRight } from 'lucide-react'
import { BottomCardSkeleton } from './SkeletonLoader'
import { formatPhaseName, formatRelativeDate } from './types'
import type { LastCompletedPhase } from './types'

interface LastCompletedCardProps {
  data: LastCompletedPhase | null | undefined
  isLoading: boolean
  error: any
  onShowMore: () => void
}

export default function LastCompletedCard({
  data,
  isLoading,
  error,
  onShowMore,
}: LastCompletedCardProps) {
  if (isLoading) return <BottomCardSkeleton />

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 p-6">
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3]/8 flex items-center justify-center mx-auto mb-4">
            <Award className="w-6 h-6 text-[#1A8CA3]/40" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#9CA3AF] mb-1">
            Last Completed
          </p>
          <p className="text-[14px] text-[#9CA3AF]">
            {error ? 'Error loading data' : 'No recent completions'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 p-6 cursor-pointer hover:shadow-[0_8px_30px_rgba(26,140,163,0.12)] hover:border-[#1A8CA3]/20 transition-all duration-300 overflow-hidden"
      onClick={onShowMore}
    >
      {/* Teal gradient corner accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#1A8CA3]/[0.06] to-transparent rounded-bl-full pointer-events-none" />

      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#9CA3AF]">
          Last Completed
        </p>
        <div className="w-8 h-8 rounded-lg bg-[#1A8CA3]/8 flex items-center justify-center">
          <Award className="w-4 h-4 text-[#1A8CA3]" />
        </div>
      </div>

      <h3 className="text-[18px] font-semibold text-[#1F2937] mb-0.5 group-hover:text-[#1A8CA3] transition-colors">
        {formatPhaseName(data.stageType)}
      </h3>

      <p className="text-[13px] text-[#9CA3AF] mb-4">
        {data.projectName} · {data.roomName || data.roomType}
      </p>

      {/* Completed by */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1A8CA3] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden ring-3 ring-[#1A8CA3]/15 shadow-[0_2px_8px_rgba(26,140,163,0.3)]">
          {data.completedBy.image ? (
            <Image
              src={data.completedBy.image}
              alt={data.completedBy.name}
              width={36}
              height={36}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <span>{data.completedBy.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1F2937]">
            {data.completedBy.name}
          </p>
          <p className="text-[11px] text-[#9CA3AF]">
            {formatRelativeDate(data.completedAt)}
          </p>
        </div>
      </div>

      {/* View more link */}
      <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#1A8CA3] uppercase tracking-[0.06em]">
          View all completions
        </p>
        <ArrowUpRight className="w-3.5 h-3.5 text-[#1A8CA3]/40 group-hover:text-[#1A8CA3] transition-colors" />
      </div>
    </div>
  )
}
