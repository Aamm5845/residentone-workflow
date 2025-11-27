'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Loader2,
  LayoutGrid,
  List,
  Settings
} from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { PhaseChat } from '@/components/chat/PhaseChat'
import ItemLibrarySidebar from './ItemLibrarySidebar'
import AddedItemCard from './AddedItemCard'
import AISummaryCard from '@/components/design-concept/AISummaryCard'
import ActivityLogPanel from './ActivityLogPanel'
import StageWorkspaceHeader from '@/components/stages/StageWorkspaceHeader'

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showLibrary, setShowLibrary] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'category' | 'status'>('order')

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

      {/* Main Content - 3 Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Item Library */}
        {showLibrary && (
          <div className="w-80 bg-white border-r border-gray-200 overflow-hidden">
            <ItemLibrarySidebar 
              stageId={stageId}
              onItemAdded={handleItemAdded}
              addedItemIds={items.map((item: any) => item.libraryItemId)}
            />
          </div>
        )}

        {/* Center - Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLibrary(!showLibrary)}
                className="text-gray-600"
              >
                {showLibrary ? 'Hide' : 'Show'} Library
              </Button>
              
              {items.length > 0 && (
                <span className="text-sm text-gray-500">
                  {progress.pending} pending
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="order">Sort: Default</option>
                <option value="name">Sort: Name</option>
                <option value="category">Sort: Category</option>
                <option value="status">Sort: Status</option>
              </select>
              
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Items Grid/List */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <LayoutGrid className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No items added yet
                </h3>
                <p className="text-gray-600 mb-6 max-w-md">
                  Start by selecting items from the library on the left. 
                  Add furniture, fixtures, materials, and more to guide the 3D rendering.
                </p>
                <Button
                  onClick={() => setShowLibrary(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Browse Library
                </Button>
              </div>
            ) : (
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                  : 'space-y-4'
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

        {/* Right Sidebar - AI Summary, Activity Log & Chat */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
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
        </div>
      </div>
    </div>
  )
}
