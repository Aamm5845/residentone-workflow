'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, FileText, ChevronDown, Building, Banknote, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

// Dynamically import Solo payment form (client-side only)
const SoloPaymentForm = dynamic(
  () => import('@/components/client-portal/SoloPaymentForm'),
  { ssr: false, loading: () => <div className="py-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div> }
)

// Print styles - hide payment section and format for full-page printing
const printStyles = `
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }

    /* Reset page margins and backgrounds */
    html, body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Make invoice full width on page */
    .print-container {
      padding: 0 !important;
      margin: 0 !important;
      min-height: auto !important;
    }

    .print-invoice {
      max-width: 100% !important;
      width: 100% !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
    }

    /* Ensure proper page sizing */
    @page {
      size: letter;
      margin: 0.5in;
    }

    /* Prevent page breaks inside items */
    tr { page-break-inside: avoid; }
    .print-break { page-break-after: always; }
  }
`

interface SpecDetails {
  manufacturer?: string | null
  model?: string | null
  finish?: string | null
  dimensions?: string | null
  leadTime?: string | null
  specNotes?: string | null
  room?: string | null
  section?: string | null
  allImages?: string[] | null
}

interface LineItem {
  id: string
  roomFFEItemId?: string | null
  displayName: string
  displayDescription?: string
  quantity: number
  unitType?: string
  clientUnitPrice: number
  clientTotalPrice: number
  categoryName?: string
  imageUrl?: string | null
  specDetails?: SpecDetails | null
}

interface InvoiceData {
  id: string
  projectId: string
  quoteNumber: string
  title: string
  description?: string
  validUntil?: string
  paymentTerms?: string
  paymentSchedule?: { label: string; percent: number }[] | null
  depositRequired?: number | null
  subtotal: number
  shippingCost?: number
  customFees?: { name: string; amount: number }[]
  gstRate?: number
  gstAmount?: number
  qstRate?: number
  qstAmount?: number
  taxRate?: number
  taxAmount?: number
  totalAmount: number
  currency?: string
  ccFeeRate: number
  allowCreditCard?: boolean
  lineItems: LineItem[]
  clientAddress?: string
  project: {
    name: string
    client?: {
      name: string
      email?: string
      phone?: string
    }
  }
  organization?: {
    businessName?: string
    name?: string
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
  // Payment status
  isPaid?: boolean
  totalPaid?: number
  remainingBalance?: number
  lastPaymentDate?: string | null
}

export default function ClientInvoicePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const paymentStatus = searchParams?.get('payment')
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)
  const [showEtransferInfo, setShowEtransferInfo] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  useEffect(() => {
    if (id) {
      loadInvoice()
    }
  }, [id])

  const loadInvoice = async (retryCount = 0) => {
    try {
      // Validate ID before making request
      if (!id || id === 'undefined' || id === 'null') {
        console.error('[Client Invoice] Invalid ID:', id)
        setError('Invalid invoice link')
        setLoading(false)
        return
      }

      console.log('[Client Invoice] Loading invoice with ID:', id, retryCount > 0 ? `(retry ${retryCount})` : '')
      const response = await fetch(`/api/client-quotes/${id}/client-view`)

      if (response.ok) {
        const data = await response.json()
        console.log('[Client Invoice] Loaded successfully:', data.quoteNumber)
        setInvoice(data)
      } else if (response.status === 404 && retryCount < 2) {
        // Retry once after a short delay in case of database propagation delay
        console.log('[Client Invoice] Invoice not found, retrying in 1 second...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadInvoice(retryCount + 1)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Client Invoice] Load failed:', response.status, errorData)
        setError(errorData.error || 'Invoice not found')
      }
    } catch (err) {
      console.error('[Client Invoice] Error loading invoice:', err)
      if (retryCount < 2) {
        // Retry on network errors
        await new Promise(resolve => setTimeout(resolve, 1000))
        return loadInvoice(retryCount + 1)
      }
      setError('Failed to load invoice')
    } finally {
      if (retryCount === 0 || retryCount >= 2) {
        setLoading(false)
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: invoice?.currency || 'CAD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Calculate the current amount due based on payment schedule milestones
  const getCurrentAmountDue = () => {
    if (!invoice) return 0
    // If there's a payment schedule, find the next unpaid milestone
    if (invoice.paymentSchedule && invoice.paymentSchedule.length > 0) {
      const paid = invoice.totalPaid || 0
      let cumulativeAmount = 0
      for (const milestone of invoice.paymentSchedule) {
        const milestoneAmount = Math.round(invoice.totalAmount * milestone.percent / 100 * 100) / 100
        cumulativeAmount += milestoneAmount
        // This milestone is the current one due if we haven't paid up to its cumulative total
        if (paid < cumulativeAmount - 0.01) {
          return milestoneAmount
        }
      }
      // All milestones paid or remaining balance
      return Math.max(0, invoice.totalAmount - paid)
    }
    // No schedule — use remaining balance or full amount
    return invoice.remainingBalance ?? invoice.totalAmount
  }

  // Get the label for the current milestone due
  const getCurrentMilestoneLabel = () => {
    if (!invoice?.paymentSchedule || invoice.paymentSchedule.length === 0) return null
    const paid = invoice.totalPaid || 0
    let cumulativeAmount = 0
    for (const milestone of invoice.paymentSchedule) {
      const milestoneAmount = Math.round(invoice.totalAmount * milestone.percent / 100 * 100) / 100
      cumulativeAmount += milestoneAmount
      if (paid < cumulativeAmount - 0.01) {
        return milestone.label || 'Payment'
      }
    }
    return null
  }

  const amountDue = getCurrentAmountDue()

  const calculateCCTotal = () => {
    if (!invoice) return 0
    const ccFee = amountDue * (invoice.ccFeeRate / 100)
    return amountDue + ccFee
  }

  const handlePayWithCard = () => {
    setShowPaymentDialog(true)
  }

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false)
    // Reload invoice to show updated status
    loadInvoice()
    // Update URL to show success
    window.history.replaceState({}, '', `${window.location.pathname}?payment=success`)
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
          <p className="text-gray-500 mt-2">{error || 'This invoice may have expired or been removed.'}</p>
        </div>
      </div>
    )
  }

  // Group line items by category
  const groupedItems = invoice.lineItems.reduce((groups: Record<string, LineItem[]>, item) => {
    const key = item.categoryName || 'Items'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})

  const hasGstQst = (invoice.gstAmount && invoice.gstAmount > 0) || (invoice.qstAmount && invoice.qstAmount > 0)
  const companyName = invoice.organization?.businessName || invoice.organization?.name || 'Meisner Interiors'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0 print-container">
        <div className="max-w-6xl mx-auto print:max-w-none">
          {/* Payment Success Message */}
          {paymentStatus === 'success' && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 no-print">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Payment Successful!</p>
                <p className="text-sm text-green-600">Thank you for your payment. You will receive a confirmation email shortly.</p>
              </div>
            </div>
          )}

          {/* Invoice Card */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print:shadow-none print:border-0 print:rounded-none print-invoice">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b">
              <div className="flex items-start justify-between mb-6">
                {/* Company Info */}
                <div className="flex-1">
                  {invoice.organization?.logoUrl ? (
                    <img
                      src={invoice.organization.logoUrl}
                      alt={companyName}
                      className="h-20 max-w-[280px] object-contain mb-3"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{companyName}</h2>
                  )}
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {invoice.organization?.businessAddress && (
                      <p>{invoice.organization.businessAddress}</p>
                    )}
                    {(invoice.organization?.businessCity || invoice.organization?.businessProvince || invoice.organization?.businessPostal) && (
                      <p>
                        {invoice.organization.businessCity}
                        {invoice.organization.businessProvince && ` ${invoice.organization.businessProvince}`}
                        {invoice.organization.businessPostal && ` ${invoice.organization.businessPostal}`}
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

                {/* Invoice Number */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 mb-1">INVOICE</p>
                  <p className="font-mono text-sm text-gray-600">{invoice.quoteNumber}</p>
                  {invoice.isPaid ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      PAID
                    </div>
                  ) : invoice.validUntil && (
                    <p className="text-xs text-gray-400 mt-2">Due: {formatDate(invoice.validUntil)}</p>
                  )}
                </div>
              </div>

              {/* Business Registration Numbers */}
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
                  <p className="font-medium text-gray-900">{invoice.project.client?.name || 'Client'}</p>
                  {invoice.project.client?.email && (
                    <p className="text-sm text-gray-500">{invoice.project.client.email}</p>
                  )}
                  {invoice.project.client?.phone && (
                    <p className="text-sm text-gray-500">{invoice.project.client.phone}</p>
                  )}
                  {invoice.clientAddress && (
                    <p className="text-sm text-gray-500 mt-1">{invoice.clientAddress}</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Project</p>
                  <p className="font-medium text-gray-900">{invoice.project.name}</p>
                  <p className="text-sm text-gray-500">{invoice.title}</p>
                </div>
              </div>

              {invoice.paymentTerms && invoice.paymentTerms !== 'Custom schedule' && (
                <div className="mt-6 pt-4 border-t text-sm">
                  <span className="text-gray-400">Payment Terms:</span>
                  <span className="ml-2 text-gray-700">{invoice.paymentTerms}</span>
                </div>
              )}
            </div>

          {/* Line Items */}
          <div className="p-6 sm:p-8">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left pb-3 font-medium">Item</th>
                  <th className="text-right pb-3 font-medium w-20">Qty</th>
                  <th className="text-right pb-3 font-medium w-28">Price</th>
                  <th className="text-right pb-3 font-medium w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(groupedItems).map(([category, items]) => (
                  items.map((item) => (
                    <tr key={item.id} className="group">
                      <td className="py-4 pr-4">
                        <div className="flex items-start gap-3">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm">{item.displayName}</p>
                            {item.displayDescription && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.displayDescription}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right text-sm text-gray-600 align-top">
                        {item.quantity}
                      </td>
                      <td className="py-4 text-right text-sm text-gray-600 align-top">
                        {formatCurrency(item.clientUnitPrice)}
                      </td>
                      <td className="py-4 text-right text-sm font-medium text-gray-900 align-top">
                        {formatCurrency(item.clientTotalPrice)}
                      </td>
                    </tr>
                  ))
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
                  {/* Tax - calculated on subtotal only */}
                  {hasGstQst ? (
                    <>
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
                    </>
                  ) : (
                    invoice.taxRate && invoice.taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tax ({invoice.taxRate}%)</span>
                        <span className="text-gray-700">{formatCurrency(invoice.taxAmount || 0)}</span>
                      </div>
                    )
                  )}
                  {/* Delivery Fee - after tax */}
                  {invoice.shippingCost && invoice.shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Delivery</span>
                      <span className="text-gray-700">{formatCurrency(invoice.shippingCost)}</span>
                    </div>
                  )}
                  {/* Custom Fees - after tax */}
                  {invoice.customFees && invoice.customFees.length > 0 && invoice.customFees.map((fee, index) => (
                    fee.amount > 0 && (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-500">{fee.name || 'Additional Fee'}</span>
                        <span className="text-gray-700">{formatCurrency(fee.amount)}</span>
                      </div>
                    )
                  ))}
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold text-gray-900">Total Due</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                  </div>

                  {/* Payment Schedule - below total */}
                  {invoice.paymentSchedule && invoice.paymentSchedule.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-dashed">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Payment Schedule</span>
                      <div className="mt-2 space-y-1.5">
                        {(() => {
                          const paid = invoice.totalPaid || 0
                          let cumulativeAmount = 0
                          let foundCurrentDue = false
                          return invoice.paymentSchedule.map((milestone, idx) => {
                            const amount = Math.round(invoice.totalAmount * milestone.percent / 100 * 100) / 100
                            cumulativeAmount += amount
                            const isMilestonePaid = paid >= cumulativeAmount - 0.01
                            const isCurrentDue = !isMilestonePaid && !foundCurrentDue
                            if (isCurrentDue) foundCurrentDue = true
                            const isFuture = !isMilestonePaid && !isCurrentDue
                            return (
                              <div key={idx} className={`flex justify-between text-sm ${isMilestonePaid ? 'opacity-50' : ''}`}>
                                <span className="text-gray-600 flex items-center gap-1.5">
                                  {isMilestonePaid && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                                  {isCurrentDue && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                                  {milestone.label || 'Payment'} ({milestone.percent}%)
                                  {isMilestonePaid && <span className="text-green-600 text-xs ml-1">Paid</span>}
                                  {isCurrentDue && <span className="text-amber-600 text-xs ml-1 font-medium">Due now</span>}
                                </span>
                                <span className={`font-medium ${isMilestonePaid ? 'text-gray-400 line-through' : isFuture ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {formatCurrency(amount)}
                                </span>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section - Hidden when printing */}
          <div className="bg-gray-50 p-6 sm:p-8 border-t no-print">
            {/* Show Paid status if fully paid */}
            {invoice.isPaid ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-700 mb-2">Invoice Paid</h3>
                <p className="text-gray-600">
                  Thank you for your payment of {formatCurrency(invoice.totalPaid || invoice.totalAmount)}
                </p>
                {invoice.lastPaymentDate && (
                  <p className="text-sm text-gray-500 mt-1">
                    Paid on {formatDate(invoice.lastPaymentDate)}
                  </p>
                )}
              </div>
            ) : (
              <>
            <h3 className="font-semibold text-gray-900 mb-4">Payment Options</h3>

            <div className="space-y-3">
              {/* Credit Card - only show if allowed */}
              {invoice.allowCreditCard !== false && (
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#635BFF] rounded flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v2h16V6H4zm0 6v6h16v-6H4zm2 2h4v2H6v-2z"/>
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">Credit / Debit Card</span>
                    </div>
                  </div>
                  {/* Payment breakdown */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>{getCurrentMilestoneLabel() ? `${getCurrentMilestoneLabel()}` : 'Amount Due'}</span>
                      <span>{formatCurrency(amountDue)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Credit Card Fee ({invoice.ccFeeRate}%)</span>
                      <span>+{formatCurrency(amountDue * (invoice.ccFeeRate / 100))}</span>
                    </div>
                    <div className="flex justify-between font-medium text-gray-900 pt-1 border-t border-gray-200">
                      <span>Total to Pay</span>
                      <span>{formatCurrency(calculateCCTotal())}</span>
                    </div>
                  </div>
                  <Button
                    onClick={handlePayWithCard}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Pay {formatCurrency(calculateCCTotal())}
                  </Button>
                </div>
              )}

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
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                        <p><span className="text-gray-400">Account #:</span> 0001827</p>
                        <p><span className="text-gray-400">Routing #:</span> 01371</p>
                        <p><span className="text-gray-400">Transit #:</span> 0006</p>
                      </div>
                    )}
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-2 space-y-1">
                      <p><span className="text-gray-400">Amount:</span> {formatCurrency(amountDue)}{getCurrentMilestoneLabel() ? ` (${getCurrentMilestoneLabel()})` : ''}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Reference: {invoice.quoteNumber}
                    </p>
                  </div>
                )}
              </div>

              {/* Interac e-Transfer */}
              <div className="bg-white rounded-xl border">
                <button
                  onClick={() => setShowEtransferInfo(!showEtransferInfo)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {/* Interac Logo */}
                    <img
                      src="/interac.svg"
                      alt="Interac"
                      className="w-5 h-5"
                      style={{ filter: 'grayscale(100%) opacity(0.6)' }}
                    />
                    <p className="font-medium text-gray-900 text-sm">Interac e-Transfer</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEtransferInfo ? 'rotate-180' : ''}`} />
                </button>
                {showEtransferInfo && (
                  <div className="px-4 pb-4 border-t pt-4">
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                      <p><span className="text-gray-400">Send to:</span> {invoice.organization?.etransferEmail || 'aaron@meisnerinteriors.com'}</p>
                      <p><span className="text-gray-400">Amount:</span> {formatCurrency(amountDue)}{getCurrentMilestoneLabel() ? ` (${getCurrentMilestoneLabel()})` : ''}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Message/Memo: {invoice.quoteNumber}
                    </p>
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
                    <p className="text-xs text-gray-400 mt-2">
                      Memo: {invoice.quoteNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </div>

          {/* Footer - shown in print */}
          <div className="px-6 sm:px-8 py-4 border-t text-center text-xs text-gray-400">
            <p className="text-gray-500">Thank you for your business</p>
            <p className="mt-1">Items will be ordered upon receipt of payment</p>
          </div>
        </div>

        {/* Print Button - Hidden when printing */}
        <div className="text-center mt-6 no-print">
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="text-gray-500">
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Make Payment</h2>
                <p className="text-sm text-gray-500">{invoice.quoteNumber}</p>
              </div>
              <button
                onClick={() => setShowPaymentDialog(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <SoloPaymentForm
                token={id}
                quoteId={invoice.id}
                amount={amountDue}
                currency={invoice.currency || 'CAD'}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPaymentDialog(false)}
                apiBasePath="/api/quote"
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}
