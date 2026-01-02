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
  Briefcase,
  Image as ImageIcon,
  LinkIcon,
  ExternalLink,
  X
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
  const { createRoomInstance } = useRoomFFEMutations()
  const [templates] = useState([])
  
  // Local state
  const [isCreatingInstance, setIsCreatingInstance] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'undecided' | 'completed'>('all')
  
  // Rendering images and Programa link (from FFE settings)
  const [renderingImages, setRenderingImages] = useState<Array<{id: string, url: string, filename: string}>>([])
  const [programaLink, setProgramaLink] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
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
        // Load Programa link from instance data
        if (result.data.programaLink) {
          setProgramaLink(result.data.programaLink)
        }
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
  
  // Load rendering images
  const loadRenderingImages = async () => {
    try {
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.renderings && result.renderings.length > 0) {
          setRenderingImages(result.renderings.map((r: any) => ({
            id: r.id,
            url: r.url,
            filename: r.filename || 'Rendering'
          })))
        }
      }
    } catch (error) {
      console.error('Error loading rendering images:', error)
    }
  }
  
  // Load data on mount
  useEffect(() => {
    revalidate()
    loadRenderingImages()
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
    
    // Optimistic update - update local state immediately without showing loading screen
    const updatedInstance = {
      ...currentInstance,
      sections: currentInstance.sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.id === itemId ? { ...item, state: newState, notes: notes || item.notes } : item
        )
      }))
    }
    
    setCurrentInstance(updatedInstance)
    setInstance(updatedInstance)
    
    try {
      await updateItemState(currentInstance.roomId, itemId, newState, notes)
      // Don't call revalidate() - we've already updated the UI optimistically
    } catch (error) {
      console.error('Failed to update item state:', error)
      toast.error('Failed to update item state')
      // Revert optimistic update on error by revalidating
      await revalidate()
    }
  }

  // Handle enhanced item state changes (with enhanced states)
  const handleEnhancedItemStateChange = async (itemId: string, newState: string, notes?: string) => {
    if (!currentInstance) return
    
    // Optimistic update - update local state immediately without showing loading screen
    const updatedInstance = {
      ...currentInstance,
      sections: currentInstance.sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.id === itemId ? { ...item, state: newState as FFEItemState, notes: notes || item.notes } : item
        )
      }))
    }
    
    setCurrentInstance(updatedInstance)
    setInstance(updatedInstance)
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, state: newState, notes })
      })

      if (response.ok) {
        toast.success('Item updated successfully')
        // Don't call revalidate() - we've already updated the UI optimistically
      } else {
        throw new Error('Failed to update item')
      }
    } catch (error) {
      console.error('Failed to update item state:', error)
      toast.error('Failed to update item state')
      // Revert optimistic update on error by revalidating
      await revalidate()
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
    <div className="bg-slate-50/50 -mx-6 -my-6 min-h-screen">
      {/* Clean Stats Header */}
      <div className="bg-white border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-5">
          {/* Mode Toggle - Large, prominent */}
          <div className="flex items-center justify-between mb-5">
            <div className="inline-flex rounded-full bg-slate-100/80 p-1.5 shadow-inner">
              <button
                onClick={() => router.push(`/ffe/${roomId}/settings`)}
                className="px-6 py-2.5 text-sm font-semibold rounded-full text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-all flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Workspace
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#e94d97]/10 text-[#e94d97] font-bold">{stats.total}</span>
              </button>
            </div>
          </div>

          {/* Stats Grid - Clean, aligned cards */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {/* Pending */}
            <div className="bg-gradient-to-br from-[#f6762e]/5 to-[#f6762e]/15 rounded-xl p-4 border border-[#f6762e]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#f6762e] flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.pending || 0}</div>
                  <div className="text-xs font-medium text-[#f6762e] uppercase tracking-wide">Pending</div>
                </div>
              </div>
            </div>
            
            {/* Undecided */}
            <div className="bg-gradient-to-br from-[#a657f0]/5 to-[#a657f0]/15 rounded-xl p-4 border border-[#a657f0]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#a657f0] flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.undecided || 0}</div>
                  <div className="text-xs font-medium text-[#a657f0] uppercase tracking-wide">Undecided</div>
                </div>
              </div>
            </div>
            
            {/* Completed */}
            <div className="bg-gradient-to-br from-[#14b8a6]/5 to-[#14b8a6]/15 rounded-xl p-4 border border-[#14b8a6]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#14b8a6] flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
                  <div className="text-xs font-medium text-[#14b8a6] uppercase tracking-wide">Completed</div>
                </div>
              </div>
            </div>
            
            {/* Total Progress Card */}
            <div className="bg-gradient-to-br from-[#e94d97]/5 to-[#e94d97]/15 rounded-xl p-4 border border-[#e94d97]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#e94d97] flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                    <span className="text-xs font-medium text-gray-500">items</span>
                  </div>
                  <div className="text-xs font-medium text-[#e94d97] uppercase tracking-wide">Total</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Reference Section - Renderings & Programa Link */}
          {(renderingImages.length > 0 || programaLink) && (
            <div className="flex flex-wrap items-center gap-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
              {/* Rendering Gallery */}
              {renderingImages.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {renderingImages.slice(0, 4).map((img, idx) => (
                      <button 
                        key={img.id}
                        className="w-20 h-20 rounded-lg border-2 border-[#f6762e]/30 overflow-hidden hover:border-[#f6762e] hover:scale-105 transition-all shadow-sm"
                        onClick={() => { setSelectedImageIndex(idx); setShowImageModal(true) }}
                        title={`Click to view ${img.filename}`}
                      >
                        <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {renderingImages.length > 4 && (
                      <button 
                        className="w-20 h-20 rounded-lg border-2 border-[#f6762e]/30 bg-[#f6762e]/10 flex items-center justify-center hover:border-[#f6762e] transition-all"
                        onClick={() => { setSelectedImageIndex(0); setShowImageModal(true) }}
                      >
                        <span className="text-sm font-bold text-[#f6762e]">+{renderingImages.length - 4}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Programa Link */}
              {programaLink && (
                <a 
                  href={programaLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                >
                  <LinkIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Programa Specs</span>
                  <ExternalLink className="w-3 h-3 text-purple-400" />
                </a>
              )}
            </div>
          )}

          {/* Progress Bar - More prominent with FFE pink */}
          <div className="bg-slate-100/80 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Overall Progress</span>
              <span className="text-lg font-bold text-slate-900">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#e94d97] via-[#6366ea] to-[#14b8a6] rounded-full transition-all duration-700 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Filter Bar - Modern Tab Design */}
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full bg-slate-100/80 p-1.5 shadow-inner">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                  statusFilter === 'all' 
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2 ${
                  statusFilter === 'pending' 
                    ? 'bg-white text-[#f6762e] shadow-md ring-1 ring-[#f6762e]/30' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full bg-[#f6762e]`}></span>
                Pending
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'pending' ? 'bg-[#f6762e]/10 text-[#f6762e]' : 'bg-slate-200 text-slate-600'}`}>{stats.pending || 0}</span>
              </button>
              <button
                onClick={() => setStatusFilter('undecided')}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2 ${
                  statusFilter === 'undecided' 
                    ? 'bg-white text-[#a657f0] shadow-md ring-1 ring-[#a657f0]/30' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full bg-[#a657f0]`}></span>
                Undecided
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'undecided' ? 'bg-[#a657f0]/10 text-[#a657f0]' : 'bg-slate-200 text-slate-600'}`}>{stats.undecided || 0}</span>
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2 ${
                  statusFilter === 'completed' 
                    ? 'bg-white text-[#14b8a6] shadow-md ring-1 ring-[#14b8a6]/30' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full bg-[#14b8a6]`}></span>
                Done
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'completed' ? 'bg-[#14b8a6]/10 text-[#14b8a6]' : 'bg-slate-200 text-slate-600'}`}>{stats.completed}</span>
              </button>
            </div>
            
            {/* Notes Button */}
            <button
              onClick={() => setShowNotesDrawer(!showNotesDrawer)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                showNotesDrawer 
                  ? 'bg-[#6366ea] text-white shadow-lg shadow-[#6366ea]/30' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 shadow-sm'
              }`}
            >
              <StickyNote className="h-4 w-4" />
              <span>Notes</span>
              {allNotes.length > 0 && (
                <span className={`text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center font-bold ${
                  showNotesDrawer ? 'bg-white/25 text-white' : 'bg-[#6366ea]/10 text-[#6366ea]'
                }`}>
                  {allNotes.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex gap-6 px-6 py-6">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
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
            <div className="sticky top-6">
              <NotesDrawer 
                notes={allNotes}
                onClose={() => setShowNotesDrawer(false)}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Completion Status - Celebration Banner */}
      {progress === 100 && stats.total > 0 && (
        <div className="mx-6 mb-6">
          <div className="bg-gradient-to-r from-[#14b8a6] to-[#6366ea] rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  FFE Phase Complete!
                </p>
                <p className="text-white/80 text-sm">
                  All {stats.total} items have been processed successfully
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {showImageModal && renderingImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Main image area */}
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Previous button */}
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === 0 ? renderingImages.length - 1 : prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            )}
            
            {/* Current image */}
            <img 
              src={renderingImages[selectedImageIndex]?.url} 
              alt={renderingImages[selectedImageIndex]?.filename || '3D Rendering'} 
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* Next button */}
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === renderingImages.length - 1 ? 0 : prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          
          {/* Image info */}
          <div className="text-center text-white mt-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-medium">{renderingImages[selectedImageIndex]?.filename || '3D Rendering'}</p>
            <p className="text-white/60 text-sm">{roomName || 'Room'} • {selectedImageIndex + 1} of {renderingImages.length}</p>
          </div>
          
          {/* Thumbnail strip */}
          {renderingImages.length > 1 && (
            <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full px-4 pb-2" onClick={(e) => e.stopPropagation()}>
              {renderingImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={cn(
                    "w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all",
                    idx === selectedImageIndex 
                      ? "ring-2 ring-[#f6762e] ring-offset-2 ring-offset-black scale-105" 
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
