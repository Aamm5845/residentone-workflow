'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  Edit,
  Send,
  XCircle,
  RefreshCw,
  FileDown,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import SendPODialog from './SendPODialog'

interface OrderItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  ffeItemId?: string
  ffeItem?: {
    id: string
    name: string
  }
}

interface Delivery {
  id: string
  status: string
  scheduledDate?: string
  actualDate?: string
  trackingNumber?: string
  carrier?: string
  notes?: string
  createdAt: string
}

interface OrderActivity {
  id: string
  action: string
  details?: string
  createdAt: string
  user?: {
    name: string
  }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  shippingCost: number
  tax: number
  notes?: string
  shippingAddress?: string
  trackingNumber?: string
  expectedDelivery?: string
  createdAt: string
  updatedAt: string
  supplier: {
    id: string
    name: string
    email?: string
    phone?: string
    address?: string
  }
  supplierQuote?: {
    id: string
    quoteNumber?: string
    rfq?: {
      id: string
      rfqNumber: string
      project?: {
        id: string
        name: string
      }
    }
  }
  clientQuote?: {
    id: string
    quoteNumber: string
  }
  items: OrderItem[]
  deliveries: Delivery[]
  activities: OrderActivity[]
}

interface OrderDetailViewProps {
  orderId: string
  user: {
    id: string
    name: string
    role: string
  }
  orgId: string
}

const ORDER_STATUSES = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  { value: 'PROCESSING', label: 'Processing', color: 'bg-indigo-100 text-indigo-700', icon: RefreshCw },
  { value: 'SHIPPED', label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-700', icon: Package },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle }
]

export default function OrderDetailView({ orderId, user, orgId }: OrderDetailViewProps) {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showAddDelivery, setShowAddDelivery] = useState(false)
  const [showUpdateTracking, setShowUpdateTracking] = useState(false)
  const [showSendPO, setShowSendPO] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch order')
      }
      const data = await response.json()
      setOrder(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      await fetchOrder()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const updateTracking = async (trackingNumber: string, expectedDelivery?: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateTracking',
          trackingNumber,
          expectedDelivery
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update tracking')
      }

      setShowUpdateTracking(false)
      await fetchOrder()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tracking')
    } finally {
      setUpdating(false)
    }
  }

  const addDelivery = async (deliveryData: {
    scheduledDate?: string
    trackingNumber?: string
    carrier?: string
    notes?: string
  }) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addDelivery',
          ...deliveryData
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add delivery')
      }

      setShowAddDelivery(false)
      await fetchOrder()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add delivery')
    } finally {
      setUpdating(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!order) return

    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/pdf`)
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

      toast.success('PDF downloaded successfully')
    } catch (err) {
      toast.error('Failed to download PDF')
    } finally {
      setDownloadingPDF(false)
    }
  }

  const getStatusConfig = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0]
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error || 'Order not found'}</span>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(order.status)
  const StatusIcon = statusConfig.icon
  const canEdit = user.role === 'ADMIN' || user.role === 'PRINCIPAL'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/procurement')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Order {order.orderNumber}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                <StatusIcon className="h-4 w-4" />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              Created {formatDate(order.createdAt)}
              {order.supplierQuote?.rfq?.project && (
                <span> • Project: {order.supplierQuote.rfq.project.name}</span>
              )}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {/* Download PDF - always available */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {downloadingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Download PDF
            </button>

            {/* Send PO - show if not already sent/ordered */}
            {order.status !== 'ORDERED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <button
                onClick={() => setShowSendPO(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4" />
                Send PO
              </button>
            )}

            {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
              <button
                onClick={() => setShowUpdateTracking(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Truck className="h-4 w-4" />
                Update Tracking
              </button>
            )}
            {order.status === 'DRAFT' && (
              <button
                onClick={() => updateOrderStatus('PENDING')}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit Order
              </button>
            )}
            {order.status === 'PENDING' && (
              <button
                onClick={() => updateOrderStatus('CONFIRMED')}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Order
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button
                onClick={() => updateOrderStatus('PROCESSING')}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Mark Processing
              </button>
            )}
            {order.status === 'PROCESSING' && (
              <button
                onClick={() => updateOrderStatus('SHIPPED')}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Truck className="h-4 w-4" />
                Mark Shipped
              </button>
            )}
            {order.status === 'SHIPPED' && (
              <button
                onClick={() => updateOrderStatus('DELIVERED')}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Package className="h-4 w-4" />
                Mark Delivered
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.description}</div>
                        {item.notes && (
                          <div className="text-sm text-gray-500 mt-1">{item.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Subtotal</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(order.totalAmount - order.shippingCost - order.tax)}
                    </td>
                  </tr>
                  {order.shippingCost > 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Shipping</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(order.shippingCost)}
                      </td>
                    </tr>
                  )}
                  {order.tax > 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-600">Tax</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(order.tax)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="px-6 py-4 text-right text-base font-semibold text-gray-900">Total</td>
                    <td className="px-6 py-4 text-right text-lg font-bold text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tracking & Delivery */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tracking & Delivery</h2>
              {canEdit && (
                <button
                  onClick={() => setShowAddDelivery(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Delivery
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              {order.trackingNumber && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-sm text-blue-600 font-medium">Tracking Number</div>
                    <div className="text-blue-900 font-mono">{order.trackingNumber}</div>
                  </div>
                </div>
              )}

              {order.expectedDelivery && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-sm text-green-600 font-medium">Expected Delivery</div>
                    <div className="text-green-900">{formatDate(order.expectedDelivery)}</div>
                  </div>
                </div>
              )}

              {order.deliveries.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Delivery History</h3>
                  {order.deliveries.map((delivery) => (
                    <div key={delivery.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          delivery.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                          delivery.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {delivery.status}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(delivery.createdAt)}</span>
                      </div>
                      {delivery.carrier && (
                        <div className="text-sm text-gray-600">Carrier: {delivery.carrier}</div>
                      )}
                      {delivery.trackingNumber && (
                        <div className="text-sm text-gray-600 font-mono">Tracking: {delivery.trackingNumber}</div>
                      )}
                      {delivery.scheduledDate && (
                        <div className="text-sm text-gray-600">Scheduled: {formatDate(delivery.scheduledDate)}</div>
                      )}
                      {delivery.actualDate && (
                        <div className="text-sm text-green-600">Delivered: {formatDate(delivery.actualDate)}</div>
                      )}
                      {delivery.notes && (
                        <div className="text-sm text-gray-500 mt-2">{delivery.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No delivery information yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            </div>
            <div className="p-6">
              {order.activities.length > 0 ? (
                <div className="space-y-4">
                  {order.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.action}</span>
                          {activity.user && (
                            <span className="text-gray-500"> by {activity.user.name}</span>
                          )}
                        </p>
                        {activity.details && (
                          <p className="text-sm text-gray-500 mt-0.5">{activity.details}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">No activity recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              Supplier
            </h3>
            <div className="space-y-3">
              <div className="font-medium text-gray-900">{order.supplier.name}</div>
              {order.supplier.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${order.supplier.email}`} className="hover:text-blue-600">
                    {order.supplier.email}
                  </a>
                </div>
              )}
              {order.supplier.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  {order.supplier.phone}
                </div>
              )}
              {order.supplier.address && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  {order.supplier.address}
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-gray-400" />
                Shipping Address
              </h3>
              <p className="text-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
            </div>
          )}

          {/* Related Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Related Documents
            </h3>
            <div className="space-y-2">
              {order.supplierQuote?.rfq && (
                <a
                  href={`/procurement/rfq/${order.supplierQuote.rfq.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-700">RFQ {order.supplierQuote.rfq.rfqNumber}</span>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              )}
              {order.supplierQuote && (
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">
                    Supplier Quote {order.supplierQuote.quoteNumber || order.supplierQuote.id.slice(0, 8)}
                  </span>
                </div>
              )}
              {order.clientQuote && (
                <a
                  href={`/procurement/quote/${order.clientQuote.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-700">Client Quote {order.clientQuote.quoteNumber}</span>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              )}
            </div>
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <p className="text-gray-600 whitespace-pre-line">{order.notes}</p>
            </div>
          )}

          {/* Quick Actions */}
          {canEdit && order.status !== 'CANCELLED' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-2">
                {order.status !== 'DELIVERED' && (
                  <button
                    onClick={() => updateOrderStatus('CANCELLED')}
                    disabled={updating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update Tracking Modal */}
      {showUpdateTracking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Tracking Information</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const formData = new FormData(form)
                updateTracking(
                  formData.get('trackingNumber') as string,
                  formData.get('expectedDelivery') as string || undefined
                )
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  name="trackingNumber"
                  defaultValue={order.trackingNumber || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  name="expectedDelivery"
                  defaultValue={order.expectedDelivery?.split('T')[0] || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUpdateTracking(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Delivery Modal */}
      {showAddDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Delivery Record</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const formData = new FormData(form)
                addDelivery({
                  scheduledDate: formData.get('scheduledDate') as string || undefined,
                  trackingNumber: formData.get('trackingNumber') as string || undefined,
                  carrier: formData.get('carrier') as string || undefined,
                  notes: formData.get('notes') as string || undefined
                })
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier
                </label>
                <input
                  type="text"
                  name="carrier"
                  placeholder="e.g., UPS, FedEx, DHL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  name="trackingNumber"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Delivery Date
                </label>
                <input
                  type="date"
                  name="scheduledDate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDelivery(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Adding...' : 'Add Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send PO Dialog */}
      {order && (
        <SendPODialog
          open={showSendPO}
          onOpenChange={setShowSendPO}
          order={{
            id: order.id,
            orderNumber: order.orderNumber,
            vendorName: order.supplier?.name || 'Vendor',
            vendorEmail: order.supplier?.email,
            totalAmount: order.totalAmount,
            subtotal: order.totalAmount - order.shippingCost - order.tax,
            shippingCost: order.shippingCost,
            taxAmount: order.tax,
            currency: 'USD',
            shippingAddress: order.shippingAddress,
            expectedDelivery: order.expectedDelivery,
            items: order.items.map(item => ({
              id: item.id,
              name: item.description,
              description: item.notes,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
            }))
          }}
          onSuccess={() => {
            setShowSendPO(false)
            fetchOrder()
          }}
        />
      )}
    </div>
  )
}
