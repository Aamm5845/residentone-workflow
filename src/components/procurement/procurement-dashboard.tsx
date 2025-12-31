'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Send,
  Package,
  DollarSign,
  Truck,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Building2,
  ChevronRight,
  Settings,
  Percent,
  Users,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import CreateRFQDialog from './create-rfq-dialog'
import CategoryMarkupSettings from './category-markup-settings'

interface ProcurementDashboardProps {
  user: {
    id: string
    name: string
    role: string
  }
  orgId: string
}

interface RFQ {
  id: string
  rfqNumber: string
  title: string
  status: string
  createdAt: string
  responseDeadline?: string
  project: {
    id: string
    name: string
    projectNumber?: string
  }
  createdBy: {
    id: string
    name: string
  }
  _count: {
    lineItems: number
    supplierRFQs: number
  }
  supplierRFQs: Array<{
    supplier?: {
      id: string
      name: string
    }
    quotes: Array<{
      id: string
      status: string
      totalAmount?: number
    }>
  }>
}

interface ClientQuote {
  id: string
  quoteNumber: string
  title: string
  status: string
  createdAt: string
  subtotal?: number
  totalAmount?: number
  project: {
    id: string
    name: string
    client?: {
      name: string
    }
  }
  _count: {
    lineItems: number
    payments: number
  }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  totalAmount?: number
  project: {
    id: string
    name: string
  }
  supplier?: {
    id: string
    name: string
  }
  _count: {
    items: number
    deliveries: number
  }
}

interface Supplier {
  id: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  logo?: string
  supplierCategory?: {
    id: string
    name: string
    color?: string
  }
  _count?: {
    supplierRFQs: number
    orders: number
  }
}

interface SupplierQuote {
  id: string
  quoteNumber: string
  version: number
  status: string
  totalAmount?: number
  subtotal?: number
  submittedAt?: string
  validUntil?: string
  estimatedLeadTime?: string
  quoteDocumentUrl?: string
  supplier: {
    id?: string
    name: string
    email?: string
    logo?: string
  }
  project: {
    id: string
    name: string
    projectNumber?: string
  }
  rfq: {
    id: string
    rfqNumber: string
  }
  lineItemsCount: number
}

const statusColors: Record<string, string> = {
  // RFQ statuses
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  PARTIALLY_QUOTED: 'bg-yellow-100 text-yellow-800',
  FULLY_QUOTED: 'bg-green-100 text-green-800',
  QUOTE_ACCEPTED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  // Client Quote statuses
  INTERNAL_REVIEW: 'bg-yellow-100 text-yellow-800',
  SENT_TO_CLIENT: 'bg-blue-100 text-blue-800',
  CLIENT_REVIEWING: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-red-100 text-red-800',
  // Order statuses
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  PAYMENT_RECEIVED: 'bg-green-100 text-green-800',
  ORDERED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  INSTALLED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  RETURNED: 'bg-red-100 text-red-800'
}

export default function ProcurementDashboard({ user, orgId }: ProcurementDashboardProps) {
  const [activeTab, setActiveTab] = useState('rfqs')
  const [searchQuery, setSearchQuery] = useState('')
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuote[]>([])
  const [clientQuotes, setClientQuotes] = useState<ClientQuote[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pendingRFQs: 0,
    awaitingQuotes: 0,
    clientQuotesPending: 0,
    activeOrders: 0,
    monthlyRevenue: 0
  })
  const [showCreateRFQ, setShowCreateRFQ] = useState(false)
  const [showMarkupSettings, setShowMarkupSettings] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const [rfqsRes, supplierQuotesRes, quotesRes, ordersRes, suppliersRes] = await Promise.all([
        fetch('/api/rfq?limit=20'),
        fetch('/api/supplier-quotes?limit=50'),
        fetch('/api/client-quotes?limit=20'),
        fetch('/api/orders?limit=20'),
        fetch('/api/suppliers')
      ])

      if (rfqsRes.ok) {
        const data = await rfqsRes.json()
        setRfqs(data.rfqs || [])
      }

      if (supplierQuotesRes.ok) {
        const data = await supplierQuotesRes.json()
        setSupplierQuotes(data.quotes || [])
      }

      if (quotesRes.ok) {
        const data = await quotesRes.json()
        setClientQuotes(data.quotes || [])
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json()
        setOrders(data.orders || [])
      }

      if (suppliersRes.ok) {
        const data = await suppliersRes.json()
        setSuppliers(Array.isArray(data) ? data : data.suppliers || [])
      }

      // Calculate stats
      calculateStats()
    } catch (error) {
      console.error('Error loading procurement data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const pendingRFQs = rfqs.filter(r => r.status === 'DRAFT').length
    const awaitingQuotes = rfqs.filter(r => ['SENT', 'PARTIALLY_QUOTED'].includes(r.status)).length
    const clientQuotesPending = clientQuotes.filter(q => ['DRAFT', 'INTERNAL_REVIEW', 'SENT_TO_CLIENT'].includes(q.status)).length
    const activeOrders = orders.filter(o => !['COMPLETED', 'CANCELLED', 'RETURNED'].includes(o.status)).length
    const monthlyRevenue = clientQuotes
      .filter(q => q.status === 'APPROVED')
      .reduce((sum, q) => sum + parseFloat(q.totalAmount?.toString() || '0'), 0)

    setStats({
      pendingRFQs,
      awaitingQuotes,
      clientQuotesPending,
      activeOrders,
      monthlyRevenue
    })
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '$0.00'
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

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-gray-500">Manage RFQs, quotes, and orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowMarkupSettings(true)}>
            <Percent className="w-4 h-4 mr-2" />
            Markup Settings
          </Button>
          <Button onClick={() => setShowCreateRFQ(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New RFQ
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Draft RFQs</p>
                <p className="text-2xl font-bold">{stats.pendingRFQs}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Awaiting Quotes</p>
                <p className="text-2xl font-bold">{stats.awaitingQuotes}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Client Quotes</p>
                <p className="text-2xl font-bold">{stats.clientQuotesPending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Orders</p>
                <p className="text-2xl font-bold">{stats.activeOrders}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="rfqs" className="gap-2">
              <FileText className="w-4 h-4" />
              RFQs
            </TabsTrigger>
            <TabsTrigger value="supplier-quotes" className="gap-2">
              <Building2 className="w-4 h-4" />
              Supplier Quotes
            </TabsTrigger>
            <TabsTrigger value="client-quotes" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Client Quotes
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2">
              <Users className="w-4 h-4" />
              Suppliers
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={loadData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* RFQs Tab */}
        <TabsContent value="rfqs">
          <Card>
            <CardHeader>
              <CardTitle>Request for Quotes</CardTitle>
              <CardDescription>Manage quote requests to suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : rfqs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No RFQs yet</h3>
                  <p className="text-gray-500 mb-4">Create your first RFQ to start getting quotes from suppliers</p>
                  <Button onClick={() => setShowCreateRFQ(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create RFQ
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {rfqs.map((rfq) => (
                    <Link
                      key={rfq.id}
                      href={`/procurement/rfq/${rfq.id}`}
                      className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{rfq.rfqNumber}</span>
                            <Badge className={statusColors[rfq.status] || 'bg-gray-100'}>
                              {formatStatus(rfq.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{rfq.title}</p>
                          <p className="text-xs text-gray-400">{rfq.project.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-gray-600">{rfq._count.lineItems} items</p>
                          <p className="text-gray-400">{rfq._count.supplierRFQs} suppliers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400">{formatDate(rfq.createdAt)}</p>
                          {rfq.responseDeadline && (
                            <p className="text-xs text-orange-600">
                              Due: {formatDate(rfq.responseDeadline)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Quotes Tab */}
        <TabsContent value="supplier-quotes">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Quotes</CardTitle>
              <CardDescription>Compare and accept quotes from suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : supplierQuotes.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No supplier quotes yet</h3>
                  <p className="text-gray-500 mb-4">Supplier quotes will appear here after sending RFQs and suppliers respond</p>
                  <Button onClick={() => setShowCreateRFQ(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create RFQ
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {supplierQuotes
                    .filter(quote =>
                      !searchQuery ||
                      quote.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      quote.supplier.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      quote.project.name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((quote) => (
                    <Link
                      key={quote.id}
                      href={`/procurement/rfq/${quote.rfq.id}?supplier=${quote.id}`}
                      className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {quote.supplier.logo ? (
                          <img
                            src={quote.supplier.logo}
                            alt={quote.supplier.name}
                            className="w-10 h-10 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-emerald-600" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{quote.supplier.name}</span>
                            <Badge className={statusColors[quote.status] || 'bg-gray-100'}>
                              {formatStatus(quote.status)}
                            </Badge>
                            {quote.version > 1 && (
                              <Badge variant="outline" className="text-xs">v{quote.version}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {quote.rfq.rfqNumber} • {quote.project.name}
                          </p>
                          {quote.quoteNumber && (
                            <p className="text-xs text-gray-400">Quote #: {quote.quoteNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(quote.totalAmount || quote.subtotal)}</p>
                          <p className="text-gray-400">{quote.lineItemsCount} items</p>
                        </div>
                        <div className="text-right">
                          {quote.submittedAt && (
                            <p className="text-gray-400">{formatDate(quote.submittedAt)}</p>
                          )}
                          {quote.estimatedLeadTime && (
                            <p className="text-xs text-blue-600">Lead: {quote.estimatedLeadTime}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {quote.quoteDocumentUrl && (
                            <a
                              href={quote.quoteDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 hover:bg-gray-100 rounded-md"
                              title="View quote document"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-400" />
                            </a>
                          )}
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Quotes Tab */}
        <TabsContent value="client-quotes">
          <Card>
            <CardHeader>
              <CardTitle>Client Quotes</CardTitle>
              <CardDescription>Quotes sent to clients with markup</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : clientQuotes.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No client quotes yet</h3>
                  <p className="text-gray-500">Client quotes will be created from accepted supplier quotes</p>
                </div>
              ) : (
                <div className="divide-y">
                  {clientQuotes.map((quote) => (
                    <Link
                      key={quote.id}
                      href={`/procurement/quote/${quote.id}`}
                      className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{quote.quoteNumber}</span>
                            <Badge className={statusColors[quote.status] || 'bg-gray-100'}>
                              {formatStatus(quote.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{quote.title}</p>
                          <p className="text-xs text-gray-400">
                            {quote.project.name} - {quote.project.client?.name || 'No client'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(quote.totalAmount || quote.subtotal)}</p>
                          <p className="text-gray-400">{quote._count.lineItems} items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400">{formatDate(quote.createdAt)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
              <CardDescription>Track orders placed with suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-500">Orders will be created after client quotes are approved and paid</p>
                </div>
              ) : (
                <div className="divide-y">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/procurement/order/${order.id}`}
                      className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{order.orderNumber}</span>
                            <Badge className={statusColors[order.status] || 'bg-gray-100'}>
                              {formatStatus(order.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {order.supplier?.name || 'Vendor'} - {order.project.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(order.totalAmount)}</p>
                          <p className="text-gray-400">{order._count.items} items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400">{formatDate(order.createdAt)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Suppliers</CardTitle>
                  <CardDescription>Manage your supplier relationships and view their history</CardDescription>
                </div>
                <Link href="/preferences?tab=suppliers">
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Supplier
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : suppliers.filter(s => (s._count?.supplierRFQs || 0) > 0).length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No RFQs sent to suppliers yet</h3>
                  <p className="text-gray-500 mb-4">
                    {suppliers.length > 0
                      ? "You have suppliers, but haven't sent any RFQs yet. Create an RFQ to get started."
                      : "Add suppliers to start sending RFQs"}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    {suppliers.length === 0 && (
                      <Link href="/preferences?tab=suppliers">
                        <Button variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Supplier
                        </Button>
                      </Link>
                    )}
                    <Button onClick={() => setShowCreateRFQ(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create RFQ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliers
                    .filter(s => (s._count?.supplierRFQs || 0) > 0) // Only show suppliers with RFQs
                    .filter(s =>
                      !searchQuery ||
                      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((supplier) => (
                    <Link
                      key={supplier.id}
                      href={`/procurement/suppliers/${supplier.id}`}
                      className="block bg-white border rounded-xl p-4 hover:shadow-lg hover:border-emerald-200 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {supplier.logo ? (
                          <img
                            src={supplier.logo}
                            alt={supplier.name}
                            className="w-12 h-12 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <span className="text-lg font-semibold text-emerald-700">
                              {supplier.name.substring(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{supplier.name}</h3>
                          {supplier.supplierCategory && (
                            <Badge
                              variant="outline"
                              className="text-xs mt-1"
                              style={{
                                borderColor: supplier.supplierCategory.color,
                                color: supplier.supplierCategory.color
                              }}
                            >
                              {supplier.supplierCategory.name}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>

                      <div className="mt-3 space-y-1.5 text-sm">
                        {supplier.contactName && (
                          <p className="text-gray-600 truncate">{supplier.contactName}</p>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate">{supplier.email}</span>
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                      </div>

                      {supplier._count && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-gray-400">
                          <span>{supplier._count.supplierRFQs || 0} RFQs</span>
                          <span>{supplier._count.orders || 0} Orders</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create RFQ Dialog */}
      <CreateRFQDialog
        open={showCreateRFQ}
        onOpenChange={setShowCreateRFQ}
        onSuccess={() => {
          setShowCreateRFQ(false)
          loadData()
        }}
      />

      {/* Markup Settings Dialog */}
      <Dialog open={showMarkupSettings} onOpenChange={setShowMarkupSettings}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Category Markup Settings</DialogTitle>
          </DialogHeader>
          <CategoryMarkupSettings onClose={() => setShowMarkupSettings(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
