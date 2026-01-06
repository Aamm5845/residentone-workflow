'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Check,
  X,
  Eye,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  Clock,
  Calendar,
  MessageSquare,
  ExternalLink,
  Package,
  DollarSign,
  Edit3,
  Save,
  Trash2,
  ArrowUpDown,
  Receipt,
  Link2,
  CheckCircle2,
  HelpCircle,
  XCircle
} from 'lucide-react'
import CreateInvoiceDialog from './CreateInvoiceDialog'
import CreateBudgetQuoteDialog from './CreateBudgetQuoteDialog'
import QuotePDFReviewDialog from './QuotePDFReviewDialog'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface SupplierQuotesTabProps {
  projectId: string
  searchQuery: string
  highlightQuoteId?: string | null
  onQuoteViewed?: () => void
}

interface LineItemDetail {
  id: string
  rfqLineItemId?: string
  roomFFEItemId?: string
  itemName: string
  itemDescription?: string
  brand?: string
  sku?: string
  imageUrl?: string | null
  requestedQuantity: number
  quotedQuantity: number
  unitPrice: number
  totalPrice: number
  currency: string
  availability?: string
  leadTime?: string
  leadTimeWeeks?: number
  leadTimeNotes?: string
  supplierSKU?: string
  supplierModelNumber?: string
  alternateProduct: boolean
  alternateNotes?: string
  notes?: string
  hasMismatch: boolean
  mismatchReasons: string[]
  // Match verification fields
  matchedRfqItemName?: string
  matchedRfqItemImage?: string | null
  matchedRfqItemBrand?: string
  matchedRfqItemSku?: string
  matchApproved?: boolean
  matchConfidence?: 'high' | 'medium' | 'low' | 'none'
}

interface Mismatch {
  itemName: string
  reasons: string[]
  type?: 'missing' | 'extra' | 'quantity' | 'total' | 'price'
  severity?: 'error' | 'warning'
  // Additional details for missing/extra items
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  brand?: string
  sku?: string
  description?: string
  imageUrl?: string
}

interface AIMatchSummary {
  matched: number
  partial: number
  missing: number
  extra: number
  totalRequested: number
  quantityDiscrepancies: number
  totalDiscrepancy: boolean
}

interface AIExtractedData {
  supplierInfo: {
    companyName?: string
    quoteNumber?: string
    quoteDate?: string
    validUntil?: string
    subtotal?: number
    shipping?: number
    taxes?: number
    total?: number
  } | null
  extractedItems: Array<{
    productName: string
    productNameOriginal?: string
    sku?: string
    quantity?: number
    unitPrice?: number
    totalPrice?: number
    brand?: string
    description?: string
    leadTime?: string
  }>
  matchResults: Array<{
    status: 'matched' | 'partial' | 'missing' | 'extra'
    confidence: number
    rfqItem?: {
      id: string
      itemName: string
      quantity: number
      sku?: string
      brand?: string
    }
    extractedItem?: {
      productName: string
      sku?: string
      quantity?: number
      unitPrice?: number
      totalPrice?: number
      brand?: string
      description?: string
      leadTime?: string
    }
    discrepancies?: string[]
    suggestedMatches?: Array<{
      id: string
      itemName: string
      confidence: number
    }>
  }>
  notes: string | null
}

interface SupplierQuote {
  id: string
  supplierRFQId: string
  quoteNumber: string
  version: number
  status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'REVISION_REQUESTED' | 'REVISED' | 'EXPIRED'
  totalAmount: number | null
  subtotal: number | null
  taxAmount: number | null
  shippingCost: number | null
  currency: string
  depositRequired: number | null
  depositPercent: number | null
  validUntil: string | null
  estimatedLeadTime: string
  submittedAt: string | null
  reviewedAt: string | null
  supplierNotes: string | null
  internalNotes: string | null
  quoteDocumentUrl: string | null
  paymentTerms: string | null
  shippingTerms: string | null
  supplier: {
    id: string | null
    name: string
    email: string | null
    phone: string | null
    logo: string | null
  }
  rfq: {
    id: string
    rfqNumber: string
    title: string | null
  }
  lineItems: LineItemDetail[]
  lineItemsCount: number
  hasMismatches: boolean
  mismatches: Mismatch[]
  aiMatchSummary: AIMatchSummary | null
  aiExtractedData: AIExtractedData | null
}

interface Stats {
  total: number
  pending: number
  submitted: number
  accepted: number
  rejected: number
  withMismatches: number
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700' },
  ACCEPTED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Declined', color: 'bg-red-50 text-red-600' },
  REVISION_REQUESTED: { label: 'Revision Requested', color: 'bg-blue-50 text-blue-700' },
  REVISED: { label: 'Revised', color: 'bg-purple-50 text-purple-700' },
  EXPIRED: { label: 'Expired', color: 'bg-gray-100 text-gray-500' },
}

// availabilityConfig removed - only using Lead Time now

export default function SupplierQuotesTab({ projectId, searchQuery, highlightQuoteId, onQuoteViewed }: SupplierQuotesTabProps) {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, submitted: 0, accepted: 0, rejected: 0, withMismatches: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [showMismatchOnly, setShowMismatchOnly] = useState(false)
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'supplier' | 'status' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null)

  // Invoice dialog state
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [selectedQuoteForInvoice, setSelectedQuoteForInvoice] = useState<string | null>(null)
  const [selectedQuoteData, setSelectedQuoteData] = useState<{ supplierName: string; quoteNumber: string } | null>(null)

  // Budget quote dialog state
  const [budgetQuoteDialogOpen, setBudgetQuoteDialogOpen] = useState(false)
  const [selectedQuoteForBudget, setSelectedQuoteForBudget] = useState<SupplierQuote | null>(null)

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<SupplierQuote | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline' | 'request_revision' | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Editing state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [editedLineItems, setEditedLineItems] = useState<Record<string, { unitPrice: number; leadTime: string }>>({})
  const [saving, setSaving] = useState(false)

  // PDF Review dialog state
  const [pdfReviewOpen, setPdfReviewOpen] = useState(false)
  const [pdfReviewQuote, setPdfReviewQuote] = useState<SupplierQuote | null>(null)

  // Open PDF review dialog
  const openPdfReview = (quote: SupplierQuote) => {
    setPdfReviewQuote(quote)
    setPdfReviewOpen(true)
  }

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/projects/${projectId}/procurement/supplier-quotes${filterStatus ? `?status=${filterStatus}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch quotes')
      const data = await res.json()
      setQuotes(data.quotes || [])
      setStats(data.stats || { total: 0, pending: 0, submitted: 0, accepted: 0, rejected: 0, withMismatches: 0 })
    } catch (error) {
      console.error('Error fetching quotes:', error)
      toast.error('Failed to load supplier quotes')
    } finally {
      setLoading(false)
    }
  }, [projectId, filterStatus])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // Auto-expand highlighted quote when navigating from RFQ tab
  useEffect(() => {
    if (highlightQuoteId && quotes.length > 0) {
      // Check if the quote exists in the current list
      const quoteExists = quotes.some(q => q.id === highlightQuoteId)
      if (quoteExists) {
        // Expand the quote and highlight it
        setExpandedQuotes(prev => {
          const next = new Set(prev)
          next.add(highlightQuoteId)
          return next
        })
        setHighlightedQuoteId(highlightQuoteId)

        // Remove highlight after animation
        const timer = setTimeout(() => {
          setHighlightedQuoteId(null)
        }, 2000)

        // Call callback to clear the highlight
        if (onQuoteViewed) {
          onQuoteViewed()
        }

        return () => clearTimeout(timer)
      }
    }
  }, [highlightQuoteId, quotes, onQuoteViewed])

  // Filter and sort quotes
  const filteredQuotes = quotes
    .filter(quote => {
      const matchesSearch = !searchQuery ||
        quote.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.rfq.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (quote.quoteNumber && quote.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesMismatch = !showMismatchOnly || quote.hasMismatches

      return matchesSearch && matchesMismatch
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'supplier':
          comparison = a.supplier.name.localeCompare(b.supplier.name)
          break
        case 'status':
          const statusOrder = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED', 'REVISED', 'EXPIRED', 'PENDING']
          comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
          break
        case 'amount':
          comparison = (a.totalAmount || 0) - (b.totalAmount || 0)
          break
        case 'date':
        default:
          comparison = new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const toggleExpanded = (quoteId: string) => {
    setExpandedQuotes(prev => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }

  // Start editing a quote
  const startEditing = (quote: SupplierQuote) => {
    setEditingQuoteId(quote.id)
    const initialEdits: Record<string, { unitPrice: number; leadTime: string }> = {}
    quote.lineItems.forEach(item => {
      initialEdits[item.id] = {
        unitPrice: item.unitPrice,
        leadTime: item.leadTime || ''
      }
    })
    setEditedLineItems(initialEdits)
  }

  // Update a line item field
  const updateLineItem = (itemId: string, field: string, value: any) => {
    setEditedLineItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
  }

  // Save edited line items
  const saveEdits = async (quoteId: string, quote: SupplierQuote) => {
    setSaving(true)
    try {
      const lineItems = quote.lineItems.map(item => ({
        lineItemId: item.id,
        unitPrice: editedLineItems[item.id]?.unitPrice ?? item.unitPrice,
        quantity: item.quotedQuantity,
        leadTime: editedLineItems[item.id]?.leadTime || item.leadTime
      }))

      const res = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, lineItems })
      })

      if (!res.ok) throw new Error('Failed to save')
      toast.success('Quote updated successfully')
      setEditingQuoteId(null)
      setEditedLineItems({})
      fetchQuotes()
    } catch (error) {
      console.error('Error saving edits:', error)
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingQuoteId(null)
    setEditedLineItems({})
  }

  // Delete a quote
  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return
    }
    setDeletingQuoteId(quoteId)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId })
      })
      if (!res.ok) throw new Error('Failed to delete quote')
      toast.success('Quote deleted')
      fetchQuotes()
    } catch (error) {
      console.error('Error deleting quote:', error)
      toast.error('Failed to delete quote')
    } finally {
      setDeletingQuoteId(null)
    }
  }

  // Toggle sort
  const handleSort = (field: 'date' | 'supplier' | 'status' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const openReviewDialog = (quote: SupplierQuote) => {
    setSelectedQuote(quote)
    setInternalNotes(quote.internalNotes || '')
    setReviewDialogOpen(true)
  }

  const handleAction = async (action: 'approve' | 'decline' | 'request_revision', quote?: SupplierQuote) => {
    const targetQuote = quote || selectedQuote
    if (!targetQuote) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: targetQuote.id,
          action,
          internalNotes: internalNotes.trim() || undefined
        })
      })

      if (!res.ok) throw new Error('Failed to update quote')

      const actionLabels = {
        approve: 'approved',
        decline: 'declined',
        request_revision: 'revision requested for'
      }
      toast.success(`Quote ${actionLabels[action]}`)
      setReviewDialogOpen(false)
      setSelectedQuote(null)
      setReviewAction(null)
      setInternalNotes('')
      fetchQuotes()
    } catch (error) {
      console.error('Error updating quote:', error)
      toast.error('Failed to update quote')
    } finally {
      setActionLoading(false)
    }
  }

  const formatCurrency = (amount: number | null, currency = 'CAD') => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return format(new Date(dateStr), 'MMM d, yyyy')
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${stats.submitted > 0 ? 'ring-1 ring-amber-200' : ''} ${filterStatus === 'SUBMITTED' ? 'ring-2 ring-amber-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'SUBMITTED' ? null : 'SUBMITTED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.submitted > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{stats.submitted}</p>
                <p className="text-sm text-gray-500">Pending Review</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.submitted > 0 ? 'bg-amber-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'ACCEPTED' ? 'ring-2 ring-emerald-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'ACCEPTED' ? null : 'ACCEPTED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.accepted > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{stats.accepted}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.accepted > 0 ? 'bg-emerald-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'REJECTED' ? 'ring-2 ring-gray-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'REJECTED' ? null : 'REJECTED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.rejected > 0 ? 'text-gray-600' : 'text-gray-400'}`}>{stats.rejected}</p>
                <p className="text-sm text-gray-500">Declined</p>
              </div>
              <div className="w-2 h-8 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${showMismatchOnly ? 'ring-2 ring-orange-400' : ''}`}
          onClick={() => setShowMismatchOnly(!showMismatchOnly)}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.withMismatches > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{stats.withMismatches}</p>
                <p className="text-sm text-gray-500">With Issues</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.withMismatches > 0 ? 'bg-orange-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotes Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Supplier Quotes</CardTitle>
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as ['date' | 'supplier' | 'status' | 'amount', 'asc' | 'desc']
                  setSortBy(field)
                  setSortOrder(order)
                }}
                className="h-8 text-sm border border-gray-200 rounded-md px-2 bg-white text-gray-600"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="supplier-asc">Supplier A-Z</option>
                <option value="supplier-desc">Supplier Z-A</option>
                <option value="status-asc">Status</option>
                <option value="amount-desc">Amount (High-Low)</option>
                <option value="amount-asc">Amount (Low-High)</option>
              </select>
              {(filterStatus || showMismatchOnly) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-gray-600"
                  onClick={() => { setFilterStatus(null); setShowMismatchOnly(false) }}
                >
                  Clear filters
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-gray-600"
                onClick={fetchQuotes}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No quotes yet</h3>
              <p className="text-sm text-gray-500">
                Quotes will appear here when suppliers respond to your RFQs
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                    highlightedQuoteId === quote.id
                      ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/30'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Main Row - Fixed width columns */}
                  <div
                    className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpanded(quote.id)}
                  >
                    {/* Expand button */}
                    <button className="text-gray-400 hover:text-gray-600 w-6 flex-shrink-0">
                      {expandedQuotes.has(quote.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Supplier with logo - flex to fill space */}
                    <div className="flex-1 min-w-[180px] flex items-center gap-3 min-w-0 pl-2">
                      {quote.supplier.logo ? (
                        <img
                          src={quote.supplier.logo}
                          alt={quote.supplier.name}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-gray-600">
                            {quote.supplier.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 truncate text-sm">{quote.supplier.name}</span>
                          {quote.hasMismatches && (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{quote.supplier.email}</p>
                      </div>
                    </div>

                    {/* RFQ Ref */}
                    <div className="w-[100px] flex-shrink-0 text-center">
                      <p className="text-sm font-medium text-gray-900">{quote.rfq.rfqNumber}</p>
                      <p className="text-xs text-gray-500">{quote.lineItemsCount} items</p>
                    </div>

                    {/* Total Cost */}
                    <div className="w-[100px] flex-shrink-0 text-right">
                      <p className="font-medium text-gray-900 text-sm">{formatCurrency(quote.totalAmount, quote.currency)}</p>
                    </div>

                    {/* Lead Time */}
                    <div className="w-[80px] flex-shrink-0 text-center">
                      <p className="text-xs text-gray-500">Delivery</p>
                      <p className="text-sm text-gray-600">{quote.estimatedLeadTime || '-'}</p>
                    </div>

                    {/* Valid Until */}
                    <div className="w-[90px] flex-shrink-0 text-center">
                      <p className="text-xs text-gray-500">Valid Until</p>
                      <p className={`text-sm ${isExpired(quote.validUntil) ? 'text-red-600' : 'text-gray-600'}`}>
                        {formatDate(quote.validUntil)}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="w-[110px] flex-shrink-0 text-center">
                      <Badge className={`${statusConfig[quote.status]?.color || 'bg-gray-100 text-gray-600'} text-xs`}>
                        {statusConfig[quote.status]?.label || quote.status}
                      </Badge>
                    </div>

                    {/* Actions - fixed width */}
                    <div className="w-[280px] flex-shrink-0 flex items-center justify-end gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                      {/* Quote Document or Manual Entry indicator */}
                      {quote.quoteDocumentUrl ? (
                        <button
                          onClick={() => window.open(quote.quoteDocumentUrl!, '_blank')}
                          className="w-10 h-10 rounded border border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all flex items-center justify-center overflow-hidden relative group"
                          title="Open PDF"
                        >
                          {quote.quoteDocumentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img src={quote.quoteDocumentUrl} alt="Quote" className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">
                          Manual
                        </Badge>
                      )}
                      {/* Show status badge for finalized quotes, review button for others */}
                      {quote.status === 'ACCEPTED' ? (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                          {quote.quoteDocumentUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => window.open(quote.quoteDocumentUrl!, '_blank')}
                              title="View PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      ) : quote.status === 'REJECTED' ? (
                        <>
                          <Badge className="bg-red-100 text-red-700 text-xs px-2 py-1">
                            <XCircle className="w-3 h-3 mr-1" />
                            Declined
                          </Badge>
                          {quote.quoteDocumentUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => window.open(quote.quoteDocumentUrl!, '_blank')}
                              title="View PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      ) : quote.quoteDocumentUrl && quote.aiExtractedData ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                          onClick={() => openPdfReview(quote)}
                          title="Review & verify AI-matched items"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Review Matches
                        </Button>
                      ) : null}
                      {quote.status === 'ACCEPTED' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                            onClick={() => {
                              setSelectedQuoteForBudget(quote)
                              setBudgetQuoteDialogOpen(true)
                            }}
                            title="Create Budget Quote"
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Budget</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              setSelectedQuoteForInvoice(quote.id)
                              setSelectedQuoteData({
                                supplierName: quote.supplier.name,
                                quoteNumber: quote.quoteNumber || ''
                              })
                              setInvoiceDialogOpen(true)
                            }}
                            title="Create Client Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Invoice</span>
                          </Button>
                        </>
                      )}
                      {quote.status === 'REJECTED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteQuote(quote.id)}
                          disabled={deletingQuoteId === quote.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedQuotes.has(quote.id) && (
                    <div className="border-t border-gray-200 bg-gray-50/50 p-4 space-y-4">
                      {/* Deposit Required */}
                      {quote.depositRequired && quote.depositRequired > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <DollarSign className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-amber-900">Deposit Required</p>
                              <p className="text-sm text-amber-800 mt-1">
                                {formatCurrency(quote.depositRequired, quote.currency)}
                                {quote.depositPercent && ` (${quote.depositPercent}%)`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Supplier Notes */}
                      {quote.supplierNotes && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-blue-900">Supplier Notes</p>
                              <p className="text-sm text-blue-800 mt-1 whitespace-pre-wrap">{quote.supplierNotes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Match Summary & Discrepancies */}
                      {(quote.hasMismatches || quote.aiMatchSummary) && (
                        <div className="space-y-3">
                          {/* AI Match Summary Bar */}
                          {quote.aiMatchSummary && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-600 mb-2">AI Quote Analysis</p>
                              <div className="flex flex-wrap gap-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-gray-600">Matched:</span>
                                  <span className="font-semibold text-gray-900">{quote.aiMatchSummary.matched}</span>
                                </div>
                                {quote.aiMatchSummary.partial > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-gray-600">Partial:</span>
                                    <span className="font-semibold text-amber-700">{quote.aiMatchSummary.partial}</span>
                                  </div>
                                )}
                                {quote.aiMatchSummary.missing > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="text-gray-600">Missing:</span>
                                    <span className="font-semibold text-red-700">{quote.aiMatchSummary.missing}</span>
                                  </div>
                                )}
                                {quote.aiMatchSummary.extra > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-gray-600">Extra:</span>
                                    <span className="font-semibold text-blue-700">{quote.aiMatchSummary.extra}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <span className="text-gray-500">of {quote.aiMatchSummary.totalRequested} requested</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Discrepancy Details */}
                          {quote.hasMismatches && quote.mismatches.length > 0 && (
                            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-amber-900">
                                    {quote.mismatches.length} Discrepanc{quote.mismatches.length === 1 ? 'y' : 'ies'} Detected - Review Required
                                  </p>
                                  <div className="mt-3 space-y-3">
                                    {quote.mismatches.map((mismatch, idx) => (
                                      <div key={idx} className={`p-3 rounded-lg ${
                                        mismatch.type === 'missing'
                                          ? 'bg-red-100 border-l-4 border-red-500'
                                          : mismatch.type === 'extra'
                                          ? 'bg-blue-100 border-l-4 border-blue-500'
                                          : 'bg-amber-100 border-l-4 border-amber-500'
                                      }`}>
                                        <div className="flex items-start gap-3">
                                          {/* Item image if available */}
                                          {mismatch.imageUrl && (
                                            <div className="w-12 h-12 rounded-md overflow-hidden border border-gray-200 bg-white flex-shrink-0">
                                              <img src={mismatch.imageUrl} alt={mismatch.itemName} className="w-full h-full object-cover" />
                                            </div>
                                          )}
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {mismatch.type === 'missing' && (
                                                <span className="text-red-800 text-xs font-bold px-2 py-1 bg-red-200 rounded uppercase">
                                                  Missing from Quote
                                                </span>
                                              )}
                                              {mismatch.type === 'extra' && (
                                                <span className="text-blue-800 text-xs font-bold px-2 py-1 bg-blue-200 rounded uppercase">
                                                  Extra Item Added
                                                </span>
                                              )}
                                              {mismatch.type === 'quantity' && (
                                                <span className="text-amber-800 text-xs font-bold px-2 py-1 bg-amber-200 rounded uppercase">
                                                  Quantity Mismatch
                                                </span>
                                              )}
                                              {mismatch.type === 'total' && (
                                                <span className="text-red-800 text-xs font-bold px-2 py-1 bg-red-200 rounded uppercase">
                                                  Total Mismatch
                                                </span>
                                              )}
                                              {mismatch.type === 'price' && (
                                                <span className="text-orange-800 text-xs font-bold px-2 py-1 bg-orange-200 rounded uppercase">
                                                  Price Issue
                                                </span>
                                              )}
                                            </div>
                                            <p className="font-semibold text-gray-900 mt-1.5 text-sm">{mismatch.itemName}</p>

                                            {/* Show full item details for missing/extra items */}
                                            {(mismatch.type === 'missing' || mismatch.type === 'extra') && (
                                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                {mismatch.brand && (
                                                  <div><span className="text-gray-500">Brand:</span> <span className="font-medium text-gray-800">{mismatch.brand}</span></div>
                                                )}
                                                {mismatch.sku && (
                                                  <div><span className="text-gray-500">SKU:</span> <span className="font-medium text-gray-800">{mismatch.sku}</span></div>
                                                )}
                                                {mismatch.quantity && (
                                                  <div><span className="text-gray-500">Quantity:</span> <span className="font-bold text-gray-900">{mismatch.quantity}</span></div>
                                                )}
                                                {mismatch.unitPrice && (
                                                  <div><span className="text-gray-500">Unit Price:</span> <span className="font-bold text-gray-900">{formatCurrency(mismatch.unitPrice)}</span></div>
                                                )}
                                                {mismatch.totalPrice && (
                                                  <div><span className="text-gray-500">Total:</span> <span className="font-bold text-gray-900">{formatCurrency(mismatch.totalPrice)}</span></div>
                                                )}
                                                {mismatch.description && (
                                                  <div className="col-span-2"><span className="text-gray-500">Description:</span> <span className="text-gray-700">{mismatch.description}</span></div>
                                                )}
                                              </div>
                                            )}

                                            {/* Show reasons for all types */}
                                            {mismatch.reasons && mismatch.reasons.length > 0 && (
                                              <div className="mt-2 space-y-1">
                                                {mismatch.reasons.map((reason, rIdx) => (
                                                  <div key={rIdx} className="text-sm text-gray-700 flex items-start gap-2">
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                                      mismatch.type === 'missing' ? 'bg-red-500'
                                                      : mismatch.type === 'extra' ? 'bg-blue-500'
                                                      : 'bg-amber-500'
                                                    }`} />
                                                    <span>{reason}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-amber-800 mt-3 p-2 bg-amber-200/50 rounded flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <strong>Action Required:</strong> Edit prices/quantities or request revision from supplier before approving.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quote Summary - Cleaner Layout */}
                      <div className="flex gap-6">
                        {/* Left Side - Quote Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-4 text-sm mb-3">
                            {quote.quoteNumber && (
                              <div>
                                <span className="text-gray-500">Quote #:</span>
                                <span className="ml-1 font-medium">{quote.quoteNumber}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Received:</span>
                              <span className="ml-1 font-medium">{formatDate(quote.submittedAt)}</span>
                            </div>
                            {!quote.quoteDocumentUrl && (
                              <Badge variant="outline" className="text-xs text-gray-500">
                                Entered Manually
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Right Side - Pricing Summary */}
                        <div className="w-[200px] bg-gray-100 rounded-lg p-3 text-sm space-y-1.5">
                          {quote.subtotal && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Subtotal</span>
                              <span className="font-medium">{formatCurrency(quote.subtotal, quote.currency)}</span>
                            </div>
                          )}
                          {quote.shippingCost && quote.shippingCost > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Shipping</span>
                              <span className="font-medium">{formatCurrency(quote.shippingCost, quote.currency)}</span>
                            </div>
                          )}
                          {quote.taxAmount && quote.taxAmount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tax</span>
                              <span className="font-medium">{formatCurrency(quote.taxAmount, quote.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1.5 border-t border-gray-300">
                            <span className="font-semibold text-gray-900">Total</span>
                            <span className="font-bold text-gray-900">{formatCurrency(quote.totalAmount, quote.currency)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Line Items Table with Edit Controls */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Line Items</span>
                        {editingQuoteId === quote.id ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => saveEdits(quote.id, quote)}
                              disabled={saving}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditing(quote)}
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Edit Prices
                          </Button>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-gray-500 font-medium w-16"></TableHead>
                              <TableHead className="text-gray-500 font-medium">Item</TableHead>
                              <TableHead className="text-gray-500 font-medium text-center w-24">Qty</TableHead>
                              <TableHead className="text-gray-500 font-medium text-right w-28">Unit Price</TableHead>
                              <TableHead className="text-gray-500 font-medium text-right w-28">Total</TableHead>
                              <TableHead className="text-gray-500 font-medium text-center w-32">Lead Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quote.lineItems.map((item) => {
                              const isEditing = editingQuoteId === quote.id
                              const editedItem = editedLineItems[item.id]
                              const currentPrice = isEditing ? (editedItem?.unitPrice ?? item.unitPrice) : item.unitPrice
                              const currentLeadTime = isEditing ? (editedItem?.leadTime ?? item.leadTime) : item.leadTime

                              return (
                                <TableRow key={item.id} className={item.hasMismatch ? 'bg-amber-100 border-l-4 border-l-amber-500' : ''}>
                                  {/* Image */}
                                  <TableCell className="p-2">
                                    {item.imageUrl ? (
                                      <div className="w-12 h-12 rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                                        <img
                                          src={item.imageUrl}
                                          alt={item.itemName}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-gray-400" />
                                      </div>
                                    )}
                                  </TableCell>
                                  {/* Item Info */}
                                  <TableCell>
                                    <div className="flex items-start gap-2">
                                      {item.hasMismatch && (
                                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                      )}
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900">{item.itemName}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                                          <span>SKU: <span className="font-medium text-gray-700">{item.supplierSKU || item.sku || 'N/A'}</span></span>
                                          {item.brand && <span>Brand: <span className="font-medium text-gray-700">{item.brand}</span></span>}
                                        </div>
                                        {item.alternateProduct && (
                                          <p className="text-xs text-orange-600 mt-0.5">Alternate product offered</p>
                                        )}
                                        {/* Show inline mismatch details */}
                                        {item.hasMismatch && item.mismatchReasons && item.mismatchReasons.length > 0 && (
                                          <div className="mt-1.5 p-1.5 bg-amber-200/50 rounded text-xs">
                                            <div className="font-semibold text-amber-800 mb-0.5">Discrepancy:</div>
                                            {item.mismatchReasons.map((reason, idx) => (
                                              <div key={idx} className="text-amber-900 flex items-center gap-1">
                                                <span className="w-1 h-1 bg-amber-600 rounded-full" />
                                                {reason}
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Matched RFQ Item Display */}
                                        {item.rfqLineItemId && (
                                          <div className={`mt-2 p-2 rounded-md border text-xs ${
                                            item.matchApproved
                                              ? 'bg-emerald-50 border-emerald-200'
                                              : item.matchConfidence === 'high'
                                              ? 'bg-blue-50 border-blue-200'
                                              : item.matchConfidence === 'medium'
                                              ? 'bg-amber-50 border-amber-200'
                                              : 'bg-gray-50 border-gray-200'
                                          }`}>
                                            <div className="flex items-center gap-2">
                                              <Link2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                              <span className="text-gray-500">Matched to:</span>
                                              {/* Show matched RFQ item image if available */}
                                              {item.matchedRfqItemImage && (
                                                <div className="w-6 h-6 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                                                  <img src={item.matchedRfqItemImage} alt="" className="w-full h-full object-cover" />
                                                </div>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <span className="font-medium text-gray-900 truncate block">
                                                  {item.matchedRfqItemName || item.itemName}
                                                </span>
                                                {(item.matchedRfqItemBrand || item.matchedRfqItemSku) && (
                                                  <span className="text-gray-500 truncate block">
                                                    {item.matchedRfqItemBrand}{item.matchedRfqItemBrand && item.matchedRfqItemSku ? ' • ' : ''}{item.matchedRfqItemSku}
                                                  </span>
                                                )}
                                              </div>
                                              {/* Status indicator */}
                                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {item.matchApproved ? (
                                                  <span className="flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span className="font-medium">Verified</span>
                                                  </span>
                                                ) : item.matchConfidence && (
                                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    item.matchConfidence === 'high'
                                                      ? 'bg-blue-100 text-blue-700'
                                                      : item.matchConfidence === 'medium'
                                                      ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-gray-100 text-gray-600'
                                                  }`}>
                                                    {item.matchConfidence === 'high' ? 'AI Match' : item.matchConfidence === 'medium' ? 'Needs Review' : 'Low Confidence'}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* No match indicator for items without RFQ reference */}
                                        {!item.rfqLineItemId && (
                                          <div className="mt-2 p-2 rounded-md border border-orange-200 bg-orange-50 text-xs">
                                            <div className="flex items-center gap-2 text-orange-700">
                                              <HelpCircle className="w-3 h-3 flex-shrink-0" />
                                              <span>Not matched to any requested item</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  {/* Quantity */}
                                  <TableCell className="text-center">
                                    <div>
                                      <span className={`font-medium ${item.quotedQuantity !== item.requestedQuantity ? 'text-amber-700' : ''}`}>
                                        {item.quotedQuantity}
                                      </span>
                                      {item.quotedQuantity !== item.requestedQuantity && (
                                        <div className="mt-0.5 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                                          Requested: {item.requestedQuantity}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  {/* Unit Price - Editable */}
                                  <TableCell className="text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={currentPrice}
                                        onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        className="w-24 h-8 text-right text-sm"
                                      />
                                    ) : (
                                      <span className="font-medium">{formatCurrency(item.unitPrice, item.currency)}</span>
                                    )}
                                  </TableCell>
                                  {/* Total */}
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(isEditing ? currentPrice * item.quotedQuantity : item.totalPrice, item.currency)}
                                  </TableCell>
                                  {/* Lead Time - Editable */}
                                  <TableCell className="text-center">
                                    {isEditing ? (
                                      <select
                                        value={currentLeadTime || ''}
                                        onChange={(e) => updateLineItem(item.id, 'leadTime', e.target.value)}
                                        className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                                      >
                                        <option value="">Select...</option>
                                        <option value="In Stock">In Stock</option>
                                        <option value="1-2 weeks">1-2 weeks</option>
                                        <option value="2-4 weeks">2-4 weeks</option>
                                        <option value="4-6 weeks">4-6 weeks</option>
                                        <option value="6-8 weeks">6-8 weeks</option>
                                        <option value="8-12 weeks">8-12 weeks</option>
                                        <option value="12+ weeks">12+ weeks</option>
                                      </select>
                                    ) : (
                                      <span className="text-sm text-gray-600">
                                        {item.leadTime || (item.leadTimeWeeks ? `${item.leadTimeWeeks}w` : '-')}
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Notes Section */}
                      {quote.lineItems.some(item => item.alternateNotes || item.leadTimeNotes || item.notes) && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                          <p className="font-medium text-gray-700 mb-2">Item Notes:</p>
                          {quote.lineItems.filter(item => item.alternateNotes || item.leadTimeNotes || item.notes).map(item => (
                            <div key={item.id} className="mb-2 last:mb-0">
                              <span className="font-medium">{item.itemName}:</span>
                              {item.alternateNotes && <span className="text-orange-600 ml-2">{item.alternateNotes}</span>}
                              {item.leadTimeNotes && <span className="text-gray-600 ml-2">{item.leadTimeNotes}</span>}
                              {item.notes && <span className="text-gray-600 ml-2">{item.notes}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Internal Notes */}
                      {quote.internalNotes && (
                        <div className="bg-gray-100 rounded-lg p-3 text-sm">
                          <p className="text-gray-500 mb-1">Internal Notes</p>
                          <p className="text-gray-700">{quote.internalNotes}</p>
                        </div>
                      )}

                      {/* Actions for expanded view */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-3">
                        <div>
                          {/* Review Matches Button */}
                          {quote.aiExtractedData && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => openPdfReview(quote)}
                            >
                              <Eye className="w-4 h-4 mr-1.5" />
                              Review & Verify Matches
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {quote.status === 'SUBMITTED' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction('decline', quote)}
                                disabled={actionLoading}
                              >
                                <X className="w-4 h-4 mr-1.5" />
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                className={quote.hasMismatches
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-emerald-600 hover:bg-emerald-700"}
                                onClick={() => handleAction('approve', quote)}
                                disabled={actionLoading || quote.hasMismatches}
                                title={quote.hasMismatches ? "Resolve all discrepancies before approving" : ""}
                              >
                                <Check className="w-4 h-4 mr-1.5" />
                                {quote.hasMismatches ? 'Fix Issues First' : 'Approve Quote'}
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewDialog(quote)}
                          >
                            Status Review
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Quote Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Quote</DialogTitle>
            <DialogDescription>
              {selectedQuote && (
                <>Quote from {selectedQuote.supplier.name} for {selectedQuote.rfq.rfqNumber}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4">
              {/* Summary Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedQuote.totalAmount, selectedQuote.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Lead Time</p>
                  <p className="text-lg font-medium">{selectedQuote.estimatedLeadTime || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valid Until</p>
                  <p className={`text-lg font-medium ${isExpired(selectedQuote.validUntil) ? 'text-red-600' : ''}`}>
                    {formatDate(selectedQuote.validUntil)}
                  </p>
                </div>
              </div>

              {/* Deposit Required */}
              {selectedQuote.depositRequired && selectedQuote.depositRequired > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm font-medium text-amber-900 mb-1">Deposit Required</p>
                  <p className="text-sm text-amber-800">
                    {formatCurrency(selectedQuote.depositRequired, selectedQuote.currency)}
                    {selectedQuote.depositPercent && ` (${selectedQuote.depositPercent}%)`}
                  </p>
                </div>
              )}

              {/* Supplier Notes */}
              {selectedQuote.supplierNotes && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">Supplier Notes</p>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedQuote.supplierNotes}</p>
                </div>
              )}

              {/* AI Match Summary & Discrepancies */}
              {(selectedQuote.hasMismatches || selectedQuote.aiMatchSummary) && (
                <div className="space-y-3">
                  {/* AI Match Summary */}
                  {selectedQuote.aiMatchSummary && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-600 mb-2">AI Quote Analysis Summary</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          <span className="text-gray-600">Matched:</span>
                          <span className="font-bold text-gray-900">{selectedQuote.aiMatchSummary.matched}</span>
                        </div>
                        {selectedQuote.aiMatchSummary.partial > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-gray-600">Partial:</span>
                            <span className="font-bold text-amber-700">{selectedQuote.aiMatchSummary.partial}</span>
                          </div>
                        )}
                        {selectedQuote.aiMatchSummary.missing > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-gray-600">Missing:</span>
                            <span className="font-bold text-red-700">{selectedQuote.aiMatchSummary.missing}</span>
                          </div>
                        )}
                        {selectedQuote.aiMatchSummary.extra > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-gray-600">Extra:</span>
                            <span className="font-bold text-blue-700">{selectedQuote.aiMatchSummary.extra}</span>
                          </div>
                        )}
                        <div className="ml-auto text-gray-500">
                          of {selectedQuote.aiMatchSummary.totalRequested} items requested
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Discrepancy Details */}
                  {selectedQuote.hasMismatches && selectedQuote.mismatches.length > 0 && (
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <p className="text-sm font-bold text-amber-900">
                          {selectedQuote.mismatches.length} Discrepanc{selectedQuote.mismatches.length === 1 ? 'y' : 'ies'} Detected - Must Resolve Before Approval
                        </p>
                      </div>
                      <div className="space-y-3">
                        {selectedQuote.mismatches.map((mismatch, idx) => (
                          <div key={idx} className={`bg-white p-4 rounded-lg ${
                            mismatch.type === 'missing'
                              ? 'border-l-4 border-red-500 border border-red-200'
                              : mismatch.type === 'extra'
                              ? 'border-l-4 border-blue-500 border border-blue-200'
                              : 'border-l-4 border-amber-500 border border-amber-200'
                          }`}>
                            <div className="flex items-start gap-3">
                              {/* Item image if available */}
                              {mismatch.imageUrl && (
                                <div className="w-14 h-14 rounded-md overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                                  <img src={mismatch.imageUrl} alt={mismatch.itemName} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {mismatch.type === 'missing' && (
                                    <span className="text-red-800 text-xs font-bold px-2 py-1 bg-red-100 rounded uppercase">
                                      Missing from Quote
                                    </span>
                                  )}
                                  {mismatch.type === 'extra' && (
                                    <span className="text-blue-800 text-xs font-bold px-2 py-1 bg-blue-100 rounded uppercase">
                                      Extra Item Added
                                    </span>
                                  )}
                                  {mismatch.type === 'quantity' && (
                                    <span className="text-amber-800 text-xs font-bold px-2 py-1 bg-amber-100 rounded uppercase">
                                      Quantity Mismatch
                                    </span>
                                  )}
                                  {mismatch.type === 'total' && (
                                    <span className="text-red-800 text-xs font-bold px-2 py-1 bg-red-100 rounded uppercase">
                                      Total Mismatch
                                    </span>
                                  )}
                                  {mismatch.type === 'price' && (
                                    <span className="text-orange-800 text-xs font-bold px-2 py-1 bg-orange-100 rounded uppercase">
                                      Price Issue
                                    </span>
                                  )}
                                </div>
                                <p className="font-semibold text-gray-900">{mismatch.itemName}</p>

                                {/* Show full item details for missing/extra items */}
                                {(mismatch.type === 'missing' || mismatch.type === 'extra') && (
                                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-gray-50 p-2 rounded">
                                    {mismatch.brand && (
                                      <div><span className="text-gray-500">Brand:</span> <span className="font-medium text-gray-800">{mismatch.brand}</span></div>
                                    )}
                                    {mismatch.sku && (
                                      <div><span className="text-gray-500">SKU:</span> <span className="font-medium text-gray-800">{mismatch.sku}</span></div>
                                    )}
                                    {mismatch.quantity !== undefined && (
                                      <div><span className="text-gray-500">Quantity:</span> <span className="font-bold text-gray-900">{mismatch.quantity}</span></div>
                                    )}
                                    {mismatch.unitPrice !== undefined && (
                                      <div><span className="text-gray-500">Unit Price:</span> <span className="font-bold text-gray-900">{formatCurrency(mismatch.unitPrice)}</span></div>
                                    )}
                                    {mismatch.totalPrice !== undefined && (
                                      <div><span className="text-gray-500">Total:</span> <span className="font-bold text-emerald-700">{formatCurrency(mismatch.totalPrice)}</span></div>
                                    )}
                                    {mismatch.description && (
                                      <div className="col-span-2 mt-1"><span className="text-gray-500">Description:</span> <span className="text-gray-700">{mismatch.description}</span></div>
                                    )}
                                  </div>
                                )}

                                {/* Show reasons */}
                                {mismatch.reasons && mismatch.reasons.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {mismatch.reasons.map((reason, rIdx) => (
                                      <div key={rIdx} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                          mismatch.type === 'missing' ? 'bg-red-500'
                                          : mismatch.type === 'extra' ? 'bg-blue-500'
                                          : 'bg-amber-500'
                                        }`} />
                                        <span>{reason}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-amber-800 mt-3 p-2 bg-amber-200/50 rounded flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <strong>Action Required:</strong> Edit the quote to resolve discrepancies, or request a revision from the supplier.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Internal Notes</label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Add notes for your team..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            {selectedQuote?.status === 'SUBMITTED' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleAction('request_revision')}
                  disabled={actionLoading}
                  className="text-blue-600 hover:bg-blue-50"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  Request Revision
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('decline')}
                  disabled={actionLoading}
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Decline
                </Button>
                <Button
                  className={selectedQuote.hasMismatches
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"}
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading || selectedQuote.hasMismatches}
                  title={selectedQuote.hasMismatches ? "Resolve all discrepancies before approving" : ""}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {selectedQuote.hasMismatches ? 'Cannot Approve - Fix Issues' : 'Approve'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        projectId={projectId}
        onSuccess={() => {
          setInvoiceDialogOpen(false)
          setSelectedQuoteForInvoice(null)
          setSelectedQuoteData(null)
          toast.success('Invoice created successfully')
        }}
        preselectedQuoteIds={selectedQuoteForInvoice ? [selectedQuoteForInvoice] : undefined}
        preselectedQuoteData={selectedQuoteData || undefined}
        source="quotes"
      />

      {/* Create Budget Quote Dialog */}
      <CreateBudgetQuoteDialog
        open={budgetQuoteDialogOpen}
        onOpenChange={(open) => {
          setBudgetQuoteDialogOpen(open)
          if (!open) setSelectedQuoteForBudget(null)
        }}
        projectId={projectId}
        onSuccess={() => {
          setBudgetQuoteDialogOpen(false)
          setSelectedQuoteForBudget(null)
          fetchQuotes()
        }}
        preselectedItems={selectedQuoteForBudget?.lineItems.map(item => ({
          id: item.roomFFEItemId || item.id,
          name: item.itemName,
          categoryName: item.brand || undefined,
          totalCost: item.totalPrice,
          clientApproved: false // Items from supplier quotes are not yet client-approved
        })) || []}
        preselectedSupplierQuoteIds={selectedQuoteForBudget ? [selectedQuoteForBudget.id] : []}
        source="supplier-quotes"
      />

      {/* PDF Review Dialog - Compare supplier quote vs request */}
      {pdfReviewQuote && (
        <QuotePDFReviewDialog
          open={pdfReviewOpen}
          onOpenChange={(open) => {
            setPdfReviewOpen(open)
            if (!open) setPdfReviewQuote(null)
          }}
          quoteDocumentUrl={pdfReviewQuote.quoteDocumentUrl}
          aiExtractedData={pdfReviewQuote.aiExtractedData}
          supplierName={pdfReviewQuote.supplier.name}
          quoteId={pdfReviewQuote.id}
          projectId={projectId}
          rfqLineItems={pdfReviewQuote.lineItems.map(li => ({
            id: li.rfqLineItemId || li.id,
            itemName: li.itemName,
            quantity: li.requestedQuantity,
            sku: li.sku,
            brand: li.brand,
            imageUrl: li.imageUrl || undefined
          }))}
          onMatchUpdated={fetchQuotes}
        />
      )}
    </div>
  )
}
