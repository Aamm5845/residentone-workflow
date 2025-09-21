'use client'

import { useState, useCallback, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'

// Types
interface Tag {
  id: string
  name: string
  type: 'MUST_HAVE' | 'OPTIONAL' | 'EXPLORE' | 'CUSTOM'
  color: string
  description?: string
  usageCount?: number
}

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
}

interface Asset {
  id: string
  fileName: string
  originalName: string
  fileType: string
  fileSize: number
  url: string
  thumbnailUrl?: string
  uploadedAt: string
  isPinned: boolean
  tags: Tag[]
  comments: Comment[]
}

interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  mentions: string[]
  author: {
    id: string
    name: string
    email: string
  }
  tags: Tag[]
}

interface DesignSection {
  id: string
  type: string
  title: string
  description?: string
  assets: Asset[]
  comments: Comment[]
  checklistItems: ChecklistItem[]
}

// Fetcher function
const fetcher = (url: string) => 
  fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  })

// Main hook for design workspace data
export function useDesignWorkspace(stageId: string) {
  const { data, error, isLoading, mutate: refreshWorkspace } = useSWR(
    `/api/stages/${stageId}/design-sections`,
    fetcher,
    { 
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true 
    }
  )

  const sections: DesignSection[] = data?.sections || []
  const stageData = data?.stage || null
  const completionStatus = data?.completionStatus || null

  return {
    sections,
    stageData,
    completionStatus,
    isLoading,
    error,
    refreshWorkspace
  }
}

// Hook for file upload functionality
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = useCallback(async (
    files: FileList, 
    sectionId: string,
    options?: { description?: string }
  ) => {
    if (!files.length) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })
      formData.append('sectionId', sectionId)
      if (options?.description) {
        formData.append('description', options.description)
      }

      const response = await fetch('/api/design/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        // Refresh the sections data
        mutate(`/api/stages/${sectionId}/design-sections`)
        toast.success(`${files.length} file(s) uploaded successfully`)
        return result.assets
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      toast.error('Failed to upload files')
      throw error
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [])

  const openFileSelector = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    isUploading,
    uploadProgress,
    fileInputRef,
    uploadFiles,
    openFileSelector
  }
}

// Hook for tag management
export function useTagManagement() {
  const [isLoading, setIsLoading] = useState(false)

  const applyTag = useCallback(async (
    tagId: string, 
    targetType: 'asset' | 'comment', 
    targetId: string
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId,
          targetType,
          targetId,
          action: 'add'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to apply tag')
      }

      toast.success('Tag applied')
      return true
    } catch (error) {
      toast.error('Failed to apply tag')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const removeTag = useCallback(async (
    tagId: string, 
    targetType: 'asset' | 'comment', 
    targetId: string
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId,
          targetType,
          targetId,
          action: 'remove'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to remove tag')
      }

      toast.success('Tag removed')
      return true
    } catch (error) {
      toast.error('Failed to remove tag')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createCustomTag = useCallback(async (
    name: string, 
    color: string, 
    description?: string
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description || `Custom tag: ${name.trim()}`
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Custom tag created')
        // Refresh tags data if it's cached
        mutate('/api/design/tags')
        return result.tag
      } else {
        throw new Error(result.error || 'Failed to create tag')
      }
    } catch (error) {
      toast.error('Failed to create custom tag')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    applyTag,
    removeTag,
    createCustomTag
  }
}

// Hook for pin management
export function usePinManagement() {
  const [isLoading, setIsLoading] = useState(false)

  const togglePin = useCallback(async (
    targetType: 'asset' | 'comment', 
    targetId: string,
    currentPinState: boolean
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          action: currentPinState ? 'unpin' : 'pin'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle pin')
      }

      const action = currentPinState ? 'unpinned' : 'pinned'
      toast.success(`Item ${action}`)
      return !currentPinState
    } catch (error) {
      toast.error('Failed to toggle pin')
      return currentPinState
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    togglePin
  }
}

// Hook for checklist management
export function useChecklistManagement(sectionId: string) {
  const [isLoading, setIsLoading] = useState(false)

  const addItem = useCallback(async (text: string, order?: number) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          text: text.trim(),
          order
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Checklist item added')
        return result.item
      } else {
        throw new Error(result.error || 'Failed to add item')
      }
    } catch (error) {
      toast.error('Failed to add checklist item')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [sectionId])

  const updateItem = useCallback(async (
    itemId: string, 
    updates: Partial<ChecklistItem>
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          ...updates
        })
      })

      const result = await response.json()

      if (result.success) {
        if (updates.text) {
          toast.success('Checklist item updated')
        }
        return result.item
      } else {
        throw new Error(result.error || 'Failed to update item')
      }
    } catch (error) {
      toast.error('Failed to update checklist item')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteItem = useCallback(async (itemId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Checklist item removed')
        return true
      } else {
        throw new Error(result.error || 'Failed to delete item')
      }
    } catch (error) {
      toast.error('Failed to remove checklist item')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const toggleCompletion = useCallback(async (
    itemId: string, 
    currentState: boolean
  ) => {
    const newState = !currentState
    
    try {
      const result = await updateItem(itemId, { completed: newState })
      
      if (result) {
        toast.success(newState ? 'Item completed' : 'Item marked incomplete')
        return newState
      }
      return currentState
    } catch (error) {
      return currentState
    }
  }, [updateItem])

  const reorderItems = useCallback(async (
    itemId: string, 
    newOrder: number
  ) => {
    try {
      const result = await updateItem(itemId, { order: newOrder })
      
      if (result) {
        toast.success('Checklist reordered')
        return true
      }
      return false
    } catch (error) {
      toast.error('Failed to reorder checklist')
      return false
    }
  }, [updateItem])

  return {
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    toggleCompletion,
    reorderItems
  }
}

// Hook for notes/comments management  
export function useNotesManagement(sectionId: string) {
  const [isLoading, setIsLoading] = useState(false)

  const addNote = useCallback(async (
    content: string, 
    mentions?: string[]
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          content: content.trim(),
          mentions
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Note added')
        return result.comment
      } else {
        throw new Error(result.error || 'Failed to add note')
      }
    } catch (error) {
      toast.error('Failed to add note')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [sectionId])

  const updateNote = useCallback(async (
    commentId: string, 
    content: string,
    mentions?: string[]
  ) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          content: content.trim(),
          mentions
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Note updated')
        return result.comment
      } else {
        throw new Error(result.error || 'Failed to update note')
      }
    } catch (error) {
      toast.error('Failed to update note')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteNote = useCallback(async (commentId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Note deleted')
        return true
      } else {
        throw new Error(result.error || 'Failed to delete note')
      }
    } catch (error) {
      toast.error('Failed to delete note')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    addNote,
    updateNote,
    deleteNote
  }
}

// Hook for phase completion
export function usePhaseCompletion() {
  const [isCompleting, setIsCompleting] = useState(false)

  const completePhase = useCallback(async (stageId: string) => {
    setIsCompleting(true)
    try {
      const response = await fetch('/api/design/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Design Concept phase completed successfully!')
        
        // Refresh workspace data
        mutate(`/api/stages/${stageId}/design-sections`)
        
        return result
      } else {
        throw new Error(result.error || 'Failed to complete phase')
      }
    } catch (error) {
      toast.error('Failed to complete phase')
      return null
    } finally {
      setIsCompleting(false)
    }
  }, [])

  return {
    isCompleting,
    completePhase
  }
}

// Hook for optimistic UI updates
export function useOptimisticUpdates() {
  const updateOptimistically = useCallback((
    key: string,
    updateFn: (data: any) => any
  ) => {
    mutate(key, updateFn, false)
  }, [])

  const revalidate = useCallback((key: string) => {
    mutate(key)
  }, [])

  return {
    updateOptimistically,
    revalidate
  }
}