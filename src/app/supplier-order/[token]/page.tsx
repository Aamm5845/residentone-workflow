'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
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
  Check,
  X,
  ChevronDown,
  ChevronUp
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
  dimensions?: string
  images?: string[]
  leadTime?: string
  status?: string
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
    totalAmount: number
    currency: string
    // Payment method info for supplier to charge
    paymentCardBrand?: string
    paymentCardLastFour?: string
    paymentCardHolderName?: string
    paymentCardExpiry?: string
    paymentCardNumber?: string // Full card number (decrypted)
    paymentCardCvv?: string // CVV (decrypted)
  }
  project: {
    id: string
    name: string
    address?: string
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDING_PAYMENT: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  ORDERED: { label: 'Ordered', color: 'bg-blue-100 text-blue-700', icon: Package },
  CONFIRMED: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  PROCESSING: { label: 'Processing', color: 'bg-indigo-100 text-indigo-700', icon: Clock },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: Package },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: X }
}

export default function SupplierOrderPortal() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI State
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'documents'>('details')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showShipDialog, setShowShipDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

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

      // Close dialogs
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

  const toggleItemExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Order</h1>
          <p className="text-gray-600">{error || 'Order not found'}</p>
        </div>
      </div>
    )
  }

  const { order, project, supplier, items, documents, messages, organization } = data
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT
  const StatusIcon = statusConfig.icon
  const isConfirmed = !!order.supplierConfirmedAt
  const isShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED'

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization.logo ? (
                <img src={organization.logo} alt={organization.name} className="h-10" />
              ) : (
                <div className="font-bold text-xl text-gray-900">{organization.name}</div>
              )}
            </div>
            <div className="text-right text-sm text-gray-500">
              {organization.email && <div>{organization.email}</div>}
              {organization.phone && <div>{organization.phone}</div>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Order Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">PO {order.orderNumber}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                  <StatusIcon className="h-4 w-4" />
                  {statusConfig.label}
                </span>
              </div>
              <div className="text-gray-600 space-y-1">
                <p>Project: <span className="font-medium">{project.name}</span></p>
                {order.orderedAt && <p>Ordered: {formatDate(order.orderedAt)}</p>}
                {order.expectedDelivery && (
                  <p className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Expected: <span className="font-medium">{formatDate(order.expectedDelivery)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* Confirm Button */}
              {!isConfirmed && !isShipped && (
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm Order
                </button>
              )}

              {/* Ship Button */}
              {isConfirmed && !isShipped && (
                <button
                  onClick={() => setShowShipDialog(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  Mark Shipped
                </button>
              )}

              {/* Message Button */}
              <button
                onClick={() => setShowMessageDialog(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Send Message
              </button>

              {/* Upload Button */}
              <button
                onClick={() => setShowUploadDialog(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>
          </div>

          {/* Confirmation Status */}
          {isConfirmed && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700">
                <Check className="h-5 w-5" />
                <span className="font-medium">
                  Order confirmed by {order.supplierConfirmedBy} on {formatDateTime(order.supplierConfirmedAt!)}
                </span>
              </div>
            </div>
          )}

          {/* Tracking Info */}
          {order.trackingNumber && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-700">
                  <Truck className="h-5 w-5" />
                  <span>
                    <span className="font-medium">{order.shippingCarrier || 'Carrier'}</span>
                    {' - '}
                    <span className="font-mono">{order.trackingNumber}</span>
                  </span>
                </div>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'details'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Order Details
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'messages'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Messages ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Documents ({documents.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Addresses - Bill To & Ship To */}
            {(order.billingAddress || order.shippingAddress) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Billing Address */}
                {order.billingAddress && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      Bill To
                    </h2>
                    <p className="text-gray-600 whitespace-pre-line">{order.billingAddress}</p>
                  </div>
                )}
                {/* Shipping Address */}
                {order.shippingAddress && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      Ship To
                    </h2>
                    <p className="text-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
                    {order.expectedDelivery && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-500">Expected Delivery</p>
                        <p className="font-medium">{formatDate(order.expectedDelivery)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payment Method - Charge to Card */}
            {order.paymentCardNumber && (
              <div className="bg-green-50 border border-green-200 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Payment Method - Please Charge to Card
                </h2>
                <div className="bg-white border border-green-100 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Card Number</p>
                      <p className="font-mono text-lg font-semibold tracking-wider">
                        {order.paymentCardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Card Type</p>
                      <p className="font-semibold">{order.paymentCardBrand || 'Credit Card'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expiry Date</p>
                      <p className="font-semibold">{order.paymentCardExpiry || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">CVV</p>
                      <p className="font-semibold">{order.paymentCardCvv || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Cardholder Name</p>
                      <p className="font-semibold">{order.paymentCardHolderName || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-green-700">
                  Please charge the total amount ({formatCurrency(order.totalAmount, order.currency)}) to this card.
                </p>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Order Items ({items.length})</h2>
              </div>
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="p-4">
                    <div
                      className="flex items-start gap-4 cursor-pointer"
                      onClick={() => toggleItemExpand(item.id)}
                    >
                      {/* Image */}
                      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        {item.images && item.images[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.sku && (
                              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                            )}
                            {item.brand && (
                              <p className="text-sm text-gray-500">{item.brand}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(item.totalPrice, order.currency)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unitPrice, order.currency)} × {item.quantity}
                              {item.unitType && ` ${item.unitType}`}
                            </p>
                          </div>
                        </div>

                        {/* Expand indicator */}
                        <button className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                          {expandedItems.has(item.id) ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Less details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              More details
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedItems.has(item.id) && (
                      <div className="mt-4 ml-20 p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                        {item.description && (
                          <p><span className="font-medium">Description:</span> {item.description}</p>
                        )}
                        {item.color && (
                          <p><span className="font-medium">Color:</span> {item.color}</p>
                        )}
                        {item.finish && (
                          <p><span className="font-medium">Finish:</span> {item.finish}</p>
                        )}
                        {item.dimensions && (
                          <p><span className="font-medium">Dimensions:</span> {item.dimensions}</p>
                        )}
                        {item.leadTime && (
                          <p><span className="font-medium">Lead Time:</span> {item.leadTime}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="space-y-2 text-right">
                  <div className="flex justify-end gap-8">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium w-28">{formatCurrency(order.subtotal, order.currency)}</span>
                  </div>
                  {order.shippingCost > 0 && (
                    <div className="flex justify-end gap-8">
                      <span className="text-gray-600">Shipping</span>
                      <span className="w-28">{formatCurrency(order.shippingCost, order.currency)}</span>
                    </div>
                  )}
                  {order.taxAmount > 0 && (
                    <div className="flex justify-end gap-8">
                      <span className="text-gray-600">Tax</span>
                      <span className="w-28">{formatCurrency(order.taxAmount, order.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-8 pt-2 border-t">
                    <span className="font-semibold text-lg">Total</span>
                    <span className="font-bold text-lg text-blue-600 w-28">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Notes</h2>
                <p className="text-gray-600 whitespace-pre-line">{order.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              <button
                onClick={() => setShowMessageDialog(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
                New Message
              </button>
            </div>
            <div className="p-6">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No messages yet</p>
                  <p className="text-sm">Send a message if you have questions about this order</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-lg ${
                        msg.senderType === 'SUPPLIER'
                          ? 'bg-blue-50 ml-8'
                          : 'bg-gray-50 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {msg.senderType === 'SUPPLIER' ? 'You' : msg.senderName || organization.name}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
              <button
                onClick={() => setShowUploadDialog(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>
            </div>
            <div className="p-6">
              {documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No documents yet</p>
                  <p className="text-sm">Upload drawings, specs, or other relevant files</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-500">{doc.type} • {formatDate(doc.createdAt)}</p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Order Receipt</h3>
            <p className="text-gray-600 mb-4">
              Please confirm that you have received this purchase order and can fulfill it.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Any notes or comments..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('confirm', { confirmedBy: confirmName, notes: confirmNotes })}
                disabled={!confirmName.trim() || submitting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ship Dialog */}
      {showShipDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark as Shipped</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., UPS, FedEx, DHL"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking URL (optional)
                </label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={shipExpectedDelivery}
                  onChange={(e) => setShipExpectedDelivery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                  placeholder="Shipping notes..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowShipDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('ship', {
                  trackingNumber,
                  trackingUrl,
                  carrier,
                  expectedDelivery: shipExpectedDelivery || undefined,
                  notes: shipNotes
                })}
                disabled={!carrier.trim() || submitting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mark Shipped'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Dialog */}
      {showMessageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Message</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message *
              </label>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowMessageDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction('message', { content: messageContent })
                  setMessageContent('')
                }}
                disabled={!messageContent.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PDF, Word, Excel, or images (max 25MB)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DRAWING">Drawing</option>
                  <option value="SPEC_SHEET">Spec Sheet</option>
                  <option value="SHIPPING_DOC">Shipping Document</option>
                  <option value="PACKING_SLIP">Packing Slip</option>
                  <option value="PHOTO">Photo</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadDialog(false)
                  setUploadFile(null)
                  setUploadTitle('')
                  setUploadDescription('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
