'use client'

import useSWR, { mutate } from 'swr'
import { useState } from 'react'

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Hook for managing stage actions with optimistic updates
export function useStageActions() {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const startStage = async (stageId: string) => {
    console.log('🚀 Starting stage:', stageId)
    setIsLoading(stageId)
    try {
      const requestBody = { action: 'start' }
      console.log('📤 Request body:', requestBody)
      
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log('📥 Response status:', response.status)
      
      if (response.ok) {
        const updatedStage = await response.json()
        console.log('✅ Stage started successfully:', updatedStage.id, updatedStage.status)
        
        // Mutate all related SWR caches
        mutate((key) => typeof key === 'string' && key.includes('/api/'), undefined, { revalidate: true })
        
        return updatedStage
      } else {
        const errorText = await response.text()
        console.error('❌ API Error:', response.status, errorText)
        throw new Error(`Failed to start stage: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('💥 Error starting stage:', error)
      throw error
    } finally {
      setIsLoading(null)
    }
  }

  const completeStage = async (stageId: string) => {
    setIsLoading(stageId)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        
        // Mutate all related SWR caches
        mutate((key) => typeof key === 'string' && key.includes('/api/'), undefined, { revalidate: true })
        
        return updatedStage
      } else {
        throw new Error('Failed to complete stage')
      }
    } catch (error) {
      console.error('Error completing stage:', error)
      throw error
    } finally {
      setIsLoading(null)
    }
  }

  const reopenStage = async (stageId: string) => {
    setIsLoading(stageId)
    try {
      const response = await fetch(`/api/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        
        // Mutate all related SWR caches
        mutate((key) => typeof key === 'string' && key.includes('/api/'), undefined, { revalidate: true })
        
        return updatedStage
      } else {
        throw new Error('Failed to reopen stage')
      }
    } catch (error) {
      console.error('Error reopening stage:', error)
      throw error
    } finally {
      setIsLoading(null)
    }
  }

  return {
    startStage,
    completeStage,
    reopenStage,
    isLoading
  }
}

// Hook for fetching room data with SWR
export function useRoom(projectId: string, roomId: string) {
  const { data, error, isLoading, mutate: mutateRoom } = useSWR(
    projectId && roomId ? `/api/projects/${projectId}/rooms/${roomId}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Auto refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )

  return {
    room: data,
    isLoading,
    isError: error,
    mutate: mutateRoom
  }
}

// Hook for fetching stage data with SWR
export function useStage(stageId: string) {
  const { data, error, isLoading, mutate: mutateStage } = useSWR(
    stageId ? `/api/stages/${stageId}` : null,
    fetcher,
    {
      refreshInterval: 15000, // Auto refresh every 15 seconds for active stages
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )

  return {
    stage: data,
    isLoading,
    isError: error,
    mutate: mutateStage
  }
}

// Hook for real-time notifications (can be extended with WebSockets)
// Note: This is deprecated in favor of the more comprehensive useNotifications hook
export function useSimpleNotifications(userId: string) {
  const { data, error, isLoading } = useSWR(
    userId ? `/api/notifications?userId=${userId}` : null,
    fetcher,
    {
      refreshInterval: 10000, // Check for notifications every 10 seconds
      revalidateOnFocus: true
    }
  )

  return {
    notifications: data || [],
    isLoading,
    isError: error
  }
}
