'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  Loader2,
  Package,
  ShoppingCart,
  Store,
  DollarSign,
  ExternalLink,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Layers
} from 'lucide-react'
import { toast } from 'sonner'

interface ItemComponent {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
  total: number
}

interface QuoteInfo {
  id: string
  supplierId: string | null
  supplierName: string
  unitPrice: number | null
  totalPrice: number
  quantity: number
  leadTimeWeeks: number | null
  isAccepted: boolean
  shippingCost: number | null
  depositRequired: number | null
  depositPercent: number | null
  paymentTerms: string | null
  currency: string
}

interface QuoteMatch {
  priceMatches: boolean | null
  quantityMatches: boolean | null
  itemPrice: number | null
  quotePrice: number | null
  priceDifference: number | null
}

interface ManualOrderItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  categoryName: string | null
  quantity: number
  imageUrl: string | null
  specStatus: string
  tradePrice: number | null
  rrp: number | null
  currency: string
  components: ItemComponent[]
  componentsTotal: number
  hasQuote: boolean
  quote: QuoteInfo | null
  quoteMatch: QuoteMatch
  isOrdered: boolean
  existingOrder: {
    id: string
    orderNumber: string
    status: string
  } | null
}

interface SupplierOption {
  id: string
  name: string
  email: string | null
}

interface CreateManualOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  items?: ManualOrderItem[] // Optional - if not provided, will fetch from API
  defaultShippingAddress?: string
  onSuccess: () => void
}

interface ItemOrderDetails {
  itemId: string
  selected: boolean
  unitPrice: string
  quantity: number
  includeComponents: boolean
}

export default function CreateManualOrderDialog({
  open,
  onOpenChange,
  projectId,
  items: passedItems,
  defaultShippingAddress,
  onSuccess
}: CreateManualOrderDialogProps) {
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetched data
  const [fetchedItems, setFetchedItems] = useState<ManualOrderItem[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [showAlreadyOrdered, setShowAlreadyOrdered] = useState(true) // Show items that already have orders

  // Use passed items or fetched items
  const items = passedItems || fetchedItems

  // Vendor info
  const [vendorName, setVendorName] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [vendorUrl, setVendorUrl] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')

  // Order details
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingMethod, setShippingMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Already ordered externally?
  const [alreadyOrdered, setAlreadyOrdered] = useState(false)
  const [externalOrderNumber, setExternalOrderNumber] = useState('')

  // Shipping and tax
  const [shippingCost, setShippingCost] = useState('')
  const [taxAmount, setTaxAmount] = useState('')

  // Deposit tracking
  const [depositRequired, setDepositRequired] = useState('')
  const [depositPercent, setDepositPercent] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')

  // Item selections with prices
  const [itemDetails, setItemDetails] = useState<ItemOrderDetails[]>([])

  // Expanded items (for showing components)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Fetch items from API when dialog opens
  const fetchItems = async () => {
    if (passedItems) return // Don't fetch if items are passed

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showAlreadyOrdered) params.set('showAll', 'true')
      if (selectedSupplierId) params.set('supplierId', selectedSupplierId)

      const res = await fetch(
        `/api/projects/${projectId}/procurement/orders/create-manual?${params}`
      )
      if (res.ok) {
        const data = await res.json()
        setFetchedItems(data.items || [])
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !passedItems) {
      fetchItems()
    }
  }, [open, showAlreadyOrdered, selectedSupplierId])

  // Initialize item details and defaults when dialog opens or items change
  useEffect(() => {
    if (open && items.length > 0) {
      setItemDetails(
        items.map(item => ({
          itemId: item.id,
          selected: !item.isOrdered, // Auto-select items not yet ordered
          // Default to trade price or quote price
          unitPrice: item.tradePrice?.toString() || item.quote?.unitPrice?.toString() || '',
          quantity: item.quantity || 1,
          includeComponents: item.components.length > 0
        }))
      )
      // Set default shipping address from project
      if (defaultShippingAddress && !shippingAddress) {
        setShippingAddress(defaultShippingAddress)
      }
    }
  }, [open, items, defaultShippingAddress])

  // Auto-fill deposit info from quote when supplier is selected
  useEffect(() => {
    if (selectedSupplierId && items.length > 0) {
      const itemWithQuote = items.find(
        i => i.quote?.supplierId === selectedSupplierId && (i.quote?.depositRequired || i.quote?.depositPercent)
      )
      if (itemWithQuote?.quote) {
        if (itemWithQuote.quote.depositRequired && !depositRequired) {
          setDepositRequired(itemWithQuote.quote.depositRequired.toString())
        }
        if (itemWithQuote.quote.depositPercent && !depositPercent) {
          setDepositPercent(itemWithQuote.quote.depositPercent.toString())
        }
        if (itemWithQuote.quote.paymentTerms && !paymentTerms) {
          setPaymentTerms(itemWithQuote.quote.paymentTerms)
        }
        if (itemWithQuote.quote.shippingCost && !shippingCost) {
          setShippingCost(itemWithQuote.quote.shippingCost.toString())
        }
      }
    }
  }, [selectedSupplierId, items])

  const handleItemToggle = (itemId: string, checked: boolean) => {
    setItemDetails(prev =>
      prev.map(d => (d.itemId === itemId ? { ...d, selected: checked } : d))
    )
  }

  const handlePriceChange = (itemId: string, price: string) => {
    setItemDetails(prev =>
      prev.map(d => (d.itemId === itemId ? { ...d, unitPrice: price } : d))
    )
  }

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemDetails(prev =>
      prev.map(d => (d.itemId === itemId ? { ...d, quantity } : d))
    )
  }

  const handleIncludeComponentsChange = (itemId: string, include: boolean) => {
    setItemDetails(prev =>
      prev.map(d => (d.itemId === itemId ? { ...d, includeComponents: include } : d))
    )
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const selectedItems = itemDetails.filter(d => d.selected)
  const itemsWithPrices = selectedItems.filter(d => d.unitPrice && parseFloat(d.unitPrice) > 0)

  // Calculate subtotal including components
  const subtotal = selectedItems.reduce((sum, d) => {
    const item = items.find(i => i.id === d.itemId)
    const price = parseFloat(d.unitPrice) || 0
    let total = price * d.quantity
    // Add components if included
    if (d.includeComponents && item?.componentsTotal) {
      total += item.componentsTotal
    }
    return sum + total
  }, 0)
  const shippingAmount = parseFloat(shippingCost) || 0
  const taxTotal = parseFloat(taxAmount) || 0
  const totalCost = subtotal + shippingAmount + taxTotal

  // Calculate deposit amount
  const depositAmount = depositRequired
    ? parseFloat(depositRequired)
    : depositPercent
    ? totalCost * (parseFloat(depositPercent) / 100)
    : null
  const balanceDue = depositAmount ? totalCost - depositAmount : null

  const canCreate = vendorName.trim() && itemsWithPrices.length > 0

  // Check quote matching
  const quoteMatchSummary = selectedItems.reduce(
    (acc, d) => {
      const item = items.find(i => i.id === d.itemId)
      if (item?.quoteMatch?.priceMatches === true) acc.matches++
      else if (item?.quoteMatch?.priceMatches === false) acc.mismatches++
      return acc
    },
    { matches: 0, mismatches: 0 }
  )

  const handleCreate = async () => {
    if (!canCreate) return

    setCreating(true)
    try {
      const orderItems = selectedItems
        .filter(d => d.unitPrice && parseFloat(d.unitPrice) > 0)
        .map(d => ({
          roomFFEItemId: d.itemId,
          unitPrice: parseFloat(d.unitPrice),
          quantity: d.quantity,
          includeComponents: d.includeComponents
        }))

      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId || undefined,
          vendorName: vendorName.trim(),
          vendorEmail: vendorEmail.trim() || undefined,
          vendorUrl: vendorUrl.trim() || undefined,
          items: orderItems,
          shippingAddress: shippingAddress.trim() || undefined,
          shippingMethod: shippingMethod.trim() || undefined,
          shippingCost: shippingAmount || undefined,
          taxAmount: taxTotal || undefined,
          notes: notes.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          alreadyOrdered,
          externalOrderNumber: externalOrderNumber.trim() || undefined,
          // Deposit tracking
          depositRequired: depositAmount || undefined,
          depositPercent: depositPercent ? parseFloat(depositPercent) : undefined,
          paymentTerms: paymentTerms.trim() || undefined
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Order ${data.order.orderNumber} created for ${vendorName}`)
        onSuccess()
        onOpenChange(false)
        // Reset form
        resetForm()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create order')
      }
    } catch (error) {
      toast.error('Failed to create order')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setVendorName('')
    setVendorEmail('')
    setVendorUrl('')
    setSelectedSupplierId('')
    setShippingAddress('')
    setShippingMethod('')
    setShippingCost('')
    setTaxAmount('')
    setNotes('')
    setInternalNotes('')
    setAlreadyOrdered(false)
    setExternalOrderNumber('')
    setDepositRequired('')
    setDepositPercent('')
    setPaymentTerms('')
    setExpandedItems(new Set())
  }

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-600" />
            Create Manual Order
          </DialogTitle>
          <DialogDescription>
            Create a purchase order for items. Shows quote matching to verify prices.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Filters - only show when fetching from API */}
            {!passedItems && (
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showAlreadyOrdered"
                    checked={showAlreadyOrdered}
                    onCheckedChange={checked => setShowAlreadyOrdered(!!checked)}
                  />
                  <Label htmlFor="showAlreadyOrdered" className="text-sm cursor-pointer">
                    Include already ordered items
                  </Label>
                </div>
                <div className="flex-1">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Filter by supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All suppliers</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchItems} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}

            {/* Vendor Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Vendor Information</h3>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="vendorName">
                    Vendor Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="vendorName"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g., Amazon, Home Depot, West Elm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="vendorEmail">Vendor Email</Label>
                    <Input
                      id="vendorEmail"
                      type="email"
                      value={vendorEmail}
                      onChange={e => setVendorEmail(e.target.value)}
                      placeholder="orders@vendor.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vendorUrl">Product/Order URL</Label>
                    <Input
                      id="vendorUrl"
                      type="url"
                      value={vendorUrl}
                      onChange={e => setVendorUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Already Ordered Toggle */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Checkbox
                id="alreadyOrdered"
                checked={alreadyOrdered}
                onCheckedChange={checked => setAlreadyOrdered(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="alreadyOrdered"
                  className="text-sm font-medium text-blue-800 cursor-pointer"
                >
                  Order was already placed externally
                </Label>
                <p className="text-xs text-blue-600">
                  Check this if you&apos;ve already ordered from the vendor and want to track it
                </p>
              </div>
            </div>

            {alreadyOrdered && (
              <div className="grid gap-2">
                <Label htmlFor="externalOrderNumber">External Order Number</Label>
                <Input
                  id="externalOrderNumber"
                  value={externalOrderNumber}
                  onChange={e => setExternalOrderNumber(e.target.value)}
                  placeholder="e.g., Amazon order #123-456789"
                />
              </div>
            )}

            {/* Items Selection with Quote Matching */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Items to Order ({selectedItems.length} selected)
                </h3>
                {quoteMatchSummary.matches + quoteMatchSummary.mismatches > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    {quoteMatchSummary.matches > 0 && (
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {quoteMatchSummary.matches} match quote
                      </Badge>
                    )}
                    {quoteMatchSummary.mismatches > 0 && (
                      <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {quoteMatchSummary.mismatches} price diff
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No items found. Try adjusting the filters.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const details = itemDetails.find(d => d.itemId === item.id)
                    if (!details) return null

                    const isExpanded = expandedItems.has(item.id)
                    const hasComponents = item.components.length > 0

                    return (
                      <Collapsible
                        key={item.id}
                        open={isExpanded}
                        onOpenChange={() => hasComponents && toggleExpanded(item.id)}
                      >
                        <div
                          className={`border rounded-lg transition-colors ${
                            details.selected
                              ? 'bg-white border-gray-300'
                              : 'bg-gray-50 border-gray-200'
                          } ${item.isOrdered ? 'opacity-60' : ''}`}
                        >
                          <div className="p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={details.selected}
                                onCheckedChange={checked => handleItemToggle(item.id, !!checked)}
                                disabled={item.isOrdered}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {hasComponents && (
                                        <CollapsibleTrigger asChild>
                                          <button className="p-0.5 hover:bg-gray-100 rounded">
                                            {isExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-gray-400" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                          </button>
                                        </CollapsibleTrigger>
                                      )}
                                      <p className="font-medium text-gray-900">{item.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                      {item.roomName && <span>{item.roomName}</span>}
                                      {hasComponents && (
                                        <>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">
                                            <Layers className="w-3 h-3" />
                                            {item.components.length} component{item.components.length > 1 ? 's' : ''}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Quote match indicator */}
                                    {item.quoteMatch?.priceMatches === true && (
                                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Matches quote
                                      </Badge>
                                    )}
                                    {item.quoteMatch?.priceMatches === false && (
                                      <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-xs">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Diff: {formatCurrency(item.quoteMatch?.priceDifference || 0, item.currency)}
                                      </Badge>
                                    )}
                                    {item.isOrdered && item.existingOrder && (
                                      <Badge variant="secondary" className="text-xs">
                                        {item.existingOrder.orderNumber}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Quote info */}
                                {item.quote && (
                                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                    <span className="font-medium">{item.quote.supplierName}</span>
                                    {' · '}
                                    Quote: {formatCurrency(item.quote.unitPrice || 0, item.quote.currency)}
                                    {item.quote.leadTimeWeeks && ` · ${item.quote.leadTimeWeeks} wks`}
                                  </div>
                                )}

                                {details.selected && !item.isOrdered && (
                                  <div className="mt-3 grid grid-cols-3 gap-3">
                                    <div className="grid gap-1">
                                      <Label className="text-xs text-gray-500">Unit Price *</Label>
                                      <div className="relative">
                                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={details.unitPrice}
                                          onChange={e => handlePriceChange(item.id, e.target.value)}
                                          placeholder="0.00"
                                          className="pl-7 h-9"
                                        />
                                      </div>
                                    </div>
                                    <div className="grid gap-1">
                                      <Label className="text-xs text-gray-500">Quantity</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={details.quantity}
                                        onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                                        className="h-9"
                                      />
                                    </div>
                                    {hasComponents && (
                                      <div className="grid gap-1">
                                        <Label className="text-xs text-gray-500">Components</Label>
                                        <div className="flex items-center h-9 gap-2">
                                          <Checkbox
                                            id={`include-comp-${item.id}`}
                                            checked={details.includeComponents}
                                            onCheckedChange={checked =>
                                              handleIncludeComponentsChange(item.id, !!checked)
                                            }
                                          />
                                          <Label
                                            htmlFor={`include-comp-${item.id}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            Include (+{formatCurrency(item.componentsTotal, item.currency)})
                                          </Label>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Components list */}
                          <CollapsibleContent>
                            {hasComponents && (
                              <div className="border-t bg-gray-50 px-3 py-2">
                                <div className="space-y-1 ml-7">
                                  {item.components.map(comp => (
                                    <div
                                      key={comp.id}
                                      className="flex items-center justify-between text-xs text-gray-600"
                                    >
                                      <span>
                                        └ {comp.name}
                                        {comp.modelNumber && (
                                          <span className="text-gray-400 ml-1">({comp.modelNumber})</span>
                                        )}
                                        {comp.quantity > 1 && <span className="ml-1">×{comp.quantity}</span>}
                                      </span>
                                      <span>
                                        {comp.price
                                          ? formatCurrency(comp.total, item.currency)
                                          : '-'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )
                  })}
                </div>
              )}

              {selectedItems.length > 0 && itemsWithPrices.length < selectedItems.length && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {selectedItems.length - itemsWithPrices.length} item(s) need prices to be included
                  </span>
                </div>
              )}
            </div>

            {/* Deposit & Payment Terms */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Deposit & Payment Terms</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="depositRequired">Deposit Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="depositRequired"
                      type="number"
                      step="0.01"
                      min="0"
                      value={depositRequired}
                      onChange={e => {
                        setDepositRequired(e.target.value)
                        if (e.target.value) setDepositPercent('')
                      }}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="depositPercent">Or Deposit %</Label>
                  <div className="relative">
                    <Input
                      id="depositPercent"
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={depositPercent}
                      onChange={e => {
                        setDepositPercent(e.target.value)
                        if (e.target.value) setDepositRequired('')
                      }}
                      placeholder="e.g., 50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    placeholder="e.g., Net 30"
                  />
                </div>
              </div>
              {depositAmount !== null && depositAmount > 0 && (
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  Deposit: {formatCurrency(depositAmount)} · Balance due: {formatCurrency(balanceDue || 0)}
                </div>
              )}
            </div>

            {/* Shipping Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Shipping & Fees (Optional)</h3>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shippingAddress">Shipping Address</Label>
                  <Textarea
                    id="shippingAddress"
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    placeholder="Enter delivery address..."
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shippingMethod">Shipping Method</Label>
                  <Input
                    id="shippingMethod"
                    value={shippingMethod}
                    onChange={e => setShippingMethod(e.target.value)}
                    placeholder="e.g., Standard, Express, White Glove"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shippingCost">Shipping Cost</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="shippingCost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingCost}
                        onChange={e => setShippingCost(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxAmount">Tax Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="taxAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxAmount}
                        onChange={e => setTaxAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Notes (Optional)</h3>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="notes">Order Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes visible on PO..."
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="internalNotes">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    placeholder="Private notes for your team..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            {itemsWithPrices.length > 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-emerald-800">
                      {itemsWithPrices.length} item{itemsWithPrices.length > 1 ? 's' : ''} to order
                    </p>
                    <div className="text-sm text-emerald-600 space-y-0.5">
                      <p>Subtotal: {formatCurrency(subtotal)}</p>
                      {shippingAmount > 0 && <p>Shipping: {formatCurrency(shippingAmount)}</p>}
                      {taxTotal > 0 && <p>Tax: {formatCurrency(taxTotal)}</p>}
                      {(shippingAmount > 0 || taxTotal > 0) && (
                        <p className="font-medium text-emerald-800 pt-1 border-t border-emerald-200">
                          Total: {formatCurrency(totalCost)}
                        </p>
                      )}
                      {depositAmount !== null && depositAmount > 0 && (
                        <div className="pt-1 border-t border-emerald-200 mt-1">
                          <p>Deposit: {formatCurrency(depositAmount)}</p>
                          <p>Balance due: {formatCurrency(balanceDue || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !canCreate}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4 mr-2" />
            )}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
