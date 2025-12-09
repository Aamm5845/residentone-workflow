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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'category' | 'room' | 'status'>('category')
  const [activeTab, setActiveTab] = useState<'summary' | 'financial'>('summary')
  const [financials, setFinancials] = useState({ totalTradePrice: 0, totalRRP: 0, avgTradeDiscount: 0 })
  
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
  
  const [savingItem, setSavingItem] = useState(false)
  
  // Hover states
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  
  // Inline editing
  const [editingField, setEditingField] = useState<{ itemId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

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
    } catch (error) {
      console.error('Failed to fetch specs:', error)
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    fetchSpecs()
  }, [fetchSpecs])

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
  }, [specs, searchQuery, filterStatus, sortBy])
  
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
      
      // Add item to the section
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
          libraryProductId: itemData.libraryProductId
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-3">
          {/* Top Row - Breadcrumb and Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm">
              <button 
                onClick={() => router.push('/projects')}
                className="text-gray-500 hover:text-gray-700"
              >
                Projects
              </button>
              <span className="text-gray-400">/</span>
              <button 
                onClick={() => router.push(`/projects/${project.id}`)}
                className="text-gray-500 hover:text-gray-700"
              >
                {project.name}
              </button>
              <span className="text-gray-400">/</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 font-medium text-gray-900">
                  <Package className="w-4 h-4" />
                  Specs
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/specs`)}>
                    All Specs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/specs/builder`)}>
                    Spec Book Builder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          <div className="flex items-center justify-between">
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
              
              {/* Filter */}
              <Button variant="ghost" size="sm" className="h-8 text-gray-500">
                <Filter className="w-4 h-4 mr-1.5" />
                Filter
              </Button>

              {/* Sort */}
              <Button variant="ghost" size="sm" className="h-8 text-gray-500">
                <SortAsc className="w-4 h-4 mr-1.5" />
                Sort
              </Button>
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
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No specs found</h3>
            <p className="text-gray-500 mb-4">Add items to your rooms to see them here.</p>
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
                  className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 group/section"
                  onMouseEnter={() => setHoveredSection(group.name)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
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
                  
                  {/* Section Action Buttons - Only visible on hover */}
                  {group.sectionId && group.roomId && (
                    <div className={cn(
                      "flex items-center gap-1.5 transition-opacity duration-200",
                      hoveredSection === group.name ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 border-gray-200 hover:border-blue-300 hover:bg-blue-50 px-2"
                        onClick={() => openLibraryModal(group.sectionId!, group.roomId!)}
                      >
                        <Library className="w-3 h-3" />
                        Product from Library
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 border-gray-200 hover:border-purple-300 hover:bg-purple-50 px-2"
                        onClick={() => setAddFromUrlModal({ open: true, sectionId: group.sectionId!, roomId: group.roomId! })}
                      >
                        <Sparkles className="w-3 h-3" />
                        Add from URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 border-gray-200 hover:border-gray-300 px-2"
                        onClick={() => setCustomProductModal({ open: true, sectionId: group.sectionId!, roomId: group.roomId! })}
                      >
                        <Plus className="w-3 h-3" />
                        Custom Product
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 border-gray-200 hover:border-gray-300 px-2"
                        onClick={() => setAddSectionModal({ open: true, categoryName: group.name })}
                      >
                        <Layers className="w-3 h-3" />
                        Section
                      </Button>
                    </div>
                  )}
                </div>

                {/* Items */}
                {expandedCategories.has(group.name) && (
                  <div className="divide-y divide-gray-50">
                    {group.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="group/item relative flex items-stretch hover:bg-gray-50/80 transition-colors"
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {/* Hover Actions - Fixed on left side */}
                        <div className={cn(
                          "absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10 transition-opacity duration-150",
                          hoveredItem === item.id ? "opacity-100" : "opacity-0"
                        )}>
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            className="h-3.5 w-3.5"
                          />
                          <button className="p-0.5 cursor-grab hover:bg-gray-200 rounded">
                            <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button 
                            className="p-0.5 hover:bg-emerald-100 text-emerald-600 rounded"
                            onClick={() => setCustomProductModal({ open: true, sectionId: group.sectionId!, roomId: group.roomId! })}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Main Item Content */}
                        <div className="flex items-center w-full min-w-0 pl-14 pr-2 py-2">
                          {/* Image */}
                          <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 mr-3">
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
                          
                          {/* Title & Room */}
                          <div className="w-36 min-w-0 flex-shrink-0 mr-2">
                            {editingField?.itemId === item.id && editingField?.field === 'name' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-6 text-sm font-medium"
                                autoFocus
                              />
                            ) : (
                              <p 
                                className="text-sm font-medium text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                onClick={() => startEditing(item.id, 'name', item.name || '')}
                              >
                                {item.name}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-500 uppercase truncate">{item.roomName}</p>
                          </div>
                          
                          {/* Link Icon */}
                          <div className="w-6 flex-shrink-0 mr-2">
                            {item.supplierLink ? (
                              <a 
                                href={item.supplierLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded inline-flex"
                                title="Open product page"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : null}
                          </div>
                          
                          {/* Doc Code - Editable */}
                          <div className="w-28 flex-shrink-0 mr-2">
                            {editingField?.itemId === item.id && editingField?.field === 'sku' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-6 text-xs"
                                autoFocus
                                placeholder="Enter Doc Code"
                              />
                            ) : (
                              <div 
                                className="cursor-text hover:bg-gray-100 rounded px-1 py-0.5"
                                onClick={() => startEditing(item.id, 'sku', item.sku || '')}
                              >
                                {item.sku ? (
                                  <p className="text-xs text-gray-900">{item.sku}</p>
                                ) : (
                                  <p className="text-xs text-gray-400 italic">Enter Doc Code</p>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Product Name - Editable */}
                          <div className="w-40 min-w-0 flex-shrink-0 mr-2">
                            <p className="text-[10px] text-gray-400 uppercase">Product Name</p>
                            {editingField?.itemId === item.id && editingField?.field === 'productName' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-5 text-xs"
                                autoFocus
                              />
                            ) : (
                              <p 
                                className="text-xs text-gray-900 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                onClick={() => startEditing(item.id, 'productName', item.productName || '')}
                              >
                                {item.productName || '-'}
                              </p>
                            )}
                          </div>
                          
                          {/* Brand - Editable */}
                          <div className="w-20 flex-shrink-0 mr-2">
                            <p className="text-[10px] text-gray-400 uppercase">Brand</p>
                            {editingField?.itemId === item.id && editingField?.field === 'brand' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-5 text-xs"
                                autoFocus
                              />
                            ) : (
                              <p 
                                className="text-xs text-gray-600 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                onClick={() => startEditing(item.id, 'brand', item.brand || '')}
                              >
                                {item.brand || '-'}
                              </p>
                            )}
                          </div>
                          
                          {/* Financial Columns - Only in Financial Tab */}
                          {activeTab === 'financial' && (
                            <>
                              {/* Trade Price */}
                              <div className="w-20 flex-shrink-0 mr-2 text-right">
                                <p className="text-[10px] text-gray-400 uppercase">Trade Price</p>
                                {editingField?.itemId === item.id && editingField?.field === 'tradePrice' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={handleEditKeyDown}
                                    className="h-5 text-xs text-right"
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                  />
                                ) : (
                                  <p 
                                    className="text-xs text-gray-900 cursor-text hover:bg-gray-100 rounded px-1"
                                    onClick={() => startEditing(item.id, 'tradePrice', item.tradePrice?.toString() || '')}
                                  >
                                    {item.tradePrice ? formatCurrency(item.tradePrice) : '-'}
                                  </p>
                                )}
                              </div>
                              
                              {/* RRP */}
                              <div className="w-20 flex-shrink-0 mr-2 text-right">
                                <p className="text-[10px] text-gray-400 uppercase">RRP</p>
                                {editingField?.itemId === item.id && editingField?.field === 'rrp' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={handleEditKeyDown}
                                    className="h-5 text-xs text-right"
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                  />
                                ) : (
                                  <p 
                                    className="text-xs text-gray-900 cursor-text hover:bg-gray-100 rounded px-1"
                                    onClick={() => startEditing(item.id, 'rrp', item.rrp?.toString() || '')}
                                  >
                                    {item.rrp ? formatCurrency(item.rrp) : '-'}
                                  </p>
                                )}
                              </div>
                              
                              {/* QTY */}
                              <div className="w-12 flex-shrink-0 mr-2 text-center">
                                <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                                {editingField?.itemId === item.id && editingField?.field === 'quantity' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={handleEditKeyDown}
                                    className="h-5 text-xs text-center"
                                    autoFocus
                                    type="number"
                                    min="1"
                                  />
                                ) : (
                                  <p 
                                    className="text-xs text-gray-900 cursor-text hover:bg-gray-100 rounded px-1"
                                    onClick={() => startEditing(item.id, 'quantity', item.quantity?.toString() || '1')}
                                  >
                                    {item.quantity}
                                  </p>
                                )}
                              </div>
                              
                              {/* Trade Discount */}
                              <div className="w-16 flex-shrink-0 mr-2 text-right">
                                <p className="text-[10px] text-gray-400 uppercase">Discount</p>
                                {editingField?.itemId === item.id && editingField?.field === 'tradeDiscount' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={handleEditKeyDown}
                                    className="h-5 text-xs text-right"
                                    autoFocus
                                    type="number"
                                    step="0.1"
                                  />
                                ) : (
                                  <p 
                                    className="text-xs text-gray-600 cursor-text hover:bg-gray-100 rounded px-1"
                                    onClick={() => startEditing(item.id, 'tradeDiscount', item.tradeDiscount?.toString() || '')}
                                  >
                                    {item.tradeDiscount ? `${item.tradeDiscount}%` : '- %'}
                                  </p>
                                )}
                              </div>
                              
                              {/* Total */}
                              <div className="w-20 flex-shrink-0 mr-2 text-right">
                                <p className="text-[10px] text-gray-400 uppercase">Total</p>
                                <p className="text-xs font-medium text-gray-900">
                                  {formatCurrency((item.tradePrice || 0) * (item.quantity || 1))}
                                </p>
                              </div>
                            </>
                          )}
                          
                          {/* Supplier - Editable */}
                          <div className="w-36 flex-shrink-0 mr-2">
                            <p className="text-[10px] text-gray-400 uppercase">Supplier</p>
                            {editingField?.itemId === item.id && editingField?.field === 'supplierName' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveInlineEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-5 text-xs"
                                autoFocus
                                placeholder="Company / Contact"
                              />
                            ) : (
                              <p 
                                className="text-xs text-gray-600 truncate cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                onClick={() => startEditing(item.id, 'supplierName', item.supplierName || '')}
                              >
                                {item.supplierName || '-'}
                              </p>
                            )}
                          </div>
                          
                          {/* Spacer to push actions to edge */}
                          <div className="flex-1" />
                          
                          {/* Status Tag & Actions - Right Edge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Status Tag */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 bg-white text-xs transition-colors">
                                  {getItemStatusDisplay(item.specStatus || 'DRAFT')}
                                  <ChevronDown className="w-3 h-3 text-gray-400" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {ITEM_STATUS_OPTIONS.map((option) => {
                                  const IconComponent = option.icon
                                  return (
                                    <DropdownMenuItem 
                                      key={option.value}
                                      onClick={() => handleUpdateItemStatus(item.id, option.value)}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <IconComponent className={cn("w-3.5 h-3.5", option.color)} />
                                      {option.label}
                                    </DropdownMenuItem>
                                  )
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            {/* Details Button */}
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                              Details
                            </Button>
                            
                            {/* Quote Button */}
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                              Quote
                            </Button>
                            
                            {/* 3 Dots Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="text-xs">
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
                    
                    {/* Add Item Row */}
                    {group.sectionId && group.roomId && (
                      <div 
                        className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                        onClick={() => setCustomProductModal({ open: true, sectionId: group.sectionId!, roomId: group.roomId! })}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-xs font-medium">Add Item</span>
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
              <DropdownMenuItem onClick={() => setCustomProductModal({ open: true, sectionId: groupedSpecs[0].sectionId!, roomId: groupedSpecs[0].roomId! })}>
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
    </div>
  )
}

