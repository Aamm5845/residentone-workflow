'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Package,
  RefreshCw,
  MoreVertical,
  Mail,
  Eye,
  FileText,
  Percent,
  CreditCard,
  TrendingUp,
  Edit2,
  Check,
  X,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import toast from 'react-hot-toast'

interface ClientQuoteDetailViewProps {
  quoteId: string
  user: {
    id: string
    name: string
    role: string
  }
  orgId: string
}

interface ClientQuote {
  id: string
  quoteNumber: string
  title: string
  description?: string
  status: string
  version: number
  createdAt: string
  validUntil?: string
  sentToClientAt?: string
  subtotal?: number
  taxRate?: number
  taxAmount?: number
  shippingCost?: number
  totalAmount?: number
  defaultMarkupPercent?: number
  paymentTerms?: string
  depositRequired?: number
  depositAmount?: number
  paymentSchedule?: { label: string; percent: number }[] | null
  clientDecision?: string
  clientMessage?: string
  project: {
    id: string
    name: string
    projectNumber?: string
    client?: {
      id: string
      name: string
      email?: string
      phone?: string
    }
  }
  createdBy: {
    id: string
    name: string
  }
  lineItems: Array<{
    id: string
    itemName: string
    itemDescription?: string
    quantity: number
    unitType?: string
    costPrice?: number
    markupPercent?: number
    sellingPrice?: number
    totalCost?: number
    totalPrice?: number
    groupId?: string
    notes?: string
    roomFFEItem?: {
      id: string
      name: string
      section?: {
        name: string
      }
    }
    supplierQuote?: {
      id: string
      quoteNumber: string
      supplierRFQ?: {
        supplier?: {
          name: string
        }
      }
    }
  }>
  payments: Array<{
    id: string
    amount: number
    method: string
    status: string
    paidAt?: string
    createdAt: string
    confirmedBy?: {
      name: string
    }
  }>
  activities: Array<{
    id: string
    type: string
    message: string
    createdAt: string
    user?: {
      name: string
    }
  }>
  emailLogs: Array<{
    id: string
    to: string
    sentAt: string
    openedAt?: string
  }>
}

interface ProfitAnalysis {
  totalCost: number
  totalRevenue: number
  grossProfit: number
  marginPercent: number
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  INTERNAL_REVIEW: 'bg-yellow-100 text-yellow-800',
  SENT_TO_CLIENT: 'bg-blue-100 text-blue-800',
  CLIENT_REVIEWING: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600'
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  REFUNDED: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800'
}

export default function ClientQuoteDetailView({ quoteId, user, orgId }: ClientQuoteDetailViewProps) {
  const router = useRouter()
  const [quote, setQuote] = useState<ClientQuote | null>(null)
  const [profitAnalysis, setProfitAnalysis] = useState<ProfitAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Dialogs
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showEditMarkupDialog, setShowEditMarkupDialog] = useState(false)

  // Form states
  const [sending, setSending] = useState(false)
  const [clientEmail, setClientEmail] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  // Markup editing
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null)
  const [editMarkupValue, setEditMarkupValue] = useState('')

  useEffect(() => {
    loadQuote()
  }, [quoteId])

  const loadQuote = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/client-quotes/${quoteId}`)
      if (response.ok) {
        const data = await response.json()
        setQuote(data.quote)
        setProfitAnalysis(data.profitAnalysis)
        setClientEmail(data.quote.project.client?.email || '')
      } else {
        toast.error('Failed to load quote')
        router.push('/procurement')
      }
    } catch (error) {
      console.error('Error loading quote:', error)
      toast.error('Failed to load quote')
    } finally {
      setLoading(false)
    }
  }

  const handleSendToClient = async () => {
    if (!clientEmail) {
      toast.error('Please enter client email')
      return
    }

    setSending(true)
    try {
      const response = await fetch(`/api/client-quotes/${quoteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          clientEmail
        })
      })

      if (response.ok) {
        toast.success('Quote sent to client')
        setShowSendDialog(false)
        loadQuote()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send quote')
      }
    } catch (error) {
      toast.error('Failed to send quote')
    } finally {
      setSending(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSavingPayment(true)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientQuoteId: quoteId,
          amount: parseFloat(paymentAmount),
          method: paymentMethod,
          notes: paymentNotes || null
        })
      })

      if (response.ok) {
        toast.success('Payment recorded')
        setShowPaymentDialog(false)
        setPaymentAmount('')
        setPaymentNotes('')
        loadQuote()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to record payment')
      }
    } catch (error) {
      toast.error('Failed to record payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleUpdateMarkup = async (lineItemId: string, newMarkup: number) => {
    try {
      const response = await fetch(`/api/client-quotes/${quoteId}/line-items/${lineItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markupPercent: newMarkup })
      })

      if (response.ok) {
        toast.success('Markup updated')
        setEditingLineItemId(null)
        loadQuote()
      } else {
        toast.error('Failed to update markup')
      }
    } catch (error) {
      toast.error('Failed to update markup')
    }
  }

  const handleCreateOrder = async () => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: quote?.project.id,
          clientQuoteId: quoteId
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Order created')
        router.push(`/procurement/order/${data.order.id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create order')
      }
    } catch (error) {
      toast.error('Failed to create order')
    }
  }

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '$0.00'
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

  const getTotalPaid = () => {
    if (!quote) return 0
    return quote.payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0)
  }

  const getRemainingBalance = () => {
    const total = quote?.totalAmount || quote?.subtotal || 0
    return total - getTotalPaid()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900">Quote not found</h2>
        <Button variant="link" onClick={() => router.push('/procurement')}>
          Return to Procurement
        </Button>
      </div>
    )
  }

  // Group line items by category/group
  const groupedItems = quote.lineItems.reduce((groups: any, item) => {
    const key = item.groupId || item.roomFFEItem?.section?.name || 'Other'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {})

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
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteNumber}</h1>
              <Badge className={statusColors[quote.status] || 'bg-gray-100'}>
                {formatStatus(quote.status)}
              </Badge>
            </div>
            <p className="text-lg text-gray-600">{quote.title}</p>
            <p className="text-sm text-gray-400">
              {quote.project.name} &bull; {quote.project.client?.name || 'No client'} &bull; v{quote.version}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {quote.status === 'DRAFT' && (
              <Button onClick={() => setShowSendDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                Send to Client
              </Button>
            )}
            {quote.status === 'APPROVED' && (
              <>
                <Button variant="outline" onClick={() => setShowPaymentDialog(true)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
                <Button onClick={handleCreateOrder}>
                  <Package className="w-4 h-4 mr-2" />
                  Create Order
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
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Quote
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Quote
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
                <p className="text-sm text-gray-500">Quote Total</p>
                <p className="text-2xl font-bold">{formatCurrency(quote.totalAmount || quote.subtotal)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Profit Margin</p>
                <p className="text-2xl font-bold text-green-600">
                  {profitAnalysis?.marginPercent.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Gross Profit</p>
                <p className="text-2xl font-bold">{formatCurrency(profitAnalysis?.grossProfit)}</p>
              </div>
              <Percent className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Balance Due</p>
                <p className={`text-2xl font-bold ${getRemainingBalance() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(getRemainingBalance())}
                </p>
              </div>
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Line Items ({quote.lineItems.length})</TabsTrigger>
          <TabsTrigger value="pricing">Pricing & Markup</TabsTrigger>
          <TabsTrigger value="payments">Payments ({quote.payments.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quote Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Client</p>
                    <p className="font-medium">{quote.project.client?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <p className="font-medium">{quote.project.name}</p>
                  </div>
                </div>
                {quote.description && (
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-gray-700">{quote.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {quote.validUntil && (
                    <div>
                      <p className="text-sm text-gray-500">Valid Until</p>
                      <p className="font-medium text-orange-600">{formatDate(quote.validUntil)}</p>
                    </div>
                  )}
                  {quote.paymentTerms && (
                    <div>
                      <p className="text-sm text-gray-500">Payment Terms</p>
                      <p className="font-medium">{quote.paymentTerms}</p>
                    </div>
                  )}
                </div>
                {quote.paymentSchedule && (quote.paymentSchedule as any[]).length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Payment Schedule</p>
                    <div className="space-y-1">
                      {(quote.paymentSchedule as { label: string; percent: number }[]).map((milestone, idx) => {
                        const amount = quote.totalAmount ? parseFloat(quote.totalAmount.toString()) * milestone.percent / 100 : 0
                        return (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">{milestone.label || 'Payment'} ({milestone.percent}%)</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : quote.depositRequired ? (
                  <div>
                    <p className="text-sm text-gray-500">Deposit Required</p>
                    <p className="font-medium">{quote.depositRequired}% ({formatCurrency(quote.depositAmount)})</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal (Cost)</span>
                    <span>{formatCurrency(profitAnalysis?.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal (Selling)</span>
                    <span>{formatCurrency(quote.subtotal)}</span>
                  </div>
                  {quote.taxRate && quote.taxRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tax ({quote.taxRate}%)</span>
                      <span>{formatCurrency(quote.taxAmount)}</span>
                    </div>
                  )}
                  {quote.shippingCost && quote.shippingCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shipping</span>
                      <span>{formatCurrency(quote.shippingCost)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(quote.totalAmount || quote.subtotal)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-green-600">
                      <span>Gross Profit</span>
                      <span className="font-medium">{formatCurrency(profitAnalysis?.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Margin</span>
                      <span className="font-medium">{profitAnalysis?.marginPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Line Items Tab */}
        <TabsContent value="items" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>All items included in this quote</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.entries(groupedItems).map(([group, items]: [string, any]) => (
                <div key={group} className="mb-6">
                  <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {group}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Markup</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.itemName}</p>
                            {item.supplierQuote && (
                              <p className="text-xs text-gray-400">
                                via {item.supplierQuote.supplierRFQ?.supplier?.name || 'Supplier'}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{item.markupPercent || 0}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.sellingPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Markup by Item</CardTitle>
                  <CardDescription>Adjust markup percentages for each item</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Markup %</TableHead>
                        <TableHead className="text-right">Sell Price</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quote.lineItems.map((item) => {
                        const cost = item.costPrice || 0
                        const sell = item.sellingPrice || 0
                        const profit = (sell - cost) * item.quantity
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                            <TableCell className="text-right">
                              {editingLineItemId === item.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    value={editMarkupValue}
                                    onChange={(e) => setEditMarkupValue(e.target.value)}
                                    className="w-20 h-8 text-right"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateMarkup(item.id, parseFloat(editMarkupValue))}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingLineItemId(null)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLineItemId(item.id)
                                    setEditMarkupValue((item.markupPercent || 0).toString())
                                  }}
                                  className="hover:bg-gray-100 px-2 py-1 rounded"
                                >
                                  {item.markupPercent || 0}%
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(sell)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(profit)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Profit Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Total Profit</p>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(profitAnalysis?.grossProfit)}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    {profitAnalysis?.marginPercent.toFixed(1)}% margin
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Cost</span>
                    <span>{formatCurrency(profitAnalysis?.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Revenue</span>
                    <span>{formatCurrency(profitAnalysis?.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Default Markup</span>
                    <span>{quote.defaultMarkupPercent || 25}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Payment history for this quote</CardDescription>
              </div>
              {quote.status === 'APPROVED' && (
                <Button onClick={() => setShowPaymentDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Quote Total</p>
                  <p className="text-xl font-bold">{formatCurrency(quote.totalAmount || quote.subtotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(getTotalPaid())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Balance Due</p>
                  <p className={`text-xl font-bold ${getRemainingBalance() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(getRemainingBalance())}
                  </p>
                </div>
              </div>

              {quote.payments.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No payments recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confirmed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDateTime(payment.paidAt || payment.createdAt)}</TableCell>
                        <TableCell>{payment.method.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <Badge className={paymentStatusColors[payment.status]}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.confirmedBy?.name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
              {quote.activities.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No activity yet</p>
              ) : (
                <div className="space-y-4">
                  {quote.activities.map(activity => (
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

      {/* Send to Client Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quote to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Client Email</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Quote Summary</p>
              <p className="font-medium">{quote.title}</p>
              <p className="text-2xl font-bold mt-2">{formatCurrency(quote.totalAmount || quote.subtotal)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendToClient} disabled={sending}>
              {sending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              <Mail className="w-4 h-4 mr-2" />
              Send Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Balance due: {formatCurrency(getRemainingBalance())}
              </p>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  <SelectItem value="E_TRANSFER">E-Transfer (Interac)</SelectItem>
                  <SelectItem value="WIRE_TRANSFER">Wire Transfer</SelectItem>
                  <SelectItem value="ACH_BANK_TRANSFER">ACH Bank Transfer</SelectItem>
                  <SelectItem value="CHECK">Check</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
