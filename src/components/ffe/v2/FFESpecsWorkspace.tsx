'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  MoreHorizontal,
  Package,
  Search,
  Truck,
  FileText,
  ShoppingCart,
  Clock,
  Eye,
  Pencil
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import ImageEditorModal from '@/components/image/ImageEditorModal'

// Spec status options
const SPEC_STATUS = {
  NEEDS_SPEC: { label: 'Needs Spec', color: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  SPEC_ADDED: { label: 'Spec Added', color: 'bg-blue-100 text-blue-800', icon: FileText },
  QUOTED: { label: 'Quoted', color: 'bg-purple-100 text-purple-800', icon: FileText },
  ORDERED: { label: 'Ordered', color: 'bg-indigo-100 text-indigo-800', icon: ShoppingCart },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: Package },
  INSTALLED: { label: 'Installed', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
} as const

type SpecStatusType = keyof typeof SPEC_STATUS

interface FFESpecItem {
  id: string
  name: string
  description?: string
  sectionId: string
  sectionName: string
  quantity: number
  // Spec fields (from customFields or direct)
  brand?: string
  sku?: string
  docCode?: string
  colour?: string
  finish?: string
  material?: string
  width?: string
  length?: string
  height?: string
  depth?: string
  rrp?: number
  tradePrice?: number
  leadTime?: string
  supplierName?: string
  supplierLink?: string
  notes?: string
  imageUrl?: string
  images?: string[]
  // Status
  hasSpec: boolean
  specStatus: SpecStatusType
  // Original state from FFE
  state: string
  visibility: string
}

interface FFESpecsWorkspaceProps {
  roomId: string
  roomName: string
}

interface FFESection {
  id: string
  name: string
  items: FFESpecItem[]
}

export default function FFESpecsWorkspace({ roomId, roomName }: FFESpecsWorkspaceProps) {
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<FFESpecItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<FFESpecItem>>({})
  const [saving, setSaving] = useState(false)
  
  // Image editor modal state
  const [imageEditorModal, setImageEditorModal] = useState<{
    open: boolean
    imageUrl: string
    imageTitle: string
    itemId: string | null
    sectionName: string
  }>({ open: false, imageUrl: '', imageTitle: '', itemId: null, sectionName: '' })

  useEffect(() => {
    loadItems()
  }, [roomId])

  const loadItems = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}?includeHidden=false`)
      if (!response.ok) throw new Error('Failed to fetch FFE data')

      const result = await response.json()
      if (result.success && result.data) {
        const loadedSections: FFESection[] = []
        
        result.data.sections?.forEach((section: any) => {
          const sectionItems: FFESpecItem[] = []
          
          section.items?.forEach((item: any) => {
            // Only include VISIBLE items
            if (item.visibility !== 'VISIBLE') return
            
            // Extract spec fields from customFields
            const customFields = item.customFields || {}
            const attachments = item.attachments || {}
            
            // Determine if item has spec data
            const hasSpec = !!(
              item.supplierName || 
              item.supplierLink || 
              customFields.brand ||
              customFields.colour ||
              customFields.finish ||
              customFields.material
            )
            
            sectionItems.push({
              id: item.id,
              name: item.name,
              description: item.description,
              sectionId: section.id,
              sectionName: section.name,
              quantity: item.quantity || 1,
              // Map spec fields
              brand: customFields.brand || item.supplierName,
              sku: customFields.sku || item.modelNumber,
              docCode: customFields.docCode,
              colour: customFields.colour,
              finish: customFields.finish,
              material: customFields.material,
              width: customFields.width,
              length: customFields.length,
              height: customFields.height,
              depth: customFields.depth,
              rrp: customFields.rrp ? parseFloat(customFields.rrp) : item.unitCost,
              tradePrice: customFields.tradePrice ? parseFloat(customFields.tradePrice) : undefined,
              leadTime: customFields.leadTime,
              supplierName: item.supplierName || customFields.brand,
              supplierLink: item.supplierLink,
              notes: item.notes,
              imageUrl: attachments.images?.[0]?.url,
              images: attachments.images?.map((img: any) => img.url) || [],
              hasSpec,
              specStatus: hasSpec ? 'SPEC_ADDED' : 'NEEDS_SPEC',
              state: item.state,
              visibility: item.visibility
            })
          })
          
          if (sectionItems.length > 0) {
            loadedSections.push({
              id: section.id,
              name: section.name,
              items: sectionItems
            })
          }
        })
        
        setSections(loadedSections)
        // Expand all sections by default
        setExpandedSections(new Set(loadedSections.map(s => s.id)))
      }
    } catch (error) {
      console.error('Error loading items:', error)
      toast.error('Failed to load FFE items')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (itemId: string, newStatus: SpecStatusType) => {
    // Update local state optimistically
    setSections(prev => prev.map(section => ({
      ...section,
      items: section.items.map(item => 
        item.id === itemId ? { ...item, specStatus: newStatus } : item
      )
    })))
    
    // TODO: Save to backend
    toast.success(`Status updated to ${SPEC_STATUS[newStatus].label}`)
  }

  // Open edit dialog
  const handleEditSpec = (item: FFESpecItem) => {
    setEditingItem(item)
    setEditForm({
      brand: item.brand || '',
      sku: item.sku || '',
      colour: item.colour || '',
      finish: item.finish || '',
      material: item.material || '',
      width: item.width || '',
      length: item.length || '',
      height: item.height || '',
      depth: item.depth || '',
      rrp: item.rrp,
      tradePrice: item.tradePrice,
      leadTime: item.leadTime || '',
      supplierName: item.supplierName || '',
      supplierLink: item.supplierLink || '',
      notes: item.notes || '',
      description: item.description || ''
    })
  }

  // Save edited spec
  const handleSaveSpec = async () => {
    if (!editingItem) return
    
    setSaving(true)
    try {
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: editForm.brand || editForm.supplierName,
          supplierLink: editForm.supplierLink,
          modelNumber: editForm.sku,
          notes: editForm.notes,
          description: editForm.description,
          unitCost: editForm.rrp,
          customFields: {
            brand: editForm.brand,
            sku: editForm.sku,
            colour: editForm.colour,
            finish: editForm.finish,
            material: editForm.material,
            width: editForm.width,
            length: editForm.length,
            height: editForm.height,
            depth: editForm.depth,
            tradePrice: editForm.tradePrice,
            leadTime: editForm.leadTime
          }
        })
      })

      if (response.ok) {
        // Update local state
        setSections(prev => prev.map(section => ({
          ...section,
          items: section.items.map(item => {
            if (item.id === editingItem.id) {
              return {
                ...item,
                ...editForm,
                hasSpec: true,
                specStatus: 'SPEC_ADDED' as SpecStatusType
              }
            }
            return item
          })
        })))
        toast.success('Spec saved successfully')
        setEditingItem(null)
      } else {
        toast.error('Failed to save spec')
      }
    } catch (error) {
      console.error('Error saving spec:', error)
      toast.error('Failed to save spec')
    } finally {
      setSaving(false)
    }
  }

  const toggleRowExpanded = (itemId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const toggleSectionExpanded = (sectionKey: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey)
      } else {
        newSet.add(sectionKey)
      }
      return newSet
    })
  }

  // Filter sections and items
  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sectionName.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || item.specStatus === statusFilter
      
      return matchesSearch && matchesStatus
    })
  })).filter(section => section.items.length > 0)

  // Stats
  const allItems = sections.flatMap(s => s.items)
  const stats = {
    total: allItems.length,
    needsSpec: allItems.filter(i => i.specStatus === 'NEEDS_SPEC').length,
    hasSpec: allItems.filter(i => i.specStatus !== 'NEEDS_SPEC').length,
    ordered: allItems.filter(i => ['ORDERED', 'SHIPPED', 'DELIVERED', 'INSTALLED'].includes(i.specStatus)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Items</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-700">{stats.needsSpec}</div>
            <div className="text-sm text-amber-600">Needs Spec</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{stats.hasSpec}</div>
            <div className="text-sm text-blue-600">Has Spec</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{stats.ordered}</div>
            <div className="text-sm text-green-600">Ordered+</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items, brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(SPEC_STATUS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sections by Category */}
      {filteredSections.map((section) => {
        const needsSpecCount = section.items.filter(i => i.specStatus === 'NEEDS_SPEC').length
        const hasSpecCount = section.items.filter(i => i.specStatus !== 'NEEDS_SPEC').length
        
        return (
          <Collapsible 
            key={section.id}
            open={expandedSections.has(section.id)}
            onOpenChange={() => toggleSectionExpanded(section.id)}
          >
            <Card className="border-gray-200 overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedSections.has(section.id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                      <CardTitle className="text-base font-semibold text-gray-800">
                        {section.name}
                      </CardTitle>
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                        {section.items.length}
                      </Badge>
                      {needsSpecCount > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {needsSpecCount} needs spec
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <SpecTable 
                    items={section.items} 
                    expandedRows={expandedRows}
                    onToggleRow={toggleRowExpanded}
                    onStatusChange={handleStatusChange}
                    onEditSpec={handleEditSpec}
                    onImageClick={(item) => {
                      if (item.imageUrl) {
                        setImageEditorModal({
                          open: true,
                          imageUrl: item.imageUrl,
                          imageTitle: `${item.sectionName}: ${item.name}`,
                          itemId: item.id,
                          sectionName: item.sectionName
                        })
                      }
                    }}
                    roomId={roomId}
                    onNotesUpdated={(itemId, notes) => {
                      // Update the item in local state
                      setSections(prev => prev.map(s => ({
                        ...s,
                        items: s.items.map(i => 
                          i.id === itemId ? { ...i, notes } : i
                        )
                      })))
                    }}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}

      {/* Empty State */}
      {allItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Items Yet</h3>
            <p>Go to Settings to add items to this room first.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Spec Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Spec: {editingItem?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Brand/Supplier */}
            <div className="space-y-2">
              <Label htmlFor="edit-brand">Brand / Supplier</Label>
              <Input
                id="edit-brand"
                value={editForm.brand || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="e.g. West Elm"
              />
            </div>
            
            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="edit-sku">SKU / Model Number</Label>
              <Input
                id="edit-sku"
                value={editForm.sku || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="e.g. WE-12345"
              />
            </div>
            
            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="edit-colour">Color</Label>
              <Input
                id="edit-colour"
                value={editForm.colour || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, colour: e.target.value }))}
                placeholder="e.g. Walnut"
              />
            </div>
            
            {/* Finish */}
            <div className="space-y-2">
              <Label htmlFor="edit-finish">Finish</Label>
              <Input
                id="edit-finish"
                value={editForm.finish || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, finish: e.target.value }))}
                placeholder="e.g. Matte"
              />
            </div>
            
            {/* Material */}
            <div className="space-y-2">
              <Label htmlFor="edit-material">Material</Label>
              <Input
                id="edit-material"
                value={editForm.material || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, material: e.target.value }))}
                placeholder="e.g. Solid Oak"
              />
            </div>
            
            {/* Lead Time */}
            <div className="space-y-2">
              <Label htmlFor="edit-leadTime">Lead Time</Label>
              <Input
                id="edit-leadTime"
                value={editForm.leadTime || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, leadTime: e.target.value }))}
                placeholder="e.g. 4-6 weeks"
              />
            </div>
            
            {/* Dimensions */}
            <div className="col-span-2">
              <Label className="mb-2 block">Dimensions</Label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Input
                    placeholder="Width"
                    value={editForm.width || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, width: e.target.value }))}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Length"
                    value={editForm.length || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, length: e.target.value }))}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Height"
                    value={editForm.height || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, height: e.target.value }))}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Depth"
                    value={editForm.depth || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, depth: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            
            {/* Pricing */}
            <div className="space-y-2">
              <Label htmlFor="edit-rrp">RRP / Price</Label>
              <Input
                id="edit-rrp"
                type="number"
                value={editForm.rrp || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, rrp: parseFloat(e.target.value) || undefined }))}
                placeholder="e.g. 1299"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-trade">Trade Price</Label>
              <Input
                id="edit-trade"
                type="number"
                value={editForm.tradePrice || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, tradePrice: parseFloat(e.target.value) || undefined }))}
                placeholder="e.g. 999"
              />
            </div>
            
            {/* Supplier Link */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-link">Supplier Link</Label>
              <Input
                id="edit-link"
                value={editForm.supplierLink || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, supplierLink: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            
            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditingItem(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpec} disabled={saving}>
              {saving ? 'Saving...' : 'Save Spec'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Editor Modal */}
      <ImageEditorModal
        open={imageEditorModal.open}
        onOpenChange={(open) => setImageEditorModal(prev => ({ ...prev, open }))}
        imageUrl={imageEditorModal.imageUrl}
        imageTitle={imageEditorModal.imageTitle}
        onImageUpdated={async (newImageUrl) => {
          // Update the item with the new image URL
          if (imageEditorModal.itemId) {
            try {
              const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${imageEditorModal.itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  images: [newImageUrl]
                })
              })
              
              if (res.ok) {
                // Refresh the items list
                loadItems()
                toast.success('Image updated successfully!')
              }
            } catch (error) {
              console.error('Error updating image:', error)
            }
          }
        }}
      />
    </div>
  )
}

// Spec Table Component
function SpecTable({ 
  items, 
  expandedRows, 
  onToggleRow,
  onStatusChange,
  onEditSpec,
  onImageClick,
  roomId,
  onNotesUpdated
}: { 
  items: FFESpecItem[]
  expandedRows: Set<string>
  onToggleRow: (id: string) => void
  onStatusChange: (id: string, status: SpecStatusType) => void
  onEditSpec: (item: FFESpecItem) => void
  onImageClick: (item: FFESpecItem) => void
  roomId: string
  onNotesUpdated: (itemId: string, notes: string) => void
}) {
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const handleEditNotes = (item: FFESpecItem) => {
    setEditingNotesId(item.id)
    setNotesValue(item.notes || '')
  }

  const handleSaveNotes = async (itemId: string) => {
    try {
      setSavingNotes(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue })
      })

      if (response.ok) {
        onNotesUpdated(itemId, notesValue)
        toast.success('Notes saved')
        setEditingNotesId(null)
      } else {
        throw new Error('Failed to save notes')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCancelNotes = () => {
    setEditingNotesId(null)
    setNotesValue('')
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50">
          <TableHead className="w-10"></TableHead>
          <TableHead className="w-12"></TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Dimensions</TableHead>
          <TableHead>Color</TableHead>
          <TableHead>Finish</TableHead>
          <TableHead className="text-center">Qty</TableHead>
          <TableHead>Lead Time</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {/* Main Row */}
            <TableRow 
              className={cn(
                "cursor-pointer hover:bg-gray-50 transition-colors",
                expandedRows.has(item.id) && "bg-gray-50"
              )}
              onClick={() => onToggleRow(item.id)}
            >
              <TableCell className="py-3">
                {expandedRows.has(item.id) ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </TableCell>
              <TableCell>
                {item.imageUrl ? (
                  <div 
                    className="w-10 h-10 rounded border overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-purple-400 hover:ring-offset-1 transition-all"
                    onClick={(e) => {
                      e.stopPropagation()
                      onImageClick(item)
                    }}
                    title="Click to view/edit image"
                  >
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded border bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-gray-400" />
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.sectionName}</div>
                </div>
              </TableCell>
              <TableCell>
                {item.brand ? (
                  <span className="text-gray-900">{item.brand}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {(item.width || item.length || item.height || item.depth) ? (
                  <div className="text-sm">
                    {item.width && <span>{item.width}</span>}
                    {item.length && <span> × {item.length}</span>}
                    {item.height && <span> × {item.height}</span>}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.colour ? (
                  <span className="text-gray-900">{item.colour}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {item.finish ? (
                  <span className="text-gray-900">{item.finish}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{item.quantity}</Badge>
              </TableCell>
              <TableCell>
                {item.leadTime ? (
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3 text-gray-400" />
                    {item.leadTime}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Select 
                  value={item.specStatus} 
                  onValueChange={(value) => onStatusChange(item.id, value as SpecStatusType)}
                >
                  <SelectTrigger className={cn(
                    "h-8 text-xs w-32",
                    SPEC_STATUS[item.specStatus].color
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPEC_STATUS).map(([key, { label, color }]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn("px-2 py-0.5 rounded text-xs", color)}>
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onToggleRow(item.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditSpec(item)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Spec
                    </DropdownMenuItem>
                    {item.supplierLink && (
                      <DropdownMenuItem asChild>
                        <a href={item.supplierLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Supplier
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>

            {/* Expanded Details Row */}
            {expandedRows.has(item.id) && (
              <TableRow className="bg-gray-50">
                <TableCell colSpan={11} className="p-4">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Left: Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Details</h4>
                      {item.description && (
                        <p className="text-sm text-gray-600">{item.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {item.sku && (
                          <div>
                            <span className="text-gray-500">SKU:</span> {item.sku}
                          </div>
                        )}
                        {item.docCode && (
                          <div>
                            <span className="text-gray-500">Doc Code:</span> {item.docCode}
                          </div>
                        )}
                        {item.material && (
                          <div>
                            <span className="text-gray-500">Material:</span> {item.material}
                          </div>
                        )}
                        {item.depth && (
                          <div>
                            <span className="text-gray-500">Depth:</span> {item.depth}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Pricing & Supplier */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Pricing & Supplier</h4>
                      <div className="space-y-2 text-sm">
                        {item.rrp && (
                          <div>
                            <span className="text-gray-500">RRP:</span>{' '}
                            <span className="font-medium">${item.rrp.toLocaleString()}</span>
                          </div>
                        )}
                        {item.tradePrice && (
                          <div>
                            <span className="text-gray-500">Trade:</span>{' '}
                            <span className="font-medium text-green-600">${item.tradePrice.toLocaleString()}</span>
                          </div>
                        )}
                        {item.supplierName && (
                          <div>
                            <span className="text-gray-500">Supplier:</span> {item.supplierName}
                          </div>
                        )}
                        {item.supplierLink && (
                          <a 
                            href={item.supplierLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Product Page
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Right: Images */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Images</h4>
                      {item.images && item.images.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {item.images.slice(0, 4).map((img, idx) => (
                            <div 
                              key={idx}
                              className="w-16 h-16 rounded border overflow-hidden bg-gray-100"
                            >
                              <img 
                                src={img} 
                                alt={`${item.name} ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {item.images.length > 4 && (
                            <div className="w-16 h-16 rounded border bg-gray-100 flex items-center justify-center">
                              <span className="text-sm text-gray-500">+{item.images.length - 4}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No images attached</div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-700">Notes</h4>
                      {editingNotesId !== item.id && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleEditNotes(item)}
                          className="h-7 px-2 text-gray-500 hover:text-gray-700"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {item.notes ? 'Edit' : 'Add Note'}
                        </Button>
                      )}
                    </div>
                    {editingNotesId === item.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add notes about this item..."
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleSaveNotes(item.id)}
                            disabled={savingNotes}
                          >
                            {savingNotes ? 'Saving...' : 'Save'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={handleCancelNotes}
                            disabled={savingNotes}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : item.notes ? (
                      <p className="text-sm text-gray-600">{item.notes}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No notes added</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEditSpec(item)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit Spec
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileText className="h-4 w-4 mr-1" />
                      Request Quote
                    </Button>
                    {item.supplierLink && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={item.supplierLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Source
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
