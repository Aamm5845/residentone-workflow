'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronUp, ChevronDown, Upload, Link as LinkIcon, ExternalLink, Edit, Trash2, Loader2, Plus, UserPlus, ImageIcon, CheckCircle2, Circle, AlertCircle, FileText, File, Download, Clock, Send, MessageSquare, Package, DollarSign, ShoppingCart, Truck, User, Building2 } from 'lucide-react'
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
  website?: string
  logo?: string
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

interface ItemDocument {
  id: string
  title: string
  description?: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  type: string
  dropboxPath?: string
  visibleToClient: boolean
  visibleToSupplier: boolean
  createdAt: string
  uploadedBy?: {
    id: string
    name: string
    email: string
  }
}

interface FFERoom {
  roomId: string
  roomName: string
  sections: FFESection[]
}

interface ItemDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
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
    unitType?: string
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
    notes?: string | null
    ffeRequirementId?: string
    ffeRequirementName?: string
    // Multiple linked FFE items (many-to-many)
    linkedFfeItems?: Array<{
      linkId: string
      ffeItemId: string
      ffeItemName: string
      roomId: string
      roomName: string
      sectionName: string
    }>
    linkedFfeCount?: number
  } | null
  mode: 'view' | 'edit' | 'create'
  sectionId?: string
  roomId?: string
  availableRooms?: AvailableRoom[]
  // FFE linking props
  ffeItems?: FFERoom[]
  ffeItemsLoading?: boolean
  // Pre-selected FFE item (from FFE Workspace "Choose Product for This" action)
  initialFfeRoomId?: string
  initialFfeSectionId?: string
  initialFfeItemId?: string
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

const UNIT_TYPE_OPTIONS = [
  { value: 'units', label: 'Units' },
  { value: 'SF', label: 'SF (Square Feet)' },
  { value: 'SY', label: 'SY (Square Yards)' },
  { value: 'LF', label: 'LF (Linear Feet)' },
  { value: 'LY', label: 'LY (Linear Yards)' },
  { value: 'sqm', label: 'SQM (Square Meters)' },
  { value: 'meters', label: 'Meters' },
  { value: 'feet', label: 'Feet' },
  { value: 'inches', label: 'Inches' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
]

// Activity Tab Component
interface ActivityItem {
  id: string
  type: string
  title: string
  description?: string
  timestamp: string
  actor?: {
    id?: string
    name?: string
    email?: string
    image?: string
    type: string
  }
  metadata?: any
}

function ActivityTab({ itemId, roomId, mode }: { itemId?: string; roomId?: string; mode: string }) {
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    if (itemId && roomId && mode !== 'create') {
      loadActivities()
    }
  }, [itemId, roomId, mode])

  const loadActivities = async () => {
    if (!itemId || !roomId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/activity`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'QUOTE_REQUESTED':
        return <Send className="w-4 h-4 text-blue-500" />
      case 'QUOTE_RECEIVED':
        return <MessageSquare className="w-4 h-4 text-green-500" />
      case 'QUOTE_DECLINED':
        return <X className="w-4 h-4 text-red-500" />
      case 'QUOTE_VIEWED':
        return <ExternalLink className="w-4 h-4 text-gray-500" />
      case 'STATUS_CHANGED':
        return <CheckCircle2 className="w-4 h-4 text-purple-500" />
      case 'PRICE_UPDATED':
        return <DollarSign className="w-4 h-4 text-yellow-500" />
      case 'CLIENT_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'CLIENT_REJECTED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'ADDED_TO_ORDER':
        return <ShoppingCart className="w-4 h-4 text-indigo-500" />
      case 'ORDERED':
        return <Package className="w-4 h-4 text-blue-500" />
      case 'SHIPPED':
        return <Truck className="w-4 h-4 text-orange-500" />
      case 'DELIVERED':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'NOTE_ADDED':
        return <FileText className="w-4 h-4 text-gray-500" />
      case 'DOCUMENT_UPLOADED':
        return <Upload className="w-4 h-4 text-blue-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'supplier':
        return <Building2 className="w-3 h-3" />
      case 'client':
        return <User className="w-3 h-3" />
      default:
        return null
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 1 ? 'Just now' : `${minutes}m ago`
      }
      return `${hours}h ago`
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
    }
  }

  if (mode === 'create') {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">Activity will appear after saving</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">No activity yet</p>
        <p className="text-xs text-gray-400 mt-1">Activity will be tracked here when you request quotes, update prices, etc.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {/* Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            {getActivityIcon(activity.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatTime(activity.timestamp)}
              </span>
            </div>

            {/* Actor */}
            {activity.actor && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {activity.actor.image ? (
                  <img
                    src={activity.actor.image}
                    alt={activity.actor.name || ''}
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    {getActorIcon(activity.actor.type) || (
                      <span className="text-[10px] font-medium">
                        {(activity.actor.name || activity.actor.email || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <span className="text-xs text-gray-500">
                  {activity.actor.name || activity.actor.email}
                </span>
                {activity.actor.type !== 'user' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {activity.actor.type}
                  </Badge>
                )}
              </div>
            )}

            {/* Metadata badges */}
            {activity.metadata && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activity.metadata.quoteAmount && (
                  <Badge variant="secondary" className="text-xs">
                    ${Number(activity.metadata.quoteAmount).toLocaleString()}
                  </Badge>
                )}
                {activity.metadata.rfqNumber && (
                  <Badge variant="outline" className="text-xs">
                    {activity.metadata.rfqNumber}
                  </Badge>
                )}
                {activity.metadata.status && activity.type !== 'QUOTE_REQUESTED' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      activity.metadata.status === 'QUOTED' && "bg-green-50 text-green-700 border-green-200",
                      activity.metadata.status === 'DECLINED' && "bg-red-50 text-red-700 border-red-200",
                      activity.metadata.status === 'VIEWED' && "bg-blue-50 text-blue-700 border-blue-200"
                    )}
                  >
                    {activity.metadata.status}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ItemDetailPanel({
  isOpen,
  onClose,
  projectId,
  item,
  mode,
  sectionId,
  roomId,
  availableRooms = [],
  ffeItems = [],
  ffeItemsLoading = false,
  initialFfeRoomId,
  initialFfeSectionId,
  initialFfeItemId,
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
  
  // Track if FFE selection has been initialized for current panel session
  const ffeInitializedRef = useRef(false)
  
  // Reset initialization flag when panel closes
  useEffect(() => {
    if (!isOpen) {
      ffeInitializedRef.current = false
      setSelectedFfeRoom('')
      setSelectedFfeSection('')
      setSelectedFfeItemId('')
      setShowAlreadyChosenWarning(false)
    }
  }, [isOpen])
  
  // Initialize FFE selection when panel opens with initial values
  useEffect(() => {
    // Only run when panel is open, in create mode, has initial values, AND ffeItems are loaded
    if (isOpen && mode === 'create' && !ffeInitializedRef.current && initialFfeRoomId && ffeItems.length > 0) {
      // Verify the initialFfeRoomId exists in the ffeItems
      const roomExists = ffeItems.some(r => r.roomId === initialFfeRoomId)
      if (!roomExists) {
        return // Don't initialize yet, ffeItems might not be fully loaded
      }
      
      ffeInitializedRef.current = true
      setSelectedFfeRoom(initialFfeRoomId)
      setSelectedFfeSection(initialFfeSectionId || '')
      setSelectedFfeItemId(initialFfeItemId || '')
      
      // Check if item already has linked specs to show warning
      if (initialFfeItemId) {
        const room = ffeItems.find(r => r.roomId === initialFfeRoomId)
        const section = room?.sections.find(s => s.sectionId === initialFfeSectionId)
        const ffeItem = section?.items.find(i => i.id === initialFfeItemId)
        setShowAlreadyChosenWarning(ffeItem?.hasLinkedSpecs || false)
      }
    }
  }, [isOpen, mode, initialFfeRoomId, initialFfeSectionId, initialFfeItemId, ffeItems])
  
  // Get filtered sections based on selected room (with fallback to initial value)
  const effectiveRoomId = selectedFfeRoom || initialFfeRoomId
  const filteredFfeSections = effectiveRoomId 
    ? ffeItems.find(r => r.roomId === effectiveRoomId)?.sections || []
    : []
  
  // Get filtered items based on selected section (with fallback to initial value)
  const effectiveSectionId = selectedFfeSection || initialFfeSectionId
  const filteredFfeItemsList = effectiveSectionId
    ? filteredFfeSections.find(s => s.sectionId === effectiveSectionId)?.items || []
    : []

  // Flatten all FFE items into a single list for single-dropdown selection
  const allFfeItemsFlat = ffeItems.flatMap(room => 
    room.sections.flatMap(section => 
      section.items.map(item => ({
        value: `${room.roomId}|${section.sectionId}|${item.id}`,
        roomId: room.roomId,
        roomName: room.roomName,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        itemId: item.id,
        itemName: item.name,
        hasLinkedSpecs: item.hasLinkedSpecs,
        linkedSpecsCount: item.linkedSpecsCount || 0,
        label: `${room.roomName} > ${section.sectionName} > ${item.name}`
      }))
    )
  )

  // Handle single dropdown FFE item selection
  const handleFlatFfeItemSelect = (compositeValue: string) => {
    const [roomId, sectionId, itemId] = compositeValue.split('|')
    const item = allFfeItemsFlat.find(i => i.value === compositeValue)
    
    if (item) {
      setSelectedFfeRoom(roomId)
      setSelectedFfeSection(sectionId)
      setSelectedFfeItemId(itemId)
      setShowAlreadyChosenWarning(item.hasLinkedSpecs)
    }
  }

  // Get the composite value for the current selection
  const currentFfeCompositeValue = (selectedFfeRoom || initialFfeRoomId) && 
    (selectedFfeSection || initialFfeSectionId) && 
    (selectedFfeItemId || initialFfeItemId)
    ? `${selectedFfeRoom || initialFfeRoomId}|${selectedFfeSection || initialFfeSectionId}|${selectedFfeItemId || initialFfeItemId}`
    : ''
  
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
  const [changingSupplier, setChangingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    notes: '',
    logo: '',
    categoryId: '',
    currency: 'CAD'
  })
  const [supplierCategories, setSupplierCategories] = useState<Array<{ id: string; name: string; icon?: string; color?: string }>>([])
  const [loadingSupplierCategories, setLoadingSupplierCategories] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',         // SKU / Model number
    docCode: '',     // Document Code (separate from SKU)
    productName: '',
    brand: '',
    quantity: 1,
    unitType: 'units',
    supplierName: '',
    supplierLink: '',
    supplierId: '',
    supplierContactName: '',
    supplierEmail: '',
    supplierLogo: '',
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
    rrpCurrency: 'CAD',
    tradePriceCurrency: 'CAD',
    notes: '',
  })
  
  const [images, setImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])

  // Documents state
  const [documents, setDocuments] = useState<ItemDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null)
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('Quotes')
  const [customDocumentType, setCustomDocumentType] = useState('')
  const [documentNote, setDocumentNote] = useState('')

  // Default document types with labels and colors
  const defaultDocumentTypes = [
    { id: 'Quotes', label: 'Quote', color: 'blue', dbType: 'SUPPLIER_QUOTE' },
    { id: 'Drawings', label: 'Spec Sheet', color: 'purple', dbType: 'DRAWING' },
    { id: 'Invoices', label: 'Invoice', color: 'green', dbType: 'INVOICE' },
    { id: 'Receipts', label: 'Receipt', color: 'emerald', dbType: 'RECEIPT' },
    { id: 'Shipping', label: 'Shipping', color: 'orange', dbType: 'SHIPPING_DOC' },
    { id: 'Other', label: 'Other', color: 'gray', dbType: 'OTHER' },
  ]
  
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
    
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be less than 4MB')
      return
    }
    
    setUploadingImage(true)
    try {
      // Upload to server and get URL
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'general')
      
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImages(prev => [...prev, data.url].slice(0, 2))
          toast.success('Image uploaded')
        } else {
          throw new Error('No URL returned')
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  // Load documents for item
  const loadDocuments = async () => {
    if (!item?.id || !item?.roomId) return

    setLoadingDocuments(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Handle file selection for documents - show type selector
  const handleDocumentFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!item?.id || !item?.roomId) {
      toast.error('Please save the item first before uploading documents')
      return
    }

    const file = files[0]

    // Validate size
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File must be less than 25MB')
      return
    }

    // Store the file and show type selector
    setPendingDocumentFile(file)
  }

  // Upload document with selected type
  const handleDocumentUpload = async () => {
    if (!pendingDocumentFile || !item?.id || !item?.roomId) return

    // Get the document type config
    const typeConfig = defaultDocumentTypes.find(t => t.id === selectedDocumentType)
    const dbType = typeConfig?.dbType || 'OTHER'

    // For custom "Other" type, prepend the custom label to the description
    let description = documentNote.trim()
    if (selectedDocumentType === 'Other' && customDocumentType.trim()) {
      description = `[${customDocumentType.trim()}] ${description}`.trim()
    }

    setUploadingDocument(true)
    try {
      const formData = new FormData()
      formData.append('file', pendingDocumentFile)
      formData.append('fileType', selectedDocumentType)
      formData.append('documentType', dbType)
      formData.append('title', pendingDocumentFile.name)
      if (description) {
        formData.append('description', description)
      }

      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/documents`, {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setDocuments(prev => [data.document, ...prev])
        toast.success('Document uploaded successfully')
        setPendingDocumentFile(null)
        setSelectedDocumentType('Quotes')
        setCustomDocumentType('')
        setDocumentNote('')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload document')
    } finally {
      setUploadingDocument(false)
    }
  }

  // Cancel pending upload
  const cancelDocumentUpload = () => {
    setPendingDocumentFile(null)
    setSelectedDocumentType('Quotes')
    setCustomDocumentType('')
    setDocumentNote('')
  }

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!item?.id || !item?.roomId) return

    setDeletingDocumentId(documentId)
    try {
      const res = await fetch(
        `/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/documents?documentId=${documentId}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== documentId))
        toast.success('Document deleted')
      } else {
        toast.error('Failed to delete document')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete document')
    } finally {
      setDeletingDocumentId(null)
    }
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get icon for file type
  const getFileIcon = (mimeType?: string, fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return ImageIcon
    }
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return FileText
    }
    return File
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

  // Load documents for existing items
  useEffect(() => {
    if (isOpen && item?.id && mode !== 'create') {
      loadDocuments()
    } else {
      setDocuments([])
    }
  }, [isOpen, item?.id, mode])
  
  // Load supplier categories
  const loadSupplierCategories = async () => {
    try {
      setLoadingSupplierCategories(true)
      const res = await fetch('/api/supplier-categories')
      if (res.ok) {
        const data = await res.json()
        setSupplierCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to load supplier categories:', error)
    } finally {
      setLoadingSupplierCategories(false)
    }
  }

  // Create new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.contactName || !newSupplier.email) {
      toast.error('Business name, contact name, and email are required')
      return
    }
    
    setSavingSupplier(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSupplier,
          categoryId: newSupplier.categoryId || null
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        // Add to local suppliers list
        setSuppliers(prev => [...prev, data.supplier])
        // Select the new supplier with all details
        setFormData(prev => ({
          ...prev,
          supplierId: data.supplier.id,
          supplierName: data.supplier.name,
          supplierContactName: data.supplier.contactName || '',
          supplierEmail: data.supplier.email || '',
          supplierLogo: data.supplier.logo || '',
          supplierLink: data.supplier.website || ''
        }))
        // Reset and close modal
        setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logo: '', categoryId: '', currency: 'CAD' })
        setShowAddSupplier(false)
        toast.success('Supplier added to phonebook')
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || 'Failed to create supplier')
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
        unitType: item.unitType || 'units',
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
        rrpCurrency: (item as any).rrpCurrency || 'CAD',
        tradePriceCurrency: (item as any).tradePriceCurrency || 'CAD',
        notes: item.notes || '',
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
        unitType: 'units',
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
        currency: 'CAD',
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
            unitType: formData.unitType,
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
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
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
            unitType: formData.unitType,
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
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
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

  // Auto-save: debounced save for existing items (edit/view mode)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoadRef = useRef(true)
  const lastSavedDataRef = useRef<string>('')

  // Auto-save effect - triggers on formData or images change (for existing items only)
  useEffect(() => {
    // Skip auto-save for create mode or if no item
    if (mode === 'create' || !item?.id || !item?.roomId) {
      return
    }

    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      // Store initial state
      lastSavedDataRef.current = JSON.stringify({ formData, images })
      return
    }

    // Check if data actually changed
    const currentData = JSON.stringify({ formData, images })
    if (currentData === lastSavedDataRef.current) {
      return
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Debounce auto-save by 1 second
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!formData.name.trim()) return // Don't save empty name

      setSaving(true)
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
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
            unitType: formData.unitType,
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
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
            images: images,
          })
        })

        if (res.ok) {
          lastSavedDataRef.current = currentData
          onSave?.() // Notify parent to refresh
        }
      } catch (error) {
        console.error('Auto-save error:', error)
      } finally {
        setSaving(false)
      }
    }, 1000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [formData, images, mode, item?.id, item?.roomId, onSave])

  // Reset initial load ref when panel opens with new item
  useEffect(() => {
    if (isOpen && item?.id) {
      isInitialLoadRef.current = true
      setChangingSupplier(false)
    }
  }, [isOpen, item?.id])

  const handleSelectSupplier = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierContactName: supplier.contactName || '',
        supplierEmail: supplier.email || '',
        supplierLogo: supplier.logo || '',
        supplierLink: supplier.website || ''
      }))
      setChangingSupplier(false) // Close the supplier selector
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
      <div className="fixed right-0 top-0 h-full w-[520px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
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
        <div className="flex border-b border-gray-200 px-5 overflow-x-auto">
          {['Summary', 'Financial', 'Attachments', 'Activity', 'Approvals'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
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
                
                {/* FFE Linked Items - Show all linked FFE items (many-to-many) */}
                {mode !== 'create' && item?.linkedFfeItems && item.linkedFfeItems.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-2">
                      <p className="text-xs text-blue-600 font-medium">
                        Linked FFE Items ({item.linkedFfeItems.length})
                      </p>
                      <div className="space-y-1.5">
                        {item.linkedFfeItems.map((ffeItem) => (
                          <div key={ffeItem.linkId} className="flex items-center justify-between bg-white rounded-md p-2 border border-blue-100">
                            <div>
                              <p className="text-sm font-medium text-blue-900">{ffeItem.ffeItemName}</p>
                              <p className="text-xs text-gray-500">{ffeItem.roomName} · {ffeItem.sectionName}</p>
                            </div>
                            {projectId && (
                              <a
                                href={`/ffe/${ffeItem.roomId}/workspace?highlight=${ffeItem.ffeItemId}`}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Legacy FFE Requirement Link - Fallback for old one-to-one links */}
                {mode !== 'create' && (!item?.linkedFfeItems || item.linkedFfeItems.length === 0) && item?.ffeRequirementId && item?.ffeRequirementName && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-medium mb-0.5">FFE Requirement</p>
                        <p className="text-sm font-medium text-blue-900">{item.ffeRequirementName}</p>
                      </div>
                      {projectId && item.roomId && (
                        <a
                          href={`/ffe/${item.roomId}/workspace?highlight=${item.ffeRequirementId}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-white rounded-md border border-blue-200 hover:border-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View in FFE
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Item Name & Product */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Kitchen Faucet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Input
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="e.g., Kohler K-560-VS"
                    />
                    <p className="text-[10px] text-gray-400">Specific product model or name</p>
                  </div>
                </div>
                
                {/* Description & Doc Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
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
                
                {/* FFE Linking Section - Step by Step */}
                {mode === 'create' && ffeItems.length > 0 && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                      <Label className="text-sm font-medium text-blue-900">Link to FFE Workspace Item *</Label>
                    </div>
                    <p className="text-xs text-blue-700">Select the FFE item this product fulfills.</p>
                    
                    {ffeItemsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading FFE items...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Step 1: Select Room */}
                        {!selectedFfeRoom && !initialFfeRoomId && (
                          <Select value={selectedFfeRoom} onValueChange={(v) => {
                            setSelectedFfeRoom(v)
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select room..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ffeItems.map(room => (
                                <SelectItem key={room.roomId} value={room.roomId}>
                                  {room.roomName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {/* Step 2: Show selected room + Section dropdown */}
                        {(selectedFfeRoom || initialFfeRoomId) && !(selectedFfeSection || initialFfeSectionId) && (
                          <>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">Room:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeRoom('')
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {ffeItems.find(r => r.roomId === (selectedFfeRoom || initialFfeRoomId))?.roomName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                            </div>
                            <Select value={selectedFfeSection} onValueChange={(v) => {
                              setSelectedFfeSection(v)
                              setSelectedFfeItemId('')
                              setShowAlreadyChosenWarning(false)
                            }}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFfeSections.map(section => (
                                  <SelectItem key={section.sectionId} value={section.sectionId}>
                                    {section.sectionName} ({section.items.length} items)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        
                        {/* Step 3: Show selected room + section + Item dropdown */}
                        {(selectedFfeRoom || initialFfeRoomId) && (selectedFfeSection || initialFfeSectionId) && !(selectedFfeItemId || initialFfeItemId) && (
                          <>
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <span className="text-gray-500">Room:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeRoom('')
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {ffeItems.find(r => r.roomId === (selectedFfeRoom || initialFfeRoomId))?.roomName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                              <span className="text-gray-500">Category:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {filteredFfeSections.find(s => s.sectionId === (selectedFfeSection || initialFfeSectionId))?.sectionName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                            </div>
                            <Select value={selectedFfeItemId} onValueChange={(v) => {
                              setSelectedFfeItemId(v)
                              const item = filteredFfeItemsList.find(i => i.id === v)
                              setShowAlreadyChosenWarning(item?.hasLinkedSpecs || false)
                            }}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select item..." />
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
                                          {item.linkedSpecsCount}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        
                        {/* Final: Show all selections with confirmation */}
                        {selectedFfeItem && (
                          <div className={cn(
                            "p-3 rounded-lg border text-sm",
                            showAlreadyChosenWarning 
                              ? "bg-amber-50 border-amber-200" 
                              : "bg-emerald-50 border-emerald-200"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {showAlreadyChosenWarning ? (
                                  <AlertCircle className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                )}
                                <span className={showAlreadyChosenWarning ? "text-amber-800" : "text-emerald-800"}>
                                  {showAlreadyChosenWarning 
                                    ? `"${selectedFfeItem.itemName}" already has ${selectedFfeItem.linkedSpecsCount} product(s). This will be added as Option #${selectedFfeItem.linkedSpecsCount + 1}.`
                                    : `${selectedFfeItem.roomName} > ${selectedFfeItem.sectionName} > ${selectedFfeItem.itemName}`
                                  }
                                </span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setSelectedFfeRoom('')
                                  setSelectedFfeSection('')
                                  setSelectedFfeItemId('')
                                  setShowAlreadyChosenWarning(false)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 underline"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Quantity & Unit Type */}
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
                  <div className="space-y-2">
                    <Label>Unit Type</Label>
                    <Select value={formData.unitType} onValueChange={(v) => setFormData({ ...formData, unitType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <Label>Supplier</Label>
                  {/* Show current supplier if selected and not changing */}
                  {formData.supplierName && !changingSupplier && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      {/* Logo or Initial */}
                      {formData.supplierLogo ? (
                        <img
                          src={formData.supplierLogo}
                          alt={formData.supplierName}
                          className="w-10 h-10 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                          {formData.supplierName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{formData.supplierName}</p>
                        {/* Contact Name and Email */}
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                          {formData.supplierContactName && (
                            <span className="truncate">{formData.supplierContactName}</span>
                          )}
                          {formData.supplierContactName && formData.supplierEmail && (
                            <span>•</span>
                          )}
                          {formData.supplierEmail && (
                            <a
                              href={`mailto:${formData.supplierEmail}`}
                              className="text-blue-600 hover:underline truncate"
                            >
                              {formData.supplierEmail}
                            </a>
                          )}
                        </div>
                        {formData.supplierLink && (
                          <a
                            href={formData.supplierLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate block mt-0.5"
                          >
                            {formData.supplierLink}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => setChangingSupplier(true)}
                        >
                          Change
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setFormData({ ...formData, supplierName: '', supplierId: '', supplierLink: '', supplierContactName: '', supplierEmail: '', supplierLogo: '' })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show supplier selector when changing or no supplier */}
                  {(changingSupplier || !formData.supplierName) && (
                    <div className="space-y-2">
                      {changingSupplier && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Select new supplier:</span>
                          <button
                            className="text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => setChangingSupplier(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <Select onValueChange={handleSelectSupplier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose from phonebook..." />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingSuppliers ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : suppliers.length === 0 ? (
                            <div className="text-center p-4 text-sm text-gray-500">
                              No suppliers in phonebook
                            </div>
                          ) : (
                            suppliers.map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div className="flex items-center gap-2">
                                  {supplier.logo ? (
                                    <img src={supplier.logo} alt={supplier.name} className="w-6 h-6 rounded object-cover" />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                      {supplier.name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="font-medium">{supplier.name}</span>
                                    {(supplier.contactName || supplier.email) && (
                                      <span className="text-xs text-gray-400">
                                        {supplier.contactName}{supplier.contactName && supplier.email ? ' • ' : ''}{supplier.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <button 
                        onClick={() => setShowAddSupplier(true)}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add New Supplier to Phonebook
                      </button>
                    </div>
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
              </>
            )}
            
            {activeTab === 'financial' && (
              <div className="space-y-6">
                {/* RRP Row */}
                <div className="space-y-2">
                  <Label>RRP</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.rrp}
                        onChange={(e) => {
                          const newRrp = e.target.value
                          // Auto-calculate trade price if discount is set
                          const discount = parseFloat(formData.tradeDiscount) || 0
                          if (discount > 0 && newRrp) {
                            const calculatedTradePrice = (parseFloat(newRrp) * (1 - discount / 100)).toFixed(2)
                            setFormData({ ...formData, rrp: newRrp, tradePrice: calculatedTradePrice })
                          } else {
                            setFormData({ ...formData, rrp: newRrp })
                          }
                        }}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rrpCurrency: formData.rrpCurrency === 'CAD' ? 'USD' : 'CAD' })}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-xs font-medium transition-all min-w-[60px]",
                        formData.rrpCurrency === 'CAD'
                          ? "border-gray-300 bg-gray-50 text-gray-700"
                          : "border-blue-300 bg-blue-50 text-blue-700"
                      )}
                    >
                      {formData.rrpCurrency}
                    </button>
                  </div>
                </div>

                {/* Quantity Row */}
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                
                {/* Trade Price Row */}
                <div className="space-y-2">
                  <Label>Trade Price</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
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
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tradePriceCurrency: formData.tradePriceCurrency === 'CAD' ? 'USD' : 'CAD' })}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-xs font-medium transition-all min-w-[60px]",
                        formData.tradePriceCurrency === 'CAD'
                          ? "border-gray-300 bg-gray-50 text-gray-700"
                          : "border-blue-300 bg-blue-50 text-blue-700"
                      )}
                    >
                      {formData.tradePriceCurrency}
                    </button>
                  </div>
                </div>

                {/* Trade Discount Row */}
                <div className="space-y-2">
                  <Label>Trade Discount</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.tradeDiscount}
                      onChange={(e) => {
                        const newDiscount = e.target.value
                        // Auto-calculate trade price from RRP if RRP is set
                        const rrp = parseFloat(formData.rrp) || 0
                        if (rrp > 0 && newDiscount) {
                          const calculatedTradePrice = (rrp * (1 - parseFloat(newDiscount) / 100)).toFixed(2)
                          setFormData({ ...formData, tradeDiscount: newDiscount, tradePrice: calculatedTradePrice })
                        } else {
                          setFormData({ ...formData, tradeDiscount: newDiscount })
                        }
                      }}
                      placeholder="0"
                      className="pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                  {formData.rrp && formData.tradeDiscount && (
                    <p className="text-xs text-gray-500">
                      {formData.tradeDiscount}% off ${formData.rrp} = ${((parseFloat(formData.rrp) || 0) * (1 - (parseFloat(formData.tradeDiscount) || 0) / 100)).toFixed(2)}
                    </p>
                  )}
                </div>
                
                {/* TOTALS Section */}
                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wide">TOTALS</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">TRADE PRICE</span>
                      <span className="font-semibold text-lg">
                        ${((parseFloat(formData.tradePrice) || 0) * (formData.quantity || 1)).toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">{formData.tradePriceCurrency}</span>
                      </span>
                    </div>
                    {formData.rrp && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-gray-600">RRP TOTAL</span>
                        <span className="font-semibold text-lg">
                          ${((parseFloat(formData.rrp) || 0) * (formData.quantity || 1)).toFixed(2)}
                          <span className="text-xs text-gray-500 ml-1">{formData.rrpCurrency}</span>
                        </span>
                      </div>
                    )}
                    {formData.quantity > 1 && (
                      <p className="text-xs text-gray-500 text-right">
                        Unit price: ${formData.tradePrice || formData.rrp || '0.00'} × {formData.quantity} units
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                {/* Hidden file input for documents */}
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf"
                  className="hidden"
                  onChange={(e) => {
                    handleDocumentFileSelect(e.target.files)
                    e.target.value = '' // Reset input
                  }}
                />

                {/* Header with upload button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Spec sheets, quotes, invoices & receipts
                    </p>
                  </div>
                  {mode !== 'create' && !pendingDocumentFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={uploadingDocument}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  )}
                </div>

                {/* Pending file - show type selector */}
                {pendingDocumentFile && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {pendingDocumentFile.name}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({formatFileSize(pendingDocumentFile.size)})
                        </span>
                      </div>
                      <button
                        onClick={cancelDocumentUpload}
                        className="p-1 hover:bg-blue-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Type</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {defaultDocumentTypes.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setSelectedDocumentType(type.id)
                              if (type.id !== 'Other') setCustomDocumentType('')
                            }}
                            className={cn(
                              "py-1.5 px-3 rounded-full border text-xs font-medium transition-all",
                              selectedDocumentType === type.id
                                ? type.color === 'blue' ? "border-blue-500 bg-blue-100 text-blue-700"
                                : type.color === 'purple' ? "border-purple-500 bg-purple-100 text-purple-700"
                                : type.color === 'green' ? "border-green-500 bg-green-100 text-green-700"
                                : type.color === 'emerald' ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                : type.color === 'orange' ? "border-orange-500 bg-orange-100 text-orange-700"
                                : "border-gray-500 bg-gray-100 text-gray-700"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                      {selectedDocumentType === 'Other' && (
                        <Input
                          value={customDocumentType}
                          onChange={(e) => setCustomDocumentType(e.target.value)}
                          placeholder="Enter custom type (e.g., Customs, Duties)"
                          className="mt-2 text-sm h-9"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Note (optional)</Label>
                      <Textarea
                        value={documentNote}
                        onChange={(e) => setDocumentNote(e.target.value)}
                        placeholder="Add a note about this document..."
                        className="h-16 text-sm resize-none bg-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelDocumentUpload}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDocumentUpload}
                        disabled={uploadingDocument}
                        size="sm"
                        className="flex-1"
                      >
                        {uploadingDocument ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1.5" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === 'create' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700">
                      Save the item first to upload documents.
                    </p>
                  </div>
                )}

                {/* Loading state */}
                {loadingDocuments && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}

                {/* Documents list grouped by type */}
                {!loadingDocuments && documents.length > 0 && (
                  <div className="space-y-3">
                    {/* Group documents by type */}
                    {['SUPPLIER_QUOTE', 'DRAWING', 'INVOICE', 'RECEIPT', 'SHIPPING_DOC', 'OTHER'].map(docType => {
                      const knownTypes = ['SUPPLIER_QUOTE', 'DRAWING', 'INVOICE', 'RECEIPT', 'SHIPPING_DOC']
                      const typeDocs = documents.filter(d =>
                        docType === 'OTHER'
                          ? !knownTypes.includes(d.type)
                          : d.type === docType
                      )
                      if (typeDocs.length === 0) return null

                      const typeLabel = docType === 'DRAWING' ? 'Spec Sheets'
                        : docType === 'SUPPLIER_QUOTE' ? 'Quotes'
                        : docType === 'INVOICE' ? 'Invoices'
                        : docType === 'RECEIPT' ? 'Receipts'
                        : docType === 'SHIPPING_DOC' ? 'Shipping'
                        : 'Other'
                      const typeColor = docType === 'DRAWING' ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : docType === 'SUPPLIER_QUOTE' ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : docType === 'INVOICE' ? 'bg-green-100 text-green-700 border-green-200'
                        : docType === 'RECEIPT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : docType === 'SHIPPING_DOC' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'

                      return (
                        <div key={docType} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", typeColor)}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-gray-400">{typeDocs.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {typeDocs.map(doc => {
                              const FileIcon = getFileIcon(doc.mimeType, doc.fileName)
                              const uploadDate = new Date(doc.createdAt)
                              const dateStr = uploadDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                              return (
                                <div
                                  key={doc.id}
                                  className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 group hover:bg-white hover:border-gray-300 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white border flex items-center justify-center flex-shrink-0">
                                      <FileIcon className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {doc.title || doc.fileName}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <span>{dateStr}</span>
                                        <span className="text-gray-300">•</span>
                                        <span>{formatFileSize(doc.fileSize)}</span>
                                      </div>
                                      {doc.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">
                                          {doc.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      {doc.fileUrl && !doc.fileUrl.startsWith('dropbox:') && (
                                        <a
                                          href={doc.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Open"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                      <button
                                        onClick={() => handleDeleteDocument(doc.id)}
                                        disabled={deletingDocumentId === doc.id}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        title="Delete"
                                      >
                                        {deletingDocumentId === doc.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Empty state */}
                {!loadingDocuments && documents.length === 0 && mode !== 'create' && !pendingDocumentFile && (
                  <div
                    onClick={() => documentInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">No documents yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click to upload spec sheets, quotes, or invoices</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'activity' && (
              <ActivityTab itemId={item?.id} roomId={item?.roomId} mode={mode} />
            )}

            {activeTab === 'approvals' && (
              <div className="text-center py-12 text-gray-500">
                <p>No approval workflow set up</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {item?.roomName && <span>{item.roomName}</span>}
            {item?.sectionName && <span> / {item.sectionName}</span>}
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>
      
      {/* Add New Supplier Modal */}
      <Dialog open={showAddSupplier} onOpenChange={(open) => {
        if (open) {
          loadSupplierCategories()
        }
        setShowAddSupplier(open)
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Add New Supplier
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Category</Label>
              {loadingSupplierCategories ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {supplierCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, categoryId: cat.id })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        newSupplier.categoryId === cat.id
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewSupplier({ ...newSupplier, currency: 'CAD' })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    newSupplier.currency === 'CAD'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🇨🇦 CAD
                </button>
                <button
                  type="button"
                  onClick={() => setNewSupplier({ ...newSupplier, currency: 'USD' })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    newSupplier.currency === 'USD'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🇺🇸 USD
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business Name <span className="text-red-500">*</span></Label>
              <Input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Contact Name <span className="text-red-500">*</span></Label>
              <Input
                value={newSupplier.contactName}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                placeholder="Contact person"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
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
              disabled={savingSupplier || !newSupplier.name || !newSupplier.contactName || !newSupplier.email}
              className="bg-indigo-600 hover:bg-indigo-700"
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

