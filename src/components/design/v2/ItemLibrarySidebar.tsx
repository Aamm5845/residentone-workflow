'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Plus, 
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  Pencil,
  Trash2
} from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import IconSelector from './IconSelector'
import DynamicIcon from './DynamicIcon'

interface Props {
  stageId: string
  onItemAdded: () => void
  addedItemIds: string[]
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// Default category names (fallback if API fails)
const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  furniture: 'Furniture',
  plumbing: 'Plumbing Fixtures',
  lighting: 'Lighting',
  textiles: 'Textiles & Soft Goods',
  decor: 'Decor & Accessories',
  appliances: 'Appliances',
  hardware: 'Hardware & Details',
  materials: 'Materials & Finishes'
}

export default function ItemLibrarySidebar({ stageId, onItemAdded, addedItemIds }: Props) {
  const [search, setSearch] = useState('')
  // Start with all categories collapsed by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [addingItemId, setAddingItemId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showIconSelector, setShowIconSelector] = useState(false)
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false)
  const [iconSelectorFor, setIconSelectorFor] = useState<'create' | 'edit' | 'category'>('create')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'furniture',
    description: '',
    icon: 'Package'
  })
  const [newCategory, setNewCategory] = useState({
    key: '',
    name: '',
    icon: 'Package'
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  // Fetch library
  const { data, error, isLoading, mutate: refreshLibrary } = useSWR('/api/design-concept/library', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 0 // Disable cache to get fresh data
  })

  // Fetch categories from database
  const { data: categoriesData, mutate: refreshCategories } = useSWR('/api/design-concept/categories', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  const categories = data?.categories || {}
  const items = data?.items || []
  const categoryMap = categoriesData?.categoryMap || DEFAULT_CATEGORY_NAMES
  const availableCategories = categoriesData?.categories || []

  // Filter items by search
  const filteredCategories = useMemo(() => {
    if (!search) return categories

    const filtered: Record<string, any[]> = {}
    Object.entries(categories).forEach(([category, categoryItems]: [string, any]) => {
      const matchingItems = categoryItems.filter((item: any) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase())
      )
      if (matchingItems.length > 0) {
        filtered[category] = matchingItems
      }
    })
    return filtered
  }, [categories, search])

  // Toggle category
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Create new category
  const createCategory = async () => {
    if (!newCategory.key || !newCategory.name) {
      toast.error('Key and name are required')
      return
    }

    setIsCreatingCategory(true)
    try {
      const response = await fetch('/api/design-concept/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create category')
      }

      const createdCategory = await response.json()
      toast.success(`Category "${createdCategory.name}" created successfully`)
      
      // Reset form and close dialog
      setNewCategory({ key: '', name: '', icon: 'Package' })
      setShowCreateCategoryDialog(false)
      
      // Refresh categories and library
      await refreshCategories()
      await refreshLibrary()
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    } finally {
      setIsCreatingCategory(false)
    }
  }

  // Create new library item
  const createLibraryItem = async () => {
    if (!newItem.name || !newItem.category) {
      toast.error('Name and category are required')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/design-concept/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create item')
      }

      const createdItem = await response.json()
      toast.success(`${createdItem.name} added to library`)
      
      // Reset form and close dialog
      setNewItem({ name: '', category: 'furniture', description: '', icon: '' })
      setShowCreateDialog(false)
      
      // Refresh library data
      await refreshLibrary()
    } catch (error) {
      console.error('Error creating library item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create item')
    } finally {
      setIsCreating(false)
    }
  }

  // Edit existing library item
  const updateLibraryItem = async () => {
    if (!editingItem?.name || !editingItem?.category) {
      toast.error('Name and category are required')
      return
    }

    setIsEditing(true)
    try {
      const response = await fetch(`/api/design-concept/library/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingItem.name,
          category: editingItem.category,
          description: editingItem.description,
          icon: editingItem.icon
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update item')
      }

      toast.success(`${editingItem.name} updated successfully`)
      
      // Close dialog and refresh
      setShowEditDialog(false)
      setEditingItem(null)
      await refreshLibrary()
    } catch (error) {
      console.error('Error updating library item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update item')
    } finally {
      setIsEditing(false)
    }
  }

  // Open edit dialog
  const startEditing = (item: any) => {
    setEditingItem({ ...item })
    setShowEditDialog(true)
  }

  // Delete library item
  const deleteLibraryItem = async (item: any) => {
    const confirmMsg = `Are you sure you want to permanently delete "${item.name}"?\n\nThis will remove it from the library for ALL future rooms and projects.\n\nThis action cannot be undone.`
    
    if (!confirm(confirmMsg)) return

    try {
      const response = await fetch(`/api/design-concept/library/${item.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.usageCount) {
          toast.error(`Cannot delete: This item is currently being used in ${data.usageCount} design concept(s)`)
        } else {
          throw new Error(data.error || 'Failed to delete item')
        }
        return
      }

      toast.success(`"${item.name}" permanently deleted`)
      await refreshLibrary()
    } catch (error) {
      console.error('Error deleting library item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete item')
    }
  }

  // Add item to stage
  const addItem = async (libraryItemId: string, itemName: string) => {
    setAddingItemId(libraryItemId)
    try {
      const response = await fetch(`/api/stages/${stageId}/design-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryItemId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add item')
      }

      toast.success(`${itemName} added to design concept`)
      onItemAdded()
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add item')
    } finally {
      setAddingItemId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-600 text-sm">Failed to load library</p>
          <Button size="sm" onClick={() => window.location.reload()} className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Item Library</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="mt-2 text-xs text-gray-500">
          {items.length} items • {Object.keys(filteredCategories).length} categories
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(filteredCategories).length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500 text-sm">No items found</p>
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(filteredCategories).map(([category, categoryItems]: [string, any]) => {
              const isExpanded = expandedCategories.has(category)
              const categoryInfo = availableCategories.find((c: any) => c.key === category)
              const categoryName = categoryInfo?.name || categoryMap[category] || category

              return (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-medium text-gray-900 text-sm">
                        {categoryName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {categoryItems.length}
                    </span>
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="pb-2">
                      {categoryItems.map((item: any) => {
                        const isAdded = addedItemIds.includes(item.id)
                        const isAdding = addingItemId === item.id
                        const addedCount = addedItemIds.filter(id => id === item.id).length

                        return (
                          <div
                            key={item.id}
                            className="px-4 py-2 hover:bg-gray-50 flex items-center justify-between group"
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg">
                                <DynamicIcon name={item.icon || 'Package'} className="w-5 h-5 text-gray-700" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {item.name}
                                  </p>
                                  {isAdded && (
                                    <span className="flex-shrink-0 flex items-center space-x-1 text-xs text-indigo-600">
                                      <Check className="w-3 h-3" />
                                      {addedCount > 1 && <span>×{addedCount}</span>}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-gray-500 truncate">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteLibraryItem(item)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 hover:bg-red-50"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditing(item)
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                                title="Edit item"
                              >
                                <Pencil className="w-3 h-3 text-gray-600" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => addItem(item.id, item.name)}
                                disabled={isAdding}
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 hover:bg-indigo-700 text-white h-7 w-7 p-0"
                                title="Add to design"
                              >
                                {isAdding ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Plus className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Item
        </Button>
        <p className="text-xs text-gray-600 text-center">
          Custom items will be available in all rooms
        </p>
      </div>

      {/* Edit Item Dialog */}
      {showEditDialog && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Edit Library Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="e.g., Custom Sofa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {availableCategories.map((cat: any) => (
                    <option key={cat.key} value={cat.key}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIconSelectorFor('edit')
                    setShowIconSelector(true)
                  }}
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                      <DynamicIcon name={editingItem.icon || 'Package'} className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {editingItem.icon || 'Select Icon'}
                      </div>
                      <div className="text-xs text-gray-500">Click to change</div>
                    </div>
                  </div>
                </Button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <Button 
                onClick={updateLibraryItem} 
                disabled={isEditing || !editingItem.name}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingItem(null)
                }} 
                className="flex-1"
                disabled={isEditing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Item Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create Custom Library Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g., Custom Sofa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <div className="flex gap-2">
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {availableCategories.map((cat: any) => (
                      <option key={cat.key} value={cat.key}>{cat.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateCategoryDialog(true)}
                    className="px-3"
                    title="Add new category"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIconSelectorFor('create')
                    setShowIconSelector(true)
                  }}
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                      <DynamicIcon name={newItem.icon || 'Package'} className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {newItem.icon || 'Select Icon'}
                      </div>
                      <div className="text-xs text-gray-500">Click to browse 1000+ icons</div>
                    </div>
                  </div>
                </Button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <Button 
                onClick={createLibraryItem} 
                disabled={isCreating || !newItem.name}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Item'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewItem({ name: '', category: 'furniture', description: '', icon: 'Package' })
                }}
                className="flex-1"
                disabled={isCreating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Category Dialog */}
      {showCreateCategoryDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateCategoryDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create New Category</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Key *</label>
                <input
                  type="text"
                  value={newCategory.key}
                  onChange={(e) => setNewCategory({ ...newCategory, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  placeholder="e.g., custom_category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and underscores only</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Custom Category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIconSelectorFor('category')
                    setShowIconSelector(true)
                  }}
                  className="w-full justify-start h-auto py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                      <DynamicIcon name={newCategory.icon || 'Package'} className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        {newCategory.icon || 'Select Icon'}
                      </div>
                      <div className="text-xs text-gray-500">Click to browse 1000+ icons</div>
                    </div>
                  </div>
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <Button 
                onClick={createCategory} 
                disabled={isCreatingCategory || !newCategory.key || !newCategory.name}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isCreatingCategory ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Category'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateCategoryDialog(false)
                  setNewCategory({ key: '', name: '', icon: 'Package' })
                }}
                className="flex-1"
                disabled={isCreatingCategory}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Icon Selector */}
      {showIconSelector && (
        <IconSelector
          value={
            iconSelectorFor === 'create' ? newItem.icon : 
            iconSelectorFor === 'edit' ? (editingItem?.icon || '') :
            newCategory.icon
          }
          onChange={(iconName) => {
            if (iconSelectorFor === 'create') {
              setNewItem({ ...newItem, icon: iconName })
            } else if (iconSelectorFor === 'edit') {
              setEditingItem({ ...editingItem, icon: iconName })
            } else {
              setNewCategory({ ...newCategory, icon: iconName })
            }
          }}
          onClose={() => setShowIconSelector(false)}
        />
      )}
    </div>
  )
}
