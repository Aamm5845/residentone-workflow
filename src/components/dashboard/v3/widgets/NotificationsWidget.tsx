'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, Bell } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Notification {
  id: string
  type: string
  title: string
  message: string
  relatedId: string | null
  relatedType: string | null
  read: boolean
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  stats: {
    totalNotifications: number
    unreadCount: number
  }
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

export default function NotificationsWidget() {
  const { data, error } = useSWR<NotificationsResponse>(
    '/api/notifications?limit=8',
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load notifications</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5" />
            <div className="flex-1">
              <div className="h-3 w-3/4 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const notifications = data.notifications || []
  const unreadCount = data.stats?.unreadCount || 0

  if (notifications.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">All caught up</p>
        <p className="text-[12px] text-gray-400 mt-0.5">No new notifications</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      {/* Unread badge */}
      {unreadCount > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#1A8CA3] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#1A8CA3]">{unreadCount} unread</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {notifications.map((notif, idx) => (
          <div
            key={notif.id}
            className={`flex items-start gap-3 px-4 py-2.5 ${
              idx > 0 ? 'border-t border-gray-100' : ''
            } ${!notif.read ? 'bg-[#1A8CA3]/[0.02]' : ''}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
              notif.read ? 'bg-gray-200' : 'bg-[#1A8CA3]'
            }`} />
            <div className="flex-1 min-w-0">
              <h4 className={`text-[12px] truncate ${
                notif.read ? 'text-gray-600 font-normal' : 'text-gray-800 font-medium'
              }`}>
                {notif.title}
              </h4>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{notif.message}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{formatTimeAgo(notif.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-end">
        <Link
          href="/notifications"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          View All <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
