'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { ActivityItem } from '@/components/activities/ActivityItem'
import { ActivityFilters, ActivityFilterState } from '@/components/activities/ActivityFilters'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, Activity as ActivityIcon } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ActivitiesContent() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ActivityFilterState>({
    types: [],
    users: [],
    startDate: undefined,
    endDate: undefined
  })
  
  // Mark activities as read when visiting the page
  useEffect(() => {
    const markAsRead = async () => {
      try {
        const response = await fetch('/api/activities/mark-read', { method: 'POST' })
        const data = await response.json()
        
        // Store timestamp in localStorage
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
      perPage: '25'
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
    
    return `/api/activities?${params.toString()}`
  }, [page, filters])
  
  // Fetch activities with auto-refresh every 30 seconds
  const { data, error, isLoading, mutate } = useSWR(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )
  
  const activities = data?.items || []
  const hasMore = data?.pagination?.hasMore || false
  const isRefreshing = isLoading && activities.length > 0
  
  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }
  
  const handleRefresh = () => {
    setPage(1) // Reset to first page
    mutate()
  }
  
  const handleFilterChange = (newFilters: ActivityFilterState) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page when filters change
  }
  
  return (
    <>
      {/* Header Actions */}
      <div className="mb-6 flex justify-end gap-2">
        <ActivityFilters
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Activities Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <ActivityIcon className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-red-600 mb-2">Failed to load activities</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <ActivityIcon className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-600 mb-1">No activities yet</p>
            <p className="text-xs text-gray-500 text-center max-w-md">
              Activities will appear here as team members work on projects, upload files, add comments, and more.
            </p>
          </div>
        ) : (
          <>
            {activities.map((activity: any) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
            
            {/* Load More Button */}
            {hasMore && (
              <div className="p-4 border-t border-gray-200 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
            
            {/* End of Feed Message */}
            {!hasMore && activities.length > 0 && (
              <div className="p-4 text-center text-xs text-gray-500 border-t border-gray-200">
                You've reached the end of the activity feed
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Auto-refresh Indicator */}
      {isRefreshing && activities.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Refreshing activities...
          </p>
        </div>
      )}
    </>
  )
}
