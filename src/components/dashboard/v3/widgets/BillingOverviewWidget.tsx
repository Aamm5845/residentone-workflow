'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface DashboardStats {
  activeProjects: number
  activeRooms: number
  pendingApprovals: number
  completedThisMonth: number
  totalRevenue: number
  activeStages: number
  overdueTasks: number
}

export default function BillingOverviewWidget() {
  const { data: stats, error } = useSWR<DashboardStats>(
    '/api/dashboard/stats',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load billing</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/2 bg-gray-200 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 rounded" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
      </div>
    )
  }

  const revenue = stats.totalRevenue || 0
  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(revenue)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        {/* Revenue */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-gray-400 mb-1">Total Revenue</p>
          <p className="text-[26px] font-semibold text-gray-900 leading-none tracking-tight">
            {formattedRevenue}
          </p>
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[18px] font-semibold text-gray-900">{stats.completedThisMonth}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Completed This Month</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[18px] font-semibold text-gray-900">{stats.activeProjects}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Active Projects</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
        <Link
          href="/billing"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          View Billing <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
