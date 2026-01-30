'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, CreditCard, CheckCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  description: string | null
  status: string
  clientName: string
  clientEmail: string
  clientPhone: string | null
  clientAddress: string | null
  lineItems: LineItem[]
  subtotal: number
  discountPercent: number | null
  discountAmount: number | null
  gstRate: number | null
  gstAmount: number | null
  qstRate: number | null
  qstAmount: number | null
  totalAmount: number
  dueDate: string | null
  notes: string | null
  allowCreditCard: boolean
  ccFeePercent: number
}

interface Organization {
  name: string
  businessName: string | null
  businessEmail: string | null
  businessPhone: string | null
  businessAddress: string | null
  businessCity: string | null
  businessProvince: string | null
  businessPostal: string | null
  gstNumber: string | null
  qstNumber: string | null
}

interface InvoicePreviewClientProps {
  invoice: Invoice
  projectId: string
  projectName: string
  organization: Organization | null
}

export default function InvoicePreviewClient({
  invoice,
  projectId,
  projectName,
  organization,
}: InvoicePreviewClientProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [allowCreditCard, setAllowCreditCard] = useState(invoice.allowCreditCard)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      // Update credit card setting if changed
      if (allowCreditCard !== invoice.allowCreditCard) {
        await fetch(`/api/billing/invoices/${invoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowCreditCard }),
        })
      }

      // Send the invoice
      const response = await fetch(`/api/billing/invoices/${invoice.id}/send`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invoice')
      }

      router.push(`/projects/${projectId}/billing`)
      router.refresh()
    } catch (err: any) {
      console.error('Error sending invoice:', err)
      alert(err.message || 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const ccFeeAmount = invoice.totalAmount * (invoice.ccFeePercent / 100)
  const totalWithCC = invoice.totalAmount + ccFeeAmount

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${projectId}/billing`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Preview Invoice</h1>
                <p className="text-sm text-gray-500">{invoice.invoiceNumber}</p>
              </div>
            </div>

            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-8 pb-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {organization?.businessName || organization?.name || 'Invoice'}
                  </h2>
                  {organization?.businessAddress && (
                    <p className="text-sm text-gray-600 mt-1">
                      {organization.businessAddress}
                      <br />
                      {organization.businessCity}, {organization.businessProvince} {organization.businessPostal}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</p>
                  {invoice.dueDate && (
                    <p className="text-sm text-gray-600">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-8">
                <p className="text-sm text-gray-500 mb-1">Bill To:</p>
                <p className="font-semibold text-gray-900">{invoice.clientName}</p>
                <p className="text-sm text-gray-600">{invoice.clientEmail}</p>
                {invoice.clientAddress && (
                  <p className="text-sm text-gray-600">{invoice.clientAddress}</p>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{invoice.title}</h3>
              {invoice.description && (
                <p className="text-gray-600 mb-6">{invoice.description}</p>
              )}

              {/* Line Items */}
              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Description</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Qty</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Rate</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 text-gray-900">{item.description}</td>
                      <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discountAmount && invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {invoice.discountPercent ? `(${invoice.discountPercent}%)` : ''}</span>
                    <span>-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                {invoice.gstAmount && invoice.gstAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">GST ({invoice.gstRate}%)</span>
                    <span className="text-gray-900">{formatCurrency(invoice.gstAmount)}</span>
                  </div>
                )}
                {invoice.qstAmount && invoice.qstAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">QST ({invoice.qstRate}%)</span>
                    <span className="text-gray-900">{formatCurrency(invoice.qstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-500 mb-1">Notes:</p>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Send Options</h3>

              {/* Recipient */}
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Sending to:</p>
                <p className="font-medium text-gray-900">{invoice.clientName}</p>
                <p className="text-sm text-gray-600">{invoice.clientEmail}</p>
              </div>

              {/* Credit Card Option */}
              <div className="mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCreditCard}
                    onChange={(e) => setAllowCreditCard(e.target.checked)}
                    className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Allow Credit Card</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Client can pay with credit card (+{invoice.ccFeePercent}% fee)
                    </p>
                  </div>
                </label>
              </div>

              {/* Payment Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Payment Options</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Total</span>
                    <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  {allowCreditCard && (
                    <>
                      <div className="flex justify-between text-gray-500">
                        <span>CC Fee ({invoice.ccFeePercent}%)</span>
                        <span>+{formatCurrency(ccFeeAmount)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-gray-600">Total with CC</span>
                        <span className="font-medium">{formatCurrency(totalWithCC)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* What happens */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-gray-900 mb-3">What happens next?</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span className="text-gray-600">Email sent to client with invoice link</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-600">Client can view and pay online</span>
                  </div>
                  {allowCreditCard && (
                    <div className="flex items-start gap-2">
                      <CreditCard className="w-4 h-4 text-purple-500 mt-0.5" />
                      <span className="text-gray-600">Credit card payments enabled</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
