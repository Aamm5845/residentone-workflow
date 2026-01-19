'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Send,
  DollarSign,
  Bell,
  Copy,
  ExternalLink,
  Download,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import PaymentReminderDialog from './PaymentReminderDialog'

interface InvoiceDetailViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    description: string | null
    clientName: string
    clientEmail: string
    projectName: string
    itemsCount: number
    items: { name: string; quantity: number; total: number }[]
    subtotal: number
    gstAmount: number
    qstAmount: number
    totalAmount: number
    paidAmount: number
    balance: number
    status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE'
    sentAt: string | null
    validUntil: string | null
    accessToken: string
    createdAt: string
  }
  onSend: () => void
  onRecordPayment: () => void
  onRefresh: () => void
}

interface LineItem {
  id: string
  displayName: string
  displayDescription?: string
  categoryName?: string
  roomName?: string
  quantity: number
  clientUnitPrice: number
  clientTotalPrice: number
  roomFFEItem?: {
    images?: string[]
    brand?: string
  }
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: FileText },
  SENT: { label: 'Sent', color: 'bg-blue-50 text-blue-700', icon: Send },
  PARTIAL: { label: 'Partial Payment', color: 'bg-amber-50 text-amber-700', icon: Clock },
  PAID: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  OVERDUE: { label: 'Overdue', color: 'bg-red-50 text-red-600', icon: AlertCircle },
}

export default function InvoiceDetailView({
  open,
  onOpenChange,
  projectId,
  invoice,
  onSend,
  onRecordPayment,
  onRefresh
}: InvoiceDetailViewProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)

  useEffect(() => {
    if (open && invoice.id) {
      loadInvoiceDetails()
    }
  }, [open, invoice.id])

  const loadInvoiceDetails = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}`)
      if (res.ok) {
        const data = await res.json()
        setLineItems(data.lineItems || [])
      }
    } catch (error) {
      console.error('Error loading invoice details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const handleCopyLink = () => {
    const link = `${window.location.origin}/client/invoice/${invoice.accessToken}`
    navigator.clipboard.writeText(link)
    toast.success('Invoice link copied to clipboard')
  }

  const handleOpenClientView = () => {
    window.open(`/client/invoice/${invoice.accessToken}`, '_blank')
  }

  const handleSendReminder = () => {
    setReminderDialogOpen(true)
  }

  const StatusIcon = statusConfig[invoice.status].icon

  // Group line items by category
  const groupedItems = lineItems.reduce((groups: Record<string, LineItem[]>, item) => {
    const key = item.categoryName || 'Items'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg">{invoice.invoiceNumber}</SheetTitle>
              <p className="text-sm text-gray-500">{invoice.title}</p>
            </div>
            <Badge className={`${statusConfig[invoice.status].color} gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig[invoice.status].label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Client</p>
                  <p className="font-medium">{invoice.clientName}</p>
                  <p className="text-sm text-gray-500">{invoice.clientEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Project</p>
                  <p className="font-medium">{invoice.projectName}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Created</p>
                  <p className="text-sm">{format(new Date(invoice.createdAt), 'MMM d, yyyy')}</p>
                </div>
                {invoice.sentAt && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Sent</p>
                    <p className="text-sm">{format(new Date(invoice.sentAt), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {invoice.validUntil && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Due Date</p>
                    <p className={`text-sm ${new Date(invoice.validUntil) < new Date() ? 'text-red-600' : ''}`}>
                      {format(new Date(invoice.validUntil), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-3">Items ({lineItems.length})</h4>
                <div className="space-y-4">
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category}>
                      {Object.keys(groupedItems).length > 1 && (
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{category}</p>
                      )}
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-2 rounded-lg bg-gray-50"
                          >
                            {item.roomFFEItem?.images?.[0] && (
                              <img
                                src={item.roomFFEItem.images[0]}
                                alt=""
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.displayName}</p>
                              {item.displayDescription && (
                                <p className="text-xs text-gray-500 truncate">{item.displayDescription}</p>
                              )}
                              {item.roomName && (
                                <p className="text-xs text-gray-400">{item.roomName}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-medium text-sm">{formatCurrency(Number(item.clientTotalPrice))}</p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(Number(item.clientUnitPrice))} x {item.quantity}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GST (5%)</span>
                  <span>{formatCurrency(invoice.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">QST (9.975%)</span>
                  <span>{formatCurrency(invoice.qstAmount)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total</span>
                  <span className="text-lg">{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Paid</span>
                      <span>-{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Balance Due</span>
                      <span className={invoice.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatCurrency(invoice.balance)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy Link
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenClientView}>
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Client View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open PDF in new tab for print
                    window.open(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/pdf`, '_blank')
                  }}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  PDF
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex-shrink-0 pt-4 border-t flex gap-2">
          {invoice.status === 'DRAFT' && (
            <Button className="flex-1" onClick={onSend}>
              <Send className="w-4 h-4 mr-1.5" />
              Send Invoice
            </Button>
          )}
          {(invoice.status === 'SENT' || invoice.status === 'PARTIAL' || invoice.status === 'OVERDUE') && (
            <>
              <Button className="flex-1" onClick={onRecordPayment}>
                <DollarSign className="w-4 h-4 mr-1.5" />
                Record Payment
              </Button>
              <Button variant="outline" onClick={handleSendReminder}>
                <Bell className="w-4 h-4 mr-1.5" />
                Reminder
              </Button>
            </>
          )}
          {invoice.status === 'PAID' && (
            <div className="flex-1 flex items-center justify-center gap-2 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Fully Paid</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <PaymentReminderDialog
      open={reminderDialogOpen}
      onOpenChange={setReminderDialogOpen}
      projectId={projectId}
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        clientEmail: invoice.clientEmail,
        clientName: invoice.clientName,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balance: invoice.balance,
        validUntil: invoice.validUntil
      }}
      onSuccess={() => {
        onRefresh?.()
      }}
    />
    </>
  )
}
