'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  DollarSign,
  FileText,
  Package,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface OverviewData {
  summary: {
    activeProjects: number
    totalProjects: number
    totalClients: number
    totalSuppliers: number
    pendingOrders: number
    totalOrders: number
    pendingDeliveries: number
    openRfqs: number
    pendingQuotes: number
  }
  financial: {
    totalReceived: number
    totalPending: number
  }
  recentProjects: Array<{
    id: string
    name: string
    projectNumber: string
    status: string
    updatedAt: string
    client: { name: string }
  }>
}

interface FinancialData {
  summary: {
    totalRevenue: number
    pendingPayments: number
    failedPayments: number
    totalQuotedValue: number
    approvedQuotesValue: number
    pendingQuotesValue: number
  }
  paymentsByStatus: Record<string, number>
  quotesByStatus: Record<string, number>
  monthlyData: Array<{
    month: string
    revenue: number
    count: number
  }>
  recentPayments: any[]
}

interface ProcurementData {
  summary: {
    totalRfqs: number
    openRfqs: number
    completedRfqs: number
    totalQuotes: number
    acceptedQuotes: number
    responseRate: number
    avgLeadTimeWeeks: number
  }
  rfqsByStatus: Record<string, number>
  quotesByStatus: Record<string, number>
  recentRfqs: any[]
}

interface SuppliersData {
  summary: {
    totalSuppliers: number
    activeSuppliers: number
    totalOrderValue: number
    avgResponseRate: number
  }
  suppliers: Array<{
    id: string
    name: string
    email: string
    category: string
    status: string
    rfqsReceived: number
    quotesSubmitted: number
    quotesAccepted: number
    responseRate: number
    winRate: number
    ordersCount: number
    totalOrderValue: number
  }>
  topSuppliers: any[]
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState('all')
  const [loading, setLoading] = useState(true)
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [procurementData, setProcurementData] = useState<ProcurementData | null>(null)
  const [suppliersData, setSuppliersData] = useState<SuppliersData | null>(null)

  useEffect(() => {
    loadData(activeTab)
  }, [activeTab, dateRange])

  const loadData = async (type: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type })

      if (dateRange !== 'all') {
        const now = new Date()
        let startDate: Date

        switch (dateRange) {
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            break
          case '1y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            break
          default:
            startDate = now
        }

        params.set('startDate', startDate.toISOString())
        params.set('endDate', now.toISOString())
      }

      const response = await fetch(`/api/analytics?${params}`)
      if (response.ok) {
        const data = await response.json()

        switch (type) {
          case 'overview':
            setOverviewData(data)
            break
          case 'financial':
            setFinancialData(data)
            break
          case 'procurement':
            setProcurementData(data)
            break
          case 'suppliers':
            setSuppliersData(data)
            break
        }
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
      case 'DELIVERED':
        return 'bg-green-100 text-green-800'
      case 'URGENT':
        return 'bg-red-100 text-red-800'
      case 'PENDING':
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500">Track performance across projects, procurement, and finances</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="procurement" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Procurement
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Suppliers
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {overviewData && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Active Projects</p>
                            <p className="text-2xl font-bold">{overviewData.summary.activeProjects}</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">of {overviewData.summary.totalProjects} total</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Pending Orders</p>
                            <p className="text-2xl font-bold">{overviewData.summary.pendingOrders}</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{overviewData.summary.pendingDeliveries} deliveries in transit</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Revenue Received</p>
                            <p className="text-2xl font-bold">{formatCurrency(overviewData.financial.totalReceived)}</p>
                          </div>
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-green-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{formatCurrency(overviewData.financial.totalPending)} pending</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Pending Quotes</p>
                            <p className="text-2xl font-bold">{overviewData.summary.pendingQuotes}</p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-6 h-6 text-yellow-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{overviewData.summary.openRfqs} open RFQs</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Stats</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-gray-600">Total Clients</span>
                          <span className="font-medium">{overviewData.summary.totalClients}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-gray-600">Total Suppliers</span>
                          <span className="font-medium">{overviewData.summary.totalSuppliers}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-gray-600">Total Orders</span>
                          <span className="font-medium">{overviewData.summary.totalOrders}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-gray-600">Open RFQs</span>
                          <span className="font-medium">{overviewData.summary.openRfqs}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Projects</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {overviewData.recentProjects.map((project) => (
                            <div
                              key={project.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-gray-500">{project.client.name}</p>
                              </div>
                              <Badge className={getStatusColor(project.status)}>
                                {project.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-6">
              {financialData && (
                <>
                  {/* Financial Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Revenue</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(financialData.summary.totalRevenue)}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Pending Payments</p>
                            <p className="text-2xl font-bold text-yellow-600">
                              {formatCurrency(financialData.summary.pendingPayments)}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-6 h-6 text-yellow-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Quoted</p>
                            <p className="text-2xl font-bold">
                              {formatCurrency(financialData.summary.totalQuotedValue)}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monthly Revenue Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Revenue (Last 12 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-end gap-2">
                        {financialData.monthlyData.map((data, i) => {
                          const maxRevenue = Math.max(...financialData.monthlyData.map(d => d.revenue))
                          const height = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                                style={{ height: `${Math.max(height, 4)}%` }}
                                title={`${data.month}: ${formatCurrency(data.revenue)}`}
                              />
                              <span className="text-xs text-gray-500 -rotate-45 origin-left whitespace-nowrap">
                                {data.month.split(' ')[0]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quote Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quote Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-yellow-700">Pending Approval</p>
                          <p className="text-xl font-bold text-yellow-800">
                            {formatCurrency(financialData.summary.pendingQuotesValue)}
                          </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-700">Approved</p>
                          <p className="text-xl font-bold text-green-800">
                            {formatCurrency(financialData.summary.approvedQuotesValue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Procurement Tab */}
            <TabsContent value="procurement" className="space-y-6">
              {procurementData && (
                <>
                  {/* Procurement Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total RFQs</p>
                            <p className="text-2xl font-bold">{procurementData.summary.totalRfqs}</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{procurementData.summary.openRfqs} open</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Quotes Received</p>
                            <p className="text-2xl font-bold">{procurementData.summary.totalQuotes}</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{procurementData.summary.acceptedQuotes} accepted</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Response Rate</p>
                            <p className="text-2xl font-bold">{procurementData.summary.responseRate}%</p>
                          </div>
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Avg Lead Time</p>
                            <p className="text-2xl font-bold">{procurementData.summary.avgLeadTimeWeeks} weeks</p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-6 h-6 text-yellow-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* RFQ Status Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>RFQ Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(procurementData.rfqsByStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(status)}>{status}</Badge>
                              </div>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent RFQs</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {procurementData.recentRfqs.slice(0, 5).map((rfq: any) => (
                            <div key={rfq.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium">{rfq.rfqNumber}</p>
                                <p className="text-sm text-gray-500">{rfq.title}</p>
                              </div>
                              <div className="text-right">
                                <Badge className={getStatusColor(rfq.status)}>{rfq.status}</Badge>
                                <p className="text-xs text-gray-400 mt-1">
                                  {rfq.quotesReceived}/{rfq.suppliersCount} quotes
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Suppliers Tab */}
            <TabsContent value="suppliers" className="space-y-6">
              {suppliersData && (
                <>
                  {/* Supplier Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Suppliers</p>
                            <p className="text-2xl font-bold">{suppliersData.summary.totalSuppliers}</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{suppliersData.summary.activeSuppliers} active</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Orders Value</p>
                            <p className="text-2xl font-bold">{formatCurrency(suppliersData.summary.totalOrderValue)}</p>
                          </div>
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-green-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Avg Response Rate</p>
                            <p className="text-2xl font-bold">{suppliersData.summary.avgResponseRate}%</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top Suppliers */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Suppliers by Order Value</CardTitle>
                      <CardDescription>Ranked by total order value placed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {suppliersData.topSuppliers.map((supplier: any, index: number) => (
                          <div key={supplier.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{supplier.name}</p>
                              <p className="text-sm text-gray-500">{supplier.category || 'General'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(supplier.totalOrderValue)}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{supplier.ordersCount} orders</span>
                                <span>•</span>
                                <span>{supplier.responseRate}% response</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* All Suppliers Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>All Suppliers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-2 font-medium text-gray-600">Supplier</th>
                              <th className="text-left py-3 px-2 font-medium text-gray-600">Category</th>
                              <th className="text-center py-3 px-2 font-medium text-gray-600">RFQs</th>
                              <th className="text-center py-3 px-2 font-medium text-gray-600">Response</th>
                              <th className="text-center py-3 px-2 font-medium text-gray-600">Win Rate</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-600">Orders</th>
                            </tr>
                          </thead>
                          <tbody>
                            {suppliersData.suppliers.map((supplier) => (
                              <tr key={supplier.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-2">
                                  <div>
                                    <p className="font-medium">{supplier.name}</p>
                                    <p className="text-sm text-gray-500">{supplier.email}</p>
                                  </div>
                                </td>
                                <td className="py-3 px-2">
                                  <Badge variant="outline">{supplier.category || '-'}</Badge>
                                </td>
                                <td className="py-3 px-2 text-center">{supplier.rfqsReceived}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className={cn(
                                    'font-medium',
                                    supplier.responseRate >= 80 ? 'text-green-600' :
                                    supplier.responseRate >= 50 ? 'text-yellow-600' :
                                    'text-red-600'
                                  )}>
                                    {supplier.responseRate}%
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center">{supplier.winRate}%</td>
                                <td className="py-3 px-2 text-right">
                                  <p className="font-medium">{formatCurrency(supplier.totalOrderValue)}</p>
                                  <p className="text-xs text-gray-500">{supplier.ordersCount} orders</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
