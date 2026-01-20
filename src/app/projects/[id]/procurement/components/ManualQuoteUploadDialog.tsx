'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  Loader2,
  Building2,
  X,
  AlertCircle,
  Sparkles,
  Link2,
  Package,
  Check,
  Search
} from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  email: string
  logo?: string | null
}

interface Component {
  id: string
  name: string
  price?: number
  quantity: number
  modelNumber?: string
}

interface SpecItem {
  id: string
  name: string
  quantity: number
  sku?: string
  brand?: string
  imageUrl?: string
  roomName?: string
  existingTradePrice?: number
  existingSupplierName?: string
  existingSupplierId?: string
  components?: Component[]
}

interface ManualQuoteUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onUploadComplete: (data: {
    fileUrl: string
    fileType: string
    supplierId: string
    supplierName: string
  }) => void
  // Callback when AI analysis is complete
  onAnalysisComplete?: (analysisData: any, specItems: any[]) => void
  // Callback when manual link is complete
  onManualLinkComplete?: () => void
}

type UploadMode = 'ai' | 'manual'

interface SelectedItem {
  specItemId: string
  unitPrice: number
  quantity: number
  isComponent?: boolean
  parentItemId?: string
  componentId?: string
}

export default function ManualQuoteUploadDialog({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
  onAnalysisComplete,
  onManualLinkComplete
}: ManualQuoteUploadDialogProps) {
  // Common state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<{ url: string; type: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  // Mode selection
  const [mode, setMode] = useState<UploadMode>('ai')

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState('')

  // Manual Link state
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [showAllItems, setShowAllItems] = useState(false)

  // Fetch suppliers when dialog opens
  useEffect(() => {
    if (open && suppliers.length === 0) {
      fetchSuppliers()
    }
  }, [open])

  // Fetch spec items when manual mode is selected
  useEffect(() => {
    if (open && mode === 'manual' && specItems.length === 0) {
      fetchSpecItems()
    }
  }, [open, mode])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMode('ai')
      setSelectedSupplierId('')
      setUploadedFile(null)
      setAnalyzing(false)
      setAnalysisProgress('')
      setSelectedItems({})
      setSearchQuery('')
      setSelectedRoom('all')
    }
  }, [open])

  // Clear selected items when supplier changes
  useEffect(() => {
    setSelectedItems({})
    setSelectedRoom('all')
  }, [selectedSupplierId])

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers || data || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchSpecItems = useCallback(async () => {
    setLoadingSpecs(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/ffe-specs`)
      if (res.ok) {
        const data = await res.json()
        const items = data.items || []
        setSpecItems(items.map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          sku: item.sku,
          brand: item.brand,
          imageUrl: item.images?.[0],
          roomName: item.roomName,
          existingTradePrice: item.tradePrice ? Number(item.tradePrice) : undefined,
          existingSupplierName: item.supplierName,
          existingSupplierId: item.supplierId,
          components: (item.components || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            price: c.price ? Number(c.price) : undefined,
            quantity: c.quantity || 1,
            modelNumber: c.modelNumber
          }))
        })))
      }
    } catch (error) {
      console.error('Error fetching spec items:', error)
      toast.error('Failed to load spec items')
    } finally {
      setLoadingSpecs(false)
    }
  }, [projectId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'quote-document')
      formData.append('projectId', projectId)

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setUploadedFile({
          url: data.url,
          type: file.type,
          name: file.name
        })
        toast.success('File uploaded')
      } else {
        toast.error('Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAIAnalysis = async () => {
    if (!uploadedFile || !selectedSupplierId) {
      toast.error('Please select a supplier and upload a quote document')
      return
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)
    if (!selectedSupplier) {
      toast.error('Please select a valid supplier')
      return
    }

    if (onAnalysisComplete) {
      setAnalyzing(true)
      setAnalysisProgress('Extracting line items from quote...')

      try {
        const res = await fetch(`/api/projects/${projectId}/procurement/manual-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: uploadedFile.url,
            fileType: uploadedFile.type,
            supplierId: selectedSupplierId,
            supplierName: selectedSupplier.name
          })
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || 'Failed to analyze quote')
        }

        setAnalysisProgress('Matching items to your specs...')
        const analysisData = await res.json()

        const specRes = await fetch(`/api/projects/${projectId}/ffe-specs`)
        let fetchedSpecItems: any[] = []
        if (specRes.ok) {
          const specData = await specRes.json()
          const items = specData.items || []
          fetchedSpecItems = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            sku: item.sku,
            brand: item.brand,
            imageUrl: item.images?.[0],
            roomName: item.roomName,
            existingSupplierId: item.supplierId,
            existingSupplierName: item.supplierName,
            existingTradePrice: item.tradePrice ? Number(item.tradePrice) : undefined
          }))
        }

        handleClose()
        onAnalysisComplete(analysisData, fetchedSpecItems)

      } catch (error: any) {
        console.error('Error analyzing quote:', error)
        toast.error(error.message || 'Failed to analyze quote')
        setAnalyzing(false)
        setAnalysisProgress('')
      }
    }
  }

  const handleManualLink = async () => {
    if (!uploadedFile || !selectedSupplierId) {
      toast.error('Please select a supplier and upload a quote document')
      return
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)
    if (!selectedSupplier) {
      toast.error('Please select a valid supplier')
      return
    }

    const itemsToLink = Object.values(selectedItems)
    if (itemsToLink.length === 0) {
      toast.error('Please select at least one item to link')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/manual-quote/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: uploadedFile.url,
          fileType: uploadedFile.type,
          supplierId: selectedSupplierId,
          supplierName: selectedSupplier.name,
          items: itemsToLink
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to link quote')
      }

      toast.success(`Quote linked to ${itemsToLink.length} items`)
      handleClose()
      onManualLinkComplete?.()

    } catch (error: any) {
      console.error('Error linking quote:', error)
      toast.error(error.message || 'Failed to link quote')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (analyzing || saving) return
    onOpenChange(false)
  }

  const toggleItemSelection = (item: SpecItem, includeComponents = true) => {
    setSelectedItems(prev => {
      const newState = { ...prev }

      if (prev[item.id]) {
        // Deselecting - remove item and its components
        delete newState[item.id]
        if (includeComponents && item.components) {
          item.components.forEach(comp => {
            const compKey = `${item.id}-comp-${comp.id}`
            delete newState[compKey]
          })
        }
      } else {
        // Selecting - add item and its components
        newState[item.id] = {
          specItemId: item.id,
          unitPrice: item.existingTradePrice || 0,
          quantity: item.quantity
        }
        if (includeComponents && item.components) {
          item.components.forEach(comp => {
            const compKey = `${item.id}-comp-${comp.id}`
            newState[compKey] = {
              specItemId: item.id,
              unitPrice: comp.price || 0,
              quantity: comp.quantity || 1,
              isComponent: true,
              parentItemId: item.id,
              componentId: comp.id
            }
          })
        }
      }

      return newState
    })
  }

  const toggleComponentSelection = (item: SpecItem, comp: Component) => {
    const compKey = `${item.id}-comp-${comp.id}`
    setSelectedItems(prev => {
      if (prev[compKey]) {
        const { [compKey]: removed, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [compKey]: {
          specItemId: item.id,
          unitPrice: comp.price || 0,
          quantity: comp.quantity || 1,
          isComponent: true,
          parentItemId: item.id,
          componentId: comp.id
        }
      }
    })
  }

  const updateItemPrice = (itemId: string, price: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], unitPrice: price }
    }))
  }

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity }
    }))
  }

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  // Get unique room names for filter (from filtered items based on supplier/showAll setting)
  const supplierItems = selectedSupplierId && !showAllItems
    ? specItems.filter(item => item.existingSupplierId === selectedSupplierId)
    : specItems
  const roomNames = Array.from(new Set(supplierItems.map(item => item.roomName).filter(Boolean))) as string[]

  // Filter spec items by supplier (unless showAllItems), search, and room
  const filteredSpecItems = specItems.filter(item => {
    // Supplier filter - only apply if not showing all items
    if (selectedSupplierId && !showAllItems && item.existingSupplierId !== selectedSupplierId) return false

    // Room filter
    if (selectedRoom !== 'all' && item.roomName !== selectedRoom) return false

    // Search filter
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(query) ||
      item.sku?.toLowerCase().includes(query) ||
      item.brand?.toLowerCase().includes(query) ||
      item.roomName?.toLowerCase().includes(query)
    )
  })

  // Group items by room for display
  const itemsByRoom = filteredSpecItems.reduce((acc, item) => {
    const room = item.roomName || 'Uncategorized'
    if (!acc[room]) acc[room] = []
    acc[room].push(item)
    return acc
  }, {} as Record<string, SpecItem[]>)

  // Count selected items (excluding components in count for display)
  const selectedMainItemsCount = Object.values(selectedItems).filter(i => !i.isComponent).length
  const selectedComponentsCount = Object.values(selectedItems).filter(i => i.isComponent).length

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={mode === 'manual' && uploadedFile && selectedSupplierId ? "sm:max-w-4xl max-h-[90vh]" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Supplier Quote
          </DialogTitle>
        </DialogHeader>

        {/* Analyzing State */}
        {analyzing ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Quote</h3>
            <p className="text-sm text-gray-600 text-center max-w-xs">
              {analysisProgress || 'Please wait while AI extracts and matches line items...'}
            </p>
            <p className="text-xs text-gray-400 mt-4">This may take up to a minute</p>
          </div>
        ) : (
          <>
            <div className="space-y-5 py-2">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('ai')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mode === 'ai'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`w-5 h-5 ${mode === 'ai' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-medium ${mode === 'ai' ? 'text-blue-900' : 'text-gray-700'}`}>
                      AI Analysis
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    AI extracts items and matches to your specs automatically
                  </p>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    mode === 'manual'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className={`w-5 h-5 ${mode === 'manual' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className={`font-medium ${mode === 'manual' ? 'text-emerald-900' : 'text-gray-700'}`}>
                      Manual Link
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Select items manually and enter prices yourself
                  </p>
                </button>
              </div>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label>Select Supplier *</Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={setSelectedSupplierId}
                  disabled={loadingSuppliers}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select a supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        <div className="flex items-center gap-2">
                          {supplier.logo ? (
                            <img
                              src={supplier.logo}
                              alt={supplier.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                              <Building2 className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          <span>{supplier.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier && (
                  <p className="text-xs text-gray-500">{selectedSupplier.email}</p>
                )}
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Quote Document *</Label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <FileText className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium text-gray-900 text-sm truncate" title={uploadedFile.name}>
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploadedFile.type === 'application/pdf' ? 'PDF Document' : 'Image'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => setUploadedFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      {uploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-gray-600">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm font-medium text-gray-700">
                            Click to upload quote
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PDF or image (max 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Manual Link: Item Selection */}
              {mode === 'manual' && uploadedFile && selectedSupplierId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="flex-shrink-0">
                      Select Items ({selectedMainItemsCount} items{selectedComponentsCount > 0 ? ` + ${selectedComponentsCount} components` : ''})
                    </Label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                        <Checkbox
                          checked={showAllItems}
                          onCheckedChange={(checked) => setShowAllItems(checked === true)}
                        />
                        <span>All Items</span>
                      </label>
                      <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                        <SelectTrigger className="h-8 w-36 text-sm">
                          <SelectValue placeholder="All Rooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Rooms</SelectItem>
                          {roomNames.map(room => (
                            <SelectItem key={room} value={room}>{room}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 h-8 w-36 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {loadingSpecs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px] border rounded-lg">
                      <div className="p-2 space-y-4">
                        {Object.entries(itemsByRoom).map(([roomName, items]) => (
                          <div key={roomName}>
                            <div className="sticky top-0 bg-gray-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-sm text-gray-700">{roomName}</span>
                              <span className="text-xs text-gray-500">({items.length})</span>
                            </div>
                            <div className="space-y-2">
                              {items.map(item => {
                                const isSelected = !!selectedItems[item.id]
                                const hasComponents = item.components && item.components.length > 0
                                return (
                                  <div key={item.id} className="space-y-1">
                                    <div
                                      className={`p-3 rounded-lg border transition-colors ${
                                        isSelected
                                          ? 'border-emerald-300 bg-emerald-50'
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleItemSelection(item)}
                                          className="mt-1"
                                        />
                                        {item.imageUrl && (
                                          <img
                                            src={item.imageUrl}
                                            alt=""
                                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                                          />
                                        )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm">
                                    {item.name}
                                    {hasComponents && (
                                      <span className="ml-2 text-xs font-normal text-blue-600">
                                        +{item.components!.length} component{item.components!.length > 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                                    {item.sku && <span>SKU: {item.sku}</span>}
                                    {item.brand && <span>{item.brand}</span>}
                                  </div>
                                  {item.existingTradePrice && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Current: {formatCurrency(item.existingTradePrice)}
                                      {item.existingSupplierName && ` from ${item.existingSupplierName}`}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                      <Label className="text-xs text-gray-500">Qty:</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={selectedItems[item.id]?.quantity || item.quantity}
                                        onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                        className="w-16 h-7 text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Label className="text-xs text-gray-500">$</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        placeholder="Price"
                                        value={selectedItems[item.id]?.unitPrice || ''}
                                        onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                        className="w-24 h-7 text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                                    {/* Components display - indented under parent */}
                                    {isSelected && hasComponents && (
                                      <div className="ml-6 space-y-1">
                                        {item.components!.map(comp => {
                                          const compKey = `${item.id}-comp-${comp.id}`
                                          const isCompSelected = !!selectedItems[compKey]
                                          return (
                                            <div
                                              key={comp.id}
                                              className={`p-2 rounded-lg border transition-colors ${
                                                isCompSelected
                                                  ? 'border-blue-300 bg-blue-50'
                                                  : 'border-gray-200 bg-gray-50'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Checkbox
                                                  checked={isCompSelected}
                                                  onCheckedChange={() => toggleComponentSelection(item, comp)}
                                                  className="h-4 w-4"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm text-gray-700">
                                                    <span className="text-blue-600 mr-1">↳</span>
                                                    {comp.name}
                                                    {comp.modelNumber && <span className="text-xs text-gray-400 ml-1">({comp.modelNumber})</span>}
                                                  </p>
                                                </div>
                                                {isCompSelected && (
                                                  <div className="flex items-center gap-1">
                                                    <Label className="text-xs text-gray-500">$</Label>
                                                    <Input
                                                      type="number"
                                                      min={0}
                                                      step={0.01}
                                                      placeholder="Price"
                                                      value={selectedItems[compKey]?.unitPrice || ''}
                                                      onChange={(e) => {
                                                        const price = parseFloat(e.target.value) || 0
                                                        setSelectedItems(prev => ({
                                                          ...prev,
                                                          [compKey]: { ...prev[compKey], unitPrice: price }
                                                        }))
                                                      }}
                                                      className="w-20 h-6 text-xs"
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                  </div>
                                                )}
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
                          </div>
                        ))}
                        {Object.keys(itemsByRoom).length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm font-medium">No items found</p>
                            {selectedSupplierId && !showAllItems && supplierItems.length === 0 && (
                              <p className="text-xs mt-1">
                                No items in All Specs are assigned to {selectedSupplier?.name || 'this supplier'}.
                                <br />
                                <button
                                  type="button"
                                  className="text-blue-600 hover:underline mt-1"
                                  onClick={() => setShowAllItems(true)}
                                >
                                  Show all items
                                </button>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Info Box */}
              {mode === 'ai' && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-blue-800">
                    <p className="font-medium">How AI Analysis works:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
                      <li>AI will extract line items from the quote</li>
                      <li>Items will be matched to your All Specs</li>
                      <li>Review and approve matches</li>
                      <li>Trade prices will be updated</li>
                    </ol>
                  </div>
                </div>
              )}

              {mode === 'manual' && !uploadedFile && (
                <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-emerald-800">
                    <p className="font-medium">How Manual Link works:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
                      <li>Upload the quote document for reference</li>
                      <li>Select items from your All Specs</li>
                      <li>Enter the quoted price for each item</li>
                      <li>Quote will be linked and prices updated</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {mode === 'ai' ? (
                <Button
                  onClick={handleAIAnalysis}
                  disabled={!uploadedFile || !selectedSupplierId}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Quote
                </Button>
              ) : (
                <Button
                  onClick={handleManualLink}
                  disabled={!uploadedFile || !selectedSupplierId || Object.keys(selectedItems).length === 0 || saving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Link Quote ({Object.keys(selectedItems).length} items)
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
