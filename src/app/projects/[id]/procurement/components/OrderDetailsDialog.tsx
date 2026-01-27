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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  FileText,
  Edit,
  Trash2,
  Loader2,
  ExternalLink,
  Clock,
  CheckCircle,
  User,
  Mail,
  Phone,
  MapPin,
  Send,
  FileDown,
  CreditCard,
  Receipt,
  Wallet,
  Banknote
} from 'lucide-react'
import { toast } from 'sonner'
import SendPODialog from '@/components/procurement/SendPODialog'

interface OrderItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: string
  totalPrice: string
  isComponent: boolean
  parentItemId: string | null
  status: string
  roomFFEItem: {
    id: string
    name: string
    description: string
    images: string[]
    modelNumber: string
  } | null
}

interface ExtraCharge {
  label: string
  amount: number
}

interface Order {
  id: string
  orderNumber: string
  status: string
  vendorName: string | null
  vendorEmail: string | null
  subtotal: string | null
  taxAmount: string | null
  shippingCost: string | null
  extraCharges: ExtraCharge[] | null
  totalAmount: string | null
  currency: string
  orderedAt: string | null
  confirmedAt: string | null
  expectedDelivery: string | null
  actualDelivery: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shippingCarrier: string | null
  shippingAddress: string | null
  supplierPaidAt: string | null
  supplierPaymentMethod: string | null
  supplierPaymentAmount: string | null
  depositRequired: string | null
  depositPaid: string | null
  balanceDue: string | null
  notes: string | null
  internalNotes: string | null
  createdAt: string
  project: {
    id: string
    name: string
    client: {
      id: string
      name: string
      email: string
    } | null
  }
  supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
    contactName: string | null
    address: string | null
  } | null
  createdBy: {
    id: string
    name: string
  }
  items: OrderItem[]
  activities: {
    id: string
    type: string
    message: string
    createdAt: string
    user: { name: string } | null
  }[]
}

interface OrderDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  onUpdate: () => void
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-600' },
  PAYMENT_RECEIVED: { label: 'Payment Received', color: 'bg-blue-50 text-blue-700' },
  DEPOSIT_PAID: { label: 'Deposit Paid', color: 'bg-indigo-50 text-indigo-700' },
  PAID_TO_SUPPLIER: { label: 'Paid to Supplier', color: 'bg-purple-50 text-purple-700' },
  ORDERED: { label: 'Ordered', color: 'bg-purple-50 text-purple-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700' },
  IN_PRODUCTION: { label: 'In Production', color: 'bg-amber-50 text-amber-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-50 text-cyan-700' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-sky-50 text-sky-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700' },
  INSTALLED: { label: 'Installed', color: 'bg-green-50 text-green-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-700' }
}

export default function OrderDetailsDialog({
  open,
  onOpenChange,
  orderId,
  onUpdate
}: OrderDetailsDialogProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSendPO, setShowSendPO] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'DEPOSIT' as 'DEPOSIT' | 'BALANCE' | 'FULL',
    amount: '',
    method: 'CREDIT_CARD',
    reference: '',
    notes: ''
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    notes: '',
    internalNotes: '',
    shippingAddress: '',
    expectedDelivery: ''
  })

  useEffect(() => {
    if (open && orderId) {
      fetchOrder()
    }
  }, [open, orderId])

  useEffect(() => {
    if (order) {
      setEditForm({
        notes: order.notes || '',
        internalNotes: order.internalNotes || '',
        shippingAddress: order.shippingAddress || '',
        expectedDelivery: order.expectedDelivery?.split('T')[0] || ''
      })
    }
  }, [order])

  const fetchOrder = async () => {
    if (!orderId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      } else {
        toast.error('Failed to load order')
        onOpenChange(false)
      }
    } catch (error) {
      toast.error('Failed to load order')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order) return

    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editForm.notes || null,
          internalNotes: editForm.internalNotes || null,
          shippingAddress: editForm.shippingAddress || null,
          expectedDelivery: editForm.expectedDelivery || null
        })
      })

      if (res.ok) {
        toast.success('Order updated')
        setEditing(false)
        fetchOrder()
        onUpdate()
      } else {
        toast.error('Failed to update order')
      }
    } catch (error) {
      toast.error('Failed to update order')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!order) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Order deleted')
        onOpenChange(false)
        onUpdate()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete order')
      }
    } catch (error) {
      toast.error('Failed to delete order')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!order) return

    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/pdf`)
      if (!res.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PO-${order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF downloaded')
    } catch (err) {
      toast.error('Failed to download PDF')
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!order) return

    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setPaymentSaving(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/supplier-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentType: paymentForm.paymentType,
          method: paymentForm.method,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null
        })
      })

      if (res.ok) {
        toast.success('Payment recorded')
        setShowPaymentForm(false)
        setPaymentForm({
          paymentType: 'DEPOSIT',
          amount: '',
          method: 'CREDIT_CARD',
          reference: '',
          notes: ''
        })
        fetchOrder()
        onUpdate()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      toast.error('Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  const formatCurrency = (amount: string | null, currency: string = 'CAD') => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(parseFloat(amount))
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateStr))
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(dateStr))
  }

  if (!order && loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!order) return null

  const status = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' }
  const canDelete = order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_RECEIVED'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-600" />
                  {order.orderNumber}
                  <Badge className={status.color}>{status.label}</Badge>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {order.supplier?.name || order.vendorName} • {order.project.name}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Download PDF */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                >
                  {downloadingPDF ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-1" />
                  )}
                  PDF
                </Button>
                {/* Send PO - show if not already ordered */}
                {order.status !== 'ORDERED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && (
                  <Button
                    size="sm"
                    onClick={() => setShowSendPO(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Send PO
                  </Button>
                )}
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">Items ({order.items.length})</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* Project & Client Info - matches Create PO */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Project</p>
                      <p className="font-semibold text-gray-900">{order.project.name}</p>
                    </div>
                    {order.project.client && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Client</p>
                        <p className="font-medium text-gray-900">{order.project.client.name}</p>
                      </div>
                    )}
                  </div>
                  {order.shippingAddress && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Ship To</p>
                      <p className="text-sm text-gray-700">{order.shippingAddress}</p>
                    </div>
                  )}
                </div>

                {/* Supplier Info - matches Create PO */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Supplier</p>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">{order.supplier?.name || order.vendorName}</p>
                      {(order.supplier?.email || order.vendorEmail) && (
                        <p className="text-sm text-blue-700">{order.supplier?.email || order.vendorEmail}</p>
                      )}
                      {order.supplier?.phone && (
                        <p className="text-sm text-blue-700">{order.supplier.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pricing
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{formatCurrency(order.subtotal, order.currency)}</span>
                      </div>
                      {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Shipping</span>
                          <span>{formatCurrency(order.shippingCost, order.currency)}</span>
                        </div>
                      )}
                      {order.extraCharges && order.extraCharges.length > 0 && order.extraCharges.map((charge, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-gray-500">{charge.label}</span>
                          <span>{formatCurrency(String(charge.amount), order.currency)}</span>
                        </div>
                      ))}
                      {order.taxAmount && parseFloat(order.taxAmount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tax</span>
                          <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {order.depositRequired && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Deposit Required</span>
                          <span>{formatCurrency(order.depositRequired, order.currency)}</span>
                        </div>
                      )}
                      {order.depositPaid && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Deposit Paid</span>
                          <span className="text-green-600">{formatCurrency(order.depositPaid, order.currency)}</span>
                        </div>
                      )}
                      {order.balanceDue && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Balance Due</span>
                          <span>{formatCurrency(order.balanceDue, order.currency)}</span>
                        </div>
                      )}
                      {order.supplierPaidAt && (
                        <div className="flex justify-between text-green-600">
                          <span>Paid to Supplier</span>
                          <span>{formatCurrency(order.supplierPaymentAmount, order.currency)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dates & Shipping */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Dates & Shipping
                  </h3>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Expected Delivery</Label>
                        <Input
                          type="date"
                          value={editForm.expectedDelivery}
                          onChange={e => setEditForm(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Shipping Address</Label>
                        <Textarea
                          value={editForm.shippingAddress}
                          onChange={e => setEditForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Created</span>
                          <span>{formatDateTime(order.createdAt)}</span>
                        </div>
                        {order.orderedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ordered</span>
                            <span>{formatDateTime(order.orderedAt)}</span>
                          </div>
                        )}
                        {order.expectedDelivery && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Expected Delivery</span>
                            <span>{formatDate(order.expectedDelivery)}</span>
                          </div>
                        )}
                        {order.actualDelivery && (
                          <div className="flex justify-between text-green-600">
                            <span>Delivered</span>
                            <span>{formatDate(order.actualDelivery)}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {order.trackingNumber && (
                          <div>
                            <span className="text-gray-500">Tracking</span>
                            <p className="font-medium">
                              {order.shippingCarrier && `${order.shippingCarrier}: `}
                              {order.trackingUrl ? (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                  {order.trackingNumber}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                order.trackingNumber
                              )}
                            </p>
                          </div>
                        )}
                        {order.shippingAddress && (
                          <div>
                            <span className="text-gray-500">Ship To</span>
                            <p className="text-gray-700 whitespace-pre-line">{order.shippingAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notes
                  </h3>
                  {editing ? (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Order Notes (visible on PO)</Label>
                        <Textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Internal Notes (private)</Label>
                        <Textarea
                          value={editForm.internalNotes}
                          onChange={e => setEditForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {order.notes ? (
                        <div>
                          <span className="text-gray-500">Order Notes</span>
                          <p className="text-gray-700 whitespace-pre-line">{order.notes}</p>
                        </div>
                      ) : null}
                      {order.internalNotes ? (
                        <div>
                          <span className="text-gray-500">Internal Notes</span>
                          <p className="text-gray-700 whitespace-pre-line">{order.internalNotes}</p>
                        </div>
                      ) : null}
                      {!order.notes && !order.internalNotes && (
                        <p className="text-gray-400 italic">No notes</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-2">
                {/* Show all items as flat list - matches Create PO dialog */}
                {order.items.map(item => {
                  // Use imageUrl from OrderItem, fallback to roomFFEItem.images
                  const imageUrl = item.imageUrl || item.roomFFEItem?.images?.[0]

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {item.roomName && (
                              <>
                                <span>{item.roomName}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>Qty: {item.quantity}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(item.totalPrice, order.currency)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(item.unitPrice, order.currency)} × {item.quantity}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Totals section - matches Create PO dialog */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-emerald-700">Items Subtotal ({order.items.length})</p>
                    <p className="font-medium text-emerald-800">
                      {formatCurrency(order.subtotal, order.currency)}
                    </p>
                  </div>
                  {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-emerald-700">Shipping</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(order.shippingCost, order.currency)}
                      </p>
                    </div>
                  )}
                  {order.extraCharges && order.extraCharges.length > 0 && order.extraCharges.map((charge, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <p className="text-sm text-emerald-700">{charge.label}</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(String(charge.amount), order.currency)}
                      </p>
                    </div>
                  ))}
                  {order.taxAmount && parseFloat(order.taxAmount) > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-emerald-700">Tax</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(order.taxAmount, order.currency)}
                      </p>
                    </div>
                  )}
                  {order.depositRequired && parseFloat(order.depositRequired) > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                      <p className="text-sm text-emerald-700">Deposit Required</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(order.depositRequired, order.currency)}
                      </p>
                    </div>
                  )}
                  {order.balanceDue && parseFloat(order.balanceDue) > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-emerald-700">Balance Due</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(order.balanceDue, order.currency)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                    <p className="font-semibold text-emerald-800">Total</p>
                    <p className="text-xl font-bold text-emerald-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4">
                {/* Payment Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Order Total</h4>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-4 ${
                    order.supplierPaidAt
                      ? 'bg-green-50'
                      : order.depositPaid && parseFloat(order.depositPaid) > 0
                        ? 'bg-yellow-50'
                        : 'bg-gray-50'
                  }`}>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Status</h4>
                    <Badge className={
                      order.supplierPaidAt
                        ? 'bg-green-100 text-green-700'
                        : order.depositPaid && parseFloat(order.depositPaid) > 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }>
                      {order.supplierPaidAt
                        ? 'Paid to Supplier'
                        : order.depositPaid && parseFloat(order.depositPaid) > 0
                          ? 'Deposit Paid'
                          : 'Not Paid'
                      }
                    </Badge>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Supplier Payment Tracking
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Amount</span>
                        <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
                      </div>
                      {order.depositRequired && parseFloat(order.depositRequired) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Deposit Required</span>
                          <span>{formatCurrency(order.depositRequired, order.currency)}</span>
                        </div>
                      )}
                      {order.depositPaid && parseFloat(order.depositPaid) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Deposit Paid</span>
                          <span>{formatCurrency(order.depositPaid, order.currency)}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {order.supplierPaymentAmount && (
                        <div className="flex justify-between text-green-600">
                          <span>Total Paid to Supplier</span>
                          <span className="font-medium">{formatCurrency(order.supplierPaymentAmount, order.currency)}</span>
                        </div>
                      )}
                      {order.balanceDue && parseFloat(order.balanceDue) > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Balance Due</span>
                          <span>{formatCurrency(order.balanceDue, order.currency)}</span>
                        </div>
                      )}
                      {order.supplierPaymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Payment Method</span>
                          <span>{order.supplierPaymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Record Payment Form */}
                {!showPaymentForm ? (
                  <Button onClick={() => setShowPaymentForm(true)} className="w-full">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Record Payment to Supplier
                  </Button>
                ) : (
                  <div className="bg-emerald-50 rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-emerald-900">Record Supplier Payment</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Payment Type</Label>
                        <select
                          value={paymentForm.paymentType}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            paymentType: e.target.value as 'DEPOSIT' | 'BALANCE' | 'FULL'
                          }))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="DEPOSIT">Deposit Payment</option>
                          <option value="BALANCE">Balance Payment</option>
                          <option value="FULL">Full Payment</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Amount ({order.currency})</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Payment Method</Label>
                        <select
                          value={paymentForm.method}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="CREDIT_CARD">Credit Card</option>
                          <option value="WIRE_TRANSFER">Wire Transfer</option>
                          <option value="CHECK">Check</option>
                          <option value="ETRANSFER">E-Transfer</option>
                          <option value="CASH">Cash</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Reference #</Label>
                        <Input
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                          placeholder="Confirmation number"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                        placeholder="Optional notes about this payment"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowPaymentForm(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRecordPayment} disabled={paymentSaving}>
                        {paymentSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Record Payment
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-3">
                {order.activities.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No activity yet</p>
                ) : (
                  order.activities.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900">{activity.message}</p>
                        <p className="text-gray-500 text-xs">
                          {activity.user?.name || 'System'} • {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>

          {editing && (
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {order.orderNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send PO Dialog */}
      <SendPODialog
        open={showSendPO}
        onOpenChange={setShowSendPO}
        order={{
          id: order.id,
          orderNumber: order.orderNumber,
          vendorName: order.supplier?.name || order.vendorName || 'Supplier',
          vendorEmail: order.supplier?.email || order.vendorEmail || undefined,
          totalAmount: parseFloat(order.totalAmount || '0'),
          subtotal: parseFloat(order.subtotal || '0'),
          shippingCost: parseFloat(order.shippingCost || '0'),
          taxAmount: parseFloat(order.taxAmount || '0'),
          currency: order.currency,
          shippingAddress: order.shippingAddress || undefined,
          expectedDelivery: order.expectedDelivery || undefined,
          items: order.items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description || undefined,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice),
            totalPrice: parseFloat(item.totalPrice)
          }))
        }}
        onSuccess={() => {
          setShowSendPO(false)
          fetchOrder()
          onUpdate()
        }}
      />
    </>
  )
}
