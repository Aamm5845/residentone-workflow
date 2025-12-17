'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  FolderPlus, 
  RefreshCw, 
  ChevronRight,
  ChevronDown,
  Import,
  Trash2,
  Package,
  Link as LinkIcon,
  Sparkles,
  Search,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Info,
  ExternalLink,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
  Globe,
  Loader2,
  ClipboardPaste,
  Building2,
  StickyNote,
  Upload
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AIGenerateFFEDialog from './AIGenerateFFEDialog'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface FFEItem {
  id: string
  name: string
  description?: string
  notes?: string
  order: number
  quantity: number
  customFields?: any
  isSpecItem: boolean
  ffeRequirementId?: string
  linkedSpecs?: FFEItem[]
}

interface FFESection {
  id: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  items: FFEItem[]
}

interface FFEUnifiedWorkspaceProps {
  roomId: string
  roomName: string
  orgId?: string
  projectId?: string
  projectName?: string
  disabled?: boolean
}

export default function FFEUnifiedWorkspace({ 
  roomId, 
  roomName, 
  orgId, 
  projectId, 
  projectName,
  disabled = false
}: FFEUnifiedWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sections, setSections] = useState<FFESection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [renderingImages, setRenderingImages] = useState<Array<{id: string, url: string, filename: string}>>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showImageModal, setShowImageModal] = useState(false)
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  // Dialog states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showAIGenerateDialog, setShowAIGenerateDialog] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  
  // Template states
  const [templates, setTemplates] = useState<any[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // Form states
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionDescription, setNewSectionDescription] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [linkToParent, setLinkToParent] = useState(false)
  const [selectedParentItemId, setSelectedParentItemId] = useState<string>('')
  
  // Edit states
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editSectionName, setEditSectionName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null)
  
  // Notes editing state
  const [editingNotesItemId, setEditingNotesItemId] = useState<string | null>(null)
  const [editNotesValue, setEditNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Generate from URL states
  const [showUrlGenerateDialog, setShowUrlGenerateDialog] = useState(false)
  const [urlGenerateItem, setUrlGenerateItem] = useState<{id: string, name: string, sectionId: string} | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [editingExtractedData, setEditingExtractedData] = useState(false)
  const [showNotesInput, setShowNotesInput] = useState(false)
  const [showSupplierInput, setShowSupplierInput] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // URL Generate Supplier states
  const [urlSuppliers, setUrlSuppliers] = useState<Array<{id: string, name: string, contactName?: string, website?: string}>>([])
  const [urlSupplierSearch, setUrlSupplierSearch] = useState('')
  const [urlSupplierLoading, setUrlSupplierLoading] = useState(false)
  const [showUrlSupplierDropdown, setShowUrlSupplierDropdown] = useState(false)
  const [urlSelectedSupplier, setUrlSelectedSupplier] = useState<{id: string, name: string, website?: string} | null>(null)
  const [showAddNewSupplierForm, setShowAddNewSupplierForm] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    notes: ''
  })
  const [savingNewSupplier, setSavingNewSupplier] = useState(false)
  
  // Search Item dialog states
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [searchItemName, setSearchItemName] = useState('')
  const [searchRegion, setSearchRegion] = useState<'ca' | 'us'>('ca')
  const [searchMode, setSearchMode] = useState<'text' | 'image'>('image')
  const [selectedRenderingForSearch, setSelectedRenderingForSearch] = useState<string>('')

  // Choose Product dialog states (add new product linked to FFE item)
  const [showChooseProductDialog, setShowChooseProductDialog] = useState(false)
  const [chooseProductItem, setChooseProductItem] = useState<{id: string, name: string, sectionId: string} | null>(null)
  const [newProductData, setNewProductData] = useState({
    name: '',
    description: '',
    brand: '',
    sku: '',
    unitCost: '',
    tradePrice: '',
    rrp: '',
    sourceUrl: '',
    images: [] as string[],
    notes: '',
    material: '',
    color: '',
    finish: '',
    width: '',
    height: '',
    depth: '',
    leadTime: '',
    supplierName: '',
    supplierLink: '',
    supplierId: '',
    length: ''
  })
  const [savingProduct, setSavingProduct] = useState(false)
  const [productPanelTab, setProductPanelTab] = useState('summary')
  const [uploadingProductImage, setUploadingProductImage] = useState(false)
  const [productSuppliers, setProductSuppliers] = useState<Array<{id: string, name: string, website?: string}>>([])
  const [productSupplierSearch, setProductSupplierSearch] = useState('')
  const [loadingProductSuppliers, setLoadingProductSuppliers] = useState(false)
  const [showProductSupplierDropdown, setShowProductSupplierDropdown] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalItems: 0,
    chosenItems: 0,
    needsSelection: 0,
    sectionsCount: 0
  })

  // Load FFE data
  useEffect(() => {
    loadFFEData()
    loadTemplates()
    loadRenderingImages()
  }, [roomId, orgId])

  // Handle highlight parameter from URL (when navigating from All Specs)
  useEffect(() => {
    const highlightParam = searchParams.get('highlight')
    if (highlightParam && !loading && sections.length > 0) {
      setHighlightedItemId(highlightParam)
      // Expand all sections to ensure the item is visible
      setSections(prev => prev.map(s => ({ ...s, isExpanded: true })))
      
      // Scroll to the item after a short delay
      setTimeout(() => {
        const element = document.getElementById(`ffe-item-${highlightParam}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
      
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedItemId(null)
        // Clear the URL parameter
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }, 3000)
    }
  }, [searchParams, loading, sections.length])

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
          isExpanded: true,
          // Filter out spec items - only show requirements
          items: (s.items || []).filter((item: any) => !item.isSpecItem)
        }))
        setSections(sectionsWithExpanded)
        calculateStats(sectionsWithExpanded)
      } else {
        setSections([])
        setStats({ totalItems: 0, chosenItems: 0, needsSelection: 0, sectionsCount: 0 })
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
      const response = await fetch(`/api/spec-books/room-renderings?roomId=${roomId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.renderings && result.renderings.length > 0) {
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
    } finally {
      setTemplatesLoading(false)
    }
  }

  const calculateStats = (sectionsData: FFESection[]) => {
    // Only count non-spec items (requirements)
    const allItems = sectionsData.flatMap(section => 
      section.items.filter(item => !item.isSpecItem)
    )
    
    // Items with linkedSpecs are "chosen"
    const chosenItems = allItems.filter(item => 
      item.linkedSpecs && item.linkedSpecs.length > 0
    ).length
    
    const newStats = {
      totalItems: allItems.length,
      chosenItems: chosenItems,
      needsSelection: allItems.length - chosenItems,
      sectionsCount: sectionsData.length
    }
    setStats(newStats)
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
    
    // If linking to parent, validate parent selection
    if (linkToParent && !selectedParentItemId) { toast.error('Please select a parent item to link to'); return }
    
    try {
      setSaving(true)
      
      if (linkToParent && selectedParentItemId) {
        // Create as linked child item
        const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${selectedParentItemId}/linked-items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'add',
            name: newItemName.trim()
          })
        })
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || 'Failed to add linked item')
        }
        toast.success(`Linked item "${newItemName.trim()}" added`)
      } else {
        // Create as standalone item
        const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sectionId: selectedSectionId, 
            name: newItemName.trim(), 
            description: newItemDescription.trim() || undefined, 
            quantity: newItemQuantity, 
            visibility: 'VISIBLE',
            isSpecItem: false // This is a requirement, not a spec
          })
        })
        if (!response.ok) throw new Error('Failed to add item')
        toast.success('Item added')
      }
      
      await loadFFEData()
      setShowAddItemDialog(false)
      setNewItemName('')
      setNewItemDescription('')
      setNewItemQuantity(1)
      setSelectedSectionId('')
      setLinkToParent(false)
      setSelectedParentItemId('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

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
        const errorData = await fetchRes.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to fetch page content'
        toast.error(errorMessage)
        setExtracting(false)
        return
      }
      
      const pageData = await fetchRes.json()
      
      // Collect all available images from link preview
      const availableImages = pageData.images?.length ? pageData.images : (pageData.image ? [pageData.image] : [])
      
      // Use AI to extract product info
      const aiRes = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          pageContent: pageData.textContent || pageData.description || '',
          title: pageData.title || '',
          images: availableImages
        })
      })
      
      if (aiRes.ok) {
        const result = await aiRes.json()
        if (result.success && result.data) {
          // Merge AI extracted images with preview images, preferring AI's selection
          const aiImages = result.data.images || []
          const allImages = [...new Set([...aiImages, ...availableImages])].slice(0, 10)
          
          // Don't auto-populate notes - user should add manually
          const { notes: _notes, productDescription: _desc, ...cleanData } = result.data
          
          setExtractedData({
            ...cleanData,
            productWebsite: urlInput,
            images: allImages.length > 0 ? allImages : availableImages,
            notes: '' // Notes should always be manually added
          })
          toast.success('Product info extracted!')
        } else {
          // Fallback with basic data - no auto notes
          setExtractedData({
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
            productWebsite: urlInput,
            images: availableImages
          })
          toast.success('Basic info extracted')
        }
      } else {
        // If AI fails, still provide basic extraction - no auto notes
        setExtractedData({
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
          productWebsite: urlInput,
          images: availableImages
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

  // Create linked spec from extracted URL data
  const handleCreateSpecFromUrl = async () => {
    if (!urlGenerateItem || !extractedData) {
      toast.error('Missing item or extracted data')
      return
    }
    
    try {
      setSaving(true)
      
      // Check if this FFE item already has specs (to determine if this is an option)
      const currentItem = sections
        .flatMap(s => s.items)
        .find(i => i.id === urlGenerateItem.id)
      
      const isOption = currentItem?.linkedSpecs && currentItem.linkedSpecs.length > 0
      const optionNumber = isOption ? (currentItem.linkedSpecs?.length || 0) + 1 : undefined
      
      // Create a linked spec item with the extracted data
      // Note: We don't auto-set supplier or notes - user adds manually
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: urlGenerateItem.sectionId,
          name: extractedData.productName || `Product for ${urlGenerateItem.name}`,
          brand: extractedData.brand,
          sku: extractedData.sku,
          material: extractedData.material,
          color: extractedData.colour || extractedData.color,
          finish: extractedData.finish,
          width: extractedData.width,
          height: extractedData.height,
          depth: extractedData.depth,
          leadTime: extractedData.leadTime,
          // Supplier only if user manually added it
          supplierName: extractedData.supplierName || undefined,
          supplierLink: extractedData.supplierLink || extractedData.productWebsite || undefined,
          quantity: 1,
          unitCost: extractedData.rrp ? parseFloat(String(extractedData.rrp).replace(/[^0-9.]/g, '')) : undefined,
          rrp: extractedData.rrp ? parseFloat(String(extractedData.rrp).replace(/[^0-9.]/g, '')) : undefined,
          tradePrice: extractedData.tradePrice ? parseFloat(String(extractedData.tradePrice).replace(/[^0-9.]/g, '')) : undefined,
          images: extractedData.images || [],
          notes: extractedData.notes || undefined, // Only if user adds notes manually
          // FFE Linking fields
          isSpecItem: true,
          ffeRequirementId: urlGenerateItem.id,
          isOption: isOption,
          optionNumber: optionNumber,
          specStatus: 'SELECTED',
          visibility: 'VISIBLE'
        })
      })
      
      if (res.ok) {
        const linkedMsg = isOption ? ` as Option #${optionNumber}` : ''
        toast.success(`Product linked to "${urlGenerateItem.name}"${linkedMsg}`)
        await loadFFEData()
        setShowUrlGenerateDialog(false)
        setUrlInput('')
        setExtractedData(null)
        setUrlGenerateItem(null)
        setEditingExtractedData(false)
        setShowNotesInput(false)
        setShowSupplierInput(false)
        // Reset supplier states
        setUrlSuppliers([])
        setUrlSupplierSearch('')
        setShowUrlSupplierDropdown(false)
        setUrlSelectedSupplier(null)
        setShowAddNewSupplierForm(false)
        setNewSupplierData({ name: '', contactName: '', email: '', phone: '', website: '', address: '', notes: '' })
      } else {
        throw new Error('Failed to create linked spec')
      }
    } catch (error) {
      console.error('Error creating spec from URL:', error)
      toast.error('Failed to create linked spec')
    } finally {
      setSaving(false)
    }
  }

  // Handle product image upload
  const handleProductImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (newProductData.images.length >= 5) {
      toast.error('Maximum 5 images allowed')
      return
    }
    
    setUploadingProductImage(true)
    try {
      for (const file of Array.from(files)) {
        if (newProductData.images.length >= 5) break
        
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.url) {
            setNewProductData(prev => ({
              ...prev,
              images: [...prev.images, data.url]
            }))
          }
        }
      }
      toast.success('Image uploaded')
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingProductImage(false)
    }
  }

  // Handle search for FFE item online
  const handleSearchItem = (mode: 'text' | 'image', region: 'ca' | 'us') => {
    if (mode === 'text') {
      if (!searchItemName.trim()) return
      
      const query = encodeURIComponent(searchItemName.trim())
      let searchUrl: string
      
      if (region === 'ca') {
        // Search on Google Shopping Canada
        searchUrl = `https://www.google.ca/search?q=${query}&tbm=shop&gl=ca`
      } else {
        // Search on Google Shopping US
        searchUrl = `https://www.google.com/search?q=${query}&tbm=shop&gl=us`
      }
      
      window.open(searchUrl, '_blank')
    } else {
      // Visual search using Google Lens
      if (!selectedRenderingForSearch) {
        toast.error('Please select a rendering image first')
        return
      }
      
      // Google Lens URL for image search
      const imageUrl = encodeURIComponent(selectedRenderingForSearch)
      const lensUrl = `https://lens.google.com/uploadbyurl?url=${imageUrl}`
      
      window.open(lensUrl, '_blank')
      
      // Also show instructions
      toast.success('Google Lens opened! Select the specific item in the image to find exact matches.', { duration: 5000 })
    }
  }

  // Search suppliers for product dialog
  const searchProductSuppliers = async (query: string) => {
    if (!query.trim()) {
      setProductSuppliers([])
      return
    }
    
    setLoadingProductSuppliers(true)
    try {
      const response = await fetch(`/api/suppliers/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setProductSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error searching suppliers:', error)
    } finally {
      setLoadingProductSuppliers(false)
    }
  }
  
  // Search suppliers for URL generate dialog
  const searchUrlSuppliers = async (query: string) => {
    if (!query.trim()) {
      setUrlSuppliers([])
      return
    }
    
    setUrlSupplierLoading(true)
    try {
      const response = await fetch(`/api/suppliers/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setUrlSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error searching suppliers:', error)
    } finally {
      setUrlSupplierLoading(false)
    }
  }
  
  // Create new supplier and save to phonebook (from URL generate dialog)
  const handleCreateNewSupplier = async () => {
    if (!newSupplierData.name.trim() || !newSupplierData.email.trim()) {
      toast.error('Business name and email are required')
      return
    }
    
    setSavingNewSupplier(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplierData)
      })
      
      if (res.ok) {
        const data = await res.json()
        // Select the newly created supplier
        setUrlSelectedSupplier({
          id: data.supplier.id,
          name: data.supplier.name,
          website: data.supplier.website
        })
        // Update extracted data with supplier info
        setExtractedData((prev: any) => ({
          ...prev,
          supplierName: data.supplier.name,
          supplierLink: data.supplier.website || prev?.supplierLink || '',
          supplierId: data.supplier.id
        }))
        // Reset form and close
        setShowAddNewSupplierForm(false)
        setNewSupplierData({ name: '', contactName: '', email: '', phone: '', website: '', address: '', notes: '' })
        toast.success('Supplier added to phonebook')
      } else {
        throw new Error('Failed to create supplier')
      }
    } catch (error) {
      console.error('Failed to create supplier:', error)
      toast.error('Failed to create supplier')
    } finally {
      setSavingNewSupplier(false)
    }
  }

  // Create product directly (Add New option)
  const handleCreateProductDirect = async () => {
    if (!chooseProductItem || !newProductData.name.trim()) {
      toast.error('Please enter a product name')
      return
    }
    
    try {
      setSavingProduct(true)
      
      // Check if this FFE item already has specs (to determine if this is an option)
      const currentItem = sections
        .flatMap(s => s.items)
        .flatMap(i => [i, ...(i.linkedSpecs || [])])
        .find(i => i.id === chooseProductItem.id)
      
      const parentItem = sections
        .flatMap(s => s.items)
        .find(i => i.id === chooseProductItem.id || i.linkedSpecs?.some(ls => ls.id === chooseProductItem.id))
      
      const isOption = parentItem?.linkedSpecs && parentItem.linkedSpecs.length > 0
      const optionNumber = isOption ? (parentItem.linkedSpecs?.length || 0) + 1 : undefined
      
      // Create a linked spec item with all fields
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: chooseProductItem.sectionId,
          name: newProductData.name.trim(),
          description: newProductData.description.trim() || undefined,
          brand: newProductData.brand.trim() || undefined,
          sku: newProductData.sku.trim() || undefined,
          material: newProductData.material.trim() || undefined,
          color: newProductData.color.trim() || undefined,
          finish: newProductData.finish.trim() || undefined,
          width: newProductData.width.trim() || undefined,
          height: newProductData.height.trim() || undefined,
          depth: newProductData.depth.trim() || undefined,
          leadTime: newProductData.leadTime.trim() || undefined,
          unitCost: newProductData.unitCost ? parseFloat(newProductData.unitCost.replace(/[^0-9.]/g, '')) : undefined,
          tradePrice: newProductData.tradePrice ? parseFloat(newProductData.tradePrice.replace(/[^0-9.]/g, '')) : undefined,
          rrp: newProductData.rrp ? parseFloat(newProductData.rrp.replace(/[^0-9.]/g, '')) : undefined,
          supplierName: newProductData.supplierName.trim() || undefined,
          supplierLink: newProductData.supplierLink.trim() || newProductData.sourceUrl.trim() || undefined,
          images: newProductData.images,
          notes: newProductData.notes.trim() || undefined,
          quantity: 1,
          // FFE Linking fields
          isSpecItem: true,
          ffeRequirementId: chooseProductItem.id,
          isOption: isOption,
          optionNumber: optionNumber,
          specStatus: 'SELECTED',
          visibility: 'VISIBLE'
        })
      })
      
      if (res.ok) {
        const linkedMsg = isOption ? ` as Option #${optionNumber}` : ''
        toast.success(`Product linked to "${chooseProductItem.name}"${linkedMsg}`)
        await loadFFEData()
        resetProductDialog()
      } else {
        throw new Error('Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error('Failed to create product')
    } finally {
      setSavingProduct(false)
    }
  }

  // Reset product dialog state
  const resetProductDialog = () => {
    setShowChooseProductDialog(false)
    setChooseProductItem(null)
    setNewProductData({
      name: '',
      description: '',
      brand: '',
      sku: '',
      unitCost: '',
      tradePrice: '',
      rrp: '',
      sourceUrl: '',
      images: [],
      notes: '',
      material: '',
      color: '',
      finish: '',
      width: '',
      height: '',
      depth: '',
      leadTime: '',
      supplierName: '',
      supplierLink: '',
      supplierId: '',
      length: ''
    })
    setProductSupplierSearch('')
    setProductSuppliers([])
    setShowProductSupplierDropdown(false)
    setProductPanelTab('summary')
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
  
  const handleUpdateItemNotes = async (itemId: string) => {
    try {
      setSavingNotes(true)
      const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotesValue.trim() || null })
      })
      if (!response.ok) throw new Error('Failed to update item notes')
      await loadFFEData()
      setEditingNotesItemId(null)
      setEditNotesValue('')
      toast.success('Notes updated')
    } catch (error) {
      toast.error('Failed to update notes')
    } finally {
      setSavingNotes(false)
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
            body: JSON.stringify({ 
              sectionId, 
              name: item.name, 
              description: item.description || '', 
              quantity: 1, 
              visibility: 'VISIBLE',
              isSpecItem: false,
              customFields: item.linkedItems ? {
                hasChildren: true,
                linkedItems: item.linkedItems
              } : undefined
            })
          })
          totalItemsCreated++
        }
      }
      
      await loadFFEData()
      toast.success(`${totalItemsCreated} items imported!`)
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

  // Get linked children for an item
  const getLinkedChildren = (item: FFEItem, section: FFESection) => {
    return section.items.filter(
      child => child.customFields?.isLinkedItem && child.customFields?.parentName === item.name
    )
  }

  // Check if item has specs selected
  const hasSpecs = (item: FFEItem) => {
    return item.linkedSpecs && item.linkedSpecs.length > 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading FFE Workspace...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50/50 -mx-6 -my-6 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-5">
          {/* Title and Rendering Gallery */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">FFE Workspace</h1>
                <p className="text-sm text-gray-500">{roomName} • {projectName}</p>
              </div>
              
              {/* Rendering Gallery */}
              {renderingImages.length > 0 && (
                <div className="flex items-center gap-1.5 ml-4">
                  {renderingImages.slice(0, 3).map((img, idx) => (
                    <button 
                      key={img.id}
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 overflow-hidden hover:border-blue-400 hover:scale-105 transition-all shadow-sm"
                      onClick={() => { setSelectedImageIndex(idx); setShowImageModal(true) }}
                    >
                      <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {renderingImages.length > 3 && (
                    <button 
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center hover:border-blue-400 transition-all"
                      onClick={() => { setSelectedImageIndex(0); setShowImageModal(true) }}
                    >
                      <span className="text-xs font-bold text-gray-600">+{renderingImages.length - 3}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Go to All Specs button */}
            {projectId && (
              <Button 
                onClick={() => router.push(`/projects/${projectId}/specs/all`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Package className="w-4 h-4 mr-2" />
                All Specs
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <FolderPlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.sectionsCount}</div>
                  <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Sections</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
                  <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">Total Items</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.chosenItems}</div>
                  <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Chosen</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Circle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.needsSelection}</div>
                  <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Needs Selection</div>
                </div>
              </div>
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
              <Button size="sm" onClick={() => setShowAIGenerateDialog(true)} disabled={disabled} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 py-6">
        {/* Sections */}
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No FFE Items Yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Get started by importing a template, using AI to generate items, or creating sections manually.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => setShowAIGenerateDialog(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
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
              // Filter out linked children (show them under their parents)
              const parentItems = section.items.filter(item => !item.customFields?.isLinkedItem)
              const chosenCount = parentItems.filter(item => hasSpecs(item)).length
              
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
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateSectionName(section.id)} className="h-8 w-8 p-0 text-green-600">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingSectionId(null); setEditSectionName('') }} className="h-8 w-8 p-0 text-gray-400">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/section">
                            <h3 className="font-semibold text-gray-900">{section.name}</h3>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingSectionId(section.id); setEditSectionName(section.name) }}
                              className="opacity-0 group-hover/section:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{parentItems.length} items</span>
                          {chosenCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 font-medium">{chosenCount} chosen</span>
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
                            const isChosen = hasSpecs(item)
                            const linkedChildren = getLinkedChildren(item, section)
                            
                            return (
                              <div key={item.id} id={`ffe-item-${item.id}`} className="group">
                                {/* Main Item Row */}
                                <div className={cn(
                                  "flex items-center justify-between p-4 transition-all",
                                  isChosen ? "bg-emerald-50/50" : "hover:bg-gray-50",
                                  highlightedItemId === item.id && "ring-2 ring-blue-500 ring-inset bg-blue-50"
                                )}>
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Chosen Indicator */}
                                    <div className="w-6 flex-shrink-0">
                                      {isChosen ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                      )}
                                    </div>
                                    
                                    {/* Item Name */}
                                    {editingItemId === item.id ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={editItemName}
                                          onChange={(e) => setEditItemName(e.target.value)}
                                          className="h-7 w-48 text-sm"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateItemName(item.id)
                                            if (e.key === 'Escape') { setEditingItemId(null); setEditItemName('') }
                                          }}
                                        />
                                        <Button size="sm" variant="ghost" onClick={() => handleUpdateItemName(item.id)} className="h-7 w-7 p-0 text-green-600">
                                          <Check className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setEditingItemId(null); setEditItemName('') }} className="h-7 w-7 p-0 text-gray-400">
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{item.name}</span>
                                        <button 
                                          onClick={() => { setEditingItemId(item.id); setEditItemName(item.name) }}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded transition-opacity"
                                        >
                                          <Pencil className="w-3 h-3 text-gray-400" />
                                        </button>
                                      </div>
                                    )}
                                    
                                    {/* Quantity badge */}
                                    {item.quantity > 1 && (
                                      <Badge variant="outline" className="text-xs">{item.quantity}x</Badge>
                                    )}
                                    
                                    {/* Linked children indicator */}
                                    {linkedChildren.length > 0 && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                        <LinkIcon className="w-3 h-3 mr-1" />
                                        {linkedChildren.length} linked
                                      </Badge>
                                    )}
                                    
                                    {/* Description toggle */}
                                    {item.description && (
                                      <button 
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        onClick={() => setExpandedDescriptionId(expandedDescriptionId === item.id ? null : item.id)}
                                      >
                                        <ChevronDown className={cn("w-4 h-4 transition-transform", expandedDescriptionId === item.id && "rotate-180")} />
                                      </button>
                                    )}
                                  </div>
                                  
                                  {/* Expanded Description */}
                                  {item.description && expandedDescriptionId === item.id && (
                                    <p className="text-xs text-gray-500 mt-1 pl-9 pr-4 pb-1">{item.description}</p>
                                  )}
                                  
                                  {/* Status and Actions */}
                                  <div className="flex items-center gap-2">
                                    {isChosen ? (
                                      <Badge 
                                        className="bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200 transition-colors"
                                        onClick={() => {
                                          // Navigate to All Specs with this specific item's linked spec
                                          if (projectId && item.linkedSpecs?.length) {
                                            const specId = item.linkedSpecs[0].id
                                            router.push(`/projects/${projectId}/specs/all?highlightItem=${specId}`)
                                          }
                                        }}
                                      >
                                        {item.linkedSpecs?.length === 1 ? 'Chosen' : `${item.linkedSpecs?.length} options`}
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        Needs Selection
                                      </Badge>
                                    )}
                                    
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                          <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {/* Add New Product - opens dialog to create product linked to this FFE item */}
                                        <DropdownMenuItem onClick={() => {
                                          setChooseProductItem({ id: item.id, name: item.name, sectionId: section.id })
                                          setNewProductData({
                                            name: '',
                                            description: '',
                                            brand: '',
                                            sku: '',
                                            unitCost: '',
                                            tradePrice: '',
                                            rrp: '',
                                            sourceUrl: '',
                                            images: [],
                                            notes: '',
                                            material: '',
                                            color: '',
                                            finish: '',
                                            width: '',
                                            height: '',
                                            depth: '',
                                            leadTime: '',
                                            supplierName: '',
                                            supplierLink: '',
                                            supplierId: '',
                                            length: ''
                                          })
                                          setProductPanelTab('summary')
                                          setShowChooseProductDialog(true)
                                        }}>
                                          <Plus className="w-4 h-4 mr-2 text-emerald-600" />
                                          Add New Product
                                        </DropdownMenuItem>
                                        {/* Generate from URL - AI extract product info */}
                                        <DropdownMenuItem onClick={() => {
                                          setUrlGenerateItem({ id: item.id, name: item.name, sectionId: section.id })
                                          setUrlInput('')
                                          setExtractedData(null)
                                          setShowUrlGenerateDialog(true)
                                        }}>
                                          <Globe className="w-4 h-4 mr-2 text-blue-600" />
                                          Generate from URL
                                        </DropdownMenuItem>
                                        {/* Add/Edit Note */}
                                        <DropdownMenuItem onClick={() => {
                                          setEditingNotesItemId(item.id)
                                          setEditNotesValue(item.notes || '')
                                        }}>
                                          <StickyNote className="w-4 h-4 mr-2 text-amber-600" />
                                          {item.notes ? 'Edit Note' : 'Add Note'}
                                        </DropdownMenuItem>
                                        {/* Search Item Online */}
                                        <DropdownMenuItem onClick={() => {
                                          setSearchItemName(item.name)
                                          setSearchRegion('ca')
                                          setSearchMode(renderingImages.length > 0 ? 'image' : 'text')
                                          setSelectedRenderingForSearch(renderingImages.length > 0 ? renderingImages[0].url : '')
                                          setShowSearchDialog(true)
                                        }}>
                                          <Search className="w-4 h-4 mr-2 text-purple-600" />
                                          Search Item
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => { if (confirm(`Delete "${item.name}"?`)) handleDeleteItem(item.id) }}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                                
                                {/* Notes Display/Edit */}
                                {(item.notes || editingNotesItemId === item.id) && (
                                  <div className="px-4 pb-3 pl-9">
                                    {editingNotesItemId === item.id ? (
                                      <div className="flex items-start gap-2">
                                        <Textarea
                                          value={editNotesValue}
                                          onChange={(e) => setEditNotesValue(e.target.value)}
                                          className="flex-1 text-sm min-h-[60px] resize-none"
                                          placeholder="Add notes about this item..."
                                          autoFocus
                                        />
                                        <div className="flex flex-col gap-1">
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={() => handleUpdateItemNotes(item.id)} 
                                            className="h-7 w-7 p-0 text-green-600"
                                            disabled={savingNotes}
                                          >
                                            {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                          </Button>
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={() => { setEditingNotesItemId(null); setEditNotesValue('') }} 
                                            className="h-7 w-7 p-0 text-gray-400"
                                            disabled={savingNotes}
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-start gap-2 bg-amber-50/50 rounded-lg p-2 cursor-pointer hover:bg-amber-50 transition-colors"
                                        onClick={() => {
                                          setEditingNotesItemId(item.id)
                                          setEditNotesValue(item.notes || '')
                                        }}
                                      >
                                        <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-gray-600">{item.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Linked Children */}
                                {linkedChildren.length > 0 && (
                                  <div className="ml-10 border-l-2 border-blue-200 bg-blue-50/30">
                                    {linkedChildren.map(child => {
                                      const childIsChosen = hasSpecs(child)
                                      return (
                                        <div 
                                          key={child.id} 
                                          id={`ffe-item-${child.id}`}
                                          className={cn(
                                            "group flex items-center justify-between py-2 px-4 hover:bg-blue-50/50 transition-all",
                                            highlightedItemId === child.id && "ring-2 ring-blue-500 ring-inset bg-blue-100"
                                          )}
                                        >
                                          <div className="flex items-center gap-2">
                                            {childIsChosen ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                              <Circle className="w-4 h-4 text-gray-300" />
                                            )}
                                            <LinkIcon className="w-3 h-3 text-blue-500" />
                                            <span className="text-sm text-gray-700">{child.name}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {childIsChosen ? (
                                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">Chosen</Badge>
                                            ) : (
                                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                                Needs Selection
                                              </Badge>
                                            )}
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                                                  <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                  setChooseProductItem({ id: child.id, name: child.name, sectionId: section.id })
                                                  setNewProductData({
                                                    name: '',
                                                    description: '',
                                                    brand: '',
                                                    sku: '',
                                                    unitCost: '',
                                                    tradePrice: '',
                                                    rrp: '',
                                                    sourceUrl: '',
                                                    images: [],
                                                    notes: '',
                                                    material: '',
                                                    color: '',
                                                    finish: '',
                                                    width: '',
                                                    height: '',
                                                    depth: '',
                                                    leadTime: '',
                                                    supplierName: '',
                                                    supplierLink: '',
                                                    supplierId: '',
                                                    length: ''
                                                  })
                                                  setProductPanelTab('summary')
                                                  setShowChooseProductDialog(true)
                                                }}>
                                                  <Plus className="w-4 h-4 mr-2 text-emerald-600" />
                                                  Add New Product
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                  setUrlGenerateItem({ id: child.id, name: child.name, sectionId: section.id })
                                                  setUrlInput('')
                                                  setExtractedData(null)
                                                  setShowUrlGenerateDialog(true)
                                                }}>
                                                  <Globe className="w-4 h-4 mr-2 text-blue-600" />
                                                  Generate from URL
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                  onClick={() => { if (confirm(`Delete "${child.name}"?`)) handleDeleteItem(child.id) }}
                                                  className="text-red-600"
                                                >
                                                  <Trash2 className="w-4 h-4 mr-2" />
                                                  Delete
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </div>
                                      )
                                    })}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={handleImportTemplate} disabled={!selectedTemplateId || saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Import
            </Button>
          </DialogFooter>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSectionDialog(false); setNewSectionName(''); setNewSectionDescription('') }}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={saving || !newSectionName.trim()}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={(open) => {
        setShowAddItemDialog(open)
        if (!open) {
          setNewItemName('')
          setNewItemDescription('')
          setNewItemQuantity(1)
          setSelectedSectionId('')
          setLinkToParent(false)
          setSelectedParentItemId('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-gray-600" />
              Add Item
            </DialogTitle>
            <DialogDescription>
              Add an item that needs to be selected for this room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Section</Label>
              <Select value={selectedSectionId} onValueChange={(val) => { 
                setSelectedSectionId(val)
                setLinkToParent(false)
                setSelectedParentItemId('')
              }}>
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
            
            {/* Link to Parent Option */}
            {selectedSectionId && (() => {
              const sectionItems = sections.find(s => s.id === selectedSectionId)?.items.filter(item => !item.customFields?.isLinkedItem) || []
              return sectionItems.length > 0 ? (
                <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="linkToParent"
                      checked={linkToParent}
                      onChange={(e) => {
                        setLinkToParent(e.target.checked)
                        if (!e.target.checked) setSelectedParentItemId('')
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="linkToParent" className="text-sm cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Link to existing item (create as sub-item)</span>
                      </div>
                    </Label>
                  </div>
                  
                  {linkToParent && (
                    <div>
                      <Label className="text-xs text-gray-500">Select parent item</Label>
                      <Select value={selectedParentItemId} onValueChange={setSelectedParentItemId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a parent item..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : null
            })()}
            
            <div>
              <Label>Item Name</Label>
              <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g., Floor tiles, Pendant lights" className="mt-1.5" />
            </div>
            
            {!linkToParent && (
              <>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} placeholder="Optional description..." rows={2} className="mt-1.5" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} max={50} value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} className="mt-1.5 w-24" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddItemDialog(false); setNewItemName(''); setNewItemDescription(''); setNewItemQuantity(1); setSelectedSectionId(''); setLinkToParent(false); setSelectedParentItemId('') }}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={saving || !newItemName.trim() || !selectedSectionId || (linkToParent && !selectedParentItemId)}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {linkToParent ? 'Add Linked Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate from URL Dialog */}
      <Dialog open={showUrlGenerateDialog} onOpenChange={(open) => {
        setShowUrlGenerateDialog(open)
        if (!open) {
          setUrlInput('')
          setExtractedData(null)
          setUrlGenerateItem(null)
          setEditingExtractedData(false)
          setShowNotesInput(false)
          setShowSupplierInput(false)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Generate from URL
            </DialogTitle>
            <DialogDescription>
              Paste a product URL to automatically extract product information using AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {urlGenerateItem && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Creating product for:</p>
                <p className="font-medium text-gray-900">{urlGenerateItem.name}</p>
              </div>
            )}
            
            {/* URL Input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input 
                  value={urlInput} 
                  onChange={(e) => setUrlInput(e.target.value)} 
                  placeholder="https://example.com/product-page" 
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      if (text) {
                        setUrlInput(text)
                        toast.success('URL pasted')
                      }
                    } catch {
                      toast.error('Could not access clipboard')
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
              </div>
              <Button 
                onClick={handleExtractFromUrl} 
                disabled={extracting || !urlInput.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Extract
                  </>
                )}
              </Button>
            </div>
            
            {/* Extracted Data */}
            {extractedData && (
              <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Product Info Extracted
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingExtractedData(!editingExtractedData)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    {editingExtractedData ? 'Done' : 'Edit'}
                  </Button>
                </div>
                
                {/* Product Images */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-gray-500">Images</Label>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {extractedData.images?.map((img: string, idx: number) => (
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
                            setExtractedData((prev: any) => ({
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
                    {/* Add Image - Upload */}
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
                          
                          setUploadingImage(true)
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
                                setExtractedData((prev: any) => ({
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
                            setUploadingImage(false)
                            e.target.value = '' // Reset input
                          }
                        }}
                      />
                      <div className={cn(
                        "w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors",
                        uploadingImage && "opacity-50 pointer-events-none"
                      )}>
                        {uploadingImage ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5" />
                            <span className="text-[10px] mt-0.5">Upload</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
                
                {editingExtractedData ? (
                  /* Edit Mode */
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Product Name</Label>
                      <Input
                        value={extractedData.productName || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, productName: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Brand</Label>
                      <Input
                        value={extractedData.brand || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, brand: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">SKU</Label>
                      <Input
                        value={extractedData.sku || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, sku: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price (RRP)</Label>
                      <Input
                        value={extractedData.rrp || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, rrp: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Trade Price</Label>
                      <Input
                        value={extractedData.tradePrice || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, tradePrice: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Material</Label>
                      <Input
                        value={extractedData.material || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, material: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Color</Label>
                      <Input
                        value={extractedData.colour || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, colour: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Finish</Label>
                      <Input
                        value={extractedData.finish || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, finish: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Lead Time</Label>
                      <Input
                        value={extractedData.leadTime || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, leadTime: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input
                        value={extractedData.width || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, width: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height</Label>
                      <Input
                        value={extractedData.height || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, height: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Depth</Label>
                      <Input
                        value={extractedData.depth || ''}
                        onChange={(e) => setExtractedData((prev: any) => ({ ...prev, depth: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {extractedData.productName && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Product:</span>
                        <span className="ml-2 font-medium">{extractedData.productName}</span>
                      </div>
                    )}
                    {extractedData.brand && (
                      <div>
                        <span className="text-gray-500">Brand:</span>
                        <span className="ml-2">{extractedData.brand}</span>
                      </div>
                    )}
                    {extractedData.sku && (
                      <div>
                        <span className="text-gray-500">SKU:</span>
                        <span className="ml-2">{extractedData.sku}</span>
                      </div>
                    )}
                    {extractedData.rrp && (
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="ml-2">{extractedData.rrp}</span>
                      </div>
                    )}
                    {extractedData.tradePrice && (
                      <div>
                        <span className="text-gray-500">Trade:</span>
                        <span className="ml-2">{extractedData.tradePrice}</span>
                      </div>
                    )}
                    {extractedData.material && (
                      <div>
                        <span className="text-gray-500">Material:</span>
                        <span className="ml-2">{extractedData.material}</span>
                      </div>
                    )}
                    {extractedData.colour && (
                      <div>
                        <span className="text-gray-500">Color:</span>
                        <span className="ml-2">{extractedData.colour}</span>
                      </div>
                    )}
                    {extractedData.finish && (
                      <div>
                        <span className="text-gray-500">Finish:</span>
                        <span className="ml-2">{extractedData.finish}</span>
                      </div>
                    )}
                    {(extractedData.width || extractedData.height || extractedData.depth) && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Size:</span>
                        <span className="ml-2">
                          {[extractedData.width && `W: ${extractedData.width}`, 
                            extractedData.height && `H: ${extractedData.height}`,
                            extractedData.depth && `D: ${extractedData.depth}`
                          ].filter(Boolean).join(' × ')}
                        </span>
                      </div>
                    )}
                    {extractedData.leadTime && (
                      <div>
                        <span className="text-gray-500">Lead:</span>
                        <span className="ml-2">{extractedData.leadTime}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Add Note Section */}
                {showNotesInput || extractedData.notes ? (
                  <div>
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <Textarea
                      value={extractedData.notes || ''}
                      onChange={(e) => setExtractedData((prev: any) => ({ ...prev, notes: e.target.value }))}
                      className="mt-1 text-sm"
                      rows={2}
                      placeholder="Add any notes about this product..."
                    />
                  </div>
                ) : null}
                
                {/* Add Supplier Section */}
                {showSupplierInput || extractedData.supplierName || urlSelectedSupplier ? (
                  <div className="border-t pt-3">
                    <Label className="text-xs text-gray-500 mb-2 block">Supplier</Label>
                    
                    {/* Show selected supplier */}
                    {(urlSelectedSupplier || extractedData.supplierName) && !showAddNewSupplierForm ? (
                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-emerald-900">{urlSelectedSupplier?.name || extractedData.supplierName}</p>
                            {(urlSelectedSupplier?.website || extractedData.supplierLink) && (
                              <p className="text-xs text-emerald-600">{urlSelectedSupplier?.website || extractedData.supplierLink}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUrlSelectedSupplier(null)
                            setExtractedData((prev: any) => ({ ...prev, supplierName: '', supplierLink: '', supplierId: '' }))
                          }}
                          className="text-xs text-gray-500 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ) : showAddNewSupplierForm ? (
                      /* Add New Supplier Form */
                      <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Add New Supplier</Label>
                          <button 
                            type="button" 
                            onClick={() => setShowAddNewSupplierForm(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-gray-500">Business Name *</Label>
                            <Input
                              value={newSupplierData.name}
                              onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                              className="h-8 text-sm mt-1"
                              placeholder="Company name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Contact Name</Label>
                            <Input
                              value={newSupplierData.contactName}
                              onChange={(e) => setNewSupplierData(prev => ({ ...prev, contactName: e.target.value }))}
                              className="h-8 text-sm mt-1"
                              placeholder="Contact person"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-gray-500">Email *</Label>
                            <Input
                              type="email"
                              value={newSupplierData.email}
                              onChange={(e) => setNewSupplierData(prev => ({ ...prev, email: e.target.value }))}
                              className="h-8 text-sm mt-1"
                              placeholder="email@company.com"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Phone</Label>
                            <Input
                              value={newSupplierData.phone}
                              onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                              className="h-8 text-sm mt-1"
                              placeholder="Phone number"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Website</Label>
                          <Input
                            value={newSupplierData.website}
                            onChange={(e) => setNewSupplierData(prev => ({ ...prev, website: e.target.value }))}
                            className="h-8 text-sm mt-1"
                            placeholder="https://..."
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={handleCreateNewSupplier}
                          disabled={savingNewSupplier || !newSupplierData.name.trim() || !newSupplierData.email.trim()}
                          className="w-full h-8 text-sm bg-emerald-600 hover:bg-emerald-700"
                        >
                          {savingNewSupplier ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save to Phonebook'
                          )}
                        </Button>
                      </div>
                    ) : (
                      /* Choose Supplier or Add New */
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            value={urlSupplierSearch}
                            onChange={(e) => {
                              setUrlSupplierSearch(e.target.value)
                              searchUrlSuppliers(e.target.value)
                              setShowUrlSupplierDropdown(true)
                            }}
                            onFocus={() => {
                              if (urlSupplierSearch) setShowUrlSupplierDropdown(true)
                            }}
                            className="h-8 text-sm"
                            placeholder="Search suppliers in phonebook..."
                          />
                          {showUrlSupplierDropdown && urlSuppliers.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {urlSuppliers.map((supplier) => (
                                <button
                                  key={supplier.id}
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                  onClick={() => {
                                    setUrlSelectedSupplier(supplier)
                                    setExtractedData((prev: any) => ({
                                      ...prev,
                                      supplierName: supplier.name,
                                      supplierLink: supplier.website || '',
                                      supplierId: supplier.id
                                    }))
                                    setUrlSupplierSearch('')
                                    setShowUrlSupplierDropdown(false)
                                  }}
                                >
                                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                    {supplier.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-medium">{supplier.name}</p>
                                    {supplier.contactName && (
                                      <p className="text-xs text-gray-500">{supplier.contactName}</p>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {urlSupplierLoading && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                        <button 
                          type="button"
                          className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                          onClick={() => setShowAddNewSupplierForm(true)}
                        >
                          <Plus className="w-4 h-4" />
                          Add New Supplier (saves to phonebook)
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
                
                {/* Action Buttons - Always visible */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  {!showNotesInput && !extractedData.notes && (
                    <button
                      type="button"
                      onClick={() => setShowNotesInput(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      Add Note
                    </button>
                  )}
                  {!showSupplierInput && !extractedData.supplierName && (
                    <button
                      type="button"
                      onClick={() => setShowSupplierInput(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Add Supplier
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { 
                setShowUrlGenerateDialog(false)
                setUrlInput('')
                setExtractedData(null)
                setUrlGenerateItem(null)
                setEditingExtractedData(false)
                setShowNotesInput(false)
                setShowSupplierInput(false)
                // Reset supplier states
                setUrlSuppliers([])
                setUrlSupplierSearch('')
                setShowUrlSupplierDropdown(false)
                setUrlSelectedSupplier(null)
                setShowAddNewSupplierForm(false)
                setNewSupplierData({ name: '', contactName: '', email: '', phone: '', website: '', address: '', notes: '' })
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSpecFromUrl} 
              disabled={saving || !extractedData}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Link Product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Product Panel (Choose Product for This) - Slide out panel like All Specs */}
      {showChooseProductDialog && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={resetProductDialog}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Add New Product</h2>
              </div>
              <div className="flex items-center gap-2">
                {newProductData.sourceUrl && (
                  <a 
                    href={newProductData.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                    title="Open product link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={resetProductDialog}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-5">
              {['Summary', 'Financial'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProductPanelTab(tab.toLowerCase())}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                    productPanelTab === tab.toLowerCase()
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
                {productPanelTab === 'summary' && (
                  <>
                    {/* Image Upload */}
                    <div className="space-y-2">
                      <div className="flex gap-3">
                        {newProductData.images.map((img, idx) => (
                          <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setNewProductData(prev => ({
                                ...prev,
                                images: prev.images.filter((_, i) => i !== idx)
                              }))}
                              className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {newProductData.images.length < 2 && (
                          <label className={cn(
                            "flex-1 min-w-[200px] border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                            "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                          )}>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleProductImageUpload(e.target.files)}
                              disabled={uploadingProductImage}
                            />
                            {uploadingProductImage ? (
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
                          </label>
                        )}
                      </div>
                    </div>
                    
                    {/* FFE Linking Info */}
                    {chooseProductItem && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-emerald-600 font-medium mb-0.5">Linking to FFE Item</p>
                            <p className="text-sm font-medium text-emerald-900">{chooseProductItem.name}</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                      </div>
                    )}
                    
                    {/* Product Name */}
                    <div className="space-y-2">
                      <Label>Product Name</Label>
                      <Input
                        value={newProductData.name}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter product name"
                      />
                    </div>
                    
                    {/* Description */}
                    <div className="space-y-2">
                      <Label>Product Description</Label>
                      <Input
                        value={newProductData.description}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Description"
                      />
                    </div>
                    
                    {/* Brand & Lead Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Input
                          value={newProductData.brand}
                          onChange={(e) => setNewProductData(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="Brand name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Lead Time</Label>
                        <Select 
                          value={newProductData.leadTime} 
                          onValueChange={(v) => setNewProductData(prev => ({ ...prev, leadTime: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="In Stock">In Stock</SelectItem>
                            <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                            <SelectItem value="2-4 weeks">2-4 weeks</SelectItem>
                            <SelectItem value="4-6 weeks">4-6 weeks</SelectItem>
                            <SelectItem value="6-8 weeks">6-8 weeks</SelectItem>
                            <SelectItem value="8-12 weeks">8-12 weeks</SelectItem>
                            <SelectItem value="12+ weeks">12+ weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* SKU */}
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <Input
                        value={newProductData.sku}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, sku: e.target.value }))}
                        placeholder="SKU / Model number"
                      />
                    </div>
                    
                    {/* Product URL */}
                    <div className="space-y-2">
                      <Label>Product URL</Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          value={newProductData.sourceUrl}
                          onChange={(e) => setNewProductData(prev => ({ ...prev, sourceUrl: e.target.value }))}
                          placeholder="https://..."
                          className="pl-9"
                        />
                      </div>
                    </div>
                    
                    {/* Supplier */}
                    <div className="space-y-2">
                      <Label>Supplier</Label>
                      {newProductData.supplierName ? (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                            {newProductData.supplierName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{newProductData.supplierName}</p>
                            {newProductData.supplierLink && (
                              <a 
                                href={newProductData.supplierLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate block"
                              >
                                {newProductData.supplierLink}
                              </a>
                            )}
                          </div>
                          <button 
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => setNewProductData(prev => ({ 
                              ...prev, 
                              supplierName: '', 
                              supplierId: '', 
                              supplierLink: '' 
                            }))}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Input
                              value={productSupplierSearch}
                              onChange={(e) => {
                                setProductSupplierSearch(e.target.value)
                                searchProductSuppliers(e.target.value)
                                setShowProductSupplierDropdown(true)
                              }}
                              onFocus={() => {
                                if (productSupplierSearch) setShowProductSupplierDropdown(true)
                              }}
                              placeholder="Search suppliers..."
                            />
                            {showProductSupplierDropdown && productSuppliers.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {productSuppliers.map((supplier) => (
                                  <button
                                    key={supplier.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                    onClick={() => {
                                      setNewProductData(prev => ({
                                        ...prev,
                                        supplierName: supplier.name,
                                        supplierLink: supplier.website || '',
                                        supplierId: supplier.id
                                      }))
                                      setProductSupplierSearch('')
                                      setShowProductSupplierDropdown(false)
                                    }}
                                  >
                                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                      {supplier.name.charAt(0)}
                                    </div>
                                    <span>{supplier.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button 
                            type="button"
                            className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              // For now, allow manual entry
                              const name = prompt('Enter supplier name:')
                              if (name) {
                                setNewProductData(prev => ({ ...prev, supplierName: name }))
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            Add New Supplier
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={newProductData.notes}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, notes: e.target.value }))}
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
                            value={newProductData.height}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, height: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Depth</Label>
                          <Input
                            value={newProductData.depth}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, depth: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Width</Label>
                          <Input
                            value={newProductData.width}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, width: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Length</Label>
                          <Input
                            value={newProductData.length || ''}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, length: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Colour</Label>
                          <Input
                            value={newProductData.color}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, color: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Finish</Label>
                          <Input
                            value={newProductData.finish}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, finish: e.target.value }))}
                            placeholder="-"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Material</Label>
                        <Input
                          value={newProductData.material}
                          onChange={(e) => setNewProductData(prev => ({ ...prev, material: e.target.value }))}
                          placeholder="-"
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {productPanelTab === 'financial' && (
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
                            value={newProductData.rrp}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, rrp: e.target.value }))}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value="1"
                          disabled
                        />
                      </div>
                    </div>
                    
                    {/* Trade Price & Unit Cost Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trade Price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={newProductData.tradePrice}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, tradePrice: e.target.value }))}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Unit Cost</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={newProductData.unitCost}
                            onChange={(e) => setNewProductData(prev => ({ ...prev, unitCost: e.target.value }))}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Footer */}
            <div className="border-t border-gray-200 px-5 py-4 flex justify-end gap-3">
              <Button variant="outline" onClick={resetProductDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProductDirect} 
                disabled={savingProduct || !newProductData.name.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {savingProduct ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Create & Link
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

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

      {/* Image Modal */}
      {showImageModal && renderingImages.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === 0 ? renderingImages.length - 1 : prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            )}
            
            <img 
              src={renderingImages[selectedImageIndex]?.url} 
              alt={renderingImages[selectedImageIndex]?.filename || 'Rendering'} 
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
            />
            
            {renderingImages.length > 1 && (
              <button
                onClick={() => setSelectedImageIndex((prev) => prev === renderingImages.length - 1 ? 0 : prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          
          <div className="text-center text-white mt-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-medium">{renderingImages[selectedImageIndex]?.filename || 'Rendering'}</p>
            <p className="text-white/60 text-sm">{selectedImageIndex + 1} of {renderingImages.length}</p>
          </div>
        </div>
      )}

      {/* Search Item Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              Search for: {searchItemName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Search Mode Toggle */}
            <div className="space-y-2">
              <Label>Search Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={searchMode === 'image' ? 'default' : 'outline'}
                  onClick={() => setSearchMode('image')}
                  className={searchMode === 'image' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  disabled={renderingImages.length === 0}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Visual Search
                </Button>
                <Button
                  variant={searchMode === 'text' ? 'default' : 'outline'}
                  onClick={() => setSearchMode('text')}
                  className={searchMode === 'text' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Text Search
                </Button>
              </div>
            </div>

            {searchMode === 'image' ? (
              <>
                {/* Visual Search - Rendering Images */}
                <div className="space-y-3">
                  <Label>Select Rendering Image</Label>
                  {renderingImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {renderingImages.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setSelectedRenderingForSearch(img.url)}
                          className={cn(
                            "relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                            selectedRenderingForSearch === img.url 
                              ? "border-purple-500 ring-2 ring-purple-200" 
                              : "border-gray-200 hover:border-purple-300"
                          )}
                        >
                          <img 
                            src={img.url} 
                            alt={img.filename}
                            className="w-full h-32 object-cover"
                          />
                          {selectedRenderingForSearch === img.url && (
                            <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                          <p className="text-xs text-center py-1 bg-gray-50 truncate px-2">
                            {img.filename}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                      <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No rendering images available for this room.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload renderings in the 3D Rendering phase first.
                      </p>
                    </div>
                  )}
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-800">
                      <strong>How it works:</strong> Google Lens will open with your rendering. 
                      Click on the specific item (like a pendant light) to find exact matches online.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Text Search */}
                <div className="space-y-2">
                  <Label>Search Term</Label>
                  <Input
                    value={searchItemName}
                    onChange={(e) => setSearchItemName(e.target.value)}
                    placeholder="e.g., pendant light, dining chair..."
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>Region</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={searchRegion === 'ca' ? 'default' : 'outline'}
                      onClick={() => setSearchRegion('ca')}
                      className={searchRegion === 'ca' ? 'bg-red-600 hover:bg-red-700' : ''}
                    >
                      🇨🇦 Canada
                    </Button>
                    <Button
                      variant={searchRegion === 'us' ? 'default' : 'outline'}
                      onClick={() => setSearchRegion('us')}
                      className={searchRegion === 'us' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      🇺🇸 United States
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Start with Canada, switch to US if you can't find what you need
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSearchDialog(false)}>
              Cancel
            </Button>
            {searchMode === 'image' ? (
              <Button 
                onClick={() => handleSearchItem('image', 'ca')}
                disabled={!selectedRenderingForSearch}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Search with Google Lens
              </Button>
            ) : (
              <Button 
                onClick={() => handleSearchItem('text', searchRegion)}
                disabled={!searchItemName.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Search className="w-4 h-4 mr-2" />
                Search {searchRegion === 'ca' ? 'Canada' : 'US'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
