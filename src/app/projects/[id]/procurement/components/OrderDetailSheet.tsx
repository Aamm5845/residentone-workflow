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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Loader2,
  Send,
  Package,
  ShoppingCart,
  Building2,
  CreditCard,
  Truck,
  FileDown,
  FileText,
  Clock,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Download
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

interface SavedPaymentMethod {
  id: string
  type: string
  nickname: string | null
  lastFour: string | null
  cardBrand: string | null
}

interface OrderDocument {
  id: string
  type: string
  title: string
  description: string | null
  fileName: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
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
  depositPercent: string | null
  balanceDue: string | null
  notes: string | null
  internalNotes: string | null
  createdAt: string
  supplierAccessToken?: string
  supplierConfirmedAt?: string | null
  supplierConfirmedBy?: string | null
  savedPaymentMethodId?: string | null
  savedPaymentMethod?: SavedPaymentMethod | null
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
  documents: OrderDocument[]
  activities: {
    id: string
    type: string
    message: string
    createdAt: string
    user: { name: string } | null
  }[]
}

interface OrderDetailSheetProps {
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

export default function OrderDetailSheet({
  open,
  onOpenChange,
  orderId,
  onUpdate
}: OrderDetailSheetProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSendPO, setShowSendPO] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CHECK',
    reference: '',
    notes: '',
    paidAt: new Date().toISOString().split('T')[0]
  })

  const [editForm, setEditForm] = useState({
    shippingAddress: '',
    expectedDelivery: '',
    notes: '',
    internalNotes: ''
  })

  useEffect(() => {
    if (open && orderId) {
      fetchOrder()
    }
  }, [open, orderId])

  useEffect(() => {
    if (order) {
      setEditForm({
        shippingAddress: order.shippingAddress || '',
        expectedDelivery: order.expectedDelivery?.split('T')[0] || '',
        notes: order.notes || '',
        internalNotes: order.internalNotes || ''
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
          shippingAddress: editForm.shippingAddress || null,
          expectedDelivery: editForm.expectedDelivery || null,
          notes: editForm.notes || null,
          internalNotes: editForm.internalNotes || null
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

  const handleRecordPayment = async () => {
    if (!order) return

    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    setRecordingPayment(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierPaidAt: paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : new Date().toISOString(),
          supplierPaymentMethod: paymentForm.method,
          supplierPaymentAmount: amount,
          supplierPaymentRef: paymentForm.reference || null,
          supplierPaymentNotes: paymentForm.notes || null
        })
      })

      if (res.ok) {
        toast.success('Payment recorded successfully')
        setShowPaymentDialog(false)
        setPaymentForm({
          amount: '',
          method: 'CHECK',
          reference: '',
          notes: '',
          paidAt: new Date().toISOString().split('T')[0]
        })
        await fetchOrder()
        onUpdate()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      toast.error('Failed to record payment')
    } finally {
      setRecordingPayment(false)
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
      if (!res.ok) throw new Error('Failed to generate PDF')

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

  const handleCopyPortalLink = () => {
    if (!order?.supplierAccessToken) {
      toast.error('Portal link not available')
      return
    }
    const link = `${window.location.origin}/supplier-order/${order.supplierAccessToken}`
    navigator.clipboard.writeText(link)
    toast.success('Supplier portal link copied')
  }

  const handleOpenTestEmailDialog = () => {
    // Pre-fill with supplier email if available
    const defaultEmail = order?.supplier?.email || order?.vendorEmail || ''
    setTestEmailAddress(defaultEmail)
    setShowTestEmailDialog(true)
  }

  const handleSendTestEmail = async () => {
    if (!order) return

    if (!testEmailAddress.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setSendingTestEmail(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierEmail: testEmailAddress.trim(),
          isTest: true
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send test email')
      }

      await res.json()
      toast.success(`Test email sent to ${testEmailAddress}`)
      setShowTestEmailDialog(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email')
    } finally {
      setSendingTestEmail(false)
    }
  }

  const formatCurrency = (amount: string | number | null, currency: string = 'CAD') => {
    if (amount === null || amount === undefined) return '-'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(num)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateStr))
  }

  if (!order && loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Loading Order Details</DialogTitle>
            <DialogDescription>Please wait while the order details are being loaded.</DialogDescription>
          </DialogHeader>
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

  // Calculate values
  const totalAmount = parseFloat(order.totalAmount || '0')
  const depositRequired = parseFloat(order.depositRequired || '0')
  const depositPercent = parseFloat(order.depositPercent || '0')
  const depositPaid = parseFloat(order.depositPaid || '0')
  const supplierPaid = parseFloat(order.supplierPaymentAmount || '0')
  const balanceDue = totalAmount - depositRequired

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              {order.orderNumber}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge className={status.color}>{status.label}</Badge>
              <span>Created {formatDate(order.createdAt)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <div className="space-y-6 py-4">
              {/* Project & Client Info */}
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
                    <p className="text-sm text-gray-700 whitespace-pre-line">{order.shippingAddress}</p>
                  </div>
                )}
              </div>

              {/* Supplier Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Supplier</p>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">{order.supplier?.name || order.vendorName}</p>
                    {(order.supplier?.email || order.vendorEmail) && (
                      <p className="text-sm text-blue-700 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {order.supplier?.email || order.vendorEmail}
                      </p>
                    )}
                    {order.supplier?.phone && (
                      <p className="text-sm text-blue-700 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {order.supplier.phone}
                      </p>
                    )}
                  </div>
                </div>
                {/* Supplier Confirmation Info */}
                {order.supplierConfirmedAt && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Supplier Confirmed</p>
                    <div className="text-sm">
                      <p className="text-blue-900">
                        <span className="font-medium">{order.supplierConfirmedBy || 'Supplier'}</span>
                        {' confirmed on '}
                        {formatDate(order.supplierConfirmedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Dates & Delivery
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  {order.orderedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ordered</span>
                      <span>{formatDate(order.orderedAt)}</span>
                    </div>
                  )}
                  {order.expectedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expected</span>
                      <span>{formatDate(order.expectedDelivery)}</span>
                    </div>
                  )}
                  {order.actualDelivery && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Delivered</span>
                      <span>{formatDate(order.actualDelivery)}</span>
                    </div>
                  )}
                </div>
                {order.trackingNumber && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Tracking:</span>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {order.trackingNumber}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>{order.trackingNumber}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Items ({order.items.length})
                </h3>
                <div className="space-y-2">
                  {order.items.map((item) => {
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
                            <p className="font-medium text-gray-900">
                              {item.name}
                              {item.isComponent && (
                                <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  Component
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {item.roomName && (
                                <>
                                  <span>{item.roomName}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Qty: {item.quantity}</span>
                              {item.roomFFEItem?.modelNumber && (
                                <>
                                  <span>•</span>
                                  <span>{item.roomFFEItem.modelNumber}</span>
                                </>
                              )}
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
                </div>
              </div>

              {/* Shipping Address (editable) */}
              {editing ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-500" />
                    Ship To Address
                  </Label>
                  <Textarea
                    value={editForm.shippingAddress}
                    onChange={(e) => setEditForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                    placeholder="Enter shipping address..."
                    rows={3}
                  />
                </div>
              ) : null}

              {/* Payment Method */}
              {order.savedPaymentMethod && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    Payment Method for Supplier
                  </Label>
                  <div className="p-3 bg-white border rounded-lg flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.savedPaymentMethod.nickname ||
                          `${order.savedPaymentMethod.cardBrand} ****${order.savedPaymentMethod.lastFour}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.savedPaymentMethod.cardBrand} ending in {order.savedPaymentMethod.lastFour}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  Order Notes
                </Label>
                {editing ? (
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes visible on PO..."
                    rows={2}
                  />
                ) : order.notes ? (
                  <div className="p-3 bg-white border rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No notes</p>
                )}
              </div>

              {/* Documents */}
              {order.documents && order.documents.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Documents ({order.documents.length})
                  </Label>
                  <div className="space-y-2">
                    {order.documents.map((doc) => {
                      const isImage = doc.mimeType?.startsWith('image/') ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.fileName)

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-white border rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isImage ? (
                              <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                <img
                                  src={doc.fileUrl}
                                  alt={doc.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{doc.title}</p>
                              <p className="text-xs text-gray-500">{doc.type} • {doc.fileName}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Totals - matches CreatePODialog exactly */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
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
                      {formatCurrency(charge.amount, order.currency)}
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
                <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                  <p className="font-semibold text-emerald-800">Total</p>
                  <p className="text-xl font-bold text-emerald-900">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                </div>
                {depositRequired > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200 mt-2">
                      <p className="text-sm text-blue-700 font-medium">
                        Deposit Required ({depositPercent}%)
                      </p>
                      <p className="font-bold text-blue-700">
                        {formatCurrency(depositRequired, order.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">Balance Due</p>
                      <p className="font-medium text-gray-700">
                        {formatCurrency(balanceDue, order.currency)}
                      </p>
                    </div>
                  </>
                )}
                {/* Payment Status */}
                {(depositPaid > 0 || supplierPaid > 0) && (
                  <div className="pt-2 border-t border-emerald-200 mt-2 space-y-1">
                    {depositPaid > 0 && (
                      <div className="flex items-center justify-between text-green-600">
                        <span className="text-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Deposit Paid
                        </span>
                        <span className="font-medium">{formatCurrency(depositPaid, order.currency)}</span>
                      </div>
                    )}
                    {supplierPaid > 0 && (
                      <div className="flex items-center justify-between text-green-600">
                        <span className="text-sm flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Paid to Supplier
                        </span>
                        <span className="font-medium">{formatCurrency(supplierPaid, order.currency)}</span>
                      </div>
                    )}
                    {order.supplierPaidAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {order.supplierPaymentMethod && <span>{order.supplierPaymentMethod} • </span>}
                        {formatDate(order.supplierPaidAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* Record Payment Button */}
                {!order.supplierPaidAt && (
                  <div className="pt-2 border-t border-emerald-200 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setPaymentForm(prev => ({
                          ...prev,
                          amount: totalAmount.toString()
                        }))
                        setShowPaymentDialog(true)
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Record Payment to Supplier
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick Links */}
              {order.supplierAccessToken && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyPortalLink}>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy Portal Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/supplier-order/${order.supplierAccessToken}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Supplier Portal
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
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
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenTestEmailDialog}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Test Email
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowSendPO(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send PO
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment to Supplier</DialogTitle>
            <DialogDescription>
              Record when you've paid the supplier (check, wire, card, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount Paid *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECK">Check</SelectItem>
                  <SelectItem value="WIRE">Wire Transfer</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="CARD">Credit/Debit Card</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentForm.paidAt}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paidAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Check # / Reference (optional)</Label>
              <Input
                id="paymentReference"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Check number, wire reference, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (optional)</Label>
              <Textarea
                id="paymentNotes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordingPayment || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
            >
              {recordingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Email Dialog */}
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test PO email to preview how suppliers will receive it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testEmail">Email Address</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Enter email address"
              />
              <p className="text-xs text-gray-500">
                The test email will include the supplier portal link.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={!testEmailAddress.trim() || sendingTestEmail}
            >
              {sendingTestEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send PO Dialog */}
      {order && (
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
      )}
    </>
  )
}
