'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  FileText,
  Calendar,
  MapPin,
  Send,
  Upload,
  MessageSquare,
  ExternalLink,
  Download,
  Loader2,
  CreditCard,
  ImageIcon
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

interface OrderItem {
  id: string
  name: string
  description?: string
  quantity: number
  unitType?: string
  unitPrice: number
  totalPrice: number
  sku?: string
  brand?: string
  color?: string
  finish?: string
  material?: string
  dimensions?: string
  images?: string[]
  leadTime?: string
  status?: string
  supplierLink?: string
  notes?: string
}

interface Document {
  id: string
  type: string
  title: string
  description?: string
  fileName: string
  fileUrl: string
  createdAt: string
}

interface Message {
  id: string
  content: string
  direction: string
  senderType: string
  senderName?: string
  attachments?: any
  createdAt: string
  readAt?: string
}

interface OrderData {
  order: {
    id: string
    orderNumber: string
    quoteNumber?: string
    status: string
    createdAt: string
    orderedAt?: string
    confirmedAt?: string
    expectedDelivery?: string
    expectedShipDate?: string
    actualShipDate?: string
    actualDelivery?: string
    supplierConfirmedAt?: string
    supplierConfirmedBy?: string
    trackingNumber?: string
    trackingUrl?: string
    shippingCarrier?: string
    shippingMethod?: string
    shippingAddress?: string
    billingAddress?: string
    notes?: string
    subtotal: number
    taxAmount: number
    shippingCost: number
    extraCharges?: Array<{ label: string; amount: number }>
    totalAmount: number
    currency: string
    paymentCardBrand?: string
    paymentCardLastFour?: string
    paymentCardHolderName?: string
    paymentCardExpiry?: string
    paymentCardNumber?: string
    paymentCardCvv?: string
  }
  project: {
    id: string
    name: string
    address?: string
    clientName?: string
  }
  supplier: {
    id: string
    name: string
    email?: string
    phone?: string
    contactName?: string
  }
  items: OrderItem[]
  documents: Document[]
  messages: Message[]
  organization: {
    name: string
    logo?: string
    phone?: string
    email?: string
    address?: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PENDING_PAYMENT: { label: 'Pending', variant: 'outline' },
  ORDERED: { label: 'Awaiting Confirmation', variant: 'default' },
  CONFIRMED: { label: 'Confirmed', variant: 'default' },
  PROCESSING: { label: 'Processing', variant: 'default' },
  SHIPPED: { label: 'Shipped', variant: 'default' },
  DELIVERED: { label: 'Delivered', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' }
}

export default function SupplierOrderPortal() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showShipDialog, setShowShipDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  // Form State
  const [confirmName, setConfirmName] = useState('')
  const [confirmNotes, setConfirmNotes] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [carrier, setCarrier] = useState('')
  const [shipExpectedDelivery, setShipExpectedDelivery] = useState('')
  const [shipNotes, setShipNotes] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadType, setUploadType] = useState('OTHER')
  const [submitting, setSubmitting] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/supplier-order/${token}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load order')
      }
      const orderData = await res.json()
      setData(orderData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchOrder()
    }
  }, [token, fetchOrder])

  const handleAction = async (action: string, payload: any) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/supplier-order/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Action failed')
      }

      toast.success('Success!')
      await fetchOrder()

      setShowConfirmDialog(false)
      setShowShipDialog(false)
      setShowMessageDialog(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle || uploadFile.name)
      formData.append('description', uploadDescription)
      formData.append('type', uploadType)

      const res = await fetch(`/api/supplier-order/${token}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }

      toast.success('Document uploaded!')
      setShowUploadDialog(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDescription('')
      await fetchOrder()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Order</h1>
            <p className="text-gray-600">{error || 'Order not found or access denied'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { order, project, supplier, items, documents, messages, organization } = data
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT
  const isConfirmed = !!order.supplierConfirmedAt
  const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED'

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gray-900 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              {organization.logo ? (
                <img src={organization.logo} alt={organization.name} className="h-10 bg-white rounded px-2 py-1" />
              ) : (
                <span className="text-xl font-bold">{organization.name}</span>
              )}
              <div className="text-right text-sm text-gray-300">
                {organization.email && <div>{organization.email}</div>}
                {organization.phone && <div>{organization.phone}</div>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">Purchase Order #{order.orderNumber}</h1>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </div>
                <p className="text-gray-300">Project: {project.name}</p>
              </div>
              <div className="flex gap-2">
                {!isConfirmed && !isShipped && (
                  <Button onClick={() => setShowConfirmDialog(true)} variant="secondary">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Order
                  </Button>
                )}
                {isConfirmed && !isShipped && (
                  <Button onClick={() => setShowShipDialog(true)} variant="secondary">
                    <Truck className="w-4 h-4 mr-2" />
                    Mark Shipped
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Status Alerts */}
        {isConfirmed && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">Order Confirmed</p>
              <p className="text-sm text-emerald-600">
                Confirmed by {order.supplierConfirmedBy} on {formatDateTime(order.supplierConfirmedAt!)}
              </p>
            </div>
          </div>
        )}

        {order.trackingNumber && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Shipment Tracking</p>
                <p className="text-sm text-blue-600">
                  {order.shippingCarrier}: <span className="font-mono">{order.trackingNumber}</span>
                </p>
              </div>
            </div>
            {order.trackingUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                  Track Package
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Bill To</h3>
                  </div>
                  <p className="font-medium text-gray-900 mb-1">{organization.name}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {order.billingAddress || organization.address || 'No billing address provided'}
                  </p>
                  {organization.email && (
                    <p className="text-sm text-gray-500 mt-2">{organization.email}</p>
                  )}
                  {organization.phone && (
                    <p className="text-sm text-gray-500">{organization.phone}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Ship To</h3>
                  </div>
                  {project.clientName && (
                    <p className="font-medium text-gray-900 mb-1">{project.clientName}</p>
                  )}
                  <p className="text-sm text-gray-500 mb-1">Project: {project.name}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {order.shippingAddress || project.address || 'No shipping address provided'}
                  </p>
                  {order.expectedDelivery && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Expected:</span>
                      <span className="font-medium">{formatDate(order.expectedDelivery)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment Card */}
            {order.paymentCardNumber && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Payment Card</h3>
                    <span className="text-xs text-gray-500 ml-auto">Please charge the order total to this card</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Card Number</p>
                        <p className="font-mono font-medium">{order.paymentCardNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Expiry</p>
                        <p className="font-medium">{order.paymentCardExpiry || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">CVV</p>
                        <p className="font-mono font-medium">{order.paymentCardCvv || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Cardholder</p>
                        <p className="font-medium">{order.paymentCardHolderName || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Items */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Order Items ({items.length})</h3>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-600">Item</th>
                        <th className="text-center p-3 font-medium text-gray-600 w-20">Qty</th>
                        <th className="text-right p-3 font-medium text-gray-600 w-28">Unit Price</th>
                        <th className="text-right p-3 font-medium text-gray-600 w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {item.images && item.images[0] ? (
                                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-gray-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                                  {item.sku && <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{item.sku}</span>}
                                  {item.brand && <span>{item.brand}</span>}
                                  {item.color && <span>Color: {item.color}</span>}
                                  {item.finish && <span>Finish: {item.finish}</span>}
                                </div>
                                {item.leadTime && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                                    <Clock className="w-3 h-3" />
                                    {item.leadTime}
                                  </div>
                                )}
                                {item.supplierLink && (
                                  <a
                                    href={item.supplierLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                                  >
                                    View Product
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {item.quantity} {item.unitType || ''}
                          </td>
                          <td className="p-3 text-right text-gray-600">
                            {formatCurrency(item.unitPrice, order.currency)}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(item.totalPrice, order.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t">
                  <div className="max-w-xs ml-auto space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{formatCurrency(order.subtotal, order.currency)}</span>
                    </div>
                    {order.shippingCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span>{formatCurrency(order.shippingCost, order.currency)}</span>
                      </div>
                    )}
                    {order.extraCharges?.map((charge, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-gray-600">{charge.label}</span>
                        <span>{formatCurrency(charge.amount, order.currency)}</span>
                      </div>
                    ))}
                    {order.taxAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-semibold text-base">
                      <span>Total</span>
                      <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {order.notes && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Order Notes</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Messages & Documents */}
          <div className="space-y-6">
            {/* Supplier Details */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Supplier</h3>
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-gray-900">{supplier.name}</p>
                  {supplier.contactName && (
                    <p className="text-gray-600">Contact: {supplier.contactName}</p>
                  )}
                  {supplier.email && (
                    <p className="text-gray-600">{supplier.email}</p>
                  )}
                  {supplier.phone && (
                    <p className="text-gray-600">{supplier.phone}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="messages">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="messages" className="flex-1">
                      Messages ({messages.length})
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="flex-1">
                      Documents ({documents.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="messages" className="mt-0">
                    <div className="flex justify-end mb-4">
                      <Button size="sm" onClick={() => setShowMessageDialog(true)}>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </Button>
                    </div>

                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg text-sm ${
                              msg.senderType === 'SUPPLIER'
                                ? 'bg-blue-50 border-l-2 border-blue-500'
                                : 'bg-gray-50 border-l-2 border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900">
                                {msg.senderType === 'SUPPLIER' ? 'You' : msg.senderName || organization.name}
                              </span>
                              <span className="text-xs text-gray-500">{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="text-gray-600 whitespace-pre-line">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0">
                    <div className="flex justify-end mb-4">
                      <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>

                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No documents yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">{doc.title}</p>
                                <p className="text-xs text-gray-500">{doc.type}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Order Info */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Order Information</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">PO Number</span>
                    <span className="font-mono">{order.orderNumber}</span>
                  </div>
                  {order.quoteNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quote Ref</span>
                      <span className="font-mono">{order.quoteNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge variant={statusConfig.variant} className="text-xs">
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Items</span>
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Order Date</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  {order.orderedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sent Date</span>
                      <span>{formatDate(order.orderedAt)}</span>
                    </div>
                  )}
                  {order.expectedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expected Delivery</span>
                      <span>{formatDate(order.expectedDelivery)}</span>
                    </div>
                  )}
                  {order.shippingMethod && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shipping Method</span>
                      <span>{order.shippingMethod}</span>
                    </div>
                  )}
                  {order.shippingCarrier && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Carrier</span>
                      <span>{order.shippingCarrier}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Powered by {organization.name}
          </p>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
            <DialogDescription>
              Confirm that you can fulfill this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmName">Your Name *</Label>
              <Input
                id="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNotes">Notes (optional)</Label>
              <Textarea
                id="confirmNotes"
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Any notes or comments..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleAction('confirm', { confirmedBy: confirmName, notes: confirmNotes })}
              disabled={!confirmName.trim() || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={showShipDialog} onOpenChange={setShowShipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>
              Add shipping and tracking information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier *</Label>
              <Input
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g., UPS, FedEx, DHL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingUrl">Tracking URL</Label>
              <Input
                id="trackingUrl"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipExpectedDelivery">Expected Delivery</Label>
              <Input
                id="shipExpectedDelivery"
                type="date"
                value={shipExpectedDelivery}
                onChange={(e) => setShipExpectedDelivery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipNotes">Notes</Label>
              <Textarea
                id="shipNotes"
                value={shipNotes}
                onChange={(e) => setShipNotes(e.target.value)}
                placeholder="Shipping notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShipDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleAction('ship', {
                trackingNumber,
                trackingUrl,
                carrier,
                expectedDelivery: shipExpectedDelivery || undefined,
                notes: shipNotes
              })}
              disabled={!carrier.trim() || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
              Mark Shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a message to {organization.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Type your message..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleAction('message', { content: messageContent })
                setMessageContent('')
              }}
              disabled={!messageContent.trim() || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document related to this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              />
              <p className="text-xs text-gray-500">PDF, Word, Excel, or images (max 25MB)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadType">Document Type</Label>
              <select
                id="uploadType"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="DRAWING">Drawing</option>
                <option value="SPEC_SHEET">Spec Sheet</option>
                <option value="SHIPPING_DOC">Shipping Document</option>
                <option value="PACKING_SLIP">Packing Slip</option>
                <option value="PHOTO">Photo</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadTitle">Title</Label>
              <Input
                id="uploadTitle"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadDescription">Description</Label>
              <Textarea
                id="uploadDescription"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false)
              setUploadFile(null)
              setUploadTitle('')
              setUploadDescription('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
