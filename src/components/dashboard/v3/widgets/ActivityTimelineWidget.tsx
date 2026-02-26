'use client'

import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ActivityItem {
  id: string
  action: string
  entity: string
  entityId: string
  details: Record<string, any>
  createdAt: string
  actor: {
    id: string
    name: string
    email: string
    image: string | null
    role: string
  } | null
}

interface ActivityResponse {
  items: ActivityItem[]
  pagination: { page: number; hasMore: boolean }
}

function formatTimeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatEntity(entity: string) {
  return entity
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export default function ActivityTimelineWidget() {
  const { data, error } = useSWR<ActivityResponse>(
    '/api/activities?perPage=10',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load activity</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-3/4 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/3 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const items = data.items || []

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">No recent activity</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Activity will appear here as it happens</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-auto">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 px-4 py-2.5 ${
              idx > 0 ? 'border-t border-gray-100' : ''
            }`}
          >
            {/* Actor avatar */}
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-500 flex-shrink-0 overflow-hidden mt-0.5">
              {item.actor?.image ? (
                <Image src={item.actor.image} alt={item.actor.name} width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                item.actor?.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-gray-700 leading-relaxed">
                <span className="font-medium">{item.actor?.name || 'System'}</span>
                {' '}
                <span className="text-gray-500">{formatAction(item.action).toLowerCase()}</span>
                {' '}
                <span className="text-gray-600 font-medium">
                  {item.details?.name || item.details?.title || formatEntity(item.entity)}
                </span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatTimeAgo(item.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-end">
        <Link
          href="/activities"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          Full Timeline <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
