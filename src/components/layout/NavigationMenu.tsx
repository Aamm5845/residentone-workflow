'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import {
  Home,
  FolderOpen,
  Users,
  MessageSquare,
  Activity,
  BarChart3,
  Clock,
  Sparkles,
  CalendarDays,
  Package,
  FileText,
  DollarSign,
  CheckSquare,
} from 'lucide-react'
import { changelog, countUnseenUpdates } from '@/data/changelog'

interface NavigationMenuProps {
  sidebarCollapsed: boolean
  userRole?: string
  canSeeFinancials?: boolean
}

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : { unreadCount: 0 })
const SEEN_UPDATES_KEY = 'studioflow-seen-updates'

export function NavigationMenu({ sidebarCollapsed, userRole, canSeeFinancials }: NavigationMenuProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { getNotificationsByType } = useNotifications({ limit: 50 })
  const [unseenUpdatesCount, setUnseenUpdatesCount] = useState(0)

  // On mobile, always show expanded menu (sidebarCollapsed only applies to desktop)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  
  const mentionNotifications = getNotificationsByType('MENTION')
  const messageNotifications = getNotificationsByType('CHAT_MESSAGE')
  const unreadMentionCount = mentionNotifications.filter(n => !n.read).length
  const unreadMessageCount = messageNotifications.filter(n => !n.read).length
  const totalUnreadMessages = unreadMentionCount + unreadMessageCount
  
  // Check for unseen updates
  useEffect(() => {
    const checkUnseenUpdates = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(SEEN_UPDATES_KEY)
        const seenIds = stored ? JSON.parse(stored) : []
        const count = countUnseenUpdates(seenIds)
        setUnseenUpdatesCount(count)
      }
    }
    
    checkUnseenUpdates()
    // Re-check when localStorage changes (e.g., after visiting What's New page)
    window.addEventListener('storage', checkUnseenUpdates)
    // Also check periodically in case the page stays open
    const interval = setInterval(checkUnseenUpdates, 5000)
    
    return () => {
      window.removeEventListener('storage', checkUnseenUpdates)
      clearInterval(interval)
    }
  }, [])
  
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

  // Fetch procurement inbox count with auto-refresh
  const { data: procurementData } = useSWR(
    '/api/procurement/inbox',
    fetcher,
    {
      refreshInterval: 60000, // Auto-refresh every 60 seconds
      revalidateOnFocus: true
    }
  )

  const procurementCount = procurementData?.totalCount || 0

  // Fetch task count for badge
  const { data: taskCountData } = useSWR(
    '/api/tasks/count',
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  )
  const taskCount = taskCountData?.count || 0

  // Fetch user permissions for conditional nav items
  const { data: userPerms } = useSWR(
    '/api/user/permissions',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  const showFinancials = userRole === 'OWNER' || canSeeFinancials || userPerms?.canSeeFinancials

  const mainNavigationBefore = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Projects', href: '/projects', icon: FolderOpen },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare, badgeCount: taskCount, badgeColor: 'bg-rose-500' },
  ]

  const mainNavigationAfter = [
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Timeline', href: '/timeline', icon: Clock },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    ...(showFinancials ? [{ name: 'Financials', href: '/financials', icon: DollarSign }] : []),
  ]

  // Combined flat list for collapsed view (no sub-items)
  const mainNavigation = [
    ...mainNavigationBefore,
    { name: 'Procurement', href: '/procurement', icon: FileText, badgeCount: procurementCount, badgeColor: 'bg-amber-500' },
    ...mainNavigationAfter,
  ]

  const isTasksActive = pathname.startsWith('/tasks') || pathname.match(/^\/projects\/[^/]+\/tasks/)

  const isProcurementActive = pathname.startsWith('/procurement') || pathname.match(/^\/projects\/[^/]+\/procurement/)

  const updatesNavigation = [
    { name: 'Messages', href: '/messages', icon: MessageSquare, badgeCount: totalUnreadMessages, badgeColor: 'bg-[#6366ea]' },
    { name: 'Activities', href: '/activities', icon: Activity, badgeCount: unreadActivitiesCount, badgeColor: 'bg-[#f6762e]' },
    { name: "What's New", href: '/whats-new', icon: Sparkles, badgeCount: unseenUpdatesCount, special: true },
  ]

  // Don't highlight "Projects" when viewing filtered projects (e.g., Active Projects from dashboard)
  const isActive = (href: string) => {
    // If we're on /projects with a status filter, don't highlight "Projects"
    if (href === '/projects' && pathname === '/projects' && searchParams?.get('status')) {
      return false
    }
    return pathname.startsWith(href)
  }

  // Show collapsed version only on desktop when collapsed
  if (sidebarCollapsed && !isMobile) {
    // Collapsed version
    return (
      <div className="space-y-4">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            const badge = 'badgeCount' in item ? (item as { badgeCount?: number; badgeColor?: string }).badgeCount : undefined
            const showBadge = badge && badge > 0
            const active = isActive(item.href)

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-center p-2 text-sm font-medium rounded-lg transition-colors relative',
                  active
                    ? 'bg-stone-200/70 text-stone-900'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                )}
                title={item.name}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-stone-100 text-stone-600 text-[10px] font-medium rounded-full w-5 h-5 flex items-center justify-center border border-stone-200">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Updates Navigation */}
        <div className="space-y-1 border-t border-stone-200 pt-4">
          {updatesNavigation.map((item) => {
            const Icon = item.icon
            const showBadge = item.badgeCount && item.badgeCount > 0
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-center p-2 text-sm font-medium rounded-lg transition-colors relative',
                  active
                    ? 'bg-stone-200/70 text-stone-900'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                )}
                title={item.name}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 bg-stone-100 text-stone-600 text-[10px] font-medium rounded-full w-5 h-5 flex items-center justify-center border border-stone-200">
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
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Navigation</h3>
        <nav className="space-y-0.5">
          {mainNavigationBefore.map((item) => {
            const Icon = item.icon
            const badge = 'badgeCount' in item ? (item as { badgeCount?: number; badgeColor?: string }).badgeCount : undefined
            const showBadge = badge && badge > 0
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  active
                    ? 'bg-stone-200/70 text-stone-900'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                  {item.name}
                </div>
                {showBadge && (
                  <span className="text-stone-500 text-xs font-medium bg-stone-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Procurement */}
          <Link
            href="/procurement"
            className={cn(
              'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              isProcurementActive
                ? 'bg-stone-200/70 text-stone-900'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
            )}
          >
            <div className="flex items-center">
              <FileText className={cn('flex-shrink-0 h-5 w-5 mr-3', isProcurementActive ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
              Procurement
            </div>
            {procurementCount > 0 && (
              <span className="text-stone-500 text-xs font-medium bg-stone-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {procurementCount > 99 ? '99+' : procurementCount}
              </span>
            )}
          </Link>

          {mainNavigationAfter.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  active
                    ? 'bg-stone-200/70 text-stone-900'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Updates Section */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Updates</h3>
        <nav className="space-y-0.5">
          {updatesNavigation.map((item) => {
            const Icon = item.icon
            const showBadge = item.badgeCount && item.badgeCount > 0
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  active
                    ? 'bg-stone-200/70 text-stone-900'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
                )}
              >
                <div className="flex items-center">
                  <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                  {item.name}
                </div>
                {showBadge && (
                  <span className="text-stone-500 text-xs font-medium bg-stone-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
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
