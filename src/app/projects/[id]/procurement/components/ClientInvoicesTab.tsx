'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Receipt,
  Send,
  DollarSign,
  Bell,
  Eye,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  FileText,
  History,
  Copy,
  ExternalLink,
  Download,
  Trash2,
  Clock,
  AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import CreateInvoiceDialog from './CreateInvoiceDialog'
import SendInvoiceDialog from './SendInvoiceDialog'
import RecordPaymentDialog from './RecordPaymentDialog'
import PaymentHistoryDialog from './PaymentHistoryDialog'
import InvoiceDetailView from './InvoiceDetailView'

interface ClientInvoicesTabProps {
  projectId: string
  searchQuery: string
  onCreateInvoice?: () => void
}

interface InvoiceItem {
  name: string
  quantity: number
  total: number
}

interface Payment {
  id: string
  amount: number
  status: string
  method: string
  paidAt: string | null
  notes: string | null
}

interface ClientInvoice {
  id: string
  invoiceNumber: string
  title: string
  description: string | null
  clientName: string
  clientEmail: string
  projectName: string
  itemsCount: number
  items: InvoiceItem[]
  subtotal: number
  gstAmount: number
  qstAmount: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'
  sentAt: string | null
  sentBy: string | null
  validUntil: string | null
  accessToken: string
  payments: Payment[]
  createdAt: string
  updatedAt: string
  // Email tracking
  emailOpenedAt: string | null
  viewCount: number
}

interface Stats {
  total: number
  draft: number
  sent: number
  partial: number
  paid: number
  overdue: number
  totalBilled: number
  totalPaid: number
  outstanding: number
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
  SENT: { label: 'Sent', color: 'bg-blue-50 text-blue-700', icon: Send },
  PARTIAL: { label: 'Partial', color: 'bg-amber-50 text-amber-700', icon: Clock },
  PAID: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700', icon: DollarSign },
  OVERDUE: { label: 'Overdue', color: 'bg-red-50 text-red-600', icon: AlertCircle },
}

export default function ClientInvoicesTab({ projectId, searchQuery, onCreateInvoice }: ClientInvoicesTabProps) {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0, draft: 0, sent: 0, partial: 0, paid: 0, overdue: 0,
    totalBilled: 0, totalPaid: 0, outstanding: 0
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [detailViewOpen, setDetailViewOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/projects/${projectId}/procurement/client-invoices${filterStatus ? `?status=${filterStatus}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch invoices')
      const data = await res.json()
      setInvoices(data.invoices || [])
      setStats(data.stats || {
        total: 0, draft: 0, sent: 0, partial: 0, paid: 0, overdue: 0,
        totalBilled: 0, totalPaid: 0, outstanding: 0
      })
    } catch (error) {
      console.error('Error fetching invoices:', error)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [projectId, filterStatus])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // Filter invoices based on search
  const filteredInvoices = invoices.filter(invoice =>
    !searchQuery ||
    invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const handleViewInvoice = (invoice: ClientInvoice) => {
    setSelectedInvoice(invoice)
    setDetailViewOpen(true)
  }

  const handleSendInvoice = (invoice: ClientInvoice) => {
    setSelectedInvoice(invoice)
    setSendDialogOpen(true)
  }

  const handleRecordPayment = (invoice: ClientInvoice) => {
    setSelectedInvoice(invoice)
    setPaymentDialogOpen(true)
  }

  const handleSendReminder = async (invoice: ClientInvoice) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (!res.ok) throw new Error('Failed to send reminder')
      toast.success(`Reminder sent to ${invoice.clientEmail}`)
    } catch (error) {
      toast.error('Failed to send reminder')
    }
  }

  const handleViewHistory = (invoice: ClientInvoice) => {
    setSelectedInvoice(invoice)
    setHistoryDialogOpen(true)
  }

  const handleCopyLink = (invoice: ClientInvoice) => {
    const link = `${window.location.origin}/client/invoice/${invoice.accessToken}`
    navigator.clipboard.writeText(link)
    toast.success('Invoice link copied to clipboard')
  }

  const handleOpenClientView = (invoice: ClientInvoice) => {
    window.open(`/client/invoice/${invoice.accessToken}`, '_blank')
  }

  const handleDeleteInvoice = async (invoice: ClientInvoice) => {
    const warningMsg = invoice.status !== 'DRAFT'
      ? `This invoice has been sent to the client. Are you sure you want to delete ${invoice.invoiceNumber}?`
      : `Delete invoice ${invoice.invoiceNumber}?`

    if (!confirm(warningMsg)) return

    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete invoice')
      toast.success('Invoice deleted')
      fetchInvoices()
    } catch (error) {
      toast.error('Failed to delete invoice')
    }
  }

  const handleDownloadPDF = (invoice: ClientInvoice) => {
    // Open client view in new window for printing/saving as PDF
    window.open(`/client/invoice/${invoice.accessToken}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Billed</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(stats.totalBilled)}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.total} invoice{stats.total !== 1 ? 's' : ''}</p>
              </div>
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Paid</p>
                <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.paid} paid, {stats.partial} partial</p>
              </div>
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-gray-200 ${stats.outstanding > 0 ? 'ring-1 ring-amber-200' : ''}`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Outstanding</p>
                <p className={`text-2xl font-semibold mt-1 ${stats.outstanding > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {formatCurrency(stats.outstanding)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.sent} sent, {stats.overdue > 0 ? `${stats.overdue} overdue` : `${stats.draft} draft`}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.outstanding > 0 ? 'bg-amber-50' : 'bg-gray-100'}`}>
                <ArrowUpRight className={`w-4 h-4 ${stats.outstanding > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Invoices</CardTitle>
            <div className="flex items-center gap-2">
              {/* Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-gray-600">
                    {filterStatus ? statusConfig[filterStatus as keyof typeof statusConfig]?.label : 'All'}
                    <span className="ml-1 text-xs">({filterStatus ? stats[filterStatus.toLowerCase() as keyof Stats] : stats.total})</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterStatus(null)}>
                    All ({stats.total})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterStatus('DRAFT')}>
                    Draft ({stats.draft})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('SENT')}>
                    Sent ({stats.sent})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('PARTIAL')}>
                    Partial ({stats.partial})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus('PAID')}>
                    Paid ({stats.paid})
                  </DropdownMenuItem>
                  {stats.overdue > 0 && (
                    <DropdownMenuItem onClick={() => setFilterStatus('OVERDUE')}>
                      Overdue ({stats.overdue})
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" className="h-8 text-gray-600" onClick={fetchInvoices}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                className="h-8 bg-gray-900 hover:bg-gray-800 text-white"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Invoice
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No invoices yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create invoices from All Specs or approved supplier quotes
              </p>
              <Button
                size="sm"
                className="h-8 bg-gray-900 hover:bg-gray-800 text-white"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium">Invoice</TableHead>
                  <TableHead className="text-gray-500 font-medium">Client</TableHead>
                  <TableHead className="text-gray-500 font-medium">Items</TableHead>
                  <TableHead className="text-gray-500 font-medium text-right">Total</TableHead>
                  <TableHead className="text-gray-500 font-medium text-right">Paid</TableHead>
                  <TableHead className="text-gray-500 font-medium text-right">Balance</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusConfig[invoice.status].icon
                  return (
                    <TableRow key={invoice.id} className="cursor-pointer group" onClick={() => handleViewInvoice(invoice)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{invoice.title}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-gray-900">{invoice.clientName}</p>
                          <p className="text-xs text-gray-500">{invoice.clientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{invoice.itemsCount} item{invoice.itemsCount !== 1 ? 's' : ''}</TableCell>
                      <TableCell className="font-medium text-gray-900 text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                      <TableCell className="text-emerald-600 text-right">{formatCurrency(invoice.paidAmount)}</TableCell>
                      <TableCell className={`text-right font-medium ${invoice.balance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {formatCurrency(invoice.balance)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusConfig[invoice.status].color} gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig[invoice.status].label}
                          </Badge>
                          {invoice.emailOpenedAt && invoice.status !== 'DRAFT' && (
                            <div
                              className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded"
                              title={`Viewed ${invoice.viewCount > 1 ? `${invoice.viewCount} times` : 'once'} - First opened: ${format(new Date(invoice.emailOpenedAt), 'MMM d, h:mm a')}`}
                            >
                              <Eye className="w-3 h-3" />
                              {invoice.viewCount > 1 && <span>{invoice.viewCount}</span>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenClientView(invoice)}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Client View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(invoice)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {invoice.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => handleSendInvoice(invoice)}>
                                <Send className="w-4 h-4 mr-2" />
                                Send Invoice
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'SENT' || invoice.status === 'PARTIAL' || invoice.status === 'OVERDUE') && (
                              <>
                                <DropdownMenuItem onClick={() => handleRecordPayment(invoice)}>
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Record Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendReminder(invoice)}>
                                  <Bell className="w-4 h-4 mr-2" />
                                  Send Reminder
                                </DropdownMenuItem>
                              </>
                            )}
                            {invoice.payments.length > 0 && (
                              <DropdownMenuItem onClick={() => handleViewHistory(invoice)}>
                                <History className="w-4 h-4 mr-2" />
                                Payment History
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteInvoice(invoice)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={projectId}
        onSuccess={() => {
          fetchInvoices()
          setCreateDialogOpen(false)
        }}
      />

      {selectedInvoice && (
        <>
          <SendInvoiceDialog
            open={sendDialogOpen}
            onOpenChange={setSendDialogOpen}
            projectId={projectId}
            invoice={selectedInvoice}
            onSuccess={() => {
              fetchInvoices()
              setSendDialogOpen(false)
            }}
          />

          <RecordPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            projectId={projectId}
            invoice={selectedInvoice}
            onSuccess={() => {
              fetchInvoices()
              setPaymentDialogOpen(false)
            }}
          />

          <PaymentHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
            projectId={projectId}
            invoice={selectedInvoice}
          />

          <InvoiceDetailView
            open={detailViewOpen}
            onOpenChange={setDetailViewOpen}
            projectId={projectId}
            invoice={selectedInvoice}
            onSend={() => {
              setDetailViewOpen(false)
              handleSendInvoice(selectedInvoice)
            }}
            onRecordPayment={() => {
              setDetailViewOpen(false)
              handleRecordPayment(selectedInvoice)
            }}
            onRefresh={fetchInvoices}
          />
        </>
      )}
    </div>
  )
}
