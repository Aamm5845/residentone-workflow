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
  CreditCard,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Info
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText },
  PENDING_PAYMENT: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Clock },
  ORDERED: { label: 'Awaiting Confirmation', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Package },
  CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle },
  PROCESSING: { label: 'Processing', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: Clock },
  SHIPPED: { label: 'Shipped', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'text-green-700', bgColor: 'bg-green-100', icon: Package },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100', icon: X }
}

export default function SupplierOrderPortal() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // UI State
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'documents'>('details')
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

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading order...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Order</h1>
          <p className="text-gray-600">{error || 'Order not found or access denied'}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization.logo ? (
                <img src={organization.logo} alt={organization.name} className="h-10 object-contain" />
              ) : (
                <div className="h-10 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center">
                  <span className="font-bold text-white">{organization.name}</span>
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              {organization.email && (
                <a href={`mailto:${organization.email}`} className="text-blue-600 hover:underline block">
                  {organization.email}
                </a>
              )}
              {organization.phone && <div className="text-gray-500">{organization.phone}</div>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl font-bold">PO #{order.orderNumber}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                    <StatusIcon className="h-4 w-4" />
                    {statusConfig.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-blue-100">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {project.name}
                  </span>
                  {order.orderedAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Ordered: {formatDate(order.orderedAt)}
                    </span>
                  )}
                  {order.expectedDelivery && (
                    <span className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                      <Truck className="h-4 w-4" />
                      Expected: {formatDate(order.expectedDelivery)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!isConfirmed && !isShipped && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-600 rounded-xl font-medium hover:bg-emerald-50 transition-all shadow-lg"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Confirm Order
                  </button>
                )}
                {isConfirmed && !isShipped && (
                  <button
                    onClick={() => setShowShipDialog(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-all shadow-lg"
                  >
                    <Truck className="h-5 w-5" />
                    Mark Shipped
                  </button>
                )}
                <button
                  onClick={() => setShowMessageDialog(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-all"
                >
                  <MessageSquare className="h-5 w-5" />
                  Message
                </button>
              </div>
            </div>
          </div>

          {/* Status Alerts */}
          {isConfirmed && (
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-emerald-800">Order Confirmed</p>
                <p className="text-sm text-emerald-600">
                  Confirmed by {order.supplierConfirmedBy} on {formatDateTime(order.supplierConfirmedAt!)}
                </p>
              </div>
            </div>
          )}

          {order.trackingNumber && (
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-purple-800">Shipment Tracking</p>
                  <p className="text-sm text-purple-600">
                    {order.shippingCarrier || 'Carrier'}: <span className="font-mono">{order.trackingNumber}</span>
                  </p>
                </div>
              </div>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Track Package
                </a>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 bg-white/50 p-1.5 rounded-xl w-fit">
          {[
            { id: 'details', label: 'Order Details', icon: Package },
            { id: 'messages', label: `Messages (${messages.length})`, icon: MessageSquare },
            { id: 'documents', label: `Documents (${documents.length})`, icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Address Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.billingAddress && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Bill To</h2>
                  </div>
                  <p className="text-gray-600 whitespace-pre-line">{order.billingAddress}</p>
                </div>
              )}
              {order.shippingAddress && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-purple-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Ship To</h2>
                  </div>
                  <p className="text-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
                  {order.expectedDelivery && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500">Expected Delivery</p>
                      <p className="font-semibold text-gray-900">{formatDate(order.expectedDelivery)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Card */}
            {order.paymentCardNumber && (
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Payment Card</h2>
                    <p className="text-emerald-100">Please charge the order total to this card</p>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-5 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-emerald-200 mb-1">Card Number</p>
                    <p className="font-mono text-2xl tracking-widest">
                      {order.paymentCardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-200 mb-1">Expiry</p>
                      <p className="font-semibold">{order.paymentCardExpiry || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-200 mb-1">CVV</p>
                      <p className="font-semibold font-mono">{order.paymentCardCvv || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-200 mb-1">Type</p>
                      <p className="font-semibold">{order.paymentCardBrand || 'Card'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-emerald-200 mb-1">Cardholder</p>
                    <p className="font-semibold">{order.paymentCardHolderName || 'N/A'}</p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-emerald-100">
                    Amount to charge: <span className="text-2xl font-bold text-white">{formatCurrency(order.totalAmount, order.currency)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">Order Items ({items.length})</h2>
              </div>
              <div className="divide-y">
                {items.map((item) => {
                  const isExpanded = expandedItems.has(item.id)
                  const hasDetails = item.color || item.finish || item.material || item.dimensions || item.notes || item.supplierLink

                  return (
                    <div key={item.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex gap-4">
                        {/* Image */}
                        <div className="flex-shrink-0">
                          {item.images && item.images[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-20 h-20 object-cover rounded-xl border shadow-sm"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-100 rounded-xl border flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-gray-900">{item.name}</h3>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                                {item.sku && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.sku}</span>}
                                {item.brand && <span>{item.brand}</span>}
                                <span className="font-medium text-gray-700">Qty: {item.quantity} {item.unitType || 'units'}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-gray-900">{formatCurrency(item.totalPrice, order.currency)}</p>
                              {item.quantity > 1 && (
                                <p className="text-sm text-gray-500">@ {formatCurrency(item.unitPrice, order.currency)}</p>
                              )}
                            </div>
                          </div>

                          {/* Quick Info Pills */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {item.color && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                                Color: {item.color}
                              </span>
                            )}
                            {item.finish && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                                Finish: {item.finish}
                              </span>
                            )}
                            {item.leadTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                                <Clock className="h-3 w-3" />
                                {item.leadTime}
                              </span>
                            )}
                            {item.supplierLink && (
                              <a
                                href={item.supplierLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                              >
                                <LinkIcon className="h-3 w-3" />
                                Product Link
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>

                          {/* Expandable Details */}
                          {hasDetails && (
                            <>
                              <button
                                onClick={() => toggleItemExpanded(item.id)}
                                className="flex items-center gap-1 mt-3 text-sm text-blue-600 hover:text-blue-700"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    Show Details
                                  </>
                                )}
                              </button>

                              {isExpanded && (
                                <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-3">
                                  {item.description && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</p>
                                      <p className="text-sm text-gray-700">{item.description}</p>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {item.material && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Material</p>
                                        <p className="text-sm text-gray-900">{item.material}</p>
                                      </div>
                                    )}
                                    {item.dimensions && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Dimensions</p>
                                        <p className="text-sm text-gray-900">{item.dimensions}</p>
                                      </div>
                                    )}
                                  </div>
                                  {item.notes && (
                                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                                      <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                      <p className="text-sm text-amber-800">{item.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-t">
                <div className="max-w-sm ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal ({items.length} items)</span>
                    <span className="font-medium">{formatCurrency(order.subtotal, order.currency)}</span>
                  </div>
                  {order.shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">{formatCurrency(order.shippingCost, order.currency)}</span>
                    </div>
                  )}
                  {order.extraCharges?.map((charge, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{charge.label}</span>
                      <span className="font-medium">{formatCurrency(charge.amount, order.currency)}</span>
                    </div>
                  ))}
                  {order.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">{formatCurrency(order.taxAmount, order.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-emerald-200">
                    <span className="text-lg font-bold text-emerald-800">Total</span>
                    <span className="text-2xl font-bold text-emerald-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Order Notes</h2>
                </div>
                <p className="text-gray-600 whitespace-pre-line">{order.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Messages</h2>
              <button
                onClick={() => setShowMessageDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4" />
                New Message
              </button>
            </div>
            <div className="p-6">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No messages yet</p>
                  <p className="text-sm text-gray-500 mt-1">Send a message if you have questions about this order</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl ${
                        msg.senderType === 'SUPPLIER'
                          ? 'bg-blue-50 ml-8 border-l-4 border-blue-500'
                          : 'bg-gray-50 mr-8 border-l-4 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-900">
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
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Documents</h2>
              <button
                onClick={() => setShowUploadDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>
            <div className="p-6">
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No documents yet</p>
                  <p className="text-sm text-gray-500 mt-1">Upload drawings, specs, or other relevant files</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-500">{doc.type} • {formatDate(doc.createdAt)}</p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-white border rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
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

      {/* Dialogs */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Order</h3>
                <p className="text-sm text-gray-500">Confirm you can fulfill this order</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Any notes or comments..."
                  rows={3}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2.5 border rounded-xl hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('confirm', { confirmedBy: confirmName, notes: confirmNotes })}
                disabled={!confirmName.trim() || submitting}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShipDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mark as Shipped</h3>
                <p className="text-sm text-gray-500">Add tracking information</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier *</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., UPS, FedEx, DHL"
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tracking URL</label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                <input
                  type="date"
                  value={shipExpectedDelivery}
                  onChange={(e) => setShipExpectedDelivery(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={shipNotes}
                  onChange={(e) => setShipNotes(e.target.value)}
                  placeholder="Shipping notes..."
                  rows={2}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowShipDialog(false)}
                className="px-4 py-2.5 border rounded-xl hover:bg-gray-50 font-medium"
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
                className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Mark Shipped'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMessageDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Send Message</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowMessageDialog(false)}
                className="px-4 py-2.5 border rounded-xl hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction('message', { content: messageContent })
                  setMessageContent('')
                }}
                disabled={!messageContent.trim() || submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  className="w-full text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel, or images (max 25MB)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2.5 border rounded-xl hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
