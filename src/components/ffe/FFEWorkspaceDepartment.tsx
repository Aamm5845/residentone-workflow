'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Briefcase, 
  RefreshCw, 
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  LinkIcon,
  ExternalLink,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import FFEItemCard, { FFEItemState, FFEItemVisibility } from './common/FFEItemCard'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: FFEItemState
  visibility: FFEItemVisibility
  notes?: string
  isRequired: boolean
  isCustom: boolean
  quantity: number
  order: number
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  items: FFEItem[]
}

interface FFEWorkspaceDepartmentProps {
  roomId: string
  roomName: string
  orgId?: string
  projectId?: string
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
  disabled?: boolean
}

export default function FFEWorkspaceDepartment({
  roomId,
  roomName,
  orgId,
  projectId,
  onProgressUpdate,
  disabled = false
}: FFEWorkspaceDepartmentProps) {
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Rendering images and Programa link (from FFE settings)
  const [renderingImages, setRenderingImages] = useState<Array<{id: string, url: string, filename: string}>>([])
  const [programaLink, setProgramaLink] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    pendingItems: 0,
    undecidedItems: 0,
    completedItems: 0
  })

  // Load FFE data
  useEffect(() => {
    loadFFEData()
    loadRenderingImages()
  }, [roomId])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      
      // Load room FFE instance with only visible items
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}?onlyVisible=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch FFE data')
      }

      const result = await response.json()
      if (result.success && result.data) {
        const ffeData = result.data
        // Ensure sections are expanded by default in workspace mode
        const sectionsWithExpansion = (ffeData.sections || []).map((section: any) => ({
          ...section,
          isExpanded: true // Always expanded in workspace mode
        }))
        setSections(sectionsWithExpansion)
        calculateStats(sectionsWithExpansion)
        
        // Load Programa link from instance data
        if (ffeData.programaLink) {
          setProgramaLink(ffeData.programaLink)
        }
      } else {
        // No visible items
        setSections([])
        setStats({
          totalItems: 0,
          pendingItems: 0,
          undecidedItems: 0,
          completedItems: 0
        })
      }

    } catch (error) {
      console.error('Error loading FFE workspace data:', error)
      toast.error('Failed to load FFE workspace data')
    } finally {
      setLoading(false)
    }
  }

  const loadRenderingImages = async () => {
    try {
      // Fetch all 3D renderings for this room
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.renderings && result.renderings.length > 0) {
          // Get all rendering images
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

  const calculateStats = (sectionsData: FFESection[]) => {
    const visibleItems = sectionsData.flatMap(section => 
      section.items.filter(item => item.visibility === 'VISIBLE')
    )
    
    const stats = {
      totalItems: visibleItems.length,
      pendingItems: visibleItems.filter(item => item.state === 'PENDING').length,
      undecidedItems: visibleItems.filter(item => item.state === 'UNDECIDED').length,
      completedItems: visibleItems.filter(item => item.state === 'COMPLETED').length
    }
    setStats(stats)
    
    // Update progress for parent component
    if (onProgressUpdate && stats.totalItems > 0) {
      const progress = (stats.completedItems / stats.totalItems) * 100
      const isComplete = progress === 100
      onProgressUpdate(progress, isComplete)
    }
  }

  const handleStateChange = async (itemId: string, newState: FFEItemState) => {
    try {
      // Store scroll position before update
      const scrollPosition = window.scrollY
      
      setSaving(true)

      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId,
          state: newState
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update item state')
      }

      // Update local state and recalculate stats
      setSections(prevSections => {
        const updatedSections = prevSections.map(section => ({
          ...section,
          items: section.items.map(item => 
            item.id === itemId 
              ? { ...item, state: newState }
              : item
          )
        }))
        calculateStats(updatedSections)
        return updatedSections
      })
      
      // Restore scroll position after state update
      // Use double requestAnimationFrame to ensure all DOM updates and layout calculations are complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition)
        })
      })

    } catch (error) {
      console.error('Error updating item state:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleNotesChange = async (itemId: string, notes: string) => {
    try {
      // Store scroll position before update
      const scrollPosition = window.scrollY
      
      setSaving(true)

      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId,
          notes: notes
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update item notes')
      }

      // Update local state
      setSections(prevSections => 
        prevSections.map(section => ({
          ...section,
          items: section.items.map(item => 
            item.id === itemId 
              ? { ...item, notes: notes }
              : item
          )
        }))
      )
      
      // Restore scroll position after state update
      // Use double requestAnimationFrame to ensure all DOM updates and layout calculations are complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition)
        })
      })

    } catch (error) {
      console.error('Error updating item notes:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    )
  }

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-600'
    if (percentage >= 75) return 'text-blue-600'
    if (percentage >= 50) return 'text-yellow-600'
    if (percentage >= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  const getProgressBgColor = (percentage: number) => {
    if (percentage === 100) return 'bg-green-600'
    if (percentage >= 75) return 'bg-blue-600'
    if (percentage >= 50) return 'bg-yellow-600'
    if (percentage >= 25) return 'bg-orange-600'
    return 'bg-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const progressPercentage = stats.totalItems > 0 
    ? Math.round((stats.completedItems / stats.totalItems) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center">
            <Briefcase className="w-5 h-5 mr-2" />
            FFE Workspace - {roomName}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track progress on visible FFE items for this room
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {saving && (
            <div className="flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
          
          <div className="text-right">
            <div className={cn("text-2xl font-bold", getProgressColor(progressPercentage))}>
              {progressPercentage}%
            </div>
            <div className="text-xs text-gray-600">Complete</div>
          </div>
        </div>
      </div>

      {/* Reference Section - Renderings & Programa Link */}
      {(renderingImages.length > 0 || programaLink) && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* 3D Rendering Gallery */}
          {renderingImages.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#f6762e]/10 px-2 py-1 rounded-lg">
                <ImageIcon className="w-4 h-4 text-[#f6762e]" />
                <span className="text-xs font-medium text-[#f6762e]">3D Renderings</span>
              </div>
              <div className="flex items-center gap-1.5">
                {renderingImages.slice(0, 4).map((img, idx) => (
                  <button 
                    key={img.id}
                    className="w-10 h-10 rounded-lg border-2 border-[#f6762e]/30 overflow-hidden hover:border-[#f6762e] hover:scale-105 transition-all shadow-sm"
                    onClick={() => { setSelectedImageIndex(idx); setShowImageModal(true) }}
                    title={`Click to view ${img.filename}`}
                  >
                    <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                  </button>
                ))}
                {renderingImages.length > 4 && (
                  <button 
                    className="w-10 h-10 rounded-lg border-2 border-[#f6762e]/30 bg-[#f6762e]/10 flex items-center justify-center hover:border-[#f6762e] transition-all"
                    onClick={() => { setSelectedImageIndex(0); setShowImageModal(true) }}
                  >
                    <span className="text-xs font-bold text-[#f6762e]">+{renderingImages.length - 4}</span>
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

      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingItems}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.undecidedItems}</div>
              <div className="text-sm text-gray-600">Undecided</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedItems}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={cn("h-3 rounded-full transition-all duration-300", getProgressBgColor(progressPercentage))}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections and Items */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <AlertCircle className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Items in Workspace</h3>
              <p className="text-gray-600 mb-4">
                No FFE items are currently set to be visible in the workspace. 
                Visit the FFE Settings to add items and sections.
              </p>
              <div className="text-sm text-blue-600">
                💡 Tip: Use the Settings department to import templates or manually add items to this workspace.
              </div>
            </CardContent>
          </Card>
        ) : (
          sections.map(section => {
            const visibleItems = section.items.filter(item => item.visibility === 'VISIBLE')
            if (visibleItems.length === 0) return null

            const sectionCompleted = visibleItems.filter(item => item.state === 'COMPLETED').length
            const sectionProgress = visibleItems.length > 0 
              ? Math.round((sectionCompleted / visibleItems.length) * 100) 
              : 0

            return (
              <Card key={section.id}>
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSectionExpanded(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {section.isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                      <div>
                        <CardTitle className="text-base flex items-center">
                          {section.name}
                          {sectionProgress === 100 && (
                            <CheckCircle className="w-4 h-4 ml-2 text-green-600" />
                          )}
                        </CardTitle>
                        {section.description && (
                          <p className="text-sm text-gray-600">{section.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">
                        {visibleItems.length} items
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          sectionProgress === 100 ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                        )}
                      >
                        {sectionProgress}% complete
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                {section.isExpanded && (
                  <CardContent className="border-t space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {visibleItems.map(item => (
                        <FFEItemCard
                          key={item.id}
                          id={item.id}
                          name={item.name}
                          description={item.description}
                          state={item.state}
                          visibility={item.visibility}
                          notes={item.notes}
                          sectionName={section.name}
                          isRequired={item.isRequired}
                          isCustom={item.isCustom}
                          quantity={item.quantity}
                          mode="workspace"
                          disabled={disabled || saving}
                          onStateChange={handleStateChange}
                          onNotesChange={handleNotesChange}
                        />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Completion Status */}
      {stats.totalItems > 0 && (
        <Card className={cn(
          "border-2",
          progressPercentage === 100 
            ? "border-green-200 bg-green-50" 
            : "border-blue-200 bg-blue-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {progressPercentage === 100 ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Clock className="w-6 h-6 text-blue-600" />
                )}
                <div>
                  <h3 className="font-medium">
                    {progressPercentage === 100 ? 'FFE Phase Complete!' : 'FFE Phase In Progress'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {progressPercentage === 100 
                      ? 'All FFE items have been completed for this room.'
                      : `${stats.completedItems} of ${stats.totalItems} items completed.`
                    }
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className={cn("text-3xl font-bold", getProgressColor(progressPercentage))}>
                  {progressPercentage}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
            <p className="text-white/60 text-sm">{roomName} • {selectedImageIndex + 1} of {renderingImages.length}</p>
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
