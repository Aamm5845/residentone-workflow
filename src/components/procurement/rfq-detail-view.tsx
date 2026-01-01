'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  Package,
  RefreshCw,
  MoreVertical,
  Mail,
  Eye,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  BarChart2
} from 'lucide-react'
import QuoteComparisonView from './quote-comparison-view'
import RFQLineItemsManager from './rfq-line-items-manager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import toast from 'react-hot-toast'

interface RFQDetailViewProps {
  rfqId: string
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
  description?: string
  status: string
  createdAt: string
  sentAt?: string
  responseDeadline?: string
  validUntil?: string
  project: {
    id: string
    name: string
    projectNumber?: string
    client?: {
      id: string
      name: string
      email?: string
    }
  }
  createdBy: {
    id: string
    name: string
    email?: string
  }
  lineItems: Array<{
    id: string
    itemName: string
    itemDescription?: string
    quantity: number
    unitType?: string
    specifications?: any
    notes?: string
    roomFFEItem?: {
      id: string
      name: string
      category?: string
    }
  }>
  supplierRFQs: Array<{
    id: string
    supplier?: {
      id: string
      name: string
      email?: string
      phone?: string
      contactName?: string
    }
    vendorName?: string
    vendorEmail?: string
    sentAt?: string
    viewedAt?: string
    responseStatus: string
    quotes: Array<{
      id: string
      quoteNumber: string
      version: number
      status: string
      totalAmount?: number
      submittedAt?: string
      lineItems: Array<{
        id: string
        rfqLineItemId: string
        unitPrice: number
        quantity: number
        totalPrice: number
        availability?: string
        leadTimeWeeks?: number
      }>
    }>
  }>
  activities: Array<{
    id: string
    type: string
    message: string
    createdAt: string
    user?: {
      id: string
      name: string
    }
  }>
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  PARTIALLY_QUOTED: 'bg-yellow-100 text-yellow-800',
  FULLY_QUOTED: 'bg-green-100 text-green-800',
  QUOTE_ACCEPTED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUBMITTED: 'bg-green-100 text-green-800',
  ACCEPTED: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  DECLINED: 'bg-gray-100 text-gray-600'
}

export default function RFQDetailView({ rfqId, user, orgId }: RFQDetailViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supplierParam = searchParams.get('supplier')
  
  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(supplierParam ? 'quotes' : 'overview')
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [sendMessage, setSendMessage] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const [creatingClientQuote, setCreatingClientQuote] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadRFQ()
  }, [rfqId])

  const loadRFQ = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rfq/${rfqId}`)
      if (response.ok) {
        const data = await response.json()
        setRfq(data.rfq)
        // Pre-select suppliers that haven't been sent to
        const notSentSuppliers = data.rfq.supplierRFQs
          .filter((s: any) => !s.sentAt)
          .map((s: any) => s.supplier?.id || s.id)
        setSelectedSuppliers(notSentSuppliers)
      } else {
        toast.error('Failed to load RFQ')
        router.push('/procurement')
      }
    } catch (error) {
      console.error('Error loading RFQ:', error)
      toast.error('Failed to load RFQ')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (selectedSuppliers.length === 0) {
      toast.error('Please select at least one supplier')
      return
    }

    setSending(true)
    try {
      const response = await fetch(`/api/rfq/${rfqId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierIds: selectedSuppliers,
          message: sendMessage || null
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`RFQ sent to ${data.sent} supplier(s)`)
        setShowSendDialog(false)
        setSendMessage('')
        loadRFQ()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send RFQ')
      }
    } catch (error) {
      console.error('Error sending RFQ:', error)
      toast.error('Failed to send RFQ')
    } finally {
      setSending(false)
    }
  }

  const handleAcceptQuote = async (quoteId: string) => {
    try {
      const response = await fetch(`/api/rfq/${rfqId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, action: 'accept' })
      })

      if (response.ok) {
        toast.success('Quote accepted')
        loadRFQ()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to accept quote')
      }
    } catch (error) {
      console.error('Error accepting quote:', error)
      toast.error('Failed to accept quote')
    }
  }

  const handleCreateClientQuote = async () => {
    if (!rfq) return

    // Get accepted quotes
    const acceptedQuotes = rfq.supplierRFQs
      .flatMap(s => s.quotes)
      .filter(q => q.status === 'ACCEPTED')

    if (acceptedQuotes.length === 0) {
      toast.error('Please accept at least one supplier quote first')
      return
    }

    setCreatingClientQuote(true)
    try {
      const response = await fetch('/api/client-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqId: rfq.id,
          projectId: rfq.project.id,
          title: rfq.title,
          supplierQuoteIds: acceptedQuotes.map(q => q.id)
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Client quote created')
        router.push(`/procurement/quote/${data.id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create client quote')
      }
    } catch (error) {
      console.error('Error creating client quote:', error)
      toast.error('Failed to create client quote')
    } finally {
      setCreatingClientQuote(false)
    }
  }

  const handleDeleteRFQ = async () => {
    if (!rfq) return

    if (!confirm(`Are you sure you want to delete RFQ "${rfq.rfqNumber}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/rfq/${rfqId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('RFQ deleted successfully')
        router.push('/procurement')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete RFQ')
      }
    } catch (error) {
      console.error('Error deleting RFQ:', error)
      toast.error('Failed to delete RFQ')
    } finally {
      setDeleting(false)
    }
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-CA', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900">RFQ not found</h2>
        <Button variant="link" onClick={() => router.push('/procurement')}>
          Return to Procurement
        </Button>
      </div>
    )
  }

  const quotedSuppliers = rfq.supplierRFQs.filter(s => s.quotes.length > 0)
  const pendingSuppliers = rfq.supplierRFQs.filter(s => s.responseStatus === 'PENDING')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/procurement"
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Procurement
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{rfq.rfqNumber}</h1>
              <Badge className={statusColors[rfq.status] || 'bg-gray-100'}>
                {formatStatus(rfq.status)}
              </Badge>
            </div>
            <p className="text-lg text-gray-600">{rfq.title}</p>
            <p className="text-sm text-gray-400">
              {rfq.project.name} &bull; Created by {rfq.createdBy.name} on {formatDate(rfq.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {rfq.status === 'DRAFT' && (
              <Button onClick={() => setShowSendDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                Send to Suppliers
              </Button>
            )}
            {['FULLY_QUOTED', 'PARTIALLY_QUOTED', 'QUOTE_ACCEPTED'].includes(rfq.status) && (
              <>
                <Button variant="outline" onClick={() => setShowComparison(true)}>
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Compare Quotes
                </Button>
                <Button onClick={handleCreateClientQuote} disabled={creatingClientQuote}>
                  {creatingClientQuote && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  <DollarSign className="w-4 h-4 mr-2" />
                  Create Client Quote
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Supplier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={handleDeleteRFQ}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete RFQ'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Line Items</p>
                <p className="text-2xl font-bold">{rfq.lineItems.length}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Suppliers</p>
                <p className="text-2xl font-bold">{rfq.supplierRFQs.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Quotes Received</p>
                <p className="text-2xl font-bold">{quotedSuppliers.length}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Awaiting Response</p>
                <p className="text-2xl font-bold">{pendingSuppliers.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items ({rfq.lineItems.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({rfq.supplierRFQs.length})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotedSuppliers.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>RFQ Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Project</p>
                  <p className="font-medium">{rfq.project.name}</p>
                </div>
                {rfq.description && (
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-gray-700">{rfq.description}</p>
                  </div>
                )}
                {rfq.responseDeadline && (
                  <div>
                    <p className="text-sm text-gray-500">Response Deadline</p>
                    <p className="font-medium text-orange-600">{formatDate(rfq.responseDeadline)}</p>
                  </div>
                )}
                {rfq.sentAt && (
                  <div>
                    <p className="text-sm text-gray-500">Sent On</p>
                    <p className="font-medium">{formatDateTime(rfq.sentAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supplier Status</CardTitle>
              </CardHeader>
              <CardContent>
                {rfq.supplierRFQs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No suppliers added yet</p>
                ) : (
                  <div className="space-y-3">
                    {rfq.supplierRFQs.map(sRFQ => (
                      <div
                        key={sRFQ.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {sRFQ.supplier?.logo ? (
                            <img
                              src={sRFQ.supplier.logo}
                              alt={sRFQ.supplier.name}
                              className="w-8 h-8 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-emerald-700">
                                {(sRFQ.supplier?.name || sRFQ.vendorName || 'S').substring(0, 1).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{sRFQ.supplier?.name || sRFQ.vendorName}</p>
                            <p className="text-xs text-gray-500">
                              {sRFQ.viewedAt ? `Viewed ${formatDateTime(sRFQ.viewedAt)}` : 'Not viewed'}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusColors[sRFQ.responseStatus] || 'bg-gray-100'}>
                          {formatStatus(sRFQ.responseStatus)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>Items included in this RFQ</CardDescription>
            </CardHeader>
            <CardContent>
              <RFQLineItemsManager
                rfqId={rfqId}
                isDraft={rfq.status === 'DRAFT'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Suppliers</CardTitle>
                <CardDescription>Suppliers receiving this RFQ</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </CardHeader>
            <CardContent>
              {rfq.supplierRFQs.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No suppliers added yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rfq.supplierRFQs.map(sRFQ => (
                    <div key={sRFQ.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {sRFQ.supplier?.logo ? (
                          <img
                            src={sRFQ.supplier.logo}
                            alt={sRFQ.supplier.name}
                            className="w-10 h-10 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="text-lg font-semibold text-emerald-700">
                              {(sRFQ.supplier?.name || sRFQ.vendorName || 'S').substring(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{sRFQ.supplier?.name || sRFQ.vendorName}</p>
                          <p className="text-sm text-gray-500">
                            {sRFQ.supplier?.email || sRFQ.vendorEmail}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            {sRFQ.sentAt && (
                              <>
                                <Mail className="w-3 h-3" />
                                <span>Sent {formatDateTime(sRFQ.sentAt)}</span>
                              </>
                            )}
                            {sRFQ.viewedAt && (
                              <>
                                <Eye className="w-3 h-3 ml-2" />
                                <span>Viewed {formatDateTime(sRFQ.viewedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusColors[sRFQ.responseStatus] || 'bg-gray-100'}>
                          {formatStatus(sRFQ.responseStatus)}
                        </Badge>
                        {sRFQ.quotes.length > 0 && (
                          <Button variant="outline" size="sm">
                            View Quote
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Received Quotes</CardTitle>
              <CardDescription>Compare quotes from suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              {quotedSuppliers.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No quotes received yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotedSuppliers.map(sRFQ => {
                    const latestQuote = sRFQ.quotes[0]
                    return (
                      <div
                        key={sRFQ.id}
                        className="border rounded-lg p-4 hover:border-purple-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{sRFQ.supplier?.name || sRFQ.vendorName}</p>
                              <Badge className={statusColors[latestQuote.status]}>
                                {formatStatus(latestQuote.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              Quote #{latestQuote.quoteNumber} (v{latestQuote.version})
                            </p>
                            {latestQuote.submittedAt && (
                              <p className="text-xs text-gray-400">
                                Submitted {formatDateTime(latestQuote.submittedAt)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(latestQuote.totalAmount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {latestQuote.lineItems.length} items
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                          {latestQuote.status === 'SUBMITTED' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptQuote(latestQuote.id)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Accept Quote
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              {rfq.activities.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No activity yet</p>
              ) : (
                <div className="space-y-4">
                  {rfq.activities.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-gray-400">
                          {activity.user?.name && `${activity.user.name} • `}
                          {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quote Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Supplier Quotes</DialogTitle>
          </DialogHeader>
          <QuoteComparisonView
            rfqId={rfqId}
            onBack={() => setShowComparison(false)}
            onSelectQuote={(quoteId) => {
              handleAcceptQuote(quoteId)
              setShowComparison(false)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send RFQ to Suppliers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Select Suppliers</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rfq.supplierRFQs.map(sRFQ => (
                  <label
                    key={sRFQ.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSuppliers.includes(sRFQ.supplier?.id || sRFQ.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Checkbox
                      checked={selectedSuppliers.includes(sRFQ.supplier?.id || sRFQ.id)}
                      onCheckedChange={(checked) => {
                        const id = sRFQ.supplier?.id || sRFQ.id
                        if (checked) {
                          setSelectedSuppliers([...selectedSuppliers, id])
                        } else {
                          setSelectedSuppliers(selectedSuppliers.filter(s => s !== id))
                        }
                      }}
                      disabled={!!sRFQ.sentAt}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{sRFQ.supplier?.name || sRFQ.vendorName}</p>
                      <p className="text-sm text-gray-500">{sRFQ.supplier?.email || sRFQ.vendorEmail}</p>
                    </div>
                    {sRFQ.sentAt && (
                      <Badge variant="outline">Already sent</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Message (optional)</Label>
              <Textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Add a personal message to include in the email..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || selectedSuppliers.length === 0}>
              {sending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Send to {selectedSuppliers.length} Supplier(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
