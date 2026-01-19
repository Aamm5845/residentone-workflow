'use client'

import { useState, Fragment } from 'react'
import { FileText, ChevronDown, ChevronUp, Building, Banknote, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'

// Demo/mock data
const DEMO_INVOICE = {
  id: 'demo-invoice-1',
  quoteNumber: 'INV-2024-DEMO',
  title: 'Living Room Furniture Package',
  description: 'FFE procurement for living room renovation',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  paymentTerms: 'Net 30',
  subtotal: 12850,
  gstRate: 5,
  gstAmount: 642.50,
  qstRate: 9.975,
  qstAmount: 1282.29,
  totalAmount: 14774.79,
  ccFeeRate: 3,
  lineItems: [
    {
      id: 'item-1',
      displayName: 'Modern Sectional Sofa',
      displayDescription: 'L-shaped sectional with chaise, performance fabric in Charcoal',
      quantity: 1,
      unitType: 'unit',
      clientUnitPrice: 4500,
      clientTotalPrice: 4500,
      categoryName: 'Living Room',
      imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200',
      specDetails: {
        manufacturer: 'West Elm',
        model: 'Haven Sectional',
        finish: 'Performance Velvet - Charcoal',
        dimensions: '110"W x 85"D x 34"H',
        leadTime: '6-8 weeks'
      }
    },
    {
      id: 'item-2',
      displayName: 'Coffee Table - Marble Top',
      displayDescription: 'Round coffee table with brass base',
      quantity: 1,
      unitType: 'unit',
      clientUnitPrice: 1450,
      clientTotalPrice: 1450,
      categoryName: 'Living Room',
      imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=200',
      specDetails: {
        manufacturer: 'CB2',
        model: 'Silhouette Pedestal',
        finish: 'White Marble / Brass',
        dimensions: '36" diameter x 16"H',
        leadTime: '2-4 weeks'
      }
    },
    {
      id: 'item-3',
      displayName: 'Mid-Century Accent Chair',
      displayDescription: 'Teal velvet with walnut legs',
      quantity: 2,
      unitType: 'units',
      clientUnitPrice: 1200,
      clientTotalPrice: 2400,
      categoryName: 'Living Room',
      imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=200',
      specDetails: {
        manufacturer: 'Article',
        model: 'Matrix Chair',
        finish: 'Teal Velvet',
        dimensions: '32"W x 33"D x 33"H',
        leadTime: '2-3 weeks'
      }
    },
    {
      id: 'item-4',
      displayName: 'Arc Floor Lamp',
      displayDescription: 'Chrome arc lamp with marble base',
      quantity: 1,
      unitType: 'unit',
      clientUnitPrice: 650,
      clientTotalPrice: 650,
      categoryName: 'Lighting',
      specDetails: {
        manufacturer: 'West Elm',
        model: 'Overarching Floor Lamp',
        finish: 'Polished Chrome',
        leadTime: '1-2 weeks'
      }
    },
    {
      id: 'item-5',
      displayName: 'Hand-Knotted Area Rug 8x10',
      displayDescription: 'Wool blend, low pile geometric pattern',
      quantity: 1,
      unitType: 'unit',
      clientUnitPrice: 2650,
      clientTotalPrice: 2650,
      categoryName: 'Rugs & Textiles',
      specDetails: {
        manufacturer: 'Loloi',
        model: 'Odyssey Collection',
        finish: 'Charcoal / Ivory',
        dimensions: '8\' x 10\'',
        leadTime: '1-2 weeks'
      }
    },
    {
      id: 'item-6',
      displayName: 'Decorative Throw Pillows',
      displayDescription: 'Set of 4 - mixed textures',
      quantity: 1,
      unitType: 'set',
      clientUnitPrice: 450,
      clientTotalPrice: 450,
      categoryName: 'Accessories',
    },
    {
      id: 'item-7',
      displayName: 'Console Table',
      displayDescription: 'Oak with brass accents',
      quantity: 1,
      unitType: 'unit',
      clientUnitPrice: 750,
      clientTotalPrice: 750,
      categoryName: 'Living Room',
      specDetails: {
        manufacturer: 'West Elm',
        model: 'Mid-Century Console',
        finish: 'Acorn / Brass',
        dimensions: '56"W x 14"D x 30"H',
        leadTime: '3-4 weeks'
      }
    }
  ],
  project: {
    name: 'Demo Project - Modern Condo',
    client: {
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '(514) 555-0123'
    }
  },
  organization: {
    businessName: 'Meisner Interiors',
    name: 'Meisner Interiors',
    businessEmail: 'aaron@meisnerinteriors.com',
    businessPhone: '(514) 797-6957',
    businessAddress: '6700 Ave Du Parc #109',
    businessCity: 'Montreal',
    businessProvince: 'QC',
    businessPostal: 'H2V4H9',
    logoUrl: null, // Set to null to show text instead
    gstNumber: '123456789RT0001',
    qstNumber: '1234567890TQ0001',
    wireInstructions: `Bank: Royal Bank of Canada
Account Name: Meisner Interiors Inc.
Account #: 1234567
Transit #: 12345
Institution #: 003
SWIFT: ROYCCAT2`
  }
}

interface SpecDetails {
  manufacturer?: string | null
  model?: string | null
  finish?: string | null
  dimensions?: string | null
  leadTime?: string | null
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

export default function ClientInvoiceDemoPage() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [showWireInfo, setShowWireInfo] = useState(false)
  const [showCheckInfo, setShowCheckInfo] = useState(false)

  const invoice = DEMO_INVOICE

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
    const ccFee = invoice.totalAmount * (invoice.ccFeeRate / 100)
    return invoice.totalAmount + ccFee
  }

  const handlePayWithCard = () => {
    toast.success('Demo: This would redirect to Stripe checkout')
  }

  // Group line items by category
  const groupedItems = invoice.lineItems.reduce((groups: Record<string, LineItem[]>, item) => {
    const key = item.categoryName || 'Items'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})

  const companyName = invoice.organization?.businessName || invoice.organization?.name || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Demo Banner */}
      <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
        Demo Mode - This is a preview of what clients see when viewing an invoice
      </div>

      <div className="py-8 px-4">
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
                  {invoice.project.client?.phone && (
                    <p className="text-sm text-gray-500">{invoice.project.client.phone}</p>
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
                    <Fragment key={category}>
                      {/* Category header */}
                      <tr>
                        <td colSpan={4} className="pt-4 pb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</p>
                        </td>
                      </tr>
                      {items.map((item) => (
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
                      ))}
                    </Fragment>
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
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">GST ({invoice.gstRate}%)</span>
                      <span className="text-gray-700">{formatCurrency(invoice.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">QST ({invoice.qstRate}%)</span>
                      <span className="text-gray-700">{formatCurrency(invoice.qstAmount)}</span>
                    </div>
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
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">Credit / Debit Card</p>
                        <p className="text-xs text-gray-500">Visa, Mastercard, Amex</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">+{invoice.ccFeeRate}% processing fee</span>
                  </div>
                  <Button
                    onClick={handlePayWithCard}
                    className="w-full bg-[#635BFF] hover:bg-[#5851DB] text-white"
                  >
                    Pay {formatCurrency(calculateCCTotal())} with Card
                  </Button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Secure payment powered by Stripe
                  </p>
                </div>

                {/* Wire Transfer */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setShowWireInfo(!showWireInfo)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="font-medium text-gray-900 text-sm">Wire Transfer / EFT</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWireInfo ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {showWireInfo && (
                    <div className="px-4 pb-4 border-t pt-4">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded-lg">
                        {invoice.organization.wireInstructions}
                      </pre>
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-700">
                          <strong>Reference:</strong> {invoice.quoteNumber}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Please include the invoice number in your transfer memo
                        </p>
                      </div>
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
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Banknote className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="font-medium text-gray-900 text-sm">Check</p>
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
                        <div className="mt-2">
                          <p className="font-medium text-gray-700">Mail to:</p>
                          <p>{invoice.organization.businessAddress}</p>
                          <p>
                            {invoice.organization.businessCity}, {invoice.organization.businessProvince} {invoice.organization.businessPostal}
                          </p>
                        </div>
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
              <div className="mt-1">
                GST: {invoice.organization.gstNumber} • QST: {invoice.organization.qstNumber}
              </div>
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
    </div>
  )
}
