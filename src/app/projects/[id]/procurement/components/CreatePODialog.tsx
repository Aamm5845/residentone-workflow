'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Loader2,
  Package,
  ShoppingCart,
  Building2,
  CreditCard,
  Truck,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface POItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  quantity: number
  tradePrice: number | null
  currency: string
  // Quote info if available
  hasQuote: boolean
  quoteUnitPrice: number | null
  quoteShippingCost: number | null
  quoteCurrency: string | null
}

interface SavedPaymentMethod {
  id: string
  type: string
  nickname: string | null
  lastFour: string | null
  cardBrand: string | null
  expiry: string | null
  holderName: string | null
  hasFullCardDetails: boolean
}

interface CreatePODialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  supplier: {
    id: string
    name: string
    email: string | null
  }
  defaultShippingAddress?: string
  onSuccess: () => void
}

export default function CreatePODialog({
  open,
  onOpenChange,
  projectId,
  supplier,
  defaultShippingAddress,
  onSuccess
}: CreatePODialogProps) {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [items, setItems] = useState<POItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)

  // Form state
  const [shippingAddress, setShippingAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('')

  // Fetch items for this supplier
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/procurement/orders/ready-to-order?supplierId=${supplier.id}`
      )
      if (res.ok) {
        const data = await res.json()
        // Transform to our simplified format
        const supplierGroup = data.supplierGroups?.find(
          (g: any) => g.supplierId === supplier.id
        )
        if (supplierGroup) {
          setItems(supplierGroup.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            tradePrice: item.tradePrice || item.supplierQuote?.unitPrice || null,
            currency: item.tradePriceCurrency || item.supplierQuote?.currency || 'CAD',
            hasQuote: !!item.supplierQuote,
            quoteUnitPrice: item.supplierQuote?.unitPrice || null,
            quoteShippingCost: item.supplierQuote?.shippingCost || null,
            quoteCurrency: item.supplierQuote?.currency || null
          })))
        } else {
          // No items with quotes, check itemsWithoutQuotes
          const noQuoteItems = data.itemsWithoutQuotes || []
          setItems(noQuoteItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            tradePrice: item.tradePrice || null,
            currency: item.tradePriceCurrency || 'CAD',
            hasQuote: false,
            quoteUnitPrice: null,
            quoteShippingCost: null,
            quoteCurrency: null
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [projectId, supplier.id])

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    setLoadingPaymentMethods(true)
    try {
      const res = await fetch('/api/saved-payment-methods')
      if (res.ok) {
        const data = await res.json()
        setPaymentMethods(data.paymentMethods || data.methods || [])
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    } finally {
      setLoadingPaymentMethods(false)
    }
  }, [])

  // Initialize when dialog opens
  useEffect(() => {
    if (open) {
      fetchItems()
      fetchPaymentMethods()
      setShippingAddress(defaultShippingAddress || '')
      setNotes('')
      setSelectedPaymentMethodId('')
    }
  }, [open, fetchItems, fetchPaymentMethods, defaultShippingAddress])

  // Calculate totals - group by currency
  const calculateTotals = () => {
    const byCurrency: Record<string, { subtotal: number; shipping: number; items: number }> = {}

    items.forEach(item => {
      const currency = item.currency || 'CAD'
      if (!byCurrency[currency]) {
        byCurrency[currency] = { subtotal: 0, shipping: 0, items: 0 }
      }
      const price = item.tradePrice || item.quoteUnitPrice || 0
      byCurrency[currency].subtotal += price * item.quantity
      byCurrency[currency].items += 1
      // Add shipping from quote if first item with that currency
      if (item.quoteShippingCost && byCurrency[currency].shipping === 0) {
        byCurrency[currency].shipping = item.quoteShippingCost
      }
    })

    return byCurrency
  }

  const totals = calculateTotals()
  const currencies = Object.keys(totals)
  const hasMultipleCurrencies = currencies.length > 1

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const handleCreate = async () => {
    if (items.length === 0) {
      toast.error('No items to order')
      return
    }

    // Check if all items have prices
    const itemsWithoutPrices = items.filter(i => !i.tradePrice && !i.quoteUnitPrice)
    if (itemsWithoutPrices.length > 0) {
      toast.error(`${itemsWithoutPrices.length} item(s) don't have trade prices`)
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          vendorName: supplier.name,
          vendorEmail: supplier.email,
          items: items.map(item => ({
            roomFFEItemId: item.id,
            unitPrice: item.tradePrice || item.quoteUnitPrice || 0,
            quantity: item.quantity
          })),
          shippingAddress: shippingAddress.trim() || undefined,
          notes: notes.trim() || undefined,
          // Currency will be determined from items
          savedPaymentMethodId: selectedPaymentMethodId || undefined
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`PO ${data.order.orderNumber} created for ${supplier.name}`)
        onSuccess()
        onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            Create a PO for {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Supplier Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{supplier.name}</p>
                  {supplier.email && (
                    <p className="text-sm text-blue-700">{supplier.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Items ({items.length})
                </h3>
                {hasMultipleCurrencies && (
                  <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Multiple currencies
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No items ready to order for this supplier</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const price = item.tradePrice || item.quoteUnitPrice
                    const currency = item.currency || 'CAD'

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {item.roomName && <span>{item.roomName}</span>}
                              <span>Qty: {item.quantity}</span>
                              {item.hasQuote && (
                                <Badge variant="outline" className="text-xs text-green-700 border-green-200">
                                  Has Quote
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {price ? (
                            <>
                              <p className="font-medium text-gray-900">
                                {formatCurrency(price * item.quantity, currency)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(price, currency)} × {item.quantity}
                              </p>
                            </>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No price
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Shipping Address */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-500" />
                Ship To Address
              </Label>
              <Textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Enter shipping address..."
                rows={3}
              />
            </div>

            {/* Credit Card for Supplier */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                Payment Method for Supplier
              </Label>
              <Select
                value={selectedPaymentMethodId}
                onValueChange={setSelectedPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a card for supplier to charge..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No payment method</SelectItem>
                  {loadingPaymentMethods ? (
                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                  ) : paymentMethods.length === 0 ? (
                    <SelectItem value="_empty" disabled>No saved payment methods</SelectItem>
                  ) : (
                    paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        <div className="flex items-center gap-2">
                          <span>{pm.nickname || `${pm.cardBrand} ****${pm.lastFour}`}</span>
                          {pm.hasFullCardDetails && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              Full Details
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPaymentMethodId && paymentMethods.find(pm => pm.id === selectedPaymentMethodId)?.hasFullCardDetails && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Full card details will be included in the PO for supplier to charge
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Order Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes visible on PO..."
                rows={2}
              />
            </div>

            {/* Totals */}
            {items.length > 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                {currencies.map(currency => {
                  const t = totals[currency]
                  const total = t.subtotal + t.shipping
                  return (
                    <div key={currency} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-emerald-800">
                          {t.items} item{t.items > 1 ? 's' : ''} ({currency})
                        </p>
                        {t.shipping > 0 && (
                          <p className="text-xs text-emerald-600">
                            Includes {formatCurrency(t.shipping, currency)} shipping from quote
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-emerald-900">
                        {formatCurrency(total, currency)}
                      </p>
                    </div>
                  )
                })}
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
            disabled={creating || items.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4 mr-2" />
            )}
            Create Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
