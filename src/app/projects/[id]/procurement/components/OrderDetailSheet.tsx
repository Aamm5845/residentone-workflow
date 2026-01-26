'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Send,
  DollarSign,
  Copy,
  ExternalLink,
  Download,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Building2,
  Mail,
  Phone,
  MapPin,
  Truck,
  Calendar,
  CreditCard,
  Edit,
  Save,
  X,
  TestTube
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import SendPODialog from '@/components/procurement/SendPODialog'

interface OrderItem {
  id: string
  name: string
  description: string | null
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

interface Order {
  id: string
  orderNumber: string
  status: string
  vendorName: string | null
  vendorEmail: string | null
  subtotal: string | null
  taxAmount: string | null
  shippingCost: string | null
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

interface OrderDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string | null
  onUpdate: () => void
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-600', icon: Clock },
  PAYMENT_RECEIVED: { label: 'Payment Received', color: 'bg-blue-50 text-blue-700', icon: DollarSign },
  DEPOSIT_PAID: { label: 'Deposit Paid', color: 'bg-indigo-50 text-indigo-700', icon: CreditCard },
  PAID_TO_SUPPLIER: { label: 'Paid to Supplier', color: 'bg-purple-50 text-purple-700', icon: CheckCircle },
  ORDERED: { label: 'Ordered', color: 'bg-purple-50 text-purple-700', icon: Send },
  CONFIRMED: { label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700', icon: CheckCircle },
  IN_PRODUCTION: { label: 'In Production', color: 'bg-amber-50 text-amber-700', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-50 text-cyan-700', icon: Truck },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-sky-50 text-sky-700', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  INSTALLED: { label: 'Installed', color: 'bg-green-50 text-green-700', icon: CheckCircle },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-700', icon: AlertCircle }
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
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const [editForm, setEditForm] = useState({
    shippingAddress: '',
    expectedDelivery: '',
    notes: '',
    internalNotes: ''
  })

  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'DEPOSIT' as 'DEPOSIT' | 'BALANCE' | 'FULL',
    amount: '',
    method: 'CREDIT_CARD',
    reference: '',
    notes: ''
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
      a.download = `${order.orderNumber}.pdf`
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

  const handleSendTestEmail = async () => {
    if (!order || !testEmail) {
      toast.error('Please enter an email address')
      return
    }

    setSendingTestEmail(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierEmail: testEmail,
          isTest: true
        })
      })

      if (res.ok) {
        toast.success(`Test email sent to ${testEmail}`)
        setTestEmail('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send test email')
      }
    } catch (error) {
      toast.error('Failed to send test email')
    } finally {
      setSendingTestEmail(false)
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

  const handleCopyPortalLink = () => {
    if (!order?.supplierAccessToken) {
      toast.error('Portal link not available')
      return
    }
    const link = `${window.location.origin}/supplier-order/${order.accessToken}`
    navigator.clipboard.writeText(link)
    toast.success('Supplier portal link copied')
  }

  const handleOpenPortal = () => {
    if (!order?.supplierAccessToken) {
      toast.error('Portal link not available')
      return
    }
    window.open(`/supplier-order/${order.accessToken}`, '_blank')
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
    return format(new Date(dateStr), 'MMM d, yyyy')
  }

  if (!order && loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col">
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!order) return null

  const status = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600', icon: Package }
  const StatusIcon = status.icon

  // Calculate payment status
  const totalAmount = parseFloat(order.totalAmount || '0')
  const depositRequired = parseFloat(order.depositRequired || '0')
  const depositPaid = parseFloat(order.depositPaid || '0')
  const supplierPaid = parseFloat(order.supplierPaymentAmount || '0')
  const balanceDue = totalAmount - supplierPaid

  // Group items - main items and components
  const mainItems = order.items.filter(i => !i.isComponent)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="flex-shrink-0 p-6 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-lg">{order.orderNumber}</SheetTitle>
                <p className="text-sm text-gray-500">
                  {order.supplier?.name || order.vendorName}
                </p>
              </div>
              <Badge className={`${status.color} gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </Badge>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 pb-6">
              {/* Supplier Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Supplier</p>
                  <p className="font-medium">{order.supplier?.name || order.vendorName}</p>
                  {order.supplier?.contactName && (
                    <p className="text-sm text-gray-500">{order.supplier.contactName}</p>
                  )}
                  {(order.supplier?.email || order.vendorEmail) && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {order.supplier?.email || order.vendorEmail}
                    </p>
                  )}
                  {order.supplier?.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {order.supplier.phone}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Project</p>
                  <p className="font-medium">{order.project.name}</p>
                  {order.project.client && (
                    <p className="text-sm text-gray-500">{order.project.client.name}</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Created</p>
                  <p className="text-sm">{formatDate(order.createdAt)}</p>
                </div>
                {order.orderedAt && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Ordered</p>
                    <p className="text-sm">{formatDate(order.orderedAt)}</p>
                  </div>
                )}
                {editing ? (
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">Expected Delivery</Label>
                    <Input
                      type="date"
                      value={editForm.expectedDelivery}
                      onChange={e => setEditForm(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                ) : order.expectedDelivery && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Expected Delivery</p>
                    <p className="text-sm">{formatDate(order.expectedDelivery)}</p>
                  </div>
                )}
                {order.actualDelivery && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Delivered</p>
                    <p className="text-sm text-emerald-600">{formatDate(order.actualDelivery)}</p>
                  </div>
                )}
              </div>

              {/* Shipping Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Ship To</p>
                  {!editing && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(true)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {editing ? (
                  <Textarea
                    value={editForm.shippingAddress}
                    onChange={e => setEditForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                    rows={3}
                    placeholder="Enter shipping address..."
                  />
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {order.shippingAddress || <span className="text-gray-400 italic">No shipping address</span>}
                  </p>
                )}
              </div>

              {/* Tracking Info */}
              {order.trackingNumber && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Tracking</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{order.shippingCarrier && `${order.shippingCarrier}: `}</span>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {order.trackingNumber}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-sm">{order.trackingNumber}</span>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Items */}
              <div>
                <h4 className="font-medium mb-3">Items ({order.items.length})</h4>
                <div className="space-y-2">
                  {mainItems.map((item) => {
                    const components = order.items.filter(i => i.isComponent && i.parentItemId === item.roomFFEItem?.id)
                    return (
                      <div key={item.id}>
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                          {item.roomFFEItem?.images?.[0] ? (
                            <img
                              src={item.roomFFEItem.images[0]}
                              alt=""
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.name}</p>
                            {item.roomFFEItem?.modelNumber && (
                              <p className="text-xs text-gray-500">{item.roomFFEItem.modelNumber}</p>
                            )}
                            <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-medium text-sm">{formatCurrency(item.totalPrice, order.currency)}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(item.unitPrice, order.currency)} ea
                            </p>
                          </div>
                        </div>
                        {/* Components */}
                        {components.length > 0 && (
                          <div className="ml-4 mt-1 space-y-1">
                            {components.map(comp => (
                              <div key={comp.id} className="flex items-center justify-between p-2 rounded bg-blue-50/50 text-sm">
                                <span className="text-gray-600">
                                  <span className="text-blue-400 mr-1">└</span>
                                  {comp.name}
                                  {comp.quantity > 1 && <span className="text-gray-400 ml-1">×{comp.quantity}</span>}
                                </span>
                                <span className="text-gray-700">{formatCurrency(comp.totalPrice, order.currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span>{formatCurrency(order.shippingCost, order.currency)}</span>
                  </div>
                )}
                {order.taxAmount && parseFloat(order.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total</span>
                  <span className="text-lg">{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
              </div>

              <Separator />

              {/* Supplier Payment Tracking */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Supplier Payment
                </h4>
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  {depositRequired > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Deposit Required</span>
                        <span>{formatCurrency(order.depositRequired, order.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Deposit Paid</span>
                        <span className={depositPaid > 0 ? 'text-emerald-600' : ''}>
                          {formatCurrency(order.depositPaid, order.currency)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Paid to Supplier</span>
                    <span className={supplierPaid > 0 ? 'text-emerald-600 font-medium' : ''}>
                      {formatCurrency(order.supplierPaymentAmount, order.currency)}
                    </span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between text-sm font-medium pt-2 border-t">
                      <span className="text-amber-600">Balance Due</span>
                      <span className="text-amber-600">{formatCurrency(String(balanceDue), order.currency)}</span>
                    </div>
                  )}
                  {supplierPaid >= totalAmount && totalAmount > 0 && (
                    <div className="flex items-center gap-2 pt-2 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Fully Paid</span>
                    </div>
                  )}
                </div>

                {/* Record Payment Form */}
                {!showPaymentForm ? (
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => setShowPaymentForm(true)}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                ) : (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-emerald-900">Record Payment</h5>
                      <Button variant="ghost" size="sm" onClick={() => setShowPaymentForm(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Payment Type</Label>
                        <select
                          value={paymentForm.paymentType}
                          onChange={(e) => setPaymentForm(prev => ({
                            ...prev,
                            paymentType: e.target.value as 'DEPOSIT' | 'BALANCE' | 'FULL'
                          }))}
                          className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="DEPOSIT">Deposit</option>
                          <option value="BALANCE">Balance</option>
                          <option value="FULL">Full Payment</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Amount ({order.currency})</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0.00"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Method</Label>
                        <select
                          value={paymentForm.method}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                          className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="CREDIT_CARD">Credit Card</option>
                          <option value="WIRE_TRANSFER">Wire Transfer</option>
                          <option value="CHECK">Check</option>
                          <option value="ETRANSFER">E-Transfer</option>
                          <option value="CASH">Cash</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Reference #</Label>
                        <Input
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                          placeholder="Optional"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleRecordPayment}
                      disabled={paymentSaving}
                    >
                      {paymentSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Record Payment
                    </Button>
                  </div>
                )}
              </div>

              {/* Notes */}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">Order Notes</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      placeholder="Notes visible on PO..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wider">Internal Notes</Label>
                    <Textarea
                      value={editForm.internalNotes}
                      onChange={e => setEditForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                      rows={2}
                      placeholder="Private notes..."
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (order.notes || order.internalNotes) && (
                <div className="space-y-2">
                  {order.notes && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                    </div>
                  )}
                  {order.internalNotes && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Internal Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{order.internalNotes}</p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Test Email */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TestTube className="w-4 h-4" />
                  Test Email
                </h4>
                <p className="text-xs text-gray-500 mb-2">
                  Send a test PO email to preview what the supplier will receive
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !testEmail}
                  >
                    {sendingTestEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {order.accessToken && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCopyPortalLink}>
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copy Portal Link
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleOpenPortal}>
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      Supplier Portal
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloadingPDF}>
                  {downloadingPDF ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1.5" />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          </ScrollArea>

          {/* Footer Actions */}
          <div className="flex-shrink-0 p-4 border-t bg-white">
            {editing ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowSendPO(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send PO to Supplier
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
