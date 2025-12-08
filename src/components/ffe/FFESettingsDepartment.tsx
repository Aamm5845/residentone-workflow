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
  Import,
  Trash2,
  Package,
  Link,
  Sparkles,
  Settings,
  Briefcase,
  Search,
  CheckCircle2,
  ArrowRight,
  Lock,
  Image as ImageIcon,
  LinkIcon,
  Pencil,
  Check,
  X,
  Info
} from 'lucide-react'
import AIGenerateFFEDialog from './AIGenerateFFEDialog'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// FFE Phase Color
const FFE_COLOR = '#e94d97'

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
  const [renderingImages, setRenderingImages] = useState<Array<{id: string, url: string, filename: string}>>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [programaLink, setProgramaLink] = useState('')
  const [editingProgramaLink, setEditingProgramaLink] = useState(false)
  const [tempProgramaLink, setTempProgramaLink] = useState('')

  // Dialog states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showAIGenerateDialog, setShowAIGenerateDialog] = useState(false)
  const [showAddLinkedItemDialog, setShowAddLinkedItemDialog] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedParentItem, setSelectedParentItem] = useState<{id: string, name: string, sectionId: string} | null>(null)
  
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
  const [linkedItemName, setLinkedItemName] = useState('')
  const [linkedItemDescription, setLinkedItemDescription] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)
  const [linkMode, setLinkMode] = useState<'create' | 'existing'>('create')
  const [existingItemSearch, setExistingItemSearch] = useState('')
  const [selectedExistingItem, setSelectedExistingItem] = useState<{id: string, name: string, description?: string} | null>(null)
  
  // Edit states
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editSectionName, setEditSectionName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemName, setEditItemName] = useState('')
  
  // Description expansion state
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())

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
    loadRenderingImages()
  }, [roomId, orgId])

  const loadFFEData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}?includeHidden=true`)
      if (!response.ok) throw new Error('Failed to fetch FFE data')

      const result = await response.json()
      if (result.success && result.data) {
        const ffeData = result.data
        const sectionsWithExpanded = (ffeData.sections || []).map((s: any) => ({
          ...s,
          isExpanded: true
        }))
        setSections(sectionsWithExpanded)
        calculateStats(sectionsWithExpanded)
        // Load Programa link from instance data
        if (ffeData.programaLink) {
          setProgramaLink(ffeData.programaLink)
        }
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

  const loadRenderingImages = async () => {
    try {
      // Fetch all 3D renderings for this room
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.renderings && result.renderings.length > 0) {
          // Get all rendering images
          setRenderingImages(result.renderings.map((r: any) => ({
            id: r.id,
            url: r.url,
            filename: r.filename || 'Rendering'
          })))
        }
      }
    } catch (error) {
      console.error('Error loading rendering images:', error)
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
    
    setSections(prev => {
      const updated = prev.map(section => ({
        ...section,
        items: section.items.map(item => item.id === itemId ? { ...item, visibility: newVisibility } : item)
      }))
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
    } catch (error) {
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

  const handleAddLinkedItem = async () => {
    if (!selectedParentItem) { toast.error('Parent item is required'); return }
    
    // Handle linking existing item
    if (linkMode === 'existing') {
      if (!selectedExistingItem) { toast.error('Please select an item to link'); return }
      try {
        setSaving(true)
        
        // First, update the existing item to mark it as linked
        const updateChildResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${selectedExistingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customFields: {
              isLinkedItem: true,
              parentName: selectedParentItem.name,
              parentId: selectedParentItem.id
            }
          })
        })
        if (!updateChildResponse.ok) throw new Error('Failed to link item')
        
        // Then update the parent item to track this child in its linkedItems array
        const parentCustomFields = selectedParentItem.customFields || {}
        const currentLinkedItems = Array.isArray(parentCustomFields.linkedItems) 
          ? parentCustomFields.linkedItems 
          : []
        
        const updateParentResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${selectedParentItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customFields: {
              ...parentCustomFields,
              hasChildren: true,
              linkedItems: [...currentLinkedItems, selectedExistingItem.name]
            }
          })
        })
        if (!updateParentResponse.ok) {
          console.error('Warning: Failed to update parent item customFields')
        }
        
        await loadFFEData()
        setShowAddLinkedItemDialog(false)
        setSelectedExistingItem(null)
        setExistingItemSearch('')
        setLinkMode('create')
        setSelectedParentItem(null)
        toast.success(`"${selectedExistingItem.name}" linked to "${selectedParentItem.name}"`)
        return
      } catch (error) {
        toast.error('Failed to link item')
      } finally {
        setSaving(false)
      }
      return
    }
    
    // Handle creating new linked item using the linked-items API
    // This properly updates both the parent and creates the child atomically
    if (!linkedItemName.trim()) { toast.error('Linked item name is required'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${selectedParentItem.id}/linked-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add',
          name: linkedItemName.trim()
        })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add linked item')
      }
      await loadFFEData()
      setShowAddLinkedItemDialog(false)
      setLinkedItemName('')
      setLinkedItemDescription('')
      setSelectedParentItem(null)
      setLinkMode('create')
      toast.success('Linked item added')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add linked item')
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

  const handleUpdateSectionName = async (sectionId: string) => {
    if (!editSectionName.trim()) { toast.error('Section name is required'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/sections?sectionId=${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSectionName.trim() })
      })
      if (!response.ok) throw new Error('Failed to update section name')
      await loadFFEData()
      setEditingSectionId(null)
      setEditSectionName('')
      toast.success('Section name updated')
    } catch (error) {
      toast.error('Failed to update section name')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateItemName = async (itemId: string) => {
    if (!editItemName.trim()) { toast.error('Item name is required'); return }
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editItemName.trim() })
      })
      if (!response.ok) throw new Error('Failed to update item name')
      await loadFFEData()
      setEditingItemId(null)
      setEditItemName('')
      toast.success('Item name updated')
    } catch (error) {
      toast.error('Failed to update item name')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProgramaLink = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programaLink: tempProgramaLink.trim() || null })
      })
      if (!response.ok) throw new Error('Failed to save Programa link')
      setProgramaLink(tempProgramaLink.trim())
      setEditingProgramaLink(false)
      toast.success('Programa link saved')
    } catch (error) {
      console.error('Error saving Programa link:', error)
      toast.error('Failed to save Programa link')
    } finally {
      setSaving(false)
    }
  }

  const handleAIImportItems = async (
    categories: Array<{ name: string; items: Array<{ name: string; description?: string; isCustom?: boolean; linkedItems?: string[] }> }>,
    selectedItems: Set<string>
  ) => {
    try {
      setSaving(true)
      const categoryMap = new Map<string, Array<{ name: string; description?: string; isCustom?: boolean; linkedItems?: string[] }>>()
      
      for (const key of selectedItems) {
        const [categoryName, itemName] = key.split('::')
        const category = categories.find(c => c.name === categoryName)
        const item = category?.items.find(i => i.name === itemName)
        if (item) {
          if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
          categoryMap.get(categoryName)!.push({ 
            name: item.name, 
            description: item.description,
            isCustom: item.isCustom,
            linkedItems: item.linkedItems
          })
        }
      }
      
      let totalItemsCreated = 0
      let linkedItemsCreated = 0
      
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
          // Create the main item
          const hasLinkedItems = item.isCustom && item.linkedItems && item.linkedItems.length > 0
          
          const createResponse = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sectionId, 
              name: item.name, 
              description: item.description || '', 
              quantity: 1, 
              visibility: 'VISIBLE',
              // If custom with linked items, mark as parent
              customFields: hasLinkedItems ? {
                hasChildren: true,
                linkedItems: item.linkedItems
              } : undefined
            })
          })
          
          totalItemsCreated++
          
          // If this is a custom item with linked items, create them
          if (hasLinkedItems && item.linkedItems) {
            const createdItem = await createResponse.json()
            const parentItemId = createdItem.data?.item?.id || createdItem.data?.id || createdItem.id
            
            if (parentItemId) {
              // Add each linked item using the linked-items API
              for (const linkedItemName of item.linkedItems) {
                try {
                  await fetch(`/api/ffe/v2/rooms/${roomId}/items/${parentItemId}/linked-items`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      action: 'add',
                      name: linkedItemName
                    })
                  })
                  linkedItemsCreated++
                } catch (linkedError) {
                  console.error(`Failed to add linked item "${linkedItemName}":`, linkedError)
                  // Continue adding other linked items even if one fails
                }
              }
            }
          }
        }
      }
      
      await loadFFEData()
      
      const linkedMsg = linkedItemsCreated > 0 ? ` (+ ${linkedItemsCreated} linked components)` : ''
      toast.success(`${totalItemsCreated} items imported to workspace${linkedMsg}!`)
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
    <div className="bg-slate-50/50 -mx-6 -my-6 min-h-screen">
      {/* Header with mode toggle */}
      <div className="bg-white border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-5">
          {/* Mode Toggle - Large, prominent */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="inline-flex rounded-full bg-slate-100/80 p-1.5 shadow-inner">
                <button className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-slate-900 shadow-md ring-1 ring-slate-200">
                  <Settings className="w-4 h-4 inline mr-2" />
                  Settings
                </button>
                <button
                  onClick={() => router.push(`/ffe/${roomId}/workspace`)}
                  className="px-6 py-2.5 text-sm font-semibold rounded-full text-slate-500 hover:text-slate-700 hover:bg-white/40 transition-all flex items-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  Workspace
                  {stats.visibleItems > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#e94d97]/10 text-[#e94d97] font-bold">{stats.visibleItems}</span>
                  )}
                </button>
              </div>
              
              {/* Rendering Gallery */}
              {renderingImages.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {renderingImages.slice(0, 4).map((img, idx) => (
                      <div 
                        key={img.id}
                        className="w-20 h-20 rounded-lg border-2 border-[#f6762e]/30 overflow-hidden cursor-pointer hover:border-[#f6762e] hover:scale-105 transition-all shadow-sm"
                        onClick={() => { setSelectedImageIndex(idx); setShowImageModal(true) }}
                        title={`Click to view ${img.filename}`}
                      >
                        <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {renderingImages.length > 4 && (
                      <div 
                        className="w-20 h-20 rounded-lg border-2 border-[#f6762e]/30 bg-[#f6762e]/10 flex items-center justify-center cursor-pointer hover:border-[#f6762e] transition-all"
                        onClick={() => { setSelectedImageIndex(0); setShowImageModal(true) }}
                      >
                        <span className="text-sm font-bold text-[#f6762e]">+{renderingImages.length - 4}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {stats.visibleItems > 0 && (
              <Button 
                onClick={() => router.push(`/ffe/${roomId}/workspace`)}
                className="bg-[#e94d97] hover:bg-[#e94d97]/90 text-white shadow-lg"
              >
                Go to Workspace
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Stats Grid - Using brand colors */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-gradient-to-br from-[#e94d97]/5 to-[#e94d97]/15 rounded-xl p-4 border border-[#e94d97]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#e94d97] flex items-center justify-center">
                    <FolderPlus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.sectionsCount}</div>
                    <div className="text-xs font-medium text-[#e94d97] uppercase tracking-wide">Sections</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-[#6366ea]/5 to-[#6366ea]/15 rounded-xl p-4 border border-[#6366ea]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#6366ea] flex items-center justify-center">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
                    <div className="text-xs font-medium text-[#6366ea] uppercase tracking-wide">Total Items</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-[#14b8a6]/5 to-[#14b8a6]/15 rounded-xl p-4 border border-[#14b8a6]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#14b8a6] flex items-center justify-center">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.visibleItems}</div>
                    <div className="text-xs font-medium text-[#14b8a6] uppercase tracking-wide">In Workspace</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-[#f6762e]/5 to-[#f6762e]/15 rounded-xl p-4 border border-[#f6762e]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f6762e] flex items-center justify-center">
                    <EyeOff className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.hiddenItems}</div>
              <div className="text-xs font-medium text-[#f6762e] uppercase tracking-wide">Not in Workspace</div>
                </div>
              </div>
            </div>
          </div>

          {/* Programa Link Section */}
          <div className="mb-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <LinkIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Programa Design Link</h4>
                  <p className="text-xs text-gray-500">Link to your item specifications schedule</p>
                </div>
              </div>
              
              {editingProgramaLink ? (
                <div className="flex items-center gap-2 flex-1 max-w-xl ml-4">
                  <Input
                    value={tempProgramaLink}
                    onChange={(e) => setTempProgramaLink(e.target.value)}
                    placeholder="https://app.programa.design/schedules2/schedules/..."
                    className="flex-1 text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveProgramaLink}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => { setEditingProgramaLink(false); setTempProgramaLink('') }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : programaLink ? (
                <div className="flex items-center gap-2 flex-1 max-w-xl ml-4">
                  <a 
                    href={programaLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-purple-600 hover:text-purple-800 truncate hover:underline"
                    title={programaLink}
                  >
                    {programaLink.replace('https://app.programa.design/', 'programa.design/')}
                  </a>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setTempProgramaLink(programaLink); setEditingProgramaLink(true) }}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    Edit
                  </Button>
                  <a 
                    href={programaLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button 
                      size="sm" 
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Open
                    </Button>
                  </a>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => { setTempProgramaLink(''); setEditingProgramaLink(true) }}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  disabled={disabled}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Link
                </Button>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            
            <div className="flex items-center gap-2">
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
              <Button size="sm" onClick={() => setShowAIGenerateDialog(true)} disabled={disabled} className="bg-[#e94d97] hover:bg-[#e94d97]/90 text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 py-6">
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

        {/* Add Linked Item Dialog */}
        <Dialog open={showAddLinkedItemDialog} onOpenChange={(open) => {
          setShowAddLinkedItemDialog(open)
          if (!open) {
            setLinkedItemName('')
            setLinkedItemDescription('')
            setSelectedParentItem(null)
            setLinkMode('create')
            setExistingItemSearch('')
            setSelectedExistingItem(null)
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-[#6366ea]" />
                Link Item
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedParentItem && (
                <div className="bg-[#6366ea]/5 rounded-lg p-3 border border-[#6366ea]/20">
                  <p className="text-xs text-[#6366ea] font-medium mb-1">Linking to:</p>
                  <p className="font-medium text-gray-900">{selectedParentItem.name}</p>
                </div>
              )}
              
              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                <button
                  onClick={() => setLinkMode('existing')}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    linkMode === 'existing' 
                      ? "bg-white text-[#6366ea] shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Link Existing Item
                </button>
                <button
                  onClick={() => setLinkMode('create')}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    linkMode === 'create' 
                      ? "bg-white text-[#6366ea] shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Create New Item
                </button>
              </div>

              {linkMode === 'existing' ? (
                <div className="space-y-3">
                  <div>
                    <Label>Search existing items</Label>
                    <Input 
                      value={existingItemSearch} 
                      onChange={(e) => setExistingItemSearch(e.target.value)} 
                      placeholder="Type to search items in this room..." 
                      className="mt-1.5" 
                    />
                  </div>
                  
                  {/* List of existing items to link */}
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {sections.flatMap(section => 
                      section.items
                        .filter(item => 
                          // Don't show the parent item itself
                          item.id !== selectedParentItem?.id &&
                          // Don't show items already linked to this parent
                          !(item.customFields?.isLinkedItem && item.customFields?.parentName === selectedParentItem?.name) &&
                          // Filter by search
                          (existingItemSearch === '' || item.name.toLowerCase().includes(existingItemSearch.toLowerCase()))
                        )
                        .map(item => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedExistingItem({ id: item.id, name: item.name, description: item.description })}
                            className={cn(
                              "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
                              selectedExistingItem?.id === item.id && "bg-[#6366ea]/10 border-l-2 border-l-[#6366ea]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-500">{section.name}</p>
                              </div>
                              {selectedExistingItem?.id === item.id && (
                                <Check className="w-4 h-4 text-[#6366ea]" />
                              )}
                            </div>
                          </div>
                        ))
                    )}
                    {sections.flatMap(s => s.items).filter(item => 
                      item.id !== selectedParentItem?.id &&
                      (existingItemSearch === '' || item.name.toLowerCase().includes(existingItemSearch.toLowerCase()))
                    ).length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No items found. Try creating a new linked item instead.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label>New Linked Item Name</Label>
                    <Input value={linkedItemName} onChange={(e) => setLinkedItemName(e.target.value)} placeholder="e.g., Hardware, Installation" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Textarea value={linkedItemDescription} onChange={(e) => setLinkedItemDescription(e.target.value)} placeholder="Optional description..." rows={2} className="mt-1.5" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { 
                setShowAddLinkedItemDialog(false)
                setLinkedItemName('')
                setLinkedItemDescription('')
                setSelectedParentItem(null)
                setLinkMode('create')
                setExistingItemSearch('')
                setSelectedExistingItem(null)
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddLinkedItem} 
                disabled={saving || (linkMode === 'create' ? !linkedItemName.trim() : !selectedExistingItem)} 
                className="bg-[#6366ea] hover:bg-[#6366ea]/90"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                {linkMode === 'existing' ? 'Link Selected Item' : 'Create & Link Item'}
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
                <Button onClick={() => setShowAIGenerateDialog(true)} className="bg-[#e94d97] hover:bg-[#e94d97]/90 text-white">
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
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onClick={() => toggleSectionExpanded(section.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        {section.isExpanded ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                      </button>
                      <div className="flex-1">
                        {editingSectionId === section.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Input
                              value={editSectionName}
                              onChange={(e) => setEditSectionName(e.target.value)}
                              className="h-8 w-48"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateSectionName(section.id)
                                if (e.key === 'Escape') { setEditingSectionId(null); setEditSectionName('') }
                              }}
                            />
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateSectionName(section.id)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(null); setEditSectionName('') }} className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/section">
                            <h3 className="font-semibold text-gray-900">{section.name}</h3>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingSectionId(section.id); setEditSectionName(section.name) }}
                              className="opacity-0 group-hover/section:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                              title="Edit section name"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{parentItems.length} items</span>
                          {visibleCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-[#14b8a6] font-medium">{visibleCount} in workspace</span>
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
                    <div>
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
                              <div 
                                key={item.id} 
                                className={cn(
                                  "p-4 transition-colors",
                                  isInWorkspace 
                                    ? "bg-[#14b8a6]/5 border-l-4 border-l-[#14b8a6]" 
                                    : "hover:bg-gray-50 opacity-70"
                                )}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Lock icon or spacer for consistent alignment */}
                                      <div className="w-4 h-4 flex-shrink-0">
                                        {isInWorkspace && (
                                          <Lock className="w-4 h-4 text-[#14b8a6]" />
                                        )}
                                      </div>
                                      {editingItemId === item.id ? (
                                        <div className="flex items-center gap-2">
                                          <Input
                                            value={editItemName}
                                            onChange={(e) => setEditItemName(e.target.value)}
                                            className="h-7 w-40 text-sm"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleUpdateItemName(item.id)
                                              if (e.key === 'Escape') { setEditingItemId(null); setEditItemName('') }
                                            }}
                                          />
                                          <Button size="sm" variant="ghost" onClick={() => handleUpdateItemName(item.id)} className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                                            <Check className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button size="sm" variant="ghost" onClick={() => { setEditingItemId(null); setEditItemName('') }} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600">
                                            <X className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 group/item">
                                          <h4 className={cn("font-medium", isInWorkspace ? "text-gray-900" : "text-gray-500")}>{item.name}</h4>
                                          <button 
                                            onClick={() => { setEditingItemId(item.id); setEditItemName(item.name) }}
                                            className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-opacity"
                                            title="Edit item name"
                                          >
                                            <Pencil className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                                          </button>
                                        </div>
                                      )}
                                      {item.quantity > 1 && (
                                        <Badge variant="outline" className="text-xs">{item.quantity}x</Badge>
                                      )}
                                      {linkedChildren.length > 0 && (
                                        <Badge variant="outline" className="text-xs bg-[#6366ea]/5 text-[#6366ea] border-[#6366ea]/20">
                                          <LinkIcon className="w-3 h-3 mr-1" />
                                          {linkedChildren.length} linked
                                        </Badge>
                                      )}
                                      {isInWorkspace && (
                                        <Badge className="bg-[#14b8a6]/10 text-[#14b8a6] text-xs">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          In Workspace
                                        </Badge>
                                      )}
                                    </div>
                                    {item.description && (
                                      <button 
                                        onClick={() => {
                                          setExpandedDescriptions(prev => {
                                            const newSet = new Set(prev)
                                            if (newSet.has(item.id)) {
                                              newSet.delete(item.id)
                                            } else {
                                              newSet.add(item.id)
                                            }
                                            return newSet
                                          })
                                        }}
                                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-0.5"
                                      >
                                        <Info className="w-3 h-3" />
                                        {expandedDescriptions.has(item.id) ? 'Hide details' : 'Show details'}
                                      </button>
                                    )}
                                    {item.description && expandedDescriptions.has(item.id) && (
                                      <p className="text-xs text-gray-500 mt-1 pl-4 border-l-2 border-gray-200">{item.description}</p>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Add Linked Item Button */}
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => {
                                        setSelectedParentItem({ id: item.id, name: item.name, sectionId: section.id })
                                        setShowAddLinkedItemDialog(true)
                                      }}
                                      className="text-[#6366ea] hover:bg-[#6366ea]/10"
                                    >
                                      <LinkIcon className="w-4 h-4 mr-1" />
                                      Link
                                    </Button>
                                    
                                    {isInWorkspace ? (
                                      <Button size="sm" variant="outline" onClick={() => handleVisibilityChange(item.id, 'HIDDEN')} className="text-[#f6762e] border-[#f6762e]/30 hover:bg-[#f6762e]/10">
                                        <EyeOff className="w-4 h-4 mr-1" />
                                        Remove
                                      </Button>
                                    ) : (
                                      <Button size="sm" onClick={() => handleVisibilityChange(item.id, 'VISIBLE')} className="bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white">
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
                                  <div className="mt-3 ml-6 pl-4 border-l-2 border-[#6366ea]/30 space-y-2">
                                    {linkedChildren.map(child => (
                                      <div key={child.id} className={cn(
                                        "flex items-center justify-between py-2 px-3 rounded-lg",
                                        child.visibility === 'VISIBLE' ? "bg-[#14b8a6]/5" : "bg-gray-50"
                                      )}>
                                        <div className="flex items-center gap-2">
                                          <LinkIcon className="w-3 h-3 text-[#6366ea]" />
                                          <span className="text-sm text-gray-700">{child.name}</span>
                                          {child.visibility === 'VISIBLE' && (
                                            <Badge className="bg-[#14b8a6]/10 text-[#14b8a6] text-xs">In Workspace</Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {child.visibility === 'VISIBLE' ? (
                                            <Button size="sm" variant="ghost" onClick={() => handleVisibilityChange(child.id, 'HIDDEN')} className="h-7 text-xs text-[#f6762e]">
                                              Remove
                                            </Button>
                                          ) : (
                                            <Button size="sm" variant="ghost" onClick={() => handleVisibilityChange(child.id, 'VISIBLE')} className="h-7 text-xs text-[#14b8a6]">
                                              Add
                                            </Button>
                                          )}
                                          <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(child.id)} className="h-7 text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
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

      {/* Image Lightbox Modal */}
      {showImageModal && renderingImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
          
          {/* Main image area */}
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Previous button */}
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === 0 ? renderingImages.length - 1 : prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            )}
            
            {/* Current image */}
            <img 
              src={renderingImages[selectedImageIndex]?.url} 
              alt={renderingImages[selectedImageIndex]?.filename || '3D Rendering'} 
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* Next button */}
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === renderingImages.length - 1 ? 0 : prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          
          {/* Image info */}
          <div className="text-center text-white mt-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-medium">{renderingImages[selectedImageIndex]?.filename || '3D Rendering'}</p>
            <p className="text-white/60 text-sm">{roomName} • {selectedImageIndex + 1} of {renderingImages.length}</p>
          </div>
          
          {/* Thumbnail strip */}
          {renderingImages.length > 1 && (
            <div className="flex items-center gap-2 mt-4 overflow-x-auto max-w-full px-4 pb-2" onClick={(e) => e.stopPropagation()}>
              {renderingImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all",
                    idx === selectedImageIndex 
                      ? "ring-2 ring-[#f6762e] ring-offset-2 ring-offset-black scale-105" 
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
