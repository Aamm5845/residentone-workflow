'use client'

import React, { useState } from 'react'
import { 
  Plus, 
  GripVertical, 
  Pencil, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Save,
  X,
  ArrowLeft,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'

interface Category {
  id: string
  key: string
  name: string
  icon?: string | null
  order: number
  isDefault: boolean
  isActive: boolean
}

interface LibraryItem {
  id: string
  name: string
  category: string
  description?: string | null
  icon?: string | null
  order: number
  isActive: boolean
}

interface Props {
  initialCategories: Category[]
  initialItemsByCategory: Record<string, LibraryItem[]>
}

export default function ItemLibrarySettings({ initialCategories, initialItemsByCategory }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, LibraryItem[]>>(initialItemsByCategory)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(initialCategories.map(c => c.key)))
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showNewItem, setShowNewItem] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<{id: string, category: string} | null>(null)
  const [saving, setSaving] = useState(false)

  // Toggle category expansion
  const toggleCategory = (key: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedCategories(newExpanded)
  }

  // Add new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings/item-library/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (!response.ok) throw new Error('Failed to create category')
      
      const newCategory = await response.json()
      setCategories([...categories, newCategory])
      setItemsByCategory({ ...itemsByCategory, [newCategory.key]: [] })
      setExpandedCategories(new Set([...expandedCategories, newCategory.key]))
      setNewCategoryName('')
      setShowNewCategory(false)
      toast.success('Category created')
    } catch (error) {
      toast.error('Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  // Update category
  const handleUpdateCategory = async (categoryId: string, name: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/settings/item-library/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })

      if (!response.ok) throw new Error('Failed to update category')
      
      const updatedCategory = await response.json()
      setCategories(categories.map(c => c.id === categoryId ? updatedCategory : c))
      setEditingCategory(null)
      toast.success('Category updated')
    } catch (error) {
      toast.error('Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  // Delete category
  const handleDeleteCategory = async (categoryId: string, categoryKey: string) => {
    const itemCount = itemsByCategory[categoryKey]?.length || 0
    if (itemCount > 0) {
      if (!confirm(`This category has ${itemCount} items. Delete anyway?`)) return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/settings/item-library/categories/${categoryId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete category')
      
      setCategories(categories.filter(c => c.id !== categoryId))
      const newItems = { ...itemsByCategory }
      delete newItems[categoryKey]
      setItemsByCategory(newItems)
      toast.success('Category deleted')
    } catch (error) {
      toast.error('Failed to delete category')
    } finally {
      setSaving(false)
    }
  }

  // Add new item
  const handleAddItem = async (categoryKey: string) => {
    if (!newItemName.trim()) {
      toast.error('Please enter an item name')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings/item-library/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newItemName.trim(),
          category: categoryKey,
          description: newItemDescription.trim() || null
        })
      })

      if (!response.ok) throw new Error('Failed to create item')
      
      const newItem = await response.json()
      setItemsByCategory({
        ...itemsByCategory,
        [categoryKey]: [...(itemsByCategory[categoryKey] || []), newItem]
      })
      setNewItemName('')
      setNewItemDescription('')
      setShowNewItem(null)
      toast.success('Item created')
    } catch (error) {
      toast.error('Failed to create item')
    } finally {
      setSaving(false)
    }
  }

  // Update item
  const handleUpdateItem = async (itemId: string, updates: { name?: string, description?: string }) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/settings/item-library/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update item')
      
      const updatedItem = await response.json()
      setItemsByCategory({
        ...itemsByCategory,
        [updatedItem.category]: itemsByCategory[updatedItem.category].map(
          item => item.id === itemId ? updatedItem : item
        )
      })
      setEditingItem(null)
      toast.success('Item updated')
    } catch (error) {
      toast.error('Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  // Delete item
  const handleDeleteItem = async (itemId: string, categoryKey: string) => {
    if (!confirm('Delete this item?')) return

    setSaving(true)
    try {
      const response = await fetch(`/api/settings/item-library/items/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete item')
      
      setItemsByCategory({
        ...itemsByCategory,
        [categoryKey]: itemsByCategory[categoryKey].filter(item => item.id !== itemId)
      })
      toast.success('Item deleted')
    } catch (error) {
      toast.error('Failed to delete item')
    } finally {
      setSaving(false)
    }
  }

  // Category drag handlers
  const handleCategoryDragStart = (e: React.DragEvent, categoryKey: string) => {
    setDraggedCategory(categoryKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCategoryDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    if (!draggedCategory || draggedCategory === targetKey) return
  }

  const handleCategoryDrop = async (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    if (!draggedCategory || draggedCategory === targetKey) return

    const draggedIndex = categories.findIndex(c => c.key === draggedCategory)
    const targetIndex = categories.findIndex(c => c.key === targetKey)

    const newCategories = [...categories]
    const [removed] = newCategories.splice(draggedIndex, 1)
    newCategories.splice(targetIndex, 0, removed)

    // Update order values
    const reordered = newCategories.map((cat, idx) => ({ ...cat, order: idx }))
    setCategories(reordered)
    setDraggedCategory(null)

    // Save order to backend
    try {
      await fetch('/api/settings/item-library/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          categoryIds: reordered.map(c => c.id)
        })
      })
    } catch (error) {
      toast.error('Failed to save order')
    }
  }

  // Item drag handlers
  const handleItemDragStart = (e: React.DragEvent, itemId: string, categoryKey: string) => {
    setDraggedItem({ id: itemId, category: categoryKey })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleItemDrop = async (e: React.DragEvent, targetItemId: string, targetCategory: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetItemId) {
      setDraggedItem(null)
      return
    }

    const sourceCategory = draggedItem.category
    const sourceItems = [...(itemsByCategory[sourceCategory] || [])]
    const targetItems = sourceCategory === targetCategory 
      ? sourceItems 
      : [...(itemsByCategory[targetCategory] || [])]

    const draggedIndex = sourceItems.findIndex(i => i.id === draggedItem.id)
    const targetIndex = targetItems.findIndex(i => i.id === targetItemId)

    if (sourceCategory === targetCategory) {
      // Reorder within same category
      const [removed] = sourceItems.splice(draggedIndex, 1)
      sourceItems.splice(targetIndex, 0, removed)
      
      const reordered = sourceItems.map((item, idx) => ({ ...item, order: idx }))
      setItemsByCategory({ ...itemsByCategory, [sourceCategory]: reordered })

      // Save to backend
      try {
        await fetch('/api/settings/item-library/items/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category: sourceCategory,
            itemIds: reordered.map(i => i.id)
          })
        })
      } catch (error) {
        toast.error('Failed to save order')
      }
    } else {
      // Move to different category
      const [removed] = sourceItems.splice(draggedIndex, 1)
      removed.category = targetCategory
      targetItems.splice(targetIndex, 0, removed)

      setItemsByCategory({
        ...itemsByCategory,
        [sourceCategory]: sourceItems,
        [targetCategory]: targetItems.map((item, idx) => ({ ...item, order: idx }))
      })

      // Save to backend
      try {
        await fetch(`/api/settings/item-library/items/${draggedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: targetCategory })
        })
      } catch (error) {
        toast.error('Failed to move item')
      }
    }

    setDraggedItem(null)
  }

  // Handle dropping item on category (move to end)
  const handleDropOnCategory = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.category === targetCategory) {
      setDraggedItem(null)
      return
    }

    const sourceItems = [...(itemsByCategory[draggedItem.category] || [])]
    const targetItems = [...(itemsByCategory[targetCategory] || [])]

    const draggedIndex = sourceItems.findIndex(i => i.id === draggedItem.id)
    const [removed] = sourceItems.splice(draggedIndex, 1)
    removed.category = targetCategory
    targetItems.push(removed)

    setItemsByCategory({
      ...itemsByCategory,
      [draggedItem.category]: sourceItems,
      [targetCategory]: targetItems.map((item, idx) => ({ ...item, order: idx }))
    })

    // Save to backend
    try {
      await fetch(`/api/settings/item-library/items/${draggedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: targetCategory })
      })
      toast.success('Item moved')
    } catch (error) {
      toast.error('Failed to move item')
    }

    setDraggedItem(null)
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/stages" 
        className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Stages
      </Link>

      {/* Add Category Button */}
      <div className="flex justify-end">
        {showNewCategory ? (
          <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={saving} size="sm">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNewCategory(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowNewCategory(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.key)
          const categoryItems = itemsByCategory[category.key] || []

          return (
            <div
              key={category.id}
              className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                draggedCategory === category.key ? 'opacity-50' : ''
              } ${draggedItem ? 'border-dashed border-indigo-300' : 'border-gray-200'}`}
              draggable
              onDragStart={(e) => handleCategoryDragStart(e, category.key)}
              onDragOver={(e) => handleCategoryDragOver(e, category.key)}
              onDrop={(e) => {
                if (draggedCategory) {
                  handleCategoryDrop(e, category.key)
                } else if (draggedItem) {
                  handleDropOnCategory(e, category.key)
                }
              }}
              onDragEnd={() => {
                setDraggedCategory(null)
                setDraggedItem(null)
              }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-200">
                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab flex-shrink-0" />
                
                <button
                  onClick={() => toggleCategory(category.key)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  )}
                </button>

                {editingCategory === category.id ? (
                  <input
                    type="text"
                    defaultValue={category.name}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                    onBlur={(e) => handleUpdateCategory(category.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateCategory(category.id, e.currentTarget.value)
                      } else if (e.key === 'Escape') {
                        setEditingCategory(null)
                      }
                    }}
                  />
                ) : (
                  <h3 className="flex-1 font-semibold text-gray-900">
                    {category.name}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({categoryItems.length} items)
                    </span>
                  </h3>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingCategory(category.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    title="Edit category"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!category.isDefault && (
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.key)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Items */}
              {isExpanded && (
                <div className="p-4 space-y-2">
                  {categoryItems.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No items in this category. Add one below.
                    </p>
                  ) : (
                    categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all ${
                          draggedItem?.id === item.id ? 'opacity-50' : ''
                        }`}
                        draggable
                        onDragStart={(e) => handleItemDragStart(e, item.id, category.key)}
                        onDragOver={handleItemDragOver}
                        onDrop={(e) => handleItemDrop(e, item.id, category.key)}
                        onDragEnd={() => setDraggedItem(null)}
                      >
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
                        
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                          <Package className="w-4 h-4 text-gray-500" />
                        </div>

                        {editingItem === item.id ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={item.name}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                              onBlur={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateItem(item.id, { name: e.currentTarget.value })
                                } else if (e.key === 'Escape') {
                                  setEditingItem(null)
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 truncate">{item.description}</p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                            title="Edit item"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, category.key)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add Item Form */}
                  {showNewItem === category.key ? (
                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Item name..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder="Description (optional)..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setShowNewItem(null)
                            setNewItemName('')
                            setNewItemDescription('')
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleAddItem(category.key)}
                          disabled={saving || !newItemName.trim()}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewItem(category.key)}
                      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
          <p className="text-gray-500 mb-4">Create your first category to start building your item library.</p>
          <Button onClick={() => setShowNewCategory(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      )}
    </div>
  )
}

