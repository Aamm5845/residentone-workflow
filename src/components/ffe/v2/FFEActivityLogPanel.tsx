'use client'

import React from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import useSWR from 'swr'
import { format } from 'date-fns'

interface Props {
  roomId: string
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function FFEActivityLogPanel({ roomId }: Props) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/ffe/v2/rooms/${roomId}/activity?limit=20`,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  )

  const logs = data?.logs || []

  const getStateEmoji = (state: string) => {
    switch (state) {
      case 'COMPLETED': return '✓'
      case 'UNDECIDED':
      case 'SELECTED':
      case 'CONFIRMED': return '?'
      case 'PENDING':
      default: return '○'
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'COMPLETED': return 'text-green-600'
      case 'UNDECIDED':
      case 'SELECTED':
      case 'CONFIRMED': return 'text-amber-600'
      case 'PENDING':
      default: return 'text-blue-600'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Compact Header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">Activity</span>
        </div>
        <button
          onClick={() => mutate()}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3 text-gray-400" />
        </button>
      </div>

      {/* Compact Log List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-center text-xs text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-3 text-center text-xs text-red-500">Failed to load</div>
        ) : logs.length === 0 ? (
          <div className="p-3 text-center text-xs text-gray-400">No activity yet</div>
        ) : (
          <div className="py-1">
            {logs.map((log: any) => {
              const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
              const actorName = log.actor?.name?.split(' ')[0] || 'User'
              return (
                <div key={log.id} className="px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 text-xs">
                  <span className={`font-bold ${getStateColor(details.newState)}`}>
                    {getStateEmoji(details.newState)}
                  </span>
                  <span className="text-gray-700 truncate flex-1" title={details.itemName}>
                    {details.itemName}
                  </span>
                  <span className="text-gray-400 text-[10px] whitespace-nowrap">
                    {actorName} · {format(new Date(log.createdAt), 'h:mm a')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
