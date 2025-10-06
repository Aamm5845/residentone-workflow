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
  EyeOff
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

interface FFEPhaseWorkspaceProps {
  roomId: string
  roomType: string
  orgId: string
  projectId: string
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
  showHeader?: boolean // Add option to hide header when embedded
  filterUndecided?: boolean // Add option to filter only undecided items
}

export default function FFEPhaseWorkspace({
  roomId,
  roomType,
  orgId,
  projectId,
  onProgressUpdate,
  showHeader = true,
  filterUndecided = false
}: FFEPhaseWorkspaceProps) {
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
  
  const { instance, isLoading: isLoadingInstance, error: instanceError, revalidate } = useRoomFFEInstance(roomId)
  const { createRoomInstance } = useRoomFFEMutations()
  const { updateItemState } = useFFEItemMutations()
  const { templates } = useFFETemplates(orgId)
  
  // Local state
  const [isCreatingInstance, setIsCreatingInstance] = useState(false)
  
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
  
  // No instance - show simple empty state
  if (!currentInstance) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            FFE Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No FFE Items Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Use the <strong>Settings</strong> button above to import templates or add items to this room.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Get stats for header
  const progress = getOverallProgress()
  const stats = getCompletionStats()
  const allNotes = getAllNotes()
  
  return (
    <div className="space-y-6">
      {/* Header with Progress - only show when not embedded */}
      {showHeader && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {currentInstance.name}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {currentInstance.room.name || currentInstance.room.type} • {stats.total} items
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Notes toggle */}
                <Button
                  variant={showNotesDrawer ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowNotesDrawer(!showNotesDrawer)}
                  className="relative"
                >
                  <StickyNote className="h-4 w-4 mr-2" />
                  Notes
                  {allNotes.length > 0 && (
                    <Badge className="ml-2 h-5 w-5 p-0 text-xs">
                      {allNotes.length}
                    </Badge>
                  )}
                </Button>
                
                {/* Settings is now handled by standalone page */}
                
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-gray-600">{Math.ceil(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            {/* Simplified Stats */}
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>{stats.undecided || (stats.total - stats.completed)} Undecided</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>{stats.completed} Completed</span>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
      
      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Sections List */}
        <div className="flex-1">
          <FFESectionAccordion
            sections={currentInstance.sections}
            onItemStateChange={handleItemStateChange}
            filterUndecided={filterUndecided}
          />
        </div>
        
        {/* Notes Drawer */}
        {showNotesDrawer && (
          <div className="w-96">
            <NotesDrawer 
              notes={allNotes}
              onClose={() => setShowNotesDrawer(false)}
            />
          </div>
        )}
      </div>
      
      {/* Completion Status */}
      {progress === 100 && stats.total > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">FFE Phase Complete!</h3>
                <p className="text-sm text-green-700">
                  All {stats.total} items have been processed. Ready to move to the next phase.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}