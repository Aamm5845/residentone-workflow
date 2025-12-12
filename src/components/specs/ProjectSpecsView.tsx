'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  PackageCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ItemDetailPanel } from './ItemDetailPanel'

// Item status options based on the screenshot
const ITEM_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', icon: Circle, color: 'text-gray-400' },
  { value: 'HIDDEN', label: 'Hidden', icon: Circle, color: 'text-gray-400' },
  { value: 'SELECTED', label: 'Selected', icon: Circle, color: 'text-gray-400' },
  { value: 'QUOTING', label: 'Quoting', icon: Circle, color: 'text-gray-400' },
  { value: 'INTERNAL_REVIEW', label: 'Internal Review', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'CLIENT_REVIEW', label: 'Client Review', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'RESUBMIT', label: 'Resubmit', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'CLOSED', label: 'Closed', icon: Ban, color: 'text-red-500' },
  { value: 'REJECTED', label: 'Rejected', icon: Ban, color: 'text-red-500' },
  { value: 'APPROVED', label: 'Approved', icon: CheckCircle2, color: 'text-green-500' },
  { value: 'ORDERED', label: 'Ordered', icon: Clock, color: 'text-blue-500' },
  { value: 'PAYMENT_DUE', label: 'Payment Due', icon: CreditCard, color: 'text-blue-500' },
  { value: 'IN_PRODUCTION', label: 'In Production', icon: Factory, color: 'text-blue-500' },
  { value: 'IN_TRANSIT', label: 'In Transit', icon: Truck, color: 'text-blue-500' },
  { value: 'INSTALLED', label: 'Installed', icon: CheckCheck, color: 'text-green-500' },
  { value: 'DELIVERED', label: 'Delivered', icon: PackageCheck, color: 'text-green-500' },
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
  color: string | null
  finish: string | null
  material: string | null
  width: string | null
  height: string | null
  depth: string | null
  length: string | null
  quantity: number
  leadTime: string | null
  supplierName: string | null
  supplierLink: string | null
  state: string
  specStatus: string
  images: string[]
  thumbnailUrl: string | null
  roomId: string
  // Pricing fields
  unitCost: number | null
  totalCost: number | null
  tradePrice: number | null
  rrp: number | null
  tradeDiscount: number | null
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

export default function ProjectSpecsView({ project }: ProjectSpecsViewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'category' | 'room' | 'status'>('category')
  const [activeTab, setActiveTab] = useState<'summary' | 'financial'>('summary')
  const [financials, setFinancials] = useState({ totalTradePrice: 0, totalRRP: 0, avgTradeDiscount: 0 })
  
  // Available rooms/sections for adding new specs
  const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; name: string; sections: Array<{ id: string; name: string }> }>>([])
  
  // Add from URL modal
  const [addFromUrlModal, setAddFromUrlModal] = useState<{ open: boolean; sectionId: string | null; roomId: string | null }>({ open: false, sectionId: null, roomId: null })
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<AddFromUrlData | null>(null)
  
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

  useEffect(() => {
    fetchSpecs()
    loadSuppliers()
  }, [fetchSpecs, loadSuppliers])

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
    const groupedArray = Object.values(groups).map(group => ({
      ...group,
      items: group.items.sort((a, b) => a.name.localeCompare(b.name))
    }))

    setGroupedSpecs(groupedArray.sort((a, b) => a.name.localeCompare(b.name)))
  }, [specs, searchQuery, filterStatus, filterRoom, sortBy])
  
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
      
      // Use AI to extract product info
      const aiRes = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          pageContent: pageData.textContent || pageData.description || '',
          title: pageData.title || '',
          images: pageData.image ? [pageData.image] : []
        })
      })
      
      if (aiRes.ok) {
        const result = await aiRes.json()
        if (result.success && result.data) {
          setExtractedData({
            ...result.data,
            productWebsite: urlInput,
            images: result.data.images?.length ? result.data.images : (pageData.image ? [pageData.image] : [])
          })
          toast.success('Product info extracted!')
        } else {
          // Fallback with basic data
          setExtractedData({
            productName: pageData.title || '',
            brand: '',
            productDescription: pageData.description || '',
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
            images: pageData.image ? [pageData.image] : []
          })
          toast.success('Basic info extracted - AI unavailable')
        }
      } else {
        // If AI fails, still provide basic extraction
        setExtractedData({
          productName: pageData.title || '',
          brand: '',
          productDescription: pageData.description || '',
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
          images: pageData.image ? [pageData.image] : []
        })
        toast.success('Basic info extracted - AI unavailable')
      }
    } catch (error) {
      console.error('Error extracting from URL:', error)
      toast.error('Failed to extract product info')
    } finally {
      setExtracting(false)
    }
  }
  
  // Add item to section
  const handleAddItem = async (sectionId: string, roomId: string, itemData: any) => {
    setSavingItem(true)
    try {
      // Get the FFE instance for the room
      const roomRes = await fetch(`/api/ffe/v2/rooms/${roomId}`)
      const roomData = await roomRes.json()
      
      if (!roomData.success) {
        throw new Error('Failed to load room data')
      }
      
      // Add item to the section - this is an actual spec (not a task)
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
          isSpec: true // This is an actual spec from All Spec view, not a task
        })
      })
      
      if (res.ok) {
        toast.success('Item added successfully')
        fetchSpecs() // Refresh the list
        // Close all modals
        setAddFromUrlModal({ open: false, sectionId: null, roomId: null })
        setLibraryModal({ open: false, sectionId: null, roomId: null })
        setCustomProductModal({ open: false, sectionId: null, roomId: null })
        // Reset forms
        setExtractedData(null)
        setUrlInput('')
        setSelectedLibraryProduct(null)
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
  
  // Save inline edit
  const saveInlineEdit = async () => {
    if (!editingField) return
    
    const item = specs.find(s => s.id === editingField.itemId)
    if (!item) return
    
    try {
      const updateData: Record<string, string> = {}
      updateData[editingField.field] = editValue
      
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${editingField.itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (res.ok) {
        // Update local state
        setSpecs(prev => prev.map(s => 
          s.id === editingField.itemId 
            ? { ...s, [editingField.field]: editValue }
            : s
        ))
        toast.success('Updated')
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
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Needs Spec</Badge>
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
  
  // Calculate section totals
  const getSectionTotals = (items: SpecItem[]) => {
    const tradeTotal = items.reduce((sum, item) => sum + ((item.tradePrice || 0) * (item.quantity || 1)), 0)
    const rrpTotal = items.reduce((sum, item) => sum + ((item.rrp || 0) * (item.quantity || 1)), 0)
    return { tradeTotal, rrpTotal }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
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
              <Button variant="default" size="sm" className="bg-gray-900 hover:bg-gray-800">
                <ExternalLink className="w-4 h-4 mr-1.5" />
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
          
          {/* Tabs Row */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={cn(
                  "pb-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'summary'
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('financial')}
                className={cn(
                  "pb-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'financial'
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Financial
              </button>
              
              {/* Navigate to Section */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 pb-2">
                  Navigate to Section
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {groupedSpecs.map((group) => (
                    <DropdownMenuItem 
                      key={group.name}
                      onClick={() => {
                        const element = document.getElementById(`section-${group.name.replace(/\s+/g, '-')}`)
                        element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                    >
                      {group.name} ({group.items.length})
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
                    (filterStatus !== 'all' || filterRoom !== 'all') ? "text-blue-600" : "text-gray-500"
                  )}>
                    <Filter className="w-4 h-4 mr-1.5" />
                    Filter
                    {(filterStatus !== 'all' || filterRoom !== 'all') && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-blue-100 text-blue-600">
                        {(filterStatus !== 'all' ? 1 : 0) + (filterRoom !== 'all' ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-3">
                  <div className="space-y-4">
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-500">Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-8 text-sm">
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
                      <Label className="text-xs font-medium text-gray-500">Room</Label>
                      <Select value={filterRoom} onValueChange={setFilterRoom}>
                        <SelectTrigger className="h-8 text-sm">
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
                    {(filterStatus !== 'all' || filterRoom !== 'all') && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-8 text-xs text-gray-500"
                        onClick={() => {
                          setFilterStatus('all')
                          setFilterRoom('all')
                        }}
                      >
                        Clear Filters
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

      {/* Content */}
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
                  <div>
                    {/* Items Table */}
                    <div className="divide-y divide-gray-100">
                      {group.items.map((item) => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "group/item relative flex items-center transition-colors border-l-2 cursor-pointer",
                            selectedItems.has(item.id) 
                              ? "bg-blue-50 border-blue-500" 
                              : "hover:bg-gray-50 border-transparent hover:border-blue-400"
                          )}
                          onMouseEnter={() => setHoveredItem(item.id)}
                          onMouseLeave={() => setHoveredItem(null)}
                          onDoubleClick={() => setDetailPanel({
                            isOpen: true,
                            mode: 'view',
                            item: item,
                            sectionId: item.sectionId,
                            roomId: item.roomId
                          })}
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
                            <button className="p-0.5 cursor-grab hover:bg-gray-200 rounded">
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                          
                          {/* Main Item Row - Using flex for better control */}
                          <div className="flex items-center w-full px-4 py-3 pl-14 gap-3 overflow-hidden">
                            {/* Image - Fixed width */}
                            <div className="flex-shrink-0 w-12">
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                {item.thumbnailUrl || item.images?.[0] ? (
                                  <img 
                                    src={item.thumbnailUrl || item.images[0]} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-gray-400" />
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
                                <p 
                                  className="text-sm font-medium text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'name', item.name || '') }}
                                >
                                  {item.name}
                                </p>
                              )}
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 truncate">{item.roomName}</p>
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
                              {editingField?.itemId === item.id && editingField?.field === 'sku' ? (
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
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'sku', item.sku || '') }}
                                >
                                  {item.sku || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Product Name - Flexible */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Product</p>
                              {editingField?.itemId === item.id && editingField?.field === 'productName' ? (
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
                                  onClick={(e) => { e.stopPropagation(); startEditing(item.id, 'productName', item.productName || '') }}
                                >
                                  {item.productName || '-'}
                                </p>
                              )}
                            </div>
                            
                            {/* Brand - Fixed width */}
                            <div className="flex-shrink-0 w-20">
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
                            <div className="flex-shrink-0 flex items-center gap-1.5 ml-auto">
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
                                <DropdownMenuContent align="end" className="w-44">
                                  {ITEM_STATUS_OPTIONS.map((option) => {
                                    const IconComponent = option.icon
                                    return (
                                      <DropdownMenuItem 
                                        key={option.value}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleUpdateItemStatus(item.id, option.value)
                                        }}
                                        className="flex items-center gap-2 text-xs"
                                      >
                                        <IconComponent className={cn("w-3.5 h-3.5", option.color)} />
                                        {option.label}
                                      </DropdownMenuItem>
                                    )
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              {/* 3 Dots Menu */}
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
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    className="text-xs"
                                    onClick={() => setDetailPanel({
                                      isOpen: true,
                                      mode: 'view',
                                      item: item,
                                      sectionId: item.sectionId,
                                      roomId: item.roomId
                                    })}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-xs">
                                    <FileText className="w-3.5 h-3.5 mr-2" />
                                    Generate Quote
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Floating Add Button */}
      {groupedSpecs.length > 0 && groupedSpecs[0]?.sectionId && groupedSpecs[0]?.roomId && (
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
      
      {/* Add from URL Modal */}
      <Dialog open={addFromUrlModal.open} onOpenChange={(open) => !open && setAddFromUrlModal({ open: false, sectionId: null, roomId: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
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
                  className="pl-9"
                  disabled={extracting}
                />
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
              <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Product Info Extracted</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Product Name</Label>
                    <Input
                      value={extractedData.productName}
                      onChange={(e) => setExtractedData({ ...extractedData, productName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Brand</Label>
                    <Input
                      value={extractedData.brand}
                      onChange={(e) => setExtractedData({ ...extractedData, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">SKU</Label>
                    <Input
                      value={extractedData.sku}
                      onChange={(e) => setExtractedData({ ...extractedData, sku: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Price</Label>
                    <Input
                      value={extractedData.rrp}
                      onChange={(e) => setExtractedData({ ...extractedData, rrp: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Material</Label>
                    <Input
                      value={extractedData.material}
                      onChange={(e) => setExtractedData({ ...extractedData, material: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Color</Label>
                    <Input
                      value={extractedData.colour}
                      onChange={(e) => setExtractedData({ ...extractedData, colour: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Finish</Label>
                    <Input
                      value={extractedData.finish}
                      onChange={(e) => setExtractedData({ ...extractedData, finish: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Lead Time</Label>
                    <Input
                      value={extractedData.leadTime}
                      onChange={(e) => setExtractedData({ ...extractedData, leadTime: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-gray-500">Dimensions (W × H × D × L)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        placeholder="Width"
                        value={extractedData.width}
                        onChange={(e) => setExtractedData({ ...extractedData, width: e.target.value })}
                      />
                      <Input
                        placeholder="Height"
                        value={extractedData.height}
                        onChange={(e) => setExtractedData({ ...extractedData, height: e.target.value })}
                      />
                      <Input
                        placeholder="Depth"
                        value={extractedData.depth}
                        onChange={(e) => setExtractedData({ ...extractedData, depth: e.target.value })}
                      />
                      <Input
                        placeholder="Length"
                        value={extractedData.length}
                        onChange={(e) => setExtractedData({ ...extractedData, length: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                
                {extractedData.images && extractedData.images.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Images</Label>
                    <div className="flex gap-2">
                      {extractedData.images.slice(0, 4).map((img, idx) => (
                        <div key={idx} className="w-16 h-16 rounded border overflow-hidden bg-gray-100">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
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
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (extractedData && addFromUrlModal.sectionId && addFromUrlModal.roomId) {
                  handleAddItem(addFromUrlModal.sectionId, addFromUrlModal.roomId, extractedData)
                }
              }}
              disabled={!extractedData || savingItem}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {savingItem ? 'Adding...' : 'Add Product'}
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLibraryModal({ open: false, sectionId: null, roomId: null })
              setSelectedLibraryProduct(null)
              setLibrarySearch('')
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
              {savingItem ? 'Adding...' : 'Add Product'}
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
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCustomProductModal({ open: false, sectionId: null, roomId: null })
              setCustomProductForm({ name: '', brand: '', sku: '', description: '', supplierName: '', supplierLink: '', quantity: 1 })
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
              {savingItem ? 'Adding...' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Item Detail Panel */}
      <ItemDetailPanel
        isOpen={detailPanel.isOpen}
        onClose={() => setDetailPanel({ isOpen: false, mode: 'view', item: null })}
        item={detailPanel.item}
        mode={detailPanel.mode}
        sectionId={detailPanel.sectionId}
        roomId={detailPanel.roomId}
        availableRooms={availableRooms}
        onSave={() => {
          fetchSpecs()
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
    </div>
  )
}

