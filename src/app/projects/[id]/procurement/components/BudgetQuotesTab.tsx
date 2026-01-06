'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  MessageCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  ExternalLink,
  Copy,
  Mail,
  Calendar,
  DollarSign,
  Loader2,
  Trash2,
  Edit3
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface BudgetQuotesTabProps {
  projectId: string
  searchQuery: string
}

interface BudgetQuote {
  id: string
  token: string
  title: string
  description: string | null
  itemIds: string[]
  supplierQuoteIds: string[]
  estimatedTotal: number
  markupPercent: number | null
  currency: string
  includeTax: boolean
  includedServices: string[]
  status: string
  clientApproved: boolean
  clientApprovedAt: string | null
  clientQuestion: string | null
  clientEmail: string | null
  sentAt: string | null
  sentToEmail: string | null
  expiresAt: string | null
  viewedAt: string | null
  createdAt: string
  project: {
    id: string
    name: string
  }
  createdBy: {
    id: string
    name: string | null
    email: string
  }
}

interface Stats {
  total: number
  draft: number
  sent: number
  viewed: number
  approved: number
  questions: number
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
  PENDING: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
  SENT: { label: 'Sent', color: 'bg-blue-50 text-blue-700', icon: Send },
  VIEWED: { label: 'Viewed', color: 'bg-purple-50 text-purple-700', icon: Eye },
  APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  QUESTION_ASKED: { label: 'Question', color: 'bg-amber-50 text-amber-700', icon: MessageCircle },
  EXPIRED: { label: 'Expired', color: 'bg-red-50 text-red-600', icon: Clock },
}

export default function BudgetQuotesTab({ projectId, searchQuery }: BudgetQuotesTabProps) {
  const [budgetQuotes, setBudgetQuotes] = useState<BudgetQuote[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, viewed: 0, approved: 0, questions: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<BudgetQuote | null>(null)
  const [sendEmail, setSendEmail] = useState('')
  const [sending, setSending] = useState(false)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState<BudgetQuote | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchBudgetQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/budget-quotes?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch budget quotes')
      const data = await res.json()

      setBudgetQuotes(data)

      // Calculate stats
      const newStats: Stats = {
        total: data.length,
        draft: data.filter((q: BudgetQuote) => q.status === 'DRAFT' || q.status === 'PENDING').length,
        sent: data.filter((q: BudgetQuote) => q.status === 'SENT').length,
        viewed: data.filter((q: BudgetQuote) => q.status === 'VIEWED').length,
        approved: data.filter((q: BudgetQuote) => q.status === 'APPROVED' || q.clientApproved).length,
        questions: data.filter((q: BudgetQuote) => q.status === 'QUESTION_ASKED').length,
      }
      setStats(newStats)
    } catch (error) {
      console.error('Error fetching budget quotes:', error)
      toast.error('Failed to load budget quotes')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchBudgetQuotes()
  }, [fetchBudgetQuotes])

  // Filter quotes
  const filteredQuotes = budgetQuotes
    .filter(quote => {
      const matchesSearch = !searchQuery ||
        quote.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = !filterStatus || quote.status === filterStatus

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const toggleExpanded = (quoteId: string) => {
    setExpandedQuotes(prev => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }

  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return format(new Date(dateStr), 'MMM d, yyyy')
  }

  const openSendDialog = (quote: BudgetQuote) => {
    setSelectedQuote(quote)
    setSendEmail(quote.clientEmail || '')
    setSendDialogOpen(true)
  }

  const handleSend = async () => {
    if (!selectedQuote || !sendEmail.trim()) return

    setSending(true)
    try {
      const res = await fetch(`/api/budget-quotes/${selectedQuote.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim() })
      })

      if (!res.ok) throw new Error('Failed to send')

      toast.success('Budget quote sent successfully')
      setSendDialogOpen(false)
      setSelectedQuote(null)
      setSendEmail('')
      fetchBudgetQuotes()
    } catch (error) {
      console.error('Error sending budget quote:', error)
      toast.error('Failed to send budget quote')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!quoteToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/budget-quotes/${quoteToDelete.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast.success('Budget quote deleted')
      setDeleteDialogOpen(false)
      setQuoteToDelete(null)
      fetchBudgetQuotes()
    } catch (error) {
      console.error('Error deleting budget quote:', error)
      toast.error('Failed to delete budget quote')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteDialog = (quote: BudgetQuote) => {
    setQuoteToDelete(quote)
    setDeleteDialogOpen(true)
  }

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/budget-quote/${token}`
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard')
  }

  const getQuoteNumber = (id: string) => `BQ-${id.slice(-6).toUpperCase()}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === null ? 'ring-2 ring-violet-400' : ''}`}
          onClick={() => setFilterStatus(null)}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="w-2 h-8 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'SENT' ? 'ring-2 ring-blue-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'SENT' ? null : 'SENT')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.sent > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{stats.sent}</p>
                <p className="text-sm text-gray-500">Sent</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.sent > 0 ? 'bg-blue-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'VIEWED' ? 'ring-2 ring-purple-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'VIEWED' ? null : 'VIEWED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.viewed > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{stats.viewed}</p>
                <p className="text-sm text-gray-500">Viewed</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.viewed > 0 ? 'bg-purple-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'APPROVED' ? 'ring-2 ring-emerald-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'APPROVED' ? null : 'APPROVED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.approved > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.approved > 0 ? 'bg-emerald-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-gray-200 cursor-pointer transition-all ${filterStatus === 'QUESTION_ASKED' ? 'ring-2 ring-amber-400' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'QUESTION_ASKED' ? null : 'QUESTION_ASKED')}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-semibold ${stats.questions > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{stats.questions}</p>
                <p className="text-sm text-gray-500">Questions</p>
              </div>
              <div className={`w-2 h-8 rounded-full ${stats.questions > 0 ? 'bg-amber-200' : 'bg-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Quotes List */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Budget Quotes</CardTitle>
            <div className="flex items-center gap-2">
              {filterStatus && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-gray-600"
                  onClick={() => setFilterStatus(null)}
                >
                  Clear filter
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-gray-600"
                onClick={fetchBudgetQuotes}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No budget quotes yet</h3>
              <p className="text-sm text-gray-500">
                Create a budget quote from Supplier Quotes or All Specs
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium w-8"></TableHead>
                  <TableHead className="text-gray-500 font-medium">Quote #</TableHead>
                  <TableHead className="text-gray-500 font-medium">Title</TableHead>
                  <TableHead className="text-gray-500 font-medium">Items</TableHead>
                  <TableHead className="text-gray-500 font-medium">Total</TableHead>
                  <TableHead className="text-gray-500 font-medium">Created</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredQuotes.map((quote) => {
                const StatusIcon = statusConfig[quote.status]?.icon || FileText

                return (
                  <React.Fragment key={quote.id}>
                  <TableRow
                    className={`cursor-pointer hover:bg-gray-50 ${expandedQuotes.has(quote.id) ? 'bg-gray-50/50' : ''}`}
                    onClick={() => toggleExpanded(quote.id)}
                  >
                    {/* Expand button */}
                    <TableCell className="w-8 p-2">
                      <button className="text-gray-400 hover:text-gray-600">
                        {expandedQuotes.has(quote.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>

                    {/* Quote # */}
                    <TableCell className="font-medium text-gray-900">
                      {getQuoteNumber(quote.id)}
                    </TableCell>

                    {/* Title */}
                    <TableCell className="text-gray-600">
                      {quote.title}
                    </TableCell>

                    {/* Items */}
                    <TableCell className="text-gray-600">
                      {quote.itemIds.length}
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-gray-600">
                      {formatCurrency(quote.estimatedTotal, quote.currency)}
                      {quote.includeTax && <span className="text-xs text-gray-400 ml-1">+tax</span>}
                    </TableCell>

                    {/* Created */}
                    <TableCell className="text-gray-600">
                      {formatDate(quote.createdAt)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge className={`${statusConfig[quote.status]?.color || 'bg-gray-100 text-gray-600'} text-xs`}>
                        {statusConfig[quote.status]?.label || quote.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {(quote.status === 'DRAFT' || quote.status === 'PENDING') && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 px-2 text-xs bg-violet-600 hover:bg-violet-700"
                              onClick={() => openSendDialog(quote)}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Send
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openDeleteDialog(quote)}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => copyLink(quote.token)}
                          title="Copy link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <a
                          href={`/budget-quote/${quote.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 w-7 p-0 inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
                          title="Preview"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>

                    {/* Expanded Details */}
                    {expandedQuotes.has(quote.id) && (
                      <tr>
                        <td colSpan={8} className="p-0">
                      <div className="border-t border-b border-gray-200 bg-gray-50 p-4 space-y-4">
                        {/* Description */}
                        {quote.description && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Description</p>
                            <p className="text-sm text-gray-700">{quote.description}</p>
                          </div>
                        )}

                        {/* Included Services */}
                        {quote.includedServices && quote.includedServices.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-sm text-gray-500 mb-2">Included Services</p>
                            <ul className="space-y-1">
                              {quote.includedServices.map((service, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  {service}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Timeline */}
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Created</p>
                            <p className="font-medium">{formatDate(quote.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Sent</p>
                            <p className="font-medium">{formatDate(quote.sentAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Viewed</p>
                            <p className="font-medium">{formatDate(quote.viewedAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Expires</p>
                            <p className={`font-medium ${quote.expiresAt && new Date(quote.expiresAt) < new Date() ? 'text-red-600' : ''}`}>
                              {formatDate(quote.expiresAt)}
                            </p>
                          </div>
                        </div>

                        {/* Client Response */}
                        {quote.clientApproved && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              <span className="font-medium text-emerald-800">Budget Approved</span>
                            </div>
                            <p className="text-sm text-emerald-700">
                              Approved on {formatDate(quote.clientApprovedAt)}
                            </p>
                          </div>
                        )}

                        {quote.clientQuestion && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="w-5 h-5 text-amber-600" />
                              <span className="font-medium text-amber-800">Client Question</span>
                            </div>
                            <p className="text-sm text-amber-900 bg-white p-3 rounded border border-amber-100">
                              "{quote.clientQuestion}"
                            </p>
                          </div>
                        )}

                        {/* Actions for expanded view */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(quote.token)}
                          >
                            <Copy className="w-4 h-4 mr-1.5" />
                            Copy Link
                          </Button>
                          {(quote.status === 'DRAFT' || quote.status === 'PENDING' || quote.status === 'VIEWED') && (
                            <Button
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-700"
                              onClick={() => openSendDialog(quote)}
                            >
                              <Mail className="w-4 h-4 mr-1.5" />
                              {quote.sentAt ? 'Resend' : 'Send'} Email
                            </Button>
                          )}
                        </div>
                      </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Budget Quote</DialogTitle>
            <DialogDescription>
              Send this budget estimate to the client for review and approval.
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-lg p-4">
                <p className="font-medium text-violet-900">{selectedQuote.title}</p>
                <p className="text-2xl font-bold text-violet-700 mt-1">
                  {formatCurrency(selectedQuote.estimatedTotal, selectedQuote.currency)}
                  {selectedQuote.includeTax && <span className="text-sm font-normal ml-1">+ tax</span>}
                </p>
                <p className="text-sm text-violet-600 mt-1">{selectedQuote.itemIds.length} items</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Client Email
                </label>
                <Input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !sendEmail.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Budget Quote
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Budget Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this budget quote? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {quoteToDelete && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="font-medium text-red-900">{quoteToDelete.title}</p>
              <p className="text-sm text-red-700 mt-1">
                {formatCurrency(quoteToDelete.estimatedTotal, quoteToDelete.currency)} • {quoteToDelete.itemIds.length} items
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
