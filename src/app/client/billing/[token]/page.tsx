'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, FileText, CheckCircle, Clock, AlertCircle, ChevronDown, Building, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LineItem {
  id: string
  type: string
  description: string
  quantity: number
  unitPrice: number
  hours: number | null
  hourlyRate: number | null
  milestoneTitle: string | null
  milestonePercent: number | null
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
  description: string | null
  type: string
  status: string
  clientName: string
  clientEmail: string
  clientPhone: string | null
  clientAddress: string | null
  subtotal: number
  discountPercent: number | null
  discountAmount: number | null
  gstRate: number | null
  gstAmount: number | null
  qstRate: number | null
  qstAmount: number | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  issueDate: string
  dueDate: string | null
  paidInFullAt: string | null
  allowCreditCard: boolean
  ccFeePercent: number
  notes: string | null
  termsAndConditions: string | null
  project: { id: string; name: string }
  organization: {
    name: string
    businessName: string | null
    logoUrl: string | null
    businessEmail: string | null
    businessPhone: string | null
    businessAddress: string | null
    businessCity: string | null
    businessProvince: string | null
    businessPostal: string | null
    gstNumber: string | null
    qstNumber: string | null
    neqNumber: string | null
    wireInstructions: string | null
    etransferEmail: string | null
  }
  lineItems: LineItem[]
  payments: Payment[]
}

export default function ClientBillingPage() {
  const params = useParams()
  const token = params?.token as string

  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)
  const [showEtransferInfo, setShowEtransferInfo] = useState(false)

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
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Invoice not found')
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      DRAFT: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="w-4 h-4" />, label: 'Draft' },
      SENT: { color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-4 h-4" />, label: 'Sent' },
      VIEWED: { color: 'bg-purple-100 text-purple-700', icon: <Clock className="w-4 h-4" />, label: 'Viewed' },
      PARTIALLY_PAID: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="w-4 h-4" />, label: 'Partial' },
      PAID: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" />, label: 'Paid' },
      OVERDUE: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-4 h-4" />, label: 'Overdue' },
    }
    const config = configs[status] || configs.DRAFT
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Invoice Not Found</h1>
          <p className="text-gray-500 mt-2">{error || 'This invoice may have expired or been removed.'}</p>
        </div>
      </div>
    )
  }

  const companyName = invoice.organization?.businessName || invoice.organization?.name || 'Company'
  const isPaid = invoice.status === 'PAID'
  const isOverdue = invoice.status === 'OVERDUE'

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                {invoice.organization?.logoUrl ? (
                  <img
                    src={invoice.organization.logoUrl}
                    alt={companyName}
                    className="h-16 max-w-[240px] object-contain mb-3"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{companyName}</h2>
                )}
                <div className="text-xs text-gray-500 space-y-0.5">
                  {invoice.organization?.businessAddress && <p>{invoice.organization.businessAddress}</p>}
                  {(invoice.organization?.businessCity || invoice.organization?.businessProvince) && (
                    <p>
                      {invoice.organization.businessCity}
                      {invoice.organization.businessProvince && ` ${invoice.organization.businessProvince}`}
                      {invoice.organization.businessPostal && ` ${invoice.organization.businessPostal}`}
                    </p>
                  )}
                  {invoice.organization?.businessPhone && <p>{invoice.organization.businessPhone}</p>}
                  {invoice.organization?.businessEmail && <p>{invoice.organization.businessEmail}</p>}
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 mb-1">INVOICE</p>
                <p className="font-mono text-sm text-gray-600">{invoice.invoiceNumber}</p>
                <div className="mt-2">
                  {getStatusBadge(invoice.status)}
                </div>
              </div>
            </div>

            {/* Tax Numbers */}
            {(invoice.organization?.neqNumber || invoice.organization?.gstNumber || invoice.organization?.qstNumber) && (
              <div className="text-xs text-gray-500 mb-4 pb-4 border-b flex flex-wrap gap-x-4 gap-y-1">
                {invoice.organization.neqNumber && <span>NEQ: {invoice.organization.neqNumber}</span>}
                {invoice.organization.gstNumber && <span>GST: {invoice.organization.gstNumber}</span>}
                {invoice.organization.qstNumber && <span>QST: {invoice.organization.qstNumber}</span>}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="font-medium text-gray-900">{invoice.clientName}</p>
                {invoice.clientEmail && <p className="text-sm text-gray-500">{invoice.clientEmail}</p>}
                {invoice.clientPhone && <p className="text-sm text-gray-500">{invoice.clientPhone}</p>}
                {invoice.clientAddress && <p className="text-sm text-gray-500">{invoice.clientAddress}</p>}
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Project</p>
                <p className="font-medium text-gray-900">{invoice.project.name}</p>
                <p className="text-sm text-gray-500">{invoice.title}</p>
                <div className="mt-2 text-sm text-gray-500">
                  <p>Issued: {formatDate(invoice.issueDate)}</p>
                  {invoice.dueDate && (
                    <p className={isOverdue ? 'text-red-600 font-medium' : ''}>
                      Due: {formatDate(invoice.dueDate)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6 sm:p-8">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left pb-3 font-medium">Description</th>
                  <th className="text-right pb-3 font-medium w-20">Qty</th>
                  <th className="text-right pb-3 font-medium w-28">Price</th>
                  <th className="text-right pb-3 font-medium w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{item.description}</p>
                      {item.type === 'HOURLY' && item.hours && (
                        <p className="text-xs text-gray-500">{item.hours} hours @ {formatCurrency(item.hourlyRate || 0)}/hr</p>
                      )}
                      {item.milestoneTitle && (
                        <p className="text-xs text-gray-500">{item.milestoneTitle} ({item.milestonePercent}%)</p>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {item.type === 'HOURLY' ? item.hours : item.quantity}
                    </td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {formatCurrency(item.type === 'HOURLY' ? (item.hourlyRate || 0) : item.unitPrice)}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
            <div className="border-t pt-4">
              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountAmount && invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-green-600">-{formatCurrency(invoice.discountAmount)}</span>
                    </div>
                  )}
                  {invoice.gstAmount && invoice.gstAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">GST ({invoice.gstRate || 5}%)</span>
                      <span className="text-gray-700">{formatCurrency(invoice.gstAmount)}</span>
                    </div>
                  )}
                  {invoice.qstAmount && invoice.qstAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">QST ({invoice.qstRate || 9.975}%)</span>
                      <span className="text-gray-700">{formatCurrency(invoice.qstAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Paid</span>
                        <span>-{formatCurrency(invoice.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold text-gray-900">Balance Due</span>
                        <span className={`text-xl font-bold ${invoice.balanceDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {formatCurrency(invoice.balanceDue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          {!isPaid && invoice.balanceDue > 0 && (
            <div className="bg-gray-50 p-6 sm:p-8 border-t">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Options</h3>
              <div className="space-y-3">
                {/* Wire Transfer */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowWireInfo(!showWireInfo)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <p className="font-medium text-gray-900 text-sm">Wire Transfer / Direct Deposit</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWireInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showWireInfo && (
                    <div className="px-4 pb-4 border-t pt-4">
                      {invoice.organization?.wireInstructions ? (
                        <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-lg">
                          {invoice.organization.wireInstructions}
                        </pre>
                      ) : (
                        <p className="text-sm text-gray-500">Contact us for wire transfer details.</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">Reference: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>

                {/* E-Transfer */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowEtransferInfo(!showEtransferInfo)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img src="/interac.svg" alt="Interac" className="w-5 h-5" style={{ filter: 'grayscale(100%) opacity(0.6)' }} />
                      <p className="font-medium text-gray-900 text-sm">Interac e-Transfer</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEtransferInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showEtransferInfo && (
                    <div className="px-4 pb-4 border-t pt-4">
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                        <p><span className="text-gray-400">Send to:</span> {invoice.organization?.etransferEmail || 'Contact us'}</p>
                        <p><span className="text-gray-400">Amount:</span> {formatCurrency(invoice.balanceDue)}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Message/Memo: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>

                {/* Check */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowCheckInfo(!showCheckInfo)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="w-5 h-5 text-gray-400" />
                      <p className="font-medium text-gray-900 text-sm">Check</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCheckInfo ? 'rotate-180' : ''}`} />
                  </button>
                  {showCheckInfo && (
                    <div className="px-4 pb-4 border-t pt-4">
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-700">Make payable to:</p>
                        <p>{companyName}</p>
                        {invoice.organization?.businessAddress && (
                          <div className="mt-2">
                            <p className="font-medium text-gray-700">Mail to:</p>
                            <p>{invoice.organization.businessAddress}</p>
                            <p>
                              {invoice.organization.businessCity}
                              {invoice.organization.businessProvince && `, ${invoice.organization.businessProvince}`}
                              {invoice.organization.businessPostal && ` ${invoice.organization.businessPostal}`}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Memo: {invoice.invoiceNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Paid Status */}
          {isPaid && (
            <div className="bg-green-50 p-6 sm:p-8 border-t text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Invoice Paid</h3>
              <p className="text-gray-600">
                Thank you for your payment of {formatCurrency(invoice.totalAmount)}
              </p>
              {invoice.paidInFullAt && (
                <p className="text-sm text-gray-500 mt-1">Paid on {formatDate(invoice.paidInFullAt)}</p>
              )}
            </div>
          )}

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 border-t">
              <h4 className="font-medium text-gray-900 mt-6 mb-3">Payment History</h4>
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <div>
                      <span className="font-medium text-gray-900">{formatCurrency(payment.amount)}</span>
                      <span className="text-gray-500 ml-2">{payment.method.replace('_', ' ')}</span>
                    </div>
                    <span className="text-gray-500">{formatDate(payment.paidAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t text-center text-xs text-gray-400">
            <p className="text-gray-500">Thank you for your business</p>
          </div>
        </div>

        {/* Print Button */}
        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="text-gray-500">
            Print Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
