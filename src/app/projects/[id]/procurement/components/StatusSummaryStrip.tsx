'use client'

import {
  FileText,
  DollarSign,
  AlertCircle,
  Truck
} from 'lucide-react'

interface Stats {
  pendingQuotes: number
  unpaidInvoices: number
  overdueOrders: number
  upcomingDeliveries: number
}

interface StatusSummaryStripProps {
  stats: Stats
  onIndicatorClick: (tab: string) => void
}

export default function StatusSummaryStrip({ stats, onIndicatorClick }: StatusSummaryStripProps) {
  const { pendingQuotes, unpaidInvoices, overdueOrders, upcomingDeliveries } = stats

  // Only show strip if there are items to display
  const hasItems = pendingQuotes > 0 || unpaidInvoices > 0 || overdueOrders > 0 || upcomingDeliveries > 0

  if (!hasItems) {
    return null
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-2.5">
        <div className="flex items-center gap-6">
          {/* Pending Quotes */}
          {pendingQuotes > 0 && (
            <button
              onClick={() => onIndicatorClick('supplier-quotes')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="flex items-center justify-center w-5 h-5 bg-amber-100 rounded">
                <FileText className="w-3 h-3 text-amber-600" />
              </span>
              <span>
                <span className="font-medium text-amber-600">{pendingQuotes}</span>
                <span className="text-gray-500"> quote{pendingQuotes !== 1 ? 's' : ''} pending</span>
              </span>
            </button>
          )}

          {/* Unpaid Invoices */}
          {unpaidInvoices > 0 && (
            <>
              {pendingQuotes > 0 && <span className="w-px h-4 bg-gray-300" />}
              <button
                onClick={() => onIndicatorClick('client-invoices')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 rounded">
                  <DollarSign className="w-3 h-3 text-blue-600" />
                </span>
                <span>
                  <span className="font-medium text-blue-600">{unpaidInvoices}</span>
                  <span className="text-gray-500"> invoice{unpaidInvoices !== 1 ? 's' : ''} unpaid</span>
                </span>
              </button>
            </>
          )}

          {/* Overdue Orders */}
          {overdueOrders > 0 && (
            <>
              {(pendingQuotes > 0 || unpaidInvoices > 0) && <span className="w-px h-4 bg-gray-300" />}
              <button
                onClick={() => onIndicatorClick('orders')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 bg-red-100 rounded">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                </span>
                <span>
                  <span className="font-medium text-red-600">{overdueOrders}</span>
                  <span className="text-gray-500"> order{overdueOrders !== 1 ? 's' : ''} overdue</span>
                </span>
              </button>
            </>
          )}

          {/* Upcoming Deliveries */}
          {upcomingDeliveries > 0 && (
            <>
              {(pendingQuotes > 0 || unpaidInvoices > 0 || overdueOrders > 0) && <span className="w-px h-4 bg-gray-300" />}
              <button
                onClick={() => onIndicatorClick('delivery')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 rounded">
                  <Truck className="w-3 h-3 text-emerald-600" />
                </span>
                <span>
                  <span className="font-medium text-emerald-600">{upcomingDeliveries}</span>
                  <span className="text-gray-500"> deliver{upcomingDeliveries !== 1 ? 'ies' : 'y'} this week</span>
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
