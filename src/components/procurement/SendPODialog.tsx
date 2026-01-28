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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Send,
  Package,
  Building2
} from 'lucide-react'
import { toast } from 'sonner'

interface OrderItem {
  id: string
  name: string
  description?: string | null
  quantity: number
  unitType?: string | null
  unitPrice: number
  totalPrice: number
}

interface SendPODialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    id: string
    orderNumber: string
    vendorName: string
    vendorEmail?: string | null
    totalAmount: number
    subtotal?: number
    shippingCost?: number
    taxAmount?: number
    currency?: string
    shippingAddress?: string | null
    expectedDelivery?: string | null
    billingAddress?: string | null
    savedPaymentMethodId?: string | null
    orderedAt?: string | null  // Track if already sent
    items: OrderItem[]
  }
  onSuccess: () => void
}

export default function SendPODialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: SendPODialogProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [emailLoaded, setEmailLoaded] = useState(false)

  // Order items - fetched from API
  const [orderItems, setOrderItems] = useState<OrderItem[]>(order.items || [])
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [orderData, setOrderData] = useState<{
    totalAmount: number
    subtotal: number
    shippingCost: number
    taxAmount: number
    shippingAddress: string | null
    billingAddress: string | null
    expectedDelivery: string | null
    savedPaymentMethodId: string | null
  } | null>(null)

  // Fetch full order details including items
  const fetchOrderDetails = useCallback(async () => {
    if (!order.id) return

    setLoadingOrder(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.order) {
          // Set items from API
          const items = (data.order.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unitType: item.unitType || null,
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalPrice: parseFloat(item.totalPrice) || 0
          }))
          setOrderItems(items)

          // Set order data
          setOrderData({
            totalAmount: parseFloat(data.order.totalAmount) || 0,
            subtotal: parseFloat(data.order.subtotal) || 0,
            shippingCost: parseFloat(data.order.shippingCost) || 0,
            taxAmount: parseFloat(data.order.taxAmount) || 0,
            shippingAddress: data.order.shippingAddress || null,
            billingAddress: data.order.billingAddress || null,
            expectedDelivery: data.order.expectedDelivery || null,
            savedPaymentMethodId: data.order.savedPaymentMethodId || null
          })

          // Set email from supplier phonebook (preferred) or vendorEmail
          // Always prefer supplier.email from the phonebook
          const supplierEmail = data.order.supplier?.email || data.order.vendorEmail || ''
          if (supplierEmail && !emailLoaded) {
            setEmail(supplierEmail)
            setEmailLoaded(true)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
    } finally {
      setLoadingOrder(false)
    }
  }, [order.id, email])

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      // Reset email state - will be populated from API
      setEmail('')
      setEmailLoaded(false)
      setOrderItems(order.items || [])
      setOrderData(null)
      // Fetch full order details (including supplier email from phonebook)
      fetchOrderDetails()
    }
  }, [open, order, fetchOrderDetails])

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter a supplier email address')
      return
    }

    setSending(true)

    try {
      const res = await fetch(`/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierEmail: email,
          // Use order's existing data
          shippingAddress: orderData?.shippingAddress || order.shippingAddress,
          billingAddress: orderData?.billingAddress || order.billingAddress,
          expectedDelivery: orderData?.expectedDelivery || order.expectedDelivery,
          savedPaymentMethodId: orderData?.savedPaymentMethodId || order.savedPaymentMethodId,
          isTest: false // Explicitly set to false to ensure no [TEST] prefix
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send PO')
      }

      toast.success(`Purchase Order sent to ${email}`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send Purchase Order')
    } finally {
      setSending(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: order.currency || 'CAD'
    }).format(amount)
  }

  const displayItems = orderItems.length > 0 ? orderItems : order.items
  const displayTotal = orderData?.totalAmount ?? order.totalAmount
  const displaySubtotal = orderData?.subtotal ?? order.subtotal ?? 0
  const displayShipping = orderData?.shippingCost ?? order.shippingCost ?? 0
  const displayTax = orderData?.taxAmount ?? order.taxAmount ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            {order.orderedAt ? 'Resend Purchase Order' : 'Send Purchase Order'}
          </DialogTitle>
          <DialogDescription>
            {order.orderedAt
              ? `Resend PO ${order.orderNumber} to ${order.vendorName} (previously sent)`
              : `Review and send PO ${order.orderNumber} to ${order.vendorName}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Order Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-blue-900">{order.orderNumber}</p>
                <div className="flex items-center gap-2 text-sm text-blue-700 mt-1">
                  <Building2 className="w-4 h-4" />
                  {order.vendorName}
                </div>
                <p className="text-xs text-blue-600 mt-1">{displayItems.length} items</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-blue-900">{formatCurrency(displayTotal)}</p>
              </div>
            </div>
          </div>

          {/* Items Preview */}
          {loadingOrder ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <ScrollArea className="h-[200px] border rounded-lg">
              <div className="p-4 space-y-2">
                {displayItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No items found</p>
                  </div>
                ) : (
                  displayItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 flex-shrink-0 rounded bg-blue-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatCurrency(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Totals */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(displaySubtotal)}</span>
            </div>
            {displayShipping > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span>{formatCurrency(displayShipping)}</span>
              </div>
            )}
            {displayTax > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span>{formatCurrency(displayTax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total</span>
              <span className="text-blue-600">{formatCurrency(displayTotal)}</span>
            </div>
          </div>

          {/* Supplier Email */}
          <div>
            <Label htmlFor="email">Send to Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supplier@company.com"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {order.orderedAt ? 'Resend Purchase Order' : 'Send Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
