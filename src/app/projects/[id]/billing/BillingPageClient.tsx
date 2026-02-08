'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Receipt,
  Plus,
  Send,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  Download,
  AlertTriangle,
  Search,
  Filter,
  MailOpen,
  DollarSign,
  Calendar,
  ChevronRight,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import SendInvoiceDialog from '@/components/billing/invoices/SendInvoiceDialog'
import RecordPaymentDialog from '@/components/billing/invoices/RecordPaymentDialog'
import { toast } from 'sonner'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
}

interface Proposal {
  id: string
  proposalNumber: string
  title: string
  billingType: string
  status: string
  totalAmount: number
  depositAmount: number | null
  validUntil: string | null
  sentAt: string | null
  viewedAt: string | null
  signedAt: string | null
  clientName: string
  clientEmail: string
  createdAt: string
  createdBy: { id: string; name: string } | null
  accessToken?: string
}

interface LineItem {
  id: string
  type: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  description?: string
  type: string
  status: string
  totalAmount: number
  subtotal: number
  amountPaid: number
  balanceDue: number
  gstRate?: number
  gstAmount?: number
  qstRate?: number
  qstAmount?: number
  dueDate: string | null
  sentAt: string | null
  paidInFullAt: string | null
  clientName: string
  clientEmail: string
  clientPhone?: string
  clientAddress?: string
  createdAt: string
  accessToken?: string
  allowCreditCard: boolean
  ccFeePercent: number
  notes?: string
  lineItems: LineItem[]
}

interface Organization {
  name: string
  businessName?: string
  businessEmail?: string
  businessPhone?: string
  businessAddress?: string
  businessCity?: string
  businessProvince?: string
  businessPostal?: string
  wireInstructions?: string
  etransferEmail?: string
}

interface BillingPageClientProps {
  projectId: string
  projectName: string
  projectType: string
  projectAddress?: string
  client: Client
  defaultGstRate: number
  defaultQstRate: number
  organization?: Organization | null
}

export default function BillingPageClient({
  projectId,
  projectName,
  projectType,
  projectAddress,
  client,
  defaultGstRate,
  defaultQstRate,
  organization,
}: BillingPageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'invoices' | 'proposals'>('invoices')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [unbilledSummary, setUnbilledSummary] = useState<{
    totalUnbilledHours: number
    entryCount: number
    estimatedAmount: number | null
  } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendingProposal, setSendingProposal] = useState<string | null>(null)
  const [deletingProposal, setDeletingProposal] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Send invoice dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Record payment dialog
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)

  // Sending receipt state
  const [sendingReceipt, setSendingReceipt] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [proposalsRes, invoicesRes, unbilledRes] = await Promise.all([
          fetch(`/api/billing/proposals?projectId=${projectId}`),
          fetch(`/api/billing/invoices?projectId=${projectId}`),
          fetch(`/api/billing/unbilled-hours?projectId=${projectId}`),
        ])

        if (proposalsRes.ok) {
          const data = await proposalsRes.json()
          setProposals(data)
        }

        if (invoicesRes.ok) {
          const data = await invoicesRes.json()
          setInvoices(data)
        }

        if (unbilledRes.ok) {
          const data = await unbilledRes.json()
          setUnbilledSummary(data.summary)
        }
      } catch (error) {
        console.error('Error fetching billing data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCurrencyFull = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatRelativeDate = (date: string | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(date)
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Edit, label: 'Draft' },
      SENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Send, label: 'Sent' },
      VIEWED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Eye, label: 'Viewed' },
      SIGNED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Signed' },
      EXPIRED: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Expired' },
      DECLINED: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Declined' },
      PARTIALLY_PAID: { bg: 'bg-amber-100', text: 'text-amber-700', icon: DollarSign, label: 'Partial' },
      PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Paid' },
      OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: 'Overdue' },
      CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', icon: AlertCircle, label: 'Cancelled' },
      VOID: { bg: 'bg-slate-100', text: 'text-slate-500', icon: AlertCircle, label: 'Void' },
    }
    return configs[status] || configs.DRAFT
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copyProposalLink = async (proposalId: string) => {
    const token = proposals.find(p => p.id === proposalId)?.accessToken || proposalId
    const link = `${baseUrl}/client/proposal/${token}`
    await navigator.clipboard.writeText(link)
    setCopiedId(proposalId)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyInvoiceLink = async (accessToken: string) => {
    const invoiceItem = invoices.find(i => i.accessToken === accessToken || i.id === accessToken)
    const link = `${baseUrl}/client/billing-invoice/${invoiceItem?.accessToken || accessToken}`
    await navigator.clipboard.writeText(link)
    setCopiedId(accessToken)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sendProposal = async (proposalId: string) => {
    setSendingProposal(proposalId)
    try {
      const response = await fetch(`/api/billing/proposals/${proposalId}/send`, {
        method: 'POST',
      })
      if (response.ok) {
        const updated = proposals.map(p =>
          p.id === proposalId ? { ...p, status: 'SENT', sentAt: new Date().toISOString() } : p
        )
        setProposals(updated)
        toast.success('Proposal sent successfully')
      }
    } catch (error) {
      console.error('Error sending proposal:', error)
      toast.error('Failed to send proposal')
    } finally {
      setSendingProposal(null)
    }
  }

  const deleteProposal = async (proposalId: string, proposalNumber: string) => {
    if (!confirm(`Are you sure you want to delete proposal ${proposalNumber}?`)) return
    setDeletingProposal(proposalId)
    try {
      const response = await fetch(`/api/billing/proposals/${proposalId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setProposals(proposals.filter(p => p.id !== proposalId))
        toast.success('Proposal deleted')
      }
    } catch (error) {
      console.error('Error deleting proposal:', error)
      toast.error('Failed to delete proposal')
    } finally {
      setDeletingProposal(null)
    }
  }

  const openSendDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setSendDialogOpen(true)
  }

  const handleSendSuccess = () => {
    // Refresh invoices
    fetch(`/api/billing/invoices?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => setInvoices(data))
      .catch(console.error)
  }

  const openRecordPayment = (invoice: Invoice) => {
    setPaymentInvoice(invoice)
    setRecordPaymentOpen(true)
  }

  const handlePaymentSuccess = () => {
    // Refresh invoices
    fetch(`/api/billing/invoices?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => setInvoices(data))
      .catch(console.error)
  }

  const sendReceipt = async (invoiceId: string) => {
    setSendingReceipt(invoiceId)
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/send-receipt`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || 'Receipt sent successfully')
      } else {
        toast.error(data.error || 'Failed to send receipt')
      }
    } catch (error) {
      console.error('Error sending receipt:', error)
      toast.error('Failed to send receipt')
    } finally {
      setSendingReceipt(null)
    }
  }

  // Calculate quick stats
  const now = new Date()
  const outstandingInvoices = invoices.filter(i =>
    !['PAID', 'CANCELLED', 'VOID'].includes(i.status)
  )
  const overdueInvoices = outstandingInvoices.filter(i =>
    i.dueDate && new Date(i.dueDate) < now
  )
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balanceDue, 0)
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0)

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = searchQuery === '' ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Filter proposals
  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = searchQuery === '' ||
      proposal.proposalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.title.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Link href={`/projects/${projectId}`} className="hover:text-slate-700">
                  {projectName}
                </Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-slate-900 font-medium">Billing</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
              <p className="text-slate-500 mt-1">{client.name}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/billing/proposals/new`)}
              >
                <FileText className="w-4 h-4 mr-2" />
                New Proposal
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
              >
                <Receipt className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Unbilled Hours Card */}
        {activeTab === 'invoices' && unbilledSummary && unbilledSummary.totalUnbilledHours > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{unbilledSummary.totalUnbilledHours} hrs</p>
                <p className="text-sm text-slate-500">
                  {unbilledSummary.entryCount} unbilled {unbilledSummary.entryCount === 1 ? 'entry' : 'entries'}
                  {unbilledSummary.estimatedAmount && (
                    <span className="text-blue-600 ml-1">({formatCurrencyFull(unbilledSummary.estimatedAmount)})</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Invoice Now
            </Button>
          </div>
        )}

        {/* Quick Stats - Simplified */}
        {activeTab === 'invoices' && invoices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
                <p className="text-sm text-slate-500">{outstandingInvoices.length} outstanding invoice{outstandingInvoices.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {totalOverdue > 0 && (
              <div className="bg-white rounded-xl border border-red-200 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
                  <p className="text-sm text-slate-500">{overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs & Search */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex flex-col md:flex-row md:items-center gap-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'invoices'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Invoices
                {invoices.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600">
                    {invoices.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('proposals')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'proposals'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Proposals
                {proposals.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600">
                    {proposals.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search & Filter */}
            <div className="flex-1 flex items-center gap-3 md:justify-end">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {activeTab === 'invoices' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      {statusFilter === 'all' ? 'All' : getStatusConfig(statusFilter).label}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                      All Invoices
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setStatusFilter('DRAFT')}>Draft</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('SENT')}>Sent</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('VIEWED')}>Viewed</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('PARTIALLY_PAID')}>Partially Paid</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('PAID')}>Paid</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('OVERDUE')}>Overdue</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : activeTab === 'invoices' ? (
            // Invoice List
            filteredInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {invoices.length === 0 ? 'No invoices yet' : 'No invoices match your filters'}
                </h3>
                <p className="text-slate-500 mb-6">
                  {invoices.length === 0
                    ? 'Create your first invoice for this project'
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {invoices.length === 0 && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredInvoices.map((invoice) => {
                  const statusConfig = getStatusConfig(invoice.status)
                  const StatusIcon = statusConfig.icon
                  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < now && !['PAID', 'CANCELLED', 'VOID'].includes(invoice.status)

                  return (
                    <div
                      key={invoice.id}
                      className="p-5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`w-10 h-10 rounded-full ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig.text}`} />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900">
                                  {invoice.invoiceNumber}
                                </h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                  {statusConfig.label}
                                </span>
                                {isOverdue && invoice.status !== 'OVERDUE' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mt-0.5">{invoice.title}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Due {invoice.dueDate ? formatDate(invoice.dueDate) : 'Upon receipt'}
                                </span>
                                {invoice.sentAt && (
                                  <span className="flex items-center gap-1">
                                    <MailOpen className="w-3 h-3" />
                                    Sent {formatRelativeDate(invoice.sentAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              <p className="text-lg font-semibold text-slate-900">
                                {formatCurrencyFull(invoice.totalAmount)}
                              </p>
                              {invoice.balanceDue > 0 && invoice.balanceDue < invoice.totalAmount && (
                                <p className="text-sm text-amber-600">
                                  {formatCurrencyFull(invoice.balanceDue)} due
                                </p>
                              )}
                              {invoice.status === 'PAID' && (
                                <p className="text-sm text-emerald-600">Paid in full</p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4">
                            {invoice.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => openSendDialog(invoice)}
                              >
                                <Send className="w-4 h-4 mr-1" />
                                Send
                              </Button>
                            )}
                            {['SENT', 'VIEWED', 'OVERDUE'].includes(invoice.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openSendDialog(invoice)}
                              >
                                <Bell className="w-4 h-4 mr-1" />
                                Send Reminder
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInvoiceLink(invoice.accessToken || invoice.id)}
                            >
                              {copiedId === (invoice.accessToken || invoice.id) ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Link href={`/client/billing-invoice/${invoice.accessToken || invoice.id}`} target="_blank">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}/billing/invoices/${invoice.id}/edit`)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInvoiceLink(invoice.accessToken || invoice.id)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/client/billing-invoice/${invoice.accessToken || invoice.id}`, '_blank')}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View as Client
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {invoice.status !== 'PAID' && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' && (
                                  <DropdownMenuItem onClick={() => openRecordPayment(invoice)}>
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Record Payment
                                  </DropdownMenuItem>
                                )}
                                {(invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') && (
                                  <DropdownMenuItem
                                    onClick={() => sendReceipt(invoice.id)}
                                    disabled={sendingReceipt === invoice.id}
                                  >
                                    {sendingReceipt === invoice.id ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Receipt className="w-4 h-4 mr-2" />
                                    )}
                                    Send Receipt
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => window.open(`/api/billing/invoices/${invoice.id}/pdf`, '_blank')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            // Proposals List
            filteredProposals.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {proposals.length === 0 ? 'No proposals yet' : 'No proposals match your search'}
                </h3>
                <p className="text-slate-500 mb-6">
                  {proposals.length === 0
                    ? 'Create your first proposal for this project'
                    : 'Try adjusting your search criteria'}
                </p>
                {proposals.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/projects/${projectId}/billing/proposals/new`)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Proposal
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredProposals.map((proposal) => {
                  const statusConfig = getStatusConfig(proposal.status)
                  const StatusIcon = statusConfig.icon

                  return (
                    <div
                      key={proposal.id}
                      className="p-5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`w-10 h-10 rounded-full ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig.text}`} />
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900">
                                  {proposal.proposalNumber}
                                </h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-0.5">{proposal.title}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                {proposal.validUntil && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Valid until {formatDate(proposal.validUntil)}
                                  </span>
                                )}
                                {proposal.sentAt && (
                                  <span className="flex items-center gap-1">
                                    <MailOpen className="w-3 h-3" />
                                    Sent {formatRelativeDate(proposal.sentAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              <p className="text-lg font-semibold text-slate-900">
                                {formatCurrencyFull(proposal.totalAmount)}
                              </p>
                              {proposal.depositAmount && proposal.depositAmount > 0 && (
                                <p className="text-sm text-slate-500">
                                  {formatCurrencyFull(proposal.depositAmount)} deposit
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4">
                            {proposal.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => sendProposal(proposal.id)}
                                disabled={sendingProposal === proposal.id}
                              >
                                {sendingProposal === proposal.id ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-1" />
                                )}
                                Send
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyProposalLink(proposal.id)}
                            >
                              {copiedId === proposal.id ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/api/billing/proposals/${proposal.id}/generate-pdf`, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Link href={`/client/proposal/${proposal.accessToken || proposal.id}`} target="_blank">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}/billing/proposals/${proposal.id}/edit`)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Proposal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyProposalLink(proposal.id)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/client/proposal/${proposal.accessToken || proposal.id}`, '_blank')}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View as Client
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/api/billing/proposals/${proposal.id}/generate-pdf`, '_blank')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                {proposal.status === 'DRAFT' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => deleteProposal(proposal.id, proposal.proposalNumber)}
                                      disabled={deletingProposal === proposal.id}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      {deletingProposal === proposal.id ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4 mr-2" />
                                      )}
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Send Invoice Dialog */}
      {selectedInvoice && (
        <SendInvoiceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          invoice={selectedInvoice}
          organization={organization}
          projectId={projectId}
          onSuccess={handleSendSuccess}
        />
      )}

      {/* Record Payment Dialog */}
      {paymentInvoice && (
        <RecordPaymentDialog
          open={recordPaymentOpen}
          onOpenChange={setRecordPaymentOpen}
          invoice={paymentInvoice}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
