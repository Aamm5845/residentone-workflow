'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Building2,
  DollarSign,
  Users,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  TrendingUp,
  FileText,
  ExternalLink,
  Receipt,
  CreditCard,
  AlertCircle,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'

interface QuoteRequest {
  id: string
  rfqNumber: string
  title: string
  status: string
  projectName: string
  supplierName: string
  supplierId?: string
  supplierRFQId?: string
  vendorEmail?: string
  sentAt: string
  submittedAt?: string
  totalAmount?: number
  lineItemsCount: number
  quoteDocumentUrl?: string
  rfqId: string
}

interface ClientInvoice {
  id: string
  quoteNumber: string
  title: string
  status: string
  projectName: string
  clientName: string
  clientEmail?: string
  totalAmount: number
  totalCost: number
  profit: number
  profitMargin: number
  sentAt?: string
  paidAt?: string
  paidAmount?: number
  lineItemsCount: number
  createdAt: string
}

interface Supplier {
  id: string
  name: string
  email?: string
  phone?: string
  specialty?: string
  logo?: string
  activeQuotes: number
  totalOrders: number
}

interface ProcurementStats {
  pendingQuotes: number
  receivedQuotes: number
  acceptedQuotes: number
  draftInvoices: number
  sentInvoices: number
  paidInvoices: number
  totalRevenue: number
  totalProfit: number
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  // Quote Request statuses
  'SENT': { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
  'PENDING': { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
  'SUBMITTED': { label: 'Quoted', color: 'bg-blue-100 text-blue-700', icon: <FileText className="w-3 h-3" /> },
  'QUOTED': { label: 'Quoted', color: 'bg-blue-100 text-blue-700', icon: <FileText className="w-3 h-3" /> },
  'ACCEPTED': { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  'REJECTED': { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  'DECLINED': { label: 'Declined', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  // Invoice statuses
  'DRAFT': { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: <FileText className="w-3 h-3" /> },
  'SENT_TO_CLIENT': { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: <Mail className="w-3 h-3" /> },
  'APPROVED': { label: 'Paid', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  'PAID': { label: 'Paid', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  'PARTIALLY_PAID': { label: 'Partial', color: 'bg-orange-100 text-orange-700', icon: <CreditCard className="w-3 h-3" /> },
  'OVERDUE': { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
}

export default function SimplifiedProcurementDashboard() {
  const [activeTab, setActiveTab] = useState('quotes')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<ProcurementStats>({
    pendingQuotes: 0,
    receivedQuotes: 0,
    acceptedQuotes: 0,
    draftInvoices: 0,
    sentInvoices: 0,
    paidInvoices: 0,
    totalRevenue: 0,
    totalProfit: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [quotesRes, invoicesRes, suppliersRes] = await Promise.all([
        fetch('/api/supplier-quotes?limit=100'),
        fetch('/api/client-quotes'),
        fetch('/api/suppliers')
      ])

      if (quotesRes.ok) {
        const data = await quotesRes.json()
        // Transform supplier quotes to our format
        const quotes = (data.quotes || []).map((q: any) => ({
          id: q.id,
          rfqId: q.rfq?.id || '',
          rfqNumber: q.rfq?.rfqNumber || '',
          title: q.rfq?.title || '',
          projectName: q.project?.name || 'Unknown',
          supplierName: q.supplier?.name || q.vendorName || 'Unknown',
          supplierId: q.supplier?.id || null,
          supplierRFQId: q.supplierRFQId || '', // For correct URL navigation
          vendorEmail: q.vendorEmail,
          status: q.status,
          sentAt: q.createdAt,
          submittedAt: q.submittedAt,
          totalAmount: q.totalAmount || q.subtotal,
          lineItemsCount: q.lineItemsCount || q._count?.lineItems || 0,
          quoteDocumentUrl: q.quoteDocumentUrl
        }))
        setQuoteRequests(quotes)
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        const invoices = (data.quotes || []).map((q: any) => ({
          ...q,
          projectName: q.project?.name || 'Unknown',
          clientName: q.project?.client?.name || 'Unknown',
          clientEmail: q.project?.client?.email,
          profit: (q.totalAmount || 0) - (q.totalCost || 0),
          profitMargin: q.totalCost > 0 ? (((q.totalAmount || 0) - (q.totalCost || 0)) / (q.totalCost || 1)) * 100 : 0,
          lineItemsCount: q._count?.lineItems || q.lineItems?.length || 0
        }))
        setClientInvoices(invoices)
      }

      if (suppliersRes.ok) {
        const data = await suppliersRes.json()
        setSuppliers(Array.isArray(data) ? data : data.suppliers || [])
      }

      calculateStats()
    } catch (error) {
      console.error('Error loading procurement data:', error)
      toast.error('Failed to load procurement data')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const pending = quoteRequests.filter(q => ['SENT', 'PENDING'].includes(q.status)).length
    const received = quoteRequests.filter(q => ['SUBMITTED', 'QUOTED'].includes(q.status)).length
    const accepted = quoteRequests.filter(q => q.status === 'ACCEPTED').length
    
    const draft = clientInvoices.filter(i => i.status === 'DRAFT').length
    const sent = clientInvoices.filter(i => i.status === 'SENT_TO_CLIENT').length
    const paid = clientInvoices.filter(i => ['APPROVED', 'PAID'].includes(i.status)).length
    
    const revenue = clientInvoices
      .filter(i => ['APPROVED', 'PAID'].includes(i.status))
      .reduce((sum, i) => sum + (i.totalAmount || 0), 0)
    
    const profit = clientInvoices
      .filter(i => ['APPROVED', 'PAID'].includes(i.status))
      .reduce((sum, i) => sum + (i.profit || 0), 0)

    setStats({
      pendingQuotes: pending,
      receivedQuotes: received,
      acceptedQuotes: accepted,
      draftInvoices: draft,
      sentInvoices: sent,
      paidInvoices: paid,
      totalRevenue: revenue,
      totalProfit: profit
    })
  }

  useEffect(() => {
    calculateStats()
  }, [quoteRequests, clientInvoices])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount || 0)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: null }
    return (
      <Badge className={`${config.color} gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const filteredQuotes = quoteRequests.filter(q =>
    !searchQuery ||
    q.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.rfqNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredInvoices = clientInvoices.filter(i =>
    !searchQuery ||
    i.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get supplier IDs that have quote requests
  const supplierIdsWithQuotes = new Set(
    quoteRequests.map(q => q.supplierId).filter(Boolean)
  )
  
  // Only show suppliers that have quote requests
  const filteredSuppliers = suppliers
    .filter(s => supplierIdsWithQuotes.has(s.id))
    .filter(s =>
      !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
    )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-gray-500">Supplier quotes, client invoices, and payments</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Awaiting Quotes</p>
                <p className="text-2xl font-bold text-amber-900">{stats.pendingQuotes}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Quotes Received</p>
                <p className="text-2xl font-bold text-blue-900">{stats.receivedQuotes}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Revenue</p>
                <p className="text-2xl font-bold text-emerald-900">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-100">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-700 font-medium uppercase tracking-wide">Profit</p>
                <p className="text-2xl font-bold text-violet-900">{formatCurrency(stats.totalProfit)}</p>
              </div>
              <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <TabsList className="bg-gray-100/80">
            <TabsTrigger value="quotes" className="gap-2 data-[state=active]:bg-white">
              <Building2 className="w-4 h-4" />
              Quote Requests
              {stats.receivedQuotes > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs ml-1">
                  {stats.receivedQuotes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 data-[state=active]:bg-white">
              <Receipt className="w-4 h-4" />
              Client Invoices
              {stats.sentInvoices > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs ml-1">
                  {stats.sentInvoices}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2 data-[state=active]:bg-white">
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
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Quote Requests Tab */}
        <TabsContent value="quotes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quote Requests to Suppliers</CardTitle>
              <p className="text-sm text-gray-500">Quotes sent from All Specs • Click to view/accept</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No quote requests</h3>
                  <p className="text-gray-500">Quote requests sent from All Specs will appear here</p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Group by status */}
                  {['SUBMITTED', 'QUOTED', 'SENT', 'PENDING', 'ACCEPTED', 'REJECTED', 'DECLINED'].map(status => {
                    const statusQuotes = filteredQuotes.filter(q => q.status === status)
                    if (statusQuotes.length === 0) return null
                    
                    const isReceived = ['SUBMITTED', 'QUOTED'].includes(status)
                    
                    return (
                      <div key={status} className={isReceived ? 'bg-blue-50/50 -mx-6 px-6 py-2' : 'py-2'}>
                        {statusQuotes.map((quote) => (
                          <Link
                            key={quote.id}
                            href={`/procurement/rfq/${quote.rfqId}?supplier=${quote.supplierRFQId || quote.id}`}
                            className={`flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors ${
                              isReceived ? 'hover:bg-blue-100/50 bg-white shadow-sm mb-2' : ''
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isReceived ? 'bg-blue-100' : 'bg-gray-100'
                              }`}>
                                <Building2 className={`w-5 h-5 ${isReceived ? 'text-blue-600' : 'text-gray-500'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{quote.supplierName}</span>
                                  {getStatusBadge(quote.status)}
                                  {isReceived && (
                                    <Badge className="bg-blue-600 text-white text-xs animate-pulse">
                                      Review
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{quote.projectName}</p>
                                <p className="text-xs text-gray-400">{quote.rfqNumber} • {quote.lineItemsCount} items</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                {quote.totalAmount && (
                                  <p className="font-medium text-gray-900">{formatCurrency(quote.totalAmount)}</p>
                                )}
                                <p className="text-gray-400">
                                  {quote.submittedAt ? `Quoted ${formatDate(quote.submittedAt)}` : `Sent ${formatDate(quote.sentAt)}`}
                                </p>
                              </div>
                              {quote.quoteDocumentUrl && (
                                <a
                                  href={quote.quoteDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 hover:bg-gray-100 rounded-md"
                                  title="View quote document"
                                >
                                  <ExternalLink className="w-4 h-4 text-gray-400" />
                                </a>
                              )}
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Client Invoices</CardTitle>
              <p className="text-sm text-gray-500">Invoices sent to clients • Track payments and profit</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
                  <p className="text-gray-500">Create invoices from All Specs to bill clients</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary row */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-gray-600">Draft: {stats.draftInvoices}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-gray-600">Sent: {stats.sentInvoices}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-600">Paid: {stats.paidInvoices}</span>
                    </div>
                    <div className="ml-auto font-medium text-emerald-600">
                      Total Profit: {formatCurrency(stats.totalProfit)}
                    </div>
                  </div>

                  {/* Invoice list */}
                  <div className="divide-y">
                    {filteredInvoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/procurement/quote/${invoice.id}`}
                        className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            invoice.status === 'APPROVED' || invoice.status === 'PAID' 
                              ? 'bg-green-100' 
                              : invoice.status === 'SENT_TO_CLIENT'
                              ? 'bg-blue-100'
                              : 'bg-gray-100'
                          }`}>
                            <Receipt className={`w-5 h-5 ${
                              invoice.status === 'APPROVED' || invoice.status === 'PAID'
                                ? 'text-green-600'
                                : invoice.status === 'SENT_TO_CLIENT'
                                ? 'text-blue-600'
                                : 'text-gray-500'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{invoice.quoteNumber}</span>
                              {getStatusBadge(invoice.status)}
                            </div>
                            <p className="text-sm text-gray-500">{invoice.projectName}</p>
                            <p className="text-xs text-gray-400">{invoice.clientName} • {invoice.lineItemsCount} items</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                            <p className={`text-sm ${invoice.profit > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                              +{formatCurrency(invoice.profit)} profit
                            </p>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className={`font-medium ${invoice.profitMargin > 20 ? 'text-emerald-600' : invoice.profitMargin > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {invoice.profitMargin.toFixed(1)}%
                            </p>
                            <p className="text-gray-400 text-xs">margin</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400">{formatDate(invoice.sentAt || invoice.createdAt)}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Supplier Directory</CardTitle>
              <p className="text-sm text-gray-500">Your vendor and supplier contacts</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers yet</h3>
                  <p className="text-gray-500">Suppliers will be added when you send quote requests</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSuppliers.map((supplier) => (
                    <Link
                      key={supplier.id}
                      href={`/procurement/suppliers/${supplier.id}`}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                    >
                      {supplier.logo ? (
                        <img
                          src={supplier.logo}
                          alt={supplier.name}
                          className="w-12 h-12 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{supplier.name}</p>
                        {supplier.specialty && (
                          <p className="text-sm text-gray-500 truncate">{supplier.specialty}</p>
                        )}
                        {supplier.email && (
                          <p className="text-xs text-gray-400 truncate">{supplier.email}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

