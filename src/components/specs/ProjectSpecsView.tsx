'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  ArrowLeft, 
  Search,
  Filter,
  SortAsc,
  ChevronDown,
  ChevronUp,
  Package,
  ExternalLink,
  MoreVertical,
  Eye,
  FileText,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Library,
  Plus,
  Layers,
  Globe,
  CheckCircle2,
  X,
  GripVertical,
  Square,
  Circle,
  AlertCircle,
  Clock,
  Ban,
  CheckCheck,
  Truck,
  CreditCard,
  Factory,
  PackageCheck,
  Flag,
  Archive,
  Copy,
  FolderInput,
  RefreshCw,
  Trash2,
  BookPlus,
  Share2,
  QrCode,
  ClipboardCopy,
  HelpCircle,
  Upload,
  ClipboardPaste,
  Check,
  StickyNote,
  Scissors
} from 'lucide-react'
import toast from 'react-hot-toast'
import CropFromRenderingDialog from '@/components/image/CropFromRenderingDialog'
import ImageEditorModal from '@/components/image/ImageEditorModal'
import { Checkbox } from '@/components/ui/checkbox'
import { ItemDetailPanel } from './ItemDetailPanel'

// Item status options - ordered by workflow
const ITEM_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', icon: Circle, color: 'text-gray-400', requiresApproval: false },
  { value: 'HIDDEN', label: 'Hidden', icon: Circle, color: 'text-gray-300', requiresApproval: false },
  { value: 'OPTION', label: 'Option', icon: Circle, color: 'text-purple-400', requiresApproval: false },
  { value: 'SELECTED', label: 'Selected', icon: CheckCircle2, color: 'text-emerald-500', requiresApproval: false },
  { value: 'NEED_SAMPLE', label: 'Need Sample', icon: Package, color: 'text-orange-500', requiresApproval: false },
  { value: 'QUOTING', label: 'Quoting', icon: Clock, color: 'text-amber-500', requiresApproval: false },
  { value: 'BETTER_PRICE', label: 'Better Price', icon: CreditCard, color: 'text-yellow-600', requiresApproval: false },
  { value: 'ISSUE', label: 'Issue', icon: AlertCircle, color: 'text-red-500', requiresApproval: false },
  { value: 'NEED_TO_ORDER', label: 'Need to Order', icon: Package, color: 'text-blue-500', requiresApproval: false },
  { value: 'CLIENT_TO_ORDER', label: 'Client to Order', icon: Truck, color: 'text-indigo-500', requiresApproval: true },
  { value: 'ORDERED', label: 'Ordered', icon: PackageCheck, color: 'text-blue-600', requiresApproval: true },
  { value: 'IN_PRODUCTION', label: 'In Production', icon: Factory, color: 'text-cyan-600', requiresApproval: true },
  { value: 'COMPLETED', label: 'Completed', icon: CheckCheck, color: 'text-green-600', requiresApproval: true },
]

// Statuses that require client approval to select
const APPROVAL_REQUIRED_STATUSES = ['CLIENT_TO_ORDER', 'ORDERED', 'IN_PRODUCTION', 'COMPLETED']

// Lead time options (same as ItemDetailPanel)
const LEAD_TIME_OPTIONS = [
  { value: '1-2 weeks', label: '1-2 Wks' },
  { value: '2-4 weeks', label: '2-4 Wks' },
  { value: '4-6 weeks', label: '4-6 Wks' },
  { value: '6-8 weeks', label: '6-8 Wks' },
  { value: '8-12 weeks', label: '8-12 Wks' },
  { value: '12+ weeks', label: '12+ Wks' },
]

// Unit type options (same as ItemDetailPanel)
const UNIT_TYPE_OPTIONS = [
  { value: 'units', label: 'Units' },
  { value: 'SF', label: 'SF' },
  { value: 'SY', label: 'SY' },
  { value: 'LF', label: 'LF' },
  { value: 'LY', label: 'LY' },
  { value: 'sqm', label: 'SQM' },
  { value: 'meters', label: 'M' },
  { value: 'feet', label: 'FT' },
  { value: 'inches', label: 'IN' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
]

interface SpecItem {
  id: string
  name: string
  description: string | null
  roomName: string
  roomType: string
  sectionId: string
  sectionName: string
  categoryName: string
  productName: string | null
  brand: string | null
  sku: string | null
  docCode: string | null
  modelNumber: string | null
  color: string | null
  finish: string | null
  material: string | null
  width: string | null
  height: string | null
  depth: string | null
  length: string | null
  quantity: number
  unitType: string | null
  leadTime: string | null
  supplierName: string | null
  supplierLink: string | null
  state: string
  specStatus: string
  clientApproved: boolean
  images: string[]
  thumbnailUrl: string | null
  roomId: string
  // Custom fields (for flags, etc.)
  customFields?: {
    flag?: {
      color: string
      note?: string
      addedAt?: string
    }
  } | null
  // Pricing fields
  unitCost: number | null
  totalCost: number | null
  tradePrice: number | null
  rrp: number | null
  tradeDiscount: number | null
  // FFE Linking fields (legacy one-to-one)
  ffeRequirementId: string | null
  ffeRequirementName: string | null
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
}

interface CategoryGroup {
  name: string
  items: SpecItem[]
  sectionId?: string
  roomId?: string
}

interface LibraryProduct {
  id: string
  name: string
  brand: string | null
  sku: string | null
  thumbnailUrl: string | null
  category: { name: string } | null
}

interface AddFromUrlData {
  productName: string
  brand: string
  productDescription: string
  sku: string
  rrp: string
  tradePrice: string
  material: string
  colour: string
  finish: string
  width: string
  height: string
  depth: string
  length: string
  leadTime: string
  notes: string
  productWebsite: string
  images: string[]
}

interface ProjectSpecsViewProps {
  project: {
    id: string
    name: string
  }
}

// Sortable Spec Item component for drag-drop reordering
function SortableSpecItem({ 
  id, 
  children 
}: { 
  id: string
  children: React.ReactNode 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {typeof children === 'function' 
        ? (children as (listeners: any) => React.ReactNode)(listeners)
        : children
      }
    </div>
  )
}

export default function ProjectSpecsView({ project }: ProjectSpecsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'category' | 'room' | 'status'>('category')
  const [activeTab, setActiveTab] = useState<'summary' | 'financial' | 'needs'>('summary')
  const [financials, setFinancials] = useState({ totalTradePrice: 0, totalRRP: 0, avgTradeDiscount: 0 })
  
  // Team-only: Show unchosen FFE items (not visible in shared view)
  const [showUnchosenItems, setShowUnchosenItems] = useState(false)
  
  // Generate from URL dialog for Needs Selection tab
  const [urlGenerateDialog, setUrlGenerateDialog] = useState<{
    open: boolean
    ffeItem: { id: string; name: string; roomId: string; sectionId: string } | null
  }>({ open: false, ffeItem: null })
  const [urlGenerateInput, setUrlGenerateInput] = useState('')
  const [urlGenerateExtracting, setUrlGenerateExtracting] = useState(false)
  const [urlGenerateData, setUrlGenerateData] = useState<any>(null)
  const [urlGenerateEditing, setUrlGenerateEditing] = useState(false)
  const [urlGenerateUploadingImage, setUrlGenerateUploadingImage] = useState(false)
  const [showCropDialogForUrlGenerate, setShowCropDialogForUrlGenerate] = useState(false)
  const [urlGenerateShowNotes, setUrlGenerateShowNotes] = useState(false)
  const [urlGenerateShowSupplier, setUrlGenerateShowSupplier] = useState(false)
  const [urlGenerateSupplierSearch, setUrlGenerateSupplierSearch] = useState('')
  const [urlGenerateSupplierResults, setUrlGenerateSupplierResults] = useState<any[]>([])
  const [urlGenerateSupplierLoading, setUrlGenerateSupplierLoading] = useState(false)
  const [urlGenerateSelectedSupplier, setUrlGenerateSelectedSupplier] = useState<any>(null)
  
  // Available rooms/sections for adding new specs
  const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>>([])
  
  // Add from URL modal
  const [addFromUrlModal, setAddFromUrlModal] = useState<{ open: boolean; sectionId: string | null; roomId: string | null }>({ open: false, sectionId: null, roomId: null })
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<AddFromUrlData | null>(null)
  const [addFromUrlEditing, setAddFromUrlEditing] = useState(false)
  const [addFromUrlUploadingImage, setAddFromUrlUploadingImage] = useState(false)
  const [showCropDialogForAddFromUrl, setShowCropDialogForAddFromUrl] = useState(false)
  const [addFromUrlShowNotes, setAddFromUrlShowNotes] = useState(false)
  const [addFromUrlShowSupplier, setAddFromUrlShowSupplier] = useState(false)
  const [addFromUrlSupplierSearch, setAddFromUrlSupplierSearch] = useState('')
  const [addFromUrlSupplierResults, setAddFromUrlSupplierResults] = useState<any[]>([])
  const [addFromUrlSupplierLoading, setAddFromUrlSupplierLoading] = useState(false)
  const [addFromUrlSelectedSupplier, setAddFromUrlSelectedSupplier] = useState<any>(null)
  
  // Product from Library modal
  const [libraryModal, setLibraryModal] = useState<{ open: boolean; sectionId: string | null; roomId: string | null }>({ open: false, sectionId: null, roomId: null })
  const [libraryProducts, setLibraryProducts] = useState<LibraryProduct[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [selectedLibraryProduct, setSelectedLibraryProduct] = useState<LibraryProduct | null>(null)
  
  // Custom Product modal
  const [customProductModal, setCustomProductModal] = useState<{ open: boolean; sectionId: string | null; roomId: string | null }>({ open: false, sectionId: null, roomId: null })
  const [customProductForm, setCustomProductForm] = useState({
    name: '',
    brand: '',
    sku: '',
    description: '',
    supplierName: '',
    supplierLink: '',
    quantity: 1
  })
  
  // Add Section modal
  const [addSectionModal, setAddSectionModal] = useState<{ open: boolean; categoryName: string | null }>({ open: false, categoryName: null })
  const [newSectionName, setNewSectionName] = useState('')
  const [creatingSectionLoading, setCreatingSectionLoading] = useState(false)
  
  const [savingItem, setSavingItem] = useState(false)
  
  // Rendering images for crop feature
  const [renderingImages, setRenderingImages] = useState<Array<{id: string, url: string, filename: string}>>([])
  const [loadingRenderingImages, setLoadingRenderingImages] = useState(false)
  
  // Hover states
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  
  // Inline editing
  const [editingField, setEditingField] = useState<{ itemId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  
  // Supplier picker
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; contactName?: string; email: string; phone?: string; website?: string }>>([])
  const [supplierPickerItem, setSupplierPickerItem] = useState<string | null>(null)
  
  // Add New Supplier modal
  const [addSupplierModal, setAddSupplierModal] = useState<{ open: boolean; forItemId: string | null }>({ open: false, forItemId: null })
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    notes: '',
    logoUrl: ''
  })
  const [savingSupplier, setSavingSupplier] = useState(false)
  
  // Item detail panel
  const [detailPanel, setDetailPanel] = useState<{
    isOpen: boolean
    mode: 'view' | 'edit' | 'create'
    item: SpecItem | null
    sectionId?: string
    roomId?: string
  }>({ isOpen: false, mode: 'view', item: null })
  
  // FFE Item Linking - for connecting specs to FFE Workspace requirements
  const [ffeItems, setFfeItems] = useState<Array<{
    roomId: string
    roomName: string
    sections: Array<{
      sectionId: string
      sectionName: string
      items: Array<{
        id: string
        name: string
        description?: string
        notes?: string
        hasLinkedSpecs: boolean
        linkedSpecsCount: number
        status: string
      }>
    }>
  }>>([])
  
  // Cascading selection state for FFE linking
  const [selectedFfeRoom, setSelectedFfeRoom] = useState<string>('')
  const [selectedFfeSection, setSelectedFfeSection] = useState<string>('')
  const [selectedFfeItemId, setSelectedFfeItemId] = useState<string>('')
  
  const [selectedFfeItem, setSelectedFfeItem] = useState<{
    roomId: string
    roomName: string
    sectionId: string
    sectionName: string
    itemId: string
    itemName: string
    hasLinkedSpecs: boolean
    linkedSpecsCount: number
  } | null>(null)
  const [ffeItemsLoading, setFfeItemsLoading] = useState(false)
  const [showAlreadyChosenWarning, setShowAlreadyChosenWarning] = useState(false)
  
  // Move to section modal
  const [moveToSectionModal, setMoveToSectionModal] = useState<{ open: boolean; item: SpecItem | null }>({ open: false, item: null })
  const [selectedMoveSection, setSelectedMoveSection] = useState<string>('')
  
  // Copy to project modal
  const [copyToProjectModal, setCopyToProjectModal] = useState<{ open: boolean; item: SpecItem | null }>({ open: false, item: null })
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCopyProject, setSelectedCopyProject] = useState<string>('')
  const [projectsLoading, setProjectsLoading] = useState(false)
  
  // Flag modal
  const [flagModal, setFlagModal] = useState<{ open: boolean; item: SpecItem | null }>({ open: false, item: null })
  const [flagColor, setFlagColor] = useState<string>('red')
  const [flagNote, setFlagNote] = useState<string>('')
  
  // Share modal state
  const [shareModal, setShareModal] = useState(false)
  const [shareSettings, setShareSettings] = useState({
    isPublished: false,
    shareUrl: '',
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true
  })
  const [savingShareSettings, setSavingShareSettings] = useState(false)
  
  // Image editor modal state
  const [imageEditorModal, setImageEditorModal] = useState<{
    open: boolean
    imageUrl: string
    imageTitle: string
    itemId: string | null
  }>({ open: false, imageUrl: '', imageTitle: '', itemId: null })
  
  // Image upload for items without images
  const [uploadingImageForItem, setUploadingImageForItem] = useState<string | null>(null)
  const imageUploadInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadItemId, setPendingUploadItemId] = useState<string | null>(null)
  
  // Duplicate item modal state
  const [duplicateModal, setDuplicateModal] = useState<{ 
    open: boolean
    item: SpecItem | null 
  }>({ open: false, item: null })
  const [selectedDuplicateFfeItem, setSelectedDuplicateFfeItem] = useState<string>('')
  const [duplicating, setDuplicating] = useState(false)
  
  // Section filter
  const [filterSection, setFilterSection] = useState<string>('all')
  
  // Get filtered sections based on selected room
  const filteredFfeSections = selectedFfeRoom 
    ? ffeItems.find(r => r.roomId === selectedFfeRoom)?.sections || []
    : []
  
  // Get filtered items based on selected section
  const filteredFfeItemsList = selectedFfeSection
    ? filteredFfeSections.find(s => s.sectionId === selectedFfeSection)?.items || []
    : []

  // Flatten all FFE items into a single list for single-dropdown selection
  const allFfeItemsFlat = ffeItems.flatMap(room => 
    room.sections.flatMap(section => 
      section.items.map(item => ({
        // Composite key: roomId|sectionId|itemId
        value: `${room.roomId}|${section.sectionId}|${item.id}`,
        roomId: room.roomId,
        roomName: room.roomName,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        itemId: item.id,
        itemName: item.name,
        hasLinkedSpecs: item.hasLinkedSpecs,
        linkedSpecsCount: item.linkedSpecsCount || 0,
        // Display label: "Room > Section > Item"
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
      setSelectedFfeItem({
        roomId,
        roomName: item.roomName,
        sectionId,
        sectionName: item.sectionName,
        itemId,
        itemName: item.itemName,
        hasLinkedSpecs: item.hasLinkedSpecs,
        linkedSpecsCount: item.linkedSpecsCount
      })
      setShowAlreadyChosenWarning(item.hasLinkedSpecs)
    }
  }

  // Get the composite value for the current selection
  const currentFfeCompositeValue = selectedFfeRoom && selectedFfeSection && selectedFfeItemId
    ? `${selectedFfeRoom}|${selectedFfeSection}|${selectedFfeItemId}`
    : ''

  // Create new section
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      toast.error('Please enter a section name')
      return
    }
    
    // Need at least one room to create a section
    if (availableRooms.length === 0) {
      toast.error('Please create a room first before adding sections')
      return
    }
    
    setCreatingSectionLoading(true)
    try {
      // Create section in the first available room's FFE instance
      const firstRoomId = availableRooms[0].id
      const res = await fetch(`/api/ffe/v2/rooms/${firstRoomId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName.trim() })
      })
      
      if (res.ok) {
        toast.success('Section created successfully')
        setAddSectionModal({ open: false, categoryName: null })
        setNewSectionName('')
        // Refresh data
        fetchSpecs()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create section')
      }
    } catch (error) {
      console.error('Error creating section:', error)
      toast.error('Failed to create section')
    } finally {
      setCreatingSectionLoading(false)
    }
  }
  
  // Load suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      if (data.suppliers) {
        setSuppliers(data.suppliers)
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
    }
  }, [])
  
  // Select supplier for item
  const handleSelectSupplier = async (itemId: string, supplier: { id: string; name: string; contactName?: string }) => {
    const item = specs.find(s => s.id === itemId)
    if (!item) return
    
    const supplierDisplay = supplier.contactName 
      ? `${supplier.name} / ${supplier.contactName}`
      : supplier.name
    
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: supplierDisplay })
      })
      
      if (res.ok) {
        setSpecs(prev => prev.map(s => 
          s.id === itemId ? { ...s, supplierName: supplierDisplay } : s
        ))
        toast.success('Supplier updated')
      }
    } catch (error) {
      console.error('Error updating supplier:', error)
      toast.error('Failed to update supplier')
    }
    
    setSupplierPickerItem(null)
  }
  
  // Create new supplier and assign to item
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
        
        // If we have an item to assign to, do it
        if (addSupplierModal.forItemId) {
          await handleSelectSupplier(addSupplierModal.forItemId, data.supplier)
        }
        
        // Reset and close
        setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logoUrl: '' })
        setAddSupplierModal({ open: false, forItemId: null })
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

  // DnD Kit sensors for drag and drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for reordering specs within a section
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    // Find the group containing both items
    const activeId = active.id as string
    const overId = over.id as string

    // Update the grouped specs with the new order
    setGroupedSpecs((prevGroups) => {
      const newGroups = [...prevGroups]
      
      for (let i = 0; i < newGroups.length; i++) {
        const group = newGroups[i]
        const activeIndex = group.items.findIndex(item => item.id === activeId)
        const overIndex = group.items.findIndex(item => item.id === overId)
        
        if (activeIndex !== -1 && overIndex !== -1) {
          // Both items are in this group - reorder
          newGroups[i] = {
            ...group,
            items: arrayMove(group.items, activeIndex, overIndex)
          }
          
          // Save the new order to the server
          const reorderedIds = newGroups[i].items.map(item => item.id)
          fetch('/api/projects/' + project.id + '/specs/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemIds: reorderedIds,
              sectionName: group.name
            })
          }).catch(err => console.error('Failed to save reorder:', err))
          
          break
        }
      }
      
      return newGroups
    })
  }, [project.id])

  // Fetch all specs for the project
  const fetchSpecs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/specs`)
      const data = await res.json()
      
      if (data.specs) {
        setSpecs(data.specs)
        // Expand all categories by default
        const categories = [...new Set(data.specs.map((s: SpecItem) => s.categoryName))]
        setExpandedCategories(new Set(categories))
      }
      if (data.financials) {
        setFinancials(data.financials)
      }
      // Also set available rooms from the data
      if (data.availableRooms) {
        setAvailableRooms(data.availableRooms)
      }
    } catch (error) {
      console.error('Failed to fetch specs:', error)
    } finally {
      setLoading(false)
    }
  }, [project.id])

  // Load FFE items for linking
  const loadFfeItems = useCallback(async () => {
    setFfeItemsLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/ffe-items`)
      const data = await res.json()
      if (data.success && data.ffeItems) {
        setFfeItems(data.ffeItems)
      }
    } catch (error) {
      console.error('Failed to load FFE items:', error)
    } finally {
      setFfeItemsLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    fetchSpecs()
    loadSuppliers()
    loadFfeItems()
  }, [fetchSpecs, loadSuppliers, loadFfeItems])
  
  // Handle URL parameters for pre-selecting FFE item (from FFE Workspace "Choose" action)
  useEffect(() => {
    const linkFfeItemId = searchParams.get('linkFfeItem')
    const roomIdParam = searchParams.get('roomId')
    const sectionIdParam = searchParams.get('sectionId')
    
    if (linkFfeItemId && ffeItems.length > 0) {
      // Find the FFE item in the loaded data
      for (const room of ffeItems) {
        if (roomIdParam && room.roomId !== roomIdParam) continue
        for (const section of room.sections) {
          if (sectionIdParam && section.sectionId !== sectionIdParam) continue
          const item = section.items.find(i => i.id === linkFfeItemId)
          if (item) {
            // Pre-select the FFE item
            setSelectedFfeRoom(room.roomId)
            setSelectedFfeSection(section.sectionId)
            setSelectedFfeItemId(item.id)
            if (item.hasLinkedSpecs) {
              setShowAlreadyChosenWarning(true)
            }
            // Open the detail panel in create mode for the first available section
            if (availableRooms.length > 0 && availableRooms[0].sections.length > 0) {
              setDetailPanel({
                isOpen: true,
                mode: 'create',
                item: null,
                sectionId: section.sectionId,
                roomId: room.roomId
              })
            }
            // Clear URL params
            router.replace(`/projects/${project.id}/specs/all`, { scroll: false })
            break
          }
        }
      }
    }
  }, [searchParams, ffeItems, availableRooms, project.id, router])

  // Handle highlightItem parameter (from FFE Workspace "Chosen" badge click)
  useEffect(() => {
    const highlightItemId = searchParams.get('highlightItem')
    
    if (highlightItemId && specs.length > 0) {
      // Find the spec to highlight
      const spec = specs.find(s => s.id === highlightItemId)
      if (spec) {
        // Expand the category containing this item
        setExpandedCategories(prev => new Set([...prev, spec.sectionName]))
        
        // Set highlighted item
        setHighlightedItemId(highlightItemId)
        
        // Scroll to the item after a short delay for DOM update
        setTimeout(() => {
          const element = document.getElementById(`spec-item-${highlightItemId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedItemId(null)
        }, 3000)
        
        // Clear URL param
        router.replace(`/projects/${project.id}/specs/all`, { scroll: false })
      }
    }
  }, [searchParams, specs, project.id, router])

  // Get unique rooms for filter
  const uniqueRooms = Array.from(new Set(specs.map(s => s.roomName))).sort()
  
  // Filter and group specs
  useEffect(() => {
    let filtered = specs

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(spec => 
        spec.name.toLowerCase().includes(query) ||
        spec.productName?.toLowerCase().includes(query) ||
        spec.brand?.toLowerCase().includes(query) ||
        spec.roomName.toLowerCase().includes(query) ||
        spec.supplierName?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(spec => spec.specStatus === filterStatus)
    }
    
    // Apply room filter
    if (filterRoom !== 'all') {
      filtered = filtered.filter(spec => spec.roomName === filterRoom)
    }
    
    // Apply section filter
    if (filterSection !== 'all') {
      filtered = filtered.filter(spec => spec.sectionId === filterSection)
    }

    // Group by category or room, preserving sectionId and roomId
    const groups: Record<string, CategoryGroup> = {}
    filtered.forEach(spec => {
      const key = sortBy === 'room' ? spec.roomName : spec.categoryName
      if (!groups[key]) {
        groups[key] = {
          name: key,
          items: [],
          sectionId: spec.sectionId,
          roomId: spec.roomId
        }
      }
      groups[key].items.push(spec)
    })

    // Convert to array and sort
    // Keep items in their original order from the database (order field)
    // to preserve drag-and-drop reordering
    const groupedArray = Object.values(groups).map(group => ({
      ...group,
      items: group.items // Keep original order from database
    }))

    setGroupedSpecs(groupedArray.sort((a, b) => a.name.localeCompare(b.name)))
  }, [specs, searchQuery, filterStatus, filterRoom, filterSection, sortBy])
  
  // Filter ffeItems based on room and section filters for Needs Selection tab
  const filteredFfeItems = useMemo(() => {
    let filtered = ffeItems
    
    // Apply room filter
    if (filterRoom !== 'all') {
      filtered = filtered.filter(room => room.roomName === filterRoom)
    }
    
    // Apply section filter
    if (filterSection !== 'all') {
      filtered = filtered.map(room => ({
        ...room,
        sections: room.sections.filter(section => section.sectionId === filterSection)
      })).filter(room => room.sections.length > 0)
    }
    
    return filtered
  }, [ffeItems, filterRoom, filterSection])
  
  // Load library products
  const loadLibraryProducts = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/products?limit=100')
      const data = await res.json()
      if (data.products) {
        setLibraryProducts(data.products)
      }
    } catch (error) {
      console.error('Failed to load library products:', error)
      toast.error('Failed to load library products')
    } finally {
      setLibraryLoading(false)
    }
  }, [])
  
  // Extract product info from URL using AI
  const handleExtractFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL')
      return
    }
    
    setExtracting(true)
    try {
      // Fetch page content from the URL
      const fetchRes = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      })
      
      if (!fetchRes.ok) {
        throw new Error('Failed to fetch page content')
      }
      
      const pageData = await fetchRes.json()
      const pageImages = pageData.images || (pageData.image ? [pageData.image] : [])
      
      // Use AI to extract product info
      const aiRes = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          pageContent: pageData.textContent || pageData.description || '',
          title: pageData.title || '',
          images: pageImages
        })
      })
      
      if (aiRes.ok) {
        const result = await aiRes.json()
        if (result.success && result.data) {
          setExtractedData({
            ...result.data,
            productWebsite: urlInput,
            images: result.data.images?.length ? result.data.images : pageImages,
            notes: '' // Don't auto-populate notes
          })
          toast.success('Product info extracted!')
        } else {
          // Fallback with basic data
          setExtractedData({
            productName: pageData.title || '',
            brand: '',
            productDescription: '',
            sku: '',
            rrp: '',
            tradePrice: '',
            material: '',
            colour: '',
            finish: '',
            width: '',
            height: '',
            depth: '',
            length: '',
            leadTime: '',
            notes: '',
            productWebsite: urlInput,
            images: pageImages
          })
          toast.success('Basic info extracted')
        }
      } else {
        // If AI fails, still provide basic extraction
        setExtractedData({
          productName: pageData.title || '',
          brand: '',
          productDescription: '',
          sku: '',
          rrp: '',
          tradePrice: '',
          material: '',
          colour: '',
          finish: '',
          width: '',
          height: '',
          depth: '',
          length: '',
          leadTime: '',
          notes: '',
          productWebsite: urlInput,
          images: pageImages
        })
        toast.success('Basic info extracted')
      }
    } catch (error) {
      console.error('Error extracting from URL:', error)
      toast.error('Failed to extract product info')
    } finally {
      setExtracting(false)
    }
  }
  
  // Paste URL for Add from URL dialog
  const handleAddFromUrlPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrlInput(text)
    } catch (error) {
      toast.error('Failed to paste from clipboard')
    }
  }
  
  // Search suppliers for Add from URL dialog
  const handleAddFromUrlSupplierSearch = async (query: string) => {
    setAddFromUrlSupplierSearch(query)
    if (!query.trim()) {
      setAddFromUrlSupplierResults([])
      return
    }
    
    setAddFromUrlSupplierLoading(true)
    try {
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setAddFromUrlSupplierResults(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error searching suppliers:', error)
    } finally {
      setAddFromUrlSupplierLoading(false)
    }
  }
  
  // Extract product info from URL for Needs Selection tab
  const handleUrlGenerateExtract = async () => {
    if (!urlGenerateInput.trim()) {
      toast.error('Please enter a URL')
      return
    }
    
    setUrlGenerateExtracting(true)
    try {
      const fetchRes = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlGenerateInput })
      })
      
      if (!fetchRes.ok) throw new Error('Failed to fetch page content')
      
      const pageData = await fetchRes.json()
      
      const aiRes = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlGenerateInput,
          pageContent: pageData.textContent || pageData.description || '',
          title: pageData.title || '',
          images: pageData.images || (pageData.image ? [pageData.image] : [])
        })
      })
      
      if (aiRes.ok) {
        const result = await aiRes.json()
        if (result.success && result.data) {
          setUrlGenerateData({
            ...result.data,
            productWebsite: urlGenerateInput,
            images: result.data.images?.length ? result.data.images : (pageData.images || (pageData.image ? [pageData.image] : []))
          })
          toast.success('Product info extracted!')
        } else {
          setUrlGenerateData({
            productName: pageData.title || '',
            brand: '',
            sku: '',
            rrp: '',
            tradePrice: '',
            material: '',
            colour: '',
            finish: '',
            width: '',
            height: '',
            depth: '',
            length: '',
            leadTime: '',
            productWebsite: urlGenerateInput,
            images: pageData.images || (pageData.image ? [pageData.image] : [])
          })
          toast.success('Basic info extracted')
        }
      } else {
        setUrlGenerateData({
          productName: pageData.title || '',
          brand: '',
          sku: '',
          rrp: '',
          tradePrice: '',
          material: '',
          colour: '',
          finish: '',
          width: '',
          height: '',
          depth: '',
          length: '',
          leadTime: '',
          productWebsite: urlGenerateInput,
          images: pageData.images || (pageData.image ? [pageData.image] : [])
        })
        toast.success('Basic info extracted')
      }
    } catch (error) {
      console.error('Error extracting from URL:', error)
      toast.error('Failed to extract product info')
    } finally {
      setUrlGenerateExtracting(false)
    }
  }
  
  // Create spec from URL generation for Needs Selection tab
  const handleUrlGenerateCreate = async () => {
    if (!urlGenerateData || !urlGenerateDialog.ffeItem) return
    
    setSavingItem(true)
    try {
      const { ffeItem } = urlGenerateDialog
      
      // Build dimensions string
      const dims = []
      if (urlGenerateData.width) dims.push(`W: ${urlGenerateData.width}`)
      if (urlGenerateData.height) dims.push(`H: ${urlGenerateData.height}`)
      if (urlGenerateData.depth) dims.push(`D: ${urlGenerateData.depth}`)
      if (urlGenerateData.length) dims.push(`L: ${urlGenerateData.length}`)
      
      const payload = {
        name: urlGenerateData.productName || 'Product from URL',
        brand: urlGenerateData.brand || '',
        sku: urlGenerateData.sku || '',
        // supplierLink = product URL (where we scraped from) - NOT the supplier's website
        supplierLink: urlGenerateData.productWebsite || urlGenerateInput,
        thumbnailUrl: urlGenerateData.images?.[0] || '',
        images: urlGenerateData.images || [],
        rrp: urlGenerateData.rrp ? parseFloat(urlGenerateData.rrp.replace(/[^0-9.]/g, '')) || 0 : 0,
        tradePrice: urlGenerateData.tradePrice ? parseFloat(urlGenerateData.tradePrice.replace(/[^0-9.]/g, '')) || 0 : 0,
        leadTime: urlGenerateData.leadTime || '',
        material: urlGenerateData.material || '',
        color: urlGenerateData.colour || urlGenerateData.color || '',
        finish: urlGenerateData.finish || '',
        width: urlGenerateData.width || '',
        height: urlGenerateData.height || '',
        depth: urlGenerateData.depth || '',
        notes: urlGenerateShowNotes ? (urlGenerateData.notes || '') : '',
        supplierName: urlGenerateSelectedSupplier?.name || '',
        quantity: 1,
        isSpecItem: true,
        ffeRequirementId: ffeItem.id,
        sectionId: ffeItem.sectionId,
        specStatus: 'SELECTED',
        visibility: 'VISIBLE'
      }
      
      const res = await fetch(`/api/ffe/v2/rooms/${ffeItem.roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        toast.success('Product linked successfully!')
        
        // Reset dialog state
        setUrlGenerateDialog({ open: false, ffeItem: null })
        setUrlGenerateInput('')
        setUrlGenerateData(null)
        setUrlGenerateEditing(false)
        setUrlGenerateShowNotes(false)
        setUrlGenerateShowSupplier(false)
        setUrlGenerateSelectedSupplier(null)
        
        // Refresh data
        fetchSpecs()
        loadFfeItems()
      } else {
        throw new Error('Failed to create linked spec')
      }
    } catch (error) {
      console.error('Error creating spec:', error)
      toast.error('Failed to link product')
    } finally {
      setSavingItem(false)
    }
  }
  
  // Search suppliers for URL generate dialog
  const handleUrlGenerateSupplierSearch = async (query: string) => {
    setUrlGenerateSupplierSearch(query)
    if (!query.trim()) {
      setUrlGenerateSupplierResults([])
      return
    }
    
    setUrlGenerateSupplierLoading(true)
    try {
      const res = await fetch(`/api/suppliers?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setUrlGenerateSupplierResults(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error searching suppliers:', error)
    } finally {
      setUrlGenerateSupplierLoading(false)
    }
  }
  
  // Paste URL for generate dialog
  const handleUrlGeneratePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrlGenerateInput(text)
    } catch (error) {
      toast.error('Failed to paste from clipboard')
    }
  }
  
  // Add item to section with FFE linking
  const handleAddItem = async (sectionId: string, roomId: string, itemData: any) => {
    setSavingItem(true)
    try {
      // Get the FFE instance for the room
      const roomRes = await fetch(`/api/ffe/v2/rooms/${roomId}`)
      const roomData = await roomRes.json()
      
      if (!roomData.success) {
        throw new Error('Failed to load room data')
      }
      
      // Determine if this is an option (FFE item already has specs)
      const isOption = selectedFfeItem?.hasLinkedSpecs || false
      const optionNumber = selectedFfeItem?.linkedSpecsCount ? selectedFfeItem.linkedSpecsCount + 1 : undefined
      
      // Add item to the section - this is an actual spec linked to FFE requirement
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          name: itemData.name || itemData.productName,
          description: itemData.description || itemData.productDescription,
          brand: itemData.brand,
          sku: itemData.sku,
          material: itemData.material,
          color: itemData.colour || itemData.color,
          finish: itemData.finish,
          width: itemData.width,
          height: itemData.height,
          depth: itemData.depth,
          leadTime: itemData.leadTime,
          supplierName: itemData.supplierName || itemData.brand,
          supplierLink: itemData.supplierLink || itemData.productWebsite,
          quantity: itemData.quantity || 1,
          unitCost: itemData.rrp ? parseFloat(itemData.rrp.replace(/[^0-9.]/g, '')) : undefined,
          images: itemData.images || [],
          libraryProductId: itemData.libraryProductId,
          // NEW: FFE Linking fields
          isSpecItem: true, // This is an actual spec from All Spec view
          ffeRequirementId: selectedFfeItem?.itemId || null, // Link to FFE Workspace item
          isOption: isOption,
          optionNumber: optionNumber,
          specStatus: 'SELECTED', // Mark as selected (not draft)
          visibility: 'VISIBLE'
        })
      })
      
      if (res.ok) {
        const linkedMsg = selectedFfeItem 
          ? ` and linked to "${selectedFfeItem.itemName}"${isOption ? ` as Option #${optionNumber}` : ''}`
          : ''
        toast.success(`Product added${linkedMsg}`)
        fetchSpecs() // Refresh the list
        loadFfeItems() // Refresh FFE items to update chosen status
        // Close all modals
        setAddFromUrlModal({ open: false, sectionId: null, roomId: null })
        setLibraryModal({ open: false, sectionId: null, roomId: null })
        setCustomProductModal({ open: false, sectionId: null, roomId: null })
        // Reset forms
        setExtractedData(null)
        setUrlInput('')
        setSelectedLibraryProduct(null)
        // Reset FFE selection
        setSelectedFfeRoom('')
        setSelectedFfeSection('')
        setSelectedFfeItemId('')
        setSelectedFfeItem(null)
        setShowAlreadyChosenWarning(false)
        setCustomProductForm({ name: '', brand: '', sku: '', description: '', supplierName: '', supplierLink: '', quantity: 1 })
      } else {
        throw new Error('Failed to add item')
      }
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Failed to add item')
    } finally {
      setSavingItem(false)
    }
  }
  
  // Handle cascading FFE room selection
  const handleFfeRoomSelect = (roomId: string) => {
    setSelectedFfeRoom(roomId)
    setSelectedFfeSection('')
    setSelectedFfeItemId('')
    setSelectedFfeItem(null)
    setShowAlreadyChosenWarning(false)
  }
  
  // Handle cascading FFE section selection
  const handleFfeSectionSelect = (sectionId: string) => {
    setSelectedFfeSection(sectionId)
    setSelectedFfeItemId('')
    setSelectedFfeItem(null)
    setShowAlreadyChosenWarning(false)
  }
  
  // Handle FFE item selection with "already chosen" check
  const handleFfeItemSelect = (itemId: string) => {
    const room = ffeItems.find(r => r.roomId === selectedFfeRoom)
    const section = room?.sections.find(s => s.sectionId === selectedFfeSection)
    const item = section?.items.find(i => i.id === itemId)
    
    if (!room || !section || !item) return
    
    setSelectedFfeItemId(itemId)
    const newSelection = {
      roomId: room.roomId,
      roomName: room.roomName,
      sectionId: section.sectionId,
      sectionName: section.sectionName,
      itemId: item.id,
      itemName: item.name,
      hasLinkedSpecs: item.hasLinkedSpecs,
      linkedSpecsCount: item.linkedSpecsCount
    }
    setSelectedFfeItem(newSelection)
    
    // Show warning if item already has specs
    if (item.hasLinkedSpecs) {
      setShowAlreadyChosenWarning(true)
    } else {
      setShowAlreadyChosenWarning(false)
    }
  }
  
  // Reset FFE selection state
  const resetFfeSelection = () => {
    setSelectedFfeRoom('')
    setSelectedFfeSection('')
    setSelectedFfeItemId('')
    setSelectedFfeItem(null)
    setShowAlreadyChosenWarning(false)
  }
  
  // Open library modal
  const openLibraryModal = (sectionId: string, roomId: string) => {
    setLibraryModal({ open: true, sectionId, roomId })
    loadLibraryProducts()
  }
  
  // Filtered library products
  const filteredLibraryProducts = libraryProducts.filter(p => 
    !librarySearch || 
    p.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(librarySearch.toLowerCase())
  )
  
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
  
  // Update item status
  const handleUpdateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      // Find the item to get roomId
      const item = specs.find(s => s.id === itemId)
      if (!item) return
      
      // Check if new status requires approval and item is not approved
      if (APPROVAL_REQUIRED_STATUSES.includes(newStatus) && !item.clientApproved) {
        toast.error('Client approval required for this status')
        return
      }
      
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specStatus: newStatus })
      })
      
      if (res.ok) {
        // Update local state
        setSpecs(prev => prev.map(s => s.id === itemId ? { ...s, specStatus: newStatus } : s))
        toast.success('Status updated')
      } else {
        toast.error('Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }
  
  // Toggle client approval
  const handleToggleClientApproval = async (itemId: string, currentApproval: boolean) => {
    try {
      const item = specs.find(s => s.id === itemId)
      if (!item) return
      
      const newApproval = !currentApproval
      
      // If unapproving and current status requires approval, revert to NEED_TO_ORDER
      let statusUpdate: string | undefined = undefined
      if (!newApproval && APPROVAL_REQUIRED_STATUSES.includes(item.specStatus)) {
        statusUpdate = 'NEED_TO_ORDER'
      }
      
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientApproved: newApproval,
          ...(statusUpdate && { specStatus: statusUpdate })
        })
      })
      
      if (res.ok) {
        setSpecs(prev => prev.map(s => s.id === itemId ? { 
          ...s, 
          clientApproved: newApproval,
          ...(statusUpdate && { specStatus: statusUpdate })
        } : s))
        toast.success(newApproval ? 'Client approved' : 'Approval removed')
      } else {
        toast.error('Failed to update approval')
      }
    } catch (error) {
      console.error('Error updating approval:', error)
      toast.error('Failed to update approval')
    }
  }
  
  // Get status display
  const getItemStatusDisplay = (status: string) => {
    const statusOption = ITEM_STATUS_OPTIONS.find(o => o.value === status) || ITEM_STATUS_OPTIONS[0]
    const IconComponent = statusOption.icon
    return (
      <div className="flex items-center gap-1.5">
        <IconComponent className={cn("w-3.5 h-3.5", statusOption.color)} />
        <span className="text-xs">{statusOption.label}</span>
      </div>
    )
  }
  
  // Start inline editing
  const startEditing = (itemId: string, field: string, currentValue: string) => {
    setEditingField({ itemId, field })
    setEditValue(currentValue || '')
  }
  
  // Handle image upload for items without images
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const itemId = pendingUploadItemId
    
    if (!file || !itemId) {
      setPendingUploadItemId(null)
      return
    }
    
    const item = specs.find(s => s.id === itemId)
    if (!item) {
      setPendingUploadItemId(null)
      return
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      setPendingUploadItemId(null)
      e.target.value = ''
      return
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      setPendingUploadItemId(null)
      e.target.value = ''
      return
    }
    
    setUploadingImageForItem(itemId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'general')
      
      const uploadRes = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })
      
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        if (uploadData.url) {
          // Update the item with the new image
          const updateRes = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              thumbnailUrl: uploadData.url,
              images: [uploadData.url]
            })
          })
          
          if (updateRes.ok) {
            // Update local state
            setSpecs(prev => prev.map(s => 
              s.id === itemId 
                ? { ...s, thumbnailUrl: uploadData.url, images: [uploadData.url, ...(s.images || []).slice(1)] }
                : s
            ))
            toast.success('Image uploaded successfully!')
          } else {
            toast.error('Failed to save image')
          }
        }
      } else {
        toast.error('Failed to upload image')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImageForItem(null)
      setPendingUploadItemId(null)
      e.target.value = ''
    }
  }
  
  // Save inline edit
  const saveInlineEdit = async () => {
    if (!editingField) return
    
    const item = specs.find(s => s.id === editingField.itemId)
    if (!item) return
    
    // Validate unique doc code within project
    if (editingField.field === 'docCode' && editValue.trim()) {
      const existingDocCode = specs.find(s => 
        s.id !== editingField.itemId && 
        s.docCode && 
        s.docCode.toLowerCase() === editValue.trim().toLowerCase()
      )
      if (existingDocCode) {
        toast.error(`Doc code "${editValue}" already exists in this project`)
        setEditingField(null)
        setEditValue('')
        return
      }
    }
    
    try {
      const updateData: Record<string, string> = {}
      updateData[editingField.field] = editValue
      
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${editingField.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (res.ok) {
        // Update local state - handle numeric fields properly
        let parsedValue: any = editValue
        if (editingField.field === 'quantity') {
          parsedValue = parseInt(editValue) || 1
        } else if (editingField.field === 'tradePrice' || editingField.field === 'rrp' || editingField.field === 'unitCost' || editingField.field === 'tradeDiscount') {
          parsedValue = editValue ? parseFloat(editValue) : null
        }
        
        setSpecs(prev => prev.map(s => 
          s.id === editingField.itemId 
            ? { ...s, [editingField.field]: parsedValue }
            : s
        ))
        toast.success('Updated')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Save failed:', errorData)
        toast.error(errorData.error || 'Failed to update')
      }
    } catch (error) {
      console.error('Error updating field:', error)
      toast.error('Failed to update')
    }
    
    setEditingField(null)
    setEditValue('')
  }
  
  // Cancel inline edit
  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }
  
  // Handle key press in edit field
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveInlineEdit()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  // Load projects for Copy to... functionality
  const loadProjects = async () => {
    setProjectsLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (Array.isArray(data)) {
        // Filter out current project
        setProjectsList(data.filter((p: any) => p.id !== project.id).map((p: any) => ({ id: p.id, name: p.name })))
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  // Load rendering images for a room (for crop from rendering feature)
  const loadRenderingImages = async (roomId: string) => {
    if (!roomId) {
      setRenderingImages([])
      return
    }
    
    try {
      setLoadingRenderingImages(true)
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.renderings && result.renderings.length > 0) {
          setRenderingImages(result.renderings.map((r: any) => ({
            id: r.id,
            url: r.url,
            filename: r.filename || 'Rendering'
          })))
        } else {
          setRenderingImages([])
        }
      } else {
        setRenderingImages([])
      }
    } catch (error) {
      console.error('Error loading rendering images:', error)
      setRenderingImages([])
    } finally {
      setLoadingRenderingImages(false)
    }
  }

  // Get unlinked FFE items from the same section for duplication
  const getUnlinkedFfeItemsForDuplicate = () => {
    if (!duplicateModal.item) return []
    
    const item = duplicateModal.item
    // Find the room
    const room = ffeItems.find(r => r.roomId === item.roomId)
    if (!room) return []
    
    // Find the section (by sectionId)
    const section = room.sections.find(s => s.sectionId === item.sectionId)
    if (!section) return []
    
    // Return only items that are not linked yet
    return section.items.filter(ffeItem => !ffeItem.hasLinkedSpecs)
  }
  
  // Perform the actual duplication with FFE link
  const handleConfirmDuplicate = async () => {
    if (!duplicateModal.item || !selectedDuplicateFfeItem) {
      toast.error('Please select an FFE item to link')
      return
    }
    
    const item = duplicateModal.item
    
    try {
      setDuplicating(true)
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: item.sectionId,
          name: item.name,
          description: item.description,
          brand: item.brand,
          sku: item.sku,
          material: item.material,
          color: item.color,
          finish: item.finish,
          width: item.width,
          height: item.height,
          depth: item.depth,
          leadTime: item.leadTime,
          supplierName: item.supplierName,
          supplierLink: item.supplierLink,
          quantity: item.quantity,
          unitCost: item.unitCost,
          tradePrice: item.tradePrice,
          rrp: item.rrp,
          tradeDiscount: item.tradeDiscount,
          images: item.images,
          isSpecItem: true,
          ffeRequirementId: selectedDuplicateFfeItem,
          specStatus: 'SELECTED',
          visibility: 'VISIBLE'
        })
      })
      
      if (res.ok) {
        toast.success('Item duplicated and linked')
        setDuplicateModal({ open: false, item: null })
        setSelectedDuplicateFfeItem('')
        fetchSpecs()
        // Refresh FFE items to update linked status
        try {
          const ffeRes = await fetch(`/api/projects/${project.id}/ffe-items`)
          const ffeData = await ffeRes.json()
          if (ffeData.success && ffeData.ffeItems) {
            setFfeItems(ffeData.ffeItems)
          }
        } catch (e) {
          // Silent fail on FFE refresh
        }
      } else {
        throw new Error('Failed to duplicate')
      }
    } catch (error) {
      console.error('Error duplicating item:', error)
      toast.error('Failed to duplicate item')
    } finally {
      setDuplicating(false)
    }
  }

  // Move item to a different section
  const handleMoveToSection = async () => {
    if (!moveToSectionModal.item || !selectedMoveSection) return
    
    const item = moveToSectionModal.item
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSectionId: selectedMoveSection })
      })
      
      if (res.ok) {
        toast.success('Item moved to new section')
        fetchSpecs()
        setMoveToSectionModal({ open: false, item: null })
        setSelectedMoveSection('')
      } else {
        throw new Error('Failed to move')
      }
    } catch (error) {
      console.error('Error moving item:', error)
      toast.error('Failed to move item')
    }
  }

  // Copy item to another project
  const handleCopyToProject = async () => {
    if (!copyToProjectModal.item || !selectedCopyProject) return
    
    const item = copyToProjectModal.item
    try {
      // First, get the target project's rooms to find a section
      const roomsRes = await fetch(`/api/projects/${selectedCopyProject}/specs`)
      const roomsData = await roomsRes.json()
      
      if (!roomsData.availableRooms || roomsData.availableRooms.length === 0) {
        toast.error('Target project has no rooms to copy to')
        return
      }
      
      const targetRoom = roomsData.availableRooms[0]
      const targetSection = targetRoom.sections?.[0]
      
      if (!targetSection) {
        toast.error('Target project has no sections to copy to')
        return
      }
      
      // Create the item in the target project
      const res = await fetch(`/api/ffe/v2/rooms/${targetRoom.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: targetSection.id,
          name: item.name,
          description: item.description,
          brand: item.brand,
          sku: item.sku,
          material: item.material,
          color: item.color,
          finish: item.finish,
          width: item.width,
          height: item.height,
          depth: item.depth,
          leadTime: item.leadTime,
          supplierName: item.supplierName,
          supplierLink: item.supplierLink,
          quantity: item.quantity,
          unitCost: item.unitCost,
          tradePrice: item.tradePrice,
          rrp: item.rrp,
          tradeDiscount: item.tradeDiscount,
          images: item.images,
          isSpecItem: true,
          specStatus: 'DRAFT',
          visibility: 'VISIBLE'
        })
      })
      
      if (res.ok) {
        toast.success('Item copied to project')
        setCopyToProjectModal({ open: false, item: null })
        setSelectedCopyProject('')
      } else {
        throw new Error('Failed to copy')
      }
    } catch (error) {
      console.error('Error copying item:', error)
      toast.error('Failed to copy item to project')
    }
  }

  // Add flag to item
  const handleAddFlag = async () => {
    if (!flagModal.item) return
    
    const item = flagModal.item
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customFields: { 
            flag: { color: flagColor, note: flagNote, addedAt: new Date().toISOString() }
          }
        })
      })
      
      if (res.ok) {
        toast.success('Flag added')
        fetchSpecs()
        setFlagModal({ open: false, item: null })
        setFlagColor('red')
        setFlagNote('')
      } else {
        throw new Error('Failed to add flag')
      }
    } catch (error) {
      console.error('Error adding flag:', error)
      toast.error('Failed to add flag')
    }
  }

  // Add item to product library
  const handleAddToLibrary = async (item: SpecItem) => {
    try {
      // First, find or create a category based on the section name
      let categoryId: string | undefined = undefined
      const categoryName = item.sectionName || item.categoryName
      
      if (categoryName) {
        // Fetch existing categories
        const categoriesRes = await fetch('/api/products/categories')
        if (categoriesRes.ok) {
          const { categories } = await categoriesRes.json()
          
          // Find if category already exists (check both parent and children)
          const findCategory = (cats: any[]): any => {
            for (const cat of cats) {
              if (cat.name.toLowerCase() === categoryName.toLowerCase()) {
                return cat
              }
              if (cat.children?.length) {
                const found = findCategory(cat.children)
                if (found) return found
              }
            }
            return null
          }
          
          const existingCategory = findCategory(categories)
          
          if (existingCategory) {
            categoryId = existingCategory.id
          } else {
            // Create new category
            const createCatRes = await fetch('/api/products/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: categoryName })
            })
            if (createCatRes.ok) {
              const { category } = await createCatRes.json()
              categoryId = category.id
            }
          }
        }
      }
      
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.productName || item.name,
          brand: item.brand,
          sku: item.sku,
          modelNumber: item.modelNumber,
          description: item.description,
          thumbnailUrl: item.thumbnailUrl || item.images?.[0] || null,
          images: item.images || [],
          color: item.color,
          finish: item.finish,
          material: item.material,
          width: item.width,
          height: item.height,
          depth: item.depth,
          length: item.length,
          leadTime: item.leadTime,
          tradePrice: item.tradePrice,
          rrp: item.rrp,
          supplierName: item.supplierName,
          supplierLink: item.supplierLink,
          categoryId: categoryId // Include category if found/created
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        toast.success(`✓ Added "${item.productName || item.name}" to product library${categoryId ? ` in ${categoryName}` : ''}`, {
          duration: 4000,
          action: {
            label: 'View Library',
            onClick: () => window.open('/products', '_blank')
          }
        })
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to add to library')
      }
    } catch (error) {
      console.error('Error adding to library:', error)
      toast.error('Failed to add to library')
    }
  }

  // Update item from URL (re-scrape)
  const handleUpdateFromUrl = async (item: SpecItem) => {
    if (!item.supplierLink) {
      toast.error('No product URL to update from')
      return
    }
    
    try {
      // Fetch page content from the URL
      const fetchRes = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.supplierLink })
      })
      
      if (!fetchRes.ok) {
        throw new Error('Failed to fetch page content')
      }
      
      const pageData = await fetchRes.json()
      
      // Use AI to extract product info
      const aiRes = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.supplierLink,
          pageContent: pageData.textContent || pageData.description || '',
          title: pageData.title || '',
          images: pageData.image ? [pageData.image] : []
        })
      })
      
      if (aiRes.ok) {
        const result = await aiRes.json()
        if (result.success && result.data) {
          // Update the item with extracted data
          const updateRes = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productName: result.data.productName,
              brand: result.data.brand,
              description: result.data.productDescription,
              sku: result.data.sku,
              rrp: result.data.rrp ? parseFloat(result.data.rrp.replace(/[^0-9.]/g, '')) : undefined,
              tradePrice: result.data.tradePrice ? parseFloat(result.data.tradePrice.replace(/[^0-9.]/g, '')) : undefined,
              material: result.data.material,
              color: result.data.colour,
              finish: result.data.finish,
              width: result.data.width,
              height: result.data.height,
              depth: result.data.depth,
              leadTime: result.data.leadTime,
              images: result.data.images?.length ? result.data.images : undefined
            })
          })
          
          if (updateRes.ok) {
            toast.success('Item updated from URL')
            fetchSpecs()
          } else {
            throw new Error('Failed to update item')
          }
        }
      } else {
        toast.error('Could not extract data from URL')
      }
    } catch (error) {
      console.error('Error updating from URL:', error)
      toast.error('Failed to update from URL')
    }
  }

  // Remove item from schedule (delete)
  const handleRemoveFromSchedule = async (item: SpecItem) => {
    if (!confirm('Are you sure you want to remove this item from the schedule?')) return
    
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        toast.success('Item removed from schedule')
        fetchSpecs()
      } else {
        throw new Error('Failed to remove')
      }
    } catch (error) {
      console.error('Error removing item:', error)
      toast.error('Failed to remove item')
    }
  }

  // Load share settings
  const loadShareSettings = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/share-settings`)
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setShareSettings({
            isPublished: data.settings.isPublished || false,
            shareUrl: data.settings.shareUrl || `${window.location.origin}/shared/specs/${project.id}`,
            showSupplier: data.settings.showSupplier ?? false,
            showBrand: data.settings.showBrand ?? true,
            showPricing: data.settings.showPricing ?? false,
            showDetails: data.settings.showDetails ?? true
          })
        } else {
          // Set default URL if no settings exist
          setShareSettings(prev => ({
            ...prev,
            shareUrl: `${window.location.origin}/shared/specs/${project.id}`
          }))
        }
      }
    } catch (error) {
      console.error('Failed to load share settings:', error)
      // Set default URL on error
      setShareSettings(prev => ({
        ...prev,
        shareUrl: `${window.location.origin}/shared/specs/${project.id}`
      }))
    }
  }

  // Save share settings
  const handleSaveShareSettings = async (newSettings: typeof shareSettings) => {
    setSavingShareSettings(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/share-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      
      if (res.ok) {
        const data = await res.json()
        setShareSettings({
          ...newSettings,
          shareUrl: data.shareUrl || newSettings.shareUrl
        })
        toast.success(newSettings.isPublished ? 'Published to web' : 'Share settings updated')
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Error saving share settings:', error)
      toast.error('Failed to save share settings')
    } finally {
      setSavingShareSettings(false)
    }
  }

  // Toggle publish status
  const handleTogglePublish = async (isPublished: boolean) => {
    const newSettings = { ...shareSettings, isPublished }
    setShareSettings(newSettings)
    await handleSaveShareSettings(newSettings)
  }

  // Copy share URL to clipboard
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareSettings.shareUrl)
    toast.success('Link copied to clipboard')
  }

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SPECIFIED':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Specified</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Progress</Badge>
      case 'NEEDS_SPEC':
        return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">Needs Spec</Badge>
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Draft</Badge>
    }
  }

  const collapseAll = () => setExpandedCategories(new Set())
  const expandAll = () => setExpandedCategories(new Set(groupedSpecs.map(g => g.name)))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  
  // Format dimension values - convert "63 inches" to "63\"", "24 feet" to "24'" etc.
  const formatDimension = (value: string | null) => {
    if (!value) return '-'
    
    // Patterns to replace (case-insensitive)
    const replacements: [RegExp, string][] = [
      [/\s*inch(es)?/gi, '"'],
      [/\s*in\b/gi, '"'],
      [/\s*feet\b/gi, "'"],
      [/\s*foot\b/gi, "'"],
      [/\s*ft\b/gi, "'"],
      [/\s*square\s*feet\b/gi, ' SF'],
      [/\s*sq\s*ft\b/gi, ' SF'],
      [/\s*square\s*yards?\b/gi, ' SY'],
      [/\s*sq\s*yd\b/gi, ' SY'],
      [/\s*linear\s*feet\b/gi, ' LF'],
      [/\s*lin\s*ft\b/gi, ' LF'],
      [/\s*centimeters?\b/gi, 'cm'],
      [/\s*cm\b/gi, 'cm'],
      [/\s*meters?\b/gi, 'm'],
      [/\s*millimeters?\b/gi, 'mm'],
      [/\s*mm\b/gi, 'mm'],
    ]
    
    let result = value
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement)
    }
    
    return result
  }
  
  // Calculate section totals
  const getSectionTotals = (items: SpecItem[]) => {
    const tradeTotal = items.reduce((sum, item) => sum + ((item.tradePrice || 0) * (item.quantity || 1)), 0)
    const rrpTotal = items.reduce((sum, item) => sum + ((item.rrp || 0) * (item.quantity || 1)), 0)
    return { tradeTotal, rrpTotal }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={imageUploadInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleItemImageUpload}
      />
      
      {/* Header - Matching standard software header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-4">
          {/* Top Row - Back button and Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push(`/projects/${project.id}`)}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Project
              </Button>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">All Specs</h1>
                  <p className="text-xs text-gray-500">{project.name}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Bulk Quotes
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                className="bg-gray-900 hover:bg-gray-800"
                onClick={() => {
                  loadShareSettings()
                  setShareModal(true)
                }}
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Export to CSV</DropdownMenuItem>
                  <DropdownMenuItem>Export to PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Tabs Row - Modern Style */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center">
              {/* Primary Tabs - Clean underline style */}
              <div className="flex items-center border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={cn(
                    "relative px-5 py-3 text-sm font-medium transition-all",
                    activeTab === 'summary'
                      ? "text-emerald-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    All Items
                  </div>
                  {activeTab === 'summary' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('financial')}
                  className={cn(
                    "relative px-5 py-3 text-sm font-medium transition-all",
                    activeTab === 'financial'
                      ? "text-emerald-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Financial
                  </div>
                  {activeTab === 'financial' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('needs')}
                  className={cn(
                    "relative px-5 py-3 text-sm font-medium transition-all",
                    activeTab === 'needs'
                      ? "text-amber-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Circle className="w-4 h-4" />
                    Needs Selection
                    {ffeItems.length > 0 && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs px-1.5 py-0 h-5",
                          activeTab === 'needs' 
                            ? "bg-amber-100 text-amber-700 border-amber-300" 
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
                        {ffeItems.reduce((acc, room) => 
                          acc + room.sections.reduce((sAcc, section) => 
                            sAcc + section.items.filter(item => !item.hasLinkedSpecs).length, 0
                          ), 0
                        )}
                      </Badge>
                    )}
                  </div>
                  {activeTab === 'needs' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 w-48 h-8 text-sm"
                />
              </div>
              
              {/* Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(
                    "h-8",
                    (filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all') ? "text-emerald-600" : "text-gray-500"
                  )}>
                    <Filter className="w-4 h-4 mr-1.5" />
                    Filter
                    {(filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all') && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-emerald-100 text-emerald-600">
                        {(filterStatus !== 'all' ? 1 : 0) + (filterRoom !== 'all' ? 1 : 0) + (filterSection !== 'all' ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-4">
                  <div className="space-y-4">
                    {/* Section Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Section</Label>
                      <Select value={filterSection} onValueChange={setFilterSection}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {groupedSpecs.map((group) => (
                            <SelectItem key={group.sectionId || group.name} value={group.sectionId || 'all'}>
                              <div className="flex items-center justify-between w-full">
                                <span>{group.name}</span>
                                <span className="text-gray-400 text-xs ml-2">({group.items.length})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {ITEM_STATUS_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className={cn("w-3.5 h-3.5", option.color)} />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Room Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Room</Label>
                      <Select value={filterRoom} onValueChange={setFilterRoom}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="All Rooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Rooms</SelectItem>
                          {uniqueRooms.map(room => (
                            <SelectItem key={room} value={room}>{room}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Clear Filters */}
                    {(filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all') && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-8 text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => {
                          setFilterStatus('all')
                          setFilterRoom('all')
                          setFilterSection('all')
                        }}
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-gray-500">
                    <SortAsc className="w-4 h-4 mr-1.5" />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('category')} className={cn(sortBy === 'category' && "bg-gray-100")}>
                    By Category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('room')} className={cn(sortBy === 'room' && "bg-gray-100")}>
                    By Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Client Approval Summary Bar - Always visible */}
          {specs.length > 0 && (
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
                  <p className="text-lg font-semibold text-emerald-600">{specs.filter(s => s.clientApproved).length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Approval</p>
                  <p className="text-lg font-semibold text-amber-600">{specs.filter(s => !s.clientApproved).length}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="w-full max-w-[200px] h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${specs.length > 0 ? (specs.filter(s => s.clientApproved).length / specs.length * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {specs.length > 0 ? Math.round(specs.filter(s => s.clientApproved).length / specs.length * 100) : 0}% approved
                </span>
              </div>
            </div>
          )}
          
          {/* Financial Summary Bar - Only in Financial Tab */}
          {activeTab === 'financial' && (
            <div className="flex items-center gap-8 mt-3 pt-3 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Trade Price</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(financials.totalTradePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total RRP</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(financials.totalRRP)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Avg Trade Discount</p>
                <p className="text-lg font-semibold text-gray-900">{financials.avgTradeDiscount.toFixed(2)}%</p>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Add Markup</span>
                <button className="w-10 h-5 bg-gray-200 rounded-full relative">
                  <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Needs Selection Tab Content */}
      {activeTab === 'needs' && (
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-sm">
                <Circle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">FFE Items Needing Selection</h3>
                <p className="text-sm text-gray-600">
                  Items from FFE Workspace that don&apos;t have products chosen yet
                </p>
              </div>
            </div>
            
            {/* Unchosen Items List */}
            <div className="space-y-3">
              {sortBy === 'category' ? (
                // Group by category/section
                (() => {
                  const byCategory = new Map<string, Array<{ roomName: string; roomId: string; sectionId: string; item: any }>>()
                  filteredFfeItems.forEach(room => {
                    room.sections.forEach(section => {
                      // Include all unchosen items (both parent and linked items)
                      section.items.filter(item => !item.hasLinkedSpecs).forEach(item => {
                        const key = section.sectionName
                        if (!byCategory.has(key)) byCategory.set(key, [])
                        byCategory.get(key)!.push({ roomName: room.roomName, roomId: room.roomId, sectionId: section.sectionId, item })
                      })
                    })
                  })
                  return Array.from(byCategory.entries()).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100/50 px-4 py-2 border-b border-gray-200">
                        <span className="font-medium text-gray-900">{category}</span>
                        <span className="text-sm text-gray-500 ml-2">({items.length} items)</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map(({ roomName, roomId, sectionId, item }) => (
                          <div 
                            key={item.id} 
                            className={cn(
                              "py-3 hover:bg-gray-50",
                              item.isLinkedItem ? "px-8 bg-gray-50/50" : "px-4"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {item.isLinkedItem && (
                                  <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 -ml-4 mr-1" />
                                )}
                                <Circle className={cn("w-4 h-4", item.isLinkedItem ? "text-gray-400" : "text-gray-400")} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{item.name}</p>
                                    {item.isLinkedItem && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-500 border-gray-300">
                                        linked to {item.parentName}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">{roomName}</p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1 border-gray-300 text-gray-700 hover:bg-gray-100"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Choose
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setUrlGenerateDialog({
                                      open: true,
                                      ffeItem: { id: item.id, name: item.name, roomId, sectionId }
                                    })
                                  }}>
                                    <Globe className="w-4 h-4 mr-2" />
                                    Generate from URL
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedFfeRoom(roomId)
                                    setSelectedFfeSection(sectionId)
                                    setSelectedFfeItemId(item.id)
                                    setDetailPanel({
                                      isOpen: true,
                                      mode: 'create',
                                      item: null,
                                      sectionId: sectionId,
                                      roomId: roomId
                                    })
                                  }}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add New
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {/* Notes Display */}
                            {item.notes && (
                              <div className="mt-2 ml-7 flex items-start gap-2 bg-amber-50/50 rounded-lg p-2">
                                <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-gray-600">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()
              ) : (
                // Group by room
                filteredFfeItems.filter(room => room.sections.some(s => s.items.some(i => !i.hasLinkedSpecs))).map(room => (
                  <div key={room.roomId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100/50 px-4 py-2 border-b border-gray-200">
                      <span className="font-medium text-gray-900">{room.roomName}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({room.sections.reduce((acc, s) => acc + s.items.filter(i => !i.hasLinkedSpecs).length, 0)} items)
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {room.sections.flatMap(section => 
                        section.items.filter(item => !item.hasLinkedSpecs).map(item => (
                          <div 
                            key={item.id} 
                            className={cn(
                              "py-3 hover:bg-gray-50",
                              item.isLinkedItem ? "px-8 bg-gray-50/50" : "px-4"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {item.isLinkedItem && (
                                  <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 -ml-4 mr-1" />
                                )}
                                <Circle className={cn("w-4 h-4", item.isLinkedItem ? "text-gray-400" : "text-gray-400")} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{item.name}</p>
                                    {item.isLinkedItem && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-500 border-gray-300">
                                        linked to {item.parentName}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">{section.sectionName}</p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1 border-gray-300 text-gray-700 hover:bg-gray-100"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Choose
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setUrlGenerateDialog({
                                      open: true,
                                      ffeItem: { id: item.id, name: item.name, roomId: room.roomId, sectionId: section.sectionId }
                                    })
                                  }}>
                                    <Globe className="w-4 h-4 mr-2" />
                                    Generate from URL
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedFfeRoom(room.roomId)
                                    setSelectedFfeSection(section.sectionId)
                                    setSelectedFfeItemId(item.id)
                                    setDetailPanel({
                                      isOpen: true,
                                      mode: 'create',
                                      item: null,
                                      sectionId: section.sectionId,
                                      roomId: room.roomId
                                    })
                                  }}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add New
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {/* Notes Display */}
                            {item.notes && (
                              <div className="mt-2 ml-7 flex items-start gap-2 bg-amber-50/50 rounded-lg p-2">
                                <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-gray-600">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {filteredFfeItems.every(room => room.sections.every(s => s.items.every(i => i.hasLinkedSpecs))) && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                  <p className="font-medium text-emerald-700">All FFE items have products selected!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content - Show for Summary and Financial tabs */}
      {activeTab !== 'needs' && (
      <div className="max-w-full mx-auto px-4 py-4">
        {groupedSpecs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            {/* Show available sections if any */}
            {availableRooms.some(r => r.sections.length > 0) ? (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to add specs</h3>
                  <p className="text-gray-500">Click on a section below to add items, or use the Chrome extension.</p>
                </div>
                
                {availableRooms.filter(r => r.sections.length > 0).map(room => (
                  <div key={room.id} className="space-y-2">
                    {room.sections.map(section => (
                      <div 
                        key={section.id}
                        className="group flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{section.name}</p>
                            <p className="text-sm text-gray-500">No items yet</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                            onClick={() => openLibraryModal(section.id, room.id)}
                          >
                            <Library className="w-3.5 h-3.5" />
                            From Library
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600"
                            onClick={() => setAddFromUrlModal({ open: true, sectionId: section.id, roomId: room.id })}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            From URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
                            onClick={() => setDetailPanel({
                              isOpen: true,
                              mode: 'create',
                              item: null,
                              sectionId: section.id,
                              roomId: room.id
                            })}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Custom Item
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                
                <div className="text-center pt-4 border-t border-gray-200 mt-6">
                  <Button 
                    variant="outline"
                    onClick={() => setAddSectionModal({ open: true, categoryName: null })}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Section
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No specs found</h3>
                <p className="text-gray-500 mb-6">Add product specifications using the Chrome extension or manually below.</p>
                
                <div className="flex justify-center gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setAddSectionModal({ open: true, categoryName: null })}
                    className="gap-2"
                  >
                    <Layers className="w-4 h-4" />
                    Add Section
                  </Button>
                  <Button
                    onClick={() => {
                      // If we have available rooms/sections, use the first one
                      if (availableRooms.length > 0 && availableRooms[0].sections.length > 0) {
                        setDetailPanel({
                          isOpen: true,
                          mode: 'create',
                          item: null,
                          sectionId: availableRooms[0].sections[0].id,
                          roomId: availableRooms[0].id
                        })
                      } else {
                        toast.error('Please add a section first')
                      }
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedSpecs.map((group) => (
              <div 
                key={group.name} 
                id={`section-${group.name.replace(/\s+/g, '-')}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden scroll-mt-40"
                onMouseEnter={() => setHoveredSection(group.name)}
                onMouseLeave={() => setHoveredSection(null)}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <button
                    onClick={() => toggleCategory(group.name)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {expandedCategories.has(group.name) ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 text-xs h-5">
                      {group.items.length}
                    </Badge>
                    {activeTab === 'financial' && (
                      <span className="text-sm font-medium text-gray-700 ml-2">
                        {formatCurrency(getSectionTotals(group.items).tradeTotal)}
                      </span>
                    )}
                  </button>
                </div>

                {/* Items */}
                {expandedCategories.has(group.name) && (
                  <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={group.items.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                    {/* Items Table */}
                    <div className="divide-y divide-gray-100">
                      {group.items.map((item) => (
                        <SortableSpecItem key={item.id} id={item.id}>
                          {(listeners: any) => (
                        <div 
                          id={`spec-item-${item.id}`}
                          className={cn(
                            "group/item relative flex items-center transition-colors border-l-2",
                            highlightedItemId === item.id
                              ? "bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300"
                              : selectedItems.has(item.id) 
                                ? "bg-blue-50 border-blue-500" 
                                : "hover:bg-gray-50 border-transparent hover:border-blue-400"
                          )}
                          onMouseEnter={() => setHoveredItem(item.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {/* Hover Actions - Fixed on left side, always show if selected */}
                          <div className={cn(
                            "absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 transition-opacity duration-150",
                            (hoveredItem === item.id || selectedItems.has(item.id)) ? "opacity-100" : "opacity-0"
                          )}>
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4"
                            />
                            <button 
                              {...listeners}
                              className="p-0.5 cursor-grab hover:bg-gray-200 rounded touch-none"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                          
                          {/* Main Item Row - Using flex for better control */}
                          <div className="flex items-center w-full px-4 py-3 pl-14 gap-3 overflow-hidden">
                            {/* Image - Fixed width, clickable to open editor or upload */}
                            <div className="flex-shrink-0 w-16">
                              <div 
                                className={cn(
                                  "w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer transition-all",
                                  (item.thumbnailUrl || item.images?.[0]) 
                                    ? "hover:ring-2 hover:ring-purple-400 hover:ring-offset-1" 
                                    : "hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 hover:bg-gray-200",
                                  uploadingImageForItem === item.id && "opacity-50"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (item.thumbnailUrl || item.images?.[0]) {
                                    setImageEditorModal({
                                      open: true,
                                      imageUrl: item.thumbnailUrl || item.images[0],
                                      imageTitle: `${item.sectionName}: ${item.name}`,
                                      itemId: item.id
                                    })
                                  } else {
                                    // Trigger file upload
                                    setPendingUploadItemId(item.id)
                                    imageUploadInputRef.current?.click()
                                  }
                                }}
                                title={item.thumbnailUrl || item.images?.[0] ? "Click to view/edit image" : "Click to upload image"}
                              >
                                {uploadingImageForItem === item.id ? (
                                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                ) : item.thumbnailUrl || item.images?.[0] ? (
                                  <img 
                                    src={item.thumbnailUrl || item.images[0]} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <ImageIcon className="w-5 h-5 text-gray-400" />
                                    <span className="text-[8px] text-gray-400 mt-0.5">Add</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Title & Room - Fixed width */}
                            <div className="flex-shrink-0 w-36">
                              {editingField?.itemId === item.id && editingField?.field === 'name' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-7 text-sm font-medium"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <p 
                                    className="text-sm font-medium text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1 flex-1"
                                    onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'name', item.name || '') }}
                                  >
                                    {item.name}
                                  </p>
                                  {(item.customFields as any)?.flag && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button 
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex-shrink-0"
                                          title={(item.customFields as any)?.flag?.note || 'Flagged'}
                                        >
                                          <Flag className={cn(
                                            "w-3.5 h-3.5",
                                            (item.customFields as any)?.flag?.color === 'red' && "text-red-500",
                                            (item.customFields as any)?.flag?.color === 'orange' && "text-orange-500",
                                            (item.customFields as any)?.flag?.color === 'yellow' && "text-yellow-500",
                                            (item.customFields as any)?.flag?.color === 'green' && "text-green-500",
                                            (item.customFields as any)?.flag?.color === 'blue' && "text-blue-500",
                                            (item.customFields as any)?.flag?.color === 'purple' && "text-purple-500",
                                          )} />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                                        <p className="text-xs font-medium mb-1">Flagged</p>
                                        {(item.customFields as any)?.flag?.note && (
                                          <p className="text-xs text-gray-600">{(item.customFields as any).flag.note}</p>
                                        )}
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="w-full mt-2 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={async () => {
                                            try {
                                              await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ customFields: { flag: null } })
                                              })
                                              fetchSpecs()
                                              toast.success('Flag removed')
                                            } catch (error) {
                                              toast.error('Failed to remove flag')
                                            }
                                          }}
                                        >
                                          Remove Flag
                                        </Button>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 truncate">{item.roomName}</p>
                              {/* Show linked FFE items - new many-to-many format */}
                              {item.linkedFfeItems && item.linkedFfeItems.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 mt-0.5 truncate hover:underline"
                                    >
                                      <LinkIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                      {item.linkedFfeItems[0].roomName}: {item.linkedFfeItems[0].ffeItemName}
                                      {item.linkedFfeItems.length > 1 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-medium">
                                          +{item.linkedFfeItems.length - 1}
                                        </span>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-64 p-0" 
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="p-2 border-b bg-gray-50">
                                      <p className="text-xs font-medium text-gray-700">
                                        Linked FFE Items ({item.linkedFfeItems.length})
                                      </p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y">
                                      {item.linkedFfeItems.map((ffeItem) => (
                                        <a
                                          key={ffeItem.linkId}
                                          href={`/ffe/${ffeItem.roomId}/workspace?highlight=${ffeItem.ffeItemId}`}
                                          className="block p-2 hover:bg-blue-50 transition-colors"
                                        >
                                          <p className="text-xs font-medium text-gray-900 truncate">
                                            {ffeItem.ffeItemName}
                                          </p>
                                          <p className="text-[10px] text-gray-500 truncate">
                                            {ffeItem.roomName} · {ffeItem.sectionName}
                                          </p>
                                        </a>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : item.ffeRequirementName && (
                                /* Legacy one-to-one link fallback */
                                <a
                                  href={`/ffe/${item.roomId}/workspace?highlight=${item.ffeRequirementId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 mt-0.5 truncate"
                                  title={`FFE: ${item.ffeRequirementName}`}
                                >
                                  <LinkIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                  {item.ffeRequirementName}
                                </a>
                              )}
                            </div>
                            
                            {/* Link Icon - Shows input when editing */}
                            <div className="flex-shrink-0 relative">
                              {editingField?.itemId === item.id && editingField?.field === 'supplierLink' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs w-48 z-20"
                                  autoFocus
                                  placeholder="https://..."
                                />
                              ) : (
                                <div className="w-8 flex justify-center">
                                  {item.supplierLink ? (
                                    <a 
                                      href={item.supplierLink} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                                      title="Open product page"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  ) : (
                                    <button 
                                      className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                      onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'supplierLink', '') }}
                                      title="Add product link"
                                    >
                                      <LinkIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Doc Code - Fixed width */}
                            <div className="flex-shrink-0 w-24">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Doc Code</p>
                              {editingField?.itemId === item.id && editingField?.field === 'docCode' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'docCode', item.docCode || '') }}
                                >
                                  {item.docCode || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Model - Flexible */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Model</p>
                              {editingField?.itemId === item.id && editingField?.field === 'modelNumber' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                  placeholder="e.g., K-560-VS"
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'modelNumber', item.modelNumber || item.sku || '') }}
                                  title={item.modelNumber || item.sku || 'Click to add model'}
                                >
                                  {item.modelNumber || item.sku || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Brand - Fixed width */}
                            <div className="flex-shrink-0 w-16">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Brand</p>
                              {editingField?.itemId === item.id && editingField?.field === 'brand' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'brand', item.brand || '') }}
                                >
                                  {item.brand || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Width (IN) */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Width</p>
                              {editingField?.itemId === item.id && editingField?.field === 'width' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs text-center"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'width', item.width || '') }}
                                  title={item.width || undefined}
                                >
                                  {formatDimension(item.width)}
                                </p>
                              )}
                            </div>
                            
                            {/* Length (IN) */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Length</p>
                              {editingField?.itemId === item.id && editingField?.field === 'length' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs text-center"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'length', item.length || '') }}
                                  title={item.length || undefined}
                                >
                                  {formatDimension(item.length)}
                                </p>
                              )}
                            </div>
                            
                            {/* Height (IN) */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Height</p>
                              {editingField?.itemId === item.id && editingField?.field === 'height' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs text-center"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'height', item.height || '') }}
                                  title={item.height || undefined}
                                >
                                  {formatDimension(item.height)}
                                </p>
                              )}
                            </div>
                            
                            {/* Depth (IN) */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Depth</p>
                              {editingField?.itemId === item.id && editingField?.field === 'depth' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs text-center"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'depth', item.depth || '') }}
                                  title={item.depth || undefined}
                                >
                                  {formatDimension(item.depth)}
                                </p>
                              )}
                            </div>
                            
                            {/* Colour */}
                            <div className="flex-shrink-0 w-16">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Colour</p>
                              {editingField?.itemId === item.id && editingField?.field === 'color' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'color', item.color || '') }}
                                >
                                  {item.color || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Finish */}
                            <div className="flex-shrink-0 w-16">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Finish</p>
                              {editingField?.itemId === item.id && editingField?.field === 'finish' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'finish', item.finish || '') }}
                                >
                                  {item.finish || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Material */}
                            <div className="flex-shrink-0 w-20">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Material</p>
                              {editingField?.itemId === item.id && editingField?.field === 'material' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'material', item.material || '') }}
                                >
                                  {item.material || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* QTY - Fixed width */}
                            <div className="flex-shrink-0 w-14 text-center">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Qty</p>
                              {editingField?.itemId === item.id && editingField?.field === 'quantity' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="h-6 text-xs text-center"
                                  autoFocus
                                  type="number"
                                  min="1"
                                />
                              ) : (
                                <p 
                                  className="text-xs text-gray-700 cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'quantity', item.quantity?.toString() || '1') }}
                                >
                                  {item.quantity || 1}
                                </p>
                              )}
                            </div>
                            
                            {/* Unit Type - Fixed width with dropdown picker (like Supplier) */}
                            <div className="flex-shrink-0 w-14" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Unit</p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button 
                                    className="w-full text-left text-xs text-gray-700 truncate cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.unitType && item.unitType !== 'units' ? item.unitType.toUpperCase() : <span className="text-gray-400">-</span>}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-32">
                                  {UNIT_TYPE_OPTIONS.map(opt => (
                                    <DropdownMenuItem 
                                      key={opt.value}
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ unitType: opt.value })
                                          })
                                          if (res.ok) {
                                            setSpecs(prev => prev.map(s => s.id === item.id ? { ...s, unitType: opt.value } : s))
                                          }
                                        } catch (error) {
                                          console.error('Error updating unit type:', error)
                                        }
                                      }}
                                      className={item.unitType === opt.value ? 'bg-gray-100' : ''}
                                    >
                                      {opt.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {/* Lead Time - Fixed width with dropdown picker (like Supplier) */}
                            <div className="flex-shrink-0 w-20" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Lead Time</p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button 
                                    className="w-full text-left text-xs text-gray-700 truncate cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.leadTime ? (
                                      LEAD_TIME_OPTIONS.find(o => o.value === item.leadTime)?.label || item.leadTime
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-32">
                                  {LEAD_TIME_OPTIONS.map(opt => (
                                    <DropdownMenuItem 
                                      key={opt.value}
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ leadTime: opt.value })
                                          })
                                          if (res.ok) {
                                            setSpecs(prev => prev.map(s => s.id === item.id ? { ...s, leadTime: opt.value } : s))
                                          }
                                        } catch (error) {
                                          console.error('Error updating lead time:', error)
                                        }
                                      }}
                                      className={item.leadTime === opt.value ? 'bg-gray-100' : ''}
                                    >
                                      {opt.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            {/* Financial Columns - Only in Financial Tab */}
                            {activeTab === 'financial' && (
                              <>
                                {/* Trade Price */}
                                <div className="flex-shrink-0 w-20 text-right">
                                  <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Trade</p>
                                  {editingField?.itemId === item.id && editingField?.field === 'tradePrice' ? (
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleEditKeyDown}
                                      className="h-6 text-xs text-right"
                                      autoFocus
                                      type="number"
                                      step="0.01"
                                    />
                                  ) : (
                                    <p 
                                      className="text-xs text-gray-900 cursor-text hover:bg-gray-100 rounded px-1"
                                      onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'tradePrice', item.tradePrice?.toString() || '') }}
                                    >
                                      {item.tradePrice ? formatCurrency(item.tradePrice) : '-'}
                                    </p>
                                  )}
                                </div>
                                
                                {/* RRP */}
                                <div className="flex-shrink-0 w-20 text-right">
                                  <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">RRP</p>
                                  {editingField?.itemId === item.id && editingField?.field === 'rrp' ? (
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleEditKeyDown}
                                      className="h-6 text-xs text-right"
                                      autoFocus
                                      type="number"
                                      step="0.01"
                                    />
                                  ) : (
                                    <p 
                                      className="text-xs text-gray-900 cursor-text hover:bg-gray-100 rounded px-1"
                                      onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'rrp', item.rrp?.toString() || '') }}
                                    >
                                      {item.rrp ? formatCurrency(item.rrp) : '-'}
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                            
                            {/* Supplier - Fixed width with dropdown picker */}
                            <div className="flex-shrink-0 w-32 relative" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Supplier</p>
                              <DropdownMenu open={supplierPickerItem === item.id} onOpenChange={(open) => setSupplierPickerItem(open ? item.id : null)}>
                                <DropdownMenuTrigger asChild>
                                  <button 
                                    className="w-full text-left text-xs text-gray-700 truncate cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.supplierName || <span className="text-gray-400">Select Supplier</span>}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64">
                                  {suppliers.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500">Supplier Phonebook</div>
                                      {suppliers.map((supplier) => (
                                        <DropdownMenuItem 
                                          key={supplier.id}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleSelectSupplier(item.id, supplier)
                                          }}
                                          className="text-xs"
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs flex-shrink-0">
                                              {supplier.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="font-medium truncate">{supplier.name}</p>
                                              {supplier.contactName && (
                                                <p className="text-gray-500 text-[10px] truncate">{supplier.contactName}</p>
                                              )}
                                            </div>
                                          </div>
                                        </DropdownMenuItem>
                                      ))}
                                      <div className="border-t border-gray-100 my-1" />
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSupplierPickerItem(null)
                                      setAddSupplierModal({ open: true, forItemId: item.id })
                                    }}
                                    className="text-xs text-blue-600"
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                    Add New Supplier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSupplierPickerItem(null)
                                      startEditing(item.id, 'supplierName', item.supplierName || '')
                                    }}
                                    className="text-xs text-gray-500"
                                  >
                                    <span className="w-3.5 h-3.5 mr-2" />
                                    Enter Manually
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              {editingField?.itemId === item.id && editingField?.field === 'supplierName' && (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleEditKeyDown}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute top-4 left-0 h-6 text-xs w-full z-10"
                                  autoFocus
                                  placeholder="Enter supplier name"
                                />
                              )}
                            </div>
                            
                            {/* Status & Actions - Fixed at right edge */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-auto">
                              {/* Row 1: Approve + Status + Menu */}
                              <div className="flex items-center gap-1.5">
                                {/* Client Approved Checkbox */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleClientApproval(item.id, item.clientApproved)
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all",
                                    item.clientApproved 
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                  )}
                                  title={item.clientApproved ? "Client has approved this item" : "Click to mark as client approved"}
                                >
                                  {item.clientApproved ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-gray-300" />
                                  )}
                                  <span className="hidden sm:inline">{item.clientApproved ? 'Approved' : 'Approve'}</span>
                                </button>
                                
                                {/* Status Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button 
                                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 bg-white text-xs transition-colors whitespace-nowrap min-w-[110px]"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {getItemStatusDisplay(item.specStatus || 'DRAFT')}
                                      <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {ITEM_STATUS_OPTIONS.map((option) => {
                                      const IconComponent = option.icon
                                      const isDisabled = option.requiresApproval && !item.clientApproved
                                      return (
                                        <DropdownMenuItem 
                                          key={option.value}
                                          disabled={isDisabled}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (!isDisabled) {
                                              handleUpdateItemStatus(item.id, option.value)
                                            }
                                          }}
                                          className={cn(
                                            "flex items-center gap-2 text-xs",
                                            isDisabled && "opacity-50 cursor-not-allowed"
                                          )}
                                        >
                                          <IconComponent className={cn("w-3.5 h-3.5", option.color)} />
                                          <span className="flex-1">{option.label}</span>
                                          {isDisabled && (
                                            <span className="text-[10px] text-amber-500 ml-1">Needs Approval</span>
                                          )}
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                
                                {/* 3-dots Menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="w-4 h-4 text-gray-400" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {/* Quote */}
                                    <DropdownMenuItem 
                                      className="text-xs"
                                      onSelect={() => toast('Quote feature coming soon')}
                                    >
                                      <FileText className="w-3.5 h-3.5 mr-2" />
                                      Request Quote
                                    </DropdownMenuItem>
                                    
                                    <div className="h-px bg-gray-100 my-1" />
                                    
                                    {/* Flag */}
                                    <DropdownMenuItem 
                                      className="text-xs"
                                      onSelect={(e) => {
                                        e.preventDefault()
                                        setFlagModal({ open: true, item: item })
                                      }}
                                    >
                                    <Flag className="w-3.5 h-3.5 mr-2" />
                                    Add a Flag
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs text-gray-400"
                                    onSelect={() => toast('Archive feature coming soon')}
                                  >
                                    <Archive className="w-3.5 h-3.5 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      handleAddToLibrary(item)
                                    }}
                                  >
                                    <BookPlus className="w-3.5 h-3.5 mr-2" />
                                    Add to Product Library
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      setDuplicateModal({ open: true, item: item })
                                      setSelectedDuplicateFfeItem('')
                                    }}
                                  >
                                    <Copy className="w-3.5 h-3.5 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      loadProjects()
                                      setCopyToProjectModal({ open: true, item: item })
                                    }}
                                  >
                                    <FolderInput className="w-3.5 h-3.5 mr-2" />
                                    Copy to...
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      setMoveToSectionModal({ open: true, item: item })
                                    }}
                                  >
                                    <Layers className="w-3.5 h-3.5 mr-2" />
                                    Move to section...
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs text-gray-400"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toast('PDF export coming soon')
                                    }}
                                  >
                                    <FileText className="w-3.5 h-3.5 mr-2" />
                                    Export PDF Spec Sheet
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateFromUrl(item)
                                    }}
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                    Update from URL
                                  </DropdownMenuItem>
                                  <div className="border-t border-gray-100 my-1" />
                                  <DropdownMenuItem 
                                    className="text-xs text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveFromSchedule(item)
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Remove From Schedule
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              </div>
                              
                              {/* Row 2: Details Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailPanel({
                                    isOpen: true,
                                    mode: 'view',
                                    item: item,
                                    sectionId: item.sectionId,
                                    roomId: item.roomId
                                  })
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                          )}
                        </SortableSpecItem>
                      ))}
                    </div>
                    </SortableContext>
                  </DndContext>
                    
                  {/* Add Item Actions - Bottom of Section - Only visible on hover */}
                  {group.sectionId && group.roomId && (
                    <div className={cn(
                      "flex items-center gap-2 px-4 h-10 bg-gray-50/50 border-t border-gray-100 transition-opacity duration-200",
                      hoveredSection === group.name ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => openLibraryModal(group.sectionId!, group.roomId!)}
                      >
                        <Library className="w-3.5 h-3.5" />
                        From Library
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600"
                        onClick={() => setAddFromUrlModal({ open: true, sectionId: group.sectionId!, roomId: group.roomId! })}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Add from URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-100"
                        onClick={() => setDetailPanel({
                          isOpen: true,
                          mode: 'create',
                          item: null,
                          sectionId: group.sectionId!,
                          roomId: group.roomId!
                        })}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Custom Item
                      </Button>
                    </div>
                  )}
                </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
      
      {/* Floating Add Button - Only show when not on needs tab */}
      {activeTab !== 'needs' && groupedSpecs.length > 0 && groupedSpecs[0]?.sectionId && groupedSpecs[0]?.roomId && (
        <div className="fixed bottom-8 right-8 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 p-0"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
              <DropdownMenuItem onClick={() => openLibraryModal(groupedSpecs[0].sectionId!, groupedSpecs[0].roomId!)}>
                <Library className="w-4 h-4 mr-2" />
                Product from Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddFromUrlModal({ open: true, sectionId: groupedSpecs[0].sectionId!, roomId: groupedSpecs[0].roomId! })}>
                <Sparkles className="w-4 h-4 mr-2" />
                Add from URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDetailPanel({
                isOpen: true,
                mode: 'create',
                item: null,
                sectionId: groupedSpecs[0]?.sectionId,
                roomId: groupedSpecs[0]?.roomId
              })}>
                <Plus className="w-4 h-4 mr-2" />
                Custom Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      {/* URL Generate Dialog for Needs Selection */}
      <Dialog 
        open={urlGenerateDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setUrlGenerateDialog({ open: false, ffeItem: null })
            setUrlGenerateInput('')
            setUrlGenerateData(null)
            setUrlGenerateEditing(false)
            setUrlGenerateShowNotes(false)
            setUrlGenerateShowSupplier(false)
            setUrlGenerateSelectedSupplier(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              Generate Product from URL
            </DialogTitle>
            <DialogDescription>
              Linking product to: <span className="font-medium text-gray-900">{urlGenerateDialog.ffeItem?.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={urlGenerateInput}
                  onChange={(e) => setUrlGenerateInput(e.target.value)}
                  placeholder="https://www.example.com/product-page"
                  className="pl-9 pr-9"
                  disabled={urlGenerateExtracting}
                />
                <button
                  type="button"
                  onClick={handleUrlGeneratePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
              <Button 
                onClick={handleUrlGenerateExtract}
                disabled={urlGenerateExtracting || !urlGenerateInput.trim()}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {urlGenerateExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract
                  </>
                )}
              </Button>
            </div>
            
            {/* Extracted Data Preview */}
            {urlGenerateData && (
              <div className="border rounded-lg p-4 space-y-4">
                {/* Header with Edit button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Extracted Product</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUrlGenerateEditing(!urlGenerateEditing)}
                    className="h-7 text-xs"
                  >
                    {urlGenerateEditing ? 'Done Editing' : 'Edit Details'}
                  </Button>
                </div>
                
                {/* Images */}
                <div className="flex flex-wrap gap-2">
                  {urlGenerateData.images?.map((img: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt="Product" 
                        className="w-16 h-16 object-cover rounded border bg-white"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUrlGenerateData((prev: any) => ({
                            ...prev,
                            images: prev.images.filter((_: string, i: number) => i !== idx)
                          }))
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* Add Image Upload */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        if (file.size > 4 * 1024 * 1024) {
                          toast.error('Image must be under 4MB')
                          return
                        }
                        
                        setUrlGenerateUploadingImage(true)
                        try {
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
                              setUrlGenerateData((prev: any) => ({
                                ...prev,
                                images: [...(prev.images || []), data.url]
                              }))
                              toast.success('Image uploaded')
                            }
                          } else {
                            toast.error('Failed to upload image')
                          }
                        } catch (error) {
                          console.error('Upload error:', error)
                          toast.error('Failed to upload image')
                        } finally {
                          setUrlGenerateUploadingImage(false)
                          e.target.value = ''
                        }
                      }}
                    />
                    <div className={cn(
                      "w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors",
                      urlGenerateUploadingImage && "opacity-50 pointer-events-none"
                    )}>
                      {urlGenerateUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span className="text-[10px] mt-0.5">Upload</span>
                        </>
                      )}
                    </div>
                  </label>
                  {/* Crop from Rendering button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (urlGenerateModal.roomId) {
                        loadRenderingImages(urlGenerateModal.roomId)
                      }
                      setShowCropDialogForUrlGenerate(true)
                    }}
                    className="w-16 h-16 border-2 border-dashed border-purple-300 rounded flex flex-col items-center justify-center text-purple-500 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    title="Crop from 3D Rendering"
                  >
                    <Scissors className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5">Crop</span>
                  </button>
                </div>
                
                {/* Product Details */}
                {urlGenerateEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Product Name</Label>
                      <Input
                        value={urlGenerateData.productName || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, productName: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Brand</Label>
                      <Input
                        value={urlGenerateData.brand || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, brand: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">SKU</Label>
                      <Input
                        value={urlGenerateData.sku || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, sku: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">RRP</Label>
                      <Input
                        value={urlGenerateData.rrp || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, rrp: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Trade Price</Label>
                      <Input
                        value={urlGenerateData.tradePrice || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, tradePrice: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Lead Time</Label>
                      <Input
                        value={urlGenerateData.leadTime || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, leadTime: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Width</Label>
                      <Input
                        value={urlGenerateData.width || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, width: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Height</Label>
                      <Input
                        value={urlGenerateData.height || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, height: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Depth</Label>
                      <Input
                        value={urlGenerateData.depth || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, depth: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Material</Label>
                      <Input
                        value={urlGenerateData.material || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, material: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">{urlGenerateData.productName || 'Untitled Product'}</p>
                    {urlGenerateData.brand && (
                      <p className="text-sm text-gray-600">Brand: {urlGenerateData.brand}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {urlGenerateData.sku && <span>SKU: {urlGenerateData.sku}</span>}
                      {urlGenerateData.rrp && <span>RRP: {urlGenerateData.rrp}</span>}
                      {urlGenerateData.leadTime && <span>Lead Time: {urlGenerateData.leadTime}</span>}
                    </div>
                    {(urlGenerateData.width || urlGenerateData.height || urlGenerateData.depth) && (
                      <p className="text-xs text-gray-500">
                        Dimensions: {[
                          urlGenerateData.width && `W: ${urlGenerateData.width}`,
                          urlGenerateData.height && `H: ${urlGenerateData.height}`,
                          urlGenerateData.depth && `D: ${urlGenerateData.depth}`
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Add Note Button/Input */}
                {!urlGenerateShowNotes ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUrlGenerateShowNotes(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Note
                  </Button>
                ) : (
                  <div>
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <Textarea
                      value={urlGenerateData.notes || ''}
                      onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, notes: e.target.value }))}
                      className="min-h-[60px] text-sm"
                      placeholder="Add notes about this product..."
                    />
                  </div>
                )}
                
                {/* Supplier Section */}
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500">Supplier</Label>
                    <button 
                      type="button"
                      onClick={() => setAddSupplierModal({ open: true, forItemId: null })}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add New
                    </button>
                  </div>
                  {urlGenerateSelectedSupplier ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                        {urlGenerateSelectedSupplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{urlGenerateSelectedSupplier.name}</p>
                        {urlGenerateSelectedSupplier.contactName && (
                          <p className="text-xs text-gray-500">{urlGenerateSelectedSupplier.contactName}</p>
                        )}
                      </div>
                      <button 
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setUrlGenerateSelectedSupplier(null)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Select 
                        onValueChange={(supplierId) => {
                          const supplier = suppliers.find(s => s.id === supplierId)
                          if (supplier) {
                            setUrlGenerateSelectedSupplier(supplier)
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select from phonebook" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.length === 0 ? (
                            <div className="text-center p-4 text-sm text-gray-500">
                              No suppliers in phonebook
                              <button 
                                type="button"
                                onClick={() => setAddSupplierModal({ open: true, forItemId: null })}
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
                      <div className="text-xs text-gray-400 text-center">or enter manually</div>
                      <Input
                        value={urlGenerateSupplierSearch}
                        onChange={(e) => {
                          setUrlGenerateSupplierSearch(e.target.value)
                          if (e.target.value.trim()) {
                            setUrlGenerateSelectedSupplier({ 
                              id: '', 
                              name: e.target.value,
                              email: ''
                            })
                          } else {
                            setUrlGenerateSelectedSupplier(null)
                          }
                        }}
                        placeholder="Enter supplier name manually"
                        className="h-9 text-sm"
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUrlGenerateDialog({ open: false, ffeItem: null })
                setUrlGenerateInput('')
                setUrlGenerateData(null)
                setUrlGenerateEditing(false)
                setUrlGenerateShowNotes(false)
                setUrlGenerateShowSupplier(false)
                setUrlGenerateSelectedSupplier(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUrlGenerateCreate}
              disabled={!urlGenerateData || savingItem}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {savingItem ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Link Product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add from URL Modal */}
      <Dialog 
        open={addFromUrlModal.open} 
        onOpenChange={(open) => {
          if (!open) {
            setAddFromUrlModal({ open: false, sectionId: null, roomId: null })
            setExtractedData(null)
            setUrlInput('')
            setAddFromUrlEditing(false)
            setAddFromUrlShowNotes(false)
            setAddFromUrlShowSupplier(false)
            setAddFromUrlSelectedSupplier(null)
            resetFfeSelection()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              Add Product from URL
            </DialogTitle>
            <DialogDescription>
              Enter a product URL and AI will automatically extract the product details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.example.com/product-page"
                  className="pl-9 pr-9"
                  disabled={extracting}
                />
                <button
                  type="button"
                  onClick={handleAddFromUrlPaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
              <Button 
                onClick={handleExtractFromUrl}
                disabled={extracting || !urlInput.trim()}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract
                  </>
                )}
              </Button>
            </div>
            
            {/* Extracted Data Preview */}
            {extractedData && (
              <div className="border rounded-lg p-4 space-y-4">
                {/* Header with Edit button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Extracted Product</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddFromUrlEditing(!addFromUrlEditing)}
                    className="h-7 text-xs"
                  >
                    {addFromUrlEditing ? 'Done Editing' : 'Edit Details'}
                  </Button>
                </div>
                
                {/* Images */}
                <div className="flex flex-wrap gap-2">
                  {extractedData.images?.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt="Product" 
                        className="w-16 h-16 object-cover rounded border bg-white"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setExtractedData({
                            ...extractedData,
                            images: extractedData.images.filter((_, i) => i !== idx)
                          })
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* Add Image Upload */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        if (file.size > 4 * 1024 * 1024) {
                          toast.error('Image must be under 4MB')
                          return
                        }
                        
                        setAddFromUrlUploadingImage(true)
                        try {
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
                              setExtractedData({
                                ...extractedData,
                                images: [...(extractedData.images || []), data.url]
                              })
                              toast.success('Image uploaded')
                            }
                          } else {
                            toast.error('Failed to upload image')
                          }
                        } catch (error) {
                          console.error('Upload error:', error)
                          toast.error('Failed to upload image')
                        } finally {
                          setAddFromUrlUploadingImage(false)
                          e.target.value = ''
                        }
                      }}
                    />
                    <div className={cn(
                      "w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors",
                      addFromUrlUploadingImage && "opacity-50 pointer-events-none"
                    )}>
                      {addFromUrlUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span className="text-[10px] mt-0.5">Upload</span>
                        </>
                      )}
                    </div>
                  </label>
                  {/* Crop from Rendering button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (addFromUrlModal.roomId) {
                        loadRenderingImages(addFromUrlModal.roomId)
                      }
                      setShowCropDialogForAddFromUrl(true)
                    }}
                    className="w-16 h-16 border-2 border-dashed border-purple-300 rounded flex flex-col items-center justify-center text-purple-500 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                    title="Crop from 3D Rendering"
                  >
                    <Scissors className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5">Crop</span>
                  </button>
                </div>
                
                {/* Product Details */}
                {addFromUrlEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Product Name</Label>
                      <Input
                        value={extractedData.productName || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, productName: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Brand</Label>
                      <Input
                        value={extractedData.brand || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, brand: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">SKU</Label>
                      <Input
                        value={extractedData.sku || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, sku: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">RRP</Label>
                      <Input
                        value={extractedData.rrp || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, rrp: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Trade Price</Label>
                      <Input
                        value={extractedData.tradePrice || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, tradePrice: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Lead Time</Label>
                      <Input
                        value={extractedData.leadTime || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, leadTime: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Width</Label>
                      <Input
                        value={extractedData.width || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, width: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Height</Label>
                      <Input
                        value={extractedData.height || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, height: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Depth</Label>
                      <Input
                        value={extractedData.depth || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, depth: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Material</Label>
                      <Input
                        value={extractedData.material || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, material: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Color</Label>
                      <Input
                        value={extractedData.colour || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, colour: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Finish</Label>
                      <Input
                        value={extractedData.finish || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, finish: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">{extractedData.productName || 'Untitled Product'}</p>
                    {extractedData.brand && (
                      <p className="text-sm text-gray-600">Brand: {extractedData.brand}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {extractedData.sku && <span>SKU: {extractedData.sku}</span>}
                      {extractedData.rrp && <span>RRP: {extractedData.rrp}</span>}
                      {extractedData.leadTime && <span>Lead Time: {extractedData.leadTime}</span>}
                    </div>
                    {(extractedData.width || extractedData.height || extractedData.depth) && (
                      <p className="text-xs text-gray-500">
                        Dimensions: {[
                          extractedData.width && `W: ${extractedData.width}`,
                          extractedData.height && `H: ${extractedData.height}`,
                          extractedData.depth && `D: ${extractedData.depth}`
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Add Note Button/Input */}
                {!addFromUrlShowNotes ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddFromUrlShowNotes(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Note
                  </Button>
                ) : (
                  <div>
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <Textarea
                      value={extractedData.notes || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, notes: e.target.value })}
                      className="min-h-[60px] text-sm"
                      placeholder="Add notes about this product..."
                    />
                  </div>
                )}
                
                {/* Add Supplier Button/Input */}
                {!addFromUrlShowSupplier ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddFromUrlShowSupplier(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Supplier
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Supplier</Label>
                    {addFromUrlSelectedSupplier ? (
                      <div className="flex items-center justify-between p-2 border rounded-lg bg-gray-50">
                        <div>
                          <p className="font-medium text-sm">{addFromUrlSelectedSupplier.name}</p>
                          {addFromUrlSelectedSupplier.website && (
                            <p className="text-xs text-gray-500">{addFromUrlSelectedSupplier.website}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddFromUrlSelectedSupplier(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          value={addFromUrlSupplierSearch}
                          onChange={(e) => handleAddFromUrlSupplierSearch(e.target.value)}
                          placeholder="Search suppliers..."
                          className="h-8 text-sm"
                        />
                        {addFromUrlSupplierLoading && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                        )}
                        {addFromUrlSupplierResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {addFromUrlSupplierResults.map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                  setAddFromUrlSelectedSupplier(supplier)
                                  setAddFromUrlSupplierSearch('')
                                  setAddFromUrlSupplierResults([])
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                              >
                                <p className="font-medium">{supplier.name}</p>
                                {supplier.website && (
                                  <p className="text-xs text-gray-500 truncate">{supplier.website}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* FFE Item Selector - Step by Step */}
            {extractedData && (
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
                ) : ffeItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No FFE items found. Add items in FFE Workspace first.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Step 1: Select Room (only show if no room selected) */}
                    {!selectedFfeRoom && (
                      <Select value={selectedFfeRoom} onValueChange={handleFfeRoomSelect}>
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
                    {selectedFfeRoom && !selectedFfeSection && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Room:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeRoom('')
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        </div>
                        <Select value={selectedFfeSection} onValueChange={handleFfeSectionSelect}>
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
                    {selectedFfeRoom && selectedFfeSection && !selectedFfeItemId && (
                      <>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-gray-500">Room:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeRoom('')
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                          <span className="text-gray-500">Category:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {filteredFfeSections.find(s => s.sectionId === selectedFfeSection)?.sectionName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        </div>
                        <Select value={selectedFfeItemId} onValueChange={handleFfeItemSelect}>
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddFromUrlModal({ open: false, sectionId: null, roomId: null })
              setExtractedData(null)
              setUrlInput('')
              setAddFromUrlEditing(false)
              setAddFromUrlShowNotes(false)
              setAddFromUrlShowSupplier(false)
              setAddFromUrlSelectedSupplier(null)
              resetFfeSelection()
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (extractedData && addFromUrlModal.sectionId && addFromUrlModal.roomId) {
                  // Pass supplier info if selected - supplierLink = product URL (not supplier website)
                  const dataWithSupplier = {
                    ...extractedData,
                    supplierName: addFromUrlSelectedSupplier?.name || '',
                    supplierLink: extractedData.productWebsite || ''
                  }
                  handleAddItem(addFromUrlModal.sectionId, addFromUrlModal.roomId, dataWithSupplier)
                }
              }}
              disabled={!extractedData || savingItem}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {savingItem ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {selectedFfeItem ? 'Add & Link Product' : 'Add Product'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Product from Library Modal */}
      <Dialog open={libraryModal.open} onOpenChange={(open) => !open && setLibraryModal({ open: false, sectionId: null, roomId: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-blue-600" />
              Add Product from Library
            </DialogTitle>
            <DialogDescription>
              Select a product from your library to add to this section.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            
            {/* Products List */}
            <ScrollArea className="h-[400px]">
              {libraryLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredLibraryProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLibraryProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedLibraryProduct?.id === product.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedLibraryProduct(product)}
                    >
                      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.thumbnailUrl ? (
                          <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {product.brand && <span>{product.brand}</span>}
                          {product.sku && <span>• {product.sku}</span>}
                        </div>
                        {product.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {product.category.name}
                          </Badge>
                        )}
                      </div>
                      {selectedLibraryProduct?.id === product.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {/* FFE Item Selector - Step by Step */}
            {selectedLibraryProduct && (
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
                ) : ffeItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No FFE items found. Add items in FFE Workspace first.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Step 1: Select Room */}
                    {!selectedFfeRoom && (
                      <Select value={selectedFfeRoom} onValueChange={handleFfeRoomSelect}>
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
                    {selectedFfeRoom && !selectedFfeSection && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Room:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeRoom('')
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        </div>
                        <Select value={selectedFfeSection} onValueChange={handleFfeSectionSelect}>
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
                    {selectedFfeRoom && selectedFfeSection && !selectedFfeItemId && (
                      <>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-gray-500">Room:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeRoom('')
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                          <span className="text-gray-500">Category:</span>
                          <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            {filteredFfeSections.find(s => s.sectionId === selectedFfeSection)?.sectionName}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        </div>
                        <Select value={selectedFfeItemId} onValueChange={handleFfeItemSelect}>
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLibraryModal({ open: false, sectionId: null, roomId: null })
              setSelectedLibraryProduct(null)
              setLibrarySearch('')
              resetFfeSelection()
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedLibraryProduct && libraryModal.sectionId && libraryModal.roomId) {
                  handleAddItem(libraryModal.sectionId, libraryModal.roomId, {
                    name: selectedLibraryProduct.name,
                    brand: selectedLibraryProduct.brand,
                    sku: selectedLibraryProduct.sku,
                    libraryProductId: selectedLibraryProduct.id
                  })
                }
              }}
              disabled={!selectedLibraryProduct || savingItem}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingItem ? 'Adding...' : (selectedFfeItem ? 'Add & Link Product' : 'Add Product')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Custom Product Modal */}
      <Dialog open={customProductModal.open} onOpenChange={(open) => !open && setCustomProductModal({ open: false, sectionId: null, roomId: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-gray-600" />
              Add Custom Product
            </DialogTitle>
            <DialogDescription>
              Manually enter product details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-name">Product Name *</Label>
              <Input
                id="custom-name"
                value={customProductForm.name}
                onChange={(e) => setCustomProductForm({ ...customProductForm, name: e.target.value })}
                placeholder="e.g. Modern Dining Chair"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-brand">Brand</Label>
                <Input
                  id="custom-brand"
                  value={customProductForm.brand}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, brand: e.target.value })}
                  placeholder="e.g. West Elm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-sku">SKU / Model</Label>
                <Input
                  id="custom-sku"
                  value={customProductForm.sku}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, sku: e.target.value })}
                  placeholder="e.g. WE-12345"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custom-desc">Description</Label>
              <Textarea
                id="custom-desc"
                value={customProductForm.description}
                onChange={(e) => setCustomProductForm({ ...customProductForm, description: e.target.value })}
                placeholder="Product description..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-supplier">Supplier Name</Label>
                <Input
                  id="custom-supplier"
                  value={customProductForm.supplierName}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, supplierName: e.target.value })}
                  placeholder="e.g. ABC Furniture"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-qty">Quantity</Label>
                <Input
                  id="custom-qty"
                  type="number"
                  min="1"
                  value={customProductForm.quantity}
                  onChange={(e) => setCustomProductForm({ ...customProductForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custom-link">Supplier Link</Label>
              <Input
                id="custom-link"
                value={customProductForm.supplierLink}
                onChange={(e) => setCustomProductForm({ ...customProductForm, supplierLink: e.target.value })}
                placeholder="https://..."
              />
            </div>
            
            {/* FFE Item Selector - Step by Step */}
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
              ) : ffeItems.length === 0 ? (
                <p className="text-sm text-gray-500">No FFE items found. Add items in FFE Workspace first.</p>
              ) : (
                <div className="space-y-2">
                  {/* Step 1: Select Room */}
                  {!selectedFfeRoom && (
                    <Select value={selectedFfeRoom} onValueChange={handleFfeRoomSelect}>
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
                  {selectedFfeRoom && !selectedFfeSection && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Room:</span>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                          setSelectedFfeRoom('')
                          setSelectedFfeSection('')
                          setSelectedFfeItemId('')
                          setShowAlreadyChosenWarning(false)
                        }}>
                          {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      </div>
                      <Select value={selectedFfeSection} onValueChange={handleFfeSectionSelect}>
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
                  {selectedFfeRoom && selectedFfeSection && !selectedFfeItemId && (
                    <>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-gray-500">Room:</span>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                          setSelectedFfeRoom('')
                          setSelectedFfeSection('')
                          setSelectedFfeItemId('')
                          setShowAlreadyChosenWarning(false)
                        }}>
                          {ffeItems.find(r => r.roomId === selectedFfeRoom)?.roomName}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                        <span className="text-gray-500">Category:</span>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                          setSelectedFfeSection('')
                          setSelectedFfeItemId('')
                          setShowAlreadyChosenWarning(false)
                        }}>
                          {filteredFfeSections.find(s => s.sectionId === selectedFfeSection)?.sectionName}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      </div>
                      <Select value={selectedFfeItemId} onValueChange={handleFfeItemSelect}>
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCustomProductModal({ open: false, sectionId: null, roomId: null })
              setCustomProductForm({ name: '', brand: '', sku: '', description: '', supplierName: '', supplierLink: '', quantity: 1 })
              resetFfeSelection()
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (customProductModal.sectionId && customProductModal.roomId && customProductForm.name) {
                  handleAddItem(customProductModal.sectionId, customProductModal.roomId, customProductForm)
                }
              }}
              disabled={!customProductForm.name || savingItem}
            >
              {savingItem ? 'Adding...' : (selectedFfeItem ? 'Add & Link Product' : 'Add Product')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Move to Section Modal */}
      <Dialog open={moveToSectionModal.open} onOpenChange={(open) => !open && setMoveToSectionModal({ open: false, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Move to Section
            </DialogTitle>
            <DialogDescription>
              Select a section to move "{moveToSectionModal.item?.name}" to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Select value={selectedMoveSection} onValueChange={setSelectedMoveSection}>
              <SelectTrigger>
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.flatMap(room => 
                  room.sections.map(section => (
                    <SelectItem 
                      key={section.id} 
                      value={section.id}
                      disabled={section.id === moveToSectionModal.item?.sectionId}
                    >
                      {room.name} - {section.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToSectionModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleMoveToSection}
              disabled={!selectedMoveSection}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Move Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Duplicate Item Modal - Select FFE Item to Link */}
      <Dialog open={duplicateModal.open} onOpenChange={(open) => !open && setDuplicateModal({ open: false, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-emerald-600" />
              Duplicate Item
            </DialogTitle>
            <DialogDescription>
              Select an FFE item to link this duplicate to. Only unlinked items from the same category are shown.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {duplicateModal.item && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Duplicating:</p>
                <p className="font-medium">{duplicateModal.item.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {duplicateModal.item.roomName} &bull; {duplicateModal.item.categoryName}
                </p>
              </div>
            )}
            
            {getUnlinkedFfeItemsForDuplicate().length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No unlinked items available in this category.</p>
                <p className="text-xs text-gray-400 mt-1">All FFE items in this section are already linked to specs.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Link to FFE Item</Label>
                <Select value={selectedDuplicateFfeItem} onValueChange={setSelectedDuplicateFfeItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an FFE item to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getUnlinkedFfeItemsForDuplicate().map(ffeItem => (
                      <SelectItem key={ffeItem.id} value={ffeItem.id}>
                        {ffeItem.name}
                        {ffeItem.quantity > 1 && ` (×${ffeItem.quantity})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDuplicate}
              disabled={!selectedDuplicateFfeItem || duplicating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {duplicating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Duplicating...
                </>
              ) : (
                'Duplicate & Link'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Copy to Project Modal */}
      <Dialog open={copyToProjectModal.open} onOpenChange={(open) => !open && setCopyToProjectModal({ open: false, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="w-5 h-5 text-purple-600" />
              Copy to Project
            </DialogTitle>
            <DialogDescription>
              Select a project to copy "{copyToProjectModal.item?.name}" to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : projectsList.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No other projects available</p>
            ) : (
              <Select value={selectedCopyProject} onValueChange={setSelectedCopyProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsList.map(proj => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyToProjectModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleCopyToProject}
              disabled={!selectedCopyProject || projectsLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Copy Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Flag Modal */}
      <Dialog open={flagModal.open} onOpenChange={(open) => !open && setFlagModal({ open: false, item: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              Add a Flag
            </DialogTitle>
            <DialogDescription>
              Add a flag to "{flagModal.item?.name}" for attention or follow-up.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Flag Color</Label>
              <div className="flex items-center gap-2">
                {['red', 'orange', 'yellow', 'green', 'blue', 'purple'].map(color => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      color === 'red' && "bg-red-500",
                      color === 'orange' && "bg-orange-500",
                      color === 'yellow' && "bg-yellow-500",
                      color === 'green' && "bg-green-500",
                      color === 'blue' && "bg-blue-500",
                      color === 'purple' && "bg-purple-500",
                      flagColor === color ? "ring-2 ring-offset-2 ring-gray-400" : "hover:scale-110"
                    )}
                    onClick={() => setFlagColor(color)}
                  />
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="flag-note">Note (optional)</Label>
              <Textarea
                id="flag-note"
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Add a note about this flag..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddFlag}
              className="bg-red-600 hover:bg-red-700"
            >
              Add Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Modal */}
      <Dialog open={shareModal} onOpenChange={setShareModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-gray-700" />
              Share Schedule
            </DialogTitle>
            <DialogDescription>
              Generate a shareable link for clients and collaborators.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Publish Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Publish to Web</h4>
                <p className="text-sm text-gray-500 mt-0.5">
                  Generate a live link to your online schedule
                </p>
              </div>
              <Switch
                checked={shareSettings.isPublished}
                onCheckedChange={handleTogglePublish}
                disabled={savingShareSettings}
              />
            </div>
            
            {shareSettings.isPublished && (
              <>
                {/* Help Link */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <HelpCircle className="w-4 h-4" />
                  <span>Help guide</span>
                </div>
                
                {/* Share URL */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        value={shareSettings.shareUrl}
                        readOnly
                        className="pr-24 text-sm bg-gray-50"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={copyShareUrl}
                      title="Copy link"
                    >
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => window.open(shareSettings.shareUrl, '_blank')}
                      title="Open link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => toast('QR code feature coming soon')}
                      title="Show QR code"
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Visibility Options */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">View supplier</span>
                    <Switch
                      checked={shareSettings.showSupplier}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...shareSettings, showSupplier: checked }
                        setShareSettings(newSettings)
                        handleSaveShareSettings(newSettings)
                      }}
                      disabled={savingShareSettings}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">View brand</span>
                    <Switch
                      checked={shareSettings.showBrand}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...shareSettings, showBrand: checked }
                        setShareSettings(newSettings)
                        handleSaveShareSettings(newSettings)
                      }}
                      disabled={savingShareSettings}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">View pricing</span>
                    <Switch
                      checked={shareSettings.showPricing}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...shareSettings, showPricing: checked }
                        setShareSettings(newSettings)
                        handleSaveShareSettings(newSettings)
                      }}
                      disabled={savingShareSettings}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">View details</span>
                    <Switch
                      checked={shareSettings.showDetails}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...shareSettings, showDetails: checked }
                        setShareSettings(newSettings)
                        handleSaveShareSettings(newSettings)
                      }}
                      disabled={savingShareSettings}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Item Detail Panel */}
      <ItemDetailPanel
        isOpen={detailPanel.isOpen}
        onClose={() => {
          setDetailPanel({ isOpen: false, mode: 'view', item: null })
          // Clear FFE pre-selection when closing
          setSelectedFfeRoom('')
          setSelectedFfeSection('')
          setSelectedFfeItemId('')
        }}
        projectId={project.id}
        item={detailPanel.item}
        mode={detailPanel.mode}
        sectionId={detailPanel.sectionId}
        roomId={detailPanel.roomId}
        availableRooms={availableRooms}
        ffeItems={ffeItems}
        ffeItemsLoading={ffeItemsLoading}
        initialFfeRoomId={selectedFfeRoom}
        initialFfeSectionId={selectedFfeSection}
        initialFfeItemId={selectedFfeItemId}
        onSave={() => {
          fetchSpecs()
          loadFfeItems() // Refresh FFE items to update chosen status
          if (detailPanel.mode === 'create') {
            setDetailPanel({ isOpen: false, mode: 'view', item: null })
          }
        }}
        onNavigate={(direction) => {
          // Find current item index and navigate
          const allItems = groupedSpecs.flatMap(g => g.items)
          const currentIndex = allItems.findIndex(i => i.id === detailPanel.item?.id)
          if (currentIndex !== -1) {
            const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
            if (newIndex >= 0 && newIndex < allItems.length) {
              setDetailPanel({
                ...detailPanel,
                item: allItems[newIndex],
                sectionId: allItems[newIndex].sectionId,
                roomId: allItems[newIndex].roomId
              })
            }
          }
        }}
        hasNext={(() => {
          const allItems = groupedSpecs.flatMap(g => g.items)
          const currentIndex = allItems.findIndex(i => i.id === detailPanel.item?.id)
          return currentIndex !== -1 && currentIndex < allItems.length - 1
        })()}
        hasPrev={(() => {
          const allItems = groupedSpecs.flatMap(g => g.items)
          const currentIndex = allItems.findIndex(i => i.id === detailPanel.item?.id)
          return currentIndex > 0
        })()}
      />
      
      {/* Add New Supplier Modal */}
      <Dialog open={addSupplierModal.open} onOpenChange={(open) => !open && setAddSupplierModal({ open: false, forItemId: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-emerald-600" />
              </div>
              Add New Supplier
            </DialogTitle>
            <DialogDescription>
              Add a new supplier to your phonebook. They'll be available to select for all your projects.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Business Name *</Label>
              <Input
                id="supplier-name"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Contact Name</Label>
              <Input
                id="supplier-contact"
                value={newSupplier.contactName}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email *</Label>
              <Input
                id="supplier-email"
                type="email"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                placeholder="supplier@example.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Phone</Label>
                <Input
                  id="supplier-phone"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-website">Website</Label>
                <Input
                  id="supplier-website"
                  value={newSupplier.website}
                  onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-logo">Logo URL</Label>
              <Input
                id="supplier-logo"
                value={newSupplier.logoUrl}
                onChange={(e) => setNewSupplier({ ...newSupplier, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              {newSupplier.logoUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <img 
                    src={newSupplier.logoUrl} 
                    alt="Logo preview" 
                    className="w-10 h-10 rounded object-cover border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span className="text-xs text-gray-500">Logo preview</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-notes">Notes</Label>
              <Textarea
                id="supplier-notes"
                value={newSupplier.notes}
                onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                placeholder="Internal notes about this supplier"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddSupplierModal({ open: false, forItemId: null })
              setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logoUrl: '' })
            }}>
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
      
      {/* Add Section Modal */}
      <Dialog open={addSectionModal.open} onOpenChange={(open) => {
        if (!open) {
          setAddSectionModal({ open: false, categoryName: null })
          setNewSectionName('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Add New Section
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name *</Label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Lighting, Flooring, Furniture"
                autoFocus
              />
              <p className="text-xs text-gray-500">Sections help organize your specs by category</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddSectionModal({ open: false, categoryName: null })
              setNewSectionName('')
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSection}
              disabled={creatingSectionLoading || !newSectionName.trim()}
            >
              {creatingSectionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Section'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop from Rendering Dialog for URL Generate */}
      <CropFromRenderingDialog
        open={showCropDialogForUrlGenerate}
        onOpenChange={setShowCropDialogForUrlGenerate}
        renderingImages={renderingImages}
        onImageCropped={(imageUrl) => {
          setUrlGenerateData((prev: any) => ({
            ...prev,
            images: [...(prev?.images || []), imageUrl].slice(0, 5)
          }))
        }}
      />

      {/* Crop from Rendering Dialog for Add from URL */}
      <CropFromRenderingDialog
        open={showCropDialogForAddFromUrl}
        onOpenChange={setShowCropDialogForAddFromUrl}
        renderingImages={renderingImages}
        onImageCropped={(imageUrl) => {
          if (extractedData) {
            setExtractedData({
              ...extractedData,
              images: [...(extractedData.images || []), imageUrl].slice(0, 5)
            })
          }
        }}
      />

      {/* Image Editor Modal - for viewing/editing spec images */}
      <ImageEditorModal
        open={imageEditorModal.open}
        onOpenChange={(open) => setImageEditorModal(prev => ({ ...prev, open }))}
        imageUrl={imageEditorModal.imageUrl}
        imageTitle={imageEditorModal.imageTitle}
        onImageUpdated={async (newImageUrl) => {
          // Update the spec item with the new image URL
          if (imageEditorModal.itemId) {
            const item = specs.find(s => s.id === imageEditorModal.itemId)
            if (item) {
              try {
                const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${imageEditorModal.itemId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    images: [newImageUrl, ...(item.images || []).slice(1)]
                  })
                })
                
                if (res.ok) {
                  // Update local state
                  setSpecs(prev => prev.map(s => 
                    s.id === imageEditorModal.itemId 
                      ? { ...s, thumbnailUrl: newImageUrl, images: [newImageUrl, ...(s.images || []).slice(1)] }
                      : s
                  ))
                  toast.success('Image updated successfully!')
                }
              } catch (error) {
                console.error('Error updating image:', error)
              }
            }
          }
        }}
      />
    </div>
  )
}

