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

function isGroupedChild(item: FFEItem): boolean {
  return item.customFields?.isGroupedItem === true || item.customFields?.isLinkedItem === true
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

// Build a smooth bezier path between two points
function buildCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)

  // If mostly horizontal (different columns), use horizontal S-curve
  if (dx > 100) {
    const cpOffset = Math.max(dx * 0.35, 30)
    return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`
  }

  // Same column or close: simple vertical connection with slight curve
  const cpOffsetY = Math.max(dy * 0.3, 15)
  return `M ${x1} ${y1} C ${x1 + 20} ${y1 + cpOffsetY}, ${x2 - 20} ${y2 - cpOffsetY}, ${x2} ${y2}`
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

  // SVG connector lines
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<Array<{ d: string; key: string }>>([])
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 })

  // Drag-to-link state
  const [drawingLine, setDrawingLine] = useState<{
    fromItemId: string
    fromItemName: string
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

  // Calculate connector paths between grouped items
  const updatePaths = useCallback(() => {
    if (!showGroupLines || !scrollContentRef.current) {
      setPaths([])
      return
    }

    const container = scrollContentRef.current
    const containerRect = container.getBoundingClientRect()
    const connections = buildGroupConnections(sections)
    const newPaths: Array<{ d: string; key: string }> = []

    // Calculate SVG dimensions to match scrollable content
    setSvgSize({
      width: container.scrollWidth,
      height: container.scrollHeight,
    })

    for (const conn of connections) {
      const parentEl = container.querySelector(`[data-item-id="${conn.parentId}"]`)
      const childEl = container.querySelector(`[data-item-id="${conn.childId}"]`)
      if (!parentEl || !childEl) continue

      const parentRect = parentEl.getBoundingClientRect()
      const childRect = childEl.getBoundingClientRect()

      // Positions relative to the scroll content container
      const x1 = parentRect.right - containerRect.left
      const y1 = parentRect.top + parentRect.height / 2 - containerRect.top
      const x2 = childRect.left - containerRect.left
      const y2 = childRect.top + childRect.height / 2 - containerRect.top

      const d = buildCurvePath(x1, y1, x2, y2)
      newPaths.push({ d, key: `${conn.parentId}-${conn.childId}` })
    }

    setPaths(newPaths)
  }, [showGroupLines, sections])

  useEffect(() => { updatePaths() }, [updatePaths])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !showGroupLines) return
    const handleScroll = () => updatePaths()
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [showGroupLines, updatePaths])

  useEffect(() => {
    if (showGroupLines) {
      const timer = setTimeout(updatePaths, 100)
      return () => clearTimeout(timer)
    }
  }, [showGroupLines, sections, updatePaths])

  // Handle mousemove/mouseup while drawing a link line
  useEffect(() => {
    if (!drawingLine || !scrollContentRef.current) return

    const contentEl = scrollContentRef.current

    const handleMouseMove = (e: MouseEvent) => {
      const rect = contentEl.getBoundingClientRect()
      setDrawingLine(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : null)

      // Find which item card the mouse is over
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      let foundItemId: string | null = null
      for (const el of els) {
        const card = (el as HTMLElement).closest?.('[data-item-id]')
        if (card) {
          foundItemId = card.getAttribute('data-item-id')
          break
        }
      }
      setHoveredItemId(foundItemId && foundItemId !== drawingLine.fromItemId ? foundItemId : null)
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Use elementsFromPoint to find card under cursor (bypasses pointer-events issues)
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      let targetItemId: string | null = null
      for (const el of els) {
        const card = (el as HTMLElement).closest?.('[data-item-id]')
        if (card) {
          targetItemId = card.getAttribute('data-item-id')
          break
        }
      }

      if (targetItemId && drawingLine && targetItemId !== drawingLine.fromItemId) {
        let targetItem: FFEItem | null = null
        for (const s of sections) {
          const found = s.items.find(i => i.id === targetItemId)
          if (found) { targetItem = found; break }
        }

        if (targetItem) {
          if (isGroupedChild(targetItem)) {
            toast.error('This item is already grouped under another item')
          } else {
            handleLinkItems(drawingLine.fromItemId, targetItem.name)
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

  // Auto-scroll on drag near edges (for both item drag and line drawing)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current && !drawingLine) return

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
          if (!isDraggingRef.current && !drawingLine) return
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
  }, [drawingLine])

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
      setTimeout(updatePaths, 100)
    } catch (error) {
      console.error('Error saving reorder:', error)
      toast.error('Failed to save changes')
      onSectionsChange(previousSections)
    } finally {
      setSaving(false)
    }
  }, [sections, roomId, onSectionsChange, updatePaths])

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

  // Start drawing a line from the connector handle
  const handleConnectorMouseDown = (e: React.MouseEvent, item: FFEItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (!scrollContentRef.current) return

    const contentRect = scrollContentRef.current.getBoundingClientRect()
    const handleEl = e.currentTarget as HTMLElement
    const cardEl = handleEl.closest('[data-item-id]')
    if (!cardEl) return

    const cardRect = cardEl.getBoundingClientRect()

    setDrawingLine({
      fromItemId: item.id,
      fromItemName: item.name,
      startX: cardRect.right - contentRect.left,
      startY: cardRect.top + cardRect.height / 2 - contentRect.top,
      currentX: e.clientX - contentRect.left,
      currentY: e.clientY - contentRect.top,
    })
  }

  const drawingPath = drawingLine
    ? buildCurvePath(drawingLine.startX, drawingLine.startY, drawingLine.currentX, drawingLine.currentY)
    : null

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

        {showGroupLines && !drawingLine && (
          <span className="text-[11px] text-gray-400">
            Grab the <span className="text-blue-500 font-medium">●</span> handle on the right side of a card and drag to another item to group them
          </span>
        )}

        {drawingLine && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-300 animate-pulse">
            Release on target item to group with &quot;{drawingLine.fromItemName.length > 20 ? drawingLine.fromItemName.substring(0, 20) + '...' : drawingLine.fromItemName}&quot;
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4 min-h-[400px]"
        >
          {/* This inner div holds everything including the SVG — it scrolls together */}
          <div ref={scrollContentRef} className="relative inline-flex gap-3" style={{ minWidth: '100%' }}>

            {/* SVG layer — sits inside the scrollable content, behind cards */}
            {(showGroupLines || drawingLine) && (
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: svgSize.width || '100%',
                  height: svgSize.height || '100%',
                  zIndex: 1,
                  overflow: 'visible',
                }}
              >
                {/* Existing group connections — subtle lines, NO arrows */}
                {showGroupLines && paths.map(p => (
                  <path
                    key={p.key}
                    d={p.d}
                    stroke="#93c5fd"
                    strokeWidth="1.5"
                    fill="none"
                    strokeOpacity="0.7"
                  />
                ))}

                {/* Currently drawing line — orange dashed */}
                {drawingPath && (
                  <path
                    d={drawingPath}
                    stroke="#f97316"
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    fill="none"
                    strokeDasharray="6 3"
                  />
                )}
              </svg>
            )}

            {/* Columns */}
            {sections.map(section => {
              const allItems = [...section.items].sort((a, b) => a.order - b.order)

              return (
                <div
                  key={section.id}
                  className="min-w-[220px] max-w-[260px] w-[240px] flex-shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col"
                  style={{ zIndex: 2, position: 'relative' }}
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
                          <Button variant="ghost" size="sm" onClick={() => onSectionDuplicate(section.id, section.name)} className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" disabled={disabled} title="Duplicate">
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onSectionDelete(section.id, section.name)} className="h-6 w-6 p-0 text-gray-400 hover:text-red-500" disabled={disabled} title="Delete">
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
                              <Plus className="w-2.5 h-2.5 mr-0.5" /> Add Item
                            </Button>
                          </div>
                        ) : (
                          allItems.map((item, index) => {
                            const isChosen = hasSpecs(item)
                            const specCount = item.linkedSpecs?.length || 0
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
                                      {!drawingLine && (
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="mt-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <GripVertical className="w-3 h-3 text-gray-400" />
                                        </div>
                                      )}

                                      <div className="mt-0.5 flex-shrink-0">
                                        {isChosen ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Circle className="w-3.5 h-3.5 text-gray-300" />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {item.docCode && (
                                            <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-0.5 rounded">{item.docCode}</span>
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
                                    </div>

                                    {/* Connector handle on right side — grab to draw a line */}
                                    {showGroupLines && !isChild && (
                                      <div
                                        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md cursor-crosshair opacity-0 group-hover/card:opacity-100 hover:scale-125 transition-all"
                                        style={{ zIndex: 30 }}
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
          </div>
        </div>
      </DragDropContext>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50">
          Saving...
        </div>
      )}
    </div>
  )
}
