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
  const [activeTab, setActiveTab] = useState<'proposals' | 'invoices'>('proposals')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingProposal, setDeletingProposal] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
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
    } catch (err) {
      console.error('Error loading billing data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getProposalStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <FileText className="w-3 h-3" /> },
      SENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Send className="w-3 h-3" /> },
      VIEWED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Eye className="w-3 h-3" /> },
      SIGNED: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      EXPIRED: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" /> },
      DECLINED: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    }
    const config = configs[status] || configs.DRAFT
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {status}
      </span>
    )
  }

  const getInvoiceStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <FileText className="w-3 h-3" /> },
      SENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Send className="w-3 h-3" /> },
      VIEWED: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Eye className="w-3 h-3" /> },
      PARTIALLY_PAID: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <DollarSign className="w-3 h-3" /> },
      PAID: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', icon: <AlertCircle className="w-3 h-3" /> },
    }
    const config = configs[status] || configs.DRAFT
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {status.replace('_', ' ')}
      </span>
    )
  }

  const copyProposalLink = async (proposalId: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/client/proposal/${proposalId}`
    await navigator.clipboard.writeText(link)
    setCopiedId(proposalId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyInvoiceLink = async (accessToken: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/client/billing-invoice/${accessToken}`
    await navigator.clipboard.writeText(link)
    setCopiedId(accessToken)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sendProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/billing/proposals/${proposalId}/send`, {
        method: 'POST',
      })
      if (response.ok) {
        await loadData()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send proposal')
      }
    } catch (err) {
      console.error('Error sending proposal:', err)
      alert('Failed to send proposal')
    }
  }

  const deleteProposal = async (proposalId: string, proposalNumber: string) => {
    if (!confirm(`Are you sure you want to delete proposal ${proposalNumber}? This cannot be undone.`)) {
      return
    }

    setDeletingProposal(proposalId)
    try {
      const response = await fetch(`/api/billing/proposals/${proposalId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadData()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete proposal')
      }
    } catch (err) {
      console.error('Error deleting proposal:', err)
      alert('Failed to delete proposal')
    } finally {
      setDeletingProposal(null)
    }
  }

  // Calculate totals
  const totalProposalValue = proposals.filter(p => p.status === 'SIGNED').reduce((sum, p) => sum + p.totalAmount, 0)
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalAmount, 0)
  const totalPaid = invoices.reduce((sum, i) => sum + i.amountPaid, 0)
  const totalOutstanding = invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((sum, i) => sum + i.balanceDue, 0)

  return (
    <div className="min-h-[calc(100vh-4rem)] -mt-6">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href={`/projects/${projectId}`} className="hover:text-gray-700">
                  {projectName}
                </Link>
                <span>/</span>
                <span className="text-gray-900">Billing</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Project Billing</h1>
              <p className="text-gray-500 mt-1">{client.name} • {client.email}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/billing/proposals/new`)}
              >
                <Plus className="w-4 h-4 mr-2" />
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

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Signed Proposals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalProposalValue)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Invoiced</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalInvoiced)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'proposals'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Proposals ({proposals.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Receipt className="w-4 h-4 inline-block mr-2" />
            Invoices ({invoices.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : activeTab === 'proposals' ? (
          /* Proposals List */
          <div className="bg-white rounded-xl border overflow-hidden">
            {proposals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals yet</h3>
                <p className="text-gray-500 mb-4">Create your first proposal for this project</p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
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
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Valid Until</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{proposal.title}</p>
                          <p className="text-sm text-gray-500">{proposal.proposalNumber} • {proposal.billingType}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getProposalStatusBadge(proposal.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(proposal.totalAmount)}</p>
                        {proposal.depositAmount && (
                          <p className="text-sm text-gray-500">Deposit: {formatCurrency(proposal.depositAmount)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {formatDate(proposal.validUntil)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {proposal.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => sendProposal(proposal.id)}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Send
                            </Button>
                          )}
                          {proposal.status === 'SIGNED' && (
                            <Link href={`/projects/${projectId}/billing/invoices/new?proposalId=${proposal.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                <Receipt className="w-4 h-4 mr-1" />
                                Invoice
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyProposalLink(proposal.id)}
                            title="Copy link"
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
                          <Link href={`/client/proposal/${proposal.id}`} target="_blank">
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
        ) : (
          /* Invoices List */
          <div className="bg-white rounded-xl border overflow-hidden">
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
                <p className="text-gray-500 mb-4">Invoices are automatically created when proposals are signed</p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/projects/${projectId}/billing/invoices/new`)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Manual Invoice
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Invoice</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Due Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{invoice.title}</p>
                          <p className="text-sm text-gray-500">{invoice.invoiceNumber} • {invoice.type}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getInvoiceStatusBadge(invoice.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                        {invoice.amountPaid > 0 && invoice.status !== 'PAID' && (
                          <p className="text-sm text-gray-500">
                            Paid: {formatCurrency(invoice.amountPaid)} | Due: {formatCurrency(invoice.balanceDue)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInvoiceLink(invoice.accessToken || invoice.id)}
                            title="Copy link"
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
