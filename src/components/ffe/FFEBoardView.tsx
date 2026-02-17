'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  Copy,
  CheckCircle2,
  Circle,
  Package,
  GripVertical,
  Link2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface LinkedSpec {
  id: string
  name: string
  brand?: string
  sku?: string
  isOption?: boolean
  optionNumber?: number
  specStatus?: string
  images?: string[]
}

interface FFEItem {
  id: string
  name: string
  description?: string
  notes?: string
  order: number
  quantity: number
  customFields?: any
  isSpecItem: boolean
  ffeRequirementId?: string
  linkedSpecs?: LinkedSpec[]
  docCode?: string
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  items: FFEItem[]
}

interface FFEBoardViewProps {
  sections: FFESection[]
  roomId: string
  disabled?: boolean
  onSectionsChange: (sections: FFESection[]) => void
  onSectionRename: (sectionId: string, newName: string) => Promise<void>
  onSectionDelete: (sectionId: string, sectionName: string) => void
  onSectionDuplicate: (sectionId: string, sectionName: string) => void
  onAddItem: (sectionId: string) => void
  onItemClick?: (itemId: string) => void
  onDataReload: () => Promise<void>
}

function hasSpecs(item: FFEItem): boolean {
  if (item.linkedSpecs && item.linkedSpecs.length > 0) return true
  const itemAny = item as any
  if (itemAny.brand || itemAny.sku || itemAny.supplierName || itemAny.supplierLink ||
      (itemAny.images && itemAny.images.length > 0) || itemAny.specStatus === 'SELECTED') {
    return true
  }
  return false
}

function getGroupedChildren(item: FFEItem, sections: FFESection[]): Array<FFEItem & { fromSection?: string; fromSectionId?: string }> {
  const allChildren: Array<FFEItem & { fromSection?: string; fromSectionId?: string }> = []
  sections.forEach(section => {
    section.items.forEach(child => {
      if ((child.customFields?.isGroupedItem || child.customFields?.isLinkedItem) &&
          (child.customFields?.parentId === item.id || child.customFields?.parentName === item.name)) {
        allChildren.push({
          ...child,
          fromSection: section.name,
          fromSectionId: section.id
        })
      }
    })
  })
  return allChildren.sort((a, b) => (a.order || 0) - (b.order || 0))
}

function hasGroupedChildren(item: FFEItem): boolean {
  const cf = item.customFields
  return cf?.hasChildren === true || (Array.isArray(cf?.linkedItems) && cf.linkedItems.length > 0)
}

function isGroupedChild(item: FFEItem): boolean {
  return item.customFields?.isGroupedItem === true || item.customFields?.isLinkedItem === true
}

function findParentItem(child: FFEItem, sections: FFESection[]): { item: FFEItem; sectionName: string } | null {
  const parentId = child.customFields?.parentId
  const parentName = child.customFields?.parentName
  for (const section of sections) {
    for (const item of section.items) {
      if ((parentId && item.id === parentId) || (!parentId && parentName && item.name === parentName)) {
        return { item, sectionName: section.name }
      }
    }
  }
  return null
}

function buildGroupConnections(sections: FFESection[]): Array<{ parentId: string; childId: string }> {
  const connections: Array<{ parentId: string; childId: string }> = []
  sections.forEach(section => {
    section.items.forEach(item => {
      if (isGroupedChild(item)) {
        const parentId = item.customFields?.parentId
        if (parentId) {
          connections.push({ parentId, childId: item.id })
        } else {
          const parentName = item.customFields?.parentName
          if (parentName) {
            for (const s of sections) {
              const parent = s.items.find(i => i.name === parentName && !isGroupedChild(i))
              if (parent) {
                connections.push({ parentId: parent.id, childId: item.id })
                break
              }
            }
          }
        }
      }
    })
  })
  return connections
}

export default function FFEBoardView({
  sections,
  roomId,
  disabled = false,
  onSectionsChange,
  onSectionRename,
  onSectionDelete,
  onSectionDuplicate,
  onAddItem,
  onItemClick,
  onDataReload,
}: FFEBoardViewProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editSectionName, setEditSectionName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showGroupLines, setShowGroupLines] = useState(false)

  // Auto-scroll refs
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  // For SVG connector lines (existing groupings)
  const boardRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])

  // Drag-to-link state: draw a line from one item to another
  const [drawingLine, setDrawingLine] = useState<{
    fromItemId: string
    fromItemName: string
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

  // Calculate existing group connector lines
  const updateLines = useCallback(() => {
    if (!showGroupLines || !boardRef.current) {
      setLines([])
      return
    }

    const connections = buildGroupConnections(sections)
    const boardRect = boardRef.current.getBoundingClientRect()
    const newLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

    for (const conn of connections) {
      const parentEl = boardRef.current.querySelector(`[data-item-id="${conn.parentId}"]`)
      const childEl = boardRef.current.querySelector(`[data-item-id="${conn.childId}"]`)
      if (!parentEl || !childEl) continue

      const parentRect = parentEl.getBoundingClientRect()
      const childRect = childEl.getBoundingClientRect()

      const x1 = parentRect.right - boardRect.left
      const y1 = parentRect.top + parentRect.height / 2 - boardRect.top
      const x2 = childRect.left - boardRect.left
      const y2 = childRect.top + childRect.height / 2 - boardRect.top

      // If same column, connect from bottom to top
      if (Math.abs(x1 - parentRect.width - x2) < 280) {
        newLines.push({
          x1: parentRect.left + parentRect.width / 2 - boardRect.left,
          y1: parentRect.bottom - boardRect.top,
          x2: childRect.left + childRect.width / 2 - boardRect.left,
          y2: childRect.top - boardRect.top,
        })
      } else {
        newLines.push({ x1, y1, x2, y2 })
      }
    }

    setLines(newLines)
  }, [showGroupLines, sections])

  useEffect(() => { updateLines() }, [updateLines])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !showGroupLines) return
    const handleScroll = () => updateLines()
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [showGroupLines, updateLines])

  useEffect(() => {
    if (showGroupLines) {
      const timer = setTimeout(updateLines, 50)
      return () => clearTimeout(timer)
    }
  }, [showGroupLines, sections, updateLines])

  // Handle mousemove while drawing a link line
  useEffect(() => {
    if (!drawingLine || !boardRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const boardRect = boardRef.current!.getBoundingClientRect()
      setDrawingLine(prev => prev ? {
        ...prev,
        currentX: e.clientX - boardRect.left,
        currentY: e.clientY - boardRect.top,
      } : null)

      // Check if hovering over an item card
      const target = (e.target as HTMLElement).closest('[data-item-id]')
      if (target) {
        const itemId = target.getAttribute('data-item-id')
        setHoveredItemId(itemId !== drawingLine.fromItemId ? itemId : null)
      } else {
        setHoveredItemId(null)
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Check if released on an item card
      const target = (e.target as HTMLElement).closest('[data-item-id]')
      if (target && drawingLine) {
        const targetItemId = target.getAttribute('data-item-id')
        if (targetItemId && targetItemId !== drawingLine.fromItemId) {
          // Find the target item to check if it's valid
          let targetItem: FFEItem | null = null
          for (const s of sections) {
            const found = s.items.find(i => i.id === targetItemId)
            if (found) { targetItem = found; break }
          }

          if (targetItem) {
            if (isGroupedChild(targetItem)) {
              toast.error('This item is already grouped under another item')
            } else {
              // Create the grouping: drawingLine.fromItemId is parent, targetItem.name is child name
              handleLinkItems(drawingLine.fromItemId, targetItem.name)
            }
          }
        }
      }

      setDrawingLine(null)
      setHoveredItemId(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drawingLine, sections])

  // Auto-scroll on drag near edges
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      const rect = container.getBoundingClientRect()
      const edgeThreshold = 80
      const maxScrollSpeed = 15

      const distFromLeft = e.clientX - rect.left
      const distFromRight = rect.right - e.clientX

      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current)
        autoScrollRef.current = null
      }

      let scrollSpeed = 0
      if (distFromLeft < edgeThreshold) {
        scrollSpeed = -maxScrollSpeed * (1 - distFromLeft / edgeThreshold)
      } else if (distFromRight < edgeThreshold) {
        scrollSpeed = maxScrollSpeed * (1 - distFromRight / edgeThreshold)
      }

      if (scrollSpeed !== 0) {
        const doScroll = () => {
          if (!isDraggingRef.current) return
          container.scrollLeft += scrollSpeed
          autoScrollRef.current = requestAnimationFrame(doScroll)
        }
        autoScrollRef.current = requestAnimationFrame(doScroll)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current)
      }
    }
  }, [])

  const handleDragEnd = useCallback(async (result: DropResult) => {
    isDraggingRef.current = false
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }

    const { source, destination } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const previousSections = sections.map(s => ({ ...s, items: [...s.items] }))

    const newSections = sections.map(s => ({
      ...s,
      items: [...s.items].sort((a, b) => a.order - b.order)
    }))

    const sourceSectionIdx = newSections.findIndex(s => s.id === source.droppableId)
    const destSectionIdx = newSections.findIndex(s => s.id === destination.droppableId)
    if (sourceSectionIdx === -1 || destSectionIdx === -1) return

    const [movedItem] = newSections[sourceSectionIdx].items.splice(source.index, 1)
    if (!movedItem) return

    newSections[destSectionIdx].items.splice(destination.index, 0, movedItem)

    const affectedItems: { id: string; sectionId: string; order: number }[] = []
    newSections[destSectionIdx].items.forEach((item, idx) => {
      item.order = idx + 1
      affectedItems.push({ id: item.id, sectionId: newSections[destSectionIdx].id, order: idx + 1 })
    })
    if (source.droppableId !== destination.droppableId) {
      newSections[sourceSectionIdx].items.forEach((item, idx) => {
        item.order = idx + 1
        affectedItems.push({ id: item.id, sectionId: newSections[sourceSectionIdx].id, order: idx + 1 })
      })
    }

    onSectionsChange(newSections)

    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/bulk-reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: affectedItems })
      })
      if (!response.ok) throw new Error('Failed to save')
      toast.success(source.droppableId !== destination.droppableId ? 'Item moved to new section' : 'Item reordered')
      setTimeout(updateLines, 100)
    } catch (error) {
      console.error('Error saving reorder:', error)
      toast.error('Failed to save changes')
      onSectionsChange(previousSections)
    } finally {
      setSaving(false)
    }
  }, [sections, roomId, onSectionsChange, updateLines])

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  const handleSectionNameSave = async (sectionId: string) => {
    if (!editSectionName.trim()) { toast.error('Section name is required'); return }
    setEditingSectionId(null)
    await onSectionRename(sectionId, editSectionName.trim())
    setEditSectionName('')
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLinkItems = async (parentItemId: string, childItemName: string) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${parentItemId}/linked-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: childItemName })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link items')
      }
      toast.success(`Grouped "${childItemName}" successfully`)
      await onDataReload()
    } catch (error: any) {
      console.error('Error linking items:', error)
      toast.error(error.message || 'Failed to link items')
    } finally {
      setSaving(false)
    }
  }

  // Start drawing a line from a connector dot
  const handleConnectorMouseDown = (e: React.MouseEvent, item: FFEItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!boardRef.current) return

    const boardRect = boardRef.current.getBoundingClientRect()
    const cardEl = (e.target as HTMLElement).closest('[data-item-id]')
    if (!cardEl) return

    const cardRect = cardEl.getBoundingClientRect()

    setDrawingLine({
      fromItemId: item.id,
      fromItemName: item.name,
      startX: cardRect.right - boardRect.left,
      startY: cardRect.top + cardRect.height / 2 - boardRect.top,
      currentX: e.clientX - boardRect.left,
      currentY: e.clientY - boardRect.top,
    })
  }

  return (
    <div>
      {/* Board Controls */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setShowGroupLines(!showGroupLines)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
            showGroupLines
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
          )}
          title={showGroupLines ? 'Hide group connections' : 'Show group connections & enable linking'}
        >
          {showGroupLines ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          Groups
        </button>

        {showGroupLines && (
          <span className="text-[11px] text-gray-400">
            Drag from the <span className="text-blue-500 font-medium">●</span> dot on any item to another to create a grouping
          </span>
        )}

        {drawingLine && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-300 animate-pulse">
            Drawing from &quot;{drawingLine.fromItemName.length > 20 ? drawingLine.fromItemName.substring(0, 20) + '...' : drawingLine.fromItemName}&quot; — release on target item
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div ref={boardRef} className="relative">
          {/* SVG overlay for lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrow-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" fillOpacity="0.7" />
              </marker>
              <marker id="arrow-orange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#f97316" fillOpacity="0.8" />
              </marker>
            </defs>

            {/* Existing group connections (only when toggle is on) */}
            {showGroupLines && lines.map((line, idx) => (
              <line
                key={`group-${idx}`}
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeOpacity="0.5"
                strokeDasharray="6 3"
                markerEnd="url(#arrow-blue)"
              />
            ))}

            {/* Currently drawing line */}
            {drawingLine && (
              <line
                x1={drawingLine.startX} y1={drawingLine.startY}
                x2={drawingLine.currentX} y2={drawingLine.currentY}
                stroke="#f97316"
                strokeWidth="2.5"
                strokeOpacity="0.8"
                strokeDasharray="4 2"
                markerEnd="url(#arrow-orange)"
              />
            )}
          </svg>

          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto pb-4 min-h-[400px] scroll-smooth"
          >
            {sections.map(section => {
              const allItems = [...section.items].sort((a, b) => a.order - b.order)

              return (
                <div
                  key={section.id}
                  className="min-w-[220px] max-w-[260px] w-[240px] flex-shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col"
                >
                  {/* Column Header */}
                  <div className="p-2.5 border-b border-gray-200 bg-white rounded-t-xl">
                    {editingSectionId === section.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editSectionName}
                          onChange={(e) => setEditSectionName(e.target.value)}
                          className="h-6 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSectionNameSave(section.id)
                            if (e.key === 'Escape') { setEditingSectionId(null); setEditSectionName('') }
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleSectionNameSave(section.id)} className="h-6 w-6 p-0 text-green-600">
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(null); setEditSectionName('') }} className="h-6 w-6 p-0 text-gray-400">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 group/header min-w-0">
                          <h3 className="font-semibold text-gray-900 text-xs truncate">{section.name}</h3>
                          <button
                            onClick={() => { setEditingSectionId(section.id); setEditSectionName(section.name) }}
                            className="opacity-0 group-hover/header:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-opacity flex-shrink-0"
                            disabled={disabled}
                          >
                            <Pencil className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 flex-shrink-0">
                            {allItems.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => onAddItem(section.id)} className="h-6 w-6 p-0" disabled={disabled} title="Add item">
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onSectionDuplicate(section.id, section.name)} className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" disabled={disabled} title="Duplicate section">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onSectionDelete(section.id, section.name)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-500" disabled={disabled} title="Delete section">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={section.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'flex-1 p-1.5 space-y-1 min-h-[60px] transition-colors overflow-y-auto max-h-[calc(100vh-280px)]',
                          snapshot.isDraggingOver && 'bg-blue-50/50 border-blue-200'
                        )}
                      >
                        {allItems.length === 0 && !snapshot.isDraggingOver ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Package className="h-5 w-5 text-gray-300 mb-1.5" />
                            <p className="text-[10px] text-gray-400">No items</p>
                            <Button size="sm" variant="ghost" onClick={() => onAddItem(section.id)} className="mt-1.5 text-[10px] h-6" disabled={disabled}>
                              <Plus className="w-2.5 h-2.5 mr-0.5" />
                              Add Item
                            </Button>
                          </div>
                        ) : (
                          allItems.map((item, index) => {
                            const isChosen = hasSpecs(item)
                            const specCount = item.linkedSpecs?.length || 0
                            const isParent = hasGroupedChildren(item)
                            const isChild = isGroupedChild(item)
                            const isDrawingFrom = drawingLine?.fromItemId === item.id
                            const isHoverTarget = hoveredItemId === item.id

                            return (
                              <Draggable
                                key={item.id}
                                draggableId={item.id}
                                index={index}
                                isDragDisabled={disabled || !!drawingLine}
                              >
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    data-item-id={item.id}
                                    className={cn(
                                      'rounded-lg border bg-white p-2 shadow-sm transition-all cursor-pointer group/card relative',
                                      dragSnapshot.isDragging && 'shadow-lg ring-2 ring-blue-400 rotate-1',
                                      isChosen ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:border-gray-300',
                                      isDrawingFrom && 'ring-2 ring-orange-400 bg-orange-50/50',
                                      isHoverTarget && drawingLine && 'ring-2 ring-blue-400 bg-blue-50/50',
                                    )}
                                    onClick={() => {
                                      if (!drawingLine) onItemClick?.(item.id)
                                    }}
                                  >
                                    <div className="flex items-start gap-1.5">
                                      {/* Drag handle */}
                                      {!drawingLine && (
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="mt-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <GripVertical className="w-3 h-3 text-gray-400" />
                                        </div>
                                      )}

                                      {/* Chosen indicator */}
                                      <div className="mt-0.5 flex-shrink-0">
                                        {isChosen ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Circle className="w-3.5 h-3.5 text-gray-300" />
                                        )}
                                      </div>

                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">
                                          {item.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {item.docCode && (
                                            <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-0.5 rounded">
                                              {item.docCode}
                                            </span>
                                          )}
                                          {item.quantity > 1 && (
                                            <span className="text-[9px] text-gray-500">x{item.quantity}</span>
                                          )}
                                          {specCount > 0 && (
                                            <span className="text-[9px] text-emerald-600 font-medium">
                                              {specCount === 1 ? '1 spec' : `${specCount} opts`}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Link icon — only for items that are part of a group */}
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        {isParent && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-0.5 rounded hover:bg-blue-100 transition-colors"
                                                title="View grouped children"
                                              >
                                                <Link2 className="w-3 h-3 text-blue-500" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2" side="right" align="start">
                                              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Grouped Children</p>
                                              {getGroupedChildren(item, sections).map(child => (
                                                <div
                                                  key={child.id}
                                                  className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-50 text-xs cursor-pointer"
                                                  onClick={() => onItemClick?.(child.id)}
                                                >
                                                  <Link2 className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                                                  <span className="truncate text-gray-700">{child.name}</span>
                                                  {child.fromSection && (
                                                    <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto flex-shrink-0 bg-violet-50 text-violet-600 border-violet-200">
                                                      {child.fromSection}
                                                    </Badge>
                                                  )}
                                                </div>
                                              ))}
                                              <p className="text-[9px] text-gray-400 mt-1.5 pt-1.5 border-t">Click to view in list</p>
                                            </PopoverContent>
                                          </Popover>
                                        )}

                                        {isChild && !isParent && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-0.5 rounded hover:bg-blue-100 transition-colors"
                                                title="View parent item"
                                              >
                                                <Link2 className="w-3 h-3 text-blue-500" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2" side="right" align="start">
                                              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Grouped To</p>
                                              {(() => {
                                                const parent = findParentItem(item, sections)
                                                if (!parent) return <p className="text-xs text-gray-400 italic">Parent not found</p>
                                                return (
                                                  <div
                                                    className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-gray-50 text-xs cursor-pointer"
                                                    onClick={() => onItemClick?.(parent.item.id)}
                                                  >
                                                    <Link2 className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />
                                                    <span className="truncate text-gray-700">{parent.item.name}</span>
                                                    <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto flex-shrink-0 bg-violet-50 text-violet-600 border-violet-200">
                                                      {parent.sectionName}
                                                    </Badge>
                                                  </div>
                                                )
                                              })()}
                                              <p className="text-[9px] text-gray-400 mt-1.5 pt-1.5 border-t">Click to view in list</p>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                    </div>

                                    {/* Connector dot — only when Groups toggle is on, for non-child items */}
                                    {showGroupLines && !isChild && (
                                      <div
                                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow cursor-crosshair opacity-0 group-hover/card:opacity-100 hover:scale-125 transition-all z-20"
                                        onMouseDown={(e) => handleConnectorMouseDown(e, item)}
                                        title="Drag to another item to group"
                                      />
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            )
                          })
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}

            {saving && (
              <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50">
                Saving...
              </div>
            )}
          </div>
        </div>
      </DragDropContext>
    </div>
  )
}
