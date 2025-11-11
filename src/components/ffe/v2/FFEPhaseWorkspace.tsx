'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ChevronDown, 
  ChevronRight, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus,
  Settings,
  StickyNote,
  Import,
  Eye,
  EyeOff,
  ArrowLeft,
  Home,
  Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFFERoomStore } from '@/stores/ffe-room-store'
import { useRoomFFEInstance, useRoomFFEMutations, useFFEItemMutations, useFFETemplates } from '@/hooks/ffe/useFFEApi'
import { FFEItemState } from '@prisma/client'
import TemplateSelector from './TemplateSelector'
import NotesDrawer from './NotesDrawer'
import FFESectionAccordion from './FFESectionAccordion'
import FFEItemCard from './FFEItemCard'
import { LoadingState } from './LoadingState'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FFEPhaseWorkspaceProps {
  roomId: string
  roomType: string
  orgId: string
  projectId: string
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
  roomName?: string
  projectName?: string
}

export default function FFEPhaseWorkspace({
  roomId,
  roomType,
  orgId,
  projectId,
  onProgressUpdate,
  roomName,
  projectName
}: FFEPhaseWorkspaceProps) {
  const router = useRouter()
  
  // Stores and API hooks
  const {
    currentInstance,
    isLoading,
    error,
    showNotesDrawer,
    showTemplateSelector,
    currentPhase,
    setCurrentInstance,
    setShowNotesDrawer,
    setShowTemplateSelector,
    setCurrentPhase,
    getOverallProgress,
    getCompletionStats,
    getAllNotes
  } = useFFERoomStore()
  
  // Use manual data fetching instead of hooks to avoid session dependency
  const [instance, setInstance] = useState(null)
  const [isLoadingInstance, setIsLoadingInstance] = useState(true)
  const [instanceError, setInstanceError] = useState(null)
  const { updateItemState } = useFFEItemMutations()
  const [templates] = useState([])
  
  // Local state
  const [isCreatingInstance, setIsCreatingInstance] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'undecided' | 'completed'>('all')
  
  // Manual data loading to avoid session dependency
  const revalidate = async () => {
    try {
      setIsLoadingInstance(true)
      setInstanceError(null)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}?onlyVisible=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch FFE data')
      }
      
      const result = await response.json()
      if (result.success && result.data) {
        setInstance(result.data)
      } else {
        setInstance(null)
      }
    } catch (error) {
      console.error('Error loading FFE data:', error)
      setInstanceError(error)
      setInstance(null)
    } finally {
      setIsLoadingInstance(false)
    }
  }
  
  // Load data on mount
  useEffect(() => {
    revalidate()
  }, [roomId])
  
  // Sync API data with store
  useEffect(() => {
    if (instance) {
      setCurrentInstance(instance)
      // Determine phase based on instance state
      if (instance.sections.length === 0 || instance.sections.every(s => s.items.length === 0)) {
        setCurrentPhase('setup')
      } else {
        setCurrentPhase('execution')
      }
    } else {
      setCurrentInstance(null)
      setCurrentPhase('setup')
    }
  }, [instance, setCurrentInstance, setCurrentPhase])
  
  // Update progress callback
  useEffect(() => {
    if (currentInstance && onProgressUpdate) {
      const progress = getOverallProgress()
      const stats = getCompletionStats()
      const isComplete = progress === 100 && stats.total > 0
      onProgressUpdate(progress, isComplete)
    }
  }, [currentInstance, getOverallProgress, getCompletionStats, onProgressUpdate])
  
  // Handle template selection
  const handleTemplateSelected = async (templateId?: string, templateName?: string) => {
    if (!templateName) return
    
    setIsCreatingInstance(true)
    try {
      await createRoomInstance(roomId, {
        templateId,
        name: templateName,
        estimatedBudget: 0,
        notes: `Created from ${templateId ? 'template' : 'blank template'}`
      })
      
      await revalidate()
      setShowTemplateSelector(false)
      setCurrentPhase('execution')
    } catch (error) {
      console.error('Failed to create room instance:', error)
    } finally {
      setIsCreatingInstance(false)
    }
  }
  
  // Handle item state changes
  const handleItemStateChange = async (itemId: string, newState: FFEItemState, notes?: string) => {
    if (!currentInstance) return
    
    try {
      await updateItemState(currentInstance.roomId, itemId, newState, notes)
      await revalidate() // Refresh data
    } catch (error) {
      console.error('Failed to update item state:', error)
      toast.error('Failed to update item state')
    }
  }

  // Handle enhanced item state changes (with enhanced states)
  const handleEnhancedItemStateChange = async (itemId: string, newState: string, notes?: string) => {
    if (!currentInstance) return
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, state: newState, notes })
      })

      if (response.ok) {
        await revalidate()
        toast.success('Item updated successfully')
      } else {
        throw new Error('Failed to update item')
      }
    } catch (error) {
      console.error('Failed to update item state:', error)
      toast.error('Failed to update item state')
    }
  }

  // Handle item visibility changes (optimistic updates)
  const handleItemVisibilityChange = async (itemId: string, newVisibility: 'VISIBLE' | 'HIDDEN') => {
    if (!currentInstance) return
    
    // Optimistic update - update local state immediately
    const updatedInstance = {
      ...currentInstance,
      sections: currentInstance.sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.id === itemId ? { ...item, visibility: newVisibility } : item
        )
      }))
    }
    
    setCurrentInstance(updatedInstance)
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      })

      if (response.ok) {
        toast.success(
          newVisibility === 'VISIBLE' 
            ? 'Item included in workspace' 
            : 'Item removed from workspace'
        )
      } else {
        throw new Error('Failed to update item visibility')
      }
    } catch (error) {
      console.error('Failed to update item visibility:', error)
      toast.error('Failed to update item visibility')
      // Revert optimistic update on error
      await revalidate()
    }
  }

  // Template/section/item management is now handled by standalone settings page
  
  // Loading state
  if (isLoadingInstance || isLoading) {
    return <LoadingState message="Loading FFE workspace..." />
  }
  
  // Error state
  if (instanceError || error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading FFE Data</h3>
          <p className="text-gray-600 mb-4">
            {instanceError?.message || error || 'Something went wrong loading the FFE workspace.'}
          </p>
          <Button onClick={() => revalidate()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  // No instance - show empty state
  if (!currentInstance) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No FFE Items Yet
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Get started by adding sections and items through the Settings page.
          </p>
        </div>
      </div>
    )
  }
  
  // Get stats for header
  const progress = getOverallProgress()
  const stats = getCompletionStats()
  const allNotes = getAllNotes()
  
  return (
    <div className="bg-gray-50 -mx-6 -my-6">
      {/* Stats and Filters Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 space-y-4">
          {/* Stats Cards Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <Clock className="h-4 w-4 text-blue-600" />
                <div className="text-left">
                  <div className="text-lg font-bold text-blue-900">{stats.pending || 0}</div>
                  <div className="text-xs text-blue-600">Pending</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <div className="text-left">
                  <div className="text-lg font-bold text-amber-900">{stats.undecided || 0}</div>
                  <div className="text-xs text-amber-600">Undecided</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div className="text-left">
                  <div className="text-lg font-bold text-green-900">{stats.completed}</div>
                  <div className="text-xs text-green-600">Completed</div>
                </div>
              </div>
            </div>
            
            {/* Notes Button */}
            <button
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showNotesDrawer 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <StickyNote className="h-4 w-4" />
              <span>Notes</span>
              {allNotes.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {allNotes.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Progress Bar Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-400" />
              <div className="text-sm text-gray-600 whitespace-nowrap">{stats.total} Total Items</div>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                <div 
                  className="h-2.5 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-900 whitespace-nowrap min-w-[3rem] text-right">{Math.ceil(progress)}%</span>
            </div>
          </div>
          
          {/* Filter Buttons Row */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 mr-1">Filter:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'all' 
                  ? 'bg-gray-900 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'pending' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('undecided')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'undecided' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-amber-300'
              }`}
            >
              Undecided
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === 'completed' 
                  ? 'bg-green-600 text-white shadow-sm' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-green-300'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex gap-4 px-6 py-6">
        {/* Main Content Area */}
        <div className="flex-1">
          <FFESectionAccordion
            sections={currentInstance.sections}
            onItemStateChange={handleItemStateChange}
            onItemVisibilityChange={handleItemVisibilityChange}
            statusFilter={statusFilter}
          />
        </div>
        
        {/* Notes Sidebar - Only show when notes drawer is open */}
        {showNotesDrawer && (
          <div className="w-80 flex-shrink-0">
            <NotesDrawer 
              notes={allNotes}
              onClose={() => setShowNotesDrawer(false)}
            />
          </div>
        )}
      </div>
      
      {/* Completion Status */}
      {progress === 100 && stats.total > 0 && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                FFE Phase Complete - All {stats.total} items processed
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
