'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, FileText, Mail, Phone, Calendar, ChevronDown, ChevronUp, Building, Banknote, ExternalLink, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Print styles - hide payment section when printing
const printStyles = `
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    body { background: white !important; }
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
  quoteNumber: string
  title: string
  description?: string
  validUntil?: string
  paymentTerms?: string
  subtotal: number
  gstRate?: number
  gstAmount?: number
  qstRate?: number
  qstAmount?: number
  taxRate?: number
  taxAmount?: number
  totalAmount: number
  ccFeeRate: number
  lineItems: LineItem[]
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
    gstNumber?: string
    qstNumber?: string
    wireInstructions?: string
    etransferEmail?: string
  }
}

export default function ClientInvoicePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const paymentStatus = searchParams?.get('payment')
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)
  const [showEtransferInfo, setShowEtransferInfo] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)

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
      currency: 'CAD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const calculateCCTotal = () => {
    if (!invoice) return 0
    const ccFee = invoice.totalAmount * (invoice.ccFeeRate / 100)
    return invoice.totalAmount + ccFee
  }

  const handlePayWithCard = async () => {
    try {
      setProcessingPayment(true)
      const response = await fetch(`/api/client-quotes/${id}/checkout`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create checkout session. Please try again.')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Failed to process payment. Please try again.')
    } finally {
      setProcessingPayment(false)
    }
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
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:bg-white print:py-0">
        <div className="max-w-2xl mx-auto">
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
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print:shadow-none print:border-0 print:rounded-none">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b">
              <div className="flex items-start justify-between mb-6">
                {/* Company Info */}
                <div className="flex-1">
                  {invoice.organization?.logoUrl ? (
                    <img
                      src={invoice.organization.logoUrl}
                      alt={companyName}
                      className="h-12 object-contain mb-3"
                    />
                  ) : (
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{companyName}</h2>
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
                  {invoice.validUntil && (
                    <p className="text-xs text-gray-400 mt-2">Due: {formatDate(invoice.validUntil)}</p>
                  )}
                </div>
              </div>

              {/* Tax Numbers - for print */}
              {(invoice.organization?.gstNumber || invoice.organization?.qstNumber) && (
                <div className="text-xs text-gray-400 mb-4 pb-4 border-b">
                  {invoice.organization.gstNumber && <span>GST: {invoice.organization.gstNumber}</span>}
                  {invoice.organization.gstNumber && invoice.organization.qstNumber && <span className="mx-2">•</span>}
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
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Project</p>
                  <p className="font-medium text-gray-900">{invoice.project.name}</p>
                  <p className="text-sm text-gray-500">{invoice.title}</p>
                </div>
              </div>

              {invoice.paymentTerms && (
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
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.displayDescription}</p>
                            )}
                            {item.specDetails && (
                              <button
                                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1"
                              >
                                {expandedItem === item.id ? 'Hide details' : 'See details'}
                                {expandedItem === item.id ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            {expandedItem === item.id && item.specDetails && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs space-y-1.5">
                                {item.specDetails.manufacturer && (
                                  <p><span className="text-gray-400">Manufacturer:</span> <span className="text-gray-700">{item.specDetails.manufacturer}</span></p>
                                )}
                                {item.specDetails.model && (
                                  <p><span className="text-gray-400">Model:</span> <span className="text-gray-700">{item.specDetails.model}</span></p>
                                )}
                                {item.specDetails.finish && (
                                  <p><span className="text-gray-400">Finish:</span> <span className="text-gray-700">{item.specDetails.finish}</span></p>
                                )}
                                {item.specDetails.dimensions && (
                                  <p><span className="text-gray-400">Dimensions:</span> <span className="text-gray-700">{item.specDetails.dimensions}</span></p>
                                )}
                                {item.specDetails.leadTime && (
                                  <p><span className="text-gray-400">Lead Time:</span> <span className="text-gray-700">{item.specDetails.leadTime}</span></p>
                                )}
                                {item.specDetails.allImages && item.specDetails.allImages.length > 1 && (
                                  <div className="flex gap-2 pt-2">
                                    {item.specDetails.allImages.slice(0, 4).map((img, idx) => (
                                      <img key={idx} src={img} alt="" className="w-12 h-12 rounded object-cover" />
                                    ))}
                                  </div>
                                )}
                              </div>
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
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold text-gray-900">Total Due</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section - Hidden when printing */}
          <div className="bg-gray-50 p-6 sm:p-8 border-t no-print">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Options</h3>

            <div className="space-y-3">
              {/* Credit Card */}
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
                  <span className="text-xs text-gray-400">+{invoice.ccFeeRate}% fee</span>
                </div>
                <Button
                  onClick={handlePayWithCard}
                  disabled={processingPayment}
                  className="w-full bg-[#635BFF] hover:bg-[#5851DB] text-white"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay ${formatCurrency(calculateCCTotal())}`
                  )}
                </Button>
              </div>

              {/* Wire Transfer */}
              <div className="bg-white rounded-xl border">
                <button
                  onClick={() => setShowWireInfo(!showWireInfo)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Wire Transfer / Direct Deposit</p>
                      <p className="text-xs text-gray-500">No processing fee</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWireInfo ? 'rotate-180' : ''}`} />
                  </div>
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
                    <p className="text-xs text-gray-400 mt-2">
                      Reference: {invoice.quoteNumber}
                    </p>
                  </div>
                )}
              </div>

              {/* Interac e-Transfer */}
              {invoice.organization?.etransferEmail && (
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowEtransferInfo(!showEtransferInfo)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Interac e-Transfer</p>
                        <p className="text-xs text-gray-500">No processing fee • Instant</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEtransferInfo ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {showEtransferInfo && (
                    <div className="px-4 pb-4 border-t pt-4">
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-700 mb-2">Send e-Transfer to:</p>
                        <p className="text-lg font-mono text-gray-900">{invoice.organization.etransferEmail}</p>
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-xs text-gray-500">
                          <p>1. Log in to your online banking</p>
                          <p>2. Select "Send Interac e-Transfer"</p>
                          <p>3. Enter the email above and amount</p>
                          <p>4. Use invoice number as message/memo</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Message/Memo: {invoice.quoteNumber}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Check */}
              <div className="bg-white rounded-xl border">
                <button
                  onClick={() => setShowCheckInfo(!showCheckInfo)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Check</p>
                      <p className="text-xs text-gray-500">No processing fee</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCheckInfo ? 'rotate-180' : ''}`} />
                  </div>
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
          </div>

          {/* Footer - shown in print */}
          <div className="px-6 sm:px-8 py-4 border-t text-center text-xs text-gray-400">
            <p className="text-gray-500">Thank you for your business</p>
          </div>
        </div>

        {/* Print Button - Hidden when printing */}
        <div className="text-center mt-6 no-print">
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="text-gray-500">
            Print Invoice
          </Button>
        </div>
      </div>
      </div>
    </>
  )
}
