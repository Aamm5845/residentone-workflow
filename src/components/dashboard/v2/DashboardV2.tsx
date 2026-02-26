'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Briefcase, Layers3, Clock, CheckCircle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import MeetingsCard from './MeetingsCard'
import MyTasksCard from './MyTasksCard'
import ActiveStagesSection from './ActiveStagesSection'
import BottomStatsRow from './BottomStatsRow'
import RecentCompletionsModal from './RecentCompletionsModal'
import PendingApprovalsModal from './PendingApprovalsModal'
import { StatCardSkeleton } from './SkeletonLoader'
import { fetcher } from './types'
import type {
  DashboardStats,
  Task,
  MyTask,
  UpcomingMeeting,
  LastCompletedPhase,
} from './types'

interface DashboardV2Props {
  user: { id: string; name: string; orgId: string; role: string }
}

export default function DashboardV2({ user }: DashboardV2Props) {
  const [greeting, setGreeting] = useState('Hello')
  const [showRecentCompletions, setShowRecentCompletions] = useState(false)
  const [showPendingApprovals, setShowPendingApprovals] = useState(false)

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    )
  }, [])

  // ── Data Fetching ──
  const { data: statsData, error: statsError } = useSWR<DashboardStats>(
    '/api/dashboard/stats', fetcher, { refreshInterval: 30000, revalidateOnFocus: true }
  )
  const { data: tasksData, error: tasksError } = useSWR<{ tasks: Task[] }>(
    '/api/dashboard/tasks', fetcher, { refreshInterval: 15000, revalidateOnFocus: true }
  )
  const { data: myTasksData, error: myTasksError } = useSWR<{ tasks: MyTask[] }>(
    '/api/dashboard/my-tasks', fetcher, { refreshInterval: 15000, revalidateOnFocus: true }
  )
  const { data: meetingsData } = useSWR<{ meetings: UpcomingMeeting[] }>(
    '/api/dashboard/upcoming-meetings', fetcher, { refreshInterval: 60000, revalidateOnFocus: true }
  )
  const { data: lastPhaseData, error: lastPhaseError } = useSWR<{ data: LastCompletedPhase | null }>(
    '/api/dashboard/last-completed-phase', fetcher, { refreshInterval: 60000, revalidateOnFocus: true }
  )

  const isLoading = !statsData || !tasksData

  // ── Error State ──
  if (statsError || tasksError) {
    return (
      <div className="bg-[#F1F3F5] min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3] flex items-center justify-center mx-auto mb-5">
            <div className="w-3 h-3 rounded-full bg-white" />
          </div>
          <h3 className="text-xl font-semibold text-[#1F2937] mb-2">Unable to load dashboard</h3>
          <p className="text-sm text-[#6B7280]">Please refresh the page to try again.</p>
        </div>
      </div>
    )
  }

  const firstName = user.name?.split(' ')[0] || user.name

  // ── Stat card config ──
  const statCards = [
    { label: 'Active Projects', value: statsData?.activeProjects, icon: Briefcase, href: '/projects?status=active' },
    { label: 'Active Rooms', value: statsData?.activeRooms, icon: Layers3, href: '/rooms?status=active' },
    { label: 'Pending Approvals', value: statsData?.pendingApprovals, icon: Clock, onClick: () => setShowPendingApprovals(true), showDot: (statsData?.pendingApprovals || 0) > 0 },
    { label: 'Completed', value: statsData?.completedThisMonth, icon: CheckCircle, href: '/projects?status=completed&timeframe=month' },
  ]

  return (
    <div className="bg-[#F1F3F5] min-h-full">

      {/* ══════════════════════════════════════════════
          SOLID TEAL HEADER — the visual anchor
         ══════════════════════════════════════════════ */}
      <div className="bg-[#1A8CA3] relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative max-w-[1400px] mx-auto px-8 pt-8 pb-20">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[26px] font-semibold text-white leading-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-[14px] text-white/60 mt-1">
                {isLoading
                  ? 'Loading your workspace...'
                  : `${tasksData?.tasks?.length || 0} active ${
                      tasksData?.tasks?.length === 1 ? 'phase' : 'phases'
                    } · ${myTasksData?.tasks?.length || 0} ${
                      myTasksData?.tasks?.length === 1 ? 'task' : 'tasks'
                    }`}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 mt-2">
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-white opacity-30" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-white" />
              </div>
              <span className="text-[11px] uppercase tracking-[0.12em] text-white/50 font-medium">
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          STAT CARDS — floating up into the header
         ══════════════════════════════════════════════ */}
      <div className="max-w-[1400px] mx-auto px-8 -mt-12 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? [1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)
            : statCards.map((card) => {
                const Icon = card.icon
                const Wrapper = card.href ? Link : 'div'
                const wrapperProps = card.href
                  ? { href: card.href }
                  : { onClick: card.onClick }

                return (
                  <Wrapper
                    key={card.label}
                    {...(wrapperProps as any)}
                    className="group bg-white rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/80 cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1A8CA3] flex items-center justify-center shadow-[0_2px_8px_rgba(26,140,163,0.35)]">
                        <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
                      </div>
                      {card.showDot && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute h-full w-full rounded-full bg-[#1A8CA3] opacity-40" />
                          <span className="relative rounded-full h-2.5 w-2.5 bg-[#1A8CA3]" />
                        </span>
                      )}
                      <ArrowUpRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#1A8CA3] transition-colors" />
                    </div>
                    <p className="text-[32px] font-semibold text-[#1F2937] leading-none tracking-tight">
                      {card.value?.toString() || '0'}
                    </p>
                    <p className="text-[12px] uppercase tracking-[0.1em] font-medium text-[#9CA3AF] mt-1.5">
                      {card.label}
                    </p>
                  </Wrapper>
                )
              })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
         ══════════════════════════════════════════════ */}
      <div className="max-w-[1400px] mx-auto px-8 pt-7 pb-12 space-y-6">

        {/* Meetings & Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MeetingsCard
            meetings={meetingsData?.meetings || []}
            isLoading={!meetingsData}
          />
          <MyTasksCard
            tasks={myTasksData?.tasks || []}
            isLoading={!myTasksData && !myTasksError}
          />
        </div>

        {/* Active Stages */}
        <ActiveStagesSection
          tasks={tasksData?.tasks || []}
          isLoading={isLoading}
        />

        {/* Bottom Stats */}
        {!isLoading && statsData && (
          <BottomStatsRow
            stats={statsData}
            lastPhaseData={lastPhaseData?.data}
            lastPhaseLoading={!lastPhaseData && !lastPhaseError}
            lastPhaseError={lastPhaseError}
            onShowCompletions={() => setShowRecentCompletions(true)}
          />
        )}
      </div>

      {/* Modals */}
      <RecentCompletionsModal
        isOpen={showRecentCompletions}
        onClose={() => setShowRecentCompletions(false)}
      />
      <PendingApprovalsModal
        isOpen={showPendingApprovals}
        onClose={() => setShowPendingApprovals(false)}
      />
    </div>
  )
}
