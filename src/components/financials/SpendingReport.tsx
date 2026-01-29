'use client'

import { useState, useEffect } from 'react'
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  Calendar,
  Briefcase,
  Receipt
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CategoryData {
  category: string
  amount: number
  percentage: number
  transactionCount: number
}

interface ReportData {
  period: {
    start: string
    end: string
  }
  summary: {
    totalExpenses: number
    totalIncome: number
    netFlow: number
    businessExpenses: number
    transactionCount: number
  }
  byCategory: CategoryData[]
  spendingTrend: { date: string; amount: number }[]
  uncategorizedCount: number
}

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  'Groceries': 'bg-green-500',
  'Dining & Restaurants': 'bg-orange-500',
  'Transportation': 'bg-blue-500',
  'Gas & Fuel': 'bg-yellow-500',
  'Shopping': 'bg-pink-500',
  'Entertainment': 'bg-purple-500',
  'Utilities': 'bg-cyan-500',
  'Healthcare': 'bg-red-500',
  'Insurance': 'bg-indigo-500',
  'Subscriptions': 'bg-violet-500',
  'Travel': 'bg-teal-500',
  'Home & Garden': 'bg-lime-500',
  'Personal Care': 'bg-rose-500',
  'Education': 'bg-amber-500',
  'Business Expense': 'bg-slate-500',
  'Office Supplies': 'bg-gray-500',
  'Professional Services': 'bg-zinc-500',
  'Bank Fees': 'bg-stone-500',
  'Transfer': 'bg-neutral-400',
  'Income': 'bg-emerald-500',
  'Refund': 'bg-sky-500',
  'Other': 'bg-gray-400',
  'Uncategorized': 'bg-gray-300',
}

export function SpendingReport() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/plaid/spending-report?period=${period}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch report')
        }

        setReport(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReport()
  }, [period])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format date range
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${startDate.toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Generating report...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {formatDateRange(report.period.start, report.period.end)}
            </span>
          </div>
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : '1 Year'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(report.summary.totalExpenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Income</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(report.summary.totalIncome)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              report.summary.netFlow >= 0 ? "bg-green-100" : "bg-red-100"
            )}>
              <DollarSign className={cn(
                "h-5 w-5",
                report.summary.netFlow >= 0 ? "text-green-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Net Flow</p>
              <p className={cn(
                "text-xl font-bold",
                report.summary.netFlow >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {report.summary.netFlow >= 0 ? '+' : ''}
                {formatCurrency(report.summary.netFlow)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Business Expenses</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(report.summary.businessExpenses)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-gray-400" />
            Spending by Category
          </h2>
          {report.uncategorizedCount > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              {report.uncategorizedCount} transactions need AI categorization
            </p>
          )}
        </div>

        <div className="p-4">
          {report.byCategory.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 mx-auto text-gray-300" />
              <p className="text-gray-500 mt-2">No expense data for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {report.byCategory.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full',
                          CATEGORY_COLORS[cat.category] || 'bg-gray-400'
                        )}
                      />
                      <span className="font-medium text-gray-900">{cat.category}</span>
                      <span className="text-gray-400">({cat.transactionCount})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(cat.amount)}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({cat.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        CATEGORY_COLORS[cat.category] || 'bg-gray-400'
                      )}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Spending Trend */}
      {report.spendingTrend.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Daily Spending</h2>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-1 h-32">
              {report.spendingTrend.map((day, idx) => {
                const maxAmount = Math.max(...report.spendingTrend.map((d) => d.amount))
                const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <div className="w-full relative">
                      <div
                        className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                        style={{ height: `${Math.max(height, 2)}px` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString('en-CA', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          : {formatCurrency(day.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>
                {new Date(report.spendingTrend[0]?.date).toLocaleDateString('en-CA', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>
                {new Date(
                  report.spendingTrend[report.spendingTrend.length - 1]?.date
                ).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
