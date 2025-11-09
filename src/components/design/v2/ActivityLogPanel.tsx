'use client'

import React from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useSWR from 'swr'
import { format } from 'date-fns'

interface Props {
  stageId: string
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ActivityLogPanel({ stageId }: Props) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/stages/${stageId}/design-activity?limit=50`,
    fetcher,
    {
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      revalidateOnFocus: true,
    }
  )

  const logs = data?.logs || []

  const formatLogMessage = (log: any) => {
    const actorName = log.actor?.name || log.actor?.email || 'Someone'
    const details = log.details || {}
    const itemName = details.itemName || 'an item'

    switch (log.action) {
      case 'create':
        return `${actorName} added ${itemName}`
      case 'complete':
        return details.completed
          ? `${actorName} completed ${itemName}`
          : `${actorName} marked ${itemName} as pending`
      default:
        return `${actorName} performed ${log.action} on ${itemName}`
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Activity Log</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          className="h-7 w-7 p-0"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="text-center text-sm text-gray-500 py-4">
            Loading activity...
          </div>
        ) : error ? (
          <div className="text-center text-sm text-red-600 py-4">
            Failed to load activity
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-4">
            No activity yet
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className="text-sm">
                <p className="text-gray-900">{formatLogMessage(log)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
