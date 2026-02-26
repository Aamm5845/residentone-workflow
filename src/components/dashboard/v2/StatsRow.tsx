'use client'

import StatCard from './StatCard'
import { StatCardSkeleton } from './SkeletonLoader'
import type { DashboardStats } from './types'

interface StatsRowProps {
  stats: DashboardStats | undefined
  isLoading: boolean
  onPendingClick: () => void
}

export default function StatsRow({ stats, isLoading, onPendingClick }: StatsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <StatCard
        label="Active Projects"
        value={stats?.activeProjects?.toString() || '0'}
        isLoading={false}
        href="/projects?status=active"
      />
      <StatCard
        label="Active Rooms"
        value={stats?.activeRooms?.toString() || '0'}
        isLoading={false}
        href="/rooms?status=active"
      />
      <StatCard
        label="Pending Approvals"
        value={stats?.pendingApprovals?.toString() || '0'}
        isLoading={false}
        onClick={onPendingClick}
        showDot={(stats?.pendingApprovals || 0) > 0}
      />
      <StatCard
        label="Completed This Month"
        value={stats?.completedThisMonth?.toString() || '0'}
        isLoading={false}
        href="/projects?status=completed&timeframe=month"
      />
    </div>
  )
}
