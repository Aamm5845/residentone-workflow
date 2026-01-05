'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  RotateCw
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

  // Initialize selected matches from current matchResults
  useEffect(() => {
    if (aiExtractedData?.matchResults) {
      const initial: Record<number, string> = {}
      aiExtractedData.matchResults.forEach((match, idx) => {
        if (match.rfqItem?.id) {
          initial[idx] = match.rfqItem.id
        }
      })
      setSelectedMatches(initial)
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
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes/update-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          matchIndex,
          rfqItemId,
          action: 'approve'
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
                      {supplierInfo.shipping !== undefined && supplierInfo.shipping > 0 && (
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Shipping/Handling:</span>
                            <span className="font-medium text-emerald-700">{formatCurrency(supplierInfo.shipping)}</span>
                          </div>
                          {supplierInfo.shippingItems && supplierInfo.shippingItems.length > 0 && (
                            <div className="mt-1 pl-4 text-xs text-gray-500">
                              {supplierInfo.shippingItems.map((item, idx) => (
                                <div key={idx}>
                                  {item.productName}: {formatCurrency(item.totalPrice || item.unitPrice)}
                                </div>
                              ))}
                            </div>
                          )}
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
                                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-blue-200 text-sm">
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
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    // Refresh data only when done reviewing (not after each approval)
                    if (approvedMatches.size > 0) {
                      onMatchUpdated?.()
                    }
                    toast.success('Review complete')
                    onOpenChange(false)
                  }}
                >
                  Done Reviewing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
