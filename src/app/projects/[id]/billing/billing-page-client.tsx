'use client'

import { useState } from 'react'
import { Plus, FileText, Receipt, Send, Eye, CheckCircle, Clock, AlertCircle, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Proposal {
  id: string
  proposalNumber: string
  title: string
  status: string
  totalAmount: number
  validUntil: string | null
  sentAt: string | null
  signedAt: string | null
  createdAt: string
  clientName: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  status: string
  type: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  dueDate: string | null
  issueDate: string
  sentAt: string | null
  createdAt: string
  clientName: string
}

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
}

interface BillingPageClientProps {
  projectId: string
  projectName: string
  client: Client
  proposals: Proposal[]
  invoices: Invoice[]
}

export default function BillingPageClient({
  projectId,
  projectName,
  client,
  proposals,
  invoices,
}: BillingPageClientProps) {
  const [activeTab, setActiveTab] = useState<'proposals' | 'invoices'>('proposals')

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
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      DRAFT: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
      SENT: { color: 'bg-blue-100 text-blue-700', icon: <Send className="w-3 h-3" />, label: 'Sent' },
      VIEWED: { color: 'bg-purple-100 text-purple-700', icon: <Eye className="w-3 h-3" />, label: 'Viewed' },
      SIGNED: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Signed' },
      EXPIRED: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="w-3 h-3" />, label: 'Expired' },
      DECLINED: { color: 'bg-red-100 text-red-700', icon: <X className="w-3 h-3" />, label: 'Declined' },
    }
    const config = statusConfig[status] || statusConfig.DRAFT
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      DRAFT: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
      SENT: { color: 'bg-blue-100 text-blue-700', icon: <Send className="w-3 h-3" />, label: 'Sent' },
      VIEWED: { color: 'bg-purple-100 text-purple-700', icon: <Eye className="w-3 h-3" />, label: 'Viewed' },
      PARTIALLY_PAID: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="w-3 h-3" />, label: 'Partial' },
      PAID: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Paid' },
      OVERDUE: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" />, label: 'Overdue' },
      CANCELLED: { color: 'bg-gray-100 text-gray-500', icon: <X className="w-3 h-3" />, label: 'Cancelled' },
      VOID: { color: 'bg-gray-100 text-gray-500', icon: <X className="w-3 h-3" />, label: 'Void' },
    }
    const config = statusConfig[status] || statusConfig.DRAFT
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  const getInvoiceTypeBadge = (type: string) => {
    const typeConfig: Record<string, string> = {
      STANDARD: 'Standard',
      DEPOSIT: 'Deposit',
      MILESTONE: 'Milestone',
      HOURLY: 'Hourly',
      FINAL: 'Final',
    }
    return typeConfig[type] || type
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'proposals'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Proposals
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {proposals.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoices
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {invoices.length}
              </span>
            </div>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 py-3">
          {activeTab === 'proposals' && (
            <>
              <Link href={`/projects/${projectId}/billing/proposals/new?ai=true`}>
                <Button size="sm" variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Generate
                </Button>
              </Link>
              <Link href={`/projects/${projectId}/billing/proposals/new`}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-1" />
                  New Proposal
                </Button>
              </Link>
            </>
          )}
          {activeTab === 'invoices' && (
            <Link href={`/projects/${projectId}/billing/invoices/new`}>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" />
                New Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'proposals' && (
          <div>
            {proposals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No proposals yet</h3>
                <p className="text-gray-500 mb-4">Create your first proposal to get started</p>
                <div className="flex items-center justify-center gap-2">
                  <Link href={`/projects/${projectId}/billing/proposals/new?ai=true`}>
                    <Button variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                      <Sparkles className="w-4 h-4 mr-1" />
                      Generate with AI
                    </Button>
                  </Link>
                  <Link href={`/projects/${projectId}/billing/proposals/new`}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-1" />
                      Create Proposal
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b">
                      <th className="text-left py-3 px-2 font-medium">Proposal</th>
                      <th className="text-left py-3 px-2 font-medium">Client</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-right py-3 px-2 font-medium">Amount</th>
                      <th className="text-left py-3 px-2 font-medium">Valid Until</th>
                      <th className="text-left py-3 px-2 font-medium">Created</th>
                      <th className="text-right py-3 px-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {proposals.map((proposal) => (
                      <tr key={proposal.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-900">{proposal.proposalNumber}</p>
                            <p className="text-sm text-gray-500">{proposal.title}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {proposal.clientName}
                        </td>
                        <td className="py-3 px-2">
                          {getProposalStatusBadge(proposal.status)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-gray-900">
                          {formatCurrency(proposal.totalAmount)}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {formatDate(proposal.validUntil)}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-500">
                          {formatDate(proposal.createdAt)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Link href={`/projects/${projectId}/billing/proposals/${proposal.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices yet</h3>
                <p className="text-gray-500 mb-4">Create your first invoice to get started</p>
                <Link href={`/projects/${projectId}/billing/invoices/new`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-1" />
                    Create Invoice
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b">
                      <th className="text-left py-3 px-2 font-medium">Invoice</th>
                      <th className="text-left py-3 px-2 font-medium">Client</th>
                      <th className="text-left py-3 px-2 font-medium">Type</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-right py-3 px-2 font-medium">Amount</th>
                      <th className="text-right py-3 px-2 font-medium">Balance</th>
                      <th className="text-left py-3 px-2 font-medium">Due Date</th>
                      <th className="text-right py-3 px-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                            <p className="text-sm text-gray-500">{invoice.title}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {invoice.clientName}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {getInvoiceTypeBadge(invoice.type)}
                        </td>
                        <td className="py-3 px-2">
                          {getInvoiceStatusBadge(invoice.status)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </td>
                        <td className={`py-3 px-2 text-right font-medium ${invoice.balanceDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {formatCurrency(invoice.balanceDue)}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Link href={`/projects/${projectId}/billing/invoices/${invoice.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
