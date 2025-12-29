'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, FileText, Mail, Phone, Calendar, ChevronDown, ChevronUp, Building, Banknote, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  }
}

export default function ClientInvoicePage() {
  const params = useParams()
  const id = params?.id as string
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)

  useEffect(() => {
    if (id) {
      loadInvoice()
    }
  }, [id])

  const loadInvoice = async () => {
    try {
      const response = await fetch(`/api/client-quotes/${id}/client-view`)
      if (response.ok) {
        const data = await response.json()
        setInvoice(data)
      } else {
        setError('Invoice not found')
      }
    } catch (err) {
      setError('Failed to load invoice')
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

  const handlePayWithCard = () => {
    // TODO: Integrate with Stripe - will redirect to Stripe checkout with 3% added
    alert(`Redirecting to Stripe checkout for ${formatCurrency(calculateCCTotal())}`)
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
  const companyName = invoice.organization?.businessName || invoice.organization?.name || ''

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b">
            <div className="flex items-start justify-between mb-6">
              <div>
                {invoice.organization?.logoUrl ? (
                  <img
                    src={invoice.organization.logoUrl}
                    alt={companyName}
                    className="h-10 object-contain"
                  />
                ) : (
                  <h2 className="text-xl font-bold text-gray-900">{companyName}</h2>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Invoice</p>
                <p className="font-mono text-sm text-gray-700">{invoice.quoteNumber}</p>
              </div>
            </div>

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

            {(invoice.validUntil || invoice.paymentTerms) && (
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t text-sm">
                {invoice.validUntil && (
                  <div>
                    <span className="text-gray-400">Valid until:</span>
                    <span className="ml-2 text-gray-700">{formatDate(invoice.validUntil)}</span>
                  </div>
                )}
                {invoice.paymentTerms && (
                  <div>
                    <span className="text-gray-400">Terms:</span>
                    <span className="ml-2 text-gray-700">{invoice.paymentTerms}</span>
                  </div>
                )}
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

          {/* Payment Section */}
          <div className="bg-gray-50 p-6 sm:p-8 border-t">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Options</h3>

            <div className="space-y-3">
              {/* Credit Card */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
                      alt="Stripe"
                      className="h-6"
                    />
                    <span className="text-sm text-gray-600">Credit / Debit Card</span>
                  </div>
                  <span className="text-xs text-gray-400">+{invoice.ccFeeRate}% processing fee</span>
                </div>
                <Button
                  onClick={handlePayWithCard}
                  className="w-full bg-[#635BFF] hover:bg-[#5851DB] text-white"
                >
                  Pay {formatCurrency(calculateCCTotal())}
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
                      <p className="font-medium text-gray-900 text-sm">Wire Transfer</p>
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
                      <p className="text-sm text-gray-500">
                        Contact {invoice.organization?.businessEmail || 'us'} for wire transfer details.
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Reference: {invoice.quoteNumber}
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

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t text-center text-xs text-gray-400">
            {companyName}
            {invoice.organization?.businessEmail && ` • ${invoice.organization.businessEmail}`}
            {invoice.organization?.businessPhone && ` • ${invoice.organization.businessPhone}`}
            {(invoice.organization?.gstNumber || invoice.organization?.qstNumber) && (
              <div className="mt-1">
                {invoice.organization.gstNumber && `GST: ${invoice.organization.gstNumber}`}
                {invoice.organization.gstNumber && invoice.organization.qstNumber && ' • '}
                {invoice.organization.qstNumber && `QST: ${invoice.organization.qstNumber}`}
              </div>
            )}
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
