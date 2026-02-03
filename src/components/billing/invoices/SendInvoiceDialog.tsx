'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Send,
  Mail,
  Copy,
  ExternalLink,
  Eye,
  CreditCard,
  Building2,
  Banknote,
  CheckCircle,
  Settings2,
  User,
  FileText,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'

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
  status: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  clientAddress?: string
  lineItems: LineItem[]
  subtotal: number
  discountPercent?: number
  discountAmount?: number
  gstRate?: number
  gstAmount?: number
  qstRate?: number
  qstAmount?: number
  totalAmount: number
  dueDate?: string
  notes?: string
  allowCreditCard: boolean
  allowBankTransfer?: boolean
  allowEtransfer?: boolean
  allowCheck?: boolean
  ccFeePercent: number
  accessToken?: string
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

interface SendInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  organization?: Organization | null
  projectId: string
  onSuccess: () => void
}

export default function SendInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  organization,
  projectId,
  onSuccess
}: SendInvoiceDialogProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'send'>('preview')
  const [sending, setSending] = useState(false)

  // Email settings
  const [toEmail, setToEmail] = useState(invoice.clientEmail || '')
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber} from ${organization?.businessName || organization?.name || 'Us'}`)
  const [message, setMessage] = useState('')

  // Payment options
  const [allowCreditCard, setAllowCreditCard] = useState(invoice.allowCreditCard)
  const [allowBankTransfer, setAllowBankTransfer] = useState(invoice.allowBankTransfer !== false)
  const [allowEtransfer, setAllowEtransfer] = useState(invoice.allowEtransfer !== false)
  const [allowCheck, setAllowCheck] = useState(invoice.allowCheck !== false)

  // Client billing info (override)
  const [clientName, setClientName] = useState(invoice.clientName)
  const [clientEmail, setClientEmail] = useState(invoice.clientEmail)
  const [clientAddress, setClientAddress] = useState(invoice.clientAddress || '')

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const invoiceLink = `${baseUrl}/client/billing-invoice/${invoice.accessToken || invoice.id}`

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const ccFeeAmount = invoice.totalAmount * (invoice.ccFeePercent / 100)
  const totalWithCC = invoice.totalAmount + ccFeeAmount

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setSending(true)
    try {
      // Update invoice settings if changed
      const updates: Record<string, any> = {}
      if (allowCreditCard !== invoice.allowCreditCard) {
        updates.allowCreditCard = allowCreditCard
      }
      if (allowBankTransfer !== (invoice.allowBankTransfer !== false)) {
        updates.allowBankTransfer = allowBankTransfer
      }
      if (allowEtransfer !== (invoice.allowEtransfer !== false)) {
        updates.allowEtransfer = allowEtransfer
      }
      if (allowCheck !== (invoice.allowCheck !== false)) {
        updates.allowCheck = allowCheck
      }
      if (clientName !== invoice.clientName) {
        updates.clientName = clientName
      }
      if (clientEmail !== invoice.clientEmail) {
        updates.clientEmail = clientEmail
      }
      if (clientAddress !== (invoice.clientAddress || '')) {
        updates.clientAddress = clientAddress
      }

      if (Object.keys(updates).length > 0) {
        await fetch(`/api/billing/invoices/${invoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      }

      // Send the invoice
      const response = await fetch(`/api/billing/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: toEmail,
          subject,
          message,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invoice')
      }

      toast.success(`Invoice sent to ${toEmail}`)
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      console.error('Error sending invoice:', err)
      toast.error(err.message || 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(invoiceLink)
    toast.success('Invoice link copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold">Send Invoice</p>
              <p className="text-sm font-normal text-slate-500">{invoice.invoiceNumber} • {formatCurrency(invoice.totalAmount)}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100">
              <TabsTrigger value="preview" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Settings2 className="w-4 h-4" />
                Options
              </TabsTrigger>
              <TabsTrigger value="send" className="flex items-center gap-2 data-[state=active]:bg-white">
                <Mail className="w-4 h-4" />
                Send
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 px-6 py-4 overflow-auto">
            <div className="bg-white border rounded-xl overflow-hidden">
              {/* Mini Invoice Preview */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{organization?.businessName || organization?.name || 'Your Company'}</p>
                    <p className="text-xs text-slate-300 mt-1">{organization?.businessEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">INVOICE</p>
                    <p className="text-xs text-slate-300">{invoice.invoiceNumber}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Bill To */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Bill To</p>
                    <p className="font-medium text-sm">{clientName}</p>
                    <p className="text-xs text-slate-500">{clientEmail}</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Due Date</p>
                    <p className="font-medium text-sm">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon Receipt'}
                    </p>
                  </div>
                </div>

                {/* Line Items Preview */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">ITEMS</p>
                  <div className="space-y-2">
                    {invoice.lineItems.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate flex-1 mr-4">{item.description}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    {invoice.lineItems.length > 3 && (
                      <p className="text-xs text-slate-400">+ {invoice.lineItems.length - 3} more items</p>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.gstAmount && invoice.gstAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">GST ({invoice.gstRate}%)</span>
                      <span>{formatCurrency(invoice.gstAmount)}</span>
                    </div>
                  )}
                  {invoice.qstAmount && invoice.qstAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">QST ({invoice.qstRate}%)</span>
                      <span>{formatCurrency(invoice.qstAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Preview */}
              <div className="bg-slate-50 p-4 border-t">
                <p className="text-xs font-medium text-slate-500 mb-3">PAYMENT OPTIONS</p>
                <div className="flex flex-wrap gap-2">
                  {allowCreditCard && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-full text-xs">
                      <CreditCard className="w-3 h-3 text-emerald-600" />
                      Credit Card
                    </span>
                  )}
                  {allowBankTransfer && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-full text-xs">
                      <Building2 className="w-3 h-3 text-blue-600" />
                      Bank Transfer
                    </span>
                  )}
                  {allowEtransfer && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-full text-xs">
                      <Banknote className="w-3 h-3 text-purple-600" />
                      E-Transfer
                    </span>
                  )}
                  {allowCheck && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-full text-xs">
                      <FileText className="w-3 h-3 text-slate-600" />
                      Check
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* View Full Preview Link */}
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500"
                onClick={() => window.open(invoiceLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Full Invoice Preview
              </Button>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 px-6 py-4 overflow-auto space-y-6">
            {/* Payment Methods */}
            <div>
              <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Methods
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Credit Card</p>
                      <p className="text-xs text-slate-500">+{invoice.ccFeePercent}% processing fee</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowCreditCard}
                    onCheckedChange={setAllowCreditCard}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Bank Transfer / Direct Deposit</p>
                      <p className="text-xs text-slate-500">Wire transfer or direct deposit</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowBankTransfer}
                    onCheckedChange={setAllowBankTransfer}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Banknote className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Interac e-Transfer</p>
                      <p className="text-xs text-slate-500">{organization?.etransferEmail || 'Not configured'}</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowEtransfer}
                    onCheckedChange={setAllowEtransfer}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Check</p>
                      <p className="text-xs text-slate-500">Mail a check</p>
                    </div>
                  </div>
                  <Switch
                    checked={allowCheck}
                    onCheckedChange={setAllowCheck}
                  />
                </div>
              </div>

              {allowCreditCard && (
                <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-800">
                    With credit card: {formatCurrency(totalWithCC)} (+{formatCurrency(ccFeeAmount)} fee)
                  </p>
                </div>
              )}
            </div>

            {/* Client Billing Info */}
            <div>
              <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Client Billing Information
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmailEdit">Email Address</Label>
                  <Input
                    id="clientEmailEdit"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="clientAddress">Billing Address</Label>
                  <Textarea
                    id="clientAddress"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={2}
                    className="mt-1"
                    placeholder="Enter client billing address"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Send Tab */}
          <TabsContent value="send" className="flex-1 px-6 py-4 overflow-auto space-y-4">
            {/* Email Form */}
            <div>
              <Label htmlFor="toEmail">Send To *</Label>
              <Input
                id="toEmail"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="client@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="message">Personal Message (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal note to the email..."
                rows={4}
                className="mt-1"
              />
            </div>

            {/* Share Link */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Or share the invoice link directly
              </p>
              <div className="flex gap-2">
                <Input
                  value={invoiceLink}
                  readOnly
                  className="text-sm bg-slate-50 flex-1"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(invoiceLink, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>Client receives a professional email with invoice link</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>They can view the invoice online and choose a payment method</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>You'll be notified when the invoice is viewed or paid</span>
                </li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
