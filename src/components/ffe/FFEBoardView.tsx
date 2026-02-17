'use client'

import React, { useState, useCallback } from 'react'
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

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Save previous state for rollback
    const previousSections = sections.map(s => ({
      ...s,
      items: [...s.items]
    }))

    // Build new sections state
    const newSections = sections.map(s => ({
      ...s,
      items: s.items.filter(i => !i.customFields?.isGroupedItem && !i.customFields?.isLinkedItem)
    }))

    const sourceSectionIdx = newSections.findIndex(s => s.id === source.droppableId)
    const destSectionIdx = newSections.findIndex(s => s.id === destination.droppableId)

    if (sourceSectionIdx === -1 || destSectionIdx === -1) return

    // Remove from source
    const [movedItem] = newSections[sourceSectionIdx].items.splice(source.index, 1)
    if (!movedItem) return

    // Insert at destination
    newSections[destSectionIdx].items.splice(destination.index, 0, movedItem)

    // Recalculate orders for affected sections
    const affectedItems: { id: string; sectionId: string; order: number }[] = []

    // Always recalculate the destination section
    newSections[destSectionIdx].items.forEach((item, idx) => {
      item.order = idx + 1
      affectedItems.push({
        id: item.id,
        sectionId: newSections[destSectionIdx].id,
        order: idx + 1,
      })
    })

    // If cross-section, also recalculate source section
    if (source.droppableId !== destination.droppableId) {
      newSections[sourceSectionIdx].items.forEach((item, idx) => {
        item.order = idx + 1
        affectedItems.push({
          id: item.id,
          sectionId: newSections[sourceSectionIdx].id,
          order: idx + 1,
        })
      })
    }

    // Rebuild full sections with grouped children preserved
    const updatedSections = sections.map(s => {
      const newSection = newSections.find(ns => ns.id === s.id)
      if (!newSection) return s
      // Keep grouped/linked children from original, add parent items from new order
      const groupedChildren = s.items.filter(i => i.customFields?.isGroupedItem || i.customFields?.isLinkedItem)
      return {
        ...s,
        items: [...newSection.items, ...groupedChildren]
      }
    })

    // Optimistic UI update
    onSectionsChange(updatedSections)

    // Persist to backend
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/bulk-reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: affectedItems })
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      toast.success(
        source.droppableId !== destination.droppableId
          ? 'Item moved to new section'
          : 'Item reordered'
      )
    } catch (error) {
      console.error('Error saving reorder:', error)
      toast.error('Failed to save changes')
      // Rollback
      onSectionsChange(previousSections)
    } finally {
      setSaving(false)
    }
  }, [sections, roomId, onSectionsChange])

  const handleSectionNameSave = async (sectionId: string) => {
    if (!editSectionName.trim()) {
      toast.error('Section name is required')
      return
    }
    setEditingSectionId(null)
    await onSectionRename(sectionId, editSectionName.trim())
    setEditSectionName('')
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
        {sections.map(section => {
          const parentItems = section.items.filter(
            item => !item.customFields?.isGroupedItem && !item.customFields?.isLinkedItem
          )

          return (
            <div
              key={section.id}
              className="min-w-[300px] max-w-[340px] w-[320px] flex-shrink-0 bg-gray-50 rounded-xl border border-gray-200 flex flex-col"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-gray-200 bg-white rounded-t-xl">
                {editingSectionId === section.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editSectionName}
                      onChange={(e) => setEditSectionName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSectionNameSave(section.id)
                        if (e.key === 'Escape') { setEditingSectionId(null); setEditSectionName('') }
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleSectionNameSave(section.id)} className="h-7 w-7 p-0 text-green-600">
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(null); setEditSectionName('') }} className="h-7 w-7 p-0 text-gray-400">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 group/header min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{section.name}</h3>
                      <button
                        onClick={() => { setEditingSectionId(section.id); setEditSectionName(section.name) }}
                        className="opacity-0 group-hover/header:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-opacity flex-shrink-0"
                        disabled={disabled}
                      >
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">
                        {parentItems.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddItem(section.id)}
                        className="h-7 w-7 p-0"
                        disabled={disabled}
                        title="Add item"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSectionDuplicate(section.id, section.name)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                        disabled={disabled}
                        title="Duplicate section"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSectionDelete(section.id, section.name)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        disabled={disabled}
                        title="Delete section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                      'flex-1 p-2 space-y-1.5 min-h-[60px] transition-colors overflow-y-auto max-h-[calc(100vh-280px)]',
                      snapshot.isDraggingOver && 'bg-blue-50/50 border-blue-200'
                    )}
                  >
                    {parentItems.length === 0 && !snapshot.isDraggingOver ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Package className="h-6 w-6 text-gray-300 mb-2" />
                        <p className="text-xs text-gray-400">No items</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onAddItem(section.id)}
                          className="mt-2 text-xs h-7"
                          disabled={disabled}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    ) : (
                      parentItems.map((item, index) => {
                        const isChosen = hasSpecs(item)
                        const specCount = item.linkedSpecs?.length || 0

                        return (
                          <Draggable
                            key={item.id}
                            draggableId={item.id}
                            index={index}
                            isDragDisabled={disabled}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn(
                                  'rounded-lg border bg-white p-2.5 shadow-sm transition-all cursor-pointer group/card',
                                  dragSnapshot.isDragging && 'shadow-lg ring-2 ring-blue-400 rotate-1',
                                  isChosen ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:border-gray-300'
                                )}
                                onClick={() => onItemClick?.(item.id)}
                              >
                                <div className="flex items-start gap-2">
                                  {/* Drag handle */}
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="mt-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                                  </div>

                                  {/* Chosen indicator */}
                                  <div className="mt-0.5 flex-shrink-0">
                                    {isChosen ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-300" />
                                    )}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {item.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {item.docCode && (
                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 rounded">
                                          {item.docCode}
                                        </span>
                                      )}
                                      {item.quantity > 1 && (
                                        <span className="text-[10px] text-gray-500">
                                          Qty: {item.quantity}
                                        </span>
                                      )}
                                      {specCount > 0 && (
                                        <span className="text-[10px] text-emerald-600 font-medium">
                                          {specCount === 1 ? '1 spec' : `${specCount} options`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
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

        {/* Saving indicator */}
        {saving && (
          <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50">
            Saving...
          </div>
        )}
      </div>
    </DragDropContext>
  )
}
