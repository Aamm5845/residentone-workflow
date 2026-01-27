'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Package,
  Truck,
  DollarSign,
  Eye,
  FileText,
  RefreshCw,
  Send,
  MoreHorizontal,
  Check,
  Loader2,
  ExternalLink,
  CreditCard,
  Building2,
  XCircle,
  Clock,
  ShoppingCart,
  Store,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react'
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
import { toast } from 'sonner'
import CreatePODialog from './CreatePODialog'
import OrderDetailSheet from './OrderDetailSheet'
import SendPODialog from '@/components/procurement/SendPODialog'

interface OrdersTabProps {
  projectId: string
  searchQuery: string
}

// Ready to order types
interface ItemComponent {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
  imageUrl: string | null
}

interface ReadyToOrderItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  categoryName: string | null
  quantity: number
  imageUrl: string | null
  specStatus: string
  paymentStatus: string
  paidAt: string | null
  paidAmount: number | null
  tradePrice: number | null
  tradePriceCurrency: string | null
  hasSupplierQuote: boolean
  supplierQuote: {
    id: string
    supplierId: string | null
    supplierName: string
    supplierEmail: string | null
    unitPrice: number
    totalPrice: number
    leadTimeWeeks: number | null
    isAccepted: boolean
  } | null
  clientInvoice: {
    id: string
    quoteNumber: string
    title: string | null
    paidAt: string | null
    clientUnitPrice: number
    clientTotalPrice: number
  } | null
  components: ItemComponent[]
}

interface SupplierGroup {
  supplierId: string | null
  supplierName: string
  supplierEmail: string | null
  supplierLogo: string | null
  items: ReadyToOrderItem[]
  totalCost: number
  itemCount: number
  totalItemCount: number
  currency: string
}

interface ReadyToOrderData {
  project: {
    id: string
    name: string
    defaultShippingAddress?: string
    client?: {
      name: string
      email: string
      phone: string | null
    } | null
  }
  summary: {
    totalItems: number
    totalItemsWithComponents: number
    supplierCount: number
    totalCost: number
  }
  supplierGroups: SupplierGroup[]
  itemsWithoutQuotes: ReadyToOrderItem[]
}

interface Order {
  id: string
  orderNumber: string
  status: string
  supplierId: string | null
  vendorName: string | null
  vendorEmail: string | null
  subtotal: number | null
  taxAmount: number | null
  shippingCost: number | null
  totalAmount: number | null
  currency: string
  orderedAt: string | null
  confirmedAt: string | null
  expectedDelivery: string | null
  actualDelivery: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shippingCarrier: string | null
  supplierPaidAt: string | null
  supplierPaymentMethod: string | null
  supplierPaymentAmount: number | null
  notes: string | null
  createdAt: string
  project: {
    id: string
    name: string
  }
  supplier: {
    id: string
    name: string
    email: string | null
  } | null
  createdBy: {
    id: string
    name: string
  }
  _count: {
    items: number
    deliveries: number
  }
  paymentSummary?: {
    totalAmount: number
    depositRequired: number
    depositPaid: number
    supplierPaymentAmount: number
    remainingBalance: number
    paymentStatus: 'NOT_STARTED' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'OVERPAID'
  }
}

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-600' },
  PAYMENT_RECEIVED: { label: 'Ready to Send', color: 'bg-blue-50 text-blue-700' },
  ORDERED: { label: 'Sent', color: 'bg-purple-50 text-purple-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700' },
  IN_PRODUCTION: { label: 'In Production', color: 'bg-amber-50 text-amber-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-50 text-cyan-700' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-sky-50 text-sky-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700' },
  INSTALLED: { label: 'Installed', color: 'bg-green-50 text-green-700' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-700' },
  RETURNED: { label: 'Returned', color: 'bg-orange-50 text-orange-700' },
}

// Stats interface for summary cards
interface OrderStats {
  total: number
  totalValue: number
  inProgress: number         // Active orders (not delivered/cancelled)
  inProgressValue: number
  shipped: number            // SHIPPED or IN_TRANSIT
  shippedValue: number
  delivered: number          // DELIVERED, INSTALLED, COMPLETED
  deliveredValue: number
  supplierPaid: number       // Orders where supplier has been paid
  supplierPaidValue: number
  supplierUnpaid: number     // Orders where supplier hasn't been paid
  supplierUnpaidValue: number
}

const paymentMethods = [
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'WIRE_TRANSFER', label: 'Wire Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'ACH_BANK_TRANSFER', label: 'ACH Bank Transfer' },
  { value: 'E_TRANSFER', label: 'Interac e-Transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' }
]

export default function OrdersTab({ projectId, searchQuery }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // Calculate stats from orders
  const stats: OrderStats = orders.reduce((acc, order) => {
    const orderValue = order.totalAmount || 0
    const isCancelled = order.status === 'CANCELLED' || order.status === 'RETURNED'

    if (!isCancelled) {
      acc.total++
      acc.totalValue += orderValue
    }

    // Fulfillment status counts
    const isDelivered = order.status === 'DELIVERED' || order.status === 'INSTALLED' || order.status === 'COMPLETED'
    const isShipped = order.status === 'SHIPPED' || order.status === 'IN_TRANSIT'

    if (isDelivered) {
      acc.delivered++
      acc.deliveredValue += orderValue
    } else if (isShipped) {
      acc.shipped++
      acc.shippedValue += orderValue
    } else if (!isCancelled) {
      // In progress = everything else (PAYMENT_RECEIVED, ORDERED, CONFIRMED, IN_PRODUCTION)
      acc.inProgress++
      acc.inProgressValue += orderValue
    }

    // Supplier payment tracking - use paymentSummary for accurate tracking
    if (!isCancelled) {
      const paymentStatus = order.paymentSummary?.paymentStatus || 'NOT_STARTED'
      const remainingBalance = order.paymentSummary?.remainingBalance ?? orderValue

      if (paymentStatus === 'FULLY_PAID' || paymentStatus === 'OVERPAID') {
        acc.supplierPaid++
        acc.supplierPaidValue += order.paymentSummary?.supplierPaymentAmount || orderValue
      } else {
        // NOT_STARTED or DEPOSIT_PAID = still has unpaid balance
        acc.supplierUnpaid++
        acc.supplierUnpaidValue += remainingBalance
      }
    }

    return acc
  }, {
    total: 0,
    totalValue: 0,
    inProgress: 0,
    inProgressValue: 0,
    shipped: 0,
    shippedValue: 0,
    delivered: 0,
    deliveredValue: 0,
    supplierPaid: 0,
    supplierPaidValue: 0,
    supplierUnpaid: 0,
    supplierUnpaidValue: 0
  } as OrderStats)

  // Ready to order state
  const [readyToOrder, setReadyToOrder] = useState<ReadyToOrderData | null>(null)
  const [loadingReadyToOrder, setLoadingReadyToOrder] = useState(true)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())

  // Create PO dialog
  const [createPODialogOpen, setCreatePODialogOpen] = useState(false)
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<{ id: string; name: string; email: string | null } | null>(null)

  // Suppliers list for manual PO dropdown
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; email: string | null }>>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)

  // Order details dialog
  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Send PO dialog state
  const [showSendPO, setShowSendPO] = useState(false)

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMethod: '',
    paymentAmount: '',
    paymentRef: '',
    paymentNotes: ''
  })

  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false)
  const [addingTracking, setAddingTracking] = useState(false)
  const [trackingFormData, setTrackingFormData] = useState({
    trackingNumber: '',
    carrier: '',
    trackingUrl: ''
  })

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/orders?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchReadyToOrder = useCallback(async () => {
    try {
      setLoadingReadyToOrder(true)
      const res = await fetch(`/api/projects/${projectId}/procurement/orders/ready-to-order`)
      if (!res.ok) throw new Error('Failed to fetch ready to order items')
      const data = await res.json()
      setReadyToOrder(data)
      // Keep suppliers collapsed by default (empty set)
      setExpandedSuppliers(new Set())
    } catch (error) {
      console.error('Error fetching ready to order:', error)
    } finally {
      setLoadingReadyToOrder(false)
    }
  }, [projectId])

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoadingSuppliers(true)
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoadingSuppliers(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchReadyToOrder()
    fetchSuppliers()
  }, [fetchOrders, fetchReadyToOrder, fetchSuppliers])

  const toggleSupplierExpand = (supplierId: string) => {
    setExpandedSuppliers(prev => {
      const next = new Set(prev)
      if (next.has(supplierId)) {
        next.delete(supplierId)
      } else {
        next.add(supplierId)
      }
      return next
    })
  }

  // Open Create PO dialog for a supplier
  const handleOpenCreatePO = (supplier: { id: string; name: string; email: string | null }) => {
    setSelectedSupplierForPO(supplier)
    setCreatePODialogOpen(true)
  }

  const handlePOCreated = () => {
    fetchOrders()
    fetchReadyToOrder()
  }

  // Filter orders based on search
  // Filter orders based on search and status filter
  const filteredOrders = orders.filter(order => {
    // Search filter
    const matchesSearch = !searchQuery ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.supplier?.name || order.vendorName || '').toLowerCase().includes(searchQuery.toLowerCase())

    // Status filter
    let matchesStatus = true
    if (filterStatus) {
      const isCancelled = order.status === 'CANCELLED' || order.status === 'RETURNED'
      const isDelivered = order.status === 'DELIVERED' || order.status === 'INSTALLED' || order.status === 'COMPLETED'
      const paymentStatus = order.paymentSummary?.paymentStatus || 'NOT_STARTED'
      const isFullyPaid = paymentStatus === 'FULLY_PAID' || paymentStatus === 'OVERPAID'

      if (filterStatus === 'IN_PROGRESS') {
        // Everything that's not delivered or cancelled (includes shipped)
        matchesStatus = !isCancelled && !isDelivered
      } else if (filterStatus === 'DELIVERED') {
        matchesStatus = isDelivered
      } else if (filterStatus === 'SUPPLIER_PAID') {
        matchesStatus = isFullyPaid && !isCancelled
      } else if (filterStatus === 'SUPPLIER_UNPAID') {
        // Not fully paid = NOT_STARTED or DEPOSIT_PAID
        matchesStatus = !isFullyPaid && !isCancelled
      } else {
        matchesStatus = order.status === filterStatus
      }
    }

    return matchesSearch && matchesStatus
  })

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    // Always use CAD format for consistent "$" symbol (not "US$")
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateStr))
  }

  // Send PO handler - opens the shared SendPODialog
  const handleOpenSendPO = (order: Order) => {
    setSelectedOrder(order)
    setShowSendPO(true)
  }

  // Record payment handlers
  const handleOpenPaymentDialog = (order: Order) => {
    setSelectedOrder(order)
    setPaymentFormData({
      paymentMethod: '',
      paymentAmount: order.totalAmount?.toString() || '',
      paymentRef: '',
      paymentNotes: ''
    })
    setPaymentDialogOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!selectedOrder) return

    if (!paymentFormData.paymentMethod) {
      toast.error('Payment method is required')
      return
    }

    try {
      setRecordingPayment(true)
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_supplier',
          paymentMethod: paymentFormData.paymentMethod,
          paymentAmount: parseFloat(paymentFormData.paymentAmount) || undefined,
          paymentRef: paymentFormData.paymentRef || undefined,
          paymentNotes: paymentFormData.paymentNotes || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record payment')
      }

      toast.success('Supplier payment recorded')
      setPaymentDialogOpen(false)
      fetchOrders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment')
    } finally {
      setRecordingPayment(false)
    }
  }

  // Add tracking handlers
  const handleOpenTrackingDialog = (order: Order) => {
    setSelectedOrder(order)
    setTrackingFormData({
      trackingNumber: order.trackingNumber || '',
      carrier: order.shippingCarrier || '',
      trackingUrl: order.trackingUrl || ''
    })
    setTrackingDialogOpen(true)
  }

  const handleAddTracking = async () => {
    if (!selectedOrder) return

    if (!trackingFormData.trackingNumber) {
      toast.error('Tracking number is required')
      return
    }

    try {
      setAddingTracking(true)
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_tracking',
          trackingNumber: trackingFormData.trackingNumber,
          carrier: trackingFormData.carrier || undefined,
          trackingUrl: trackingFormData.trackingUrl || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add tracking')
      }

      toast.success('Tracking information added')
      setTrackingDialogOpen(false)
      fetchOrders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add tracking')
    } finally {
      setAddingTracking(false)
    }
  }

  // Mark as delivered
  const handleMarkDelivered = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_delivered'
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to mark as delivered')
      }

      toast.success('Order marked as delivered')
      fetchOrders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark as delivered')
    }
  }

  // Delete order
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/orders/${orderToDelete.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete order')
      }

      toast.success('Order deleted - items returned to Ready to Order')
      setDeleteDialogOpen(false)
      setOrderToDelete(null)
      fetchOrders()
      fetchReadyToOrder()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete order')
    } finally {
      setDeleting(false)
    }
  }

  // Check if order can be deleted - allow all orders to be deleted
  const canDeleteOrder = (_order: Order) => {
    return true // Allow deleting any order regardless of status
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
      {/* Ready to Order Section */}
      {!loadingReadyToOrder && readyToOrder && readyToOrder.summary.totalItems > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
                Ready to Order
                <Badge className="bg-amber-100 text-amber-700 ml-2">
                  {readyToOrder.summary.totalItemsWithComponents || readyToOrder.summary.totalItems} items
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-gray-600"
                onClick={fetchReadyToOrder}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Items paid by client that need to be ordered from suppliers
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* All Suppliers - unified list */}
            <div className="space-y-2">
              {readyToOrder.supplierGroups.map((group, groupIndex) => {
                // Use a consistent key for expand/collapse
                const groupKey = group.supplierId || `name-${group.supplierName}`
                const isExpanded = expandedSuppliers.has(groupKey)

                // Flatten items and components into one list
                const allItems: any[] = []
                const currency = group.currency || 'CAD'
                group.items.forEach(item => {
                  allItems.push({ ...item, isComponent: false, currency })
                  // Add components as separate items
                  if (item.components && item.components.length > 0) {
                    item.components.forEach((comp: any) => {
                      allItems.push({
                        id: comp.id,
                        name: comp.name,
                        description: comp.modelNumber ? `Model: ${comp.modelNumber}` : null,
                        roomName: item.roomName,
                        quantity: comp.quantity || 1,
                        tradePrice: comp.price,
                        imageUrl: comp.imageUrl || null,
                        isComponent: true,
                        parentName: item.name,
                        currency
                      })
                    })
                  }
                })

                return (
                  <div key={groupKey} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <button
                        onClick={() => toggleSupplierExpand(groupKey)}
                        className="flex items-center gap-2 hover:bg-gray-50 rounded px-2 py-1 -ml-2"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        {group.supplierLogo ? (
                          <img
                            src={group.supplierLogo}
                            alt={group.supplierName}
                            className="w-6 h-6 object-contain rounded"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">
                            {group.supplierName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{group.supplierName}</span>
                        <Badge variant="outline" className="ml-2">
                          {allItems.length} item{allItems.length > 1 ? 's' : ''}
                        </Badge>
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(group.totalCost)}{group.currency === 'USD' ? ' USD' : ''}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleOpenCreatePO({
                            id: group.supplierId || '',
                            name: group.supplierName,
                            email: group.supplierEmail
                          })}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Create PO
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-3">
                        <div className="space-y-2">
                          {allItems.map((item, itemIndex) => (
                            <div
                              key={item.id || `item-${itemIndex}`}
                              className="flex items-center justify-between p-2 bg-white rounded border"
                            >
                              <div className="flex items-center gap-3">
                                {/* Item Image */}
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-10 h-10 object-cover rounded border"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium">
                                    {item.name}
                                    {item.isComponent && (
                                      <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        Component
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {item.roomName && <span>{item.roomName}</span>}
                                    <span>•</span>
                                    <span>Qty: {item.quantity}</span>
                                    {item.isComponent && item.parentName && (
                                      <>
                                        <span>•</span>
                                        <span>for {item.parentName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {formatCurrency(
                                    (item.supplierQuote?.unitPrice || item.tradePrice || 0) * (item.quantity || 1)
                                  )}{item.currency === 'USD' ? ' USD' : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

            </div>

            {/* Summary */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                Total: {readyToOrder.summary.totalItems} items from {readyToOrder.summary.supplierCount} supplier{readyToOrder.summary.supplierCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-medium text-gray-900">
                Est. Cost: {formatCurrency(readyToOrder.summary.totalCost || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Summary - Compact */}
      {orders.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
          {/* Total */}
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{stats.total} orders</span>
            <span className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totalValue)}</span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          {/* In Progress */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'IN_PROGRESS' ? null : 'IN_PROGRESS')}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${filterStatus === 'IN_PROGRESS' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-600">In Progress</span>
            <span className="text-sm font-semibold text-blue-600">{stats.inProgress + stats.shipped}</span>
          </button>
          <div className="h-4 w-px bg-gray-300" />
          {/* Delivered */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'DELIVERED' ? null : 'DELIVERED')}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${filterStatus === 'DELIVERED' ? 'bg-emerald-100' : 'hover:bg-gray-100'}`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-gray-600">Delivered</span>
            <span className="text-sm font-semibold text-emerald-600">{stats.delivered}</span>
          </button>
          <div className="h-4 w-px bg-gray-300" />
          {/* Supplier Payment */}
          <button
            onClick={() => setFilterStatus(filterStatus === 'SUPPLIER_UNPAID' ? null : 'SUPPLIER_UNPAID')}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${filterStatus === 'SUPPLIER_UNPAID' ? 'bg-amber-100' : 'hover:bg-gray-100'}`}
          >
            <DollarSign className={`w-4 h-4 ${stats.supplierUnpaid > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            <span className="text-sm text-gray-600">Unpaid</span>
            <span className={`text-sm font-semibold ${stats.supplierUnpaid > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {stats.supplierUnpaid} ({formatCurrency(stats.supplierUnpaidValue)})
            </span>
          </button>
        </div>
      )}

      {/* Orders Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-semibold">Purchase Orders</CardTitle>
              {filterStatus && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Filtered: {
                      filterStatus === 'IN_PROGRESS' ? 'In Progress' :
                      filterStatus === 'SHIPPED' ? 'Shipped' :
                      filterStatus === 'DELIVERED' ? 'Delivered' :
                      filterStatus === 'SUPPLIER_PAID' ? 'Paid to Supplier' :
                      filterStatus === 'SUPPLIER_UNPAID' ? 'Needs Payment' :
                      filterStatus
                    }
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setFilterStatus(null)}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Store className="w-4 h-4 mr-1" />
                    Create Manual PO
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
                  <div className="px-2 py-1.5 text-xs font-medium text-gray-500">
                    Select Supplier
                  </div>
                  <DropdownMenuSeparator />
                  {suppliers.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-gray-500">
                      No suppliers found
                    </div>
                  ) : (
                    suppliers.map(supplier => (
                      <DropdownMenuItem
                        key={supplier.id}
                        onClick={() => handleOpenCreatePO(supplier)}
                        className="flex flex-col items-start"
                      >
                        <span className="font-medium">{supplier.name}</span>
                        {supplier.email && (
                          <span className="text-xs text-gray-500">{supplier.email}</span>
                        )}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-gray-600"
                onClick={fetchOrders}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No orders yet</h3>
              <p className="text-sm text-gray-500">
                Orders will be created when client payments are received
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium">PO #</TableHead>
                  <TableHead className="text-gray-500 font-medium">Supplier</TableHead>
                  <TableHead className="text-gray-500 font-medium">Items</TableHead>
                  <TableHead className="text-gray-500 font-medium">Total</TableHead>
                  <TableHead className="text-gray-500 font-medium">Paid</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium">Payment</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const paymentStatus = order.paymentSummary?.paymentStatus || 'NOT_STARTED'
                  const paidAmount = order.paymentSummary?.supplierPaymentAmount || 0
                  const isFullyPaid = paymentStatus === 'FULLY_PAID' || paymentStatus === 'OVERPAID'
                  const statusConfig = orderStatusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' }

                  return (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">{order.orderNumber}</TableCell>
                      <TableCell className="text-gray-600">
                        <div>
                          <div className="font-medium">{order.supplier?.name || order.vendorName || '-'}</div>
                          {(order.supplier?.email || order.vendorEmail) && (
                            <div className="text-xs text-gray-400">{order.supplier?.email || order.vendorEmail}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
                          {order._count.items} items
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell className={`font-medium ${isFullyPaid ? 'text-emerald-600' : paidAmount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {formatCurrency(paidAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${
                          isFullyPaid ? 'text-emerald-600' :
                          paidAmount > 0 ? 'text-blue-600' :
                          'text-amber-600'
                        }`}>
                          {isFullyPaid ? 'Fully Paid' : paidAmount > 0 ? 'Partial Paid' : 'Unpaid'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrderId(order.id)
                              setOrderDetailsDialogOpen(true)
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {!isFullyPaid && (
                              <DropdownMenuItem onClick={() => handleOpenPaymentDialog(order)}>
                                <DollarSign className="w-4 h-4 mr-2" />
                                Record Supplier Payment
                              </DropdownMenuItem>
                            )}

                            {(order.status === 'ORDERED' || order.status === 'CONFIRMED' || order.status === 'IN_PRODUCTION') && (
                              <DropdownMenuItem onClick={() => handleOpenTrackingDialog(order)}>
                                <Truck className="w-4 h-4 mr-2" />
                                Add Tracking
                              </DropdownMenuItem>
                            )}

                            {order.trackingUrl && (
                              <DropdownMenuItem onClick={() => window.open(order.trackingUrl!, '_blank')}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Track Shipment
                              </DropdownMenuItem>
                            )}

                            {(order.status === 'SHIPPED' || order.status === 'IN_TRANSIT') && (
                              <DropdownMenuItem onClick={() => handleMarkDelivered(order)}>
                                <Check className="w-4 h-4 mr-2" />
                                Mark as Delivered
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem>
                              <FileText className="w-4 h-4 mr-2" />
                              Download PO PDF
                            </DropdownMenuItem>

                            {canDeleteOrder(order) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setOrderToDelete(order)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Order
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Send PO Dialog - uses shared component */}
      {selectedOrder && (
        <SendPODialog
          open={showSendPO}
          onOpenChange={setShowSendPO}
          order={{
            id: selectedOrder.id,
            orderNumber: selectedOrder.orderNumber,
            vendorName: selectedOrder.supplier?.name || selectedOrder.vendorName || 'Supplier',
            vendorEmail: selectedOrder.supplier?.email || selectedOrder.vendorEmail || undefined,
            totalAmount: selectedOrder.totalAmount || 0,
            subtotal: selectedOrder.subtotal || 0,
            shippingCost: selectedOrder.shippingCost || 0,
            taxAmount: selectedOrder.taxAmount || 0,
            currency: selectedOrder.currency,
            shippingAddress: undefined,
            expectedDelivery: selectedOrder.expectedDelivery || undefined,
            orderedAt: selectedOrder.orderedAt,  // Track if already sent
            items: [] // Items are fetched by the dialog from the API
          }}
          onSuccess={() => {
            setShowSendPO(false)
            fetchOrders()
          }}
        />
      )}

      {/* Record Supplier Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Record Supplier Payment
            </DialogTitle>
            <DialogDescription>
              Record payment to {selectedOrder?.supplier?.name || selectedOrder?.vendorName} for {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={paymentFormData.paymentMethod}
                onValueChange={(value) => setPaymentFormData(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentAmount">Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentFormData.paymentAmount}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentAmount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentRef">Reference / Confirmation #</Label>
              <Input
                id="paymentRef"
                value={paymentFormData.paymentRef}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentRef: e.target.value }))}
                placeholder="Transaction ID, check number, etc."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentNotes">Notes</Label>
              <Textarea
                id="paymentNotes"
                value={paymentFormData.paymentNotes}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentNotes: e.target.value }))}
                placeholder="Any notes about this payment..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={recordingPayment}>
              {recordingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tracking Dialog */}
      <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Add Tracking Information
            </DialogTitle>
            <DialogDescription>
              Add shipping tracking for {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="trackingNumber">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                value={trackingFormData.trackingNumber}
                onChange={(e) => setTrackingFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                placeholder="Enter tracking number"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Select
                value={trackingFormData.carrier}
                onValueChange={(value) => setTrackingFormData(prev => ({ ...prev, carrier: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="Canada Post">Canada Post</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="Purolator">Purolator</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="trackingUrl">Tracking URL</Label>
              <Input
                id="trackingUrl"
                type="url"
                value={trackingFormData.trackingUrl}
                onChange={(e) => setTrackingFormData(prev => ({ ...prev, trackingUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTracking} disabled={addingTracking}>
              {addingTracking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  Add Tracking
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PO Dialog */}
      {selectedSupplierForPO && (
        <CreatePODialog
          open={createPODialogOpen}
          onOpenChange={(open) => {
            setCreatePODialogOpen(open)
            if (!open) {
              setSelectedSupplierForPO(null)
            }
          }}
          projectId={projectId}
          supplier={selectedSupplierForPO}
          project={readyToOrder?.project}
          onSuccess={handlePOCreated}
        />
      )}

      {/* Order Details Sheet */}
      <OrderDetailSheet
        open={orderDetailsDialogOpen}
        onOpenChange={setOrderDetailsDialogOpen}
        orderId={selectedOrderId}
        onUpdate={() => {
          fetchOrders()
          fetchReadyToOrder()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {orderToDelete?.orderNumber}?
              The items in this order will be returned to "Ready to Order" status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Order'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
