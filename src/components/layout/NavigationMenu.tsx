'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { 
  Home, 
  FolderOpen, 
  Users, 
  Inbox,
  Activity
} from 'lucide-react'

interface NavigationMenuProps {
  sidebarCollapsed: boolean
}

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : { unreadCount: 0 })

export function NavigationMenu({ sidebarCollapsed }: NavigationMenuProps) {
  const pathname = usePathname()
  const { getNotificationsByType } = useNotifications({ limit: 50 })
  
  const mentionNotifications = getNotificationsByType('MENTION')
  const unreadMentionCount = mentionNotifications.filter(n => !n.read).length
  
  // Get lastViewed from localStorage
  const getLastViewed = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activities-last-viewed')
    }
    return null
  }
  
  // Build URL with lastViewed parameter
  const activitiesUrl = () => {
    const lastViewed = getLastViewed()
    return lastViewed ? `/api/activities/unread?lastViewed=${lastViewed}` : '/api/activities/unread'
  }
  
  // Fetch unread activities count with auto-refresh
  const { data: activitiesData } = useSWR(
    activitiesUrl(),
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true
    }
  )
  
  const unreadActivitiesCount = activitiesData?.unreadCount || 0

  const mainNavigation = [
    { name: 'Home', href: '/dashboard', icon: Home, color: 'text-purple-600' },
    { name: 'My Projects', href: '/projects', icon: FolderOpen, color: 'text-blue-600' },
    { name: 'Team', href: '/team', icon: Users, color: 'text-green-600' },
  ]

  const messagesNavigation = [
    { name: 'Inbox', href: '/inbox', icon: Inbox, color: 'text-indigo-600', badgeCount: unreadMentionCount },
    { name: 'Activities', href: '/activities', icon: Activity, color: 'text-indigo-600', badgeCount: unreadActivitiesCount },
  ]

  const isActive = (href: string) => pathname.startsWith(href)

  if (sidebarCollapsed) {
    // Collapsed version
    return (
      <div className="space-y-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-center p-2 text-sm font-medium rounded-md transition-colors relative',
                  isActive(item.href)
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
                title={item.name}
              >
                <Icon className={cn('h-5 w-5', item.color)} />
              </Link>
            )
          })}
        </div>

        {/* Messages Navigation */}
        <div className="space-y-1 border-t border-gray-200 pt-4">
          {messagesNavigation.map((item) => {
            const Icon = item.icon
            const showBadge = item.badgeCount && item.badgeCount > 0
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-center p-2 text-sm font-medium rounded-md transition-colors relative',
                  isActive(item.href)
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
                title={item.name}
              >
                <Icon className={cn('h-5 w-5', item.color)} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  // Expanded version
  return (
    <div className="space-y-6">
      {/* Main Navigation */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Navigation</h3>
        <nav className="space-y-1">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive(item.href)
                    ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', item.color)} />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Messages Section */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Messages</h3>
        <nav className="space-y-1">
          {messagesNavigation.map((item) => {
            const Icon = item.icon
            const showBadge = item.badgeCount && item.badgeCount > 0
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive(item.href)
                    ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', item.color)} />
                  {item.name}
                </div>
                {showBadge && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
