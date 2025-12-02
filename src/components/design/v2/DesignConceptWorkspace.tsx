'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Loader2,
  LayoutGrid,
  List,
  Settings,
  MessageCircle,
  Activity,
  Sparkles,
  X,
  PanelRightOpen,
  PanelRightClose,
  Maximize2,
  Minimize2
} from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { PhaseChat } from '@/components/chat/PhaseChat'
import ItemLibrarySidebar from './ItemLibrarySidebar'
import AddedItemCard from './AddedItemCard'
import AISummaryCard from '@/components/design-concept/AISummaryCard'
import ActivityLogPanel from './ActivityLogPanel'
import StageWorkspaceHeader from '@/components/stages/StageWorkspaceHeader'
import { useDeviceType } from '@/hooks/useDeviceType'
import { cn } from '@/lib/utils'

interface Props {
  stageId: string
  roomId?: string
  projectId?: string
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function DesignConceptWorkspace({ stageId, roomId, projectId }: Props) {
  // iPad/Tablet detection
  const { isIPad, isTablet } = useDeviceType()
  const isTabletDevice = isIPad || isTablet
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  // On iPad, hide library by default to give more space
  const [showLibrary, setShowLibrary] = useState(!isTabletDevice)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'category' | 'status'>('order')
  // iPad: Tab-based right sidebar - SHOW chat by default
  const [activeRightPanel, setActiveRightPanel] = useState<'chat' | 'activity' | 'ai'>('chat')
  const [showRightSidebar, setShowRightSidebar] = useState(true) // Always show chat sidebar
  const [isRightSidebarFullscreen, setIsRightSidebarFullscreen] = useState(false) // iPad: fullscreen mode
  
  // Update showLibrary when device type changes (e.g., on resize for testing)
  useEffect(() => {
    if (isTabletDevice) {
      setShowLibrary(false)
      // Keep right sidebar (chat) visible on iPad
    }
  }, [isTabletDevice])

  // Fetch stage data
  const { data: stageData, error: stageError, isLoading: stageLoading } = useSWR(
    `/api/stages/${stageId}/sections`,
    fetcher,
    { refreshInterval: 30000 }
  )

  // Fetch design items
  const { data: itemsData, error: itemsError, isLoading: itemsLoading, mutate: refreshItems } = useSWR(
    `/api/stages/${stageId}/design-items`,
    fetcher,
    { 
      refreshInterval: 30000, 
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000 // Reduce deduping to allow faster updates
    }
  )

  const stage = stageData?.stage
  const room = stageData?.room
  const project = stageData?.project
  const items = itemsData?.items || []
  const progress = itemsData?.progress || { total: 0, completed: 0, pending: 0, percentage: 0 }

  // Sort items based on selected sort option
  const sortedItems = React.useMemo(() => {
    const sorted = [...items]
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a: any, b: any) => {
          const nameA = a.libraryItem?.name || ''
          const nameB = b.libraryItem?.name || ''
          return nameA.localeCompare(nameB)
        })
        break
      case 'category':
        sorted.sort((a: any, b: any) => {
          const catA = a.libraryItem?.category || ''
          const catB = b.libraryItem?.category || ''
          if (catA === catB) {
            const nameA = a.libraryItem?.name || ''
            const nameB = b.libraryItem?.name || ''
            return nameA.localeCompare(nameB)
          }
          return catA.localeCompare(catB)
        })
        break
      case 'status':
        sorted.sort((a: any, b: any) => {
          const ac = !!a.completedByRenderer
          const bc = !!b.completedByRenderer
          return ac === bc ? 0 : ac ? 1 : -1 // completed at bottom
        })
        break
      case 'order':
      default:
        sorted.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        break
    }
    
    return sorted
  }, [items, sortBy])


  const isLoading = stageLoading || itemsLoading
  const hasError = stageError || itemsError

  // Handle item added from library
  const handleItemAdded = async () => {
    await refreshItems()
    toast.success('Item added to design concept')
  }
  
  // Toggle item expanded state
  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newExpanded = { ...prev }
      if (newExpanded[itemId]) {
        delete newExpanded[itemId]
      } else {
        newExpanded[itemId] = true
      }
      return newExpanded
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Loading Design Concept...</p>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Failed to load workspace</p>
          <Button 
            onClick={() => {
              refreshItems()
            }} 
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const roomName = room?.name || room?.type || 'Room'
  const projectName = project?.name || 'Project'

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Unified Header */}
      <StageWorkspaceHeader
        projectId={project?.id || projectId || ''}
        projectName={projectName}
        clientName={project?.client?.name}
        roomId={room?.id || roomId}
        roomName={room?.name}
        roomType={room?.type}
        stageId={stageId}
        stageType={stage?.type || 'DESIGN_CONCEPT'}
        stageStatus={stage?.status}
        assignedUserName={stage?.assignedUser?.name || null}
        dueDate={stage?.dueDate}
        progressPercent={progress.percentage}
      />

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Item Library */}
        {showLibrary && (
          <div className={cn(
            "bg-white border-r border-gray-200 overflow-hidden flex-shrink-0",
            // iPad: Full-screen overlay instead of side panel
            isTabletDevice 
              ? "absolute inset-0 z-40" 
              : "w-80"
          )}>
            {/* iPad: Close button for library overlay */}
            {isTabletDevice && (
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Item Library</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLibrary(false)}
                  className="h-10 w-10 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
            <ItemLibrarySidebar 
              stageId={stageId}
              onItemAdded={() => {
                handleItemAdded()
                // Auto-close library on iPad after adding item
                if (isTabletDevice) setShowLibrary(false)
              }}
              addedItemIds={items.map((item: any) => item.libraryItemId)}
            />
          </div>
        )}

        {/* Center - Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar - iPad: larger touch targets */}
          <div className={cn(
            "bg-white border-b border-gray-200 flex items-center justify-between",
            isTabletDevice ? "px-4 py-4" : "px-6 py-3"
          )}>
            <div className={cn("flex items-center", isTabletDevice ? "gap-3" : "space-x-2")}>
              <Button
                variant="ghost"
                size={isTabletDevice ? "default" : "sm"}
                onClick={() => setShowLibrary(!showLibrary)}
                className={cn("text-gray-600", isTabletDevice && "h-11 px-4")}
              >
                {showLibrary ? 'Hide' : 'Show'} Library
              </Button>
              
              {items.length > 0 && (
                <span className={cn("text-gray-500", isTabletDevice ? "text-base" : "text-sm")}>
                  {progress.pending} pending
                </span>
              )}
            </div>

            <div className={cn("flex items-center", isTabletDevice ? "gap-3" : "space-x-2")}>
              {/* Sort dropdown - iPad: larger */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={cn(
                  "border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                  isTabletDevice ? "text-base px-4 py-2.5" : "text-sm px-3 py-1.5"
                )}
              >
                <option value="order">Sort: Default</option>
                <option value="name">Sort: Name</option>
                <option value="category">Sort: Category</option>
                <option value="status">Sort: Status</option>
              </select>
              
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size={isTabletDevice ? "default" : "sm"}
                onClick={() => setViewMode('grid')}
                className={isTabletDevice ? "h-11 w-11 p-0" : ""}
              >
                <LayoutGrid className={isTabletDevice ? "w-5 h-5" : "w-4 h-4"} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size={isTabletDevice ? "default" : "sm"}
                onClick={() => setViewMode('list')}
                className={isTabletDevice ? "h-11 w-11 p-0" : ""}
              >
                <List className={isTabletDevice ? "w-5 h-5" : "w-4 h-4"} />
              </Button>
              
              {/* iPad: Toggle right sidebar button */}
              {isTabletDevice && (
                <Button
                  variant={showRightSidebar ? 'default' : 'ghost'}
                  size="default"
                  onClick={() => setShowRightSidebar(!showRightSidebar)}
                  className="h-11 w-11 p-0"
                >
                  {showRightSidebar ? (
                    <PanelRightClose className="w-5 h-5" />
                  ) : (
                    <PanelRightOpen className="w-5 h-5" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Items Grid/List - iPad: single column, more padding */}
          <div className={cn(
            "flex-1 overflow-y-auto",
            isTabletDevice ? "p-4" : "p-6 pt-4"
          )}>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className={cn(
                  "bg-gray-100 rounded-full flex items-center justify-center mb-4",
                  isTabletDevice ? "w-20 h-20" : "w-24 h-24"
                )}>
                  <LayoutGrid className={cn("text-gray-400", isTabletDevice ? "w-10 h-10" : "w-12 h-12")} />
                </div>
                <h3 className={cn("font-semibold text-gray-900 mb-2", isTabletDevice ? "text-xl" : "text-xl")}>
                  No items added yet
                </h3>
                <p className={cn("text-gray-600 mb-6 max-w-md", isTabletDevice ? "text-base" : "")}>
                  Start by selecting items from the library. 
                  Add furniture, fixtures, materials, and more to guide the 3D rendering.
                </p>
                <Button
                  onClick={() => setShowLibrary(true)}
                  className={cn("bg-indigo-600 hover:bg-indigo-700", isTabletDevice && "h-12 px-6 text-base")}
                >
                  Browse Library
                </Button>
              </div>
            ) : (
              <div className={
                viewMode === 'grid'
                  // iPad: Single column for readability
                  ? isTabletDevice 
                    ? 'grid grid-cols-1 gap-4' 
                    : 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                  : isTabletDevice ? 'space-y-3' : 'space-y-4'
              }>
              {sortedItems.map((item: any) => {
                  const isExpanded = !!expandedItems[item.id]
                  return (
                    <AddedItemCard
                      key={item.id}
                      item={item}
                      onUpdate={refreshItems}
                      viewMode={viewMode}
                      expanded={isExpanded}
                      onToggleExpanded={() => toggleItemExpanded(item.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Desktop: Always visible, iPad: Slide-over panel with tabs */}
        {(showRightSidebar || !isTabletDevice) && (
          <div className={cn(
            "bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0",
            isTabletDevice 
              ? isRightSidebarFullscreen
                ? "absolute inset-0 z-40" // Fullscreen mode
                : "absolute right-0 top-0 bottom-0 w-[420px] z-30 shadow-xl" // Wider panel (was w-80)
              : "w-96"
          )}>
            {/* iPad: Tab bar for switching panels */}
            {isTabletDevice ? (
              <>
                {/* Tab Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 bg-gray-50">
                  <div className="flex gap-1">
                    <Button
                      variant={activeRightPanel === 'chat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveRightPanel('chat')}
                      className="h-10 px-3"
                    >
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                    <Button
                      variant={activeRightPanel === 'activity' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveRightPanel('activity')}
                      className="h-10 px-3"
                    >
                      <Activity className="w-4 h-4 mr-1" />
                      Activity
                    </Button>
                    <Button
                      variant={activeRightPanel === 'ai' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveRightPanel('ai')}
                      className="h-10 px-3"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    {/* Fullscreen toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRightSidebarFullscreen(!isRightSidebarFullscreen)}
                      className="h-10 w-10 p-0"
                      title={isRightSidebarFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                      {isRightSidebarFullscreen ? (
                        <Minimize2 className="w-5 h-5" />
                      ) : (
                        <Maximize2 className="w-5 h-5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowRightSidebar(false)
                        setIsRightSidebarFullscreen(false)
                      }}
                      className="h-10 w-10 p-0"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                  {activeRightPanel === 'chat' && (
                    <PhaseChat
                      stageId={stageId}
                      stageName={`Design - ${roomName}`}
                      className="h-full"
                    />
                  )}
                  {activeRightPanel === 'activity' && (
                    <div className="h-full overflow-y-auto">
                      <ActivityLogPanel stageId={stageId} />
                    </div>
                  )}
                  {activeRightPanel === 'ai' && (
                    <div className="p-4 overflow-y-auto h-full">
                      <AISummaryCard stageId={stageId} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Desktop: Show all panels stacked */
              <>
                {/* AI Summary */}
                <div className="border-b border-gray-200 p-4 overflow-y-auto flex-shrink-0" style={{ maxHeight: '25%' }}>
                  <AISummaryCard stageId={stageId} />
                </div>
                
                {/* Activity Log - Fixed height */}
                <div className="border-b border-gray-200 flex-shrink-0" style={{ height: '320px' }}>
                  <ActivityLogPanel stageId={stageId} />
                </div>
                
                {/* Chat - Fixed height */}
                <div className="flex-shrink-0 overflow-hidden" style={{ height: 'calc(100% - 25% - 320px)' }}>
                  <PhaseChat
                    stageId={stageId}
                    stageName={`Design - ${roomName}`}
                    className="h-full"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
