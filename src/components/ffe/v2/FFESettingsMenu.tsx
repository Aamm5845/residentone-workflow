'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Settings, 
  Import, 
  Plus, 
  FolderPlus,
  Package,
  ChevronDown,
  Save,
  X,
  Hash,
  StickyNote,
  Trash2,
  Copy,
  Edit,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { LinkedItemDisplay } from './FFESettingsMenuEnhanced'

interface FFESettingsMenuProps {
  roomId: string
  orgId: string
  onTemplateImported: () => void
  onSectionAdded: (section: { name: string; description?: string; items: any[] }) => void
  onItemAdded: (sectionId: string, item: { name: string; description?: string; quantity: number }) => void
  onInstanceReset: () => void
  availableTemplates: any[]
  currentSections: any[]
  onItemDeleted?: () => void
  onItemDuplicated?: () => void
}

export default function FFESettingsMenu({
  roomId,
  orgId,
  onTemplateImported,
  onSectionAdded,
  onItemAdded,
  onInstanceReset,
  availableTemplates,
  currentSections,
  onItemDeleted,
  onItemDuplicated
}: FFESettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showManageItemsDialog, setShowManageItemsDialog] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateData, setSelectedTemplateData] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  
  // Section form
  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: '',
    initialItems: [{ name: '', quantity: 1 }]
  })
  
  // Item form
  const [itemForm, setItemForm] = useState({
    sectionId: '',
    name: '',
    description: '',
    quantity: 1,
    notes: ''
  })
  
  // Load template data when template is selected
  const handleTemplateSelection = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) {
      setSelectedTemplateData(null)
      setSelectedItems(new Set())
      return
    }
    
    setIsLoadingTemplate(true)
    try {
      const response = await fetch(`/api/ffe/v2/templates/${templateId}`)
      if (response.ok) {
        const templateData = await response.json()
        setSelectedTemplateData(templateData)
        setSelectedItems(new Set()) // Clear previous selections
      } else {
        throw new Error('Failed to load template data')
      }
    } catch (error) {
      console.error('Failed to load template:', error)
      toast.error('Failed to load template data')
    } finally {
      setIsLoadingTemplate(false)
    }
  }
  
  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }
  
  // Select/deselect all items
  const toggleSelectAll = () => {
    if (!selectedTemplateData) return
    
    const allItemIds = selectedTemplateData.sections?.flatMap((section: any) => 
      section.items?.map((item: any) => item.id) || []
    ) || []
    
    const allSelected = allItemIds.every((id: string) => selectedItems.has(id))
    
    if (allSelected) {
      setSelectedItems(new Set()) // Deselect all
    } else {
      setSelectedItems(new Set(allItemIds)) // Select all
    }
  }
  
  // Template import handler
  const handleImportTemplate = async () => {
    if (!selectedTemplateId || selectedItems.size === 0) {
      toast.error('Please select items to import')
      return
    }
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/import-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          templateId: selectedTemplateId,
          selectedItemIds: Array.from(selectedItems)
        })
      })
      
      if (response.ok) {
        toast.success(`${selectedItems.size} items imported successfully!`)
        onTemplateImported()
        setShowImportDialog(false)
        setSelectedTemplateId('')
        setSelectedTemplateData(null)
        setSelectedItems(new Set())
        setIsOpen(false)
      } else {
        throw new Error('Failed to import template')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import template')
    }
  }
  
  // Add section handler
  const handleAddSection = async () => {
    if (!sectionForm.name.trim()) {
      toast.error('Section name is required')
      return
    }
    
    try {
      // Create items with quantities
      const items = sectionForm.initialItems
        .filter(item => item.name.trim())
        .flatMap(item => {
          const itemsArray = []
          for (let i = 1; i <= item.quantity; i++) {
            itemsArray.push({
              name: item.quantity > 1 ? `${item.name} #${i}` : item.name,
              description: sectionForm.description,
              defaultState: 'PENDING',
              isRequired: false,
              order: i
            })
          }
          return itemsArray
        })
      
      const newSection = {
        name: sectionForm.name,
        description: sectionForm.description,
        items
      }
      
      onSectionAdded(newSection)
      
      // Reset form
      setSectionForm({
        name: '',
        description: '',
        initialItems: [{ name: '', quantity: 1 }]
      })
      setShowAddSectionDialog(false)
      setIsOpen(false)
      toast.success(`Section "${newSection.name}" added with ${items.length} items`)
    } catch (error) {
      console.error('Add section error:', error)
      toast.error('Failed to add section')
    }
  }
  
  // Add item handler
  const handleAddItem = async () => {
    if (!itemForm.sectionId || !itemForm.name.trim()) {
      toast.error('Section and item name are required')
      return
    }
    
    try {
      onItemAdded(itemForm.sectionId, {
        name: itemForm.name,
        description: itemForm.description,
        quantity: itemForm.quantity
      })
      
      // Reset form
      setItemForm({
        sectionId: '',
        name: '',
        description: '',
        quantity: 1,
        notes: ''
      })
      setShowAddItemDialog(false)
      setIsOpen(false)
      toast.success(`Added "${itemForm.name}" ${itemForm.quantity > 1 ? `(${itemForm.quantity} items)` : ''}`)
    } catch (error) {
      console.error('Add item error:', error)
      toast.error('Failed to add item')
    }
  }
  
  // Add/remove initial items in section form
  const addInitialItem = () => {
    setSectionForm(prev => ({
      ...prev,
      initialItems: [...prev.initialItems, { name: '', quantity: 1 }]
    }))
  }
  
  const removeInitialItem = (index: number) => {
    setSectionForm(prev => ({
      ...prev,
      initialItems: prev.initialItems.filter((_, i) => i !== index)
    }))
  }
  
  const updateInitialItem = (index: number, field: string, value: any) => {
    setSectionForm(prev => ({
      ...prev,
      initialItems: prev.initialItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          {/* Import Template */}
          <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
            <Import className="h-4 w-4 mr-2" />
            Import Template
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Manual Additions */}
          <DropdownMenuItem onClick={() => setShowAddSectionDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Section
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowAddItemDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowManageItemsDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Manage Items
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Reset Instance */}
          <DropdownMenuItem 
            onClick={() => {
              if (confirm('Reset entire FFE instance? This will remove all data.')) {
                onInstanceReset()
                setIsOpen(false)
              }
            }}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Instance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import Template Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5" />
              Import FFE Template
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-select">Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-gray-500">{template.description}</div>
                        )}
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {template.sections?.length || 0} sections
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Template Items Selection */}
            {selectedTemplateData && (
              <div className="border rounded-lg">
                <div className="p-4 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Select Items to Import</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {selectedItems.size} of {selectedTemplateData.sections?.reduce((total: number, section: any) => total + (section.items?.length || 0), 0) || 0} items selected
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={toggleSelectAll}
                      >
                        {selectedTemplateData.sections?.flatMap((s: any) => s.items || []).every((item: any) => selectedItems.has(item.id)) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <ScrollArea className="max-h-96">
                  <div className="p-4 space-y-6">
                    {isLoadingTemplate ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Loading template items...</span>
                      </div>
                    ) : (
                      selectedTemplateData.sections?.map((section: any) => (
                        <div key={section.id} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium text-gray-900">{section.name}</h5>
                            <Badge variant="secondary" className="text-xs">
                              {section.items?.length || 0} items
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 ml-4">
                            {section.items?.map((item: any) => (
                              <LinkedItemDisplay
                                key={item.id}
                                item={item}
                                isSelected={selectedItems.has(item.id)}
                                onToggle={() => toggleItemSelection(item.id)}
                              />
                            )) || <div className="text-sm text-gray-500 italic">No items in this section</div>}
                          </div>
                        </div>
                      )) || <div className="text-center text-gray-500 py-4">No sections found in template</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              {selectedTemplateData ? (
                'Select the specific items you want to import from this template.'
              ) : (
                'Choose a template to see available items for import.'
              )}
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowImportDialog(false)
                setSelectedTemplateId('')
                setSelectedTemplateData(null)
                setSelectedItems(new Set())
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleImportTemplate} 
                disabled={!selectedTemplateId || selectedItems.size === 0}
              >
                <Import className="h-4 w-4 mr-2" />
                Import {selectedItems.size > 0 ? `${selectedItems.size} Items` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Add New Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Section Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="section-name">Section Name *</Label>
                <Input
                  id="section-name"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Lighting, Flooring, Furniture"
                />
              </div>
              
              <div>
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this section"
                  rows={2}
                />
              </div>
            </div>
            
            {/* Initial Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Initial Items</Label>
                <Button type="button" size="sm" onClick={addInitialItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {sectionForm.initialItems.map((item, index) => (
                  <div key={index} className="flex gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Input
                        value={item.name}
                        onChange={(e) => updateInitialItem(index, 'name', e.target.value)}
                        placeholder="Item name"
                        className="mb-2"
                      />
                    </div>
                    
                    <div className="w-24">
                      <div className="flex items-center gap-1">
                        <Hash className="h-4 w-4 text-gray-400" />
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={item.quantity}
                          onChange={(e) => updateInitialItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="text-center"
                        />
                      </div>
                    </div>
                    
                    {sectionForm.initialItems.length > 1 && (
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="ghost"
                        onClick={() => removeInitialItem(index)}
                        className="text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="text-sm text-gray-500 mt-2">
                Set quantity greater than 1 to create multiple trackable items (e.g., "Tiles" with quantity 3 creates "Tiles #1", "Tiles #2", "Tiles #3")
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSection}>
                <Save className="h-4 w-4 mr-2" />
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
              Add Item to Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="item-section">Section *</Label>
              <Select value={itemForm.sectionId} onValueChange={(value) => setItemForm(prev => ({ ...prev, sectionId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose section..." />
                </SelectTrigger>
                <SelectContent>
                  {currentSections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="item-name">Item Name *</Label>
              <Input
                id="item-name"
                value={itemForm.name}
                onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Pendant Light, Floor Tile"
              />
            </div>
            
            <div>
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="item-quantity">Quantity</Label>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <Input
                  id="item-quantity"
                  type="number"
                  min="1"
                  max="50"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">
                  {itemForm.quantity > 1 ? `Will create ${itemForm.quantity} separate items` : 'Single item'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem}>
                <Save className="h-4 w-4 mr-2" />
                Add Item{itemForm.quantity > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Items Dialog */}
      <Dialog open={showManageItemsDialog} onOpenChange={setShowManageItemsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Manage FFE Items
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Delete items you don't need or duplicate items for multiple quantities.
            </div>
            
            {currentSections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No items to manage yet.</p>
                <p className="text-sm">Import a template or add items manually first.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4">
                {currentSections.map(section => (
                  <div key={section.id} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <FolderPlus className="h-4 w-4" />
                      {section.name}
                      <Badge variant="outline" className="text-xs">
                        {section.items?.length || 0} items
                      </Badge>
                    </h4>
                    
                    {!section.items || section.items.length === 0 ? (
                      <p className="text-sm text-gray-500">No items in this section</p>
                    ) : (
                      <div className="space-y-2">
                        {section.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-gray-600">{item.description}</div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDuplicateItem(item.id, item.name)}
                                className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Duplicate
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowManageItemsDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  // Handle duplicate item
  async function handleDuplicateItem(itemId: string, itemName: string) {
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        toast.success(`Duplicated "${itemName}"`)
        onItemDuplicated?.()
      } else {
        throw new Error('Failed to duplicate item')
      }
    } catch (error) {
      console.error('Duplicate error:', error)
      toast.error('Failed to duplicate item')
    }
  }

  // Handle delete item
  async function handleDeleteItem(itemId: string, itemName: string) {
    if (!confirm(`Delete "${itemName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items?itemId=${itemId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(`Deleted "${itemName}"`)
        onItemDeleted?.()
      } else {
        throw new Error('Failed to delete item')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete item')
    }
  }
}
