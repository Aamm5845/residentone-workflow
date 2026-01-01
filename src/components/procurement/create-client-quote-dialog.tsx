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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, DollarSign, Percent, AlertCircle, Package, ChevronDown, ChevronRight, CheckCircle, Send, Printer, Mail, FileText, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface CreateClientQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (quoteId: string) => void
  projectId: string
  preselectedItemIds?: string[]  // Pre-select items (from bulk quote or per-item quote)
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
  // Pricing
  tradePrice?: number | null
  unitCost?: number | null
  rrp?: number | null
  // Supplier info
  supplierName?: string
  brand?: string
  // Images
  images?: string[]
}

interface LineItem {
  id: string
  itemId: string
  name: string
  description?: string
  category: string
  quantity: number
  unitType: string
  costPrice: number
  markupPercent: number
  sellingPrice: number
  totalPrice: number
  roomName?: string
  hasRrp?: boolean // True if RRP was used (markup is calculated, not editable)
  imageUrl?: string // First image URL
}

interface CategoryMarkup {
  categoryName: string
  markupPercent: number
}

export default function CreateClientQuoteDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  preselectedItemIds
}: CreateClientQuoteDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Created quote data (for Step 3 preview)
  const [createdQuote, setCreatedQuote] = useState<any>(null)
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')

  // Form data - Step 1
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('100% upfront')
  const [depositRequired, setDepositRequired] = useState<number | undefined>(undefined)
  const [defaultMarkup, setDefaultMarkup] = useState(25)

  // Step 2: Items & Pricing
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryMarkups, setCategoryMarkups] = useState<CategoryMarkup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Load items when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadSpecItems()
      loadCategoryMarkups()
      loadProjectClient()

      // Set default valid until date (30 days from now)
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 30)
      setValidUntil(defaultDate.toISOString().split('T')[0])
    }
  }, [open, projectId])

  const loadProjectClient = async () => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const project = await response.json()

      if (response.ok && project?.client) {
        setClientEmail(project.client.email || '')
        setClientName(project.client.name || '')
      }
    } catch (error) {
      console.error('Error loading project client:', error)
    }
  }

  // Build line items from preselected items
  useEffect(() => {
    if (specItems.length > 0 && preselectedItemIds?.length) {
      const items = specItems.filter(item => preselectedItemIds.includes(item.id))
      buildLineItems(items)

      // Auto-generate title - use item name if only one item, otherwise use categories
      if (items.length === 1) {
        // Single item: use the item name as title
        setTitle(items[0].name || 'Item Quote')
      } else {
        // Multiple items: use categories
        const categories = [...new Set(items.map(i => i.category || i.sectionName || 'Items'))]
        if (categories.length === 1) {
          setTitle(`${categories[0]} Quote`)
        } else if (categories.length <= 3) {
          setTitle(`${categories.join(', ')} Quote`)
        } else {
          setTitle(`Quote (${items.length} items)`)
        }
      }

      // Expand all categories by default
      const categories = [...new Set(items.map(i => i.category || i.sectionName || 'Items'))]
      setExpandedCategories(new Set(categories))
    }
  }, [specItems, preselectedItemIds, categoryMarkups])

  // Update line items when default markup changes (for items without RRP)
  useEffect(() => {
    if (lineItems.length > 0) {
      setLineItems(prev => prev.map(item => {
        // Only update items without RRP (those using calculated markup)
        if (!item.hasRrp) {
          const sellingPrice = item.costPrice * (1 + defaultMarkup / 100)
          return {
            ...item,
            markupPercent: defaultMarkup,
            sellingPrice,
            totalPrice: sellingPrice * item.quantity
          }
        }
        return item
      }))
    }
  }, [defaultMarkup])

  const loadSpecItems = async () => {
    setLoading(true)
    try {
      const url = preselectedItemIds?.length
        ? `/api/projects/${projectId}/ffe-specs?ids=${preselectedItemIds.join(',')}`
        : `/api/projects/${projectId}/ffe-specs`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSpecItems(data.items || [])
      }
    } catch (error) {
      console.error('Error loading spec items:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategoryMarkups = async () => {
    try {
      const response = await fetch('/api/settings/category-markups')
      if (response.ok) {
        const data = await response.json()
        setCategoryMarkups(data.markups || [])
      }
    } catch (error) {
      console.error('Error loading category markups:', error)
    }
  }

  const getMarkupForCategory = (category: string): number => {
    const markup = categoryMarkups.find(m => 
      m.categoryName.toLowerCase() === category.toLowerCase()
    )
    return markup?.markupPercent || defaultMarkup
  }

  const buildLineItems = (items: SpecItem[]) => {
    const newLineItems: LineItem[] = items.map(item => {
      const category = item.category || item.sectionName || 'General'
      const defaultMarkupForCategory = getMarkupForCategory(category)

      // Cost price is always trade price (or unitCost as fallback)
      const costPrice = item.tradePrice || item.unitCost || 0

      // If RRP exists, use it as selling price and calculate markup from it
      // If no RRP, apply markup to trade price
      let sellingPrice: number
      let markupPercent: number

      if (item.rrp && item.rrp > 0) {
        // RRP already includes markup - use it directly
        sellingPrice = item.rrp
        // Calculate the actual markup percentage from RRP vs cost
        markupPercent = costPrice > 0 ? ((item.rrp - costPrice) / costPrice) * 100 : 0
      } else {
        // No RRP - apply default markup to cost price
        markupPercent = defaultMarkupForCategory
        sellingPrice = costPrice * (1 + markupPercent / 100)
      }

      const quantity = item.quantity || 1

      return {
        id: `line-${item.id}`,
        itemId: item.id,
        name: item.name,
        description: item.description,
        category,
        quantity,
        unitType: item.unitType || 'units',
        costPrice,
        markupPercent: Math.round(markupPercent * 100) / 100, // Round to 2 decimals
        sellingPrice,
        totalPrice: sellingPrice * quantity,
        roomName: item.roomName,
        hasRrp: !!(item.rrp && item.rrp > 0), // Track if RRP was used
        imageUrl: item.images && item.images.length > 0 ? item.images[0] : undefined
      }
    })

    setLineItems(newLineItems)
  }

  const updateLineItemMarkup = (lineId: string, newMarkup: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const sellingPrice = item.costPrice * (1 + newMarkup / 100)
        return {
          ...item,
          markupPercent: newMarkup,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  const updateLineItemQuantity = (lineId: string, quantity: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        return {
          ...item,
          quantity,
          totalPrice: item.sellingPrice * quantity
        }
      }
      return item
    }))
  }

  const updateLineItemCostPrice = (lineId: string, costPrice: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const sellingPrice = costPrice * (1 + item.markupPercent / 100)
        return {
          ...item,
          costPrice,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  const removeLineItem = (lineId: string) => {
    setLineItems(prev => prev.filter(item => item.id !== lineId))
  }

  // Apply markup to all items in a category
  const applyCategoryMarkup = (category: string, markup: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.category === category) {
        const sellingPrice = item.costPrice * (1 + markup / 100)
        return {
          ...item,
          markupPercent: markup,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  // Group line items by category
  const groupedLineItems = useMemo(() => {
    const groups: Record<string, LineItem[]> = {}
    lineItems.forEach(item => {
      const category = item.category || 'Other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    })
    return groups
  }, [lineItems])

  // Tax rates (defaults - should match org settings)
  const [gstRate] = useState(5)
  const [qstRate] = useState(9.975)

  // Calculate totals
  const totals = useMemo(() => {
    const totalCost = lineItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const gstAmount = subtotal * (gstRate / 100)
    const qstAmount = subtotal * (qstRate / 100)
    const totalRevenue = subtotal + gstAmount + qstAmount
    const grossProfit = subtotal - totalCost // Profit before taxes
    const marginPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0

    return {
      totalCost,
      subtotal,
      gstAmount,
      qstAmount,
      totalRevenue,
      grossProfit,
      marginPercent,
      depositAmount: depositRequired ? (totalRevenue * depositRequired / 100) : 0
    }
  }, [lineItems, depositRequired, gstRate, qstRate])

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

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter an invoice title')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one item to the invoice')
      return
    }

    // Check for items without RRP (Recommended Retail Price)
    const itemsWithoutRrp = lineItems.filter(item => !item.hasRrp)
    if (itemsWithoutRrp.length > 0) {
      const itemNames = itemsWithoutRrp.slice(0, 3).map(i => i.name).join(', ')
      const more = itemsWithoutRrp.length > 3 ? ` and ${itemsWithoutRrp.length - 3} more` : ''
      const confirmed = window.confirm(
        `${itemsWithoutRrp.length} item(s) do not have RRP pricing set (${itemNames}${more}).\n\n` +
        `These items are using calculated prices based on trade price + markup.\n` +
        `It's recommended to set RRP in the spec before creating client invoices.\n\n` +
        `Continue anyway?`
      )
      if (!confirmed) return
    }

    // Check for items without any pricing
    const itemsWithoutPrice = lineItems.filter(item => item.costPrice === 0 && item.sellingPrice === 0)
    if (itemsWithoutPrice.length > 0) {
      const confirmed = window.confirm(
        `${itemsWithoutPrice.length} item(s) have no pricing set at all. The client will see these as $0. Continue anyway?`
      )
      if (!confirmed) return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/client-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description: description || null,
          defaultMarkupPercent: defaultMarkup,
          validUntil: validUntil || null,
          paymentTerms: paymentTerms || null,
          depositRequired: depositRequired || null,
          groupingType: 'category',
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.itemId,
            groupId: item.category,
            itemName: item.name,
            itemDescription: item.description || null,
            quantity: item.quantity,
            unitType: item.unitType,
            costPrice: item.costPrice,
            markupPercent: item.markupPercent,
            sellingPrice: item.sellingPrice,
            totalCost: item.costPrice * item.quantity,
            totalPrice: item.totalPrice,
            order: index
          }))
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[CreateClientQuote] Invoice created:', data.quote?.id, data.quote?.quoteNumber)
        if (!data.quote?.id) {
          console.error('[CreateClientQuote] No ID in response:', data)
          toast.error('Invoice created but ID missing - please refresh')
          return
        }
        setCreatedQuote(data.quote)
        setStep(3) // Show preview step
        toast.success('Invoice created! Review and send to client.')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create invoice')
      }
    } catch (error) {
      console.error('Error creating client invoice:', error)
      toast.error('Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setValidUntil('')
    setPaymentTerms('100% upfront')
    setDepositRequired(undefined)
    setDefaultMarkup(25)
    setLineItems([])
    setSearchQuery('')
    setExpandedCategories(new Set())
    setCreatedQuote(null)
  }

  const handleSendToClient = async () => {
    if (!clientEmail) {
      toast.error('Please enter client email')
      return
    }

    if (!createdQuote?.id) {
      toast.error('Invoice not found')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/client-quotes/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: createdQuote.id,
          clientEmail,
          clientName: clientName || undefined
        })
      })

      if (response.ok) {
        toast.success(`Invoice sent to ${clientEmail}`)
        handleFinish()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send invoice')
      }
    } catch (error) {
      toast.error('Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handlePrintQuote = () => {
    if (!createdQuote?.id) return
    // Open PDF in new tab for printing
    window.open(`/api/client-quotes/${createdQuote.id}/pdf`, '_blank')
  }

  const handleViewQuote = () => {
    if (!createdQuote?.id) {
      console.error('[CreateClientQuote] No quote ID available for viewing')
      toast.error('Invoice ID not available')
      return
    }
    console.log('[CreateClientQuote] Opening client view for ID:', createdQuote.id)
    // Open clean client-facing invoice view
    window.open(`/client/invoice/${createdQuote.id}`, '_blank')
  }

  const handleFinish = () => {
    const quoteId = createdQuote?.id
    resetForm()
    onOpenChange(false)
    if (quoteId) {
      onSuccess(quoteId)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 3 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <DollarSign className="w-5 h-5 text-green-600" />
            )}
            {step === 1 ? 'Create Invoice - Details' : step === 2 ? 'Create Invoice - Pricing' : 'Invoice Created - Send to Client'}
          </DialogTitle>
          {preselectedItemIds?.length ? (
            <p className="text-sm text-gray-500">
              {preselectedItemIds.length} item{preselectedItemIds.length > 1 ? 's' : ''} selected
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Quote Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Title <span className="text-red-500">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kitchen Tiles & Flooring"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes for the client..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100% upfront">100% upfront</SelectItem>
                      <SelectItem value="50% deposit, 50% on delivery">50% deposit, 50% on delivery</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Only show markup settings if some items don't have RRP */}
              {lineItems.some(item => !item.hasRrp) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-800">Default Markup for items without RRP</p>
                      <p className="text-xs text-amber-600">{lineItems.filter(i => !i.hasRrp).length} item(s) need markup applied</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={defaultMarkup}
                        onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        className="w-20 h-8"
                      />
                      <span className="text-amber-700">%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Preview */}
              {lineItems.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-3">Invoice Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Items</span>
                      <span className="font-semibold">{lineItems.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>GST ({gstRate}%)</span>
                      <span>{formatCurrency(totals.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>QST ({qstRate}%)</span>
                      <span>{formatCurrency(totals.qstAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700 font-medium">Total</span>
                      <span className="text-lg font-semibold text-green-600">{formatCurrency(totals.totalRevenue)}</span>
                    </div>
                    {/* Only show profit if some items don't have RRP */}
                    {lineItems.some(i => !i.hasRrp) && (
                      <div className="flex justify-between pt-2 border-t bg-emerald-50 -mx-4 px-4 py-2 mt-2 rounded-b-lg">
                        <span className="text-emerald-700">Your Profit</span>
                        <span className="font-semibold text-emerald-700">
                          {formatCurrency(totals.grossProfit)}
                          <span className="text-xs text-emerald-500 ml-1">({totals.marginPercent.toFixed(1)}%)</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Items & Pricing */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Totals Header */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Cost</p>
                  <p className="text-lg font-bold">{formatCurrency(totals.totalCost)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Quote Total</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Profit</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.grossProfit)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Margin</p>
                  <p className="text-lg font-bold text-purple-600">{totals.marginPercent.toFixed(1)}%</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : lineItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No items selected</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-2">
                    {Object.entries(groupedLineItems).map(([category, items]) => (
                      <div key={category} className="mb-4">
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <Package className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{category}</span>
                            <Badge variant="secondary">{items.length}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">
                              Subtotal: <span className="font-medium text-gray-700">
                                {formatCurrency(items.reduce((sum, i) => sum + i.totalPrice, 0))}
                              </span>
                            </span>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-gray-500">Markup:</Label>
                              <Input
                                type="number"
                                className="w-16 h-7 text-xs"
                                value={items[0]?.markupPercent || defaultMarkup}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  applyCategoryMarkup(category, parseFloat(e.target.value) || 0)
                                }}
                                min={0}
                                max={200}
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </div>
                        </button>

                        {/* Items Table */}
                        {expandedCategories.has(category) && (
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="w-[30%]">Item</TableHead>
                                <TableHead className="text-right w-[12%]">Qty</TableHead>
                                <TableHead className="text-right w-[15%]">Trade Price</TableHead>
                                <TableHead className="text-right w-[12%]">Markup</TableHead>
                                <TableHead className="text-right w-[15%]">Client Price</TableHead>
                                <TableHead className="text-right w-[15%]">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id} className="text-sm">
                                  <TableCell>
                                    <div>
                                      <p className="font-medium truncate">{item.name}</p>
                                      {item.roomName && (
                                        <p className="text-xs text-gray-400">{item.roomName}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      className="w-16 h-7 text-right text-xs"
                                      value={item.quantity}
                                      onChange={(e) => updateLineItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                      min={1}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="relative">
                                      <DollarSign className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                      <Input
                                        type="number"
                                        className={cn(
                                          "w-20 h-7 text-right text-xs pl-5",
                                          item.costPrice === 0 && "border-orange-300 bg-orange-50"
                                        )}
                                        value={item.costPrice || ''}
                                        onChange={(e) => updateLineItemCostPrice(item.id, parseFloat(e.target.value) || 0)}
                                        min={0}
                                        step={0.01}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.hasRrp ? (
                                      // RRP exists - show calculated markup as read-only
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                          {item.markupPercent.toFixed(1)}%
                                        </span>
                                      </div>
                                    ) : (
                                      // No RRP - allow editing markup
                                      <div className="flex items-center justify-end gap-1">
                                        <Input
                                          type="number"
                                          className="w-14 h-7 text-right text-xs"
                                          value={item.markupPercent}
                                          onChange={(e) => updateLineItemMarkup(item.id, parseFloat(e.target.value) || 0)}
                                          min={0}
                                          max={200}
                                        />
                                        <span className="text-xs text-gray-400">%</span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    <div>
                                      {formatCurrency(item.sellingPrice)}
                                      {item.hasRrp && (
                                        <p className="text-[10px] text-blue-500">RRP</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-green-600">
                                    {formatCurrency(item.totalPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Items without pricing warning */}
              {lineItems.filter(i => i.costPrice === 0).length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="text-orange-700">
                    {lineItems.filter(i => i.costPrice === 0).length} item(s) have no cost price.
                    Add trade/cost prices before sending to client.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Invoice Created - Client Preview & Send */}
          {step === 3 && createdQuote && (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Invoice Created!</h3>
                <p className="text-gray-500 mt-1">
                  {createdQuote.quoteNumber} • {lineItems.length} item{lineItems.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Client Preview - What the client will see */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-1">
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="p-4 border-b bg-gray-50">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Client Preview</p>
                    <h4 className="font-bold text-lg text-gray-900">{title}</h4>
                    {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
                  </div>

                  {/* Items - Client View (no markup/profit shown) */}
                  <div className="divide-y max-h-[250px] overflow-y-auto">
                    {lineItems.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                        {/* Image */}
                        {item.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">Qty: {item.quantity} {item.unitType}</p>
                        </div>
                        {/* Price */}
                        <p className="font-semibold text-gray-900 flex-shrink-0">
                          {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="p-4 bg-gray-50 border-t">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>GST ({gstRate}%)</span>
                        <span>{formatCurrency(totals.gstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>QST ({qstRate}%)</span>
                        <span>{formatCurrency(totals.qstAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t mt-2">
                        <span className="font-medium text-gray-700">Total</span>
                        <span className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalRevenue)}</span>
                      </div>
                    </div>
                    {validUntil && (
                      <p className="text-xs text-gray-400 mt-2">Valid until {new Date(validUntil).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Your Profit (separate, not in client view) */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-sm text-emerald-700">Your Profit (before taxes)</span>
                <span className="font-bold text-emerald-700">{formatCurrency(totals.grossProfit)} ({totals.marginPercent.toFixed(1)}%)</span>
              </div>

              {/* Send to Client Section */}
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-gray-900">Send Invoice to Client</h4>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="Enter client email..."
                      className="bg-white"
                    />
                    {clientName ? (
                      <p className="text-xs text-blue-600 mt-1">{clientName}</p>
                    ) : !clientEmail && (
                      <p className="text-xs text-orange-600 mt-1">
                        No client email found in project settings
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSendToClient}
                    disabled={sending || !clientEmail}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Invoice
                  </Button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Client will receive email with invoice link and Stripe payment option
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={handlePrintQuote}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print / Download PDF
                </Button>
                <Button variant="outline" onClick={handleViewQuote}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View as Client
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          {step === 3 ? (
            <>
              <div className="flex-1" />
              <Button onClick={handleFinish} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Done
              </Button>
            </>
          ) : (
            <>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {step === 1 ? (
                <Button
                  onClick={() => setStep(2)}
                  disabled={!title.trim() || lineItems.length === 0}
                >
                  Next: Review Pricing
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={saving} className="bg-green-600 hover:bg-green-700">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <DollarSign className="w-4 h-4 mr-1" />
                  Create Invoice ({formatCurrency(totals.totalRevenue)})
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

