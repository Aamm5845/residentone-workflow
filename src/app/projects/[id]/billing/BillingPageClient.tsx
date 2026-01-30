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
  DollarSign,
  Download,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  type: string
  status: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  dueDate: string | null
  sentAt: string | null
  paidInFullAt: string | null
  clientName: string
  createdAt: string
  accessToken?: string
}

interface BillingPageClientProps {
  projectId: string
  projectName: string
  projectType: string
  projectAddress?: string
  client: Client
  defaultGstRate: number
  defaultQstRate: number
}

export default function BillingPageClient({
  projectId,
  projectName,
  projectType,
  projectAddress,
  client,
  defaultGstRate,
  defaultQstRate,
}: BillingPageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'invoices' | 'proposals'>('invoices')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sendingProposal, setSendingProposal] = useState<string | null>(null)
  const [deletingProposal, setDeletingProposal] = useState<string | null>(null)
  const [totalView, setTotalView] = useState<'created' | 'paid'>('created')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [proposalsRes, invoicesRes] = await Promise.all([
          fetch(`/api/billing/proposals?projectId=${projectId}`),
          fetch(`/api/billing/invoices?projectId=${projectId}`),
        ])

        if (proposalsRes.ok) {
          const data = await proposalsRes.json()
          setProposals(data)
        }

        if (invoicesRes.ok) {
          const data = await invoicesRes.json()
          setInvoices(data)
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
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      SENT: 'bg-blue-100 text-blue-700',
      VIEWED: 'bg-purple-100 text-purple-700',
      SIGNED: 'bg-green-100 text-green-700',
      EXPIRED: 'bg-red-100 text-red-700',
      DECLINED: 'bg-red-100 text-red-700',
      PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
      PAID: 'bg-green-100 text-green-700',
      OVERDUE: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      VOID: 'bg-gray-100 text-gray-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'SIGNED':
        return <CheckCircle className="w-4 h-4" />
      case 'SENT':
      case 'VIEWED':
        return <Eye className="w-4 h-4" />
      case 'OVERDUE':
      case 'EXPIRED':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copyProposalLink = async (proposalId: string) => {
    const token = proposals.find(p => p.id === proposalId)?.accessToken || proposalId
    const link = `${baseUrl}/client/proposal/${token}`
    await navigator.clipboard.writeText(link)
    setCopiedId(proposalId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyInvoiceLink = async (accessToken: string) => {
    const invoiceItem = invoices.find(i => i.accessToken === accessToken || i.id === accessToken)
    const link = `${baseUrl}/client/billing-invoice/${invoiceItem?.accessToken || accessToken}`
    await navigator.clipboard.writeText(link)
    setCopiedId(accessToken)
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
      }
    } catch (error) {
      console.error('Error sending proposal:', error)
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
      }
    } catch (error) {
      console.error('Error deleting proposal:', error)
    } finally {
      setDeletingProposal(null)
    }
  }

  // Calculate invoice stats
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)

  const thisMonthInvoices = invoices.filter(i => {
    const date = new Date(i.createdAt)
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear
  })

  const last12MonthsInvoices = invoices.filter(i => {
    const date = new Date(i.createdAt)
    return date >= twelveMonthsAgo
  })

  const thisMonthCreated = thisMonthInvoices.reduce((sum, i) => sum + i.totalAmount, 0)
  const thisMonthPaid = thisMonthInvoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.totalAmount, 0)

  const outstandingInvoices = last12MonthsInvoices.filter(i =>
    !['PAID', 'CANCELLED', 'VOID'].includes(i.status)
  )
  const overdueInvoices = outstandingInvoices.filter(i =>
    i.dueDate && new Date(i.dueDate) < now
  )
  const unpaidInvoices = outstandingInvoices.filter(i => i.amountPaid === 0)

  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balanceDue, 0)
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + i.balanceDue, 0)
  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + i.balanceDue, 0)

  const totalCreated = invoices.reduce((sum, i) => sum + i.totalAmount, 0)
  const totalPaid = invoices.reduce((sum, i) => sum + i.amountPaid, 0)

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href={`/projects/${projectId}`} className="hover:text-gray-700">
                  {projectName}
                </Link>
                <span>/</span>
                <span className="text-gray-900">Billing</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
              <p className="text-gray-500 mt-1">{client.name} • {client.email}</p>
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
        {/* Overview Section */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Invoice
            </button>
            <button
              onClick={() => setActiveTab('proposals')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'proposals'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Proposal
            </button>
          </div>

          {activeTab === 'invoices' && (
            <>
              {/* This Month */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">This month</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-5">
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(thisMonthCreated)}</p>
                    <p className="text-sm text-gray-500 mt-1">Created</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-5">
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(thisMonthPaid)}</p>
                    <p className="text-sm text-gray-500 mt-1">Paid</p>
                  </div>
                </div>
              </div>

              {/* Last 12 Months */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Last 12 months</h3>
                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
                      <p className="text-sm text-gray-500 mt-1">Outstanding ({outstandingInvoices.length})</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
                      <p className="text-sm text-gray-500 mt-1">Overdue ({overdueInvoices.length})</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-gray-400">{formatCurrency(totalUnpaid)}</p>
                      <p className="text-sm text-gray-500 mt-1">Unpaid ({unpaidInvoices.length})</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => setTotalView('created')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      totalView === 'created'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Total created
                  </button>
                  <button
                    onClick={() => setTotalView('paid')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      totalView === 'paid'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Total paid
                  </button>
                </div>
                <p className={`text-4xl font-bold ${totalView === 'paid' ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatCurrency(totalView === 'created' ? totalCreated : totalPaid)}
                </p>
              </div>
            </>
          )}

          {activeTab === 'proposals' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-3xl font-bold text-gray-900">{proposals.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total Proposals</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-3xl font-bold text-green-600">
                  {proposals.filter(p => p.status === 'SIGNED').length}
                </p>
                <p className="text-sm text-gray-500 mt-1">Signed</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-3xl font-bold text-amber-600">
                  {proposals.filter(p => ['SENT', 'VIEWED'].includes(p.status)).length}
                </p>
                <p className="text-sm text-gray-500 mt-1">Pending</p>
              </div>
            </div>
          )}
        </div>

        {/* Invoice/Proposal List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : activeTab === 'invoices' ? (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Invoices</h3>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Invoice
              </Button>
            </div>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
                <p className="text-gray-500 mb-4">Create your first invoice for this project</p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Invoice</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Due Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Balance</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500">{invoice.title}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrencyFull(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={invoice.balanceDue > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                          {formatCurrencyFull(invoice.balanceDue)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInvoiceLink(invoice.accessToken || invoice.id)}
                            title="Copy Link"
                          >
                            {copiedId === (invoice.accessToken || invoice.id) ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Link href={`/client/billing-invoice/${invoice.accessToken || invoice.id}`} target="_blank">
                            <Button variant="ghost" size="sm" title="Preview">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/projects/${projectId}/billing/invoices/${invoice.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Proposals List */
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Proposals</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/billing/proposals/new`)}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Proposal
              </Button>
            </div>
            {proposals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals yet</h3>
                <p className="text-gray-500 mb-4">Create your first proposal for this project</p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${projectId}/billing/proposals/new`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Proposal
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Proposal</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Valid Until</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{proposal.proposalNumber}</p>
                          <p className="text-sm text-gray-500">{proposal.title}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(proposal.status)}`}>
                          {getStatusIcon(proposal.status)}
                          {proposal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(proposal.validUntil)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrencyFull(proposal.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {proposal.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendProposal(proposal.id)}
                              disabled={sendingProposal === proposal.id}
                              title="Send"
                            >
                              {sendingProposal === proposal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyProposalLink(proposal.id)}
                            title="Copy Link"
                          >
                            {copiedId === proposal.id ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/billing/proposals/${proposal.id}/generate-pdf`, '_blank')}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Link href={`/client/proposal/${proposal.accessToken || proposal.id}`} target="_blank">
                            <Button variant="ghost" size="sm" title="Preview">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/projects/${projectId}/billing/proposals/${proposal.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          {proposal.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete"
                              onClick={() => deleteProposal(proposal.id, proposal.proposalNumber)}
                              disabled={deletingProposal === proposal.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingProposal === proposal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
