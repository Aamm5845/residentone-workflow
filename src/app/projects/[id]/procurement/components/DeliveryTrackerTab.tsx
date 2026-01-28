'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  List,
  ExternalLink,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Factory,
  Timer
} from 'lucide-react'
import { toast } from 'sonner'
import OrderDetailSheet from './OrderDetailSheet'

interface DeliveryTrackerTabProps {
  projectId: string
  searchQuery: string
}

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  expectedDelivery: string | null
  actualDelivery: string | null
  trackingNumber: string | null
  shippingCarrier: string | null
  createdAt: string
  orderedAt: string | null
  supplierPaidAt: string | null
  supplierPaymentAmount: number | null
  supplier: {
    id: string
    name: string
    email: string | null
  }
  _count: {
    items: number
  }
}

interface TrackingInfo {
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
}

// Map order statuses to delivery tracker columns
// Orders with payment but not shipped go to IN_PRODUCTION
const mapStatusToColumn = (order: Order): 'ORDERED' | 'IN_PRODUCTION' | 'IN_TRANSIT' | 'DELIVERED' => {
  const status = order.status
  const hasPayment = order.supplierPaymentAmount && order.supplierPaymentAmount > 0

  switch (status) {
    case 'SHIPPED':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT'
    case 'DELIVERED':
    case 'COMPLETED':
    case 'INSTALLED':
      return 'DELIVERED'
    case 'ORDERED':
    case 'CONFIRMED':
    case 'PAYMENT_RECEIVED':
      // If payment was made, it's in production
      return hasPayment ? 'IN_PRODUCTION' : 'ORDERED'
    case 'PENDING_PAYMENT':
      return 'ORDERED'
    default:
      return hasPayment ? 'IN_PRODUCTION' : 'ORDERED'
  }
}

// Calculate days since first payment
const getDaysInProduction = (order: Order): number | null => {
  if (!order.supplierPaidAt) return null
  const paymentDate = new Date(order.supplierPaidAt)
  const now = new Date()
  const diffTime = now.getTime() - paymentDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

const statusConfig = {
  ORDERED: {
    label: 'Ordered',
    color: 'text-gray-600',
    bgLight: 'bg-gray-50',
    bgDark: 'bg-gray-100',
    icon: Clock,
  },
  IN_PRODUCTION: {
    label: 'In Production',
    color: 'text-amber-600',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-100',
    icon: Factory,
  },
  IN_TRANSIT: {
    label: 'In Transit',
    color: 'text-blue-600',
    bgLight: 'bg-blue-50',
    bgDark: 'bg-blue-100',
    icon: Truck,
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    bgDark: 'bg-emerald-100',
    icon: CheckCircle2,
  },
}

const columns = ['ORDERED', 'IN_PRODUCTION', 'IN_TRANSIT', 'DELIVERED'] as const

export default function DeliveryTrackerTab({ projectId, searchQuery }: DeliveryTrackerTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Tracking info cache
  const [trackingCache, setTrackingCache] = useState<Record<string, TrackingInfo>>({})
  const [loadingTracking, setLoadingTracking] = useState<Record<string, boolean>>({})
  const [expandedTracking, setExpandedTracking] = useState<string | null>(null)

  // Order detail sheet
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Tracking dialog
  const [showTrackingDialog, setShowTrackingDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newTrackingNumber, setNewTrackingNumber] = useState('')
  const [newCarrier, setNewCarrier] = useState('')
  const [savingTracking, setSavingTracking] = useState(false)
  const [dialogTrackingInfo, setDialogTrackingInfo] = useState<TrackingInfo | null>(null)
  const [fetchingDialogTracking, setFetchingDialogTracking] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()

      // Filter to only show orders that are in shipping flow (not drafts, not cancelled)
      const shippingOrders = data.orders.filter((order: Order) =>
        ['ORDERED', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'PAYMENT_RECEIVED'].includes(order.status)
      )

      setOrders(shippingOrders)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      toast.error('Failed to load deliveries')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Fetch tracking info for an order
  const fetchTrackingInfo = async (trackingNumber: string, orderId?: string) => {
    if (!trackingNumber) return null

    if (orderId) {
      setLoadingTracking(prev => ({ ...prev, [orderId]: true }))
    }

    try {
      const res = await fetch(`/api/tracking/${encodeURIComponent(trackingNumber)}`)
      if (!res.ok) throw new Error('Failed to fetch tracking')
      const data = await res.json()

      if (orderId) {
        setTrackingCache(prev => ({ ...prev, [orderId]: data }))
      }

      return data
    } catch (error) {
      console.error('Failed to fetch tracking:', error)
      return { success: false, error: 'Failed to fetch tracking info' }
    } finally {
      if (orderId) {
        setLoadingTracking(prev => ({ ...prev, [orderId]: false }))
      }
    }
  }

  // Auto-fetch tracking for orders with tracking numbers
  useEffect(() => {
    orders.forEach(order => {
      if (order.trackingNumber && !trackingCache[order.id] && !loadingTracking[order.id]) {
        fetchTrackingInfo(order.trackingNumber, order.id)
      }
    })
  }, [orders])

  // Debounced tracking lookup in dialog
  useEffect(() => {
    if (!showTrackingDialog || !newTrackingNumber.trim()) {
      setDialogTrackingInfo(null)
      return
    }

    if (newTrackingNumber.trim().length < 8) return

    const timer = setTimeout(async () => {
      setFetchingDialogTracking(true)
      const info = await fetchTrackingInfo(newTrackingNumber)
      setDialogTrackingInfo(info)
      // Auto-set carrier if detected
      if (info?.success && info.carrierName) {
        setNewCarrier(info.carrierName)
      }
      setFetchingDialogTracking(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [newTrackingNumber, showTrackingDialog])

  const handleRefresh = () => {
    setRefreshing(true)
    setTrackingCache({})
    fetchOrders()
  }

  const handleUpdateTracking = async () => {
    if (!selectedOrder) return

    setSavingTracking(true)
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: newTrackingNumber.trim() || null,
          shippingCarrier: newCarrier.trim() || null,
          status: newTrackingNumber.trim() ? 'SHIPPED' : selectedOrder.status
        })
      })

      if (!res.ok) throw new Error('Failed to update tracking')

      toast.success('Tracking updated')
      setShowTrackingDialog(false)
      fetchOrders()
    } catch (error) {
      toast.error('Failed to update tracking')
    } finally {
      setSavingTracking(false)
    }
  }

  const handleMarkDelivered = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERED',
          actualDelivery: new Date().toISOString()
        })
      })

      if (!res.ok) throw new Error('Failed to update')

      toast.success('Marked as delivered')
      fetchOrders()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const openTrackingDialog = (order: Order) => {
    setSelectedOrder(order)
    setNewTrackingNumber(order.trackingNumber || '')
    setNewCarrier(order.shippingCarrier || '')
    setDialogTrackingInfo(null)
    setShowTrackingDialog(true)
  }

  // Filter orders based on search
  const filteredOrders = orders.filter(order =>
    !searchQuery ||
    order.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group orders by column status
  const groupedOrders = columns.reduce((acc, column) => {
    acc[column] = filteredOrders.filter(order => mapStatusToColumn(order) === column)
    return acc
  }, {} as Record<typeof columns[number], Order[]>)

  const formatDate = (date: string | null) => {
    if (!date) return 'TBD'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} to track
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-gray-600"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="border-gray-200 border-dashed">
          <CardContent className="py-20">
            <div className="text-center max-w-sm mx-auto">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No deliveries to track
              </h3>
              <p className="text-sm text-gray-500">
                Deliveries will appear here when orders are placed with suppliers
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-4 gap-4">
          {columns.map((column) => {
            const config = statusConfig[column]
            const Icon = config.icon
            const columnOrders = groupedOrders[column]

            return (
              <div key={column} className="flex flex-col min-h-[400px]">
                {/* Column Header */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 border-gray-200 ${config.bgLight}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  <span className="ml-auto text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Column Content */}
                <div className="flex-1 p-2 border border-gray-200 rounded-b-lg bg-gray-50/50 space-y-2 overflow-y-auto">
                  {columnOrders.map((order) => {
                    const tracking = trackingCache[order.id]
                    const isLoadingTracking = loadingTracking[order.id]
                    const isExpanded = expandedTracking === order.id

                    return (
                      <Card
                        key={order.id}
                        className="border-gray-200 bg-white hover:shadow-sm transition-shadow cursor-pointer"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {order.supplier.name}
                              </span>
                              <p className="text-xs text-gray-500 font-mono">
                                PO-{order.orderNumber}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>

                          <div className="text-xs text-gray-500 mb-2">
                            {order._count.items} item{order._count.items !== 1 ? 's' : ''} • {formatCurrency(order.totalAmount)}
                          </div>

                          {/* Days in Production */}
                          {column === 'IN_PRODUCTION' && (
                            <div className="flex items-center gap-1.5 bg-amber-50 rounded px-2 py-1 mb-2">
                              <Timer className="w-3 h-3 text-amber-600" />
                              <span className="text-xs font-medium text-amber-700">
                                {(() => {
                                  const days = getDaysInProduction(order)
                                  if (days === null) return 'Just started'
                                  if (days === 0) return 'Started today'
                                  if (days === 1) return '1 day in production'
                                  return `${days} days in production`
                                })()}
                              </span>
                            </div>
                          )}

                          {/* Tracking Info */}
                          {order.trackingNumber ? (
                            <div className="bg-blue-50 rounded p-2 mb-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {isLoadingTracking ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                  ) : (
                                    <Truck className="w-3 h-3 text-blue-600" />
                                  )}
                                  <span className="text-xs font-mono text-blue-700">
                                    {order.trackingNumber}
                                  </span>
                                </div>
                                {tracking?.success && tracking.status && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    tracking.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                    tracking.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {tracking.status.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              {tracking?.success && (
                                <>
                                  {tracking.statusDescription && (
                                    <p className="text-xs text-blue-600 mt-1">{tracking.statusDescription}</p>
                                  )}
                                  {tracking.estimatedDelivery && (
                                    <p className="text-xs text-blue-600 mt-0.5">
                                      ETA: {new Date(tracking.estimatedDelivery).toLocaleDateString()}
                                    </p>
                                  )}
                                  {tracking.events && tracking.events.length > 0 && (
                                    <button
                                      onClick={() => setExpandedTracking(isExpanded ? null : order.id)}
                                      className="flex items-center gap-1 text-xs text-blue-700 mt-1 hover:text-blue-900"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      {tracking.events.length} events
                                    </button>
                                  )}
                                  {isExpanded && tracking.events && (
                                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                      {tracking.events.slice(0, 5).map((event, idx) => (
                                        <div key={idx} className="flex gap-1.5 text-xs">
                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                                          <div>
                                            <p className="text-blue-900">{event.description}</p>
                                            <p className="text-blue-500 text-[10px]">
                                              {event.location && `${event.location} • `}
                                              {new Date(event.date).toLocaleDateString()}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                              <Calendar className="w-3 h-3" />
                              ETA: {formatDate(order.expectedDelivery)}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-1 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                            {column === 'ORDERED' && (
                              <span className="text-xs text-gray-400">
                                Awaiting payment
                              </span>
                            )}
                            {column === 'IN_PRODUCTION' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-blue-600"
                                onClick={() => openTrackingDialog(order)}
                              >
                                Add Tracking
                              </Button>
                            )}
                            {column === 'IN_TRANSIT' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-gray-600"
                                  onClick={() => openTrackingDialog(order)}
                                >
                                  Update
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-emerald-600"
                                  onClick={() => handleMarkDelivered(order)}
                                >
                                  Mark Delivered
                                </Button>
                              </>
                            )}
                            {column === 'DELIVERED' && order.actualDelivery && (
                              <span className="text-xs text-gray-500">
                                Delivered {formatDate(order.actualDelivery)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Order</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Supplier</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Items</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Tracking</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">ETA</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const column = mapStatusToColumn(order)
                  const config = statusConfig[column]
                  const tracking = trackingCache[order.id]
                  const daysInProduction = getDaysInProduction(order)

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td className="p-3 font-mono text-sm text-gray-900">PO-{order.orderNumber}</td>
                      <td className="p-3 font-medium text-gray-900">{order.supplier.name}</td>
                      <td className="p-3 text-gray-600">{order._count.items}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge className={`${config.bgLight} ${config.color} border-0`}>
                            {tracking?.status ? tracking.status.replace(/_/g, ' ') : config.label}
                          </Badge>
                          {column === 'IN_PRODUCTION' && daysInProduction !== null && (
                            <span className="text-xs text-amber-600">
                              {daysInProduction}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {order.trackingNumber ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-600">{order.trackingNumber}</span>
                            {tracking?.success && tracking.carrierName && (
                              <span className="text-xs text-gray-400">({tracking.carrierName})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600">
                        {tracking?.estimatedDelivery
                          ? formatDate(tracking.estimatedDelivery)
                          : formatDate(order.expectedDelivery)
                        }
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {(column === 'IN_PRODUCTION' || column === 'IN_TRANSIT') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-gray-300"
                              onClick={() => openTrackingDialog(order)}
                            >
                              {order.trackingNumber ? 'Update' : 'Add Tracking'}
                            </Button>
                          )}
                          {column === 'IN_TRANSIT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-emerald-300 text-emerald-600"
                              onClick={() => handleMarkDelivered(order)}
                            >
                              Delivered
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedOrder?.trackingNumber ? 'Update Tracking' : 'Add Tracking'}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <>PO-{selectedOrder.orderNumber} • {selectedOrder.supplier.name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <div className="relative">
                <Input
                  id="trackingNumber"
                  value={newTrackingNumber}
                  onChange={(e) => setNewTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="pr-10"
                />
                {fetchingDialogTracking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Tracking info loads automatically</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                placeholder="e.g., UPS, FedEx, Canada Post"
              />
            </div>

            {/* Tracking Info Display */}
            {dialogTrackingInfo && (
              <div className={`rounded-lg border p-3 text-sm ${
                dialogTrackingInfo.success ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                {dialogTrackingInfo.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-800">
                        {dialogTrackingInfo.carrierName || 'Carrier detected'}
                      </span>
                      {dialogTrackingInfo.status && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          dialogTrackingInfo.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                          dialogTrackingInfo.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {dialogTrackingInfo.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {dialogTrackingInfo.statusDescription && (
                      <p className="text-blue-700">{dialogTrackingInfo.statusDescription}</p>
                    )}
                    {dialogTrackingInfo.estimatedDelivery && (
                      <p className="text-blue-600">
                        Est. Delivery: {new Date(dialogTrackingInfo.estimatedDelivery).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-yellow-800">
                    {dialogTrackingInfo.error || 'Tracking info not yet available'}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTracking} disabled={savingTracking}>
              {savingTracking ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        orderId={selectedOrderId}
        onUpdate={fetchOrders}
      />
    </div>
  )
}
