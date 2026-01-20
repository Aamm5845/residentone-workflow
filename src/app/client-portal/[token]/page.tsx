'use client'

import { useState, useEffect, use } from 'react'
import {
  Building2,
  Package,
  Truck,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  CreditCard,
  ChevronRight,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import toast, { Toaster } from 'react-hot-toast'
import dynamic from 'next/dynamic'

// Dynamically import Solo payment form (client-side only)
const SoloPaymentForm = dynamic(
  () => import('@/components/client-portal/SoloPaymentForm'),
  { ssr: false, loading: () => <div className="py-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div> }
)

interface ClientPortalPageProps {
  params: Promise<{ token: string }>
}

interface QuoteLineItem {
  id: string
  name: string
  description?: string
  quantity: number
  unitType: string
  price: number
  total: number
  category?: string
  // Product details
  images?: string[]
  thumbnailUrl?: string
  supplierLink?: string
  brand?: string
  modelNumber?: string
  sku?: string
  color?: string
  finish?: string
  material?: string
  leadTime?: string
  dimensions?: string
  width?: string
  height?: string
  depth?: string
}

interface Payment {
  id: string
  amount: number
  method: string
  status: string
  paidAt?: string
}

interface Quote {
  id: string
  quoteNumber: string
  title: string
  description?: string
  status: string
  subtotal: number
  taxAmount?: number
  totalAmount?: number
  validUntil?: string
  paymentTerms?: string
  depositRequired?: string
  depositAmount?: number
  createdAt: string
  lineItems: QuoteLineItem[]
  payments: Payment[]
  amountPaid: number
}

interface OrderItem {
  id: string
  name: string
  description?: string
  quantity: number
  unitType: string
}

interface Delivery {
  id: string
  status: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  scheduledDate?: string
  deliveredAt?: string
  notes?: string
}

interface Order {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  items: OrderItem[]
  deliveries: Delivery[]
}

interface PortalData {
  project: {
    id: string
    name: string
    projectNumber?: string
    status: string
  }
  client?: {
    name: string
    email: string
  }
  quotes: Quote[]
  orders: Order[]
  paymentSummary: {
    totalQuoted: number
    totalPaid: number
    totalPending: number
  }
}

export default function ClientPortalPage({ params }: ClientPortalPageProps) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PortalData | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [respondDialogOpen, setRespondDialogOpen] = useState(false)
  const [respondDecision, setRespondDecision] = useState<'approved' | 'rejected' | 'revision'>('approved')
  const [respondMessage, setRespondMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentQuote, setPaymentQuote] = useState<Quote | null>(null)

  useEffect(() => {
    loadPortalData()
  }, [token])

  const loadPortalData = async () => {
    try {
      const response = await fetch(`/api/client-portal/${token}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to load portal')
      }
    } catch (err) {
      setError('Failed to load portal')
    } finally {
      setLoading(false)
    }
  }

  const handleQuoteResponse = async () => {
    if (!selectedQuote) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/client-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_to_quote',
          quoteId: selectedQuote.id,
          decision: respondDecision,
          message: respondMessage
        })
      })

      if (response.ok) {
        toast.success(`Quote ${respondDecision}!`)
        setRespondDialogOpen(false)
        setSelectedQuote(null)
        setRespondMessage('')
        loadPortalData()
      } else {
        const err = await response.json()
        toast.error(err.error || 'Failed to submit response')
      }
    } catch (err) {
      toast.error('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      // Quote statuses
      SENT_TO_CLIENT: { color: 'bg-blue-100 text-blue-700', label: 'Awaiting Response' },
      CLIENT_REVIEWING: { color: 'bg-yellow-100 text-yellow-700', label: 'Under Review' },
      APPROVED: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-700', label: 'Declined' },
      REVISION_REQUESTED: { color: 'bg-orange-100 text-orange-700', label: 'Revision Requested' },
      // Order statuses
      CONFIRMED: { color: 'bg-blue-100 text-blue-700', label: 'Confirmed' },
      IN_PRODUCTION: { color: 'bg-purple-100 text-purple-700', label: 'In Production' },
      READY_TO_SHIP: { color: 'bg-cyan-100 text-cyan-700', label: 'Ready to Ship' },
      SHIPPED: { color: 'bg-indigo-100 text-indigo-700', label: 'Shipped' },
      DELIVERED: { color: 'bg-green-100 text-green-700', label: 'Delivered' },
      // Delivery statuses
      PENDING: { color: 'bg-gray-100 text-gray-700', label: 'Pending' },
      IN_TRANSIT: { color: 'bg-blue-100 text-blue-700', label: 'In Transit' },
      OUT_FOR_DELIVERY: { color: 'bg-cyan-100 text-cyan-700', label: 'Out for Delivery' }
    }

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: status }
    return <Badge className={config.color}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading your project portal...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">{error}</h2>
            <p className="text-gray-500">
              This link may have expired or is invalid.
              Please contact your designer for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const pendingQuotes = data.quotes.filter(q =>
    q.status === 'SENT_TO_CLIENT' || q.status === 'CLIENT_REVIEWING'
  )
  const activeDeliveries = data.orders.flatMap(o => o.deliveries).filter(d =>
    d.status !== 'DELIVERED'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-emerald-200 text-sm">Client Portal</p>
              <h1 className="text-2xl font-bold">{data.project.name}</h1>
            </div>
          </div>
          {data.project.projectNumber && (
            <p className="text-emerald-200">Project #{data.project.projectNumber}</p>
          )}
          {data.client && (
            <p className="mt-2 text-emerald-100">Welcome, {data.client.name}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-5xl mx-auto px-6 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Approved</p>
                  <p className="text-xl font-bold">{formatCurrency(data.paymentSummary.totalQuoted)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className="text-xl font-bold">{formatCurrency(data.paymentSummary.totalPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Balance Due</p>
                  <p className="text-xl font-bold">{formatCurrency(data.paymentSummary.totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {pendingQuotes.length > 0 && (
          <Card className="border-l-4 border-l-yellow-500 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">
                  {pendingQuotes.length} quote{pendingQuotes.length > 1 ? 's' : ''} awaiting your response
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeDeliveries.length > 0 && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  {activeDeliveries.length} delivery{activeDeliveries.length > 1 ? 'ies' : 'y'} in progress
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
        <Tabs defaultValue="quotes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Quotes ({data.quotes.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Orders ({data.orders.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Deliveries
            </TabsTrigger>
          </TabsList>

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            {data.quotes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No quotes yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.quotes.map(quote => (
                  <Card key={quote.id} className="overflow-hidden">
                    <CardHeader className="bg-gray-50 border-b">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{quote.title}</CardTitle>
                          <CardDescription>{quote.quoteNumber}</CardDescription>
                        </div>
                        {getStatusBadge(quote.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {/* Line Items */}
                      <div className="space-y-4 mb-6">
                        {quote.lineItems.slice(0, 5).map(item => (
                          <div key={item.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                            <div className="flex gap-4">
                              {/* Product Image */}
                              <div className="flex-shrink-0 w-20 h-20 relative rounded-lg overflow-hidden bg-gray-100">
                                {item.thumbnailUrl || (item.images && item.images[0]) ? (
                                  <Image
                                    src={item.thumbnailUrl || item.images?.[0] || ''}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Package className="w-8 h-8" />
                                  </div>
                                )}
                              </div>

                              {/* Product Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <p className="font-medium text-gray-900">{item.name}</p>
                                  <p className="font-semibold text-emerald-600 whitespace-nowrap">{formatCurrency(item.total)}</p>
                                </div>

                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                                )}

                                {/* Product Specs */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {item.brand && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      {item.brand}
                                    </span>
                                  )}
                                  {item.color && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      {item.color}
                                    </span>
                                  )}
                                  {item.material && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      {item.material}
                                    </span>
                                  )}
                                  {item.finish && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      {item.finish}
                                    </span>
                                  )}
                                  {(item.width || item.height || item.depth || item.dimensions) && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                      {item.dimensions || `${item.width || ''}${item.height ? ` × ${item.height}` : ''}${item.depth ? ` × ${item.depth}` : ''}`}
                                    </span>
                                  )}
                                </div>

                                {/* Quantity and Link */}
                                <div className="flex items-center justify-between mt-2">
                                  <p className="text-sm text-gray-500">
                                    Qty: {item.quantity} {item.unitType}
                                    {item.leadTime && <span className="ml-2">• Lead time: {item.leadTime}</span>}
                                  </p>
                                  {item.supplierLink && (
                                    <a
                                      href={item.supplierLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      View Product
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {quote.lineItems.length > 5 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            + {quote.lineItems.length - 5} more items
                          </p>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span>{formatCurrency(quote.subtotal)}</span>
                        </div>
                        {quote.taxAmount && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tax</span>
                            <span>{formatCurrency(quote.taxAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Total</span>
                          <span className="text-emerald-600">
                            {formatCurrency(quote.totalAmount || quote.subtotal)}
                          </span>
                        </div>
                        {quote.amountPaid > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Paid</span>
                            <span>- {formatCurrency(quote.amountPaid)}</span>
                          </div>
                        )}
                        {quote.depositRequired && quote.depositAmount && (
                          <div className="flex justify-between text-orange-600 text-sm">
                            <span>Deposit Required</span>
                            <span>{formatCurrency(quote.depositAmount)}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {(quote.status === 'SENT_TO_CLIENT' || quote.status === 'CLIENT_REVIEWING') && (
                        <div className="mt-6 flex gap-3">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                              setSelectedQuote(quote)
                              setRespondDecision('approved')
                              setRespondDialogOpen(true)
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve Quote
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedQuote(quote)
                              setRespondDecision('revision')
                              setRespondDialogOpen(true)
                            }}
                          >
                            Request Changes
                          </Button>
                        </div>
                      )}

                      {quote.status === 'APPROVED' && quote.amountPaid < (quote.totalAmount || quote.subtotal) && (
                        <div className="mt-6">
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              setPaymentQuote(quote)
                              setPaymentDialogOpen(true)
                            }}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Make Payment ({formatCurrency((quote.totalAmount || quote.subtotal) - quote.amountPaid)} due)
                          </Button>
                        </div>
                      )}

                      {quote.validUntil && (
                        <p className="mt-4 text-sm text-gray-500 text-center">
                          Valid until {formatDate(quote.validUntil)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            {data.orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No orders yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Orders will appear here once quotes are approved and payment is received
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.orders.map(order => (
                  <Card key={order.id}>
                    <CardHeader className="bg-gray-50 border-b">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <CardDescription>
                            Ordered {formatDate(order.createdAt)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {/* Order Items */}
                      <div className="space-y-2 mb-4">
                        {order.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
                            <Package className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-gray-500">{item.description}</p>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {item.quantity} {item.unitType}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Deliveries */}
                      {order.deliveries.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Delivery Information
                          </h4>
                          {order.deliveries.map(delivery => (
                            <div key={delivery.id} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                {getStatusBadge(delivery.status)}
                                {delivery.carrier && (
                                  <span className="text-sm text-gray-500">{delivery.carrier}</span>
                                )}
                              </div>
                              {delivery.trackingNumber && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-sm text-gray-500">Tracking:</span>
                                  {delivery.trackingUrl ? (
                                    <a
                                      href={delivery.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      {delivery.trackingNumber}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="font-mono">{delivery.trackingNumber}</span>
                                  )}
                                </div>
                              )}
                              {delivery.scheduledDate && !delivery.deliveredAt && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                  <Calendar className="w-4 h-4" />
                                  Expected: {formatDate(delivery.scheduledDate)}
                                </div>
                              )}
                              {delivery.deliveredAt && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                                  <CheckCircle className="w-4 h-4" />
                                  Delivered: {formatDate(delivery.deliveredAt)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Deliveries Tab */}
          <TabsContent value="deliveries">
            {data.orders.flatMap(o => o.deliveries).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No deliveries yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.orders.flatMap(order =>
                  order.deliveries.map(delivery => (
                    <Card key={delivery.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="font-medium">Order {order.orderNumber}</p>
                            <p className="text-sm text-gray-500">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          {getStatusBadge(delivery.status)}
                        </div>

                        {delivery.carrier && (
                          <div className="flex items-center gap-2 mb-2">
                            <Truck className="w-4 h-4 text-gray-400" />
                            <span>{delivery.carrier}</span>
                          </div>
                        )}

                        {delivery.trackingNumber && (
                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-500 mb-1">Tracking Number</p>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg">{delivery.trackingNumber}</span>
                              {delivery.trackingUrl && (
                                <a
                                  href={delivery.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          {delivery.scheduledDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Expected: {formatDate(delivery.scheduledDate)}
                            </div>
                          )}
                          {delivery.deliveredAt && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Delivered: {formatDate(delivery.deliveredAt)}
                            </div>
                          )}
                        </div>

                        {delivery.trackingUrl && (
                          <Button
                            variant="outline"
                            className="w-full mt-4"
                            onClick={() => window.open(delivery.trackingUrl, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Track Package
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Quote Response Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondDecision === 'approved' && 'Approve Quote'}
              {respondDecision === 'rejected' && 'Decline Quote'}
              {respondDecision === 'revision' && 'Request Revision'}
            </DialogTitle>
            <DialogDescription>
              {selectedQuote?.quoteNumber} - {selectedQuote?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {respondDecision === 'approved' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-green-800">
                  Total: {selectedQuote && formatCurrency(selectedQuote.totalAmount || selectedQuote.subtotal)}
                </p>
                {selectedQuote?.depositRequired && selectedQuote?.depositAmount && (
                  <p className="text-sm text-green-600 mt-1">
                    Deposit of {formatCurrency(selectedQuote.depositAmount)} required to proceed
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {respondDecision === 'revision'
                    ? 'What changes would you like?'
                    : 'Reason for declining (optional)'}
                </label>
                <Textarea
                  value={respondMessage}
                  onChange={(e) => setRespondMessage(e.target.value)}
                  placeholder={
                    respondDecision === 'revision'
                      ? 'Please describe the changes you need...'
                      : 'Let us know why...'
                  }
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRespondDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleQuoteResponse}
              disabled={submitting}
              className={
                respondDecision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : respondDecision === 'rejected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {respondDecision === 'approved' && 'Approve Quote'}
              {respondDecision === 'rejected' && 'Decline Quote'}
              {respondDecision === 'revision' && 'Request Revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              {paymentQuote?.quoteNumber} - {paymentQuote?.title}
            </DialogDescription>
          </DialogHeader>

          {paymentQuote && (
            <SoloPaymentForm
              token={token}
              quoteId={paymentQuote.id}
              amount={(paymentQuote.totalAmount || paymentQuote.subtotal) - paymentQuote.amountPaid}
              onSuccess={() => {
                setPaymentDialogOpen(false)
                setPaymentQuote(null)
                toast.success('Payment successful!')
                loadPortalData()
              }}
              onCancel={() => {
                setPaymentDialogOpen(false)
                setPaymentQuote(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="bg-gray-100 border-t py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>Powered by Meisner Interiors</p>
          <p className="mt-1">Questions? Contact your project designer</p>
        </div>
      </div>
    </div>
  )
}
