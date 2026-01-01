'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CreateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSuccess: () => void
  preselectedItemIds?: string[]
  preselectedQuoteIds?: string[]
  preselectedQuoteData?: {
    supplierName: string
    quoteNumber: string
  }
  source?: 'specs' | 'quotes'
}

interface SpecItem {
  id: string
  name: string
  description?: string
  category?: string
  sectionName?: string
  quantity: number
  unitType?: string
  roomName?: string
  tradePrice?: number | null
  rrp?: number | null
  supplierName?: string
  brand?: string
  images?: string[]
}

interface ApprovedQuote {
  id: string
  quoteNumber: string
  supplierName: string
  totalAmount: number
  lineItems: {
    id: string
    itemName: string
    unitPrice: number
    quantity: number
    totalPrice: number
    roomFFEItemId?: string
  }[]
}

interface LineItem {
  roomFFEItemId: string
  supplierQuoteId?: string
  displayName: string
  displayDescription?: string
  categoryName?: string
  roomName?: string
  quantity: number
  unitType: string
  clientUnitPrice: number
  clientTotalPrice: number
  supplierUnitPrice?: number
  supplierTotalPrice?: number
  markupValue?: number
  markupAmount?: number
}

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  preselectedItemIds,
  preselectedQuoteIds,
  preselectedQuoteData,
  source = 'specs'
}: CreateInvoiceDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSource, setActiveSource] = useState<'specs' | 'quotes'>(source)

  // Form data
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Due upon receipt')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  // Items
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Default markup
  const [defaultMarkup, setDefaultMarkup] = useState(25)

  // Load data when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadData()
      loadProjectClient()
      // Set default valid until (30 days)
      const date = new Date()
      date.setDate(date.getDate() + 30)
      setValidUntil(date.toISOString().split('T')[0])
    }
  }, [open, projectId])

  // Pre-select items/quotes and auto-fill title
  useEffect(() => {
    if (preselectedItemIds?.length) {
      setSelectedItemIds(new Set(preselectedItemIds))
      setActiveSource('specs')
    }
    if (preselectedQuoteIds?.length) {
      setSelectedQuoteIds(new Set(preselectedQuoteIds))
      setActiveSource('quotes')
      // Auto-fill title from quote data
      if (preselectedQuoteData) {
        setTitle(`Invoice - ${preselectedQuoteData.supplierName}`)
      }
    }
  }, [preselectedItemIds, preselectedQuoteIds, preselectedQuoteData])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load spec items (only those with price)
      const specsRes = await fetch(`/api/projects/${projectId}/ffe-specs?hasPrice=true`)
      if (specsRes.ok) {
        const data = await specsRes.json()
        setSpecItems(data.items || [])
      }

      // Load approved supplier quotes
      const quotesRes = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes?status=ACCEPTED`)
      if (quotesRes.ok) {
        const data = await quotesRes.json()
        setApprovedQuotes(data.quotes?.map((q: any) => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          supplierName: q.supplier.name,
          totalAmount: q.totalAmount,
          lineItems: q.lineItems.map((li: any) => ({
            id: li.id,
            itemName: li.itemName,
            unitPrice: li.unitPrice,
            quantity: li.quantity || li.requestedQuantity,
            totalPrice: li.totalPrice,
            roomFFEItemId: li.roomFFEItemId
          }))
        })) || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectClient = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const project = await res.json()
        if (project.client) {
          setClientName(project.client.name || '')
          setClientEmail(project.client.email || '')
        }
      }
    } catch (error) {
      console.error('Error loading project client:', error)
    }
  }

  // Group items by category
  const groupedItems = useMemo(() => {
    const filtered = specItems.filter(item =>
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.reduce((groups: Record<string, SpecItem[]>, item) => {
      const key = item.category || item.sectionName || 'General'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {})
  }, [specItems, searchQuery])

  // Items without valid price (cannot be invoiced)
  const itemsWithoutPrice = useMemo(() => {
    return specItems.filter(item => !item.rrp && !item.tradePrice)
  }, [specItems])

  // Build line items for invoice
  const buildLineItems = (): LineItem[] => {
    const lineItems: LineItem[] = []

    if (activeSource === 'specs') {
      specItems
        .filter(item => selectedItemIds.has(item.id))
        .forEach(item => {
          const costPrice = item.tradePrice || 0
          const clientPrice = item.rrp || (costPrice * (1 + defaultMarkup / 100))
          const markupAmount = clientPrice - costPrice

          lineItems.push({
            roomFFEItemId: item.id,
            displayName: item.name,
            displayDescription: item.description,
            categoryName: item.category || item.sectionName,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            unitType: item.unitType || 'units',
            clientUnitPrice: clientPrice,
            clientTotalPrice: clientPrice * (item.quantity || 1),
            supplierUnitPrice: costPrice,
            supplierTotalPrice: costPrice * (item.quantity || 1),
            markupValue: costPrice > 0 ? ((clientPrice - costPrice) / costPrice) * 100 : defaultMarkup,
            markupAmount
          })
        })
    } else {
      approvedQuotes
        .filter(quote => selectedQuoteIds.has(quote.id))
        .forEach(quote => {
          quote.lineItems.forEach(li => {
            const costPrice = li.unitPrice
            const clientPrice = costPrice * (1 + defaultMarkup / 100)
            const markupAmount = (clientPrice - costPrice) * li.quantity

            lineItems.push({
              roomFFEItemId: li.roomFFEItemId || '',
              supplierQuoteId: quote.id,
              displayName: li.itemName,
              categoryName: 'From Supplier Quote',
              quantity: li.quantity,
              unitType: 'units',
              clientUnitPrice: clientPrice,
              clientTotalPrice: clientPrice * li.quantity,
              supplierUnitPrice: costPrice,
              supplierTotalPrice: li.totalPrice,
              markupValue: defaultMarkup,
              markupAmount
            })
          })
        })
    }

    return lineItems
  }

  // Calculate totals
  const totals = useMemo(() => {
    const lineItems = buildLineItems()
    const supplierCost = lineItems.reduce((sum, item) => sum + (item.supplierTotalPrice || 0), 0)
    const subtotal = lineItems.reduce((sum, item) => sum + item.clientTotalPrice, 0)
    const markup = subtotal - supplierCost
    const gst = subtotal * 0.05
    const qst = subtotal * 0.09975
    const total = subtotal + gst + qst
    return { supplierCost, subtotal, markup, gst, qst, total, itemCount: lineItems.length }
  }, [selectedItemIds, selectedQuoteIds, activeSource, defaultMarkup])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const toggleQuote = (quoteId: string) => {
    setSelectedQuoteIds(prev => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }

  const selectAllInCategory = (category: string, items: SpecItem[]) => {
    const validItems = items.filter(i => i.rrp || i.tradePrice)
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      const allSelected = validItems.every(i => next.has(i.id))
      if (allSelected) {
        validItems.forEach(i => next.delete(i.id))
      } else {
        validItems.forEach(i => next.add(i.id))
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter an invoice title')
      return
    }

    const lineItems = buildLineItems()
    if (lineItems.length === 0) {
      toast.error('Please select at least one item')
      return
    }

    setSaving(true)
    try {
      // Use the same API as All Specs (/api/client-quotes)
      const res = await fetch('/api/client-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description: description || null,
          defaultMarkupPercent: defaultMarkup,
          validUntil: validUntil || null,
          paymentTerms: paymentTerms || null,
          groupingType: 'category',
          // Bill To information
          clientName: clientName || null,
          clientEmail: clientEmail || null,
          // Map line items to the format expected by the API
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.roomFFEItemId || null,
            groupId: item.categoryName || 'From Supplier Quote',
            itemName: item.displayName,
            itemDescription: item.displayDescription || null,
            quantity: item.quantity,
            unitType: item.unitType,
            costPrice: item.supplierUnitPrice || 0,
            markupPercent: defaultMarkup,
            sellingPrice: item.clientUnitPrice,
            totalCost: item.supplierTotalPrice || 0,
            totalPrice: item.clientTotalPrice,
            order: index
          }))
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const data = await res.json()
      toast.success(`Invoice ${data.quote?.quoteNumber || 'created'} successfully`)
      onSuccess()
      resetForm()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setSelectedItemIds(new Set())
    setSelectedQuoteIds(new Set())
    setSearchQuery('')
    setExpandedCategories(new Set())
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const canProceed = step === 1
    ? (activeSource === 'specs' ? selectedItemIds.size > 0 : selectedQuoteIds.size > 0)
    : title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Select Items for Invoice' : 'Invoice Details'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : step === 1 ? (
          <div className="flex-1 min-h-0">
            {/* Source Tabs */}
            <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as 'specs' | 'quotes')}>
              <TabsList className="mb-4">
                <TabsTrigger value="specs">From All Specs</TabsTrigger>
                <TabsTrigger value="quotes">From Approved Quotes</TabsTrigger>
              </TabsList>

              <TabsContent value="specs" className="mt-0">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Warning for items without price */}
                {itemsWithoutPrice.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-800">
                      {itemsWithoutPrice.length} item{itemsWithoutPrice.length !== 1 ? 's' : ''} cannot be invoiced (no RRP or trade price set)
                    </p>
                  </div>
                )}

                {/* Items list */}
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-2">
                    {Object.entries(groupedItems).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No items with prices found
                      </div>
                    ) : (
                      Object.entries(groupedItems).map(([category, items]) => {
                        const validItems = items.filter(i => i.rrp || i.tradePrice)
                        const selectedCount = validItems.filter(i => selectedItemIds.has(i.id)).length
                        const isExpanded = expandedCategories.has(category)

                        return (
                          <div key={category} className="mb-2">
                            <button
                              onClick={() => toggleCategory(category)}
                              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="font-medium text-sm">{category}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {validItems.length} item{validItems.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              {selectedCount > 0 && (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  {selectedCount} selected
                                </Badge>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="ml-6 mt-1 space-y-1">
                                {/* Select all in category */}
                                {validItems.length > 1 && (
                                  <button
                                    onClick={() => selectAllInCategory(category, items)}
                                    className="text-xs text-blue-600 hover:text-blue-700 mb-2"
                                  >
                                    {validItems.every(i => selectedItemIds.has(i.id))
                                      ? 'Deselect all'
                                      : 'Select all'}
                                  </button>
                                )}

                                {items.map(item => {
                                  const hasPrice = item.rrp || item.tradePrice
                                  const isSelected = selectedItemIds.has(item.id)
                                  const price = item.rrp || (item.tradePrice ? item.tradePrice * (1 + defaultMarkup / 100) : 0)

                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        'flex items-center gap-3 p-2 rounded-lg border',
                                        hasPrice
                                          ? 'cursor-pointer hover:bg-gray-50'
                                          : 'opacity-50 cursor-not-allowed bg-gray-50',
                                        isSelected && 'border-emerald-300 bg-emerald-50'
                                      )}
                                      onClick={() => hasPrice && toggleItem(item.id)}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={!hasPrice}
                                        className={cn(!hasPrice && 'opacity-50')}
                                      />
                                      {item.images?.[0] && (
                                        <img
                                          src={item.images[0]}
                                          alt=""
                                          className="w-10 h-10 rounded object-cover"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{item.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          {item.roomName && <span>{item.roomName}</span>}
                                          {item.brand && <span>• {item.brand}</span>}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        {hasPrice ? (
                                          <>
                                            <p className="font-medium text-sm">{formatCurrency(price)}</p>
                                            <p className="text-xs text-gray-500">
                                              Qty: {item.quantity || 1}
                                            </p>
                                          </>
                                        ) : (
                                          <p className="text-xs text-amber-600">No price</p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="quotes" className="mt-0">
                {/* Markup Input - Prominent when using quotes */}
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-amber-900">Markup Percentage</p>
                      <p className="text-xs text-amber-700">Applied to supplier prices to calculate client price</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={defaultMarkup}
                        onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                        className="w-20 h-9 text-center bg-white"
                        min={0}
                        max={200}
                      />
                      <span className="text-amber-800 font-medium">%</span>
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-2 space-y-2">
                    {approvedQuotes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No approved supplier quotes found
                      </div>
                    ) : (
                      approvedQuotes.map(quote => {
                        const isSelected = selectedQuoteIds.has(quote.id)
                        return (
                          <div
                            key={quote.id}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer hover:bg-gray-50',
                              isSelected && 'border-emerald-300 bg-emerald-50'
                            )}
                            onClick={() => toggleQuote(quote.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isSelected} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{quote.supplierName}</p>
                                  <p className="font-medium">{formatCurrency(quote.totalAmount * (1 + defaultMarkup / 100))}</p>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-500">
                                  <span>{quote.quoteNumber}</span>
                                  <span>{quote.lineItems.length} items</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t space-y-1">
                                {quote.lineItems.map(li => (
                                  <div key={li.id} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{li.itemName}</span>
                                    <span>{formatCurrency(li.unitPrice * (1 + defaultMarkup / 100))} x {li.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Selection Summary */}
            {totals.itemCount > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Selected Items</span>
                  <span className="font-medium">{totals.itemCount}</span>
                </div>
                {activeSource === 'quotes' && totals.supplierCost > 0 && (
                  <>
                    <div className="flex justify-between text-sm mt-1 text-gray-500">
                      <span>Supplier Cost</span>
                      <span>{formatCurrency(totals.supplierCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Your Markup (+{defaultMarkup}%)</span>
                      <span>+{formatCurrency(totals.markup)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Client Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST + QST</span>
                  <span>{formatCurrency(totals.gst + totals.qst)}</span>
                </div>
                <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                  <span>Client Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Invoice Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Lighting & Fixtures - Phase 1"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes for the client"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="validUntil">Due Date</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input
                  id="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
            </div>

            {/* Invoice Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-3">Invoice Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items</span>
                  <span>{totals.itemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (5%)</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">QST (9.975%)</span>
                  <span>{formatCurrency(totals.qst)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total</span>
                  <span className="text-lg">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={saving || !canProceed}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
