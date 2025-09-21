import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'react-hot-toast'
import { 
  DrawingWorkspaceState, 
  DrawingUploadResponse, 
  DrawingChecklistUpdateResponse,
  DrawingCompletionResponse,
  UseDrawingsWorkspaceResult 
} from '@/types/drawings'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

/**
 * Custom hook for managing drawings workspace functionality
 * @param stageId - The ID of the drawings stage
 * @returns Hook result with data, loading states, and action methods
 */
export function useDrawingsWorkspace(stageId: string): UseDrawingsWorkspaceResult {
  const [uploading, setUploading] = useState(false)
  const [completing, setCompleting] = useState(false)
  
  // Fetch workspace data with SWR
  const { 
    data, 
    error, 
    isLoading, 
    mutate 
  } = useSWR<DrawingWorkspaceState>(
    stageId ? `/api/drawings?stageId=${stageId}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000
    }
  )

  /**
   * Upload files to a specific checklist item
   */
  const uploadFiles = async (checklistItemId: string, files: FileList) => {
    if (!files.length) return

    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append('files', file)
      })
      formData.append('checklistItemId', checklistItemId)

      const response = await fetch(`/api/drawings/${stageId}/upload`, {
        method: 'POST',
        body: formData
      })

      const result: DrawingUploadResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed')
      }

      // Show success toast
      toast.success(result.message || 'Files uploaded successfully')

      // Optimistically update the cache
      await mutate()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      toast.error(errorMessage)
      console.error('Upload error:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  /**
   * Toggle checklist item completion status
   */
  const toggleChecklistItem = async (checklistItemId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/drawings/${stageId}/checklist`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checklistItemId,
          completed
        })
      })

      const result: DrawingChecklistUpdateResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update checklist item')
      }

      // Show success toast
      const action = completed ? 'completed' : 'reopened'
      toast.success(`Checklist item ${action}`)

      // Optimistically update the cache
      if (data) {
        const updatedData = {
          ...data,
          checklistItems: data.checklistItems.map(item =>
            item.id === checklistItemId
              ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null }
              : item
          )
        }
        mutate(updatedData, false)
      }

      // Revalidate from server
      await mutate()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed'
      toast.error(errorMessage)
      console.error('Checklist toggle error:', error)
      throw error
    }
  }

  /**
   * Update asset description
   */
  const updateAssetDescription = async (assetId: string, description: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}/description`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      })

      if (!response.ok) {
        throw new Error('Failed to update description')
      }

      toast.success('Description updated')
      await mutate()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed'
      toast.error(errorMessage)
      console.error('Description update error:', error)
      throw error
    }
  }

  /**
   * Delete an asset
   */
  const deleteAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      toast.success('File deleted')
      await mutate()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed'
      toast.error(errorMessage)
      console.error('Delete error:', error)
      throw error
    }
  }

  /**
   * Complete the drawings stage
   */
  const completeStage = async () => {
    if (!canComplete()) {
      toast.error('Cannot complete stage: Some checklist items are not finished')
      return
    }

    setCompleting(true)
    try {
      const response = await fetch(`/api/drawings/${stageId}/complete`, {
        method: 'POST'
      })

      const result: DrawingCompletionResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to complete stage')
      }

      toast.success(result.message || 'Stage completed successfully')
      
      // Update the cache with completed stage
      if (data) {
        const updatedData = {
          ...data,
          stage: {
            ...data.stage,
            status: 'COMPLETED' as const,
            completedAt: new Date().toISOString()
          }
        }
        mutate(updatedData, false)
      }

      // Revalidate from server
      await mutate()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Completion failed'
      toast.error(errorMessage)
      console.error('Stage completion error:', error)
      throw error
    } finally {
      setCompleting(false)
    }
  }

  /**
   * Calculate completion percentage
   */
  const getProgressPercentage = (): number => {
    if (!data?.checklistItems?.length) return 0
    
    const completedItems = data.checklistItems.filter(item => item.completed)
    return Math.round((completedItems.length / data.checklistItems.length) * 100)
  }

  /**
   * Check if stage can be completed
   */
  const canComplete = (): boolean => {
    if (!data?.checklistItems?.length) return false
    
    // All items must be completed
    const allCompleted = data.checklistItems.every(item => item.completed)
    
    // Each item must have at least one file
    const allHaveFiles = data.checklistItems.every(item => item.assets && item.assets.length > 0)
    
    return allCompleted && allHaveFiles && data.stage.status !== 'COMPLETED'
  }

  return {
    // Data
    data,
    isLoading,
    error,
    
    // Actions
    uploadFiles,
    toggleChecklistItem,
    updateAssetDescription,
    deleteAsset,
    completeStage,
    
    // State
    uploading,
    completing,
    
    // Utils
    getProgressPercentage,
    canComplete,
    mutate
  }
}
