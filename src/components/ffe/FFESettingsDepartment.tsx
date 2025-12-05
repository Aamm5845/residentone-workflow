'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  FolderPlus, 
  RefreshCw, 
  Eye,
  EyeOff,
  ChevronRight,
  X,
  Import,
  AlertTriangle,
  Trash2,
  Package,
  Link,
  Sparkles
} from 'lucide-react'
import AIGenerateFFEDialog from './AIGenerateFFEDialog'
import { Checkbox } from '@/components/ui/checkbox'
import toast from 'react-hot-toast'
import FFEItemCard, { FFEItemState, FFEItemVisibility } from './common/FFEItemCard'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: FFEItemState
  visibility: FFEItemVisibility
  notes?: string
  isRequired: boolean
  isCustom: boolean
  quantity: number
  order: number
  customFields?: any
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  items: FFEItem[]
}

interface FFESettingsDepartmentProps {
  roomId: string
  roomName: string
  orgId?: string
  projectId?: string
  projectName?: string
  disabled?: boolean
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
}

export default function FFESettingsDepartment({ 
  roomId, 
  roomName, 
  orgId, 
  projectId, 
  projectName,
  disabled = false, 
  onProgressUpdate 
}: FFESettingsDepartmentProps) {
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  // Dialog states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showAIGenerateDialog, setShowAIGenerateDialog] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  
  // Template states
  const [templates, setTemplates] = useState<any[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<any>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Form states
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionDescription, setNewSectionDescription] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemLinkedItems, setNewItemLinkedItems] = useState<string[]>([])
  const [linkedItemInputValue, setLinkedItemInputValue] = useState('')
  
  // Linked items dialog state
  const [showAddLinkedItemDialog, setShowAddLinkedItemDialog] = useState(false)
  const [linkedItemDialogState, setLinkedItemDialogState] = useState<{
    parentId: string
    parentName: string
    existingLinkedItems: string[]
  } | null>(null)
  const [newLinkedItemName, setNewLinkedItemName] = useState('')

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    visibleItems: 0,
    hiddenItems: 0,
    sectionsCount: 0
  })

  // Load FFE data
  useEffect(() => {
    loadFFEData()
    loadTemplates()
  }, [roomId, orgId])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}?includeHidden=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch FFE data')
      }

      const result = await response.json()
      if (result.success && result.data) {
        const ffeData = result.data
        setSections(ffeData.sections || [])
        calculateStats(ffeData.sections || [])
      } else {
        setSections([])
        setStats({
          totalItems: 0,
          visibleItems: 0,
          hiddenItems: 0,
          sectionsCount: 0
        })
      }

    } catch (error) {
      console.error('Error loading FFE data:', error)
      toast.error('Failed to load FFE data')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    if (!orgId) return
    
    try {
      setTemplatesLoading(true)
      setTemplatesError(null)
      
      const response = await fetch(`/api/ffe/v2/templates?orgId=${orgId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      
      const result = await response.json()
      if (result.success) {
        setTemplates(result.data || [])
      } else {
        throw new Error(result.error || 'Failed to load templates')
      }
      
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplatesError(error)
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }

  const calculateStats = (sectionsData: FFESection[]) => {
    const allItems = sectionsData.flatMap(section => section.items)
    const stats = {
      totalItems: allItems.length,
      visibleItems: allItems.filter(item => item.visibility === 'VISIBLE').length,
      hiddenItems: allItems.filter(item => item.visibility === 'HIDDEN').length,
      sectionsCount: sectionsData.length
    }
    setStats(stats)
    
    if (onProgressUpdate) {
      const completedItems = allItems.filter(item => 
        item.visibility === 'VISIBLE' && item.state === 'COMPLETED'
      ).length
      const visibleItems = allItems.filter(item => item.visibility === 'VISIBLE').length
      const progress = visibleItems > 0 ? (completedItems / visibleItems) * 100 : 0
      const isComplete = progress === 100
      onProgressUpdate(progress, isComplete)
    }
  }

  const handleVisibilityChange = async (itemId: string, newVisibility: FFEItemVisibility) => {
    const previousSections = sections
    setSections(prevSections => 
      prevSections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.id === itemId 
            ? { ...item, visibility: newVisibility }
            : item
        )
      }))
    )
    
    const updatedSections = sections.map(section => ({
      ...section,
      items: section.items.map(item => 
        item.id === itemId 
          ? { ...item, visibility: newVisibility }
          : item
      )
    }))
    calculateStats(updatedSections)
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      })

      if (!response.ok) {
        throw new Error('Failed to update item visibility')
      }

    } catch (error) {
      console.error('Error updating item visibility:', error)
      setSections(previousSections)
      calculateStats(previousSections)
      throw error
    }
  }

  const handleStateChange = async (itemId: string, newState: FFEItemState) => {
    try {
      setSaving(true)

      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId,
          state: newState
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update item state')
      }

      setSections(prevSections => 
        prevSections.map(section => ({
          ...section,
          items: section.items.map(item => 
            item.id === itemId 
              ? { ...item, state: newState }
              : item
          )
        }))
      )

    } catch (error) {
      console.error('Error updating item state:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleNotesChange = async (itemId: string, notes: string) => {
    try {
      setSaving(true)

      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemId,
          notes: notes
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update item notes')
      }

      setSections(prevSections => 
        prevSections.map(section => ({
          ...section,
          items: section.items.map(item => 
            item.id === itemId 
              ? { ...item, notes: notes }
              : item
          )
        }))
      )

    } catch (error) {
      console.error('Error updating item notes:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleAddSection = async () => {
    if (!newSectionName.trim()) {
      toast.error('Section name is required')
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSectionName.trim(),
          description: newSectionDescription.trim() || undefined,
          order: sections.length
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add section')
      }

      const result = await response.json()
      if (result.success) {
        await loadFFEData()
        setShowAddSectionDialog(false)
        setNewSectionName('')
        setNewSectionDescription('')
        toast.success('Section added')
      }

    } catch (error) {
      console.error('Error adding section:', error)
      toast.error('Failed to add section')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemName.trim() || !selectedSectionId) {
      toast.error('Item name and section are required')
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          name: newItemName.trim(),
          description: newItemDescription.trim() || undefined,
          quantity: newItemQuantity,
          visibility: 'HIDDEN'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add item')
      }

      const result = await response.json()
      if (result.success) {
        const createdItems = result.data
        const parentItem = createdItems[0]
        
        if (newItemLinkedItems.length > 0) {
          for (const linkedItemName of newItemLinkedItems) {
            try {
              const linkResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${parentItem.id}/linked-items`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'add',
                  name: linkedItemName
                })
              })
              
              if (!linkResponse.ok) {
                console.error(`Failed to add linked item: ${linkedItemName}`)
              }
            } catch (error) {
              console.error(`Error adding linked item: ${linkedItemName}`, error)
            }
          }
        }
        
        await loadFFEData()
        setShowAddItemDialog(false)
        setNewItemName('')
        setNewItemDescription('')
        setNewItemQuantity(1)
        setNewItemLinkedItems([])
        setLinkedItemInputValue('')
        setSelectedSectionId('')
        toast.success('Item added')
      }

    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? { ...section, isExpanded: !section.isExpanded }
          : section
      )
    )
  }
  
  const getLinkedChildrenIds = (parentItemName: string, sectionItems: any[]): string[] => {
    const children = sectionItems.filter(child =>
      child.customFields?.isLinkedItem && 
      child.customFields?.parentName === parentItemName
    )
    return children.map(child => child.id)
  }
  
  const addLinkedItemToForm = () => {
    const trimmed = linkedItemInputValue.trim()
    if (!trimmed) {
      toast.error('Please enter a linked item name')
      return
    }
    
    if (trimmed.length > 200) {
      toast.error('Linked item name must be 200 characters or less')
      return
    }
    
    if (newItemLinkedItems.includes(trimmed)) {
      toast.error('This linked item already exists')
      return
    }
    
    setNewItemLinkedItems(prev => [...prev, trimmed])
    setLinkedItemInputValue('')
  }
  
  const removeLinkedItemFromForm = (index: number) => {
    setNewItemLinkedItems(prev => prev.filter((_, i) => i !== index))
  }
  
  const handleOpenLinkedItemDialog = (item: FFEItem) => {
    const existingLinkedItems = (item as any).customFields?.linkedItems || []
    setLinkedItemDialogState({
      parentId: item.id,
      parentName: item.name,
      existingLinkedItems
    })
    setNewLinkedItemName('')
    setShowAddLinkedItemDialog(true)
  }
  
  const handleAddLinkedItem = async () => {
    if (!linkedItemDialogState || !newLinkedItemName.trim()) {
      toast.error('Please enter a linked item name')
      return
    }
    
    if (newLinkedItemName.length > 200) {
      toast.error('Linked item name must be 200 characters or less')
      return
    }
    
    if (linkedItemDialogState.existingLinkedItems.includes(newLinkedItemName.trim())) {
      toast.error('This linked item already exists')
      return
    }
    
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${linkedItemDialogState.parentId}/linked-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: newLinkedItemName.trim()
        })
      })
      
      if (response.ok) {
        toast.success(`Added linked item`)
        setNewLinkedItemName('')
        await loadFFEData()
        setShowAddLinkedItemDialog(false)
        setLinkedItemDialogState(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add linked item')
      }
    } catch (error: any) {
      console.error('Add linked item error:', error)
      toast.error(error.message || 'Failed to add linked item')
    } finally {
      setSaving(false)
    }
  }

  const handleImportTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template')
      return
    }
    
    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/import-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to import template (${response.status})`)
      }
      
      const result = await response.json()
      if (result.success) {
        await loadFFEData()
        setShowImportDialog(false)
        setSelectedTemplateId('')
        toast.success('Template imported!')
      }
      
    } catch (error) {
      console.error('Error importing template:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import template'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`Delete "${sectionName}" section and all its items?`)) {
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections?sectionId=${sectionId}&deleteItems=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete section')
      }

      await loadFFEData()
      toast.success('Section deleted')
      
    } catch (error) {
      console.error('Error deleting section:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete section'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to delete item')
      }

      setSections(prevSections => 
        prevSections.map(section => ({
          ...section,
          items: section.items.filter(item => item.id !== itemId)
        }))
      )

      const updatedSections = sections.map(section => ({
        ...section,
        items: section.items.filter(item => item.id !== itemId)
      }))
      calculateStats(updatedSections)
      
    } catch (error) {
      console.error('Error deleting item:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const handleQuantityInclude = async (itemId: string, quantity: number, customName?: string) => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/quantity-include`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quantity, 
          customName,
          visibility: 'VISIBLE'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to include items with quantity')
      }

      await loadFFEData()
      
    } catch (error) {
      console.error('Error including items with quantity:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  // AI Generate import handler
  const handleAIImportItems = async (
    categories: Array<{ name: string; items: Array<{ name: string; description?: string; category: string; confidence: string }> }>,
    selectedItems: Set<string>
  ) => {
    try {
      setSaving(true)
      
      const categoryMap = new Map<string, Array<{ name: string; description?: string }>>()
      
      for (const key of selectedItems) {
        const [categoryName, itemName] = key.split('::')
        const category = categories.find(c => c.name === categoryName)
        const item = category?.items.find(i => i.name === itemName)
        
        if (item) {
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, [])
          }
          categoryMap.get(categoryName)!.push({
            name: item.name,
            description: item.description
          })
        }
      }
      
      for (const [categoryName, items] of categoryMap) {
        let existingSection = sections.find(s => 
          s.name.toLowerCase() === categoryName.toLowerCase()
        )
        
        let sectionId: string
        
        if (existingSection) {
          sectionId = existingSection.id
        } else {
          const sectionResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: categoryName,
              description: `AI-detected ${categoryName.toLowerCase()} items`,
              order: sections.length
            })
          })
          
          if (!sectionResponse.ok) {
            throw new Error(`Failed to create section: ${categoryName}`)
          }
          
          const sectionResult = await sectionResponse.json()
          sectionId = sectionResult.data?.section?.id || sectionResult.data?.id || sectionResult.id
          
          if (!sectionId) {
            console.error('Section creation response:', sectionResult)
            throw new Error(`Failed to get section ID for: ${categoryName}`)
          }
        }
        
        for (const item of items) {
          const itemResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionId,
              name: item.name,
              description: item.description || '',
              quantity: 1,
              visibility: 'HIDDEN'
            })
          })
          
          if (!itemResponse.ok) {
            console.error(`Failed to create item: ${item.name}`)
          }
        }
      }
      
      await loadFFEData()
      
    } catch (error) {
      console.error('Error importing AI items:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a657f0]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Clean Stats Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#a657f0]/10 flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-[#a657f0]" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{stats.sectionsCount}</div>
              <div className="text-xs text-gray-500">Sections</div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-gray-200" />
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#14b8a6]/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-[#14b8a6]" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{stats.totalItems}</div>
              <div className="text-xs text-gray-500">Total Items</div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-gray-200" />
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f6762e]/10 flex items-center justify-center">
              <Eye className="w-4 h-4 text-[#f6762e]" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{stats.visibleItems}</div>
              <div className="text-xs text-gray-500">In Workspace</div>
            </div>
          </div>
        </div>
        
        {saving && (
          <div className="flex items-center gap-2 text-[#a657f0]">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Saving...</span>
          </div>
        )}
      </div>

      {/* Action Buttons - Clean horizontal row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={disabled}
          onClick={() => setShowImportDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366ea] text-white rounded-lg font-medium text-sm hover:bg-[#5558d9] transition-colors shadow-sm"
        >
          <Import className="w-4 h-4" />
          Import Template
        </button>
        
        <button
          disabled={disabled}
          onClick={() => setShowAddSectionDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <FolderPlus className="w-4 h-4 text-[#14b8a6]" />
          Add Section
        </button>
        
        <button
          disabled={disabled || sections.length === 0}
          onClick={() => setShowAddItemDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4 text-[#a657f0]" />
          Add Item
        </button>
        
        <button
          disabled={disabled}
          onClick={() => setShowAIGenerateDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#e94d97] to-[#f6762e] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          AI Generate
        </button>
      </div>

      {/* Import Template Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5 text-[#6366ea]" />
              Import Template
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose a template"} />
                </SelectTrigger>
                <SelectContent>
                  {templatesLoading ? (
                    <div className="p-4 text-center">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : templatesError ? (
                    <div className="p-4 text-center text-red-500 text-sm">
                      <AlertTriangle className="h-5 w-5 mx-auto mb-1" />
                      Error loading templates
                    </div>
                  ) : (templates || []).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No templates available
                    </div>
                  ) : (
                    (templates || []).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              Items will be imported as hidden. Use "Include" to add them to your workspace.
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportTemplate} 
              disabled={!selectedTemplateId || saving}
              className="bg-[#6366ea] hover:bg-[#5558d9]"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-[#14b8a6]" />
              Add Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="section-name">Name</Label>
              <Input
                id="section-name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Flooring, Lighting, Fixtures"
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label htmlFor="section-description">Description (optional)</Label>
              <Textarea
                id="section-description"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSectionDialog(false)
                setNewSectionName('')
                setNewSectionDescription('')
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddSection} 
              disabled={saving || !newSectionName.trim()}
              className="bg-[#14b8a6] hover:bg-[#0d9488]"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#a657f0]" />
              Add Item
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="item-section">Section</Label>
              <select
                id="item-section"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full mt-1.5 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a657f0] focus:border-transparent"
              >
                <option value="">Select a section...</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Floor tiles, Pendant lights"
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label htmlFor="item-description">Description (optional)</Label>
              <Textarea
                id="item-description"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                min={1}
                max={50}
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="mt-1.5 w-24"
              />
            </div>
            
            {/* Linked Items */}
            <div>
              <Label>Linked Items (optional)</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={linkedItemInputValue}
                  onChange={(e) => setLinkedItemInputValue(e.target.value)}
                  placeholder="Add linked item..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addLinkedItemToForm()
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" onClick={addLinkedItemToForm}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {newItemLinkedItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newItemLinkedItems.map((linkedItem, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span>{linkedItem}</span>
                      <button
                        type="button"
                        onClick={() => removeLinkedItemFromForm(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemDialog(false)
                setNewItemName('')
                setNewItemDescription('')
                setNewItemQuantity(1)
                setNewItemLinkedItems([])
                setLinkedItemInputValue('')
                setSelectedSectionId('')
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem} 
              disabled={saving || !newItemName.trim() || !selectedSectionId}
              className="bg-[#a657f0] hover:bg-[#9645e0]"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        
      {/* Add Linked Item Dialog */}
      <Dialog open={showAddLinkedItemDialog} onOpenChange={(open) => {
        setShowAddLinkedItemDialog(open)
        if (!open) {
          setLinkedItemDialogState(null)
          setNewLinkedItemName('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-[#6366ea]" />
              Add Linked Item
            </DialogTitle>
          </DialogHeader>
          
          {linkedItemDialogState && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Parent Item</div>
                <div className="font-medium text-gray-900">{linkedItemDialogState.parentName}</div>
              </div>
              
              {linkedItemDialogState.existingLinkedItems.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">Existing ({linkedItemDialogState.existingLinkedItems.length})</Label>
                  <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                    {linkedItemDialogState.existingLinkedItems.map((name, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="new-linked-item">New Linked Item</Label>
                <Input
                  id="new-linked-item"
                  value={newLinkedItemName}
                  onChange={(e) => setNewLinkedItemName(e.target.value)}
                  placeholder="e.g., Pendant Light Shade"
                  maxLength={200}
                  className="mt-1.5"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddLinkedItem()
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddLinkedItemDialog(false)
                setLinkedItemDialogState(null)
                setNewLinkedItemName('')
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddLinkedItem} 
              disabled={saving || !newLinkedItemName.trim()}
              className="bg-[#6366ea] hover:bg-[#5558d9]"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sections Display */}
      <div className="space-y-3">
        {sections.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-[#a657f0]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-[#a657f0]" />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No FFE Sections Yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Get started by importing a template or creating custom sections.
            </p>
            
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setShowImportDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366ea] text-white rounded-lg font-medium text-sm hover:bg-[#5558d9] transition-colors"
              >
                <Import className="w-4 h-4" />
                Import Template
              </button>
              <button 
                onClick={() => setShowAddSectionDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Add Section
              </button>
            </div>
          </div>
        ) : (
          sections.map(section => {
            const visibleCount = section.items.filter(item => item.visibility === 'VISIBLE').length
            
            return (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Section Header */}
                <div 
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggleSectionExpanded(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`transition-transform duration-200 ${section.isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{section.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {visibleCount}/{section.items.length}
                        </span>
                      </div>
                      {section.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    disabled={disabled || saving}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSection(section.id, section.name)
                    }}
                    title="Delete section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Section Content */}
                {section.isExpanded && (
                  <div className="border-t border-gray-100">
                    {section.items.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <Checkbox
                          id={`select-all-${section.id}`}
                          checked={section.items.every(item => selectedItemIds.has(item.id))}
                          onCheckedChange={(checked) => {
                            setSelectedItemIds(prev => {
                              const newSet = new Set(prev)
                              section.items.forEach(item => {
                                if (checked) {
                                  newSet.add(item.id)
                                  const childIds = getLinkedChildrenIds(item.name, section.items)
                                  childIds.forEach(childId => newSet.add(childId))
                                } else {
                                  newSet.delete(item.id)
                                  const childIds = getLinkedChildrenIds(item.name, section.items)
                                  childIds.forEach(childId => newSet.delete(childId))
                                }
                              })
                              return newSet
                            })
                          }}
                        />
                        <label htmlFor={`select-all-${section.id}`} className="text-sm text-gray-600 cursor-pointer">
                          Select All
                        </label>
                      </div>
                    )}
                    
                    {section.items.length === 0 ? (
                      <div className="p-8 text-center">
                        <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm mb-3">No items yet</p>
                        <button
                          onClick={() => {
                            setSelectedSectionId(section.id)
                            setShowAddItemDialog(true)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#a657f0] hover:bg-[#a657f0]/10 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Item
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {section.items
                          .filter(item => !(item.customFields?.isLinkedItem))
                          .map(item => {
                            const linkedChildren = item.customFields?.hasChildren
                              ? section.items
                                  .filter(child => 
                                    child.customFields?.isLinkedItem && 
                                    child.customFields?.parentName === item.name
                                  )
                                  .map(child => ({
                                    id: child.id,
                                    name: child.name,
                                    visibility: child.visibility
                                  }))
                              : []
                            
                            return (
                              <FFEItemCard
                                key={item.id}
                                id={item.id}
                                name={item.name}
                                description={item.description}
                                state={item.state}
                                visibility={item.visibility}
                                notes={item.notes}
                                sectionName={section.name}
                                isRequired={item.isRequired}
                                isCustom={item.isCustom}
                                quantity={item.quantity}
                                customFields={item.customFields}
                                linkedChildren={linkedChildren}
                                mode="settings"
                                disabled={disabled || saving}
                                isSelected={selectedItemIds.has(item.id)}
                                onSelect={(itemId, selected) => {
                                  setSelectedItemIds(prev => {
                                    const newSet = new Set(prev)
                                    if (selected) {
                                      newSet.add(itemId)
                                      const childIds = getLinkedChildrenIds(item.name, section.items)
                                      childIds.forEach(childId => newSet.add(childId))
                                    } else {
                                      newSet.delete(itemId)
                                      const childIds = getLinkedChildrenIds(item.name, section.items)
                                      childIds.forEach(childId => newSet.delete(childId))
                                    }
                                    return newSet
                                  })
                                }}
                                onStateChange={handleStateChange}
                                onVisibilityChange={handleVisibilityChange}
                                onNotesChange={handleNotesChange}
                                onDelete={handleDeleteItem}
                                onQuantityInclude={handleQuantityInclude}
                                onAddLinkedItem={handleOpenLinkedItemDialog}
                              />
                            )
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* AI Generate FFE Dialog */}
      <AIGenerateFFEDialog
        open={showAIGenerateDialog}
        onOpenChange={setShowAIGenerateDialog}
        roomId={roomId}
        roomName={roomName}
        onImportItems={handleAIImportItems}
      />
    </div>
  )
}
