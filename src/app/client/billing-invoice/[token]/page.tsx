'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, FileText, ChevronDown, Building, Banknote, CheckCircle, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LineItem {
  id: string
  type: string
  description: string
  quantity: number
  unitPrice: number
  hours?: number
  hourlyRate?: number
  milestoneTitle?: string
  milestonePercent?: number
  amount: number
}

interface Payment {
  id: string
  amount: number
  method: string
  paidAt: string
}

interface InvoiceData {
  id: string
  invoiceNumber: string
  title: string
  description?: string
  status: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  clientAddress?: string
  subtotal: number
  gstRate?: number
  gstAmount?: number
  qstRate?: number
  qstAmount?: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  issueDate: string
  dueDate?: string
  paidInFullAt?: string
  allowCreditCard: boolean
  ccFeePercent: number
  notes?: string
  termsAndConditions?: string
  project: {
    id: string
    name: string
  }
  organization?: {
    name?: string
    businessName?: string
    businessEmail?: string
    businessPhone?: string
    businessAddress?: string
    businessCity?: string
    businessProvince?: string
    businessPostal?: string
    logoUrl?: string
    neqNumber?: string
    gstNumber?: string
    qstNumber?: string
    wireInstructions?: string
    etransferEmail?: string
  }
  lineItems: LineItem[]
  payments: Payment[]
}

export default function BillingInvoiceClientPage() {
  const params = useParams()
  const token = params?.token as string
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showEtransferInfo, setShowEtransferInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)

  useEffect(() => {
    if (token) {
      loadInvoice()
    }
  }, [token])

  const loadInvoice = async () => {
    try {
      const response = await fetch(`/api/billing/invoices/${token}/client-view`)
      if (response.ok) {
        const data = await response.json()
        setInvoice(data)
      } else {
        setError('Invoice not found')
      }
    } catch (err) {
      console.error('Error loading invoice:', err)
      setError('Failed to load invoice')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const calculateCCTotal = () => {
    if (!invoice) return 0
    const ccFee = invoice.balanceDue * (invoice.ccFeePercent / 100)
    return invoice.balanceDue + ccFee
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Invoice Not Found</h1>
          <p className="text-gray-500 mt-2">{error || 'This invoice may have been removed.'}</p>
        </div>
      </div>
    )
  }

  const companyName = invoice.organization?.businessName || invoice.organization?.name || 'Meisner Interiors'
  const isPaid = invoice.status === 'PAID' || invoice.balanceDue <= 0

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                {invoice.organization?.logoUrl ? (
                  <img
                    src={invoice.organization.logoUrl}
                    alt={companyName}
                    className="h-16 mb-4"
                  />
                ) : (
                  <h1 className="text-2xl font-bold mb-2">{companyName}</h1>
                )}
                <div className="text-slate-300 text-sm space-y-1">
                  {invoice.organization?.businessAddress && (
                    <p>{invoice.organization.businessAddress}</p>
                  )}
                  {invoice.organization?.businessCity && (
                    <p>
                      {invoice.organization.businessCity}, {invoice.organization.businessProvince} {invoice.organization.businessPostal}
                    </p>
                  )}
                  {invoice.organization?.businessPhone && (
                    <p>{invoice.organization.businessPhone}</p>
                  )}
                  {invoice.organization?.businessEmail && (
                    <p>{invoice.organization.businessEmail}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold mb-2">INVOICE</h2>
                <p className="font-mono text-lg text-slate-300">{invoice.invoiceNumber}</p>
                {isPaid && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    PAID
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Registration Numbers */}
          {(invoice.organization?.neqNumber || invoice.organization?.gstNumber || invoice.organization?.qstNumber) && (
            <div className="bg-slate-100 px-8 py-3 text-xs text-slate-600 flex flex-wrap gap-4">
              {invoice.organization.neqNumber && <span>NEQ: {invoice.organization.neqNumber}</span>}
              {invoice.organization.gstNumber && <span>GST: {invoice.organization.gstNumber}</span>}
              {invoice.organization.qstNumber && <span>QST: {invoice.organization.qstNumber}</span>}
            </div>
          )}

          {/* Client & Invoice Info */}
          <div className="p-8 grid md:grid-cols-2 gap-8 border-b">
            <div className="bg-slate-50 rounded-xl p-5">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Bill To</h3>
              <p className="font-semibold text-slate-900 text-lg">{invoice.clientName}</p>
              <p className="text-slate-600">{invoice.clientEmail}</p>
              {invoice.clientPhone && <p className="text-slate-600">{invoice.clientPhone}</p>}
              {invoice.clientAddress && <p className="text-slate-500 mt-2">{invoice.clientAddress}</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-5">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Invoice Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Project</span>
                  <span className="font-medium text-slate-900">{invoice.project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issue Date</span>
                  <span className="text-slate-700">{formatDate(invoice.issueDate)}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Due Date</span>
                    <span className={`font-medium ${new Date(invoice.dueDate) < new Date() && !isPaid ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-8">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Items</h3>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b-2 border-slate-200">
                  <th className="text-left py-3 font-semibold">Description</th>
                  <th className="text-right py-3 font-semibold w-24">Qty/Hrs</th>
                  <th className="text-right py-3 font-semibold w-28">Rate</th>
                  <th className="text-right py-3 font-semibold w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      {item.type === 'HOURLY' && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Hourly</span>
                      )}
                      {item.type === 'DEPOSIT' && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Deposit</span>
                      )}
                      {item.type === 'MILESTONE' && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Milestone</span>
                      )}
                    </td>
                    <td className="py-4 text-right text-slate-600">
                      {item.type === 'HOURLY' ? `${item.hours || 0} hrs` : item.quantity}
                    </td>
                    <td className="py-4 text-right text-slate-600">
                      {item.type === 'HOURLY'
                        ? `${formatCurrency(item.hourlyRate || 0)}/hr`
                        : formatCurrency(item.unitPrice)
                      }
                    </td>
                    <td className="py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-8">
            <div className="bg-slate-50 rounded-xl p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.gstAmount && invoice.gstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({invoice.gstRate}%)</span>
                    <span>{formatCurrency(invoice.gstAmount)}</span>
                  </div>
                )}
                {invoice.qstAmount && invoice.qstAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>QST ({invoice.qstRate}%)</span>
                    <span>{formatCurrency(invoice.qstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Amount Paid</span>
                      <span>-{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-emerald-600 pt-2 border-t border-slate-200">
                      <span>Balance Due</span>
                      <span>{formatCurrency(invoice.balanceDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment Section */}
          {!isPaid && (
            <div className="bg-slate-50 p-8 border-t">
              <h3 className="font-semibold text-slate-900 mb-6">Payment Options</h3>

              <div className="space-y-4">
                {/* Credit Card */}
                {invoice.allowCreditCard && (
                  <div className="bg-white rounded-xl border-2 border-emerald-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v2h16V6H4zm0 6v6h16v-6H4zm2 2h4v2H6v-2z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Pay with Credit Card</p>
                          <p className="text-xs text-slate-500">Visa, Mastercard, Amex accepted</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Invoice Amount</span>
                        <span>{formatCurrency(invoice.balanceDue)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Credit Card Fee ({invoice.ccFeePercent}%)</span>
                        <span>+{formatCurrency(invoice.balanceDue * (invoice.ccFeePercent / 100))}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Total to Pay</span>
                        <span>{formatCurrency(calculateCCTotal())}</span>
                      </div>
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-lg">
                      Pay {formatCurrency(calculateCCTotal())}
                    </Button>
                  </div>
                )}

                {/* Wire Transfer */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowWireInfo(!showWireInfo)}
                    className="w-full p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-slate-400" />
                      <span className="font-medium text-slate-900">Wire Transfer / Direct Deposit</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showWireInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showWireInfo && (
                    <div className="px-5 pb-5 border-t">
                      <div className="bg-slate-50 rounded-lg p-4 mt-4 text-sm text-slate-600">
                        {invoice.organization?.wireInstructions ? (
                          <pre className="whitespace-pre-wrap font-sans">{invoice.organization.wireInstructions}</pre>
                        ) : (
                          <>
                            <p><span className="text-slate-400">Account #:</span> 0001827</p>
                            <p><span className="text-slate-400">Routing #:</span> 01371</p>
                            <p><span className="text-slate-400">Transit #:</span> 0006</p>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Reference: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>

                {/* E-Transfer */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowEtransferInfo(!showEtransferInfo)}
                    className="w-full p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img src="/interac.svg" alt="Interac" className="w-5 h-5 opacity-60" />
                      <span className="font-medium text-slate-900">Interac e-Transfer</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showEtransferInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showEtransferInfo && (
                    <div className="px-5 pb-5 border-t">
                      <div className="bg-slate-50 rounded-lg p-4 mt-4 text-sm text-slate-600">
                        <p><span className="text-slate-400">Send to:</span> {invoice.organization?.etransferEmail || 'aaron@meisnerinteriors.com'}</p>
                        <p><span className="text-slate-400">Amount:</span> {formatCurrency(invoice.balanceDue)}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Message/Memo: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>

                {/* Check */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowCheckInfo(!showCheckInfo)}
                    className="w-full p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="w-5 h-5 text-slate-400" />
                      <span className="font-medium text-slate-900">Check</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showCheckInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showCheckInfo && (
                    <div className="px-5 pb-5 border-t">
                      <div className="bg-slate-50 rounded-lg p-4 mt-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-700 mb-2">Make payable to:</p>
                        <p>{companyName}</p>
                        {invoice.organization?.businessAddress && (
                          <div className="mt-3">
                            <p className="font-medium text-slate-700 mb-1">Mail to:</p>
                            <p>{invoice.organization.businessAddress}</p>
                            <p>{invoice.organization.businessCity}, {invoice.organization.businessProvince} {invoice.organization.businessPostal}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-3">Memo: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes & Footer */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="px-8 py-6 border-t bg-slate-50">
              {invoice.notes && (
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Notes</h4>
                  <p className="text-sm text-slate-600">{invoice.notes}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Terms</h4>
                  <p className="text-sm text-slate-600">{invoice.termsAndConditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 border-t text-center text-xs text-slate-400">
            <p>Thank you for your business</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-6">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" />
            Print Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
