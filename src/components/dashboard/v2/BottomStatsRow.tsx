'use client'

import { TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react'
import LastCompletedCard from './LastCompletedCard'
import type { DashboardStats, LastCompletedPhase } from './types'

interface BottomStatsRowProps {
  stats: DashboardStats | undefined
  lastPhaseData: LastCompletedPhase | null | undefined
  lastPhaseLoading: boolean
  lastPhaseError: any
  onShowCompletions: () => void
}

export default function BottomStatsRow({
  stats,
  lastPhaseData,
  lastPhaseLoading,
  lastPhaseError,
  onShowCompletions,
}: BottomStatsRowProps) {
  const overdue = stats?.overdueTasks || 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Last Completed Phase */}
      <LastCompletedCard
        data={lastPhaseData}
        isLoading={lastPhaseLoading}
        error={lastPhaseError}
        onShowMore={onShowCompletions}
      />

      {/* Active Stages Counter */}
      <div
        className="group relative bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 p-6 cursor-pointer hover:shadow-[0_8px_30px_rgba(26,140,163,0.12)] hover:border-[#1A8CA3]/20 transition-all duration-300 flex flex-col justify-between overflow-hidden"
        onClick={() => (window.location.href = '/stages?status=active')}
      >
        {/* Teal gradient corner */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#1A8CA3]/[0.06] to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#9CA3AF]">
              Active Stages
            </p>
            <div className="w-8 h-8 rounded-lg bg-[#1A8CA3]/8 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#1A8CA3]" />
            </div>
          </div>
          <p className="text-[40px] font-semibold text-[#1A8CA3] leading-none tracking-[-0.02em]">
            {stats?.activeStages ?? '—'}
          </p>
        </div>

        <div className="mt-5 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[#1A8CA3] uppercase tracking-[0.06em] group-hover:opacity-100 opacity-60 transition-opacity">
            View all stages
          </p>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#1A8CA3]/40 group-hover:text-[#1A8CA3] transition-colors" />
        </div>
      </div>

      {/* Overdue Items */}
      <div
        className={`group relative rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] p-6 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden ${
          overdue > 0
            ? 'bg-white border border-[#991B1B]/15 hover:shadow-[0_8px_30px_rgba(153,27,27,0.1)] hover:border-[#991B1B]/25'
            : 'bg-white border border-white/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
        }`}
        onClick={() => (window.location.href = '/tasks?status=overdue')}
      >
        {/* Corner accent */}
        {overdue > 0 && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#991B1B]/[0.04] to-transparent rounded-bl-full pointer-events-none" />
        )}

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className={`text-[11px] uppercase tracking-[0.14em] font-semibold ${
              overdue > 0 ? 'text-[#991B1B]/70' : 'text-[#9CA3AF]'
            }`}>
              Overdue Items
            </p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              overdue > 0 ? 'bg-[#991B1B]/8' : 'bg-[#F3F4F6]'
            }`}>
              <AlertCircle className={`w-4 h-4 ${
                overdue > 0 ? 'text-[#991B1B]/60' : 'text-[#D1D5DB]'
              }`} />
            </div>
          </div>
          <p className={`text-[40px] font-semibold leading-none tracking-[-0.02em] ${
            overdue > 0 ? 'text-[#991B1B]' : 'text-[#1F2937]'
          }`}>
            {overdue}
          </p>
        </div>

        <div className="mt-5 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
          {overdue > 0 ? (
            <p className="text-[11px] font-semibold text-[#991B1B]/70 uppercase tracking-[0.06em]">
              Requires attention
            </p>
          ) : (
            <p className="text-[11px] text-[#D1D5DB] font-medium">No overdue items</p>
          )}
          <ArrowUpRight className={`w-3.5 h-3.5 ${
            overdue > 0 ? 'text-[#991B1B]/30 group-hover:text-[#991B1B]/60' : 'text-[#E5E7EB]'
          } transition-colors`} />
        </div>
      </div>
    </div>
  )
}
