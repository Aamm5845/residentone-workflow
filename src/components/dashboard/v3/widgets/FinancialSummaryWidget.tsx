'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface FinancialOverview {
  revenue: number
  costs: number
  profit: number
  margin: number
  gstCollected: number
  gstPaid: number
  gstNet: number
  qstCollected: number
  qstPaid: number
  qstNet: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function FinancialSummaryWidget() {
  const { data, error } = useSWR<FinancialOverview>(
    '/api/financials/overview',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Unable to load financials</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-16 bg-gray-100 rounded-lg" />
      </div>
    )
  }

  const isPositiveMargin = data.margin >= 0

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        {/* Revenue & Costs */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-green-50/60 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-[0.06em] font-medium text-green-600/70 mb-1">Revenue</p>
            <p className="text-[18px] font-semibold text-gray-900 leading-none">{formatCurrency(data.revenue)}</p>
          </div>
          <div className="bg-red-50/60 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-[0.06em] font-medium text-red-500/70 mb-1">Costs</p>
            <p className="text-[18px] font-semibold text-gray-900 leading-none">{formatCurrency(data.costs)}</p>
          </div>
        </div>

        {/* Profit & Margin */}
        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.06em] font-medium text-gray-400 mb-1">Net Profit</p>
            <p className={`text-[20px] font-semibold leading-none ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.profit)}
            </p>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${
            isPositiveMargin ? 'bg-green-100/60 text-green-600' : 'bg-red-100/60 text-red-600'
          }`}>
            {isPositiveMargin ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="text-[12px] font-semibold">{Math.round(data.margin)}%</span>
          </div>
        </div>

        {/* Tax summary */}
        {(data.gstNet !== 0 || data.qstNet !== 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {data.gstNet !== 0 && (
              <div className="text-center p-2 bg-gray-50/50 rounded-lg">
                <p className="text-[10px] text-gray-400 font-medium">GST Net</p>
                <p className="text-[13px] font-semibold text-gray-700">{formatCurrency(data.gstNet)}</p>
              </div>
            )}
            {data.qstNet !== 0 && (
              <div className="text-center p-2 bg-gray-50/50 rounded-lg">
                <p className="text-[10px] text-gray-400 font-medium">QST Net</p>
                <p className="text-[13px] font-semibold text-gray-700">{formatCurrency(data.qstNet)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
        <Link
          href="/financials"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          Full Report <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
