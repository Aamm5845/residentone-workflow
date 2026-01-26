'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Package,
  Building2,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Truck,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Clock,
  FileText,
  MapPin
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface CreateOrdersFromInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoiceId: string
  invoiceNumber: string
  onSuccess: () => void
}

interface SupplierOrder {
  supplierName: string
  supplierEmail: string | null
  itemCount: number
  subtotal: number
  items: {
    id: string
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    leadTimeWeeks: number | null
    hasAcceptedQuote: boolean
  }[]
}

interface PreviewData {
  invoice: {
    id: string
    number: string
    title: string
    totalAmount: number
    totalPaid: number
    isPaid: boolean
    paymentPercent: number
  }
  orders: SupplierOrder[]
  itemsWithoutSupplier: { id: string; name: string; reason: string }[]
  alreadyOrderedItems: { id: string; name: string; existingOrder: string; status: string }[]
  canCreateOrders: boolean
  defaultShippingAddress?: string
}

export default function CreateOrdersFromInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  invoiceId,
  invoiceNumber,
  onSuccess
}: CreateOrdersFromInvoiceDialogProps) {
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [shippingAddress, setShippingAddress] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open && invoiceId) {
      loadPreview()
    }
  }, [open, invoiceId])

  const loadPreview = async () => {
    setLoading(true)
    try {
      // Fetch preview data and project info in parallel
      const [previewRes, projectRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/procurement/orders/create-from-invoice?clientQuoteId=${invoiceId}`),
        fetch(`/api/projects/${projectId}`)
      ])

      if (previewRes.ok) {
        const data = await previewRes.json()
        setPreview(data)
        // Expand all suppliers by default
        setExpandedSuppliers(new Set(data.orders.map((_: any, i: number) => `supplier-${i}`)))
      } else {
        const error = await previewRes.json()
        toast.error(error.error || 'Failed to load preview')
      }

      // Set default shipping address from project
      if (projectRes.ok) {
        const projectData = await projectRes.json()
        const defaultAddr = projectData.project?.defaultShippingAddress || projectData.project?.address || ''
        setShippingAddress(defaultAddr)
      }
    } catch (error) {
      toast.error('Failed to load order preview')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrders = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-from-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientQuoteId: invoiceId,
          shippingAddress: shippingAddress || null,
          notes: notes || null
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.orders.length} purchase order${data.orders.length > 1 ? 's' : ''} created!`)
        onSuccess()
        onOpenChange(false)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create orders')
      }
    } catch (error) {
      toast.error('Failed to create orders')
    } finally {
      setCreating(false)
    }
  }

  const toggleSupplier = (key: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const totalOrderAmount = preview?.orders.reduce((sum, o) => sum + o.subtotal, 0) || 0
  const totalItemCount = preview?.orders.reduce((sum, o) => sum + o.itemCount, 0) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            Create Purchase Orders from {invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : !preview ? (
            <div className="text-center py-12 text-gray-500">
              Failed to load preview
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Invoice Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Invoice Total</span>
                  <span className="font-medium">{formatCurrency(preview.invoice.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Amount Paid</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(preview.invoice.totalPaid)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {preview.invoice.isPaid ? (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fully Paid
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {preview.invoice.paymentPercent}% Paid
                    </Badge>
                  )}
                </div>
              </div>

              {/* Orders to Create */}
              {preview.orders.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    {preview.orders.length} Purchase Order{preview.orders.length > 1 ? 's' : ''} to Create
                  </h3>

                  {preview.orders.map((order, index) => {
                    const key = `supplier-${index}`
                    const isExpanded = expandedSuppliers.has(key)

                    return (
                      <div key={key} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleSupplier(key)}
                          className="w-full p-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <Building2 className="w-5 h-5 text-gray-500" />
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{order.supplierName}</p>
                              {order.supplierEmail && (
                                <p className="text-xs text-gray-500">{order.supplierEmail}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">{order.itemCount} items</Badge>
                            <span className="font-medium text-gray-900">{formatCurrency(order.subtotal)}</span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-gray-50 p-3">
                            <div className="space-y-2">
                              {order.items.map(item => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-2 bg-white rounded border"
                                >
                                  <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <div>
                                      <p className="text-sm font-medium">{item.name}</p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>Qty: {item.quantity}</span>
                                        {item.leadTimeWeeks && (
                                          <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {item.leadTimeWeeks} weeks
                                            </span>
                                          </>
                                        )}
                                        {item.hasAcceptedQuote && (
                                          <>
                                            <span>•</span>
                                            <span className="text-emerald-600 flex items-center gap-1">
                                              <CheckCircle className="w-3 h-3" />
                                              Accepted
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium">{formatCurrency(item.totalPrice)}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} each</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No items to order</p>
                </div>
              )}

              {/* Items without supplier quotes */}
              {preview.itemsWithoutSupplier.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {preview.itemsWithoutSupplier.length} item{preview.itemsWithoutSupplier.length > 1 ? 's' : ''} without supplier quotes
                      </p>
                      <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                        {preview.itemsWithoutSupplier.slice(0, 5).map(item => (
                          <li key={item.id}>• {item.name}</li>
                        ))}
                        {preview.itemsWithoutSupplier.length > 5 && (
                          <li>• ... and {preview.itemsWithoutSupplier.length - 5} more</li>
                        )}
                      </ul>
                      <p className="mt-2 text-xs text-amber-600">
                        These items need supplier quotes before they can be ordered.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Already ordered items */}
              {preview.alreadyOrderedItems.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        {preview.alreadyOrderedItems.length} item{preview.alreadyOrderedItems.length > 1 ? 's' : ''} already have orders
                      </p>
                      <ul className="mt-1 text-xs text-blue-700 space-y-0.5">
                        {preview.alreadyOrderedItems.slice(0, 5).map(item => (
                          <li key={item.id}>
                            • {item.name} → {item.existingOrder}
                          </li>
                        ))}
                        {preview.alreadyOrderedItems.length > 5 && (
                          <li>• ... and {preview.alreadyOrderedItems.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Details - Shipping Address & Notes */}
              {preview.orders.length > 0 && (
                <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Order Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-blue-700">Ship To Address</Label>
                      <Textarea
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Enter shipping address for all orders..."
                        rows={3}
                        className="mt-1 bg-white"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        This address will be used for all purchase orders
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-blue-700">Order Notes (optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes visible on PO..."
                        rows={2}
                        className="mt-1 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {preview.orders.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-emerald-800">
                        Total: {totalItemCount} items across {preview.orders.length} order{preview.orders.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-emerald-600">
                        Combined supplier cost: {formatCurrency(totalOrderAmount)}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateOrders}
            disabled={creating || loading || !preview?.canCreateOrders}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4 mr-2" />
            )}
            Create {preview?.orders.length || 0} Purchase Order{(preview?.orders.length || 0) > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
