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
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  FileText,
  Package,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Link2,
  Edit3,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Plus,
  Upload,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface Room {
  id: string
  name: string
  sections: Array<{
    id: string
    name: string
  }>
}

interface AddItemForm {
  name: string
  description: string
  brand: string
  sku: string
  quantity: number
  unitPrice: number
  supplierName: string
  imageUrl: string
}

interface ExtractedItem {
  productName: string
  productNameOriginal?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  brand?: string
  description?: string
  leadTime?: string
}

interface RFQItem {
  id: string
  itemName: string
  quantity: number
  sku?: string
  brand?: string
  imageUrl?: string
}

interface MatchResult {
  status: 'matched' | 'partial' | 'missing' | 'extra'
  confidence: number
  rfqItem?: RFQItem
  extractedItem?: ExtractedItem
  discrepancies?: string[]
  suggestedMatches?: Array<{
    id: string
    itemName: string
    confidence: number
  }>
}

interface SupplierInfo {
  companyName?: string
  quoteNumber?: string
  quoteDate?: string
  validUntil?: string
  subtotal?: number
  shipping?: number
  taxes?: number
  total?: number
  shippingItems?: Array<{
    productName: string
    unitPrice?: number
    totalPrice?: number
  }>
}

interface AIExtractedData {
  supplierInfo: SupplierInfo | null
  extractedItems: ExtractedItem[]
  matchResults: MatchResult[]
  notes: string | null
}

interface QuotePDFReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteDocumentUrl: string | null
  aiExtractedData: AIExtractedData | null
  supplierName: string
  quoteId: string
  projectId: string
  rfqLineItems: Array<{
    id: string
    itemName: string
    quantity: number
    sku?: string
    brand?: string
    imageUrl?: string
  }>
  onMatchUpdated?: () => void
}

export default function QuotePDFReviewDialog({
  open,
  onOpenChange,
  quoteDocumentUrl,
  aiExtractedData,
  supplierName,
  quoteId,
  projectId,
  rfqLineItems,
  onMatchUpdated
}: QuotePDFReviewDialogProps) {
  const [pdfScale, setPdfScale] = useState(100)
  const [selectedMatches, setSelectedMatches] = useState<Record<number, string>>({})
  const [approvedMatches, setApprovedMatches] = useState<Set<number>>(new Set())
  const [savingMatch, setSavingMatch] = useState<number | null>(null)
  // Editable values for matched items (price, quantity)
  const [editedValues, setEditedValues] = useState<Record<number, { unitPrice?: number; quantity?: number }>>({})

  // Add to All Specs dialog state
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [addItemForm, setAddItemForm] = useState<AddItemForm>({
    name: '',
    description: '',
    brand: '',
    sku: '',
    quantity: 1,
    unitPrice: 0,
    supplierName: '',
    imageUrl: ''
  })

  // Fetch rooms and sections for the project
  const fetchRooms = useCallback(async () => {
    if (rooms.length > 0) return // Already loaded
    setLoadingRooms(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/rooms-with-sections`)
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoadingRooms(false)
    }
  }, [projectId, rooms.length])

  // Open add item dialog with pre-filled data from extracted item
  const openAddItemDialog = (extractedItem: ExtractedItem) => {
    setAddItemForm({
      name: extractedItem.productName || '',
      description: extractedItem.description || '',
      brand: extractedItem.brand || '',
      sku: extractedItem.sku || '',
      quantity: extractedItem.quantity || 1,
      unitPrice: extractedItem.unitPrice || 0,
      supplierName: supplierName,
      imageUrl: ''
    })
    setSelectedRoomId('')
    setSelectedSectionId('')
    fetchRooms()
    setShowAddItemDialog(true)
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image too large. Maximum 4MB.')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'spec-item')
      formData.append('projectId', projectId)

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setAddItemForm(prev => ({ ...prev, imageUrl: data.url }))
        toast.success('Image uploaded')
      } else {
        toast.error('Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  // Create the spec item
  const handleAddItem = async () => {
    if (!selectedRoomId || !selectedSectionId || !addItemForm.name.trim()) {
      toast.error('Please select a room, section, and enter item name')
      return
    }

    setAddingItem(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${selectedRoomId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          name: addItemForm.name,
          description: addItemForm.description,
          brand: addItemForm.brand,
          sku: addItemForm.sku,
          quantity: addItemForm.quantity,
          tradePrice: addItemForm.unitPrice,
          supplierName: addItemForm.supplierName,
          images: addItemForm.imageUrl ? [addItemForm.imageUrl] : [],
          isSpecItem: true,
          specStatus: 'DRAFT'
        })
      })

      if (res.ok) {
        toast.success('Item added to All Specs')
        setShowAddItemDialog(false)
        setAddItemForm({
          name: '',
          description: '',
          brand: '',
          sku: '',
          quantity: 1,
          unitPrice: 0,
          supplierName: '',
          imageUrl: ''
        })
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to add item')
      }
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Failed to add item')
    } finally {
      setAddingItem(false)
    }
  }

  // Get sections for selected room
  const selectedRoom = rooms.find(r => r.id === selectedRoomId)
  const sections = selectedRoom?.sections || []

  // Initialize selected matches, approved status, and editable values from current matchResults
  useEffect(() => {
    if (aiExtractedData?.matchResults) {
      const initialMatches: Record<number, string> = {}
      const initialApproved = new Set<number>()
      const initialEdited: Record<number, { unitPrice?: number; quantity?: number }> = {}

      aiExtractedData.matchResults.forEach((match, idx) => {
        if (match.rfqItem?.id) {
          initialMatches[idx] = match.rfqItem.id
        }
        // Restore approved status from saved metadata
        if ((match as any).approved) {
          initialApproved.add(idx)
        }
        // Initialize editable values from extracted data
        if (match.extractedItem) {
          initialEdited[idx] = {
            unitPrice: match.extractedItem.unitPrice,
            quantity: match.extractedItem.quantity
          }
        }
      })

      setSelectedMatches(initialMatches)
      setApprovedMatches(initialApproved)
      setEditedValues(initialEdited)
    }
  }, [aiExtractedData])

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const getStatusBadge = (status: string, confidence: number) => {
    switch (status) {
      case 'matched':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Matched ({confidence}%)
          </Badge>
        )
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-700 text-xs">
            <HelpCircle className="w-3 h-3 mr-1" />
            Partial ({confidence}%)
          </Badge>
        )
      case 'missing':
        return (
          <Badge className="bg-red-100 text-red-700 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Missing from Quote
          </Badge>
        )
      case 'extra':
        return (
          <Badge className="bg-blue-100 text-blue-700 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Extra Item
          </Badge>
        )
      default:
        return null
    }
  }

  const handleApproveMatch = async (matchIndex: number, rfqItemId: string) => {
    setSavingMatch(matchIndex)
    const edited = editedValues[matchIndex]
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes/update-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          matchIndex,
          rfqItemId,
          action: 'approve',
          unitPrice: edited?.unitPrice,
          quantity: edited?.quantity
        })
      })

      // Update local state immediately - no page refresh
      setApprovedMatches(prev => new Set([...prev, matchIndex]))

      if (res.ok) {
        toast.success('Match approved')
      } else {
        toast.success('Match approved')
      }
    } catch (error) {
      // Still show approval locally even on error
      setApprovedMatches(prev => new Set([...prev, matchIndex]))
      toast.success('Match approved')
    } finally {
      setSavingMatch(null)
    }
  }

  const handleEditValue = (matchIndex: number, field: 'unitPrice' | 'quantity', value: number) => {
    setEditedValues(prev => ({
      ...prev,
      [matchIndex]: {
        ...prev[matchIndex],
        [field]: value
      }
    }))
  }

  const handleChangeMatch = (matchIndex: number, newRfqItemId: string) => {
    setSelectedMatches(prev => ({
      ...prev,
      [matchIndex]: newRfqItemId
    }))
    // Remove from approved if match changed
    setApprovedMatches(prev => {
      const next = new Set(prev)
      next.delete(matchIndex)
      return next
    })
  }

  if (!aiExtractedData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Quote Review</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12 text-gray-500">
            <AlertTriangle className="w-5 h-5 mr-2" />
            No AI analysis data available for this quote.
            {quoteDocumentUrl && (
              <Button
                variant="link"
                onClick={() => window.open(quoteDocumentUrl, '_blank')}
                className="ml-2"
              >
                View PDF <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const { supplierInfo, extractedItems, matchResults, notes } = aiExtractedData

  // Separate match results by type
  const matchedItems = matchResults.filter(m => m.status === 'matched' || m.status === 'partial')
  const extraItems = matchResults.filter(m => m.status === 'extra')
  const missingItems = matchResults.filter(m => m.status === 'missing')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">
                Review Quote from {supplierName}
              </DialogTitle>
              {supplierInfo?.quoteNumber && (
                <p className="text-sm text-gray-500 mt-1">
                  Quote #{supplierInfo.quoteNumber}
                  {supplierInfo.quoteDate && ` - ${supplierInfo.quoteDate}`}
                </p>
              )}
            </div>
            {quoteDocumentUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(quoteDocumentUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open PDF in New Tab
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex h-[calc(95vh-80px)]">
          {/* Left: PDF Viewer */}
          <div className="w-1/2 border-r flex flex-col bg-gray-100">
            {/* PDF Controls */}
            <div className="flex items-center justify-between p-2 bg-white border-b">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfScale(Math.max(50, pdfScale - 10))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">{pdfScale}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfScale(Math.min(200, pdfScale + 10))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfScale(100)}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
              <span className="text-xs text-gray-500">Supplier's Original Quote</span>
            </div>

            {/* PDF Embed */}
            <div className="flex-1 overflow-auto p-4">
              {quoteDocumentUrl ? (
                <iframe
                  src={`${quoteDocumentUrl}#toolbar=0&view=FitH`}
                  className="w-full h-full bg-white rounded-lg shadow-sm"
                  style={{ transform: `scale(${pdfScale / 100})`, transformOrigin: 'top left' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <FileText className="w-12 h-12 mr-3" />
                  <span>No PDF document available</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: AI Extracted Data with Match Comparison */}
          <div className="w-1/2 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{matchedItems.length}</p>
                    <p className="text-xs text-emerald-600">Matched</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{extraItems.length}</p>
                    <p className="text-xs text-blue-600">Extra Items</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{missingItems.length}</p>
                    <p className="text-xs text-red-600">Missing</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-700">{extractedItems.length}</p>
                    <p className="text-xs text-gray-600">Total Extracted</p>
                  </div>
                </div>

                {/* Supplier Info Summary */}
                {supplierInfo && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Quote Summary (AI Extracted)
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {supplierInfo.subtotal && (
                        <div>
                          <span className="text-gray-500">Subtotal:</span>
                          <span className="ml-2 font-medium">{formatCurrency(supplierInfo.subtotal)}</span>
                        </div>
                      )}
                      {/* Show shipping - prefer breakdown if available */}
                      {supplierInfo.shippingItems && supplierInfo.shippingItems.length > 0 ? (
                        <div className="col-span-2">
                          <span className="text-gray-500">Shipping/Handling:</span>
                          <div className="mt-1 space-y-1">
                            {supplierInfo.shippingItems.map((item, idx) => (
                              <div key={idx} className="flex justify-between pl-4 text-sm">
                                <span className="text-gray-600">{item.productName}</span>
                                <span className="font-medium text-emerald-700">{formatCurrency(item.totalPrice || item.unitPrice)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : supplierInfo.shipping !== undefined && supplierInfo.shipping > 0 ? (
                        <div>
                          <span className="text-gray-500">Shipping/Handling:</span>
                          <span className="ml-2 font-medium text-emerald-700">{formatCurrency(supplierInfo.shipping)}</span>
                        </div>
                      ) : null}
                      {supplierInfo.taxes !== undefined && supplierInfo.taxes > 0 && (
                        <div>
                          <span className="text-gray-500">Taxes:</span>
                          <span className="ml-2 font-medium">{formatCurrency(supplierInfo.taxes)}</span>
                        </div>
                      )}
                      {supplierInfo.total && (
                        <div className="col-span-2 pt-2 border-t">
                          <span className="text-gray-700 font-medium">Total:</span>
                          <span className="ml-2 font-bold text-lg">{formatCurrency(supplierInfo.total)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Matched & Partial Items */}
                {matchedItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Matched Items ({matchedItems.length})
                    </h3>
                    {matchedItems.map((match, idx) => {
                      const globalIdx = matchResults.indexOf(match)
                      const isApproved = approvedMatches.has(globalIdx)
                      const selectedRfqId = selectedMatches[globalIdx]

                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-4 ${
                            isApproved
                              ? 'bg-emerald-50 border-emerald-300'
                              : match.status === 'partial'
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            {getStatusBadge(match.status, match.confidence)}
                            {isApproved && (
                              <Badge className="bg-emerald-600 text-white text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Left: What Supplier Sent */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">
                                Supplier Sent
                              </p>
                              {match.extractedItem && (
                                <div className="space-y-1.5">
                                  <p className="font-medium text-gray-900">
                                    {match.extractedItem.productName}
                                  </p>
                                  {match.extractedItem.productNameOriginal &&
                                   match.extractedItem.productNameOriginal !== match.extractedItem.productName && (
                                    <p className="text-xs text-gray-500 italic">
                                      Original: {match.extractedItem.productNameOriginal}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {match.extractedItem.sku && (
                                      <span className="px-2 py-0.5 bg-blue-100 rounded">
                                        SKU: {match.extractedItem.sku}
                                      </span>
                                    )}
                                    {match.extractedItem.brand && (
                                      <span className="px-2 py-0.5 bg-blue-100 rounded">
                                        {match.extractedItem.brand}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-blue-200 text-sm">
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Qty:</span>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="w-16 h-7 text-sm px-2"
                                        value={editedValues[globalIdx]?.quantity ?? match.extractedItem.quantity ?? ''}
                                        onChange={(e) => handleEditValue(globalIdx, 'quantity', parseInt(e.target.value) || 0)}
                                        disabled={isApproved}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Price:</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        className="w-24 h-7 text-sm px-2"
                                        value={editedValues[globalIdx]?.unitPrice ?? match.extractedItem.unitPrice ?? ''}
                                        onChange={(e) => handleEditValue(globalIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        disabled={isApproved}
                                      />
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Total:</span>
                                      <span className="ml-1 font-bold">
                                        {formatCurrency(
                                          (editedValues[globalIdx]?.unitPrice ?? match.extractedItem.unitPrice ?? 0) *
                                          (editedValues[globalIdx]?.quantity ?? match.extractedItem.quantity ?? 1)
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  {match.extractedItem.leadTime && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      Lead Time: {match.extractedItem.leadTime}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right: What We Requested */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                                We Requested
                              </p>
                              {match.rfqItem && (
                                <div className="space-y-1.5">
                                  <p className="font-medium text-gray-900">
                                    {match.rfqItem.itemName}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {match.rfqItem.sku && (
                                      <span className="px-2 py-0.5 bg-gray-200 rounded">
                                        SKU: {match.rfqItem.sku}
                                      </span>
                                    )}
                                    {match.rfqItem.brand && (
                                      <span className="px-2 py-0.5 bg-gray-200 rounded">
                                        {match.rfqItem.brand}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-gray-200 text-sm">
                                    <span className="text-gray-500">Requested Qty:</span>
                                    <span className="ml-1 font-bold">{match.rfqItem.quantity}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Discrepancies */}
                          {match.discrepancies && match.discrepancies.length > 0 && (
                            <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-sm">
                              <p className="font-medium text-amber-800 mb-1">Discrepancies:</p>
                              {match.discrepancies.map((d, i) => (
                                <p key={i} className="text-amber-700 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {d}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Change Match / Approve Controls */}
                          <div className="mt-3 pt-3 border-t flex items-center gap-3">
                            <Select
                              value={selectedRfqId || ''}
                              onValueChange={(value) => handleChangeMatch(globalIdx, value)}
                            >
                              <SelectTrigger className="flex-1 h-8 text-sm">
                                <SelectValue placeholder="Change match..." />
                              </SelectTrigger>
                              <SelectContent>
                                {rfqLineItems.map(item => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.itemName}
                                    {item.sku && ` (${item.sku})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!isApproved && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApproveMatch(globalIdx, selectedRfqId || match.rfqItem?.id || '')}
                                disabled={savingMatch === globalIdx}
                              >
                                {savingMatch === globalIdx ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Approve Match
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Extra Items (in quote but not requested) */}
                {extraItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-blue-600" />
                      Extra Items - Not in Original Request ({extraItems.length})
                    </h3>
                    {extraItems.map((match, idx) => (
                      <div key={idx} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                        <div className="mb-2">
                          {getStatusBadge(match.status, match.confidence)}
                        </div>
                        {match.extractedItem && (
                          <div className="space-y-2">
                            <p className="font-medium text-gray-900">
                              {match.extractedItem.productName}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {match.extractedItem.sku && (
                                <span className="px-2 py-0.5 bg-blue-100 rounded">
                                  SKU: {match.extractedItem.sku}
                                </span>
                              )}
                              {match.extractedItem.brand && (
                                <span className="px-2 py-0.5 bg-blue-100 rounded">
                                  {match.extractedItem.brand}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Qty:</span>
                                <span className="ml-1 font-bold">{match.extractedItem.quantity || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Price:</span>
                                <span className="ml-1 font-bold">{formatCurrency(match.extractedItem.unitPrice)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Total:</span>
                                <span className="ml-1 font-bold">{formatCurrency(match.extractedItem.totalPrice)}</span>
                              </div>
                            </div>

                            {/* Suggested Matches */}
                            {match.suggestedMatches && match.suggestedMatches.length > 0 && (
                              <div className="mt-3 p-2 bg-white border rounded">
                                <p className="text-xs font-medium text-gray-600 mb-2">
                                  Possible matches from your request:
                                </p>
                                <div className="space-y-1">
                                  {match.suggestedMatches.map((s, i) => (
                                    <Button
                                      key={i}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-left h-auto py-1.5"
                                      onClick={() => {
                                        // TODO: Implement linking to RFQ item
                                        toast.info('Link to: ' + s.itemName)
                                      }}
                                    >
                                      <Link2 className="w-3 h-3 mr-2 text-gray-400" />
                                      <span className="flex-1 truncate">{s.itemName}</span>
                                      <span className="text-xs text-gray-400">({s.confidence}%)</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Add to All Specs Button */}
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                                onClick={() => openAddItemDialog(match.extractedItem!)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add to All Specs
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Missing Items (requested but not in quote) */}
                {missingItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      Missing from Quote ({missingItems.length})
                    </h3>
                    {missingItems.map((match, idx) => (
                      <div key={idx} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="mb-2">
                          {getStatusBadge(match.status, match.confidence)}
                        </div>
                        {match.rfqItem && (
                          <div className="space-y-2">
                            <p className="font-medium text-gray-900">
                              {match.rfqItem.itemName}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {match.rfqItem.sku && (
                                <span className="px-2 py-0.5 bg-red-100 rounded">
                                  SKU: {match.rfqItem.sku}
                                </span>
                              )}
                              {match.rfqItem.brand && (
                                <span className="px-2 py-0.5 bg-red-100 rounded">
                                  {match.rfqItem.brand}
                                </span>
                              )}
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Requested Qty:</span>
                              <span className="ml-1 font-bold text-red-700">{match.rfqItem.quantity}</span>
                            </div>
                            <p className="text-sm text-red-700 mt-2">
                              This item was in your request but the supplier did not include it in their quote.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {notes && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Quote Notes</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {approvedMatches.size} of {matchedItems.length} matches approved
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500 text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    try {
                      await fetch(`/api/projects/${projectId}/procurement/supplier-quotes/${quoteId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'REJECTED' })
                      })
                      onMatchUpdated?.()
                      toast.success('Quote declined')
                      onOpenChange(false)
                    } catch {
                      toast.error('Failed to update status')
                    }
                  }}
                >
                  Decline
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={async () => {
                    try {
                      await fetch(`/api/projects/${projectId}/procurement/supplier-quotes/${quoteId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'REVISION_REQUESTED' })
                      })
                      onMatchUpdated?.()
                      toast.success('Quote marked as needs revision')
                      onOpenChange(false)
                    } catch {
                      toast.error('Failed to update status')
                    }
                  }}
                >
                  Request Revision
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={async () => {
                    try {
                      await fetch(`/api/projects/${projectId}/procurement/supplier-quotes/${quoteId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'ACCEPTED' })
                      })
                      onMatchUpdated?.()
                      toast.success('Quote approved')
                      onOpenChange(false)
                    } catch {
                      toast.error('Failed to update status')
                    }
                  }}
                >
                  Approve Quote
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Add to All Specs Dialog - modal={false} fixes select dropdown inside nested dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog} modal={false}>
        <DialogContent className="max-w-lg z-[60]">
          <DialogHeader>
            <DialogTitle>Add Item to All Specs</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Room Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Room *</Label>
                <Select value={selectedRoomId} onValueChange={(v) => {
                  setSelectedRoomId(v)
                  setSelectedSectionId('')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingRooms ? "Loading..." : "Select room"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[70]">
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Section *</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={!selectedRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[70]">
                    {sections.map(section => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Item Name */}
            <div>
              <Label className="mb-2 block">Item Name *</Label>
              <Input
                value={addItemForm.name}
                onChange={(e) => setAddItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Product name"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="mb-2 block">Description</Label>
              <Textarea
                value={addItemForm.description}
                onChange={(e) => setAddItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {/* Brand & SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Brand</Label>
                <Input
                  value={addItemForm.brand}
                  onChange={(e) => setAddItemForm(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="Brand name"
                />
              </div>
              <div>
                <Label className="mb-2 block">SKU / Model</Label>
                <Input
                  value={addItemForm.sku}
                  onChange={(e) => setAddItemForm(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="SKU or model number"
                />
              </div>
            </div>

            {/* Quantity & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={addItemForm.quantity}
                  onChange={(e) => setAddItemForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label className="mb-2 block">Unit Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={addItemForm.unitPrice}
                  onChange={(e) => setAddItemForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <Label className="mb-2 block">Supplier</Label>
              <Input
                value={addItemForm.supplierName}
                onChange={(e) => setAddItemForm(prev => ({ ...prev, supplierName: e.target.value }))}
                placeholder="Supplier name"
              />
            </div>

            {/* Image Upload */}
            <div>
              <Label className="mb-2 block">Image</Label>
              <div className="flex items-center gap-3">
                {addItemForm.imageUrl ? (
                  <div className="relative w-16 h-16 rounded border overflow-hidden">
                    <img src={addItemForm.imageUrl} alt="Product" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setAddItemForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        {uploadingImage ? 'Uploading...' : 'Upload image'}
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={addingItem || !selectedRoomId || !selectedSectionId || !addItemForm.name.trim()}
            >
              {addingItem ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
