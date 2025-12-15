'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronUp, ChevronDown, Upload, Link as LinkIcon, ExternalLink, Edit, Trash2, Loader2, Plus, UserPlus, ImageIcon, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  contactName?: string
  email: string
  phone?: string
}

interface AvailableRoom {
  id: string
  name: string
  sections: Array<{ id: string; name: string }>
}

// FFE Item structure for linking
interface FFEItem {
  id: string
  name: string
  description?: string
  hasLinkedSpecs: boolean
  linkedSpecsCount: number
  status: string
}

interface FFESection {
  sectionId: string
  sectionName: string
  items: FFEItem[]
}

interface FFERoom {
  roomId: string
  roomName: string
  sections: FFESection[]
}

interface ItemDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  item?: {
    id: string
    name: string
    roomId?: string
    sectionId?: string
    roomName?: string
    sectionName?: string
    description?: string
    sku?: string
    productName?: string
    brand?: string
    quantity?: number
    supplierName?: string
    supplierLink?: string
    supplierId?: string
    thumbnailUrl?: string
    images?: string[]
    unitCost?: number
    tradePrice?: number
    rrp?: number
    tradeDiscount?: number
    specStatus?: string
    leadTime?: string
    color?: string
    finish?: string
    material?: string
    width?: string
    height?: string
    depth?: string
    length?: string
    roomIds?: string[]
    ffeRequirementId?: string
  } | null
  mode: 'view' | 'edit' | 'create'
  sectionId?: string
  roomId?: string
  availableRooms?: AvailableRoom[]
  // FFE linking props
  ffeItems?: FFERoom[]
  ffeItemsLoading?: boolean
  onSave?: () => void
  onNavigate?: (direction: 'prev' | 'next') => void
  hasNext?: boolean
  hasPrev?: boolean
}

const LEAD_TIME_OPTIONS = [
  { value: '1-2 weeks', label: '1-2 Weeks' },
  { value: '2-4 weeks', label: '2-4 Weeks' },
  { value: '4-6 weeks', label: '4-6 Weeks' },
  { value: '6-8 weeks', label: '6-8 Weeks' },
  { value: '8-12 weeks', label: '8-12 Weeks' },
  { value: '12+ weeks', label: '12+ Weeks' },
]


export function ItemDetailPanel({
  isOpen,
  onClose,
  item,
  mode,
  sectionId,
  roomId,
  availableRooms = [],
  ffeItems = [],
  ffeItemsLoading = false,
  onSave,
  onNavigate,
  hasNext = false,
  hasPrev = false,
}: ItemDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // FFE Linking state - cascading selection
  const [selectedFfeRoom, setSelectedFfeRoom] = useState<string>('')
  const [selectedFfeSection, setSelectedFfeSection] = useState<string>('')
  const [selectedFfeItemId, setSelectedFfeItemId] = useState<string>('')
  const [showAlreadyChosenWarning, setShowAlreadyChosenWarning] = useState(false)
  
  // Get filtered sections based on selected room
  const filteredFfeSections = selectedFfeRoom 
    ? ffeItems.find(r => r.roomId === selectedFfeRoom)?.sections || []
    : []
  
  // Get filtered items based on selected section
  const filteredFfeItemsList = selectedFfeSection
    ? filteredFfeSections.find(s => s.sectionId === selectedFfeSection)?.items || []
    : []
  
  // Get selected FFE item details
  const selectedFfeItem = selectedFfeItemId && selectedFfeRoom && selectedFfeSection
    ? (() => {
        const room = ffeItems.find(r => r.roomId === selectedFfeRoom)
        const section = room?.sections.find(s => s.sectionId === selectedFfeSection)
        const item = section?.items.find(i => i.id === selectedFfeItemId)
        if (room && section && item) {
          return {
            roomId: room.roomId,
            roomName: room.roomName,
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            itemId: item.id,
            itemName: item.name,
            hasLinkedSpecs: item.hasLinkedSpecs,
            linkedSpecsCount: item.linkedSpecsCount
          }
        }
        return null
      })()
    : null
  
  // Add New Supplier modal
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    notes: ''
  })
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',         // SKU / Model number
    docCode: '',     // Document Code (separate from SKU)
    productName: '',
    brand: '',
    quantity: 1,
    supplierName: '',
    supplierLink: '',
    supplierId: '',
    leadTime: '',
    color: '',
    finish: '',
    material: '',
    width: '',
    height: '',
    depth: '',
    length: '',
    tradePrice: '',
    rrp: '',
    tradeDiscount: '',
    notes: '',
  })
  
  const [images, setImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  
  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (images.length >= 2) {
      toast.error('Maximum 2 images allowed')
      return
    }
    
    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }
    
    setUploadingImage(true)
    try {
      // Convert to base64 for now (can be replaced with actual upload)
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setImages(prev => [...prev, result].slice(0, 2))
        setUploadingImage(false)
      }
      reader.onerror = () => {
        toast.error('Failed to read image')
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Failed to upload image')
      setUploadingImage(false)
    }
  }
  
  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }
  
  // Load suppliers
  useEffect(() => {
    const loadSuppliers = async () => {
      setLoadingSuppliers(true)
      try {
        const res = await fetch('/api/suppliers')
        const data = await res.json()
        if (data.suppliers) {
          setSuppliers(data.suppliers)
        }
      } catch (error) {
        console.error('Failed to load suppliers:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    
    if (isOpen) {
      loadSuppliers()
    }
  }, [isOpen])
  
  // Create new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.email) {
      toast.error('Business name and email are required')
      return
    }
    
    setSavingSupplier(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier)
      })
      
      if (res.ok) {
        const data = await res.json()
        // Add to local suppliers list
        setSuppliers(prev => [...prev, data.supplier])
        // Select the new supplier
        setFormData(prev => ({
          ...prev,
          supplierId: data.supplier.id,
          supplierName: data.supplier.contactName 
            ? `${data.supplier.name} / ${data.supplier.contactName}`
            : data.supplier.name
        }))
        // Reset and close modal
        setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '' })
        setShowAddSupplier(false)
        toast.success('Supplier added to phonebook')
      } else {
        throw new Error('Failed to create supplier')
      }
    } catch (error) {
      console.error('Failed to create supplier:', error)
      toast.error('Failed to create supplier')
    } finally {
      setSavingSupplier(false)
    }
  }
  
  // Initialize form with item data
  useEffect(() => {
    if (item && (mode === 'view' || mode === 'edit')) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        sku: (item as any).sku || '',
        docCode: (item as any).docCode || '',
        productName: item.productName || '',
        brand: item.brand || '',
        quantity: item.quantity || 1,
        supplierName: item.supplierName || '',
        supplierLink: item.supplierLink || '',
        supplierId: item.supplierId || '',
        leadTime: item.leadTime || '',
        color: item.color || '',
        finish: item.finish || '',
        material: item.material || '',
        width: item.width || '',
        height: item.height || '',
        depth: item.depth || '',
        length: item.length || '',
        tradePrice: item.tradePrice?.toString() || '',
        rrp: item.rrp?.toString() || '',
        tradeDiscount: item.tradeDiscount?.toString() || '',
        notes: (item as any).notes || '',
      })
      setImages(item.images || (item.thumbnailUrl ? [item.thumbnailUrl] : []))
      // Set rooms - either from roomIds array or from single roomId
      setSelectedRoomIds(item.roomIds || (item.roomId ? [item.roomId] : []))
    } else if (mode === 'create') {
      // Reset form for new item
      setFormData({
        name: '',
        description: '',
        sku: '',
        docCode: '',
        productName: '',
        brand: '',
        quantity: 1,
        supplierName: '',
        supplierLink: '',
        supplierId: '',
        leadTime: '',
        color: '',
        finish: '',
        material: '',
        width: '',
        height: '',
        depth: '',
        length: '',
        tradePrice: '',
        rrp: '',
        tradeDiscount: '',
        notes: '',
      })
      setImages([])
      // Set initial room from prop if provided
      setSelectedRoomIds(roomId ? [roomId] : [])
      // Reset FFE selection
      setSelectedFfeRoom('')
      setSelectedFfeSection('')
      setSelectedFfeItemId('')
      setShowAlreadyChosenWarning(false)
    }
  }, [item, mode, roomId])
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required')
      return
    }
    
    setSaving(true)
    try {
      const targetRoomId = item?.roomId || roomId
      const targetSectionId = item?.sectionId || sectionId
      
      if (mode === 'create' && targetRoomId && targetSectionId) {
        // Determine if this is an option (FFE item already has specs)
        const isOption = selectedFfeItem?.hasLinkedSpecs || false
        const optionNumber = isOption ? (selectedFfeItem?.linkedSpecsCount || 0) + 1 : null
        
        // Use the section from FFE item if linked, otherwise use the target section
        const finalSectionId = selectedFfeItem?.sectionId || targetSectionId
        
        // Create new item with FFE linking if selected
        const res = await fetch(`/api/ffe/v2/rooms/${selectedFfeItem?.roomId || targetRoomId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId: finalSectionId,
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            leadTime: formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            images: images,
            // FFE Linking fields
            isSpecItem: true,
            ffeRequirementId: selectedFfeItem?.itemId || null,
            isOption: isOption,
            optionNumber: optionNumber,
            specStatus: 'SELECTED',
            visibility: 'VISIBLE',
          })
        })
        
        if (res.ok) {
          const linkedMsg = selectedFfeItem 
            ? ` and linked to "${selectedFfeItem.itemName}"${isOption ? ` as Option #${optionNumber}` : ''}`
            : ''
          toast.success(`Item created${linkedMsg}`)
          onSave?.()
          onClose()
        } else {
          throw new Error('Failed to create item')
        }
      } else if ((mode === 'edit' || mode === 'view') && item?.id && targetRoomId) {
        // Update existing item
        const res = await fetch(`/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            productName: formData.productName,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            leadTime: formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            images: images,
          })
        })
        
        if (res.ok) {
          toast.success('Item updated successfully')
          onSave?.()
        } else {
          throw new Error('Failed to update item')
        }
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save item')
    } finally {
      setSaving(false)
    }
  }
  
  const handleSelectSupplier = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplierId: supplier.id,
        supplierName: supplier.contactName 
          ? `${supplier.name} / ${supplier.contactName}`
          : supplier.name
      }))
    }
  }
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* Navigation Arrows */}
            {(hasNext || hasPrev) && (
              <div className="flex flex-col gap-0.5">
                <button 
                  onClick={() => onNavigate?.('prev')}
                  disabled={!hasPrev}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onNavigate?.('next')}
                  disabled={!hasNext}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[300px]">
              {mode === 'create' ? 'Add New Item' : formData.name || 'Item Details'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {formData.supplierLink && (
              <a 
                href={formData.supplierLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                title="Open product link"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5">
          {['Summary', 'Financial', 'Attachments', 'Approvals'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.toLowerCase()
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {activeTab === 'summary' && (
              <>
                {/* Image Upload */}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <div className="flex gap-3">
                    {images.length > 0 && images.map((img, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setImages(images.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {images.length < 2 && (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                          "flex-1 min-w-[200px] border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                          isDragging 
                            ? "border-emerald-500 bg-emerald-50" 
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                        )}
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">
                              Drag & drop or <span className="text-blue-600 hover:underline">browse files</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Upload up to 2 images</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Product Name */}
                <div className="space-y-2">
                  <Label>Product Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                  />
                </div>
                
                {/* Description & Doc Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Doc Code</Label>
                    <Input
                      value={formData.docCode}
                      onChange={(e) => setFormData({ ...formData, docCode: e.target.value })}
                      placeholder="Document code"
                    />
                  </div>
                </div>
                
                {/* FFE Linking Section - Cascading: Room → Section → Item */}
                {mode === 'create' && ffeItems.length > 0 && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                      <Label className="text-sm font-medium text-blue-900">Link to FFE Workspace Item</Label>
                    </div>
                    <p className="text-xs text-blue-700">Select the room, category, and item this product fulfills.</p>
                    
                    {ffeItemsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading FFE items...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Step 1: Select Room */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-blue-700">1. Select Room</Label>
                          <Select 
                            value={selectedFfeRoom} 
                            onValueChange={(v) => {
                              setSelectedFfeRoom(v)
                              setSelectedFfeSection('')
                              setSelectedFfeItemId('')
                              setShowAlreadyChosenWarning(false)
                            }}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Choose a room..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ffeItems.map(room => (
                                <SelectItem key={room.roomId} value={room.roomId}>
                                  {room.roomName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Step 2: Select Section/Category */}
                        {selectedFfeRoom && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-blue-700">2. Select Category</Label>
                            <Select 
                              value={selectedFfeSection} 
                              onValueChange={(v) => {
                                setSelectedFfeSection(v)
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Choose a category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFfeSections.map(section => (
                                  <SelectItem key={section.sectionId} value={section.sectionId}>
                                    {section.sectionName} ({section.items.length} items)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Step 3: Select FFE Item */}
                        {selectedFfeSection && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-blue-700">3. Select FFE Item to Link</Label>
                            <Select 
                              value={selectedFfeItemId} 
                              onValueChange={(v) => {
                                setSelectedFfeItemId(v)
                                const item = filteredFfeItemsList.find(i => i.id === v)
                                if (item?.hasLinkedSpecs) {
                                  setShowAlreadyChosenWarning(true)
                                } else {
                                  setShowAlreadyChosenWarning(false)
                                }
                              }}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Choose an item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFfeItemsList.map(item => (
                                  <SelectItem key={item.id} value={item.id}>
                                    <div className="flex items-center gap-2">
                                      {item.hasLinkedSpecs ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5 text-gray-300" />
                                      )}
                                      <span>{item.name}</span>
                                      {item.hasLinkedSpecs && (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                                          {item.linkedSpecsCount} chosen
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Confirmation */}
                        {selectedFfeItem && (
                          <div className={cn(
                            "p-3 rounded-lg border text-sm",
                            showAlreadyChosenWarning 
                              ? "bg-amber-50 border-amber-200" 
                              : "bg-emerald-50 border-emerald-200"
                          )}>
                            <div className="flex items-center gap-2">
                              {showAlreadyChosenWarning ? (
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                              <span className={showAlreadyChosenWarning ? "text-amber-800" : "text-emerald-800"}>
                                {showAlreadyChosenWarning 
                                  ? `"${selectedFfeItem.itemName}" already has ${selectedFfeItem.linkedSpecsCount} product(s). This will be added as Option #${selectedFfeItem.linkedSpecsCount + 1}.`
                                  : `Will link to: ${selectedFfeItem.roomName} → ${selectedFfeItem.sectionName} → ${selectedFfeItem.itemName}`
                                }
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Quantity */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                
                {/* Brand & Lead Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Brand name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time</Label>
                    <Select value={formData.leadTime} onValueChange={(v) => setFormData({ ...formData, leadTime: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_TIME_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* SKU */}
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU / Model number"
                  />
                </div>
                
                {/* Product URL */}
                <div className="space-y-2">
                  <Label>Product URL</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={formData.supplierLink}
                      onChange={(e) => setFormData({ ...formData, supplierLink: e.target.value })}
                      placeholder="https://..."
                      className="pl-9"
                    />
                  </div>
                </div>
                
                {/* Supplier */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Supplier</Label>
                    <button 
                      onClick={() => setShowAddSupplier(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add New
                    </button>
                  </div>
                  {formData.supplierName ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                        {formData.supplierName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{formData.supplierName}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button 
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setFormData({ ...formData, supplierName: '', supplierId: '' })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Select onValueChange={handleSelectSupplier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select from phonebook" />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingSuppliers ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : suppliers.length === 0 ? (
                            <div className="text-center p-4 text-sm text-gray-500">
                              No suppliers in phonebook
                              <button 
                                onClick={() => setShowAddSupplier(true)}
                                className="block mx-auto mt-2 text-blue-600 hover:underline"
                              >
                                Add your first supplier
                              </button>
                            </div>
                          ) : (
                            suppliers.map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                    {supplier.name.charAt(0)}
                                  </div>
                                  <span>{supplier.name}</span>
                                  {supplier.contactName && (
                                    <span className="text-gray-400">/ {supplier.contactName}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-gray-400 text-center">or</div>
                      <Input
                        value={formData.supplierName}
                        onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                        placeholder="Enter supplier name manually"
                      />
                    </>
                  )}
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal notes about this item..."
                    rows={3}
                  />
                </div>
                
                {/* Product Specifications */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Product Specifications</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Height</Label>
                      <Input
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Depth</Label>
                      <Input
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Width</Label>
                      <Input
                        value={formData.width}
                        onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Length</Label>
                      <Input
                        value={formData.length}
                        onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Colour</Label>
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Finish</Label>
                      <Input
                        value={formData.finish}
                        onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Material</Label>
                    <Input
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      placeholder="-"
                    />
                  </div>
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </>
            )}
            
            {activeTab === 'financial' && (
              <div className="space-y-6">
                {/* RRP & Quantity Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RRP</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rrp}
                        onChange={(e) => setFormData({ ...formData, rrp: e.target.value })}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                
                {/* Trade Price & Trade Discount Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trade Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.tradePrice}
                        onChange={(e) => setFormData({ ...formData, tradePrice: e.target.value })}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Trade Discount</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.tradeDiscount}
                        onChange={(e) => setFormData({ ...formData, tradeDiscount: e.target.value })}
                        placeholder="0"
                        className="pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                </div>
                
                {/* TOTALS Section */}
                <div className="border-t border-gray-200 pt-4 mt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">TOTALS</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">TRADE PRICE</span>
                      <span className="font-semibold text-lg">
                        ${((parseFloat(formData.tradePrice) || 0) * (formData.quantity || 0) * (1 - (parseFloat(formData.tradeDiscount) || 0) / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'attachments' && (
              <div className="text-center py-12 text-gray-500">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No attachments yet</p>
                <Button variant="outline" className="mt-4">
                  Upload Files
                </Button>
              </div>
            )}
            
            {activeTab === 'approvals' && (
              <div className="text-center py-12 text-gray-500">
                <p>No approval workflow set up</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {item?.roomName && <span>{item.roomName}</span>}
            {item?.sectionName && <span> / {item.sectionName}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Add New Supplier Modal */}
      <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Add New Supplier
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Business Name *</Label>
              <Input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={newSupplier.contactName}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                placeholder="supplier@example.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={newSupplier.website}
                  onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newSupplier.notes}
                onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                placeholder="Internal notes about this supplier"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSupplier(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSupplier}
              disabled={savingSupplier || !newSupplier.name || !newSupplier.email}
            >
              {savingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add to Phonebook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

