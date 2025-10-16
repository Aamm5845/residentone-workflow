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
  showHeader?: boolean // Add option to hide header when embedded
  filterUndecided?: boolean // Add option to filter only undecided items
  roomName?: string
}

export default function FFEPhaseWorkspace({
  roomId,
  roomType,
  orgId,
  projectId,
  onProgressUpdate,
  showHeader = true,
  filterUndecided = false,
  roomName
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
  
  // No instance - show professional empty state
  if (!currentInstance) {
    return (
      <div className="card-elevated-strong">
        <div className="text-center py-16 px-8">
          <div className="max-w-md mx-auto">
            {/* Animated Empty State Icon */}
            <div className="relative mb-6">
              <div className="animate-bounce-in">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              
              {/* Floating elements around the main icon */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                <Plus className="h-4 w-4 text-green-600" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                <Settings className="h-3 w-3 text-amber-600" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Ready to Setup FFE Items
            </h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              This room doesn't have any FFE items yet. Get started by importing a template or adding custom sections through the <span className="font-medium text-blue-600">Settings</span> page.
            </p>
            
            {/* Call-to-action hint */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
                <Import className="h-4 w-4" />
                <span className="font-medium">Pro Tip:</span>
                <span>Import a template to get started quickly</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Get stats for header
  const progress = getOverallProgress()
  const stats = getCompletionStats()
  const allNotes = getAllNotes()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {/* Premium Navigation Header */}
      {showHeader && (
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left Navigation */}
              <div className="flex items-center gap-4">
                <Link 
                  href={`/projects/${projectId}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 transition-all duration-200 font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Project Phases</span>
                </Link>
                
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                
                {/* Premium Breadcrumbs */}
                <nav className="flex items-center gap-1 text-sm">
                  <span className="text-gray-500">FFE Workspace</span>
                  <span className="text-gray-300 mx-2">/</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">
                    {roomName || currentInstance?.room?.name || currentInstance?.room?.type || 'Room'}
                  </span>
                </nav>
              </div>
              
              {/* Right Actions */}
              <div className="flex items-center gap-3">
                <Link href={`/ffe/${roomId}/settings`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-gray-50 border-gray-300 shadow-sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
                
                <button
                  onClick={() => setShowNotesDrawer(!showNotesDrawer)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 shadow-sm ${
                    showNotesDrawer 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-105' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  <StickyNote className="h-4 w-4" />
                  <span>Notes</span>
                  {allNotes.length > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-bounce">
                      {allNotes.length}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Premium Dashboard Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Aligned Header Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-md">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {currentInstance.name}
                </h1>
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-medium">
                    {currentInstance.room.name || currentInstance.room.type}
                  </span>
                  <div className="flex items-center gap-1 text-gray-600">
                    <span className="font-medium text-gray-900">{stats.total}</span>
                    <span>items total</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600 mb-1">{Math.ceil(progress)}%</div>
              <div className="text-sm text-gray-600 font-medium">Complete</div>
            </div>
          </div>
          
          {/* Stats Grid - Similar to FFE Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <Clock className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-slate-900">
                    {stats.undecided || (stats.total - stats.completed)}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Undecided</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-900">
                    {stats.selected + stats.confirmed || 0}
                  </div>
                  <div className="text-sm text-amber-700 font-medium">In Progress</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-900">{stats.completed}</div>
                  <div className="text-sm text-emerald-700 font-medium">Completed</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress Bar - Similar to FFE Settings */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-medium text-gray-900">{Math.ceil(progress)}% Complete</span>
            </div>
            
            <div className="relative">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-700 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {progress > 0 && (
                <div 
                  className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-sm transition-all duration-700 ease-out"
                  style={{ left: `calc(${Math.min(progress, 100)}% - 6px)` }}
                />
              )}
            </div>
            
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex gap-6">
          {/* Main Content Area */}
          <div className="flex-1">
            <FFESectionAccordion
              sections={currentInstance.sections}
              onItemStateChange={handleItemStateChange}
              onItemVisibilityChange={handleItemVisibilityChange}
              filterUndecided={filterUndecided}
            />
          </div>
          
          {/* Notes Sidebar - Only show when notes drawer is open */}
          {showNotesDrawer && (
            <div className="w-80">
              <NotesDrawer 
                notes={allNotes}
                onClose={() => setShowNotesDrawer(false)}
              />
            </div>
          )}
        </div>
        
        {/* Completion Status */}
        {progress === 100 && stats.total > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-800">FFE Phase Complete! 🎉</h3>
                <p className="text-green-700 mt-1">
                  All {stats.total} items have been processed. Ready to move to the next phase.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}