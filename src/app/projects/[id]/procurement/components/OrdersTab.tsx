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
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

interface OrdersTabProps {
  projectId: string
  searchQuery: string
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
}

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-600' },
  PAYMENT_RECEIVED: { label: 'Payment Received', color: 'bg-blue-50 text-blue-700' },
  ORDERED: { label: 'Ordered', color: 'bg-purple-50 text-purple-700' },
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

  // Dialog states
  const [sendPOOpen, setSendPOOpen] = useState(false)
  const [sendingPO, setSendingPO] = useState(false)
  const [poPreviewHtml, setPOPreviewHtml] = useState('')
  const [poFormData, setPOFormData] = useState({
    supplierEmail: '',
    notes: '',
    shippingAddress: '',
    expectedDelivery: '',
    paymentTerms: 'Net 30'
  })

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

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Filter orders based on search
  const filteredOrders = orders.filter(order =>
    !searchQuery ||
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.supplier?.name || order.vendorName || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
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

  // Send PO handlers
  const handleOpenSendPO = async (order: Order) => {
    setSelectedOrder(order)
    setPOFormData({
      supplierEmail: order.supplier?.email || order.vendorEmail || '',
      notes: order.notes || '',
      shippingAddress: '',
      expectedDelivery: order.expectedDelivery ? order.expectedDelivery.split('T')[0] : '',
      paymentTerms: 'Net 30'
    })
    setSendPOOpen(true)

    // Fetch preview
    try {
      const res = await fetch(`/api/orders/${order.id}/send`)
      if (res.ok) {
        const data = await res.json()
        setPOPreviewHtml(data.email.html)
      }
    } catch (error) {
      console.error('Error fetching PO preview:', error)
    }
  }

  const handleSendPO = async () => {
    if (!selectedOrder) return

    if (!poFormData.supplierEmail) {
      toast.error('Supplier email is required')
      return
    }

    try {
      setSendingPO(true)
      const res = await fetch(`/api/orders/${selectedOrder.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poFormData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send PO')
      }

      toast.success(`Purchase order sent to ${poFormData.supplierEmail}`)
      setSendPOOpen(false)
      fetchOrders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send PO')
    } finally {
      setSendingPO(false)
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Orders Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Purchase Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-gray-600"
              onClick={fetchOrders}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
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
                  <TableHead className="text-gray-500 font-medium">Cost</TableHead>
                  <TableHead className="text-gray-500 font-medium">Supplier Paid</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium">Ordered</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const supplierPaid = !!order.supplierPaidAt
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
                      <TableCell className="font-medium text-gray-900">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell>
                        {supplierPaid ? (
                          <Badge className="bg-emerald-50 text-emerald-700">
                            <Check className="w-3 h-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {order.orderedAt ? formatDate(order.orderedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => window.open(`/api/orders/${order.id}`, '_blank')}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>

                            {order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_RECEIVED' ? (
                              <DropdownMenuItem onClick={() => handleOpenSendPO(order)}>
                                <Send className="w-4 h-4 mr-2" />
                                Send PO to Supplier
                              </DropdownMenuItem>
                            ) : null}

                            <DropdownMenuSeparator />

                            {!supplierPaid && (
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

      {/* Send PO Dialog */}
      <Dialog open={sendPOOpen} onOpenChange={setSendPOOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Purchase Order
            </DialogTitle>
            <DialogDescription>
              Send {selectedOrder?.orderNumber} to {selectedOrder?.supplier?.name || selectedOrder?.vendorName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierEmail">Supplier Email *</Label>
                <Input
                  id="supplierEmail"
                  type="email"
                  value={poFormData.supplierEmail}
                  onChange={(e) => setPOFormData(prev => ({ ...prev, supplierEmail: e.target.value }))}
                  placeholder="supplier@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="expectedDelivery">Expected Delivery</Label>
                  <Input
                    id="expectedDelivery"
                    type="date"
                    value={poFormData.expectedDelivery}
                    onChange={(e) => setPOFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Select
                    value={poFormData.paymentTerms}
                    onValueChange={(value) => setPOFormData(prev => ({ ...prev, paymentTerms: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="50% Deposit">50% Deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="shippingAddress">Shipping Address</Label>
                <Textarea
                  id="shippingAddress"
                  value={poFormData.shippingAddress}
                  onChange={(e) => setPOFormData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  placeholder="Enter delivery address..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Special Instructions</Label>
                <Textarea
                  id="notes"
                  value={poFormData.notes}
                  onChange={(e) => setPOFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any special instructions for the supplier..."
                  rows={2}
                />
              </div>
            </div>

            {poPreviewHtml && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium text-gray-600">
                  Email Preview
                </div>
                <div
                  className="p-4 max-h-[300px] overflow-y-auto bg-white"
                  dangerouslySetInnerHTML={{ __html: poPreviewHtml }}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendPOOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendPO} disabled={sendingPO}>
              {sendingPO ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send PO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
