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
    let details = log.details || {}
    
    // Parse details if it's a string
    if (typeof details === 'string') {
      try {
        details = JSON.parse(details)
      } catch (e) {
        console.error('Failed to parse log details:', e)
      }
    }
    
    const itemName = details.itemName || 'an item'

    switch (log.action) {
      case 'create':
        return {
          icon: '➕',
          color: 'text-blue-600',
          message: `${actorName} added ${itemName}`
        }
      case 'complete':
        return details.completed
          ? {
              icon: '✅',
              color: 'text-green-600',
              message: `${actorName} completed ${itemName}`
            }
          : {
              icon: '↩️',
              color: 'text-orange-600',
              message: `${actorName} marked ${itemName} as pending`
            }
      case 'update':
        return {
          icon: '✏️',
          color: 'text-blue-600',
          message: `${actorName} updated ${itemName}`
        }
      case 'delete':
        return {
          icon: '🗑️',
          color: 'text-red-600',
          message: `${actorName} removed ${itemName}`
        }
      default:
        return {
          icon: '📝',
          color: 'text-gray-600',
          message: `${actorName} modified ${itemName}`
        }
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
            {logs.map((log: any) => {
              const formatted = formatLogMessage(log)
              return (
                <div key={log.id} className="flex gap-2">
                  <div className="flex-shrink-0 text-lg leading-none">
                    {formatted.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${formatted.color}`}>
                      {formatted.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
