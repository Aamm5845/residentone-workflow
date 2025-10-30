'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Import, 
  Plus, 
  Trash2, 
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Copy,
  RefreshCw,
  Edit,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Move
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRoomFFEInstance, useRoomFFEMutations, useFFEItemMutations, useFFETemplates } from '@/hooks/ffe/useFFEApi'
import { FFEItemState } from '@prisma/client'
import { toast } from 'react-hot-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FFESettingsPageClientProps {
  stageId: string
  roomId: string
  roomName: string
  roomType: string
  projectId: string
  projectName: string
  orgId: string
  onClose?: () => void
}

interface RoomFFEItem {
  id: string
  name: string
  description: string
  state: FFEItemState
  isRequired: boolean
  isCustom: boolean
  quantity: number
  unitCost: number
  totalCost: number
  notes: string
  sectionId: string
  sectionName: string
  order: number
}

export default function FFESettingsPageClient({
  stageId,
  roomId,
  roomName,
  roomType,
  projectId,
  projectName,
  orgId,
  onClose
}: FFESettingsPageClientProps) {
  const router = useRouter()
  
  // API hooks - Use the consistent instances endpoint
  const [instance, setInstance] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const { createRoomInstance } = useRoomFFEMutations()
  const { updateItemState, deleteItem, bulkDeleteItems, duplicateItem } = useFFEItemMutations()
  const { templates, isLoading: templatesLoading, error: templatesError } = useFFETemplates(orgId)
  
  // Manual revalidation function using the instances endpoint
  const revalidate = React.useCallback(async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/ffe/instances?roomId=${roomId}`)
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch instance')
      }
      
      setInstance(data.instance)
      setError(null)
      
    } catch (err) {
      console.error('❌ FFESettings: Error fetching FFE instance:', err)
      setError(err)
      setInstance(null)
    } finally {
      setIsLoading(false)
    }
  }, [roomId])
  
  // Load instance on mount
  useEffect(() => {
    
    revalidate()
  }, [revalidate])
  
  // Debug templates loading
  useEffect(() => {
    
  }, [templates, templatesLoading, templatesError, orgId])

  // Auto-expand sections when instance loads
  useEffect(() => {
    if (instance?.sections) {
      setExpandedSections(new Set(instance.sections.map(s => s.id)))
    }
  }, [instance])

  // Add keyboard shortcut for saving (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault()
        handleSaveAndClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty dependency array since handleSaveAndClose is stable
  
  // Local state
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState<FFEItemState | 'ALL'>('ALL')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [newSectionName, setNewSectionName] = useState('')
  const [newItemSectionId, setNewItemSectionId] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<RoomFFEItem | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemQuantity, setEditItemQuantity] = useState(1)
  const [editItemDescription, setEditItemDescription] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDeleteSectionDialog, setShowDeleteSectionDialog] = useState(false)
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null)
  const [deletingSectionName, setDeletingSectionName] = useState('')
  const [showMoveItemDialog, setShowMoveItemDialog] = useState(false)
  const [movingItem, setMovingItem] = useState<RoomFFEItem | null>(null)
  const [moveTargetSectionId, setMoveTargetSectionId] = useState('')
  
  // Flatten all items from all sections with section info
  const allItems: RoomFFEItem[] = React.useMemo(() => {
    if (!instance?.sections) return []
    
    return instance.sections.flatMap(section =>
      section.items.map(item => ({
        ...item,
        sectionName: section.name,
        sectionId: section.id
      }))
    )
  }, [instance])

  // Filter items based on search and state
  const filteredItems = React.useMemo(() => {
    let items = allItems
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.sectionName.toLowerCase().includes(query)
      )
    }
    
    // State filter
    if (filterState !== 'ALL') {
      items = items.filter(item => item.state === filterState)
    }
    
    return items
  }, [allItems, searchQuery, filterState])

  // Statistics
  const stats = React.useMemo(() => {
    const total = allItems.length
    const completed = allItems.filter(item => item.state === 'COMPLETED').length
    const selected = allItems.filter(item => item.state === 'SELECTED').length
    const confirmed = allItems.filter(item => item.state === 'CONFIRMED').length
    const notNeeded = allItems.filter(item => item.state === 'NOT_NEEDED').length
    const pending = total - completed - selected - confirmed - notNeeded
    
    return {
      total,
      completed,
      selected, 
      confirmed,
      notNeeded,
      pending,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }, [allItems])

  // Handle template import
  const handleTemplateImported = async () => {
    await revalidate()
    toast.success('Template imported successfully!')
  }

  // Handle section addition
  const handleSectionAdded = async (section: { name: string; description?: string; items: any[] }) => {
    try {
      if (!instance?.id) {
        throw new Error('FFE instance not available')
      }
      
      const response = await fetch(`/api/ffe/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: instance.id,
          name: section.name,
          description: section.description
        })
      })
      
      if (response.ok) {
        await revalidate()
        const result = await response.json()
        setHasUnsavedChanges(false) // Mark as saved
        toast.success(result.message || 'Section added successfully')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to add section`)
      }
    } catch (error) {
      console.error('Failed to add section:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add section')
    }
  }

  // Handle item addition
  const handleItemAdded = async (sectionId: string, item: { name: string; description?: string; quantity: number }) => {
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, ...item })
      })

      if (response.ok) {
        await revalidate()
        const result = await response.json()
        toast.success(result.message || 'Item(s) added successfully')
      } else {
        throw new Error('Failed to add item')
      }
    } catch (error) {
      console.error('Failed to add item:', error)
      toast.error('Failed to add item')
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedItems.length} item(s)? This action cannot be undone.`
    )
    
    if (!confirmed) return
    
    setIsDeleting(true)
    
    try {
      await bulkDeleteItems(roomId, selectedItems)
      await revalidate()
      setSelectedItems([])
      // Toast is already shown in the hook
    } catch (error) {
      console.error('Failed to delete items:', error)
      // Error toast is already shown in the hook
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle single item delete
  const handleDeleteItem = async (itemId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this item? This action cannot be undone.')
    if (!confirmed) return
    
    try {
      await deleteItem(roomId, itemId)
      await revalidate()
      toast.success('Item deleted successfully')
    } catch (error) {
      console.error('Failed to delete item:', error)
      toast.error('Failed to delete item')
    }
  }

  // Handle item duplication
  const handleDuplicateItem = async (itemId: string) => {
    try {
      await duplicateItem(roomId, itemId)
      await revalidate()
      toast.success('Item duplicated successfully')
    } catch (error) {
      console.error('Failed to duplicate item:', error)
      toast.error('Failed to duplicate item')
    }
  }

  // Handle instance reset
  const handleInstanceReset = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset this FFE instance? This will delete ALL items and sections. This action cannot be undone.'
    )
    
    if (!confirmed) return
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await revalidate()
        toast.success('FFE instance reset successfully')
      } else {
        throw new Error('Failed to reset instance')
      }
    } catch (error) {
      console.error('Failed to reset instance:', error)
      toast.error('Failed to reset instance')
    }
  }

  // Handle template import
  const handleImportTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template to import')
      return
    }

    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/import-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId })
      })

      if (response.ok) {
        const result = await response.json()
        
        await revalidate()
        setShowImportDialog(false)
        setSelectedTemplateId('')
        setHasUnsavedChanges(false) // Mark as saved
        toast.success('Template imported successfully!')
      } else {
        const errorData = await response.json()
        console.error('❌ Import failed with status', response.status, ':', errorData);
        throw new Error(errorData.error || `Failed to import template (${response.status})`)
      }
    } catch (error) {
      console.error('❌ Import error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import template'
      toast.error(errorMessage)
    }
  }

  // Handle section addition confirmation
  const handleAddSectionConfirm = async () => {
    if (!newSectionName.trim()) {
      toast.error('Section name is required')
      return
    }
    
    await handleSectionAdded({
      name: newSectionName,
      description: '',
      items: []
    })
    
    setNewSectionName('')
    setShowAddSectionDialog(false)
  }

  // Handle item addition confirmation
  const handleAddItemConfirm = async () => {
    if (!newItemSectionId || !newItemName.trim()) {
      toast.error('Section and item name are required')
      return
    }
    
    await handleItemAdded(newItemSectionId, {
      name: newItemName,
      description: '',
      quantity: newItemQuantity
    })
    
    setNewItemSectionId('')
    setNewItemName('')
    setNewItemQuantity(1)
    setShowAddItemDialog(false)
  }

  // Handle edit item
  const handleEditItem = (item: RoomFFEItem) => {
    setEditingItem(item)
    setEditItemName(item.name)
    setEditItemQuantity(item.quantity)
    setEditItemDescription(item.description || '')
    setShowEditItemDialog(true)
  }

  // Handle edit item confirmation
  const handleEditItemConfirm = async () => {
    if (!editingItem || !editItemName.trim()) {
      toast.error('Item name is required')
      return
    }
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editItemName,
          description: editItemDescription,
          quantity: editItemQuantity
        })
      })
      
      if (response.ok) {
        await revalidate()
        setShowEditItemDialog(false)
        setEditingItem(null)
        setEditItemName('')
        setEditItemQuantity(1)
        setEditItemDescription('')
        toast.success('Item updated successfully')
      } else {
        throw new Error('Failed to update item')
      }
    } catch (error) {
      console.error('Failed to update item:', error)
      toast.error('Failed to update item')
    }
  }

  // Handle section deletion
  const handleDeleteSection = (sectionId: string, sectionName: string) => {
    setDeletingSectionId(sectionId)
    setDeletingSectionName(sectionName)
    setShowDeleteSectionDialog(true)
  }

  const handleDeleteSectionConfirm = async () => {
    if (!deletingSectionId) return

    try {
      const response = await fetch(
        `/api/ffe/sections/${deletingSectionId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        const result = await response.json()
        await revalidate()
        setShowDeleteSectionDialog(false)
        setDeletingSectionId(null)
        setDeletingSectionName('')
        toast.success(result.message)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete section')
      }
    } catch (error) {
      console.error('Failed to delete section:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete section')
    }
  }

  // Handle item move
  const handleMoveItem = (item: RoomFFEItem) => {
    setMovingItem(item)
    setMoveTargetSectionId('')
    setShowMoveItemDialog(true)
  }

  const handleMoveItemConfirm = async () => {
    if (!movingItem || !moveTargetSectionId) {
      toast.error('Target section is required')
      return
    }

    try {
      const response = await fetch(
        `/api/ffe/v2/rooms/${roomId}/items/${movingItem.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetSectionId: moveTargetSectionId })
        }
      )

      if (response.ok) {
        const result = await response.json()
        await revalidate()
        setShowMoveItemDialog(false)
        setMovingItem(null)
        setMoveTargetSectionId('')
        toast.success(result.message)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to move item')
      }
    } catch (error) {
      console.error('Failed to move item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to move item')
    }
  }

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  // Toggle section expansion
  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId)
      } else {
        newExpanded.add(sectionId)
      }
      return newExpanded
    })
  }

  // Handle save and close
  const handleSaveAndClose = () => {
    if (hasUnsavedChanges) {
      toast.success('FFE settings saved successfully!')
      setHasUnsavedChanges(false)
    }
    
    if (onClose) {
      onClose()
    } else {
      // Navigate back to the main FFE workspace stage
      router.push(`/stages/${stageId}`)
    }
  }

  // Select all filtered items
  const handleSelectAll = () => {
    const filteredItemIds = filteredItems.map(item => item.id)
    if (selectedItems.length === filteredItemIds.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItemIds)
    }
  }

  // Get state color and icon
  const getStateInfo = (state: FFEItemState) => {
    switch (state) {
      case 'PENDING':
        return { color: 'bg-gray-500', icon: Clock, text: 'Pending' }
      case 'SELECTED':
        return { color: 'bg-blue-500', icon: Package, text: 'Selected' }
      case 'CONFIRMED':
        return { color: 'bg-yellow-500', icon: CheckCircle2, text: 'Confirmed' }
      case 'COMPLETED':
        return { color: 'bg-green-500', icon: CheckCircle2, text: 'Completed' }
      case 'NOT_NEEDED':
        return { color: 'bg-gray-300', icon: X, text: 'Not Needed' }
      default:
        return { color: 'bg-gray-500', icon: Clock, text: 'Unknown' }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading FFE settings...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading FFE Data</h3>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <Button onClick={() => revalidate()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Render dialogs at the top level so they're always available
  const dialogs = (
    <>
      {/* Template Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5" />
              Import FFE Template
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={templatesLoading ? "Loading templates..." : templates && templates.length > 0 ? "Choose a template..." : "No templates available"} />
                </SelectTrigger>
                <SelectContent>
                  {templatesLoading ? (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading templates...
                    </div>
                  ) : templatesError ? (
                    <div className="px-2 py-4 text-sm text-red-500 text-center">
                      <AlertTriangle className="h-4 w-4 mx-auto mb-2" />
                      Error loading templates
                    </div>
                  ) : (templates || []).length === 0 ? (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      No templates available for this organization
                    </div>
                  ) : (
                    (templates || []).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-gray-500">{template.description}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportTemplate} disabled={!selectedTemplateId}>
                <Import className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Section Name</label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Lighting, Furniture"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSectionConfirm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Item
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Section</label>
              <Select value={newItemSectionId} onValueChange={setNewItemSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose section..." />
                </SelectTrigger>
                <SelectContent>
                  {(instance?.sections || []).map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Item Name</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Pendant Light"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-20"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItemConfirm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Edit Item
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Item Name</label>
              <Input
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                placeholder="e.g., Pendant Light"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={editItemDescription}
                onChange={(e) => setEditItemDescription(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={editItemQuantity}
                onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 1)}
                className="w-20"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEditItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditItemConfirm}>
                <Package className="h-4 w-4 mr-2" />
                Update Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <Dialog open={showDeleteSectionDialog} onOpenChange={setShowDeleteSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Warning: Items will be deleted</span>
              </div>
              <p className="text-sm text-red-700">
                Deleting section "{deletingSectionName}" will permanently delete all items in this section. This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDeleteSectionDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteSectionConfirm}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Item Dialog */}
      <Dialog open={showMoveItemDialog} onOpenChange={setShowMoveItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-5 w-5" />
              Move Item
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {movingItem && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Moving: <span className="font-medium">{movingItem.name}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  From: {movingItem.sectionName}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Target Section</label>
              <Select value={moveTargetSectionId} onValueChange={setMoveTargetSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose target section..." />
                </SelectTrigger>
                <SelectContent>
                  {(instance?.sections || [])
                    .filter(s => s.id !== movingItem?.sectionId)
                    .map(section => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMoveItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleMoveItemConfirm} disabled={!moveTargetSectionId}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FFE Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {roomName} • {projectName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {instance && (
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Items</div>
            </div>
          )}
          <Button
            onClick={handleSaveAndClose}
            className={hasUnsavedChanges ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
            title="Save and return to workspace (Ctrl+S)"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {hasUnsavedChanges ? 'Save & Return' : 'Return to Workspace'}
          </Button>
        </div>
      </div>

      {/* Quick Actions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Start by importing a template for quick setup, or create your own sections from scratch.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => setShowImportDialog(true)} 
              className="h-auto p-4 flex-col space-y-2"
              variant="outline"
            >
              <Import className="h-6 w-6" />
              <span className="font-medium">Import Template</span>
              <span className="text-xs opacity-75">Pre-made sections & items</span>
            </Button>
            
            <Button 
              onClick={() => setShowAddSectionDialog(true)} 
              className="h-auto p-4 flex-col space-y-2"
              variant="outline"
            >
              <Plus className="h-6 w-6" />
              <span className="font-medium">Add Section</span>
              <span className="text-xs opacity-75">Create custom sections</span>
            </Button>
            
            <Button 
              onClick={() => setShowAddItemDialog(true)} 
              className="h-auto p-4 flex-col space-y-2"
              variant="outline"
              disabled={!instance || !instance.sections.length}
            >
              <Package className="h-6 w-6" />
              <span className="font-medium">Add Items</span>
              <span className="text-xs opacity-75">Add to existing sections</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Bar - Only show if items exist */}
      {instance && filteredItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value as FFEItemState | 'ALL')}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="ALL">All States</option>
                  <option value="PENDING">Pending</option>
                  <option value="SELECTED">Selected</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NOT_NEEDED">Not Needed</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar - Only show when items selected */}
      {selectedItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedItems.length} item(s) selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections with Items - Always show if sections exist */}
              <div className="space-y-4">
                {(() => {
                  
                  return null
                })()}
                {instance?.sections && instance.sections.length > 0 ? (
                  instance.sections.map((section) => {
                    
                    const sectionItems = filteredItems.filter(item => item.sectionId === section.id)
                    if (sectionItems.length === 0 && searchQuery.trim()) return null // Hide empty sections when filtering
                    
                    return (
                      <Card key={section.id}>
                        <CardHeader className="pb-3">
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleSectionExpanded(section.id)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedSections.has(section.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <CardTitle className="text-lg">{section.name}</CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {sectionItems.length} items
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const sectionItemIds = sectionItems.map(item => item.id)
                                  if (sectionItemIds.every(id => selectedItems.includes(id))) {
                                    setSelectedItems(prev => prev.filter(id => !sectionItemIds.includes(id)))
                                  } else {
                                    setSelectedItems(prev => [...new Set([...prev, ...sectionItemIds])])
                                  }
                                }}
                              >
                                {sectionItems.every(item => selectedItems.includes(item.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setNewItemSectionId(section.id)
                                  setShowAddItemDialog(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSection(section.id, section.name)
                                }}
                                className="text-red-600 hover:text-red-700 hover:border-red-300"
                                title="Delete section"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        {expandedSections.has(section.id) && (
                          <CardContent className="pt-0">
                            {sectionItems.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                No items in this section
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {sectionItems.map((item) => {
                                  const stateInfo = getStateInfo(item.state)
                                  const StateIcon = stateInfo.icon
                                  
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        "flex items-center space-x-3 p-3 rounded-lg border",
                                        selectedItems.includes(item.id)
                                          ? "border-blue-300 bg-blue-50"
                                          : "border-gray-200 hover:bg-gray-50"
                                      )}
                                    >
                                      <Checkbox
                                        checked={selectedItems.includes(item.id)}
                                        onCheckedChange={() => toggleItemSelection(item.id)}
                                      />
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="text-sm font-medium text-gray-900 truncate">
                                            {item.name}
                                          </h4>
                                          <Badge
                                            variant="secondary"
                                            className={cn(
                                              "text-white text-xs",
                                              stateInfo.color
                                            )}
                                          >
                                            <StateIcon className="h-3 w-3 mr-1" />
                                            {stateInfo.text}
                                          </Badge>
                                          {item.isRequired && (
                                            <Badge variant="destructive" className="text-xs">
                                              Required
                                            </Badge>
                                          )}
                                          {item.isCustom && (
                                            <Badge variant="outline" className="text-xs">
                                              Custom
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                          <span>Qty: {item.quantity}</span>
                                          {item.unitCost > 0 && (
                                            <span>Cost: ${item.unitCost}</span>
                                          )}
                                        </div>
                                        {item.description && (
                                          <p className="text-sm text-gray-600 mt-1 truncate">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditItem(item)}
                                          title="Edit item"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleMoveItem(item)}
                                          title="Move to another section"
                                          disabled={!instance?.sections || instance.sections.length <= 1}
                                        >
                                          <Move className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDuplicateItem(item.id)}
                                          title="Duplicate item"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteItem(item.id)}
                                          title="Delete item"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    )
                  })
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No Sections Yet
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Import a template or create sections to get started.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

      {dialogs}
    </div>
  )
}
