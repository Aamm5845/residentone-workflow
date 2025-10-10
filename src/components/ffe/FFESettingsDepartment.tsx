'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  X
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
  onProgressUpdate?: (progress: number, isComplete: boolean) => void
  disabled?: boolean
}

export default function FFESettingsDepartment({
  roomId,
  roomName,
  orgId,
  projectId,
  onProgressUpdate,
  disabled = false
}: FFESettingsDepartmentProps) {
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')

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
    loadFFEData()
  }, [roomId])

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
    try {
      setSaving(true)
      
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      })

      if (!response.ok) {
        throw new Error('Failed to update item visibility')
      }

      // Update local state
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

      // Recalculate stats
      const updatedSections = sections.map(section => ({
        ...section,
        items: section.items.map(item => 
          item.id === itemId 
            ? { ...item, visibility: newVisibility }
            : item
        )
      }))
      calculateStats(updatedSections)

    } catch (error) {
      console.error('Error updating item visibility:', error)
      throw error // Re-throw to let the component handle the toast
    } finally {
      setSaving(false)
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
          visibility: 'VISIBLE'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            FFE Settings - {roomName}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage sections, items, and workspace visibility
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {saving && (
            <div className="flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Saving...</span>
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.sectionsCount}</div>
              <div className="text-sm text-gray-600">Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.visibleItems}</div>
              <div className="text-sm text-gray-600">In Workspace</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.hiddenItems}</div>
              <div className="text-sm text-gray-600">Hidden</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center space-x-4">
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogTrigger asChild>
            <Button disabled={disabled}>
              <Upload className="w-4 h-4 mr-2" />
              Import Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import FFE Template</DialogTitle>
            </DialogHeader>
            <div className="text-center py-8">
              <p className="text-gray-600">Template import functionality coming soon...</p>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={disabled}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="section-name">Section Name *</Label>
                <Input
                  id="section-name"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g., Flooring, Lighting, Fixtures"
                />
              </div>
              <div>
                <Label htmlFor="section-description">Description</Label>
                <Textarea
                  id="section-description"
                  value={newSectionDescription}
                  onChange={(e) => setNewSectionDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
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
                <Button onClick={handleAddSection} disabled={saving}>
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Add Section
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={disabled || sections.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
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

        {/* Bulk Actions */}
        <div className="flex items-center space-x-2 border-l pl-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllVisibility(true)}
            disabled={disabled || saving || stats.totalItems === 0}
          >
            <Eye className="w-4 h-4 mr-1" />
            Show All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllVisibility(false)}
            disabled={disabled || saving || stats.totalItems === 0}
          >
            <EyeOff className="w-4 h-4 mr-1" />
            Hide All
          </Button>
        </div>
      </div>

      {/* Sections and Items */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <Settings className="h-16 w-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No FFE Sections Yet</h3>
              <p className="text-gray-600 mb-4">
                Start by importing a template or adding sections and items manually.
              </p>
              <div className="flex justify-center space-x-2">
                <Button onClick={() => setShowImportDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Template
                </Button>
                <Button variant="outline" onClick={() => setShowAddSectionDialog(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          sections.map(section => (
            <Card key={section.id}>
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSectionExpanded(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {section.isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    )}
                    <div>
                      <CardTitle className="text-base">{section.name}</CardTitle>
                      {section.description && (
                        <p className="text-sm text-gray-600">{section.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {section.items.length} items
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {section.items.filter(item => item.visibility === 'VISIBLE').length} visible
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              {section.isExpanded && (
                <CardContent className="border-t space-y-3">
                  {section.items.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <p>No items in this section yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSelectedSectionId(section.id)
                          setShowAddItemDialog(true)
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add First Item
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
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
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}