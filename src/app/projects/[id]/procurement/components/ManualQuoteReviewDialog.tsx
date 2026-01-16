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
import {
  Check,
  X,
  AlertTriangle,
  FileText,
  Package,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Link2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  Building2,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

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

interface SpecItem {
  id: string
  name: string
  quantity: number
  sku?: string
  brand?: string
  imageUrl?: string
  roomName?: string
  existingSupplierId?: string
  existingSupplierName?: string
  existingTradePrice?: number
}

interface MatchResult {
  status: 'matched' | 'partial' | 'unmatched'
  confidence: number
  specItem?: SpecItem
  extractedItem: ExtractedItem
  suggestedMatches?: Array<{
    id: string
    name: string
    confidence: number
    roomName?: string
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
}

interface ManualQuoteReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  data: {
    supplierInfo: SupplierInfo
    matchResults: MatchResult[]
    summary: {
      totalExtracted: number
      matched: number
      partial: number
      unmatched: number
      totalSpecItems: number
    }
    notes: string | null
    supplierId: string
    supplierName: string
    fileUrl: string
  } | null
  allSpecItems: SpecItem[]
  onApproveComplete: () => void
}

export default function ManualQuoteReviewDialog({
  open,
  onOpenChange,
  projectId,
  data,
  allSpecItems,
  onApproveComplete
}: ManualQuoteReviewDialogProps) {
  const [pdfScale, setPdfScale] = useState(100)
  const [matchAssignments, setMatchAssignments] = useState<Record<number, string>>({})
  const [editedPrices, setEditedPrices] = useState<Record<number, number>>({})
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({})
  const [approving, setApproving] = useState(false)
  const [supplierChangeConfirmation, setSupplierChangeConfirmation] = useState<{
    index: number
    currentSupplier: string
    newSupplier: string
    specItemName: string
  } | null>(null)

  // Initialize match assignments from data
  useEffect(() => {
    if (data?.matchResults) {
      const initial: Record<number, string> = {}
      const prices: Record<number, number> = {}
      const quantities: Record<number, number> = {}

      data.matchResults.forEach((match, idx) => {
        if (match.specItem?.id) {
          initial[idx] = match.specItem.id
        }
        if (match.extractedItem.unitPrice) {
          prices[idx] = match.extractedItem.unitPrice
        }
        if (match.extractedItem.quantity) {
          quantities[idx] = match.extractedItem.quantity
        }
      })

      setMatchAssignments(initial)
      setEditedPrices(prices)
      setEditedQuantities(quantities)
    }
  }, [data])

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
      case 'unmatched':
        return (
          <Badge className="bg-red-100 text-red-700 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Not Matched
          </Badge>
        )
      default:
        return null
    }
  }

  const handleMatchChange = (index: number, newSpecItemId: string) => {
    // Check if the target spec item already has a different supplier
    const targetSpec = allSpecItems.find(s => s.id === newSpecItemId)
    const currentSpecId = matchAssignments[index]
    const currentMatch = data?.matchResults[index]

    if (targetSpec?.existingSupplierId && targetSpec.existingSupplierId !== data?.supplierId) {
      // Show confirmation dialog
      setSupplierChangeConfirmation({
        index,
        currentSupplier: targetSpec.existingSupplierName || 'Unknown',
        newSupplier: data?.supplierName || 'Selected supplier',
        specItemName: targetSpec.name
      })
      return
    }

    // No conflict, proceed with change
    setMatchAssignments(prev => ({
      ...prev,
      [index]: newSpecItemId
    }))
  }

  const confirmSupplierChange = () => {
    if (supplierChangeConfirmation) {
      setMatchAssignments(prev => ({
        ...prev,
        [supplierChangeConfirmation.index]: allSpecItems.find(s =>
          s.name === supplierChangeConfirmation.specItemName
        )?.id || ''
      }))
      setSupplierChangeConfirmation(null)
    }
  }

  const handleApprove = async () => {
    if (!data) return

    // Validate that all items are matched
    const unmatchedCount = data.matchResults.filter((_, idx) => !matchAssignments[idx]).length
    if (unmatchedCount > 0) {
      toast.error(`Please match all ${unmatchedCount} unmatched items before approving`)
      return
    }

    setApproving(true)
    try {
      // Build the approval payload
      const items = data.matchResults.map((match, idx) => ({
        specItemId: matchAssignments[idx],
        unitPrice: editedPrices[idx] ?? match.extractedItem.unitPrice ?? 0,
        quantity: editedQuantities[idx] ?? match.extractedItem.quantity ?? 1,
        leadTime: match.extractedItem.leadTime
      }))

      const res = await fetch(`/api/projects/${projectId}/procurement/manual-quote/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          fileUrl: data.fileUrl,
          supplierInfo: data.supplierInfo,
          items
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to approve quote')
      }

      toast.success('Quote approved! Trade prices updated.')
      onApproveComplete()
      onOpenChange(false)

    } catch (error: any) {
      console.error('Error approving quote:', error)
      toast.error(error.message || 'Failed to approve quote')
    } finally {
      setApproving(false)
    }
  }

  if (!data) return null

  const { supplierInfo, matchResults, summary, notes, supplierName, fileUrl } = data
  const isPDF = fileUrl?.endsWith('.pdf') || fileUrl?.includes('application/pdf')

  // Count how many are properly matched
  const matchedCount = Object.keys(matchAssignments).length
  const allMatched = matchedCount === matchResults.length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Review Quote from {supplierName}
                </DialogTitle>
                {supplierInfo?.quoteNumber && (
                  <p className="text-sm text-gray-500 mt-1">
                    Quote #{supplierInfo.quoteNumber}
                    {supplierInfo.quoteDate && ` - ${supplierInfo.quoteDate}`}
                  </p>
                )}
              </div>
              {fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(fileUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Document
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex h-[calc(95vh-80px)]">
            {/* Left: Document Viewer */}
            <div className="w-1/2 border-r flex flex-col bg-gray-100">
              {/* Controls */}
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
                <span className="text-xs text-gray-500">Uploaded Quote</span>
              </div>

              {/* Document Display */}
              <div className="flex-1 overflow-auto p-4">
                {fileUrl ? (
                  isPDF ? (
                    <iframe
                      src={`${fileUrl}#toolbar=0&view=FitH`}
                      className="w-full h-full bg-white rounded-lg shadow-sm"
                      style={{ transform: `scale(${pdfScale / 100})`, transformOrigin: 'top left' }}
                    />
                  ) : (
                    <img
                      src={fileUrl}
                      alt="Quote document"
                      className="max-w-full rounded-lg shadow-sm"
                      style={{ transform: `scale(${pdfScale / 100})`, transformOrigin: 'top left' }}
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <FileText className="w-12 h-12 mr-3" />
                    <span>No document available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Extracted Items & Matching */}
            <div className="w-1/2 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{summary.matched}</p>
                      <p className="text-xs text-emerald-600">Matched</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-amber-700">{summary.partial}</p>
                      <p className="text-xs text-amber-600">Partial</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">{summary.unmatched}</p>
                      <p className="text-xs text-red-600">Unmatched</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-700">{summary.totalExtracted}</p>
                      <p className="text-xs text-gray-600">Total Items</p>
                    </div>
                  </div>

                  {/* Quote Summary */}
                  {supplierInfo && (supplierInfo.subtotal || supplierInfo.total) && (
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Quote Summary
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {supplierInfo.subtotal && (
                          <div>
                            <span className="text-gray-500">Subtotal:</span>
                            <span className="ml-2 font-medium">{formatCurrency(supplierInfo.subtotal)}</span>
                          </div>
                        )}
                        {supplierInfo.shipping !== undefined && supplierInfo.shipping > 0 && (
                          <div>
                            <span className="text-gray-500">Shipping:</span>
                            <span className="ml-2 font-medium">{formatCurrency(supplierInfo.shipping)}</span>
                          </div>
                        )}
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

                  {/* Extracted Items */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      Extracted Items ({matchResults.length})
                    </h3>

                    {matchResults.map((match, idx) => {
                      const assignedSpecId = matchAssignments[idx]
                      const assignedSpec = allSpecItems.find(s => s.id === assignedSpecId)
                      const hasSupplierConflict = assignedSpec?.existingSupplierId &&
                        assignedSpec.existingSupplierId !== data.supplierId

                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-4 ${
                            !assignedSpecId
                              ? 'bg-red-50 border-red-200'
                              : hasSupplierConflict
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            {getStatusBadge(match.status, match.confidence)}
                            {assignedSpecId && (
                              <Badge className="bg-emerald-600 text-white text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Assigned
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Left: Extracted from Quote */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">
                                From Quote
                              </p>
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
                                      value={editedQuantities[idx] ?? match.extractedItem.quantity ?? ''}
                                      onChange={(e) => setEditedQuantities(prev => ({
                                        ...prev,
                                        [idx]: parseInt(e.target.value) || 0
                                      }))}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500">Price:</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      className="w-24 h-7 text-sm px-2"
                                      value={editedPrices[idx] ?? match.extractedItem.unitPrice ?? ''}
                                      onChange={(e) => setEditedPrices(prev => ({
                                        ...prev,
                                        [idx]: parseFloat(e.target.value) || 0
                                      }))}
                                    />
                                  </div>
                                </div>
                                {match.extractedItem.leadTime && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    Lead Time: {match.extractedItem.leadTime}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right: Matched Spec Item */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                                Match to All Spec Item
                              </p>

                              <Select
                                value={assignedSpecId || ''}
                                onValueChange={(value) => handleMatchChange(idx, value)}
                              >
                                <SelectTrigger className="mb-2">
                                  <SelectValue placeholder="Select a spec item..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {allSpecItems.map(spec => (
                                    <SelectItem key={spec.id} value={spec.id}>
                                      <div className="flex items-center gap-2">
                                        {spec.imageUrl && (
                                          <img
                                            src={spec.imageUrl}
                                            alt=""
                                            className="w-6 h-6 rounded object-cover"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span className="truncate block">{spec.name}</span>
                                          {spec.roomName && (
                                            <span className="text-xs text-gray-400">[{spec.roomName}]</span>
                                          )}
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {assignedSpec && (
                                <div className="space-y-1.5 mt-2">
                                  <div className="flex items-center gap-2">
                                    {assignedSpec.imageUrl && (
                                      <img
                                        src={assignedSpec.imageUrl}
                                        alt=""
                                        className="w-10 h-10 rounded border object-cover"
                                      />
                                    )}
                                    <div>
                                      <p className="font-medium text-gray-900">{assignedSpec.name}</p>
                                      {assignedSpec.roomName && (
                                        <p className="text-xs text-gray-500">{assignedSpec.roomName}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {assignedSpec.sku && (
                                      <span className="px-2 py-0.5 bg-gray-200 rounded">
                                        SKU: {assignedSpec.sku}
                                      </span>
                                    )}
                                    {assignedSpec.brand && (
                                      <span className="px-2 py-0.5 bg-gray-200 rounded">
                                        {assignedSpec.brand}
                                      </span>
                                    )}
                                  </div>

                                  {/* Supplier conflict warning */}
                                  {hasSupplierConflict && (
                                    <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs">
                                      <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <p className="font-medium text-amber-800">Different supplier assigned</p>
                                          <p className="text-amber-700">
                                            Current: {assignedSpec.existingSupplierName}
                                            {assignedSpec.existingTradePrice &&
                                              ` (${formatCurrency(assignedSpec.existingTradePrice)})`}
                                          </p>
                                          <p className="text-amber-700">
                                            Will change to: {supplierName}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Suggested matches for unmatched */}
                              {!assignedSpecId && match.suggestedMatches && match.suggestedMatches.length > 0 && (
                                <div className="mt-2 p-2 bg-white border rounded">
                                  <p className="text-xs font-medium text-gray-600 mb-2">
                                    Suggestions:
                                  </p>
                                  <div className="space-y-1">
                                    {match.suggestedMatches.slice(0, 3).map((s, i) => (
                                      <Button
                                        key={i}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-left h-auto py-1.5 text-xs"
                                        onClick={() => handleMatchChange(idx, s.id)}
                                      >
                                        <Link2 className="w-3 h-3 mr-2 text-gray-400" />
                                        <span className="flex-1 truncate">{s.name}</span>
                                        <span className="text-gray-400">({s.confidence}%)</span>
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

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
                  {matchedCount} of {matchResults.length} items matched
                  {!allMatched && (
                    <span className="text-red-600 ml-2">
                      ({matchResults.length - matchedCount} need assignment)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleApprove}
                    disabled={!allMatched || approving}
                  >
                    {approving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Approve & Update Prices
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Change Confirmation Dialog */}
      <Dialog open={!!supplierChangeConfirmation} onOpenChange={() => setSupplierChangeConfirmation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Change Supplier?
            </DialogTitle>
          </DialogHeader>
          {supplierChangeConfirmation && (
            <div className="py-4">
              <p className="text-gray-700 mb-4">
                <strong>{supplierChangeConfirmation.specItemName}</strong> is currently assigned to{' '}
                <strong>{supplierChangeConfirmation.currentSupplier}</strong>.
              </p>
              <p className="text-gray-700">
                Do you want to change the supplier to{' '}
                <strong>{supplierChangeConfirmation.newSupplier}</strong>?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierChangeConfirmation(null)}>
              Cancel
            </Button>
            <Button onClick={confirmSupplierChange} className="bg-amber-600 hover:bg-amber-700">
              Yes, Change Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
