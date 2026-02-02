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
  Trash2,
  Eye,
  Paperclip,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Search
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
  mimeType?: string
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

interface Activity {
  id: string
  type: string
  message: string
  createdAt: string
}

interface OrderData {
  order: {
    id: string
    orderNumber: string
    supplierQuoteNumber?: string
    clientQuoteNumber?: string
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
    shippingRecipientName?: string
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
    supplierPaidAt?: string
    supplierPaymentAmount?: number
    supplierPaymentMethod?: string
    // Deposit info
    depositRequired?: number
    depositPercent?: number
    depositPaid?: number
    depositPaidAt?: string
    balanceDue?: number
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
    logo?: string
  }
  items: OrderItem[]
  documents: Document[]
  messages: Message[]
  activities?: Activity[]
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
  ORDERED: { label: 'Sent', variant: 'default' },
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showTrackingDialog, setShowTrackingDialog] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState<'messages' | 'documents' | 'activity'>('messages')

  // Form State - Confirm with optional receipt upload
  const [confirmName, setConfirmName] = useState('')
  const [confirmNotes, setConfirmNotes] = useState('')
  const [confirmReceipt, setConfirmReceipt] = useState<File | null>(null)

  // Form State - Record Payment
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CARD')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentChargedBy, setPaymentChargedBy] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [carrier, setCarrier] = useState('')
  const [shipExpectedDelivery, setShipExpectedDelivery] = useState('')
  const [shipNotes, setShipNotes] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadType, setUploadType] = useState('RECEIPT')
  const [submitting, setSubmitting] = useState(false)
  const [showFullCardDetails, setShowFullCardDetails] = useState(false)

  // Tracking info state
  const [trackingInfo, setTrackingInfo] = useState<{
    success: boolean
    status?: string
    statusDescription?: string
    carrierName?: string
    estimatedDelivery?: string
    events?: Array<{
      date: string
      status: string
      location: string
      description: string
    }>
    error?: string
  } | null>(null)
  const [fetchingTracking, setFetchingTracking] = useState(false)
  const [showTrackingEvents, setShowTrackingEvents] = useState(false)
  const [showPortalTrackingEvents, setShowPortalTrackingEvents] = useState(false)
  const [portalTrackingInfo, setPortalTrackingInfo] = useState<typeof trackingInfo>(null)
  const [fetchingPortalTracking, setFetchingPortalTracking] = useState(false)

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
      setShowPaymentDialog(false)
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

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      const res = await fetch(`/api/supplier-order/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_message', messageId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete message')
      }

      toast.success('Message deleted')
      await fetchOrder()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const res = await fetch(`/api/supplier-order/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_document', documentId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete document')
      }

      toast.success('Document deleted')
      await fetchOrder()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const fetchTrackingInfo = async (trackNum: string, forPortal = false) => {
    if (!trackNum.trim()) {
      if (forPortal) {
        setPortalTrackingInfo(null)
      } else {
        setTrackingInfo(null)
      }
      return
    }

    if (forPortal) {
      setFetchingPortalTracking(true)
    } else {
      setFetchingTracking(true)
      setTrackingInfo(null)
    }

    try {
      const res = await fetch(`/api/supplier-order/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_tracking', trackingNumber: trackNum })
      })

      const data = await res.json()

      if (forPortal) {
        setPortalTrackingInfo(data)
      } else {
        setTrackingInfo(data)
      }
    } catch (err: any) {
      console.error('Failed to fetch tracking:', err)
      const errorData = { success: false, error: 'Failed to fetch tracking info' }
      if (forPortal) {
        setPortalTrackingInfo(errorData)
      } else {
        setTrackingInfo(errorData)
      }
    } finally {
      if (forPortal) {
        setFetchingPortalTracking(false)
      } else {
        setFetchingTracking(false)
      }
    }
  }

  // Auto-fetch tracking for portal when order has tracking number
  useEffect(() => {
    if (data?.order?.trackingNumber && !portalTrackingInfo) {
      fetchTrackingInfo(data.order.trackingNumber, true)
    }
  }, [data?.order?.trackingNumber])

  // Debounced auto-fetch for tracking dialog
  useEffect(() => {
    if (!showTrackingDialog || !trackingNumber.trim()) {
      return
    }

    const timer = setTimeout(() => {
      if (trackingNumber.trim().length >= 8) {
        fetchTrackingInfo(trackingNumber)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [trackingNumber, showTrackingDialog])

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

  const { order, project, supplier, items, documents, messages, activities, organization } = data

  // Add null safety
  const safeOrganization = organization || { name: 'Meisner Interiors', logo: null, phone: null, email: null, address: null }
  const safeProject = project || { id: '', name: 'Project', address: null, clientName: null }
  const safeSupplier = supplier || { id: '', name: 'Supplier', email: null, phone: null, contactName: null, logo: null }

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
              {safeOrganization.logo ? (
                <img src={safeOrganization.logo} alt={safeOrganization.name} className="h-10 bg-white rounded px-2 py-1" />
              ) : (
                <span className="text-xl font-bold">{safeOrganization.name}</span>
              )}
              <div className="text-right text-sm text-gray-300">
                {safeOrganization.email && <div>{safeOrganization.email}</div>}
                {safeOrganization.phone && <div>{safeOrganization.phone}</div>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">Purchase Order #{order.orderNumber}</h1>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  {order.currency === 'USD' && (
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-200 border-blue-400">
                      USD
                    </Badge>
                  )}
                </div>
                <p className="text-gray-300">Project: {safeProject.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Record Payment (show when balance remaining) */}
                {order.totalAmount - (order.supplierPaymentAmount || 0) > 0 && (
                  <Button onClick={() => {
                    // Default to deposit amount if deposit required and not fully paid
                    const depositRequired = order.depositRequired || 0
                    const depositPaid = order.depositPaid || 0
                    const hasUnpaidDeposit = depositRequired > 0 && depositPaid < depositRequired
                    const defaultAmount = hasUnpaidDeposit
                      ? (depositRequired - depositPaid)
                      : (order.totalAmount - (order.supplierPaymentAmount || 0))
                    setPaymentAmount(defaultAmount.toFixed(2))
                    setShowPaymentDialog(true)
                  }} variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                )}

                {/* Mark Shipped (show when order has payment or is confirmed) */}
                {(isConfirmed || order.supplierPaymentAmount) && !isShipped && (
                  <Button onClick={() => setShowShipDialog(true)} variant="secondary">
                    <Truck className="w-4 h-4 mr-2" />
                    Mark Shipped
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>


        {/* Tracking Banner - show when shipped */}
        {isShipped && (
          <div className={`rounded-lg p-4 mb-6 ${
            order.trackingNumber ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className={`w-5 h-5 ${order.trackingNumber ? 'text-blue-600' : 'text-amber-600'}`} />
                <div>
                  {order.trackingNumber ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-blue-800">
                          {portalTrackingInfo?.carrierName || order.shippingCarrier}
                        </p>
                        {fetchingPortalTracking && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        {portalTrackingInfo?.success && portalTrackingInfo.status && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            portalTrackingInfo.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                            portalTrackingInfo.status === 'IN_TRANSIT' || portalTrackingInfo.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-100 text-blue-800' :
                            portalTrackingInfo.status === 'EXCEPTION' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {portalTrackingInfo.status?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-blue-600">
                        <span className="font-mono">{order.trackingNumber}</span>
                        {portalTrackingInfo?.success && portalTrackingInfo.statusDescription && (
                          <span className="ml-2">• {portalTrackingInfo.statusDescription}</span>
                        )}
                      </p>
                      {portalTrackingInfo?.success && portalTrackingInfo.estimatedDelivery && (
                        <p className="text-sm text-blue-600">
                          Est. Delivery: {new Date(portalTrackingInfo.estimatedDelivery).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-800">No Tracking Added</p>
                      <p className="text-sm text-amber-600">
                        {order.shippingCarrier} • Add tracking when available
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTrackingNumber(order.trackingNumber || '')
                    setTrackingInfo(null)
                    setShowTrackingEvents(false)
                    setShowTrackingDialog(true)
                  }}
                  className={order.trackingNumber ? '' : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'}
                >
                  {order.trackingNumber ? 'Update' : 'Add Tracking'}
                </Button>
              </div>
            </div>

            {/* Expandable Tracking Events in Portal */}
            {order.trackingNumber && portalTrackingInfo?.success && portalTrackingInfo.events && portalTrackingInfo.events.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowPortalTrackingEvents(!showPortalTrackingEvents)}
                  className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium text-sm"
                >
                  {showPortalTrackingEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {portalTrackingInfo.events.length} tracking event{portalTrackingInfo.events.length !== 1 ? 's' : ''}
                </button>
                {showPortalTrackingEvents && (
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {portalTrackingInfo.events.map((event, idx) => (
                      <div key={idx} className="flex gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-blue-900">{event.description}</p>
                          <p className="text-blue-600 text-xs">
                            {event.location && `${event.location} • `}
                            {new Date(event.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Documents Alert Banner - only show for spec sheets, drawings, etc. (not receipts/invoices/shipping docs) */}
        {(() => {
          const importantDocs = documents.filter(doc =>
            !['RECEIPT', 'INVOICE', 'SHIPPING_DOC', 'PACKING_SLIP'].includes(doc.type)
          )
          if (importantDocs.length === 0) return null
          return (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Paperclip className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-800">
                      {importantDocs.length} Document{importantDocs.length !== 1 ? 's' : ''} Attached
                    </p>
                    <p className="text-sm text-purple-600">
                      Spec sheets, drawings, and other order documents are available below
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={() => {
                    // Switch to documents tab and scroll to it
                    setActiveTab('documents')
                    setTimeout(() => {
                      document.getElementById('documents-section')?.scrollIntoView({ behavior: 'smooth' })
                    }, 100)
                  }}
                >
                  View Documents
                </Button>
              </div>
            </div>
          )
        })()}

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
                  <p className="font-medium text-gray-900 mb-1">{safeOrganization.name}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {order.billingAddress || safeOrganization.address || 'No billing address provided'}
                  </p>
                  {safeOrganization.email && (
                    <p className="text-sm text-gray-500 mt-2">{safeOrganization.email}</p>
                  )}
                  {safeOrganization.phone && (
                    <p className="text-sm text-gray-500">{safeOrganization.phone}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Ship To</h3>
                  </div>
                  <p className="font-medium text-gray-900 mb-1">
                    {order.shippingRecipientName || safeProject.clientName || safeProject.name}
                  </p>
                  <p className="text-sm text-gray-500 mb-1">Project: {safeProject.name}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {order.shippingAddress || safeProject.address || 'No shipping address provided'}
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
            {(order.paymentCardLastFour || order.paymentCardNumber) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Payment Card</h3>
                    <span className="text-xs text-gray-500 ml-auto">
                      {order.depositRequired && order.depositRequired > 0 && (!order.depositPaid || order.depositPaid < order.depositRequired)
                        ? `Please charge ${formatCurrency(order.depositRequired - (order.depositPaid || 0), order.currency)} deposit to this card`
                        : order.totalAmount - (order.supplierPaymentAmount || 0) > 0
                          ? `Please charge ${formatCurrency(order.totalAmount - (order.supplierPaymentAmount || 0), order.currency)} to this card`
                          : 'Payment complete'
                      }
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    {showFullCardDetails && order.paymentCardNumber ? (
                      // Full card details visible
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Card Number</p>
                            <p className="font-medium text-gray-900">{order.paymentCardNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Expiry</p>
                            <p className="font-medium text-gray-900">{order.paymentCardExpiry || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">CVV</p>
                            <p className="font-medium text-gray-900">{order.paymentCardCvv || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Cardholder</p>
                            <p className="font-medium text-gray-900">{order.paymentCardHolderName || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFullCardDetails(false)}
                            className="text-gray-500"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Hide Details
                          </Button>
                          {/* Confirm Charge Button */}
                          {(() => {
                            const hasUnpaidDeposit = order.depositRequired && order.depositRequired > 0 && (!order.depositPaid || order.depositPaid < order.depositRequired)
                            const depositRemaining = hasUnpaidDeposit ? (order.depositRequired! - (order.depositPaid || 0)) : 0
                            const balanceRemaining = order.totalAmount - (order.supplierPaymentAmount || 0)
                            const amountToCharge = hasUnpaidDeposit ? depositRemaining : balanceRemaining

                            if (amountToCharge <= 0) return null

                            return (
                              <Button
                                size="sm"
                                onClick={() => handleAction('record_payment', {
                                  amount: amountToCharge,
                                  method: 'CARD',
                                  notes: hasUnpaidDeposit ? 'Deposit charged to card on file' : 'Charged to card on file'
                                })}
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Confirm {hasUnpaidDeposit ? 'Deposit' : ''} Charge ({formatCurrency(amountToCharge, order.currency)})
                              </Button>
                            )
                          })()}
                        </div>
                      </>
                    ) : (
                      // Masked card details (default view)
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-8 h-8 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {order.paymentCardBrand || 'Card'} ending in {order.paymentCardLastFour || order.paymentCardNumber?.slice(-4) || '****'}
                              </p>
                              {order.paymentCardHolderName && (
                                <p className="text-sm text-gray-500">{order.paymentCardHolderName}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {order.paymentCardNumber && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFullCardDetails(true)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Show Full Details
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Simple Payment Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Payment Summary</h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Order Total</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Paid</p>
                      <p className="text-lg font-semibold text-emerald-600">
                        {formatCurrency(order.supplierPaymentAmount || 0, order.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Owed</p>
                      <p className="text-lg font-semibold text-amber-600">
                        {formatCurrency(
                          Math.max(0, order.totalAmount - (order.supplierPaymentAmount || 0)),
                          order.currency
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                        <th className="text-right p-3 font-medium text-gray-600 w-28">
                          Total{order.currency === 'USD' ? ' (USD)' : ''}
                        </th>
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
                                  <Package className="w-5 h-5 text-gray-300" />
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
                            {item.quantity}
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
                      <span>Total{order.currency === 'USD' ? ' (USD)' : ''}</span>
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

          {/* Right Column - Messages, Documents & Activity */}
          <div className="space-y-6">
            {/* Compact Supplier Details */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  {safeSupplier.logo ? (
                    <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img src={safeSupplier.logo} alt={safeSupplier.name} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{safeSupplier.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      {safeSupplier.contactName && <span>{safeSupplier.contactName}</span>}
                      {safeSupplier.email && <span>{safeSupplier.email}</span>}
                      {safeSupplier.phone && <span>{safeSupplier.phone}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'messages' | 'documents' | 'activity')}>
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="messages" className="flex-1">
                      Messages ({messages.length})
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="flex-1">
                      Documents ({documents.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex-1">
                      Activity
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
                                {msg.senderType === 'SUPPLIER' ? 'You' : msg.senderName || safeOrganization.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{formatDate(msg.createdAt)}</span>
                                {msg.senderType === 'SUPPLIER' && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 whitespace-pre-line">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0" id="documents-section">
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
                        {documents.map((doc) => {
                          const isImage = doc.mimeType?.startsWith('image/') ||
                            /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.fileName)
                          const isPdf = doc.mimeType === 'application/pdf' ||
                            /\.pdf$/i.test(doc.fileName)
                          const canView = isImage || isPdf

                          return (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div
                                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                onClick={() => canView && setViewingDocument(doc)}
                              >
                                {isImage ? (
                                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-200">
                                    <img
                                      src={doc.fileUrl}
                                      alt={doc.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : isPdf ? (
                                  <div className="w-10 h-10 rounded flex-shrink-0 bg-red-100 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-red-600" />
                                  </div>
                                ) : (
                                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">{doc.title}</p>
                                  <p className="text-xs text-gray-500">{doc.type} {isPdf && '• PDF'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {canView && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingDocument(doc)}
                                    title="View document"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="w-4 h-4" />
                                  </a>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    {!activities || activities.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No activity yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3 text-sm border-b border-gray-100 pb-3 last:border-0">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              activity.type === 'PO_SENT' ? 'bg-blue-500' :
                              activity.type === 'PAYMENT_MADE' || activity.type === 'PAYMENT_RECORDED' ? 'bg-green-500' :
                              activity.type === 'ORDER_CONFIRMED' ? 'bg-emerald-500' :
                              activity.type === 'ORDER_SHIPPED' ? 'bg-purple-500' :
                              activity.type === 'ORDER_DELIVERED' ? 'bg-green-600' :
                              'bg-gray-400'
                            }`} />
                            <div className="flex-1">
                              <p className="text-gray-700">{activity.message}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(activity.createdAt)}</p>
                            </div>
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
                  {order.clientQuoteNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Client Quote</span>
                      <span className="font-mono">{order.clientQuoteNumber}</span>
                    </div>
                  )}
                  {order.supplierQuoteNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Supplier Quote</span>
                      <span className="font-mono">{order.supplierQuoteNumber}</span>
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
            Powered by {safeOrganization.name}
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
              <Label htmlFor="confirmName">Your Name (optional)</Label>
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
            <div className="space-y-2">
              <Label htmlFor="confirmReceipt">Upload Receipt (optional)</Label>
              <Input
                id="confirmReceipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setConfirmReceipt(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-500">PDF, JPG, or PNG (max 10MB)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // If there's a receipt file, upload it first
                if (confirmReceipt) {
                  const formData = new FormData()
                  formData.append('file', confirmReceipt)
                  formData.append('title', 'Order Receipt')
                  formData.append('type', 'RECEIPT')
                  formData.append('description', `Receipt uploaded when confirming order`)

                  try {
                    const uploadRes = await fetch(`/api/supplier-order/${token}/upload`, {
                      method: 'POST',
                      body: formData
                    })
                    if (!uploadRes.ok) {
                      console.error('Failed to upload receipt')
                    }
                  } catch (err) {
                    console.error('Error uploading receipt:', err)
                  }
                }
                // Then confirm the order
                handleAction('confirm', { confirmedBy: confirmName || 'Supplier', notes: confirmNotes })
              }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={showShipDialog} onOpenChange={(open) => {
        setShowShipDialog(open)
        if (!open) {
          setTrackingInfo(null)
          setShowTrackingEvents(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>
              Select the carrier. You can add tracking later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier *</Label>
              <select
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a carrier...</option>
                <option value="UPS">UPS</option>
                <option value="FedEx">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
                <option value="Canada Post">Canada Post</option>
                <option value="Purolator">Purolator</option>
                <option value="Canpar">Canpar</option>
                <option value="Loomis">Loomis Express</option>
                <option value="Day & Ross">Day & Ross</option>
                <option value="Freight">Freight/LTL</option>
                <option value="Local Delivery">Local Delivery</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipNotes">Notes (optional)</Label>
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
                carrier,
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

      {/* Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={(open) => {
        setShowTrackingDialog(open)
        if (!open) {
          setTrackingInfo(null)
          setShowTrackingEvents(false)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{order.trackingNumber ? 'Update Tracking' : 'Add Tracking'}</DialogTitle>
            <DialogDescription>
              Enter the tracking number to look up shipment status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dialogTrackingNumber">Tracking Number</Label>
              <div className="relative">
                <Input
                  id="dialogTrackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="pr-10"
                />
                {fetchingTracking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Tracking info will load automatically</p>
            </div>

            {/* Tracking Info Display */}
            {trackingInfo && (
              <div className={`rounded-lg border p-3 text-sm ${
                trackingInfo.success ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                {trackingInfo.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-800">
                        {trackingInfo.carrierName || 'Carrier detected'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        trackingInfo.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                        trackingInfo.status === 'IN_TRANSIT' || trackingInfo.status === 'OUT_FOR_DELIVERY' ? 'bg-blue-100 text-blue-800' :
                        trackingInfo.status === 'EXCEPTION' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trackingInfo.status?.replace(/_/g, ' ') || 'Pending'}
                      </span>
                    </div>
                    {trackingInfo.statusDescription && (
                      <p className="text-blue-700">{trackingInfo.statusDescription}</p>
                    )}
                    {trackingInfo.estimatedDelivery && (
                      <p className="text-blue-600">
                        Est. Delivery: {new Date(trackingInfo.estimatedDelivery).toLocaleDateString()}
                      </p>
                    )}

                    {/* Tracking Events */}
                    {trackingInfo.events && trackingInfo.events.length > 0 && (
                      <div className="pt-2 border-t border-blue-200">
                        <button
                          type="button"
                          onClick={() => setShowTrackingEvents(!showTrackingEvents)}
                          className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium"
                        >
                          {showTrackingEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {trackingInfo.events.length} tracking event{trackingInfo.events.length !== 1 ? 's' : ''}
                        </button>
                        {showTrackingEvents && (
                          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                            {trackingInfo.events.map((event, idx) => (
                              <div key={idx} className="flex gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-blue-900">{event.description}</p>
                                  <p className="text-blue-600">
                                    {event.location && `${event.location} • `}
                                    {new Date(event.date).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-yellow-800">
                    {trackingInfo.error || 'Tracking info not yet available. It may take time for carriers to update.'}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {order.trackingNumber && (
              <Button
                variant="outline"
                className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  handleAction('update_tracking', { trackingNumber: null })
                  setShowTrackingDialog(false)
                }}
                disabled={submitting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Tracking
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleAction('update_tracking', {
                  trackingNumber: trackingNumber.trim() || null,
                  carrierName: trackingInfo?.carrierName || null
                })
                setShowTrackingDialog(false)
                // Refresh portal tracking after save
                setTimeout(() => {
                  if (trackingNumber.trim()) {
                    fetchTrackingInfo(trackingNumber.trim(), true)
                  } else {
                    setPortalTrackingInfo(null)
                  }
                }, 500)
              }}
              disabled={!trackingNumber.trim() || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Save Tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record the payment you've charged to the customer's card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Payment context info */}
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Order Total</span>
                <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
              </div>
              {order.depositPaid && order.depositPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-600">Already Paid</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(order.depositPaid, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="font-medium">Remaining</span>
                <span className="font-semibold">
                  {formatCurrency(order.totalAmount - (order.depositPaid || 0), order.currency)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount Charged *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => {
                    // Limit to 2 decimal places
                    const value = e.target.value
                    const parts = value.split('.')
                    if (parts[1] && parts[1].length > 2) {
                      setPaymentAmount(parseFloat(value).toFixed(2))
                    } else {
                      setPaymentAmount(value)
                    }
                  }}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="CARD">Credit/Debit Card</option>
                <option value="CHECK">Check</option>
                <option value="WIRE">Wire Transfer</option>
                <option value="ACH">ACH</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Reference/Confirmation # (optional)</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID, check number, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentChargedBy">Processed By (optional)</Label>
              <Input
                id="paymentChargedBy"
                value={paymentChargedBy}
                onChange={(e) => setPaymentChargedBy(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (optional)</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
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
              onClick={() => handleAction('record_payment', {
                amount: parseFloat(paymentAmount),
                method: paymentMethod,
                reference: paymentReference || undefined,
                notes: paymentNotes || undefined,
                chargedBy: paymentChargedBy || undefined
              })}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Record Payment
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
              Send a message to {safeOrganization.name}.
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
                <option value="RECEIPT">Payment Receipt</option>
                <option value="INVOICE">Invoice</option>
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

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewingDocument?.title || 'Document'}
            </DialogTitle>
            <DialogDescription>
              {viewingDocument?.type} • {viewingDocument?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-gray-100 rounded-lg">
            {viewingDocument && (
              viewingDocument.mimeType?.startsWith('image/') ||
              /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingDocument.fileName) ? (
                <img
                  src={viewingDocument.fileUrl}
                  alt={viewingDocument.title}
                  className="max-w-full h-auto mx-auto"
                />
              ) : viewingDocument.mimeType === 'application/pdf' ||
                /\.pdf$/i.test(viewingDocument.fileName) ? (
                <iframe
                  src={viewingDocument.fileUrl}
                  className="w-full h-[70vh] border-0"
                  title={viewingDocument.title}
                />
              ) : null
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Close
            </Button>
            <Button asChild>
              <a href={viewingDocument?.fileUrl} target="_blank" rel="noopener noreferrer" download>
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
