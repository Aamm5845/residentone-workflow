'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface TimeEntry {
  id: string
  userId: string
  projectId: string | null
  roomId: string | null
  stageId: string | null
  description: string | null
  startTime: string
  endTime: string | null
  duration: number | null
  status: 'RUNNING' | 'PAUSED' | 'STOPPED'
  isManual: boolean
  isBillable: boolean
  project: { id: string; name: string } | null
  room: { id: string; name: string; type: string } | null
  stage: { id: string; type: string } | null
  user: { id: string; name: string; image: string | null }
  pauses: Array<{
    id: string
    pausedAt: string
    resumedAt: string | null
    duration: number | null
  }>
}

interface StartTimerOptions {
  projectId?: string
  roomId?: string
  stageId?: string
  description?: string
  startTime?: string // Custom start time (ISO string)
}

interface StopTimerOptions {
  endTime?: string // Custom end time (ISO string)
}

interface TimerContextType {
  activeEntry: TimeEntry | null
  elapsedSeconds: number
  isRunning: boolean
  isPaused: boolean
  isLoading: boolean
  error: string | null
  startTimer: (options?: StartTimerOptions) => Promise<TimeEntry | null>
  pauseTimer: () => Promise<void>
  resumeTimer: () => Promise<void>
  stopTimer: (options?: StopTimerOptions) => Promise<void>
  updateDescription: (description: string) => Promise<void>
  refreshTimer: () => Promise<void>
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const serverTimeOffset = useRef(0) // Offset between server and client time

  const isRunning = activeEntry?.status === 'RUNNING'
  const isPaused = activeEntry?.status === 'PAUSED'

  // Calculate elapsed time from entry
  const calculateElapsedSeconds = useCallback((entry: TimeEntry | null, serverTime?: string) => {
    if (!entry) return 0

    const now = serverTime ? new Date(serverTime) : new Date(Date.now() + serverTimeOffset.current)
    const start = new Date(entry.startTime)
    const totalMs = now.getTime() - start.getTime()

    // Subtract pause time
    const pauseMs = entry.pauses.reduce((acc, pause) => {
      if (pause.resumedAt) {
        return acc + (new Date(pause.resumedAt).getTime() - new Date(pause.pausedAt).getTime())
      } else if (entry.status === 'PAUSED') {
        // Currently paused
        return acc + (now.getTime() - new Date(pause.pausedAt).getTime())
      }
      return acc
    }, 0)

    return Math.max(0, Math.floor((totalMs - pauseMs) / 1000))
  }, [])

  // Fetch active entry from server
  const fetchActiveEntry = useCallback(async () => {
    try {
      const response = await fetch('/api/timeline/me/active')
      if (!response.ok) {
        if (response.status === 401) {
          setActiveEntry(null)
          return
        }
        throw new Error('Failed to fetch active timer')
      }

      const data = await response.json()
      
      if (data.serverTime) {
        // Calculate offset between server and client time
        serverTimeOffset.current = new Date(data.serverTime).getTime() - Date.now()
      }

      setActiveEntry(data.entry)
      if (data.entry) {
        setElapsedSeconds(data.elapsedSeconds || calculateElapsedSeconds(data.entry, data.serverTime))
      } else {
        setElapsedSeconds(0)
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching active timer:', err)
      setError('Failed to sync timer')
    }
  }, [calculateElapsedSeconds])

  // Initial fetch and polling
  useEffect(() => {
    setIsLoading(true)
    fetchActiveEntry().finally(() => setIsLoading(false))

    // Poll every 30 seconds to sync across tabs/devices
    const pollInterval = setInterval(fetchActiveEntry, 30000)

    return () => clearInterval(pollInterval)
  }, [fetchActiveEntry])

  // Update elapsed time every second when running
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning])

  // Start timer
  const startTimer = useCallback(async (options?: StartTimerOptions): Promise<TimeEntry | null> => {
    try {
      setError(null)
      const response = await fetch('/api/timeline/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: options?.projectId,
          roomId: options?.roomId,
          stageId: options?.stageId,
          description: options?.description,
          startTime: options?.startTime,
          isManual: false
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start timer')
      }

      const data = await response.json()
      setActiveEntry(data.entry)
      setElapsedSeconds(calculateElapsedSeconds(data.entry))
      return data.entry
    } catch (err: any) {
      setError(err.message)
      console.error('Error starting timer:', err)
      return null
    }
  }, [calculateElapsedSeconds])

  // Pause timer
  const pauseTimer = useCallback(async () => {
    if (!activeEntry) return

    try {
      setError(null)
      const response = await fetch(`/api/timeline/entries/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to pause timer')
      }

      const data = await response.json()
      setActiveEntry(data.entry)
    } catch (err: any) {
      setError(err.message)
      console.error('Error pausing timer:', err)
    }
  }, [activeEntry])

  // Resume timer
  const resumeTimer = useCallback(async () => {
    if (!activeEntry) return

    try {
      setError(null)
      const response = await fetch(`/api/timeline/entries/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resume timer')
      }

      const data = await response.json()
      setActiveEntry(data.entry)
      setElapsedSeconds(calculateElapsedSeconds(data.entry))
    } catch (err: any) {
      setError(err.message)
      console.error('Error resuming timer:', err)
    }
  }, [activeEntry, calculateElapsedSeconds])

  // Stop timer
  const stopTimer = useCallback(async (options?: StopTimerOptions) => {
    if (!activeEntry) return

    try {
      setError(null)
      const response = await fetch(`/api/timeline/entries/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'stop',
          endTime: options?.endTime 
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to stop timer')
      }

      setActiveEntry(null)
      setElapsedSeconds(0)
    } catch (err: any) {
      setError(err.message)
      console.error('Error stopping timer:', err)
    }
  }, [activeEntry])

  // Update description
  const updateDescription = useCallback(async (description: string) => {
    if (!activeEntry) return

    try {
      setError(null)
      const response = await fetch(`/api/timeline/entries/${activeEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update description')
      }

      const data = await response.json()
      setActiveEntry(data.entry)
    } catch (err: any) {
      setError(err.message)
      console.error('Error updating description:', err)
    }
  }, [activeEntry])

  // Refresh timer (manual sync)
  const refreshTimer = useCallback(async () => {
    await fetchActiveEntry()
  }, [fetchActiveEntry])

  return (
    <TimerContext.Provider
      value={{
        activeEntry,
        elapsedSeconds,
        isRunning,
        isPaused,
        isLoading,
        error,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        updateDescription,
        refreshTimer
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return context
}

// Helper to format elapsed time
export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Helper to format duration in minutes to human readable
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}
