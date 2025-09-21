'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Check, 
  X, 
  GripVertical, 
  Edit2, 
  Trash2, 
  MoreHorizontal,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
}

interface ChecklistProps {
  sectionId: string
  items: ChecklistItem[]
  onItemsChange: (items: ChecklistItem[]) => void
  className?: string
}

export function Checklist({ sectionId, items, onItemsChange, className = '' }: ChecklistProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const newItemInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Focus input when adding new item
  useEffect(() => {
    if (isAdding && newItemInputRef.current) {
      newItemInputRef.current.focus()
    }
  }, [isAdding])

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const createItem = async () => {
    if (!newItemText.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sectionId,
          text: newItemText.trim(),
          order: items.length
        })
      })

      const result = await response.json()

      if (result.success) {
        const updatedItems = [...items, result.item]
        onItemsChange(updatedItems)
        setNewItemText('')
        setIsAdding(false)
        toast.success('Item added to checklist')
      } else {
        throw new Error(result.error || 'Failed to create item')
      }
    } catch (error) {
      toast.error('Failed to add checklist item')
    } finally {
      setIsLoading(false)
    }
  }

  const updateItem = async (itemId: string, updates: Partial<ChecklistItem>) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId,
          ...updates
        })
      })

      const result = await response.json()

      if (result.success) {
        const updatedItems = items.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        )
        onItemsChange(updatedItems)
        
        if (updates.text) {
          toast.success('Item updated')
        }
      } else {
        throw new Error(result.error || 'Failed to update item')
      }
    } catch (error) {
      toast.error('Failed to update checklist item')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/design/checklist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemId })
      })

      const result = await response.json()

      if (result.success) {
        const updatedItems = items.filter(item => item.id !== itemId)
        onItemsChange(updatedItems)
        toast.success('Item removed from checklist')
      } else {
        throw new Error(result.error || 'Failed to delete item')
      }
    } catch (error) {
      toast.error('Failed to remove checklist item')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCompletion = async (item: ChecklistItem) => {
    const newCompleted = !item.completed
    
    // Optimistic update
    const optimisticItems = items.map(i =>
      i.id === item.id ? { ...i, completed: newCompleted } : i
    )
    onItemsChange(optimisticItems)

    try {
      await updateItem(item.id, { completed: newCompleted })
      toast.success(newCompleted ? 'Item completed' : 'Item marked incomplete')
    } catch (error) {
      // Revert on error
      onItemsChange(items)
    }
  }

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id)
    setEditText(item.text)
  }

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return

    await updateItem(editingId, { text: editText.trim() })
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleKeyPress = (e: React.KeyboardEvent, action: 'create' | 'edit') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (action === 'create') {
        createItem()
      } else {
        saveEdit()
      }
    } else if (e.key === 'Escape') {
      if (action === 'create') {
        setIsAdding(false)
        setNewItemText('')
      } else {
        cancelEdit()
      }
    }
  }

  // Handle drag and drop reordering
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null)
      return
    }

    const draggedIndex = items.findIndex(item => item.id === draggedItem)
    const targetIndex = items.findIndex(item => item.id === targetItemId)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Create new order
    const newItems = [...items]
    const [draggedItemData] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, draggedItemData)

    // Update order values
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order: index
    }))

    onItemsChange(updatedItems)

    try {
      // Update order on server
      const response = await fetch('/api/design/checklist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId: draggedItem,
          order: targetIndex
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      toast.success('Checklist reordered')
    } catch (error) {
      // Revert on error
      onItemsChange(items)
      toast.error('Failed to reorder checklist')
    }

    setDraggedItem(null)
  }

  // Calculate completion stats
  const completedCount = items.filter(item => item.completed).length
  const totalCount = items.length
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // Sort items by order
  const sortedItems = [...items].sort((a, b) => a.order - b.order)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with stats */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {completedCount} of {totalCount} completed
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {Math.round(completionPercentage)}%
            </span>
          </div>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-2">
        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item.id)}
            className={`group flex items-center space-x-3 p-2 rounded-lg border transition-all duration-200 ${
              item.completed 
                ? 'bg-green-50 border-green-200' 
                : 'bg-white border-gray-200 hover:border-gray-300'
            } ${
              draggedItem === item.id ? 'opacity-50' : ''
            }`}
          >
            {/* Drag handle */}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 text-gray-400" />
            </button>

            {/* Checkbox */}
            <button
              onClick={() => toggleCompletion(item)}
              className="flex-shrink-0 transition-colors"
              disabled={isLoading}
            >
              {item.completed ? (
                <CheckSquare className="w-5 h-5 text-green-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              )}
            </button>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, 'edit')}
                  onBlur={saveEdit}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <span 
                  className={`text-sm ${
                    item.completed 
                      ? 'text-gray-500 line-through' 
                      : 'text-gray-900'
                  }`}
                  onDoubleClick={() => !item.completed && startEdit(item)}
                  title="Double-click to edit"
                >
                  {item.text}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingId === item.id ? (
                <>
                  <button
                    onClick={saveEdit}
                    className="p-1 text-green-600 hover:text-green-700"
                    title="Save changes"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Cancel editing"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit item"
                    disabled={item.completed}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                    title="Delete item"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {isAdding ? (
        <div className="flex items-center space-x-2 p-2 border border-blue-200 rounded-lg bg-blue-50">
          <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={newItemInputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => handleKeyPress(e, 'create')}
            placeholder="Add checklist item..."
            className="flex-1 px-2 py-1 text-sm border-0 bg-transparent focus:outline-none placeholder-gray-500"
          />
          <div className="flex items-center space-x-1">
            <button
              onClick={createItem}
              disabled={!newItemText.trim() || isLoading}
              className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
              title="Add item"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setNewItemText('')
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full text-xs border-dashed"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add checklist item
        </Button>
      )}

      {/* Empty state */}
      {totalCount === 0 && !isAdding && (
        <div className="text-center py-6">
          <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No checklist items yet</p>
          <p className="text-xs text-gray-400">Add items to track your progress</p>
        </div>
      )}
    </div>
  )
}
