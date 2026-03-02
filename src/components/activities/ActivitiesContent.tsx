'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { ActivityItem } from '@/components/activities/ActivityItem'
import { ActivityFilters, ActivityFilterState, CATEGORY_TABS } from '@/components/activities/ActivityFilters'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, Activity as ActivityIcon, ChevronDown } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, startOfDay } from 'date-fns'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// Get default date range (last 7 days)
function getDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  }
}

// Group activities by day
function groupByDay(activities: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()

  for (const activity of activities) {
    const date = startOfDay(parseISO(activity.createdAt))
    const key = format(date, 'yyyy-MM-dd')

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(activity)
  }

  return groups
}

// Format day header
function formatDayHeader(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE M/d')
}

export default function ActivitiesContent() {
  const [page, setPage] = useState(1)
  const defaults = getDefaultDateRange()
  const [filters, setFilters] = useState<ActivityFilterState>({
    types: [],
    users: [],
    startDate: defaults.startDate,
    endDate: defaults.endDate,
    category: undefined,
  })

  // All fetched activities accumulated across pages
  const [allActivities, setAllActivities] = useState<any[]>([])

  // Mark activities as read when visiting the page
  useEffect(() => {
    const markAsRead = async () => {
      try {
        const response = await fetch('/api/activities/mark-read', { method: 'POST' })
        const data = await response.json()
        if (data.timestamp) {
          localStorage.setItem('activities-last-viewed', data.timestamp)
        }
      } catch (error) {
        console.error('Failed to mark activities as read:', error)
      }
    }
    markAsRead()
  }, [])

  // Build API URL with filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: '50'
    })

    if (filters.types.length > 0) {
      params.append('types', filters.types.join(','))
    }
    if (filters.users.length > 0) {
      params.append('users', filters.users.join(','))
    }
    if (filters.startDate) {
      params.append('startDate', filters.startDate)
    }
    if (filters.endDate) {
      params.append('endDate', filters.endDate)
    }
    if (filters.category) {
      params.append('category', filters.category)
    }

    return `/api/activities?${params.toString()}`
  }, [page, filters])

  // Fetch activities with auto-refresh
  const { data, error, isLoading, mutate } = useSWR(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )

  // Accumulate activities across pages (reset when filters change)
  useEffect(() => {
    if (data?.items) {
      if (page === 1) {
        setAllActivities(data.items)
      } else {
        setAllActivities(prev => {
          const existingIds = new Set(prev.map((a: any) => a.id))
          const newItems = data.items.filter((a: any) => !existingIds.has(a.id))
          return [...prev, ...newItems]
        })
      }
    }
  }, [data, page])

  const hasMore = data?.pagination?.hasMore || false
  const isRefreshing = isLoading && allActivities.length > 0
  const dayGroups = groupByDay(allActivities)

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  const handleRefresh = () => {
    setPage(1)
    setAllActivities([])
    mutate()
  }

  const handleFilterChange = (newFilters: ActivityFilterState) => {
    setFilters(newFilters)
    setPage(1)
    setAllActivities([])
  }

  return (
    <>
      {/* Filter Bar */}
      <div className="mb-6">
        <ActivityFilters
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />
      </div>

      {/* Timeline Feed */}
      <div className="relative">
        {isLoading && allActivities.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <ActivityIcon className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-red-600 mb-2">Failed to load activities</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : allActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <ActivityIcon className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-600 mb-1">No activities found</p>
            <p className="text-xs text-gray-500 text-center max-w-md">
              Activities will appear here as team members work on projects, create orders, manage contractors, and more.
            </p>
          </div>
        ) : (
          <>
            {Array.from(dayGroups.entries()).map(([dateKey, activities]) => (
              <div key={dateKey} className="mb-6">
                {/* Day Header */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {formatDayHeader(dateKey)}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                  </span>
                </div>

                {/* Timeline Items */}
                <div className="relative pl-6">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />

                  {activities.map((activity: any, index: number) => (
                    <div key={activity.id} className="relative mb-1 last:mb-0">
                      {/* Timeline dot */}
                      <div className="absolute left-[-15px] top-[14px] w-[7px] h-[7px] rounded-full bg-gray-400 ring-2 ring-white" />

                      {/* Activity Item */}
                      <ActivityItem activity={activity} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Load more days
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* End of Feed */}
            {!hasMore && allActivities.length > 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">
                  End of activity log for this period
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Auto-refresh Indicator */}
      {isRefreshing && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
          <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />
          <span className="text-xs text-gray-500">Refreshing...</span>
        </div>
      )}
    </>
  )
}
