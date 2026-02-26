'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, Play, Pause, Clock } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ActiveEntryResponse {
  entry: {
    id: string
    status: 'RUNNING' | 'PAUSED' | 'STOPPED'
    startTime: string
    project: { id: string; name: string }
    room: { id: string; name: string; type: string }
    stage: { id: string; type: string }
  } | null
  elapsedSeconds: number
  serverTime: string
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function formatStageName(stageType: string) {
  return stageType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export default function TimeTrackingWidget() {
  const { data, error } = useSWR<ActiveEntryResponse>(
    '/api/timeline/me/active',
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  )

  const [elapsed, setElapsed] = useState(0)

  // Live tick for active timers
  useEffect(() => {
    if (!data?.entry || data.entry.status !== 'RUNNING') {
      setElapsed(data?.elapsedSeconds || 0)
      return
    }

    setElapsed(data.elapsedSeconds)
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [data])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load timer</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center animate-pulse">
        <div className="text-center">
          <div className="h-8 w-24 bg-gray-200 rounded mx-auto mb-2" />
          <div className="h-3 w-16 bg-gray-100 rounded mx-auto" />
        </div>
      </div>
    )
  }

  const entry = data.entry
  const isRunning = entry?.status === 'RUNNING'
  const isPaused = entry?.status === 'PAUSED'

  if (!entry) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-[13px] font-medium text-gray-700">No active timer</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Start tracking from a stage</p>
        <Link
          href="/timeline"
          className="mt-3 text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          Time Logs <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      {/* Timer display */}
      <div className={`flex items-center gap-2 mb-2 ${isRunning ? 'text-[#1A8CA3]' : isPaused ? 'text-amber-500' : 'text-gray-500'}`}>
        {isRunning ? (
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
          </div>
        ) : isPaused ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span className="text-[24px] font-mono font-bold tracking-tight">
          {formatDuration(elapsed)}
        </span>
      </div>

      {/* Status */}
      <span className={`text-[9px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded-full mb-3 ${
        isRunning ? 'bg-[#1A8CA3]/10 text-[#1A8CA3]' : isPaused ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
      }`}>
        {entry.status}
      </span>

      {/* Context */}
      <p className="text-[12px] font-medium text-gray-700 truncate max-w-full px-2">
        {formatStageName(entry.stage.type)}
      </p>
      <p className="text-[11px] text-gray-400 truncate max-w-full px-2">
        {entry.project.name} · {entry.room.name || entry.room.type}
      </p>

      <Link
        href="/timeline"
        className="mt-3 text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
      >
        Time Logs <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
