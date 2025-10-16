'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Settings, 
  Plus, 
  Upload, 
  FolderPlus, 
  RefreshCw, 
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Import,
  AlertTriangle,
  Trash2,
  Package,
  Edit3,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

  // Dialog states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showManageItemsDialog, setShowManageItemsDialog] = useState(false)
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

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    visibleItems: 0,
    hiddenItems: 0,
    sectionsCount: 0
  })

  // Load FFE data
  useEffect(() => {
    console.log('🔧 FFESettingsDepartment mounted with props:', { roomId, roomName, orgId, projectId, disabled })
    loadFFEData()
    loadTemplates()
  }, [roomId, orgId])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      
      // Load room FFE instance with all items (including hidden)
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
        // No FFE instance exists yet - show empty state
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
    
    // Update progress for parent component
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
    // Optimistic update - update UI immediately
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
    
    // Immediately recalculate stats for instant feedback
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
      // Revert optimistic update on error
      setSections(previousSections)
      calculateStats(previousSections)
      throw error // Re-throw to let the component handle the toast
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

      // Update local state
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

      // Update local state
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
        // Reload data to get the new section
        await loadFFEData()
        setShowAddSectionDialog(false)
        setNewSectionName('')
        setNewSectionDescription('')
        toast.success('Section added successfully')
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
        // Reload data to get the new item
        await loadFFEData()
        setShowAddItemDialog(false)
        setNewItemName('')
        setNewItemDescription('')
        setNewItemQuantity(1)
        setSelectedSectionId('')
        toast.success('Item added successfully')
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

  const toggleAllVisibility = async (makeVisible: boolean) => {
    const allItems = sections.flatMap(section => section.items)
    const targetVisibility: FFEItemVisibility = makeVisible ? 'VISIBLE' : 'HIDDEN'
    
    try {
      setSaving(true)
      
      // Update all items in parallel
      const promises = allItems.map(item => 
        handleVisibilityChange(item.id, targetVisibility)
      )
      
      await Promise.all(promises)
      toast.success(`All items ${makeVisible ? 'added to' : 'removed from'} workspace`)
      
    } catch (error) {
      toast.error('Failed to update all items')
    }
  }

  const handleImportTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template to import')
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
        // Reload data to show the new items
        await loadFFEData()
        setShowImportDialog(false)
        setSelectedTemplateId('')
        toast.success('Template imported successfully!')
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
    if (!confirm(`Are you sure you want to delete the "${sectionName}" section? Items will be moved to another section if available.`)) {
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections?sectionId=${sectionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete section')
      }

      const result = await response.json()
      
      // Reload data to reflect the deletion
      await loadFFEData()
      
      // Show success message from API
      toast.success(result.message || 'Section deleted successfully')
      
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

      // Update local state to remove the item
      setSections(prevSections => 
        prevSections.map(section => ({
          ...section,
          items: section.items.filter(item => item.id !== itemId)
        }))
      )

      // Recalculate stats
      const updatedSections = sections.map(section => ({
        ...section,
        items: section.items.filter(item => item.id !== itemId)
      }))
      calculateStats(updatedSections)
      
    } catch (error) {
      console.error('Error deleting item:', error)
      throw error // Re-throw so FFEItemCard can handle the toast
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

      // Reload data to show the new quantities
      await loadFFEData()
      
    } catch (error) {
      console.error('Error including items with quantity:', error)
      throw error // Re-throw so FFEItemCard can handle the toast
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateItem = async (itemId: string, itemName: string) => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate item')
      }

      const result = await response.json()
      toast.success(result.message || `"${itemName}" duplicated successfully`)
      
      // Reload data to show the new item
      await loadFFEData()
      
    } catch (error) {
      console.error('Error duplicating item:', error)
      toast.error('Failed to duplicate item')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      {/* Compact Settings Header - Like Other Phases */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {roomName} - FFE Settings
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
              {projectName && (
                <>
                  <span>{projectName}</span>
                  <span>•</span>
                </>
              )}
              <span>Manage sections, items, and workspace visibility</span>
              {saving && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-blue-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Saving...</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Compact Statistics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FolderPlus className="w-4 h-4 text-slate-600" />
              <div className="text-lg font-bold text-slate-900">{stats.sectionsCount}</div>
            </div>
            <div className="text-xs font-medium text-slate-700">Sections</div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-600" />
              <div className="text-lg font-bold text-blue-900">{stats.totalItems}</div>
            </div>
            <div className="text-xs font-medium text-blue-700">Total Items</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-green-600" />
              <div className="text-lg font-bold text-green-900">{stats.visibleItems}</div>
            </div>
            <div className="text-xs font-medium text-green-700">In Workspace</div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <EyeOff className="w-4 h-4 text-gray-600" />
              <div className="text-lg font-bold text-gray-900">{stats.hiddenItems}</div>
            </div>
            <div className="text-xs font-medium text-gray-700">Hidden</div>
          </div>
        </div>
      </div>

      {/* Modern Action Panel */}
      <div className="card-elevated">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Primary Actions */}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <button
                  disabled={disabled}
                  onClick={() => setShowImportDialog(true)}
                  className="btn-primary h-auto p-4 flex flex-col items-center gap-2 text-left disabled:opacity-50"
                >
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Import className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Import Template</div>
                    <div className="text-xs opacity-75">Pre-built sections</div>
                  </div>
                </button>
                
                <button
                  disabled={disabled}
                  onClick={() => setShowAddSectionDialog(true)}
                  className="btn-secondary h-auto p-4 flex flex-col items-center gap-2 text-left hover:border-green-300 hover:bg-green-50 disabled:opacity-50"
                >
                  <div className="p-2 bg-green-50 rounded-lg">
                    <FolderPlus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-green-700">Add Section</div>
                    <div className="text-xs text-green-600">Create category</div>
                  </div>
                </button>
                
                <button
                  disabled={disabled || sections.length === 0}
                  onClick={() => setShowAddItemDialog(true)}
                  className="btn-secondary h-auto p-4 flex flex-col items-center gap-2 text-left hover:border-purple-300 hover:bg-purple-50 disabled:opacity-50"
                >
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Plus className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-purple-700">Add Item</div>
                    <div className="text-xs text-purple-600">New FFE item</div>
                  </div>
                </button>
                
                <button
                  disabled={disabled || stats.totalItems === 0}
                  onClick={() => setShowManageItemsDialog(true)}
                  className="btn-secondary h-auto p-4 flex flex-col items-center gap-2 text-left hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                >
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Edit3 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-medium text-orange-700">Manage Items</div>
                    <div className="text-xs text-orange-600">Edit, duplicate, delete</div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Bulk Operations */}
            <div className="lg:border-l lg:pl-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Bulk Operations</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleAllVisibility(true)}
                  disabled={disabled || saving || stats.totalItems === 0}
                  className="btn-ghost justify-start px-3 py-2 text-sm disabled:opacity-50"
                >
                  <Eye className="w-4 h-4 mr-2 text-green-600" />
                  Show All Items
                </button>
                <button
                  onClick={() => toggleAllVisibility(false)}
                  disabled={disabled || saving || stats.totalItems === 0}
                  className="btn-ghost justify-start px-3 py-2 text-sm disabled:opacity-50"
                >
                  <EyeOff className="w-4 h-4 mr-2 text-gray-600" />
                  Hide All Items
                </button>
                
                {stats.totalItems > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                    {stats.visibleItems} of {stats.totalItems} items visible
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Import Template Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl animate-slide-in-right">
          <DialogHeader className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Import className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Import FFE Template
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Choose from pre-built templates to quickly setup your FFE items
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
            {/* Left Column - Form */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Available Templates
                </label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-12 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                    <SelectValue placeholder={templatesLoading ? "Loading templates..." : templates && templates.length > 0 ? "Choose a template..." : "No templates available"} />
                  </SelectTrigger>
                  <SelectContent className="animate-slide-in-right">
                    {templatesLoading ? (
                      <div className="px-4 py-8 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-blue-600" />
                        <p className="text-sm text-gray-500">Loading templates...</p>
                      </div>
                    ) : templatesError ? (
                      <div className="px-4 py-8 text-center">
                        <AlertTriangle className="h-6 w-6 mx-auto mb-3 text-red-500" />
                        <p className="text-sm text-red-600">Error loading templates</p>
                      </div>
                    ) : (templates || []).length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Import className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No templates available</p>
                      </div>
                    ) : (
                      (templates || []).map(template => (
                        <SelectItem key={template.id} value={template.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Package className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{template.name}</div>
                              {template.description && (
                                <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Right Column - Preview/Help */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-4">What happens next?</h4>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Import sections</p>
                    <p>Template sections will be added to this room</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Add FFE items</p>
                    <p>All template items will be imported as hidden by default</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Customize</p>
                    <p>Review and show/hide items as needed for your project</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Note</span>
                </div>
                <p className="text-xs text-amber-700">
                  Imported items won't affect existing items in this room. You can safely import multiple templates.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
            <button 
              onClick={() => setShowImportDialog(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={handleImportTemplate} 
              disabled={!selectedTemplateId || saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Import className="h-4 w-4" />
                  <span>Import Template</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-lg animate-slide-in-right">
          <DialogHeader className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-xl">
                <FolderPlus className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Add New Section
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Create a new category to organize your FFE items
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            <div className="relative">
              <input
                id="section-name"
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder=" "
                className="floating-input peer"
                required
              />
              <label htmlFor="section-name" className="floating-label peer-focus:text-green-600">
                Section Name *
              </label>
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  Examples: Flooring, Lighting, Fixtures, Furniture
                </p>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                id="section-description"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder=" "
                rows={4}
                className="floating-input peer resize-none"
              />
              <label htmlFor="section-description" className="floating-label peer-focus:text-green-600">
                Description (Optional)
              </label>
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  Brief description of what items belong in this section
                </p>
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <FolderPlus className="h-4 w-4" />
                <span className="font-medium text-sm">What's next?</span>
              </div>
              <p className="text-xs text-green-700">
                After creating the section, you can add FFE items to it or import them from templates.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowAddSectionDialog(false)
                setNewSectionName('')
                setNewSectionDescription('')
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddSection} 
              disabled={saving || !newSectionName.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  <span>Add Section</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

        {/* Add Item Dialog */}
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item-section">Section *</Label>
                <select
                  id="item-section"
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full p-2 border rounded"
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
                <Label htmlFor="item-name">Item Name *</Label>
                <Input
                  id="item-name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g., Floor tiles, Pendant lights"
                />
              </div>
              <div>
                <Label htmlFor="item-description">Description</Label>
                <Textarea
                  id="item-description"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
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
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddItemDialog(false)
                    setNewItemName('')
                    setNewItemDescription('')
                    setNewItemQuantity(1)
                    setSelectedSectionId('')
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddItem} disabled={saving}>
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Add Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Modern Sections Display */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="card-elevated">
            <div className="p-12 text-center">
              {/* Animated empty state */}
              <div className="relative mb-6">
                <div className="animate-bounce-in">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Settings className="h-10 w-10 text-indigo-600" />
                  </div>
                </div>
                
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                  <FolderPlus className="h-4 w-4 text-blue-600" />
                </div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                  <Import className="h-3 w-3 text-green-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">No FFE Sections Yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Start by importing a template for quick setup, or create custom sections to organize your FFE items.
              </p>
              
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => setShowImportDialog(true)}
                  className="btn-primary"
                >
                  <Import className="w-4 h-4" />
                  Import Template
                </button>
                <button 
                  onClick={() => setShowAddSectionDialog(true)}
                  className="btn-secondary"
                >
                  <FolderPlus className="w-4 h-4" />
                  Add Section
                </button>
              </div>
            </div>
          </div>
        ) : (
          sections.map(section => {
            const visibleCount = section.items.filter(item => item.visibility === 'VISIBLE').length
            const includedRate = section.items.length > 0 
              ? `${visibleCount} of ${section.items.length}` 
              : '0 of 0'
            
            return (
              <div key={section.id} className="card-elevated">
                {/* Modern Section Header */}
                <div className="section-header">
                  <div 
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => toggleSectionExpanded(section.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`transition-transform duration-200 ${
                        section.isExpanded ? 'rotate-90' : 'rotate-0'
                      }`}>
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      </div>
                      
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <FolderPlus className="h-5 w-5 text-slate-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
                        
                        {/* Included count pill */}
                        <div className="status-chip-completed">
                          <span className="text-xs font-medium">{includedRate} included</span>
                        </div>
                      </div>
                      
                      {section.description && (
                        <p className="text-sm text-gray-600">{section.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="status-chip-pending">
                        <Package className="h-3 w-3" />
                        <span>{section.items.length}</span>
                      </div>
                      
                      <div className="status-chip-completed">
                        <Eye className="h-3 w-3" />
                        <span>{visibleCount}</span>
                      </div>
                    </div>
                    
                    <button
                      className="btn-ghost p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
                </div>
                
                {/* Section Content */}
                {section.isExpanded && (
                  <div className="px-6 pb-6">
                    {section.items.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-gray-600 mb-4">No items in this section yet</p>
                        <button
                          onClick={() => {
                            setSelectedSectionId(section.id)
                            setShowAddItemDialog(true)
                          }}
                          className="btn-secondary"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Item
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {section.items.map(item => (
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
                            mode="settings"
                            disabled={disabled || saving}
                            onStateChange={handleStateChange}
                            onVisibilityChange={handleVisibilityChange}
                            onNotesChange={handleNotesChange}
                            onDelete={handleDeleteItem}
                            onQuantityInclude={handleQuantityInclude}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      
      {/* Manage Items Dialog */}
      <Dialog open={showManageItemsDialog} onOpenChange={setShowManageItemsDialog}>
        <DialogContent className="max-w-4xl animate-slide-in-right">
          <DialogHeader className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 rounded-xl">
                <Edit3 className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Manage FFE Items
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Duplicate or delete items across all sections
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-6">
            {sections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No items to manage yet.</p>
                <p className="text-sm">Import a template or add items manually first.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4">
                {sections.map(section => (
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
                                disabled={disabled || saving}
                                className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Duplicate
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={disabled || saving}
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
    </div>
  )
}
