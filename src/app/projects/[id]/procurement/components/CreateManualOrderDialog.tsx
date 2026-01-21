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
  Loader2,
  Package,
  ShoppingCart,
  Store,
  DollarSign,
  ExternalLink,
  AlertCircle,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

interface ReadyToOrderItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  categoryName: string | null
  quantity: number
  imageUrl: string | null
  paidAmount: number | null
  tradePrice: number | null
  tradePriceCurrency: string | null
  clientInvoice: {
    quoteNumber: string
    clientTotalPrice: number
  } | null
}

interface CreateManualOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  items: ReadyToOrderItem[]
  defaultShippingAddress?: string
  onSuccess: () => void
}

interface ItemOrderDetails {
  itemId: string
  selected: boolean
  unitPrice: string
  quantity: number
}

export default function CreateManualOrderDialog({
  open,
  onOpenChange,
  projectId,
  items,
  defaultShippingAddress,
  onSuccess
}: CreateManualOrderDialogProps) {
  const [creating, setCreating] = useState(false)

  // Vendor info
  const [vendorName, setVendorName] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [vendorUrl, setVendorUrl] = useState('')

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

  // Item selections with prices
  const [itemDetails, setItemDetails] = useState<ItemOrderDetails[]>([])

  // Initialize item details and defaults when dialog opens
  useEffect(() => {
    if (open && items.length > 0) {
      setItemDetails(
        items.map(item => ({
          itemId: item.id,
          selected: true,
          // Default to trade price if available
          unitPrice: item.tradePrice ? item.tradePrice.toString() : '',
          quantity: item.quantity || 1
        }))
      )
      // Set default shipping address from project
      if (defaultShippingAddress && !shippingAddress) {
        setShippingAddress(defaultShippingAddress)
      }
    }
  }, [open, items, defaultShippingAddress])

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

  const selectedItems = itemDetails.filter(d => d.selected)
  const itemsWithPrices = selectedItems.filter(d => d.unitPrice && parseFloat(d.unitPrice) > 0)

  const subtotal = selectedItems.reduce((sum, d) => {
    const price = parseFloat(d.unitPrice) || 0
    return sum + price * d.quantity
  }, 0)
  const shippingAmount = parseFloat(shippingCost) || 0
  const taxTotal = parseFloat(taxAmount) || 0
  const totalCost = subtotal + shippingAmount + taxTotal

  const canCreate = vendorName.trim() && itemsWithPrices.length > 0

  const handleCreate = async () => {
    if (!canCreate) return

    setCreating(true)
    try {
      const orderItems = selectedItems
        .filter(d => d.unitPrice && parseFloat(d.unitPrice) > 0)
        .map(d => ({
          roomFFEItemId: d.itemId,
          unitPrice: parseFloat(d.unitPrice),
          quantity: d.quantity
        }))

      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          externalOrderNumber: externalOrderNumber.trim() || undefined
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Order ${data.order.orderNumber} created for ${vendorName}`)
        onSuccess()
        onOpenChange(false)
        // Reset form
        setVendorName('')
        setVendorEmail('')
        setVendorUrl('')
        setShippingAddress('')
        setShippingMethod('')
        setShippingCost('')
        setTaxAmount('')
        setNotes('')
        setInternalNotes('')
        setAlreadyOrdered(false)
        setExternalOrderNumber('')
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-600" />
            Create Manual Order
          </DialogTitle>
          <DialogDescription>
            Create a purchase order for items without supplier quotes (e.g., Amazon, local stores)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
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

            {/* Items Selection with Prices */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Items to Order ({selectedItems.length} selected)
              </h3>
              <div className="space-y-2">
                {items.map(item => {
                  const details = itemDetails.find(d => d.itemId === item.id)
                  if (!details) return null

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        details.selected ? 'bg-white border-gray-300' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={details.selected}
                          onCheckedChange={checked => handleItemToggle(item.id, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                {item.roomName && <span>{item.roomName}</span>}
                                {item.clientInvoice && (
                                  <>
                                    <span>•</span>
                                    <span>Invoice: {item.clientInvoice.quoteNumber}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {item.clientInvoice && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                Client paid {formatCurrency(item.clientInvoice.clientTotalPrice)}
                              </Badge>
                            )}
                          </div>

                          {details.selected && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
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
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedItems.length > 0 && itemsWithPrices.length < selectedItems.length && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {selectedItems.length - itemsWithPrices.length} item(s) need prices to be included
                  </span>
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
