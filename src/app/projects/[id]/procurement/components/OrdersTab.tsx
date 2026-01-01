'use client'

import { useState, useEffect } from 'react'
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
  Package,
  Truck,
  DollarSign,
  Eye,
  FileText,
  RefreshCw
} from 'lucide-react'

interface OrdersTabProps {
  projectId: string
  searchQuery: string
}

interface Order {
  id: string
  poNumber: string
  supplierName: string
  clientInvoices: string[]
  totalCost: number
  paidStatus: 'UNPAID' | 'PAID'
  orderStatus: 'PENDING_PAYMENT' | 'PAID' | 'ORDERED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED'
}

const orderStatusConfig = {
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'bg-gray-100 text-gray-600' },
  PAID: { label: 'Paid', color: 'bg-blue-50 text-blue-700' },
  ORDERED: { label: 'Ordered', color: 'bg-purple-50 text-purple-700' },
  IN_PRODUCTION: { label: 'In Production', color: 'bg-amber-50 text-amber-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-50 text-cyan-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700' },
}

const paidStatusConfig = {
  UNPAID: { label: 'Unpaid', color: 'bg-red-50 text-red-700' },
  PAID: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700' },
}

export default function OrdersTab({ projectId, searchQuery }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch real orders from API
    setLoading(false)
    setOrders([])
  }, [projectId])

  // Filter orders based on search
  const filteredOrders = orders.filter(order =>
    !searchQuery ||
    order.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
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
            <Button variant="ghost" size="sm" className="h-8 text-gray-600">
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
                  <TableHead className="text-gray-500 font-medium">Client Invoice(s)</TableHead>
                  <TableHead className="text-gray-500 font-medium">Cost</TableHead>
                  <TableHead className="text-gray-500 font-medium">Payment</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer">
                    <TableCell className="font-medium text-gray-900">{order.poNumber}</TableCell>
                    <TableCell className="text-gray-600">{order.supplierName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {order.clientInvoices.map((inv, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-gray-300 text-gray-600">
                            {inv}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{formatCurrency(order.totalCost)}</TableCell>
                    <TableCell>
                      <Badge className={paidStatusConfig[order.paidStatus].color}>
                        {paidStatusConfig[order.paidStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={orderStatusConfig[order.orderStatus].color}>
                        {orderStatusConfig[order.orderStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.paidStatus === 'UNPAID' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700">
                            <DollarSign className="w-4 h-4" />
                          </Button>
                        )}
                        {order.orderStatus === 'SHIPPED' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700">
                            <Truck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
