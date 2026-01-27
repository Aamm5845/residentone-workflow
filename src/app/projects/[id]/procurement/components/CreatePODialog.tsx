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

interface ItemComponent {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
  imageUrl: string | null
}

interface POItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  quantity: number
  imageUrl: string | null
  tradePrice: number | null
  currency: string
  hasQuote: boolean
  quoteUnitPrice: number | null
  quoteShippingCost: number | null
  components: ItemComponent[]
}

interface FlatItem {
  id: string
  name: string
  roomName: string | null
  quantity: number
  imageUrl: string | null
  unitPrice: number | null
  currency: string
  isComponent: boolean
  parentName?: string
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
  const [groupCurrency, setGroupCurrency] = useState('CAD')

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
        const supplierGroup = data.supplierGroups?.find(
          (g: any) => g.supplierId === supplier.id || g.supplierName === supplier.name
        )
        if (supplierGroup) {
          setGroupCurrency(supplierGroup.currency || 'CAD')
          setItems(supplierGroup.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            imageUrl: item.imageUrl,
            tradePrice: item.tradePrice,
            currency: item.tradePriceCurrency || supplierGroup.currency || 'CAD',
            hasQuote: !!item.supplierQuote,
            quoteUnitPrice: item.supplierQuote?.unitPrice || null,
            quoteShippingCost: item.supplierQuote?.shippingCost || null,
            components: item.components || []
          })))
        } else {
          setItems([])
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [projectId, supplier.id, supplier.name])

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

  // Flatten items and components into single list (like OrdersTab)
  const flatItems: FlatItem[] = []
  items.forEach(item => {
    const unitPrice = item.quoteUnitPrice || item.tradePrice
    flatItems.push({
      id: item.id,
      name: item.name,
      roomName: item.roomName,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      unitPrice,
      currency: item.currency || groupCurrency,
      isComponent: false
    })
    // Add components as separate items
    if (item.components && item.components.length > 0) {
      item.components.forEach(comp => {
        flatItems.push({
          id: comp.id,
          name: comp.name,
          roomName: item.roomName,
          quantity: comp.quantity || 1,
          imageUrl: comp.imageUrl,
          unitPrice: comp.price,
          currency: item.currency || groupCurrency,
          isComponent: true,
          parentName: item.name
        })
      })
    }
  })

  // Calculate total
  const calculateTotal = () => {
    let subtotal = 0
    let shipping = 0
    flatItems.forEach(item => {
      subtotal += (item.unitPrice || 0) * item.quantity
    })
    // Add shipping from first item with quote shipping
    const itemWithShipping = items.find(i => i.quoteShippingCost && i.quoteShippingCost > 0)
    if (itemWithShipping) {
      shipping = itemWithShipping.quoteShippingCost || 0
    }
    return { subtotal, shipping, total: subtotal + shipping }
  }

  const totals = calculateTotal()

  const formatCurrency = (amount: number) => {
    // Always use CAD format for consistent "$" symbol
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const handleCreate = async () => {
    if (flatItems.length === 0) {
      toast.error('No items to order')
      return
    }

    // Check if all items have prices
    const itemsWithoutPrices = flatItems.filter(i => !i.unitPrice)
    if (itemsWithoutPrices.length > 0) {
      toast.error(`${itemsWithoutPrices.length} item(s) don't have trade prices`)
      return
    }

    setCreating(true)
    try {
      // Only send main items (not components) - components are linked to parent items
      const mainItems = items.map(item => ({
        roomFFEItemId: item.id,
        unitPrice: item.quoteUnitPrice || item.tradePrice || 0,
        quantity: item.quantity
      }))

      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          vendorName: supplier.name,
          vendorEmail: supplier.email,
          items: mainItems,
          shippingAddress: shippingAddress.trim() || undefined,
          notes: notes.trim() || undefined,
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            Create a PO for {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 -mx-1">
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
                  Items ({flatItems.length})
                </h3>
                {groupCurrency === 'USD' && (
                  <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                    USD
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : flatItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No items ready to order for this supplier</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flatItems.map((item, idx) => {
                    const totalPrice = (item.unitPrice || 0) * item.quantity

                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {/* Item Image */}
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.name}
                              {item.isComponent && (
                                <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  Component
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {item.roomName && <span>{item.roomName}</span>}
                              {item.roomName && <span>•</span>}
                              <span>Qty: {item.quantity}</span>
                              {item.isComponent && item.parentName && (
                                <>
                                  <span>•</span>
                                  <span>for {item.parentName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {item.unitPrice ? (
                            <>
                              <p className="font-medium text-gray-900">
                                {formatCurrency(totalPrice)}{groupCurrency === 'USD' ? ' USD' : ''}
                              </p>
                              {item.quantity > 1 && (
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(item.unitPrice)} × {item.quantity}
                                </p>
                              )}
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
                value={selectedPaymentMethodId || 'none'}
                onValueChange={(val) => setSelectedPaymentMethodId(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a card for supplier to charge..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No payment method</SelectItem>
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
            {flatItems.length > 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-emerald-700">Subtotal ({flatItems.length} items)</p>
                  <p className="font-medium text-emerald-800">
                    {formatCurrency(totals.subtotal)}{groupCurrency === 'USD' ? ' USD' : ''}
                  </p>
                </div>
                {totals.shipping > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-emerald-700">Shipping (from quote)</p>
                    <p className="font-medium text-emerald-800">
                      {formatCurrency(totals.shipping)}{groupCurrency === 'USD' ? ' USD' : ''}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                  <p className="font-semibold text-emerald-800">Total</p>
                  <p className="text-xl font-bold text-emerald-900">
                    {formatCurrency(totals.total)}{groupCurrency === 'USD' ? ' USD' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || flatItems.length === 0}
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
