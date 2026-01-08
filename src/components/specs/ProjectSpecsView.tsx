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
  DropdownMenuSeparator,
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
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
  Scissors,
  DollarSign,
  Mail,
  Link2,
  FileDown,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import CropFromRenderingDialog from '@/components/image/CropFromRenderingDialog'
import ImageEditorModal from '@/components/image/ImageEditorModal'
import CreateSpecShareLinkDialog from '@/components/specs/CreateSpecShareLinkDialog'
import SpecPDFExportDialog from '@/components/specs/SpecPDFExportDialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ItemDetailPanel } from './ItemDetailPanel'
import CreateRFQDialog from '@/components/procurement/create-rfq-dialog'
import CreateClientQuoteDialog from '@/components/procurement/create-client-quote-dialog'
import QuickQuoteDialog from '@/components/procurement/quick-quote-dialog'
import SendToClientDialog from '@/components/procurement/send-to-client-dialog'
import BudgetApprovalDialog from '@/components/specs/BudgetApprovalDialog'

// Item status options - ordered by workflow (cleaned up - 16 options)
const ITEM_STATUS_OPTIONS = [
  // === PROCUREMENT WORKFLOW (auto-updated) ===
  { value: 'SELECTED', label: 'Selected', icon: CheckCircle2, color: 'text-emerald-500', requiresApproval: false },
  { value: 'RFQ_SENT', label: 'RFQ Sent', icon: Clock, color: 'text-amber-500', requiresApproval: false },
  { value: 'QUOTE_RECEIVED', label: 'Quote Received', icon: CreditCard, color: 'text-teal-500', requiresApproval: false },
  { value: 'QUOTE_APPROVED', label: 'Quote Accepted', icon: CheckCircle2, color: 'text-green-500', requiresApproval: false },
  { value: 'INVOICED_TO_CLIENT', label: 'Invoiced to Client', icon: CreditCard, color: 'text-blue-500', requiresApproval: false },
  { value: 'CLIENT_PAID', label: 'Client Paid', icon: CreditCard, color: 'text-emerald-600', requiresApproval: false },
  { value: 'ORDERED', label: 'Ordered from Supplier', icon: PackageCheck, color: 'text-blue-600', requiresApproval: true },
  { value: 'SHIPPED', label: 'Shipped', icon: Truck, color: 'text-indigo-500', requiresApproval: true },
  { value: 'DELIVERED', label: 'Delivered', icon: PackageCheck, color: 'text-teal-600', requiresApproval: true },
  { value: 'INSTALLED', label: 'Installed', icon: CheckCheck, color: 'text-green-600', requiresApproval: true },
  { value: 'CLOSED', label: 'Closed', icon: CheckCheck, color: 'text-gray-600', requiresApproval: true },
  // === MANUAL STATUSES ===
  { value: 'DRAFT', label: 'Draft', icon: Circle, color: 'text-gray-400', requiresApproval: false },
  { value: 'HIDDEN', label: 'Hidden', icon: Circle, color: 'text-gray-300', requiresApproval: false },
  { value: 'CLIENT_TO_ORDER', label: 'Client to Order', icon: Truck, color: 'text-purple-500', requiresApproval: false },
  { value: 'CONTRACTOR_TO_ORDER', label: 'Contractor to Order', icon: Truck, color: 'text-orange-500', requiresApproval: false, skipFilters: true },
  { value: 'ISSUE', label: 'Issue', icon: AlertCircle, color: 'text-red-500', requiresApproval: false },
  { value: 'ARCHIVED', label: 'Archived', icon: Archive, color: 'text-gray-400', requiresApproval: false },
]

// Legacy status display mapping (items with old statuses still show correctly)
const LEGACY_STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  'RECEIVED': { label: 'Delivered', icon: PackageCheck, color: 'text-teal-600' },
  'OPTION': { label: 'Option', icon: Circle, color: 'text-purple-400' },
  'QUOTING': { label: 'RFQ Sent', icon: Clock, color: 'text-amber-500' },
  'PRICE_RECEIVED': { label: 'Quote Received', icon: CreditCard, color: 'text-teal-500' },
  'BETTER_PRICE': { label: 'Better Price', icon: CreditCard, color: 'text-yellow-600' },
  'NEED_TO_ORDER': { label: 'Need to Order', icon: Package, color: 'text-blue-500' },
  'NEED_SAMPLE': { label: 'Need Sample', icon: Package, color: 'text-orange-500' },
  'IN_PRODUCTION': { label: 'In Production', icon: Clock, color: 'text-cyan-600' },
  'COMPLETED': { label: 'Completed', icon: CheckCheck, color: 'text-green-600' },
  'INTERNAL_REVIEW': { label: 'Internal Review', icon: Clock, color: 'text-amber-500' },
  'CLIENT_REVIEW': { label: 'Client Review', icon: Clock, color: 'text-blue-500' },
  'RESUBMIT': { label: 'Resubmit', icon: AlertCircle, color: 'text-orange-500' },
  'REJECTED': { label: 'Rejected', icon: AlertCircle, color: 'text-red-500' },
  'APPROVED': { label: 'Quote Accepted', icon: CheckCircle2, color: 'text-green-500' },
  'PAYMENT_DUE': { label: 'Payment Due', icon: CreditCard, color: 'text-orange-500' },
  'IN_TRANSIT': { label: 'Shipped', icon: Truck, color: 'text-indigo-500' },
  'NEEDS_SPEC': { label: 'Needs Spec', icon: Circle, color: 'text-gray-400' },
  'SPEC_ADDED': { label: 'Spec Added', icon: CheckCircle2, color: 'text-emerald-400' },
  'QUOTED': { label: 'Quoted', icon: CreditCard, color: 'text-teal-500' },
  'BUDGET_SENT': { label: 'Budget Sent', icon: Mail, color: 'text-blue-500' },
  'BUDGET_APPROVED': { label: 'Budget Approved', icon: CheckCircle2, color: 'text-green-500' },
}

// Statuses that require client approval to select
const APPROVAL_REQUIRED_STATUSES = ['ORDERED', 'SHIPPED', 'DELIVERED', 'INSTALLED', 'CLOSED']

// Lead time options (same as ItemDetailPanel and Chrome extension)
const LEAD_TIME_OPTIONS = [
  { value: 'none', label: '-' },
  { value: 'in-stock', label: 'In Stock' },
  { value: '1-2 weeks', label: '1-2 Weeks' },
  { value: '2-4 weeks', label: '2-4 Weeks' },
  { value: '4-6 weeks', label: '4-6 Weeks' },
  { value: '6-8 weeks', label: '6-8 Weeks' },
  { value: '8-12 weeks', label: '8-12 Weeks' },
  { value: '12+ weeks', label: '12+ Weeks' },
]

// Helper to format lead time - handles legacy values like IN_STOCK, 1-2_WEEKS
const formatLeadTime = (value: string | null): string => {
  if (!value) return '-'
  // First try to find exact match in options
  const option = LEAD_TIME_OPTIONS.find(o => o.value === value)
  if (option) return option.label
  // Handle legacy formats: IN_STOCK -> In Stock, 1-2_WEEKS -> 1-2 Weeks
  const normalized = value
    .replace(/_/g, ' ')
    .replace(/WEEKS/gi, 'Weeks')
    .replace(/IN STOCK/gi, 'In Stock')
    .replace(/\bstock\b/gi, 'Stock')
  // Title case for other formats
  return normalized.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ').replace(/(\d+)/g, '$1') // Keep numbers as-is
}

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
  supplierId: string | null
  state: string
  specStatus: string
  clientApproved: boolean
  images: string[]
  thumbnailUrl: string | null
  roomId: string
  // Custom fields (for flags, grouped items, etc.)
  customFields?: {
    flag?: {
      color: string
      note?: string
      addedAt?: string
    }
    // Grouped/Linked item fields (parent-child relationship from FFE Workspace)
    hasChildren?: boolean
    linkedItems?: string[]  // Array of child item names (for parent items)
    isLinkedItem?: boolean
    isGroupedItem?: boolean
    parentId?: string       // Parent item ID (for child items)
    parentName?: string     // Parent item name (for child items)
  } | null
  // Pricing fields
  unitCost: number | null
  totalCost: number | null
  tradePrice: number | null
  tradePriceCurrency: string
  rrp: number | null
  rrpCurrency: string
  tradeDiscount: number | null
  markupPercent: number | null
  // FFE Linking fields (legacy one-to-one)
  ffeRequirementId: string | null
  ffeRequirementName: string | null
  // Notes field
  notes: string | null
  // Multiple linked FFE items (many-to-many)
  linkedFfeItems?: Array<{
    linkId: string
    ffeItemId: string
    ffeItemName: string
    roomId: string
    roomName: string
    sectionName: string
    // FFE grouping info
    isGroupedItem?: boolean
    parentName?: string | null
    hasChildren?: boolean
    linkedItems?: string[]
  }>
  linkedFfeCount?: number
  // FFE grouping info from legacy one-to-one link
  ffeGroupingInfo?: {
    isGroupedItem: boolean
    parentName: string | null
    hasChildren: boolean
    linkedItems: string[]
  } | null
  // Quote request tracking
  hasQuoteSent?: boolean
  lastQuoteRequest?: {
    id: string
    status: string
    sentAt: string
    supplierName: string | null
  } | null
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
  const [filteredSpecs, setFilteredSpecs] = useState<SpecItem[]>([]) // Filtered specs for stats
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'needs_approval' | 'needs_price'>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'category' | 'room' | 'status'>('category')
  const prevSortByRef = useRef<'category' | 'room' | 'status'>('category')
  const [itemSortBy, setItemSortBy] = useState<'default' | 'name' | 'brand' | 'price_asc' | 'price_desc' | 'status'>('default')
  const [itemSortDirection, setItemSortDirection] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState<'summary' | 'financial' | 'needs'>('summary')
  const [financials, setFinancials] = useState({
    totalTradePriceCAD: 0,
    totalTradePriceUSD: 0,
    totalRRPCAD: 0,
    totalRRPUSD: 0,
    avgTradeDiscount: 0
  })
  
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

  // Programa Import modal
  const [programaModal, setProgramaModal] = useState<{
    open: boolean
    sectionId: string | null
    roomId: string | null
    ffeItemId: string | null
    ffeItemName: string | null
  }>({ open: false, sectionId: null, roomId: null, ffeItemId: null, ffeItemName: null })
  const [programaItems, setProgramaItems] = useState<any[]>([])
  const [programaCategories, setProgramaCategories] = useState<string[]>([])
  const [programaLoading, setProgramaLoading] = useState(false)
  const [programaSearch, setProgramaSearch] = useState('')
  const [programaCategoryFilter, setProgramaCategoryFilter] = useState<string>('all')
  const [programaExpandedCategories, setProgramaExpandedCategories] = useState<Set<string>>(new Set())
  const [linkingProgramaItem, setLinkingProgramaItem] = useState<string | null>(null)

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
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; contactName?: string; email: string; phone?: string; website?: string; currency?: string; logo?: string }>>([])
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
    logo: '',
    categoryId: '',
    currency: 'CAD'
  })
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierCategories, setSupplierCategories] = useState<Array<{ id: string; name: string; icon?: string; color?: string }>>([])
  const [loadingSupplierCategories, setLoadingSupplierCategories] = useState(false)

  // RFQ Dialog
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false)
  const [rfqPreselectedItems, setRfqPreselectedItems] = useState<string[]>([])

  // Quick Quote Dialog (simplified with preview)
  const [quickQuoteDialogOpen, setQuickQuoteDialogOpen] = useState(false)
  const [quickQuoteItems, setQuickQuoteItems] = useState<string[]>([])

  // Client Quote Dialog (direct invoice to client with markup)
  const [clientQuoteDialogOpen, setClientQuoteDialogOpen] = useState(false)
  const [clientQuotePreselectedItems, setClientQuotePreselectedItems] = useState<string[]>([])

  // Budget Approval Dialog
  const [budgetApprovalDialogOpen, setBudgetApprovalDialogOpen] = useState(false)

  // Send to Client Dialog (send quote with payment link)
  const [sendToClientDialogOpen, setSendToClientDialogOpen] = useState(false)
  const [sendToClientItems, setSendToClientItems] = useState<string[]>([])

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
  
  // Option groups - for items that share the same FFE requirement
  // Key: ffeItemId, Value: selected option index (0-based)
  const [selectedOptionByFfe, setSelectedOptionByFfe] = useState<Record<string, number>>({})
  
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
  const [shareTab, setShareTab] = useState<'publish' | 'links'>('links')
  const [shareLinks, setShareLinks] = useState<any[]>([])
  const [loadingShareLinks, setLoadingShareLinks] = useState(false)
  const [createShareLinkOpen, setCreateShareLinkOpen] = useState(false)
  const [editingShareLink, setEditingShareLink] = useState<any>(null)

  // PDF Export dialog state
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false)

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

  // Currency filter (for Financial tab)
  const [filterCurrency, setFilterCurrency] = useState<'all' | 'CAD' | 'USD'>('all')
  
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

    // Store business name and contact name in consistent format for display parsing
    // Format: "Business Name / Contact Name" (or just "Business Name" if no contact)
    const supplierDisplay = supplier.contactName
      ? `${supplier.name} / ${supplier.contactName}`
      : supplier.name

    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierDisplay,
          supplierId: supplier.id // Also store supplier ID for proper linking
        })
      })

      if (res.ok) {
        setSpecs(prev => prev.map(s =>
          s.id === itemId ? { ...s, supplierName: supplierDisplay, supplierId: supplier.id } : s
        ))
        toast.success('Supplier updated')
      }
    } catch (error) {
      console.error('Error updating supplier:', error)
      toast.error('Failed to update supplier')
    }

    setSupplierPickerItem(null)
  }
  
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

  // Create new supplier and assign to item
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
        
        // If we have an item to assign to, do it
        if (addSupplierModal.forItemId) {
          await handleSelectSupplier(addSupplierModal.forItemId, data.supplier)
        }
        
        // Reset and close
        setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logo: '', categoryId: '', currency: 'CAD' })
        setAddSupplierModal({ open: false, forItemId: null })
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
  const fetchSpecs = useCallback(async (preserveScroll = false) => {
    // Save scroll position before fetching if requested
    const scrollPosition = preserveScroll ? window.scrollY : 0
    
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/specs`)
      const data = await res.json()
      
      if (data.specs) {
        setSpecs(data.specs)
        // Only expand all categories on initial load, not on refresh
        if (!preserveScroll) {
          const categories = [...new Set(data.specs.map((s: SpecItem) => s.categoryName))]
          setExpandedCategories(new Set(categories))
        }
        // Preload all images for instant display
        const imageUrls = data.specs
          .map((s: SpecItem) => s.thumbnailUrl || s.images?.[0])
          .filter(Boolean) as string[]
        imageUrls.forEach(url => {
          const img = new window.Image()
          img.src = url
        })
      }
      if (data.financials) {
        setFinancials(data.financials)
      }
      // Also set available rooms from the data
      if (data.availableRooms) {
        setAvailableRooms(data.availableRooms)
      }
      
      // Restore scroll position after state update
      if (preserveScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition)
        })
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

  // Fetch Programa items for linking
  const fetchProgramaItems = useCallback(async () => {
    setProgramaLoading(true)
    try {
      const url = `/api/programa-import?unlinked=true`
      const res = await fetch(url)
      const data = await res.json()
      if (data.items) {
        setProgramaItems(data.items)
        setProgramaCategories(data.categories || [])
        // Auto-expand all categories
        if (data.categories) {
          setProgramaExpandedCategories(new Set(data.categories))
        }
      }
    } catch (error) {
      console.error('Failed to fetch Programa items:', error)
    } finally {
      setProgramaLoading(false)
    }
  }, [])

  // Link Programa item to FFE item
  const linkProgramaItem = async (programaItemId: string) => {
    if (!programaModal.ffeItemId) return

    setLinkingProgramaItem(programaItemId)
    try {
      // Link the programa item - this also copies programa data to the FFE item
      const linkRes = await fetch(`/api/programa-import/${programaItemId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomFFEItemId: programaModal.ffeItemId })
      })

      if (!linkRes.ok) {
        const errorData = await linkRes.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to link item')
      }

      toast.success('Item linked successfully')
      setProgramaModal({ open: false, sectionId: null, roomId: null, ffeItemId: null, ffeItemName: null })
      fetchSpecs(true)
      loadFfeItems()
      fetchProgramaItems()
    } catch (error) {
      console.error('Error linking programa item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to link item')
    } finally {
      setLinkingProgramaItem(null)
    }
  }

  useEffect(() => {
    fetchSpecs()
    loadSuppliers()
    loadFfeItems()
  }, [fetchSpecs, loadSuppliers, loadFfeItems])

  // Warn before page refresh/navigation when editing
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editingField || savingItem) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [editingField, savingItem])

  // Fetch Programa items when modal opens
  useEffect(() => {
    if (programaModal.open) {
      fetchProgramaItems()
    }
  }, [programaModal.open, fetchProgramaItems])

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
  
  // Recalculate financials whenever filtered specs change (respects room/status filters)
  useEffect(() => {
    const specsToCalculate = filteredSpecs.length > 0 ? filteredSpecs : specs

    // Helper to get effective currency for a spec (uses supplier currency if linked)
    const getEffectiveTradeCurrency = (s: typeof specs[0]) => {
      if (s.supplierId) {
        const supplier = suppliers.find(sup => sup.id === s.supplierId)
        if (supplier?.currency) return supplier.currency
      }
      return s.tradePriceCurrency || 'CAD'
    }
    const getEffectiveRrpCurrency = (s: typeof specs[0]) => {
      if (s.supplierId) {
        const supplier = suppliers.find(sup => sup.id === s.supplierId)
        if (supplier?.currency) return supplier.currency
      }
      return s.rrpCurrency || 'CAD'
    }

    // Separate trade prices by currency
    // If trade price is missing but RRP exists, use RRP (no markup = same price)
    const totalTradePriceCAD = specsToCalculate.reduce((sum, s) => {
      if (getEffectiveTradeCurrency(s) !== 'CAD') return sum
      const price = s.tradePrice ?? s.rrp ?? 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)

    const totalTradePriceUSD = specsToCalculate.reduce((sum, s) => {
      if (getEffectiveTradeCurrency(s) !== 'USD') return sum
      const price = s.tradePrice ?? s.rrp ?? 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)

    // Separate RRP by currency
    // If RRP is missing but trade price exists, use trade price (no markup = same price)
    const totalRRPCAD = specsToCalculate.reduce((sum, s) => {
      if (getEffectiveRrpCurrency(s) !== 'CAD') return sum
      const price = s.rrp ?? s.tradePrice ?? 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)

    const totalRRPUSD = specsToCalculate.reduce((sum, s) => {
      if (getEffectiveRrpCurrency(s) !== 'USD') return sum
      const price = s.rrp ?? s.tradePrice ?? 0
      const qty = s.quantity || 1
      return sum + (price * qty)
    }, 0)

    // Calculate average discount based on CAD values (primary currency)
    const avgTradeDiscount = totalRRPCAD > 0
      ? ((totalRRPCAD - totalTradePriceCAD) / totalRRPCAD * 100)
      : 0

    setFinancials({
      totalTradePriceCAD,
      totalTradePriceUSD,
      totalRRPCAD,
      totalRRPUSD,
      avgTradeDiscount: Math.round(avgTradeDiscount * 100) / 100
    })
  }, [filteredSpecs, specs, suppliers])
  
  // Filter and group specs
  useEffect(() => {
    let filtered = specs

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(spec =>
        spec.name?.toLowerCase().includes(query) ||
        spec.productName?.toLowerCase().includes(query) ||
        spec.brand?.toLowerCase().includes(query) ||
        spec.roomName?.toLowerCase().includes(query) ||
        spec.supplierName?.toLowerCase().includes(query) ||
        spec.sku?.toLowerCase().includes(query) ||
        spec.modelNumber?.toLowerCase().includes(query) ||
        spec.docCode?.toLowerCase().includes(query) ||
        spec.description?.toLowerCase().includes(query) ||
        spec.sectionName?.toLowerCase().includes(query)
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

    // Apply currency filter (uses supplier currency if linked, otherwise item currency)
    if (filterCurrency !== 'all') {
      filtered = filtered.filter(spec => {
        // Get effective currency from supplier or item
        let currency = spec.tradePriceCurrency || spec.rrpCurrency || 'CAD'
        if (spec.supplierId) {
          const supplier = suppliers.find(sup => sup.id === spec.supplierId)
          if (supplier?.currency) currency = supplier.currency
        }
        return currency === filterCurrency
      })
    }

    // Store filtered specs BEFORE summary filter (for accurate stats)
    // Summary filter is a view filter, not a data filter
    const baseFiltered = [...filtered]

    // Apply summary filter (needs approval or needs price)
    // Exclude CONTRACTOR_TO_ORDER from these filters as it's considered "done" (no price/approval needed)
    const skipFilterStatuses = ['CONTRACTOR_TO_ORDER']
    if (summaryFilter === 'needs_approval') {
      filtered = filtered.filter(spec => !spec.clientApproved && !skipFilterStatuses.includes(spec.specStatus || ''))
    } else if (summaryFilter === 'needs_price') {
      filtered = filtered.filter(spec => !spec.rrp && !skipFilterStatuses.includes(spec.specStatus || ''))
    }

    // Update filteredSpecs for stats calculation (use baseFiltered to exclude summary filter from stats)
    setFilteredSpecs(baseFiltered)

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

    // Sort items within each group based on itemSortBy
    const sortItems = (items: SpecItem[]) => {
      if (itemSortBy === 'default') return items // Keep original database order

      return [...items].sort((a, b) => {
        let comparison = 0
        switch (itemSortBy) {
          case 'name':
            comparison = (a.name || '').localeCompare(b.name || '')
            break
          case 'brand':
            comparison = (a.brand || '').localeCompare(b.brand || '')
            break
          case 'price_asc':
            comparison = (Number(a.tradePrice) || 0) - (Number(b.tradePrice) || 0)
            break
          case 'price_desc':
            comparison = (Number(b.tradePrice) || 0) - (Number(a.tradePrice) || 0)
            break
          case 'status':
            comparison = (a.specStatus || '').localeCompare(b.specStatus || '')
            break
        }
        return comparison
      })
    }

    // Convert to array and sort items within each group
    const groupedArray = Object.values(groups).map(group => ({
      ...group,
      items: sortItems(group.items)
    }))

    setGroupedSpecs(groupedArray.sort((a, b) => a.name.localeCompare(b.name)))

    // Expand all groups when sortBy changes (e.g., switching from category to room)
    if (sortBy !== prevSortByRef.current) {
      setExpandedCategories(new Set(groupedArray.map(g => g.name)))
      prevSortByRef.current = sortBy
    }
  }, [specs, searchQuery, filterStatus, filterRoom, filterSection, filterCurrency, summaryFilter, sortBy, itemSortBy, suppliers])
  
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
  
  // Compute option groups - items that share the same FFE requirement are options
  // Returns a map of: ffeItemId -> array of spec IDs that are options for it
  const optionGroups = useMemo(() => {
    const groups: Record<string, string[]> = {}
    
    specs.forEach(spec => {
      // Check if this spec is linked to an FFE item
      const primaryFfeId = spec.linkedFfeItems?.[0]?.ffeItemId || spec.ffeRequirementId
      if (primaryFfeId) {
        if (!groups[primaryFfeId]) {
          groups[primaryFfeId] = []
        }
        groups[primaryFfeId].push(spec.id)
      }
    })
    
    // Only keep groups with more than 1 option
    const multiOptionGroups: Record<string, string[]> = {}
    Object.entries(groups).forEach(([ffeId, specIds]) => {
      if (specIds.length > 1) {
        multiOptionGroups[ffeId] = specIds
      }
    })
    
    return multiOptionGroups
  }, [specs])
  
  // Get the FFE item ID for a spec (for option grouping)
  const getSpecFfeId = (spec: SpecItem): string | null => {
    return spec.linkedFfeItems?.[0]?.ffeItemId || spec.ffeRequirementId || null
  }
  
  // Check if a spec is part of an option group
  const isPartOfOptionGroup = (spec: SpecItem): boolean => {
    const ffeId = getSpecFfeId(spec)
    return ffeId ? !!optionGroups[ffeId] : false
  }
  
  // Get option number for a spec within its group (1-based)
  const getOptionNumber = (spec: SpecItem): number => {
    const ffeId = getSpecFfeId(spec)
    if (!ffeId || !optionGroups[ffeId]) return 0
    return optionGroups[ffeId].indexOf(spec.id) + 1
  }
  
  // Get all specs in the same option group
  const getOptionGroupSpecs = (spec: SpecItem): SpecItem[] => {
    const ffeId = getSpecFfeId(spec)
    if (!ffeId || !optionGroups[ffeId]) return [spec]
    return optionGroups[ffeId].map(id => specs.find(s => s.id === id)).filter(Boolean) as SpecItem[]
  }
  
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
          // Deduplicate images
          const rawImages = result.data.images?.length ? result.data.images : pageImages
          const uniqueImages = [...new Set(rawImages)]
          setExtractedData({
            ...result.data,
            productWebsite: urlInput,
            images: uniqueImages,
            notes: '' // Don't auto-populate notes
          })
          toast.success('Product info extracted!')
        } else {
          // Fallback with basic data - deduplicate images
          const uniqueImages = [...new Set(pageImages)]
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
            images: uniqueImages
          })
          toast.success('Basic info extracted')
        }
      } else {
        // If AI fails, still provide basic extraction - deduplicate images
        const uniqueImages = [...new Set(pageImages)]
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
          images: uniqueImages
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
        // Use extracted description, fallback to FFE item name
        description: urlGenerateData.productDescription || ffeItem.name || '',
        brand: urlGenerateData.brand || '',
        sku: urlGenerateData.sku || '',
        // supplierLink = product URL (where we scraped from) - NOT the supplier's website
        supplierLink: urlGenerateData.productWebsite || urlGenerateInput,
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
        length: urlGenerateData.length || '',
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
        fetchSpecs(true) // Preserve scroll position
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
    if (!sectionId || !roomId) {
      toast.error('Missing section or room information')
      return
    }

    setSavingItem(true)
    try {
      // Get the FFE instance for the room
      const roomRes = await fetch(`/api/ffe/v2/rooms/${roomId}`)
      const roomData = await roomRes.json()

      if (!roomData.success) {
        console.error('Room data error:', roomData)
        throw new Error(roomData.error || 'Failed to load room data')
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
          // Default description to FFE item name if linked, otherwise use provided description
          description: selectedFfeItem?.itemName || itemData.description || itemData.productDescription || '',
          brand: itemData.brand,
          sku: itemData.sku,
          material: itemData.material,
          color: itemData.colour || itemData.color,
          finish: itemData.finish,
          width: itemData.width,
          height: itemData.height,
          depth: itemData.depth,
          leadTime: itemData.leadTime,
          supplierName: itemData.supplierName || '',
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
        fetchSpecs(true) // Refresh the list, preserve scroll
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
        const errorData = await res.json().catch(() => ({}))
        console.error('Add item error:', errorData)
        throw new Error(errorData.error || 'Failed to add item')
      }
    } catch (error: any) {
      console.error('Error adding item:', error)
      toast.error(error.message || 'Failed to add item')
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

  // Archive item - sets status to ARCHIVED and removes all FFE links
  const handleArchiveItem = async (item: SpecItem) => {
    if (!confirm(`Archive "${item.name}"? This will unlink it from all FFE workspace items.`)) {
      return
    }

    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      })

      if (res.ok) {
        // Update local state - set status to ARCHIVED and clear FFE links
        setSpecs(prev => prev.map(s =>
          s.id === item.id
            ? { ...s, specStatus: 'ARCHIVED', linkedFfeItems: [], ffeRequirementId: null, ffeRequirementName: null }
            : s
        ))
        toast.success(`"${item.name}" archived`)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to archive item')
      }
    } catch (error) {
      console.error('Error archiving item:', error)
      toast.error('Failed to archive item')
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
  
  // Get status display (checks legacy map for old statuses)
  const getItemStatusDisplay = (status: string) => {
    // First check main options
    const statusOption = ITEM_STATUS_OPTIONS.find(o => o.value === status)
    if (statusOption) {
      const IconComponent = statusOption.icon
      return (
        <div className="flex items-center gap-1.5">
          <IconComponent className={cn("w-3.5 h-3.5", statusOption.color)} />
          <span className="text-xs">{statusOption.label}</span>
        </div>
      )
    }
    // Check legacy map for old statuses
    const legacyStatus = LEGACY_STATUS_MAP[status]
    if (legacyStatus) {
      const IconComponent = legacyStatus.icon
      return (
        <div className="flex items-center gap-1.5">
          <IconComponent className={cn("w-3.5 h-3.5", legacyStatus.color)} />
          <span className="text-xs">{legacyStatus.label}</span>
        </div>
      )
    }
    // Fallback to first option (SELECTED)
    const fallback = ITEM_STATUS_OPTIONS[0]
    const FallbackIcon = fallback.icon
    return (
      <div className="flex items-center gap-1.5">
        <FallbackIcon className={cn("w-3.5 h-3.5", fallback.color)} />
        <span className="text-xs">{fallback.label}</span>
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
      formData.append('imageType', 'spec-item')
      
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
      const updateData: Record<string, any> = {}
      updateData[editingField.field] = editValue

      // If markup is being changed and item has a trade price, calculate RRP
      let calculatedRrp: number | null = null
      if (editingField.field === 'markupPercent' && editValue) {
        const markup = parseFloat(editValue)
        if (!isNaN(markup) && item.tradePrice) {
          calculatedRrp = item.tradePrice * (1 + markup / 100)
          updateData.rrp = calculatedRrp.toFixed(2)
        }
      }

      // If trade discount is being changed and item has RRP, calculate trade price
      let calculatedTradePrice: number | null = null
      if (editingField.field === 'tradeDiscount' && editValue) {
        const discount = parseFloat(editValue)
        if (!isNaN(discount) && item.rrp) {
          calculatedTradePrice = item.rrp * (1 - discount / 100)
          updateData.tradePrice = calculatedTradePrice.toFixed(2)
        }
      }

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
        } else if (editingField.field === 'tradePrice' || editingField.field === 'rrp' || editingField.field === 'unitCost' || editingField.field === 'tradeDiscount' || editingField.field === 'markupPercent') {
          parsedValue = editValue ? parseFloat(editValue) : null
        }

        setSpecs(prev => prev.map(s => {
          if (s.id === editingField.itemId) {
            const updated = { ...s, [editingField.field]: parsedValue }
            // Also update RRP if markup was changed
            if (calculatedRrp !== null) {
              updated.rrp = calculatedRrp
            }
            // Also update trade price if trade discount was changed
            if (calculatedTradePrice !== null) {
              updated.tradePrice = calculatedTradePrice
            }
            return updated
          }
          return s
        }))
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

    // Find the selected FFE item to get its name for description
    const selectedFfe = getUnlinkedFfeItemsForDuplicate().find(f => f.id === selectedDuplicateFfeItem)

    try {
      setDuplicating(true)
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: item.sectionId,
          name: item.name,
          // Description defaults to FFE item name
          description: selectedFfe?.name || item.description,
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
        fetchSpecs(true) // Preserve scroll position
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
        fetchSpecs(true) // Preserve scroll position
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
        fetchSpecs(true) // Preserve scroll position
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
            fetchSpecs(true) // Preserve scroll position
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
        fetchSpecs(true) // Preserve scroll position
      } else {
        throw new Error('Failed to remove')
      }
    } catch (error) {
      console.error('Error removing item:', error)
      toast.error('Failed to remove item')
    }
  }

  // Export specs to Excel (CSV format)
  const handleExportExcel = () => {
    const specsToExport = selectedItems.size > 0
      ? specs.filter(s => selectedItems.has(s.id))
      : specs

    if (specsToExport.length === 0) {
      toast.error('No items to export')
      return
    }

    // Define CSV headers
    const headers = [
      'Doc Code',
      'Name',
      'Room',
      'Section',
      'Brand',
      'Model/SKU',
      'Supplier',
      'Qty',
      'Trade Price',
      'RRP',
      'Status',
      'Lead Time',
      'Color',
      'Finish',
      'Material',
      'Dimensions (WxHxD)',
      'Description',
      'Notes'
    ]

    // Convert specs to CSV rows
    const rows = specsToExport.map(spec => [
      spec.docCode || '',
      spec.name || '',
      spec.roomName || '',
      spec.sectionName || '',
      spec.brand || '',
      spec.modelNumber || spec.sku || '',
      spec.supplierName || '',
      spec.quantity || 1,
      spec.tradePrice ? `$${Number(spec.tradePrice).toFixed(2)}` : '',
      spec.rrp ? `$${Number(spec.rrp).toFixed(2)}` : '',
      spec.specStatus || '',
      spec.leadTime || '',
      spec.color || '',
      spec.finish || '',
      spec.material || '',
      [spec.width, spec.height, spec.depth].filter(Boolean).join(' x ') || '',
      spec.description || '',
      spec.notes || ''
    ])

    // Escape CSV values
    const escapeCSV = (value: string | number) => {
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_specs_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Exported ${specsToExport.length} items to Excel`)
  }

  // Bulk delete selected items
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`)) return

    const itemsToDelete = specs.filter(s => selectedItems.has(s.id))
    let successCount = 0
    let failCount = 0

    for (const item of itemsToDelete) {
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
          method: 'DELETE'
        })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      toast.success(`Deleted ${successCount} item(s)`)
      fetchSpecs(true)
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} item(s)`)
    }
    setSelectedItems(new Set())
  }

  // Bulk duplicate selected items
  const [bulkDuplicating, setBulkDuplicating] = useState(false)
  const handleBulkDuplicate = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`Duplicate ${selectedItems.size} item(s)?`)) return

    setBulkDuplicating(true)
    const itemsToDuplicate = specs.filter(s => selectedItems.has(s.id))
    let successCount = 0
    let failCount = 0

    for (const item of itemsToDuplicate) {
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId: item.sectionId,
            name: `${item.name} (Copy)`,
            description: item.description,
            sku: item.sku,
            productName: item.productName,
            brand: item.brand,
            modelNumber: item.modelNumber,
            // docCode intentionally not copied - must be unique per project
            supplierName: item.supplierName,
            supplierLink: item.supplierLink,
            supplierId: item.supplierId,
            quantity: item.quantity,
            unitType: item.unitType,
            leadTime: item.leadTime,
            color: item.color,
            finish: item.finish,
            material: item.material,
            width: item.width,
            height: item.height,
            depth: item.depth,
            length: item.length,
            notes: item.notes,
            tradePrice: item.tradePrice,
            rrp: item.rrp,
            tradeDiscount: item.tradeDiscount,
            images: item.images,
            specStatus: item.specStatus,
            isSpecItem: true
          })
        })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    setBulkDuplicating(false)
    if (successCount > 0) {
      toast.success(`Duplicated ${successCount} item(s)`)
      fetchSpecs(true)
    }
    if (failCount > 0) {
      toast.error(`Failed to duplicate ${failCount} item(s)`)
    }
    setSelectedItems(new Set())
  }

  // Bulk move modal state
  const [bulkMoveModal, setBulkMoveModal] = useState(false)
  const [bulkMoveTargetSection, setBulkMoveTargetSection] = useState('')
  const [bulkMoving, setBulkMoving] = useState(false)

  const handleBulkMove = async () => {
    if (selectedItems.size === 0 || !bulkMoveTargetSection) return

    setBulkMoving(true)
    const itemsToMove = specs.filter(s => selectedItems.has(s.id))
    let successCount = 0
    let failCount = 0

    for (const item of itemsToMove) {
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId: bulkMoveTargetSection })
        })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    setBulkMoving(false)
    setBulkMoveModal(false)
    setBulkMoveTargetSection('')
    if (successCount > 0) {
      toast.success(`Moved ${successCount} item(s)`)
      fetchSpecs(true)
    }
    if (failCount > 0) {
      toast.error(`Failed to move ${failCount} item(s)`)
    }
    setSelectedItems(new Set())
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

  // Load share links
  const loadShareLinks = async () => {
    setLoadingShareLinks(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/spec-share-links`)
      if (res.ok) {
        const data = await res.json()
        setShareLinks(data.shareLinks || [])
      }
    } catch (error) {
      console.error('Failed to load share links:', error)
    } finally {
      setLoadingShareLinks(false)
    }
  }

  // Delete share link
  const handleDeleteShareLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/spec-share-links/${linkId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Link deleted')
        loadShareLinks()
      }
    } catch (error) {
      toast.error('Failed to delete link')
    }
  }

  // Copy share link URL
  const copyShareLinkUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('Link copied!')
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
      
      {/* Sticky Header - Action Bar + Tabs (top-16 = 64px for fixed navbar) */}
      <div className="sticky top-16 z-30 bg-white shadow-sm">
        {/* Action Bar */}
        <div className="border-b border-gray-200">
          <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                onClick={() => router.push(`/projects/${project.id}`)}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-900 -ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">All Specs</h1>
                <p className="text-sm text-gray-500 mt-0.5">{project.name}</p>
              </div>
              {specs.length > 0 && (
                <>
                  <div className="h-6 w-px bg-gray-200" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-600 hover:text-gray-900"
                    onClick={() => {
                      if (selectedItems.size === specs.length) {
                        setSelectedItems(new Set())
                      } else {
                        setSelectedItems(new Set(specs.map(s => s.id)))
                      }
                    }}
                  >
                    {selectedItems.size === specs.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedItems.size > 0 && (
                    <span className="text-sm font-medium text-blue-600">
                      {selectedItems.size} selected
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedItems.size === 0) {
                    toast.error('Please select items first')
                    return
                  }
                  setQuickQuoteItems(Array.from(selectedItems))
                  setQuickQuoteDialogOpen(true)
                }}
                disabled={selectedItems.size === 0}
                className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Request Quotes {selectedItems.size > 0 && `(${selectedItems.size})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedItems.size === 0) {
                    toast.error('Please select items first')
                    return
                  }
                  setClientQuotePreselectedItems(Array.from(selectedItems))
                  setClientQuoteDialogOpen(true)
                }}
                disabled={selectedItems.size === 0}
                className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Client Invoice {selectedItems.size > 0 && `(${selectedItems.size})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedItems.size === 0) {
                    toast.error('Please select items first')
                    return
                  }
                  setBudgetApprovalDialogOpen(true)
                }}
                disabled={selectedItems.size === 0}
                className="h-8 border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 disabled:opacity-50"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Budget Approval {selectedItems.size > 0 && `(${selectedItems.size})`}
              </Button>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Share
                    <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    className="text-sm cursor-pointer"
                    onClick={() => {
                      loadShareSettings()
                      loadShareLinks()
                      setShareModal(true)
                    }}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Share Link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-sm cursor-pointer"
                    onClick={() => setPdfExportDialogOpen(true)}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-sm cursor-pointer"
                    onClick={handleExportExcel}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export Excel {selectedItems.size > 0 && `(${selectedItems.size} selected)`}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedItems.size > 0 && (
                <>
                  <div className="h-5 w-px bg-gray-200" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleBulkDuplicate}
                    disabled={bulkDuplicating}
                    title="Duplicate selected items"
                  >
                    {bulkDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setBulkMoveModal(true)}
                    title="Move to section"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50"
                    onClick={handleBulkDelete}
                    title="Delete selected items"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedItems(new Set())}
                    title="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
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
          </div>
        </div>

        {/* Tabs Row */}
        <div className="border-b border-gray-200">
          <div className="max-w-full mx-auto px-6 py-3">
            {/* Tabs Row - Modern Style */}
          <div className="flex items-center justify-between">
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
                    {ffeItems.length > 0 && (() => {
                      // Calculate filtered count (respects room/section filters)
                      const filteredCount = filteredFfeItems.reduce((acc, room) =>
                        acc + room.sections.reduce((sAcc, section) =>
                          sAcc + section.items.filter(item => !item.hasLinkedSpecs).length, 0
                        ), 0
                      )
                      // Calculate total count (all items)
                      const totalCount = ffeItems.reduce((acc, room) =>
                        acc + room.sections.reduce((sAcc, section) =>
                          sAcc + section.items.filter(item => !item.hasLinkedSpecs).length, 0
                        ), 0
                      )
                      const isFiltered = filterRoom !== 'all' || filterSection !== 'all'

                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-1.5 py-0 h-5",
                            activeTab === 'needs'
                              ? "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          )}
                        >
                          {isFiltered ? `${filteredCount} of ${totalCount}` : filteredCount}
                        </Badge>
                      )
                    })()}
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
                    (filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all' || filterCurrency !== 'all' || summaryFilter !== 'all') ? "text-emerald-600" : "text-gray-500"
                  )}>
                    <Filter className="w-4 h-4 mr-1.5" />
                    Filter
                    {(filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all' || filterCurrency !== 'all' || summaryFilter !== 'all') && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-emerald-100 text-emerald-600">
                        {(filterStatus !== 'all' ? 1 : 0) + (filterRoom !== 'all' ? 1 : 0) + (filterSection !== 'all' ? 1 : 0) + (filterCurrency !== 'all' ? 1 : 0) + (summaryFilter !== 'all' ? 1 : 0)}
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

                    {/* Currency Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</Label>
                      <Select value={filterCurrency} onValueChange={(v) => setFilterCurrency(v as 'all' | 'CAD' | 'USD')}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="All Currencies" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Currencies</SelectItem>
                          <SelectItem value="CAD">CAD Only</SelectItem>
                          <SelectItem value="USD">USD Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters */}
                    {(filterStatus !== 'all' || filterRoom !== 'all' || filterSection !== 'all' || filterCurrency !== 'all' || summaryFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => {
                          setFilterStatus('all')
                          setFilterRoom('all')
                          setFilterSection('all')
                          setFilterCurrency('all')
                          setSummaryFilter('all')
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
                  <Button variant="ghost" size="sm" className={cn(
                    "h-8",
                    itemSortBy !== 'default' ? "text-blue-600" : "text-gray-500"
                  )}>
                    <SortAsc className="w-4 h-4 mr-1.5" />
                    Sort
                    {itemSortBy !== 'default' && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-blue-100 text-blue-600">1</Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-xs font-medium text-gray-500">Group by</div>
                  <DropdownMenuItem onClick={() => setSortBy('category')} className={cn(sortBy === 'category' && "bg-gray-100")}>
                    Category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('room')} className={cn(sortBy === 'room' && "bg-gray-100")}>
                    Room
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-gray-500">Sort items by</div>
                  <DropdownMenuItem onClick={() => setItemSortBy('default')} className={cn(itemSortBy === 'default' && "bg-gray-100")}>
                    Default Order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setItemSortBy('name')} className={cn(itemSortBy === 'name' && "bg-gray-100")}>
                    Name (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setItemSortBy('brand')} className={cn(itemSortBy === 'brand' && "bg-gray-100")}>
                    Brand (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setItemSortBy('price_asc')} className={cn(itemSortBy === 'price_asc' && "bg-gray-100")}>
                    Price (Low → High)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setItemSortBy('price_desc')} className={cn(itemSortBy === 'price_desc' && "bg-gray-100")}>
                    Price (High → Low)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setItemSortBy('status')} className={cn(itemSortBy === 'status' && "bg-gray-100")}>
                    Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Status Overview Bar - Always visible (uses filteredSpecs to respect room/status filters) */}
          {specs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500 mr-1">
                  {filteredSpecs.length} {filteredSpecs.length !== specs.length ? `of ${specs.length}` : ''} items:
                </span>

                {/* Approved - Green */}
                <button
                  onClick={() => setSummaryFilter('all')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    summaryFilter === 'all'
                      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {filteredSpecs.filter(s => s.clientApproved).length} Approved
                </button>

                {/* Needs Approval - Amber (excludes CONTRACTOR_TO_ORDER as it's considered done) */}
                {filteredSpecs.filter(s => !s.clientApproved && s.specStatus !== 'CONTRACTOR_TO_ORDER').length > 0 && (
                  <button
                    onClick={() => setSummaryFilter(summaryFilter === 'needs_approval' ? 'all' : 'needs_approval')}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      summaryFilter === 'needs_approval'
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                        : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {filteredSpecs.filter(s => !s.clientApproved && s.specStatus !== 'CONTRACTOR_TO_ORDER').length} Need Approval
                  </button>
                )}

                {/* Needs Price - Red (excludes CONTRACTOR_TO_ORDER as it doesn't need pricing) */}
                {filteredSpecs.filter(s => !s.rrp && s.specStatus !== 'CONTRACTOR_TO_ORDER').length > 0 && (
                  <button
                    onClick={() => setSummaryFilter(summaryFilter === 'needs_price' ? 'all' : 'needs_price')}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      summaryFilter === 'needs_price'
                        ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                        : "bg-red-50 text-red-600 hover:bg-red-100"
                    )}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {filteredSpecs.filter(s => !s.rrp && s.specStatus !== 'CONTRACTOR_TO_ORDER').length} Need Price
                  </button>
                )}

                {/* Clear filter indicator */}
                {summaryFilter !== 'all' && (
                  <button
                    onClick={() => setSummaryFilter('all')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Financial Summary Bar - Only in Financial Tab */}
          {activeTab === 'financial' && (
            <div className="flex items-center gap-8 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              {/* CAD Totals - Trade & RRP grouped */}
              <div className="flex items-center gap-4 pr-6 border-r border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Trade (CAD)</p>
                  <p className="text-lg font-semibold text-gray-900">${financials.totalTradePriceCAD.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">RRP (CAD)</p>
                  <p className="text-lg font-semibold text-gray-900">${financials.totalRRPCAD.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              {/* USD Totals - Trade & RRP grouped - Only show if there are USD items */}
              {(financials.totalTradePriceUSD > 0 || financials.totalRRPUSD > 0) && (
                <div className="flex items-center gap-4 pr-6 border-r border-gray-200">
                  <div>
                    <p className="text-xs text-blue-500 uppercase">Trade (USD)</p>
                    <p className="text-lg font-semibold text-blue-600">${financials.totalTradePriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 uppercase">RRP (USD)</p>
                    <p className="text-lg font-semibold text-blue-600">${financials.totalRRPUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}
              {/* Avg Margin */}
              <div>
                <p className="text-xs text-gray-500 uppercase">Avg Margin</p>
                <p className="text-lg font-semibold text-gray-900">
                  {financials.totalTradePriceCAD > 0 ? `${financials.avgTradeDiscount.toFixed(2)}%` : '-'}
                </p>
              </div>
            </div>
          )}
          </div>
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
                                    {item.isLinkedItem && item.parentId && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const parentElement = document.querySelector(`[data-item-id="${item.parentId}"]`)
                                              if (parentElement) {
                                                parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                parentElement.classList.add('ring-2', 'ring-violet-400')
                                                setTimeout(() => parentElement.classList.remove('ring-2', 'ring-violet-400'), 2000)
                                              }
                                            }}
                                            className="w-5 h-5 flex items-center justify-center bg-violet-100 text-violet-600 rounded hover:bg-violet-200 transition-colors"
                                            title={`Linked to: ${item.parentName}`}
                                          >
                                            <LinkIcon className="w-3 h-3" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                                          <div className="p-3 border-b bg-violet-50">
                                            <div className="flex items-center gap-2">
                                              <Layers className="w-4 h-4 text-violet-600" />
                                              <p className="text-xs font-semibold text-violet-800">Grouped with Parent</p>
                                            </div>
                                          </div>
                                          <div className="p-3 space-y-2">
                                            <div>
                                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Parent Item</p>
                                              <p className="text-sm font-medium text-gray-900">{item.parentName}</p>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full h-7 text-xs"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const parentElement = document.querySelector(`[data-item-id="${item.parentId}"]`)
                                                if (parentElement) {
                                                  parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                  parentElement.classList.add('ring-2', 'ring-violet-400')
                                                  setTimeout(() => parentElement.classList.remove('ring-2', 'ring-violet-400'), 2000)
                                                }
                                              }}
                                            >
                                              <Eye className="w-3 h-3 mr-1" />
                                              Find Parent in List
                                            </Button>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
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
                                  <DropdownMenuItem onClick={() => {
                                    setProgramaModal({
                                      open: true,
                                      sectionId: sectionId,
                                      roomId: roomId,
                                      ffeItemId: item.id,
                                      ffeItemName: item.name
                                    })
                                  }}>
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Programa Import
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
                                    {item.isLinkedItem && item.parentId && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const parentElement = document.querySelector(`[data-item-id="${item.parentId}"]`)
                                              if (parentElement) {
                                                parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                parentElement.classList.add('ring-2', 'ring-violet-400')
                                                setTimeout(() => parentElement.classList.remove('ring-2', 'ring-violet-400'), 2000)
                                              }
                                            }}
                                            className="w-5 h-5 flex items-center justify-center bg-violet-100 text-violet-600 rounded hover:bg-violet-200 transition-colors"
                                            title={`Linked to: ${item.parentName}`}
                                          >
                                            <LinkIcon className="w-3 h-3" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                                          <div className="p-3 border-b bg-violet-50">
                                            <div className="flex items-center gap-2">
                                              <Layers className="w-4 h-4 text-violet-600" />
                                              <p className="text-xs font-semibold text-violet-800">Grouped with Parent</p>
                                            </div>
                                          </div>
                                          <div className="p-3 space-y-2">
                                            <div>
                                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Parent Item</p>
                                              <p className="text-sm font-medium text-gray-900">{item.parentName}</p>
                                              <p className="text-xs text-gray-500 mt-0.5">Section: {section.sectionName}</p>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full h-7 text-xs"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const parentElement = document.querySelector(`[data-item-id="${item.parentId}"]`)
                                                if (parentElement) {
                                                  parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                  parentElement.classList.add('ring-2', 'ring-violet-400')
                                                  setTimeout(() => parentElement.classList.remove('ring-2', 'ring-violet-400'), 2000)
                                                }
                                              }}
                                            >
                                              <Eye className="w-3 h-3 mr-1" />
                                              Find Parent in List
                                            </Button>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
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
                                  <DropdownMenuItem onClick={() => {
                                    setProgramaModal({
                                      open: true,
                                      sectionId: section.sectionId,
                                      roomId: room.roomId,
                                      ffeItemId: item.id,
                                      ffeItemName: item.name
                                    })
                                  }}>
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Programa Import
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
            {/* Show available sections if any - deduplicated by section name */}
            {availableRooms.some(r => r.sections.length > 0) ? (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to add specs</h3>
                  <p className="text-gray-500">Click on a section below to add items, or use the Chrome extension.</p>
                </div>

                {/* Deduplicate sections by name - show each section once */}
                {(() => {
                  const uniqueSections = new Map<string, { id: string; name: string; roomId: string }>()
                  availableRooms.filter(r => r.sections.length > 0).forEach(room => {
                    room.sections.forEach(section => {
                      if (!uniqueSections.has(section.name)) {
                        uniqueSections.set(section.name, { id: section.id, name: section.name, roomId: room.id })
                      }
                    })
                  })
                  return Array.from(uniqueSections.values())
                })().map(section => (
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
                        onClick={() => openLibraryModal(section.id, section.roomId)}
                      >
                        <Library className="w-3.5 h-3.5" />
                        From Library
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-600"
                        onClick={() => setAddFromUrlModal({ open: true, sectionId: section.id, roomId: section.roomId })}
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
                          roomId: section.roomId
                        })}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Custom Item
                      </Button>
                    </div>
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
              >
                {/* Category Header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 group/header"
                  onMouseEnter={() => setHoveredSection(group.name)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <div className="flex items-center gap-2">
                    {/* Select all checkbox - show on hover */}
                    <div className={cn(
                      "transition-opacity duration-150",
                      hoveredSection === group.name || group.items.some(i => selectedItems.has(i.id)) ? "opacity-100" : "opacity-0"
                    )}>
                      <Checkbox
                        checked={group.items.every(i => selectedItems.has(i.id))}
                        onCheckedChange={(checked) => {
                          setSelectedItems(prev => {
                            const newSet = new Set(prev)
                            if (checked) {
                              group.items.forEach(i => newSet.add(i.id))
                            } else {
                              group.items.forEach(i => newSet.delete(i.id))
                            }
                            return newSet
                          })
                        }}
                        className="h-4 w-4"
                        title={`Select all in ${group.name}`}
                      />
                    </div>
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
                        <span className="text-sm font-medium ml-2 flex items-center gap-3">
                          {(() => {
                            const totals = getSectionTotals(group.items)
                            return (
                              <>
                                <span className="text-gray-700">
                                  <span className="text-[10px] text-gray-500 uppercase mr-1">Trade:</span>
                                  {formatCurrency(totals.tradeTotal)}
                                </span>
                                <span className="text-gray-500">
                                  <span className="text-[10px] uppercase mr-1">RRP:</span>
                                  {formatCurrency(totals.rrpTotal)}
                                </span>
                              </>
                            )
                          })()}
                        </span>
                      )}
                    </button>
                  </div>
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
                      {group.items.map((item) => {
                        // Check if this item is part of an option group
                        const ffeId = getSpecFfeId(item)
                        const optionSpecs = ffeId ? getOptionGroupSpecs(item) : [item]
                        const isFirstInGroup = optionSpecs[0]?.id === item.id
                        const hasMultipleOptions = optionSpecs.length > 1
                        
                        // Skip non-first items in option groups (they'll be shown via tabs)
                        if (hasMultipleOptions && !isFirstInGroup) {
                          return null
                        }
                        
                        // Get the currently selected option to display
                        const selectedIdx = ffeId ? (selectedOptionByFfe[ffeId] ?? 0) : 0
                        const displayItem = hasMultipleOptions ? (optionSpecs[selectedIdx] || item) : item
                        
                        return (
                        <SortableSpecItem key={item.id} id={item.id}>
                          {(listeners: any) => (
                        <div className="flex flex-col">
                          {/* Option Tabs - show when multiple specs share same FFE requirement */}
                          {hasMultipleOptions && ffeId && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100">
                              <span className="text-xs font-medium text-purple-700 mr-2">
                                <Layers className="w-3.5 h-3.5 inline mr-1" />
                                {optionSpecs.length} Options for: {item.linkedFfeItems?.[0]?.ffeItemName || 'FFE Item'}
                              </span>
                              <div className="flex gap-1">
                                {optionSpecs.map((spec, idx) => (
                                  <button
                                    key={spec.id}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedOptionByFfe(prev => ({ ...prev, [ffeId]: idx }))
                                    }}
                                    className={cn(
                                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                      selectedIdx === idx
                                        ? "bg-purple-600 text-white shadow-sm"
                                        : "bg-white text-purple-600 border border-purple-200 hover:border-purple-400"
                                    )}
                                  >
                                    Option {idx + 1}
                                    {spec.clientApproved && (
                                      <CheckCircle2 className="w-3 h-3 ml-1 inline text-emerald-400" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Item Row */}
                          <div
                          id={`spec-item-${displayItem.id}`}
                          data-item-id={displayItem.id}
                          className={cn(
                            "group/item relative flex items-center transition-colors border-l-2",
                            highlightedItemId === displayItem.id
                              ? "bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300"
                              : selectedItems.has(displayItem.id) 
                                ? "bg-blue-50 border-blue-500" 
                                : hasMultipleOptions
                                  ? "bg-purple-50/30 hover:bg-purple-50 border-purple-200"
                                  : "hover:bg-gray-50 border-transparent hover:border-blue-400"
                          )}
                          onMouseEnter={() => setHoveredItem(displayItem.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          {/* Hover Actions - Fixed on left side, show on hover or if selected */}
                          <div className={cn(
                            "absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 transition-opacity duration-150",
                            hoveredItem === displayItem.id || selectedItems.has(item.id) ? "opacity-100" : "opacity-0"
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
                          
                          {/* Main Item Row - Using flex with fixed widths for equal distribution */}
                          <div className="flex items-start w-full px-4 py-2 pl-14 gap-2">
                            {/* Image - Fixed width, clickable to open editor or upload */}
                            <div className="flex-shrink-0 w-16">
                              <HoverCard openDelay={300} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <div
                                    className={cn(
                                      "w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer transition-all",
                                      (displayItem.thumbnailUrl || displayItem.images?.[0])
                                        ? "hover:ring-2 hover:ring-purple-400 hover:ring-offset-1"
                                        : "hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 hover:bg-gray-200",
                                      uploadingImageForItem === displayItem.id && "opacity-50"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (displayItem.thumbnailUrl || displayItem.images?.[0]) {
                                        setImageEditorModal({
                                          open: true,
                                          imageUrl: displayItem.thumbnailUrl || displayItem.images?.[0],
                                          imageTitle: `${displayItem.sectionName}: ${displayItem.name}`,
                                          itemId: displayItem.id
                                        })
                                      } else {
                                        // Trigger file upload
                                        setPendingUploadItemId(displayItem.id)
                                        imageUploadInputRef.current?.click()
                                      }
                                    }}
                                  >
                                    {uploadingImageForItem === displayItem.id ? (
                                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                    ) : displayItem.thumbnailUrl || displayItem.images?.[0] ? (
                                      <img
                                        src={displayItem.thumbnailUrl || displayItem.images?.[0]}
                                        alt={displayItem.name}
                                        className="w-full h-full object-cover"
                                        loading="eager"
                                        decoding="async"
                                      />
                                    ) : (
                                      <div className="flex flex-col items-center">
                                        <ImageIcon className="w-5 h-5 text-gray-400" />
                                        <span className="text-[8px] text-gray-400 mt-0.5">Add</span>
                                      </div>
                                    )}
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent side="right" align="start" className="w-72 p-3">
                                  <div className="space-y-2">
                                    <div className="flex gap-3">
                                      {(displayItem.thumbnailUrl || displayItem.images?.[0]) && (
                                        <img
                                          src={displayItem.thumbnailUrl || displayItem.images?.[0]}
                                          alt={displayItem.name}
                                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                          loading="eager"
                                          decoding="async"
                                        />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm text-gray-900 truncate">{displayItem.name}</p>
                                        {displayItem.brand && <p className="text-xs text-gray-500">{displayItem.brand}</p>}
                                        {displayItem.modelNumber && <p className="text-xs text-gray-400">{displayItem.modelNumber}</p>}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t pt-2">
                                      {displayItem.color && (
                                        <div><span className="text-gray-400">Color:</span> <span className="text-gray-700">{displayItem.color}</span></div>
                                      )}
                                      {displayItem.finish && (
                                        <div><span className="text-gray-400">Finish:</span> <span className="text-gray-700">{displayItem.finish}</span></div>
                                      )}
                                      {displayItem.material && (
                                        <div><span className="text-gray-400">Material:</span> <span className="text-gray-700">{displayItem.material}</span></div>
                                      )}
                                      {(displayItem.width || displayItem.height || displayItem.depth || displayItem.length) && (
                                        <div>
                                          <span className="text-gray-400">Dims:</span>{' '}
                                          <span className="text-gray-700">
                                            {[displayItem.width, displayItem.length, displayItem.height, displayItem.depth].filter(Boolean).join(' × ')}
                                          </span>
                                        </div>
                                      )}
                                      {displayItem.quantity && (
                                        <div><span className="text-gray-400">Qty:</span> <span className="text-gray-700">{displayItem.quantity} {displayItem.unitType || 'units'}</span></div>
                                      )}
                                      {displayItem.leadTime && (
                                        <div><span className="text-gray-400">Lead Time:</span> <span className="text-gray-700 font-medium">{formatLeadTime(displayItem.leadTime)}</span></div>
                                      )}
                                      {(displayItem.supplierName || displayItem.supplierId) && (
                                        (() => {
                                          const phonebookSupplier = displayItem.supplierId
                                            ? suppliers.find(s => s.id === displayItem.supplierId)
                                            : suppliers.find(s => s.name === displayItem.supplierName?.split(' / ')[0])
                                          const businessName = phonebookSupplier?.name || displayItem.supplierName?.split(' / ')[0] || ''
                                          const contactName = phonebookSupplier?.contactName || (displayItem.supplierName?.includes(' / ') ? displayItem.supplierName.split(' / ').slice(1).join(' / ') : null)
                                          return (
                                            <div className="col-span-2">
                                              <span className="text-gray-400">Supplier:</span>{' '}
                                              <span className="text-gray-700">{businessName}</span>
                                              {contactName && <span className="text-gray-500 text-[10px] ml-1">({contactName})</span>}
                                            </div>
                                          )
                                        })()
                                      )}
                                      {(displayItem.tradePrice || displayItem.rrp) && (
                                        <div className="col-span-2 pt-1 border-t mt-1">
                                          {displayItem.tradePrice && <span className="text-gray-700 font-medium">${displayItem.tradePrice.toFixed(2)} trade</span>}
                                          {displayItem.tradePrice && displayItem.rrp && <span className="text-gray-300 mx-1">|</span>}
                                          {displayItem.rrp && <span className="text-gray-500">${displayItem.rrp.toFixed(2)} RRP</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </div>
                            
                            {/* Title & Room - Fixed width */}
                            <div className="flex-shrink-0 w-32">
                              {editingField?.itemId === displayItem.id && editingField?.field === 'name' ? (
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
                                    onClick={(e) => { e.stopPropagation(); startEditing(displayItem.id, 'name', displayItem.name || '') }}
                                    title={displayItem.name}
                                  >
                                    {displayItem.name}
                                  </p>
                                  {(displayItem.customFields as any)?.flag && (
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
                                              fetchSpecs(true) // Preserve scroll position
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
                                  {/* Grouped item indicator - check both spec's customFields AND linked FFE requirement's grouping info */}
                                  {(() => {
                                    // Get grouping info from FFE requirement (new many-to-many or legacy one-to-one)
                                    const ffeGrouping = displayItem.linkedFfeItems?.[0] || displayItem.ffeGroupingInfo
                                    const specGrouping = displayItem.customFields as any

                                    // Check for parent with children
                                    const hasChildren = ffeGrouping?.hasChildren || specGrouping?.hasChildren
                                    const linkedItems = ffeGrouping?.linkedItems || specGrouping?.linkedItems || []

                                    // Check for child linked to parent
                                    const isGroupedItem = ffeGrouping?.isGroupedItem || specGrouping?.isLinkedItem || specGrouping?.isGroupedItem
                                    const parentName = ffeGrouping?.parentName || specGrouping?.parentName
                                    const parentId = specGrouping?.parentId || displayItem.customFields?.parentId

                                    return (
                                      <>
                                        {/* Parent with children - enhanced to show child details */}
                                        {hasChildren && linkedItems.length > 0 && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-medium hover:bg-violet-200 transition-colors"
                                                title={`Grouped with ${linkedItems.length} item(s)`}
                                              >
                                                <Layers className="w-2.5 h-2.5" />
                                                {linkedItems.length}
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                                              <div className="p-3 border-b bg-violet-50">
                                                <div className="flex items-center gap-2">
                                                  <Layers className="w-4 h-4 text-violet-600" />
                                                  <div>
                                                    <p className="text-xs font-semibold text-violet-800">Grouped Items</p>
                                                    <p className="text-[10px] text-violet-600">{linkedItems.length} items linked to this parent</p>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="p-2 max-h-48 overflow-y-auto">
                                                <div className="space-y-1">
                                                  {linkedItems.map((childName: string, idx: number) => {
                                                    // Try to find this child in the current specs list
                                                    // Search in full specs list, not filteredSpecs (child might be filtered out)
                                                    const childSpec = specs.find(s =>
                                                      s.name === childName &&
                                                      (s.customFields as any)?.parentName === displayItem.name
                                                    )
                                                    return (
                                                      <div
                                                        key={idx}
                                                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          // Open the child item in the detail panel
                                                          if (childSpec) {
                                                            setDetailPanel({
                                                              isOpen: true,
                                                              mode: 'view',
                                                              item: childSpec,
                                                              sectionId: childSpec.sectionId,
                                                              roomId: childSpec.roomId
                                                            })
                                                          }
                                                        }}
                                                      >
                                                        <div className="w-1 h-6 bg-violet-300 rounded-full flex-shrink-0" />
                                                        {/* Doc Code for linked item */}
                                                        {childSpec?.docCode && (
                                                          <span className="text-xs font-mono text-purple-700 font-medium flex-shrink-0">
                                                            {childSpec.docCode}
                                                          </span>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                          <p className="text-xs font-medium text-gray-900 truncate">{childName}</p>
                                                          {childSpec && (
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                              {childSpec.brand && (
                                                                <span className="text-[10px] text-gray-500">{childSpec.brand}</span>
                                                              )}
                                                              {childSpec.specStatus && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                                                  childSpec.specStatus === 'SELECTED' ? 'bg-emerald-100 text-emerald-700' :
                                                                  childSpec.specStatus === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                                                                  'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                  {childSpec.specStatus}
                                                                </span>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                        {childSpec?.thumbnailUrl && (
                                                          <img
                                                            src={childSpec.thumbnailUrl}
                                                            alt={childName}
                                                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                                                          />
                                                        )}
                                                      </div>
                                                    )
                                                  })}
                                                </div>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                        {/* Child linked to parent - enhanced popover with details */}
                                        {isGroupedItem && parentName && (() => {
                                          // Find the parent item to enable navigation
                                          // Search in full specs list, not filteredSpecs (parent might be filtered out)
                                          const parentSpec = parentId ? specs.find(s => s.id === parentId) : null
                                          return (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  // Navigate to parent item in detail panel
                                                  if (parentSpec) {
                                                    setDetailPanel({
                                                      isOpen: true,
                                                      mode: 'view',
                                                      item: parentSpec,
                                                      sectionId: parentSpec.sectionId,
                                                      roomId: parentSpec.roomId
                                                    })
                                                  }
                                                }}
                                                className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-violet-100 text-violet-600 rounded hover:bg-violet-200 transition-colors"
                                                title={`Linked to: ${parentName}`}
                                              >
                                                <LinkIcon className="w-3 h-3" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                                              <div className="p-3 border-b bg-violet-50">
                                                <div className="flex items-center gap-2">
                                                  <Layers className="w-4 h-4 text-violet-600" />
                                                  <p className="text-xs font-semibold text-violet-800">Grouped with Parent Item</p>
                                                </div>
                                              </div>
                                              <div className="p-3 space-y-3">
                                                {/* Parent item info */}
                                                <div>
                                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Parent Item</p>
                                                  <p className="text-sm font-medium text-gray-900">{parentName}</p>
                                                  {displayItem.linkedFfeItems?.[0]?.sectionName && (
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                      Section: {displayItem.linkedFfeItems[0].sectionName}
                                                    </p>
                                                  )}
                                                </div>
                                                {/* Navigate to parent item */}
                                                <div className="flex items-center gap-2">
                                                  {parentSpec && (
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 text-xs flex-1"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        // Open parent in detail panel
                                                        setDetailPanel({
                                                          isOpen: true,
                                                          mode: 'view',
                                                          item: parentSpec,
                                                          sectionId: parentSpec.sectionId,
                                                          roomId: parentSpec.roomId
                                                        })
                                                      }}
                                                    >
                                                      <Eye className="w-3 h-3 mr-1" />
                                                      View Parent
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs text-violet-600 border-violet-200 hover:bg-violet-50"
                                                    onClick={async (e) => {
                                                      e.stopPropagation()
                                                      if (!displayItem.roomId) return
                                                      // Call ungroup API
                                                      try {
                                                        const response = await fetch(`/api/ffe/v2/rooms/${displayItem.roomId}/items/${displayItem.id}/ungroup`, {
                                                          method: 'PATCH',
                                                          headers: { 'Content-Type': 'application/json' }
                                                        })
                                                        if (response.ok) {
                                                          toast.success(`"${displayItem.name}" ungrouped successfully`)
                                                          fetchSpecs()
                                                        } else {
                                                          toast.error('Failed to ungroup item')
                                                        }
                                                      } catch {
                                                        toast.error('Failed to ungroup item')
                                                      }
                                                    }}
                                                  >
                                                    <X className="w-3 h-3 mr-1" />
                                                    Ungroup
                                                  </Button>
                                                </div>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                          )
                                        })()}
                                      </>
                                    )
                                  })()}
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
                            
                            {/* Doc Code - Fixed width, prefix-aware editing */}
                            <div className="flex-shrink-0 w-20 h-9">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Doc Code</p>
                              {editingField?.itemId === item.id && editingField?.field === 'docCode' ? (
                                (() => {
                                  // Check if doc code has prefix format (e.g., "PL-01")
                                  const prefixMatch = (item.docCode || '').match(/^([A-Z]{1,3})-(\d+)$/)
                                  if (prefixMatch) {
                                    // Prefix mode: show prefix static, edit number only
                                    const prefix = prefixMatch[1]
                                    return (
                                      <div className="flex items-center h-6">
                                        <span className="text-xs text-gray-500 font-mono mr-0.5">{prefix}-</span>
                                        <Input
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                          onBlur={() => {
                                            // Reconstruct full doc code before saving
                                            const num = editValue.padStart(2, '0')
                                            setEditValue(`${prefix}-${num}`)
                                            setTimeout(saveInlineEdit, 0)
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const num = editValue.padStart(2, '0')
                                              setEditValue(`${prefix}-${num}`)
                                              setTimeout(saveInlineEdit, 0)
                                            } else if (e.key === 'Escape') {
                                              cancelEditing()
                                            }
                                          }}
                                          className="h-6 text-xs w-10 font-mono px-1"
                                          autoFocus
                                          placeholder="01"
                                        />
                                      </div>
                                    )
                                  }
                                  // No prefix: allow full editing
                                  return (
                                    <Input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={saveInlineEdit}
                                      onKeyDown={handleEditKeyDown}
                                      className="h-6 text-xs"
                                      autoFocus
                                    />
                                  )
                                })()
                              ) : (
                                <p
                                  className={cn(
                                    "text-xs truncate cursor-text rounded px-1 -mx-1",
                                    item.docCode
                                      ? "text-gray-900 hover:bg-gray-100"
                                      : "text-red-500 bg-red-50 hover:bg-red-100 font-medium"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // If prefix format, start editing with just the number
                                    const prefixMatch = (item.docCode || '').match(/^([A-Z]{1,3})-(\d+)$/)
                                    if (prefixMatch) {
                                      startEditing(item.id, 'docCode', prefixMatch[2])
                                    } else {
                                      startEditing(item.id, 'docCode', item.docCode || '')
                                    }
                                  }}
                                  title={item.docCode || 'Click to add doc code'}
                                >
                                  {item.docCode || 'Add'}
                                </p>
                              )}
                            </div>

                            {/* Model - Fixed width for longer model numbers */}
                            <div className="flex-shrink-0 w-20 h-9">
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
                            <div className="flex-shrink-0 w-28 h-9">
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
                                  title={item.brand || undefined}
                                >
                                  {item.brand || '-'}
                                </p>
                              )}
                            </div>

                            {/* Width (IN) */}
                            <div className="flex-shrink-0 w-12 h-9 text-center">
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
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'width', item.width || '') }}
                                  title={item.width || undefined}
                                >
                                  {formatDimension(item.width)}
                                </p>
                              )}
                            </div>

                            {/* Length (IN) */}
                            <div className="flex-shrink-0 w-12 h-9 text-center">
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
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'length', item.length || '') }}
                                  title={item.length || undefined}
                                >
                                  {formatDimension(item.length)}
                                </p>
                              )}
                            </div>

                            {/* Height (IN) */}
                            <div className="flex-shrink-0 w-12 h-9 text-center">
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
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'height', item.height || '') }}
                                  title={item.height || undefined}
                                >
                                  {formatDimension(item.height)}
                                </p>
                              )}
                            </div>

                            {/* Depth (IN) */}
                            <div className="flex-shrink-0 w-12 h-9 text-center">
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
                                  className="text-xs text-gray-700 truncate cursor-text hover:bg-gray-100 rounded px-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'depth', item.depth || '') }}
                                  title={item.depth || undefined}
                                >
                                  {formatDimension(item.depth)}
                                </p>
                              )}
                            </div>

                            {/* Colour */}
                            <div className="flex-shrink-0 w-20 h-9">
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
                                  title={item.color || undefined}
                                >
                                  {item.color || '-'}
                                </p>
                              )}
                            </div>

                            {/* Finish */}
                            <div className="flex-shrink-0 w-20 h-9">
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
                                  title={item.finish || undefined}
                                >
                                  {item.finish || '-'}
                                </p>
                              )}
                            </div>

                            {/* Material - Fixed width */}
                            <div className="flex-shrink-0 w-20 h-9">
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
                                  title={item.material || undefined}
                                >
                                  {item.material || '-'}
                                </p>
                              )}
                            </div>

                            {/* QTY - Fixed width */}
                            <div className="flex-shrink-0 w-14 h-9 text-center">
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
                            <div className="flex-shrink-0 w-14 h-9" onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex-shrink-0 w-24 h-9 mr-3" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Lead Time</p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="w-full text-left text-xs text-gray-700 cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.leadTime ? (
                                      formatLeadTime(item.leadTime)
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
                                          const valueToSave = opt.value === 'none' ? null : opt.value
                                          const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ leadTime: valueToSave })
                                          })
                                          if (res.ok) {
                                            setSpecs(prev => prev.map(s => s.id === item.id ? { ...s, leadTime: valueToSave } : s))
                                          }
                                        } catch (error) {
                                          console.error('Error updating lead time:', error)
                                        }
                                      }}
                                      className={(!item.leadTime && opt.value === 'none') || item.leadTime === opt.value ? 'bg-gray-100' : ''}
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
                                {(() => {
                                  // Look up supplier to get their currency setting
                                  const itemSupplier = item.supplierId ? suppliers.find(s => s.id === item.supplierId) : null
                                  // Use supplier's currency if linked, otherwise fall back to item's stored currency
                                  const effectiveTradeCurrency = itemSupplier?.currency || item.tradePriceCurrency || 'CAD'
                                  const effectiveRrpCurrency = itemSupplier?.currency || item.rrpCurrency || 'CAD'
                                  const isUsdTrade = effectiveTradeCurrency === 'USD'
                                  const isUsdRrp = effectiveRrpCurrency === 'USD'

                                  return (
                                    <>
                                      {/* Trade Price */}
                                      <div className="flex-shrink-0 w-24 h-9 text-right">
                                        <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                                          Trade {isUsdTrade && <span className="text-blue-500">(USD)</span>}
                                        </p>
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
                                            className={`text-xs cursor-text hover:bg-gray-100 rounded px-1 ${isUsdTrade ? 'text-blue-600' : 'text-gray-900'}`}
                                            onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'tradePrice', item.tradePrice?.toString() || '') }}
                                          >
                                            {item.tradePrice ? formatCurrency(item.tradePrice) : '-'}
                                          </p>
                                        )}
                                      </div>

                                      {/* Markup % */}
                                      <div className="flex-shrink-0 w-16 h-9 text-right">
                                        <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Markup</p>
                                        {editingField?.itemId === item.id && editingField?.field === 'markupPercent' ? (
                                          <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={saveInlineEdit}
                                            onKeyDown={handleEditKeyDown}
                                            className="h-6 text-xs text-right"
                                            autoFocus
                                            type="number"
                                            step="1"
                                            placeholder="%"
                                          />
                                        ) : (
                                          <p
                                            className={`text-xs cursor-text hover:bg-gray-100 rounded px-1 ${item.markupPercent ? 'text-gray-900' : 'text-gray-400'}`}
                                            onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'markupPercent', item.markupPercent?.toString() || '') }}
                                            title={item.tradePrice ? 'Enter markup % to auto-calculate RRP' : 'Add trade price first'}
                                          >
                                            {item.markupPercent ? `${item.markupPercent}%` : '-'}
                                          </p>
                                        )}
                                      </div>

                                      {/* RRP */}
                                      <div className="flex-shrink-0 w-20 h-9 text-right">
                                        <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                                          RRP {isUsdRrp && <span className="text-blue-500">(USD)</span>}
                                        </p>
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
                                            className={`text-xs cursor-text hover:bg-gray-100 rounded px-1 ${isUsdRrp ? 'text-blue-600' : 'text-gray-900'}`}
                                            onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'rrp', item.rrp?.toString() || '') }}
                                          >
                                            {item.rrp ? formatCurrency(item.rrp) : '-'}
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  )
                                })()}
                              </>
                            )}
                            
                            {/* Supplier - Flexible to fill space, allows 2 lines */}
                            <div className="flex-1 min-w-[100px] h-9 relative" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Supplier</p>
                              <DropdownMenu open={supplierPickerItem === item.id} onOpenChange={(open) => setSupplierPickerItem(open ? item.id : null)}>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="w-full text-left cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                    title={item.supplierName || undefined}
                                  >
                                    {item.supplierName || item.supplierId ? (
                                      (() => {
                                        // First try to look up supplier from phonebook for full info
                                        const phonebookSupplier = item.supplierId
                                          ? suppliers.find(s => s.id === item.supplierId)
                                          : suppliers.find(s => s.name === item.supplierName?.split(' / ')[0])

                                        let businessName = ''
                                        let contactName: string | null = null

                                        if (phonebookSupplier) {
                                          // Use phonebook data for consistent display
                                          businessName = phonebookSupplier.name
                                          contactName = phonebookSupplier.contactName || null
                                        } else if (item.supplierName) {
                                          // Fall back to parsing supplierName field
                                          const parts = item.supplierName.split(' / ')
                                          businessName = parts[0]
                                          contactName = parts.length > 1 ? parts.slice(1).join(' / ') : null
                                        }

                                        return (
                                          <div className="leading-tight">
                                            <span className="text-xs text-gray-700 truncate block">{businessName}</span>
                                            {contactName && (
                                              <span className="text-[10px] text-gray-400 truncate block">{contactName}</span>
                                            )}
                                          </div>
                                        )
                                      })()
                                    ) : (
                                      <span className="text-xs text-gray-400">Select Supplier</span>
                                    )}
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
                                {/* Client Approved Checkbox - Fixed width */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleClientApproval(item.id, item.clientApproved)
                                  }}
                                  className={cn(
                                    "flex items-center justify-center gap-1.5 px-2 py-1 rounded border text-xs transition-all w-[90px]",
                                    item.clientApproved
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                                  )}
                                  title={item.clientApproved ? "Client has approved this item" : "Click to mark as client approved"}
                                >
                                  {item.clientApproved ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                  )}
                                  <span className="hidden sm:inline">{item.clientApproved ? 'Approved' : 'Approve'}</span>
                                </button>

                                {/* Status Dropdown - Fixed width */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 bg-white text-xs transition-colors whitespace-nowrap w-[130px]"
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
                                    {/* Request Quote from Supplier - Quick Quote */}
                                    <DropdownMenuItem
                                      className={cn("text-xs", item.hasQuoteSent && "text-amber-600")}
                                      onSelect={() => {
                                        setQuickQuoteItems([item.id])
                                        setQuickQuoteDialogOpen(true)
                                      }}
                                    >
                                      {item.hasQuoteSent ? (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                          Resend Quote Request
                                        </>
                                      ) : (
                                        <>
                                          <FileText className="w-3.5 h-3.5 mr-2" />
                                          Request Supplier Quote
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    
                                    {/* Client Invoice (same as top button but for single item) */}
                                    <DropdownMenuItem
                                      className="text-xs text-green-700"
                                      onSelect={() => {
                                        setClientQuotePreselectedItems([item.id])
                                        setClientQuoteDialogOpen(true)
                                      }}
                                    >
                                      <DollarSign className="w-3.5 h-3.5 mr-2" />
                                      Client Invoice
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
                                    className="text-xs text-orange-600"
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      handleArchiveItem(item)
                                    }}
                                  >
                                    <Archive className="w-3.5 h-3.5 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-xs"
                                    onSelect={() => handleAddToLibrary(item)}
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
                        </div>
                          )}
                        </SortableSpecItem>
                        )
                      })}
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
                      <Label className="text-xs text-gray-500">Length</Label>
                      <Input
                        value={urlGenerateData.length || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, length: e.target.value }))}
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
                    <div>
                      <Label className="text-xs text-gray-500">Color</Label>
                      <Input
                        value={urlGenerateData.colour || urlGenerateData.color || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, colour: e.target.value, color: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Finish</Label>
                      <Input
                        value={urlGenerateData.finish || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, finish: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-500">Description</Label>
                      <Input
                        value={urlGenerateData.productDescription || ''}
                        onChange={(e) => setUrlGenerateData((prev: any) => ({ ...prev, productDescription: e.target.value }))}
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
                    {urlGenerateData.productDescription && (
                      <p className="text-sm text-gray-500 line-clamp-2">{urlGenerateData.productDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {urlGenerateData.sku && <span>SKU: {urlGenerateData.sku}</span>}
                      {urlGenerateData.rrp && <span>RRP: {urlGenerateData.rrp}</span>}
                      {urlGenerateData.tradePrice && <span>Trade: {urlGenerateData.tradePrice}</span>}
                      {urlGenerateData.leadTime && <span>Lead Time: {urlGenerateData.leadTime}</span>}
                    </div>
                    {(urlGenerateData.width || urlGenerateData.height || urlGenerateData.depth || urlGenerateData.length) && (
                      <p className="text-xs text-gray-500">
                        Dimensions: {[
                          urlGenerateData.width && `W: ${urlGenerateData.width}`,
                          urlGenerateData.height && `H: ${urlGenerateData.height}`,
                          urlGenerateData.depth && `D: ${urlGenerateData.depth}`,
                          urlGenerateData.length && `L: ${urlGenerateData.length}`
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {(urlGenerateData.material || urlGenerateData.colour || urlGenerateData.color || urlGenerateData.finish) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {urlGenerateData.material && <span>Material: {urlGenerateData.material}</span>}
                        {(urlGenerateData.colour || urlGenerateData.color) && <span>Color: {urlGenerateData.colour || urlGenerateData.color}</span>}
                        {urlGenerateData.finish && <span>Finish: {urlGenerateData.finish}</span>}
                      </div>
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
                  <div className="space-y-3">
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
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
                      <Label className="text-xs text-gray-500">Length</Label>
                      <Input
                        value={extractedData.length || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, length: e.target.value })}
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
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-500">Description</Label>
                      <Input
                        value={extractedData.productDescription || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, productDescription: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">{extractedData.productName || 'Untitled Product'}</p>
                    {extractedData.brand && (
                      <p className="text-sm text-gray-600">Brand: {extractedData.brand}</p>
                    )}
                    {extractedData.productDescription && (
                      <p className="text-sm text-gray-500 line-clamp-2">{extractedData.productDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {extractedData.sku && <span>SKU: {extractedData.sku}</span>}
                      {extractedData.rrp && <span>RRP: {extractedData.rrp}</span>}
                      {extractedData.tradePrice && <span>Trade: {extractedData.tradePrice}</span>}
                      {extractedData.leadTime && <span>Lead Time: {extractedData.leadTime}</span>}
                    </div>
                    {(extractedData.width || extractedData.height || extractedData.depth || extractedData.length) && (
                      <p className="text-xs text-gray-500">
                        Dimensions: {[
                          extractedData.width && `W: ${extractedData.width}`,
                          extractedData.height && `H: ${extractedData.height}`,
                          extractedData.depth && `D: ${extractedData.depth}`,
                          extractedData.length && `L: ${extractedData.length}`
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {(extractedData.material || extractedData.colour || extractedData.finish) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {extractedData.material && <span>Material: {extractedData.material}</span>}
                        {extractedData.colour && <span>Color: {extractedData.colour}</span>}
                        {extractedData.finish && <span>Finish: {extractedData.finish}</span>}
                      </div>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-500">Supplier</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddFromUrlShowSupplier(false)
                          setAddFromUrlSelectedSupplier(null)
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
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
                      <Select
                        onValueChange={(supplierId) => {
                          const supplier = suppliers.find(s => s.id === supplierId)
                          if (supplier) {
                            setAddFromUrlSelectedSupplier({
                              id: supplier.id,
                              name: supplier.name,
                              website: supplier.website || ''
                            })
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Choose from phonebook..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.length === 0 ? (
                            <div className="text-center p-4 text-sm text-gray-500">
                              No suppliers in phonebook
                            </div>
                          ) : (
                            suppliers.map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div className="flex items-center gap-2">
                                  {supplier.logo ? (
                                    <img src={supplier.logo} alt={supplier.name} className="w-5 h-5 rounded object-cover" />
                                  ) : (
                                    <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                      {supplier.name.charAt(0)}
                                    </div>
                                  )}
                                  <span>{supplier.name}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
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
                if (!extractedData) {
                  toast.error('Please extract product data from URL first')
                  return
                }
                if (!addFromUrlModal.sectionId || !addFromUrlModal.roomId) {
                  toast.error('Section or room not found. Please close and try again.')
                  return
                }
                // Pass supplier info if selected - supplierLink = product URL (not supplier website)
                const dataWithSupplier = {
                  ...extractedData,
                  supplierName: addFromUrlSelectedSupplier?.name || '',
                  supplierLink: extractedData.productWebsite || ''
                }
                handleAddItem(addFromUrlModal.sectionId, addFromUrlModal.roomId, dataWithSupplier)
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

      {/* Bulk Move to Section Modal */}
      <Dialog open={bulkMoveModal} onOpenChange={setBulkMoveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Move {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''} to Section
            </DialogTitle>
            <DialogDescription>
              Select a section to move the selected items to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select value={bulkMoveTargetSection} onValueChange={setBulkMoveTargetSection}>
              <SelectTrigger>
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.flatMap(room =>
                  room.sections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {room.name} - {section.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkMoveModal(false); setBulkMoveTargetSection('') }}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={!bulkMoveTargetSection || bulkMoving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bulkMoving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Move Items
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
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-gray-700" />
              Share Schedule
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="space-y-4">
                {/* Create New Link Button */}
                <Button
                  onClick={() => {
                    setEditingShareLink(null)
                    setCreateShareLinkOpen(true)
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Share Link
                </Button>

                {/* Share Links List */}
                {loadingShareLinks ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : shareLinks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <LinkIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No share links yet</p>
                    <p className="text-xs mt-1">Create a link to share specific items</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shareLinks.map((link) => (
                      <div
                        key={link.id}
                        className={cn(
                          "border rounded-lg p-3",
                          link.isExpired ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {link.name || 'Untitled Link'}
                              </span>
                              {link.isExpired && (
                                <Badge variant="secondary" className="text-xs bg-red-50 text-red-600">
                                  Expired
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {link.allowApproval && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded">
                                  Approval
                                </span>
                              )}
                              {link.showPricing && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded">
                                  Pricing
                                </span>
                              )}
                              {link.showSpecSheets && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 rounded">
                                  Spec Sheets
                                </span>
                              )}
                              {link.showSupplier && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                                  Supplier
                                </span>
                              )}
                            </div>
                            {link.expiresAt && !link.isExpired && (
                              <p className="text-xs text-gray-400 mt-1">
                                Expires {new Date(link.expiresAt).toLocaleDateString()}
                              </p>
                            )}
                            {link.accessCount > 0 && (
                              <p className="text-xs text-gray-400 mt-1">
                                Viewed {link.accessCount} time{link.accessCount !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => copyShareLinkUrl(link.shareUrl)}
                              title="Copy link"
                            >
                              <ClipboardCopy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => window.open(link.shareUrl, '_blank')}
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setEditingShareLink(link)
                                  setCreateShareLinkOpen(true)
                                }}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteShareLink(link.id)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Share Link Dialog */}
      <CreateSpecShareLinkDialog
        open={createShareLinkOpen}
        onOpenChange={setCreateShareLinkOpen}
        projectId={project.id}
        items={specs.map(item => ({
          id: item.id,
          name: item.name,
          roomName: item.roomName || 'Room',
          categoryName: item.categoryName || 'General',
          thumbnailUrl: item.thumbnailUrl
        }))}
        onLinkCreated={loadShareLinks}
        editingLink={editingShareLink}
      />
      
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
          fetchSpecs(true) // Preserve scroll position after save
          loadFfeItems() // Refresh FFE items to update chosen status
          // Close panel after save to ensure fresh data on next open
          setDetailPanel({ isOpen: false, mode: 'view', item: null })
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
      <Dialog open={addSupplierModal.open} onOpenChange={(open) => {
        if (open) {
          loadSupplierCategories()
        } else {
          setAddSupplierModal({ open: false, forItemId: null })
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-indigo-600" />
              </div>
              Add New Supplier
            </DialogTitle>
            <DialogDescription>
              Add a new supplier to your phonebook. They'll be available to select for all your projects.
            </DialogDescription>
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
              <Label htmlFor="supplier-name">Business Name <span className="text-red-500">*</span></Label>
              <Input
                id="supplier-name"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Contact Name <span className="text-red-500">*</span></Label>
              <Input
                id="supplier-contact"
                value={newSupplier.contactName}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                placeholder="Contact person"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email <span className="text-red-500">*</span></Label>
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
                value={newSupplier.logo}
                onChange={(e) => setNewSupplier({ ...newSupplier, logo: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              {newSupplier.logo && (
                <div className="flex items-center gap-2 mt-2">
                  <img 
                    src={newSupplier.logo} 
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
              setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logo: '', categoryId: '', currency: 'CAD' })
            }}>
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

      {/* Quick Quote Dialog - Simplified flow with preview */}
      <QuickQuoteDialog
        open={quickQuoteDialogOpen}
        onOpenChange={(open) => {
          setQuickQuoteDialogOpen(open)
          if (!open) {
            setQuickQuoteItems([])
          }
        }}
        onSuccess={() => {
          setQuickQuoteDialogOpen(false)
          setQuickQuoteItems([])
          setSelectedItems(new Set()) // Clear selection after sending
          fetchSpecs(true) // Refresh to show updated status
        }}
        projectId={project.id}
        itemIds={quickQuoteItems}
      />

      {/* RFQ Dialog for Bulk Quotes (legacy, used from Procurement) */}
      <CreateRFQDialog
        open={rfqDialogOpen}
        onOpenChange={(open) => {
          setRfqDialogOpen(open)
          if (!open) {
            setRfqPreselectedItems([])
          }
        }}
        onSuccess={() => {
          setRfqDialogOpen(false)
          setRfqPreselectedItems([])
          setSelectedItems(new Set()) // Clear selection after creating RFQ
          toast.success('RFQ created! Go to Procurement to send it.')
        }}
        projectId={project.id}
        preselectedItemIds={rfqPreselectedItems}
      />

      {/* Client Quote Dialog - Create invoice with markup to send to client */}
      <CreateClientQuoteDialog
        open={clientQuoteDialogOpen}
        onOpenChange={(open) => {
          setClientQuoteDialogOpen(open)
          if (!open) {
            setClientQuotePreselectedItems([])
          }
        }}
        onSuccess={(quoteId) => {
          setClientQuoteDialogOpen(false)
          setClientQuotePreselectedItems([])
          setSelectedItems(new Set()) // Clear selection after creating quote
          toast.success(
            <div className="flex flex-col gap-1">
              <span>Client quote created!</span>
              <a 
                href={`/procurement/quote/${quoteId}`}
                className="text-green-600 hover:underline text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                View & send to client →
              </a>
            </div>,
            { duration: 5000 }
          )
        }}
        projectId={project.id}
        preselectedItemIds={clientQuotePreselectedItems}
      />

      {/* Budget Approval Dialog - Send budget to client for approval */}
      <BudgetApprovalDialog
        open={budgetApprovalDialogOpen}
        onOpenChange={(open) => {
          setBudgetApprovalDialogOpen(open)
        }}
        projectId={project.id}
        projectName={project.name}
        selectedItemIds={Array.from(selectedItems)}
        specs={specs}
        onSuccess={() => {
          setBudgetApprovalDialogOpen(false)
          setSelectedItems(new Set()) // Clear selection
          fetchSpecs() // Refresh specs
        }}
      />

      {/* Send to Client Dialog - Send quote with payment link */}
      <SendToClientDialog
        open={sendToClientDialogOpen}
        onOpenChange={(open) => {
          setSendToClientDialogOpen(open)
          if (!open) {
            setSendToClientItems([])
          }
        }}
        onSuccess={(quoteId) => {
          setSendToClientDialogOpen(false)
          setSendToClientItems([])
          setSelectedItems(new Set())
        }}
        projectId={project.id}
        itemIds={sendToClientItems}
      />

      {/* PDF Export Dialog */}
      <SpecPDFExportDialog
        open={pdfExportDialogOpen}
        onOpenChange={setPdfExportDialogOpen}
        projectId={project.id}
        projectName={project.name}
        items={specs}
        selectedItemIds={selectedItems}
      />

      {/* Programa Import Dialog */}
      <Dialog
        open={programaModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setProgramaModal({ open: false, sectionId: null, roomId: null, ffeItemId: null, ffeItemName: null })
            setProgramaSearch('')
            setProgramaCategoryFilter('all')
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Link Programa Item
            </DialogTitle>
            <DialogDescription>
              Linking to: <span className="font-medium text-gray-900">{programaModal.ffeItemName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={programaSearch}
                  onChange={(e) => setProgramaSearch(e.target.value)}
                  placeholder="Search Programa items..."
                  className="pl-9"
                />
              </div>
              <Select value={programaCategoryFilter} onValueChange={setProgramaCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {programaCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items List */}
            <div className="overflow-y-auto max-h-[50vh]" style={{ minHeight: '300px' }}>
              {programaLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : programaItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No Programa items imported yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Go to Settings → Programa Import to upload items
                  </p>
                </div>
              ) : (() => {
                // Filter items
                const filtered = programaItems.filter(item => {
                  const matchesSearch = !programaSearch ||
                    item.name.toLowerCase().includes(programaSearch.toLowerCase()) ||
                    item.description?.toLowerCase().includes(programaSearch.toLowerCase()) ||
                    item.brand?.toLowerCase().includes(programaSearch.toLowerCase())
                  const matchesCategory = programaCategoryFilter === 'all' || item.category === programaCategoryFilter
                  // Only show unlinked items
                  const isUnlinked = !item.linkedRoomFFEItemId
                  return matchesSearch && matchesCategory && isUnlinked
                })

                // Group by category
                const grouped = filtered.reduce((acc, item) => {
                  if (!acc[item.category]) acc[item.category] = []
                  acc[item.category].push(item)
                  return acc
                }, {} as Record<string, any[]>)

                if (Object.keys(grouped).length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No unlinked items found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        All items may already be linked
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4 pr-4">
                    {Object.entries(grouped).map(([category, items]) => {
                      const isExpanded = programaExpandedCategories.has(category)
                      return (
                        <div key={category} className="border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            onClick={() => {
                              setProgramaExpandedCategories(prev => {
                                const next = new Set(prev)
                                if (next.has(category)) {
                                  next.delete(category)
                                } else {
                                  next.add(category)
                                }
                                return next
                              })
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="font-medium text-gray-900">{category}</span>
                              <Badge variant="secondary">{items.length} items</Badge>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="divide-y divide-gray-100">
                              {items.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                  onClick={() => linkProgramaItem(item.id)}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Item Image */}
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-12 h-12 object-cover rounded border flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center flex-shrink-0">
                                        <Package className="w-5 h-5 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                      <div className="flex items-center gap-3 text-sm text-gray-500">
                                        {item.brand && <span>{item.brand}</span>}
                                        {item.sku && <span>SKU: {item.sku}</span>}
                                        {item.color && <span>Color: {item.color}</span>}
                                      </div>
                                      {item.supplierCompanyName && (
                                        <p className="text-xs text-gray-400 mt-1">
                                          Supplier: {item.supplierCompanyName}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    {item.tradePrice && (
                                      <span className="text-sm font-medium text-gray-700">
                                        ${item.tradePrice.toFixed(2)}
                                      </span>
                                    )}
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                      disabled={linkingProgramaItem === item.id}
                                    >
                                      {linkingProgramaItem === item.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Link2 className="w-4 h-4 mr-1" />
                                          Link
                                        </>
                                      )}
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
                )
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProgramaModal({ open: false, sectionId: null, roomId: null, ffeItemId: null, ffeItemName: null })
                setProgramaSearch('')
                setProgramaCategoryFilter('all')
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

