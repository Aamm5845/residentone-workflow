'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  FolderPlus, 
  RefreshCw, 
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  X,
  Import,
  AlertTriangle,
  Trash2,
  Package,
  Link,
  Sparkles,
  Settings,
  Briefcase,
  Search,
  CheckCircle2,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react'
import AIGenerateFFEDialog from './AIGenerateFFEDialog'
import { Checkbox } from '@/components/ui/checkbox'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface FFEItem {
  id: string
  name: string
  description?: string
  state: 'PENDING' | 'UNDECIDED' | 'COMPLETED'
  visibility: 'VISIBLE' | 'HIDDEN'
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
  const router = useRouter()
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
        const sectionsWithExpanded = (ffeData.sections || []).map((s: any) => ({
          ...s,
          isExpanded: true
        }))
        setSections(sectionsWithExpanded)
        calculateStats(sectionsWithExpanded)
      } else {
        setSections([])
        setStats({ totalItems: 0, visibleItems: 0, hiddenItems: 0, sectionsCount: 0 })
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
      const response = await fetch(`/api/ffe/v2/templates?orgId=${orgId}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      const result = await response.json()
      if (result.success) setTemplates(result.data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplatesError(error)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const calculateStats = (sectionsData: FFESection[]) => {
    const allItems = sectionsData.flatMap(section => section.items)
    const newStats = {
      totalItems: allItems.length,
      visibleItems: allItems.filter(item => item.visibility === 'VISIBLE').length,
      hiddenItems: allItems.filter(item => item.visibility === 'HIDDEN').length,
      sectionsCount: sectionsData.length
    }
    setStats(newStats)
    
    if (onProgressUpdate) {
      const completedItems = allItems.filter(item => item.visibility === 'VISIBLE' && item.state === 'COMPLETED').length
      const visibleItems = allItems.filter(item => item.visibility === 'VISIBLE').length
      const progress = visibleItems > 0 ? (completedItems / visibleItems) * 100 : 0
      onProgressUpdate(progress, progress === 100)
    }
  }

  const handleVisibilityChange = async (itemId: string, newVisibility: 'VISIBLE' | 'HIDDEN') => {
    const previousSections = [...sections]
    
    // Optimistic update - update state immediately without page refresh
    setSections(prev => {
      const updated = prev.map(section => ({
        ...section,
        items: section.items.map(item => item.id === itemId ? { ...item, visibility: newVisibility } : item)
      }))
      // Recalculate stats immediately
      const allItems = updated.flatMap(s => s.items)
      setStats({
        totalItems: allItems.length,
        visibleItems: allItems.filter(item => item.visibility === 'VISIBLE').length,
        hiddenItems: allItems.filter(item => item.visibility === 'HIDDEN').length,
        sectionsCount: updated.length
      })
      return updated
    })
    
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      })
      if (!response.ok) throw new Error('Failed to update visibility')
      toast.success(newVisibility === 'VISIBLE' ? 'Added to workspace' : 'Removed from workspace')
      // No page refresh - optimistic update already done
    } catch (error) {
      // Revert on error
      setSections(previousSections)
      calculateStats(previousSections)
      toast.error('Failed to update visibility')
    }
  }

  const handleAddSection = async () => {
    if (!newSectionName.trim()) { toast.error('Section name is required'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim(), description: newSectionDescription.trim() || undefined, order: sections.length })
      })
      if (!response.ok) throw new Error('Failed to add section')
      await loadFFEData()
      setShowAddSectionDialog(false)
      setNewSectionName('')
      setNewSectionDescription('')
      toast.success('Section added')
    } catch (error) {
      toast.error('Failed to add section')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemName.trim() || !selectedSectionId) { toast.error('Item name and section are required'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: selectedSectionId, name: newItemName.trim(), description: newItemDescription.trim() || undefined, quantity: newItemQuantity, visibility: 'HIDDEN' })
      })
      if (!response.ok) throw new Error('Failed to add item')
      await loadFFEData()
      setShowAddItemDialog(false)
      setNewItemName('')
      setNewItemDescription('')
      setNewItemQuantity(1)
      setSelectedSectionId('')
      toast.success('Item added')
    } catch (error) {
      toast.error('Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s))
  }

  const handleImportTemplate = async () => {
    if (!selectedTemplateId) { toast.error('Please select a template'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/import-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId })
      })
      if (!response.ok) throw new Error('Failed to import template')
      await loadFFEData()
      setShowImportDialog(false)
      setSelectedTemplateId('')
      toast.success('Template imported!')
    } catch (error) {
      toast.error('Failed to import template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`Delete "${sectionName}" section and all its items?`)) return
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections?sectionId=${sectionId}&deleteItems=true`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete section')
      await loadFFEData()
      toast.success('Section deleted')
    } catch (error) {
      toast.error('Failed to delete section')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete item')
      await loadFFEData()
      toast.success('Item deleted')
    } catch (error) {
      toast.error('Failed to delete item')
    } finally {
      setSaving(false)
    }
  }

  const handleAIImportItems = async (
    categories: Array<{ name: string; items: Array<{ name: string; description?: string }> }>,
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
          if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
          categoryMap.get(categoryName)!.push({ name: item.name, description: item.description })
        }
      }
      
      for (const [categoryName, items] of categoryMap) {
        let existingSection = sections.find(s => s.name.toLowerCase() === categoryName.toLowerCase())
        let sectionId: string
        
        if (existingSection) {
          sectionId = existingSection.id
        } else {
          const sectionResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName, description: `AI-detected ${categoryName.toLowerCase()} items`, order: sections.length })
          })
          const sectionResult = await sectionResponse.json()
          sectionId = sectionResult.data?.section?.id || sectionResult.data?.id || sectionResult.id
        }
        
        for (const item of items) {
          await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionId, name: item.name, description: item.description || '', quantity: 1, visibility: 'VISIBLE' })
          })
        }
      }
      
      await loadFFEData()
      toast.success(`${selectedItems.size} items imported to workspace!`)
      setTimeout(() => router.push(`/ffe/${roomId}/workspace`), 1500)
    } catch (error) {
      throw error
    } finally {
      setSaving(false)
    }
  }

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0 || !searchQuery)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading FFE Settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle - Prominent switch between Settings and Workspace */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm"
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => router.push(`/ffe/${roomId}/workspace`)}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-colors"
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            Workspace
            {stats.visibleItems > 0 && (
              <Badge className="ml-2 bg-green-100 text-green-700 text-xs">{stats.visibleItems}</Badge>
            )}
          </button>
        </div>
        
        {stats.visibleItems > 0 && (
          <Button 
            onClick={() => router.push(`/ffe/${roomId}/workspace`)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Go to Workspace ({stats.visibleItems} items)
          </Button>
        )}
      </div>

      {/* Stats Header - Clean white cards with colored icon squares */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e94d97] flex items-center justify-center">
              <FolderPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.sectionsCount}</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sections</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-500 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Items</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.visibleItems}</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">In Workspace</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-400 flex items-center justify-center">
              <EyeOff className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.hiddenItems}</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hidden</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} disabled={disabled}>
              <Import className="w-4 h-4 mr-2" />
              Import Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddSectionDialog(true)} disabled={disabled}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddItemDialog(true)} disabled={disabled || sections.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            <Button size="sm" onClick={() => setShowAIGenerateDialog(true)} disabled={disabled} className="bg-[#e94d97] hover:bg-[#d63d87] text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generate
            </Button>
          </div>
        </div>
      </div>


      {/* Dialogs */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5 text-gray-600" />
              Import Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={templatesLoading ? "Loading..." : "Choose a template"} />
                </SelectTrigger>
                <SelectContent>
                  {(templates || []).map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={handleImportTemplate} disabled={!selectedTemplateId || saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-gray-600" />
              Add Section
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name</Label>
              <Input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g., Flooring, Lighting" className="mt-1.5" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newSectionDescription} onChange={(e) => setNewSectionDescription(e.target.value)} placeholder="Brief description..." rows={2} className="mt-1.5" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setShowAddSectionDialog(false); setNewSectionName(''); setNewSectionDescription('') }}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={saving || !newSectionName.trim()}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-gray-600" />
              Add Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Section</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a section..." />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(section => (
                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item Name</Label>
              <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g., Floor tiles, Pendant lights" className="mt-1.5" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder="Optional description..." rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} max={50} value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} className="mt-1.5 w-24" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setShowAddItemDialog(false); setNewItemName(''); setNewItemDescription(''); setNewItemQuantity(1); setSelectedSectionId('') }}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={saving || !newItemName.trim() || !selectedSectionId}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sections */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No FFE Sections Yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Get started by importing a template, using AI to generate items, or creating sections manually.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => setShowAIGenerateDialog(true)} className="bg-[#e94d97] hover:bg-[#d63d87] text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Import className="w-4 h-4 mr-2" />
                Import Template
              </Button>
              <Button variant="outline" onClick={() => setShowAddSectionDialog(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>
          </div>
        ) : (
          filteredSections.map(section => {
            const visibleCount = section.items.filter(item => item.visibility === 'VISIBLE').length
            const parentItems = section.items.filter(item => !item.customFields?.isLinkedItem)
            
            return (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Section Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSectionExpanded(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      {section.isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-[#e94d97] flex items-center justify-center">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{section.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{parentItems.length} items</span>
                        {visibleCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">{visibleCount} in workspace</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedSectionId(section.id); setShowAddItemDialog(true) }}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSection(section.id, section.name)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Section Content */}
                {section.isExpanded && (
                  <div className="border-t border-gray-100">
                    {parentItems.length === 0 ? (
                      <div className="p-8 text-center">
                        <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 mb-3">No items in this section</p>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedSectionId(section.id); setShowAddItemDialog(true) }}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add First Item
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {parentItems.map(item => {
                          const isInWorkspace = item.visibility === 'VISIBLE'
                          const linkedChildren = section.items.filter(
                            child => child.customFields?.isLinkedItem && child.customFields?.parentName === item.name
                          )
                          
                          return (
                            <div key={item.id} className={cn("p-4 hover:bg-gray-50 transition-colors", isInWorkspace && "bg-green-50/50")}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                                    {item.quantity > 1 && (
                                      <Badge variant="outline" className="text-xs">{item.quantity}x</Badge>
                                    )}
                                    {linkedChildren.length > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        <Link className="w-3 h-3 mr-1" />
                                        {linkedChildren.length} linked
                                      </Badge>
                                    )}
                                    {isInWorkspace && (
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        In Workspace
                                      </Badge>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isInWorkspace ? (
                                    <Button size="sm" variant="outline" onClick={() => handleVisibilityChange(item.id, 'HIDDEN')} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                                      <EyeOff className="w-4 h-4 mr-1" />
                                      Remove
                                    </Button>
                                  ) : (
                                    <Button size="sm" onClick={() => handleVisibilityChange(item.id, 'VISIBLE')} className="bg-green-600 hover:bg-green-700 text-white">
                                      <Eye className="w-4 h-4 mr-1" />
                                      Add to Workspace
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${item.name}"?`)) handleDeleteItem(item.id) }} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {linkedChildren.length > 0 && (
                                <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {linkedChildren.map(child => (
                                    <div key={child.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <Link className="w-3 h-3 text-gray-400" />
                                        <span className="text-sm text-gray-700">{child.name}</span>
                                        {child.visibility === 'VISIBLE' && (
                                          <Badge className="bg-green-100 text-green-600 text-xs">In Workspace</Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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

      {/* AI Generate Dialog */}
      <AIGenerateFFEDialog
        open={showAIGenerateDialog}
        onOpenChange={setShowAIGenerateDialog}
        roomId={roomId}
        roomName={roomName}
        onImportItems={handleAIImportItems}
      />
      
      {saving && (
        <div className="fixed bottom-6 right-6 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 border border-gray-200">
          <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
          <span className="text-sm text-gray-600">Saving...</span>
        </div>
      )}
    </div>
  )
}
