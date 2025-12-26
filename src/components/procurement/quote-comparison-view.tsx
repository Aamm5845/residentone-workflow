'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Clock,
  Star,
  TrendingDown,
  TrendingUp,
  Minus,
  Award,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  leadTimeDays?: number
  notes?: string
  rfqLineItemId?: string
}

interface SupplierQuote {
  id: string
  quoteNumber?: string
  status: string
  totalAmount: number
  validUntil?: string
  leadTimeDays?: number
  shippingCost: number
  notes?: string
  submittedAt?: string
  supplier: {
    id: string
    name: string
    email?: string
  }
  lineItems: QuoteLineItem[]
}

interface RFQLineItem {
  id: string
  description: string
  quantity: number
  specifications?: string
}

interface RFQ {
  id: string
  rfqNumber: string
  title: string
  lineItems: RFQLineItem[]
}

interface QuoteComparisonViewProps {
  rfqId: string
  onBack?: () => void
  onSelectQuote?: (quoteId: string) => void
}

export default function QuoteComparisonView({ rfqId, onBack, onSelectQuote }: QuoteComparisonViewProps) {
  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [quotes, setQuotes] = useState<SupplierQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch RFQ details
      const rfqResponse = await fetch(`/api/rfq/${rfqId}`)
      if (!rfqResponse.ok) throw new Error('Failed to fetch RFQ')
      const rfqData = await rfqResponse.json()
      setRfq(rfqData)

      // Fetch quotes for this RFQ
      const quotesResponse = await fetch(`/api/rfq/${rfqId}/quotes`)
      if (!quotesResponse.ok) throw new Error('Failed to fetch quotes')
      const quotesData = await quotesResponse.json()

      // Filter to only submitted/accepted quotes
      const validQuotes = quotesData.quotes?.filter(
        (q: SupplierQuote) => q.status === 'SUBMITTED' || q.status === 'ACCEPTED'
      ) || []
      setQuotes(validQuotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [rfqId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const toggleRowExpansion = (itemId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Calculate comparison metrics
  const getQuoteMetrics = () => {
    if (quotes.length === 0) return null

    const totals = quotes.map(q => q.totalAmount)
    const leadTimes = quotes.map(q => q.leadTimeDays).filter(Boolean) as number[]

    return {
      lowestTotal: Math.min(...totals),
      highestTotal: Math.max(...totals),
      averageTotal: totals.reduce((a, b) => a + b, 0) / totals.length,
      shortestLeadTime: leadTimes.length > 0 ? Math.min(...leadTimes) : null,
      longestLeadTime: leadTimes.length > 0 ? Math.max(...leadTimes) : null
    }
  }

  const metrics = getQuoteMetrics()

  // Find the best quote for each line item
  const getBestPriceForItem = (rfqLineItemId: string): { quoteId: string; price: number } | null => {
    let best: { quoteId: string; price: number } | null = null

    for (const quote of quotes) {
      const lineItem = quote.lineItems.find(li => li.rfqLineItemId === rfqLineItemId)
      if (lineItem) {
        if (!best || lineItem.totalPrice < best.price) {
          best = { quoteId: quote.id, price: lineItem.totalPrice }
        }
      }
    }

    return best
  }

  // Get price indicator
  const getPriceIndicator = (quoteId: string, price: number, rfqLineItemId: string) => {
    const best = getBestPriceForItem(rfqLineItemId)
    if (!best) return null

    if (quoteId === best.quoteId) {
      return { type: 'best', icon: TrendingDown, color: 'text-green-600' }
    }

    const diff = ((price - best.price) / best.price) * 100
    if (diff > 20) {
      return { type: 'high', icon: TrendingUp, color: 'text-red-600', diff }
    }
    if (diff > 10) {
      return { type: 'moderate', icon: Minus, color: 'text-yellow-600', diff }
    }
    return { type: 'competitive', icon: Minus, color: 'text-gray-400', diff }
  }

  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId)
    onSelectQuote?.(quoteId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !rfq) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>{error || 'RFQ not found'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className="p-6">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to RFQ
          </button>
        )}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <FileText className="h-12 w-12 mx-auto text-yellow-400 mb-3" />
          <h3 className="text-lg font-medium text-yellow-800 mb-1">No Quotes to Compare</h3>
          <p className="text-yellow-600">
            No supplier quotes have been submitted yet for this RFQ.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quote Comparison</h1>
            <p className="text-gray-500 mt-1">
              {rfq.rfqNumber} • {rfq.title} • {quotes.length} quotes
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <TrendingDown className="h-5 w-5" />
              <span className="text-sm font-medium">Lowest Quote</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.lowestTotal)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Highest Quote</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.highestTotal)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Average Quote</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(metrics.averageTotal)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Lead Time Range</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.shortestLeadTime && metrics.longestLeadTime
                ? `${metrics.shortestLeadTime}-${metrics.longestLeadTime} days`
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Supplier Header Row */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 min-w-[200px]">
                  Line Item
                </th>
                {quotes.map((quote) => (
                  <th key={quote.id} className="px-6 py-4 text-center min-w-[200px]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">{quote.supplier.name}</span>
                      </div>
                      {quote.totalAmount === metrics?.lowestTotal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Award className="h-3 w-3" />
                          Best Price
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {quote.quoteNumber || `Quote ${quote.id.slice(0, 8)}`}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Line Items Comparison */}
              {rfq.lineItems.map((rfqItem) => {
                const isExpanded = expandedRows.has(rfqItem.id)

                return (
                  <>
                    <tr key={rfqItem.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 sticky left-0 bg-white">
                        <button
                          onClick={() => toggleRowExpansion(rfqItem.id)}
                          className="flex items-center gap-2 text-left w-full"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{rfqItem.description}</div>
                            <div className="text-sm text-gray-500">Qty: {rfqItem.quantity}</div>
                          </div>
                        </button>
                      </td>
                      {quotes.map((quote) => {
                        const lineItem = quote.lineItems.find(li => li.rfqLineItemId === rfqItem.id)
                        const indicator = lineItem ? getPriceIndicator(quote.id, lineItem.totalPrice, rfqItem.id) : null

                        return (
                          <td key={`${quote.id}-${rfqItem.id}`} className="px-6 py-4 text-center">
                            {lineItem ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {formatCurrency(lineItem.totalPrice)}
                                  </span>
                                  {indicator && (
                                    <indicator.icon className={`h-4 w-4 ${indicator.color}`} />
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {formatCurrency(lineItem.unitPrice)} × {lineItem.quantity}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td className="px-6 py-3 sticky left-0 bg-gray-50">
                          <div className="pl-6 text-sm text-gray-600">
                            {rfqItem.specifications && (
                              <p className="mb-1"><strong>Specs:</strong> {rfqItem.specifications}</p>
                            )}
                          </div>
                        </td>
                        {quotes.map((quote) => {
                          const lineItem = quote.lineItems.find(li => li.rfqLineItemId === rfqItem.id)

                          return (
                            <td key={`${quote.id}-${rfqItem.id}-details`} className="px-6 py-3 text-center text-sm">
                              {lineItem ? (
                                <div className="space-y-1 text-gray-600">
                                  {lineItem.leadTimeDays && (
                                    <p>Lead time: {lineItem.leadTimeDays} days</p>
                                  )}
                                  {lineItem.notes && (
                                    <p className="text-xs">{lineItem.notes}</p>
                                  )}
                                </div>
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </>
                )
              })}

              {/* Shipping Row */}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 sticky left-0 bg-gray-50 font-medium text-gray-700">
                  Shipping Cost
                </td>
                {quotes.map((quote) => (
                  <td key={`${quote.id}-shipping`} className="px-6 py-4 text-center">
                    <span className="text-gray-900">
                      {quote.shippingCost > 0 ? formatCurrency(quote.shippingCost) : 'Free'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Lead Time Row */}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 sticky left-0 bg-gray-50 font-medium text-gray-700">
                  Lead Time
                </td>
                {quotes.map((quote) => (
                  <td key={`${quote.id}-leadtime`} className="px-6 py-4 text-center">
                    <span className={`${
                      quote.leadTimeDays === metrics?.shortestLeadTime
                        ? 'text-green-600 font-medium'
                        : 'text-gray-900'
                    }`}>
                      {quote.leadTimeDays ? `${quote.leadTimeDays} days` : '—'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Valid Until Row */}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 sticky left-0 bg-gray-50 font-medium text-gray-700">
                  Valid Until
                </td>
                {quotes.map((quote) => (
                  <td key={`${quote.id}-valid`} className="px-6 py-4 text-center">
                    {quote.validUntil ? (
                      <span className={new Date(quote.validUntil) < new Date() ? 'text-red-600' : 'text-gray-900'}>
                        {formatDate(quote.validUntil)}
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>

              {/* Total Row */}
              <tr className="border-t-2 border-gray-200">
                <td className="px-6 py-4 sticky left-0 bg-white font-semibold text-gray-900">
                  Total Amount
                </td>
                {quotes.map((quote) => (
                  <td key={`${quote.id}-total`} className="px-6 py-4 text-center">
                    <div className="space-y-2">
                      <div className={`text-xl font-bold ${
                        quote.totalAmount === metrics?.lowestTotal
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }`}>
                        {formatCurrency(quote.totalAmount)}
                      </div>
                      <button
                        onClick={() => handleSelectQuote(quote.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedQuoteId === quote.id
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {selectedQuoteId === quote.id ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Selected
                          </span>
                        ) : (
                          'Select Quote'
                        )}
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Section */}
      {quotes.some(q => q.notes) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Notes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.filter(q => q.notes).map((quote) => (
              <div key={`${quote.id}-notes`} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{quote.supplier.name}</span>
                </div>
                <p className="text-sm text-gray-600">{quote.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
