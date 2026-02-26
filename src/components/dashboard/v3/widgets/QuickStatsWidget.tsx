'use client'

import useSWR from 'swr'
import { Briefcase, Layers3, Clock, CheckCircle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function QuickStatsWidget() {
  const { data, error } = useSWR<DashboardStats>(
    '/api/dashboard/stats',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load stats</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3">
            <div className="h-3 w-8 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: 'Active Projects',
      value: data.activeProjects,
      icon: Briefcase,
      href: '/projects?status=active',
      color: '#1A8CA3',
    },
    {
      label: 'Active Rooms',
      value: data.activeRooms,
      icon: Layers3,
      href: '/rooms?status=active',
      color: '#a657f0',
    },
    {
      label: 'Pending Approvals',
      value: data.pendingApprovals,
      icon: Clock,
      href: '#',
      color: '#f6762e',
      showDot: data.pendingApprovals > 0,
    },
    {
      label: 'Completed',
      value: data.completedThisMonth,
      icon: CheckCircle,
      href: '/projects?status=completed&timeframe=month',
      color: '#22c55e',
    },
  ]

  return (
    <div className="h-full grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Link
            key={stat.label}
            href={stat.href}
            className="group relative bg-gray-50 hover:bg-white rounded-xl p-3 transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-transparent hover:border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}12` }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} strokeWidth={1.8} />
              </div>
              {stat.showDot && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full opacity-40" style={{ backgroundColor: stat.color }} />
                  <span className="relative rounded-full h-2 w-2" style={{ backgroundColor: stat.color }} />
                </span>
              )}
            </div>
            <p className="text-[22px] font-semibold text-gray-900 leading-none tracking-tight">
              {stat.value}
            </p>
            <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-gray-400 mt-1">
              {stat.label}
            </p>
            <ArrowUpRight className="absolute top-3 right-3 w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
