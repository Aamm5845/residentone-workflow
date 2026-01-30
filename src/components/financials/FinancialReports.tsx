'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MonthData {
  month: string
  totalExpenses: number
  totalIncome: number
  businessExpenses: number
  byCategory: Record<string, number>
}

interface CategoryTotal {
  category: string
  total: number
}

interface CategoryTransaction {
  id: string
  date: string
  name: string
  amount: number
  category: string
  accountName: string
  isBusinessExpense: boolean
}

interface ReportData {
  months: MonthData[]
  categories: CategoryTotal[]
  totals: {
    totalExpenses: number
    totalIncome: number
    businessExpenses: number
  }
  averages: {
    monthlyExpenses: number
    monthlyIncome: number
    monthlyBusinessExpenses: number
  }
  period: {
    start: string
    end: string
    monthCount: number
  }
}

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
  'Business Expense': 'bg-slate-600',
  'Office Supplies': 'bg-gray-500',
  'Professional Services': 'bg-zinc-600',
  'Bank Fees': 'bg-stone-500',
  'Transfer': 'bg-neutral-400',
  'Income': 'bg-emerald-500',
  'Refund': 'bg-sky-500',
  'Other': 'bg-gray-400',
  'Uncategorized': 'bg-gray-300',
}

export function FinancialReports() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [months, setMonths] = useState(12)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null) // YYYY-MM format
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [categoryTransactions, setCategoryTransactions] = useState<Record<string, CategoryTransaction[]>>({})
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/plaid/monthly-report?months=${months}`)
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
  }, [months])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  }

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) {
        next.delete(month)
      } else {
        next.add(month)
      }
      return next
    })
  }

  // Fetch transactions for a category
  const fetchCategoryTransactions = async (category: string) => {
    const cacheKey = `${category}-${selectedMonth || 'all'}-${months}`

    setLoadingCategories((prev) => new Set(prev).add(category))

    try {
      const params = new URLSearchParams({
        category,
        months: months.toString(),
      })
      if (selectedMonth) {
        params.set('month', selectedMonth)
      }

      const response = await fetch(`/api/plaid/category-transactions?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }

      setCategoryTransactions((prev) => ({
        ...prev,
        [cacheKey]: data.transactions,
      }))
    } catch (err: any) {
      console.error('Failed to fetch category transactions:', err)
    } finally {
      setLoadingCategories((prev) => {
        const next = new Set(prev)
        next.delete(category)
        return next
      })
    }
  }

  const toggleCategory = (category: string) => {
    const cacheKey = `${category}-${selectedMonth || 'all'}-${months}`

    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
        // Fetch transactions if not cached
        if (!categoryTransactions[cacheKey]) {
          fetchCategoryTransactions(category)
        }
      }
      return next
    })
  }

  const getCachedTransactions = (category: string) => {
    const cacheKey = `${category}-${selectedMonth || 'all'}-${months}`
    return categoryTransactions[cacheKey] || []
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!report) return null

  // Get data for selected month or all months
  const selectedMonthData = selectedMonth
    ? report.months.find(m => m.month === selectedMonth)
    : null

  // Calculate totals based on selection
  const displayTotals = selectedMonthData
    ? {
        totalExpenses: selectedMonthData.totalExpenses,
        totalIncome: selectedMonthData.totalIncome,
        businessExpenses: selectedMonthData.businessExpenses,
      }
    : report.totals

  // Calculate categories based on selection
  const displayCategories = selectedMonthData
    ? Object.entries(selectedMonthData.byCategory)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
    : report.categories

  const maxExpense = Math.max(...report.months.map((m) => m.totalExpenses), 1)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/financials"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-green-600" />
              Financial Reports
            </h1>
            <p className="text-gray-500 mt-1">
              Monthly spending breakdown and category analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <select
              value={selectedMonth || ''}
              onChange={(e) => {
                setSelectedMonth(e.target.value || null)
                setExpandedCategories(new Set()) // Clear expanded on month change
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Months</option>
              {report?.months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonth(m.month)}
                </option>
              ))}
            </select>

            {/* Range buttons */}
            <div className="flex gap-1">
              {[6, 12, 24].map((m) => (
                <Button
                  key={m}
                  variant={months === m ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setMonths(m)
                    setSelectedMonth(null)
                    setExpandedCategories(new Set()) // Clear expanded on range change
                  }}
                >
                  {m}mo
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {selectedMonth ? 'Monthly' : 'Total'} Expenses
              </p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(displayTotals.totalExpenses)}
              </p>
              <p className="text-xs text-gray-400">
                Avg: {formatCurrency(report.averages.monthlyExpenses)}/mo
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
              <p className="text-sm text-gray-500">
                {selectedMonth ? 'Monthly' : 'Total'} Income
              </p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(displayTotals.totalIncome)}
              </p>
              {!selectedMonth && (
                <p className="text-xs text-gray-400">
                  Avg: {formatCurrency(report.averages.monthlyIncome)}/mo
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              displayTotals.totalIncome - displayTotals.totalExpenses >= 0
                ? "bg-green-100"
                : "bg-red-100"
            )}>
              <DollarSign className={cn(
                "h-5 w-5",
                displayTotals.totalIncome - displayTotals.totalExpenses >= 0
                  ? "text-green-600"
                  : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Net Savings</p>
              <p className={cn(
                "text-xl font-bold",
                displayTotals.totalIncome - displayTotals.totalExpenses >= 0
                  ? "text-green-600"
                  : "text-red-600"
              )}>
                {formatCurrency(displayTotals.totalIncome - displayTotals.totalExpenses)}
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
                {formatCurrency(displayTotals.businessExpenses)}
              </p>
              <p className="text-xs text-gray-400">Tax deductible</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 mb-8">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Spending by Category {selectedMonth ? `(${formatMonth(selectedMonth)})` : '(All Time)'}
          </h2>
          <p className="text-sm text-gray-500">Click on a category to see transactions</p>
        </div>
        <div className="divide-y divide-gray-100">
          {displayCategories.map((cat) => {
            const percentage = (cat.total / displayTotals.totalExpenses) * 100
            const isExpanded = expandedCategories.has(cat.category)
            const transactions = getCachedTransactions(cat.category)
            const isLoadingTxns = loadingCategories.has(cat.category)

            return (
              <div key={cat.category}>
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="w-full p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full',
                          CATEGORY_COLORS[cat.category] || 'bg-gray-400'
                        )}
                      />
                      <span className="font-medium text-gray-900">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(cat.total)}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-6">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        CATEGORY_COLORS[cat.category] || 'bg-gray-400'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>

                {/* Expanded Transactions */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {isLoadingTxns ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        <p className="text-sm text-gray-500 mt-1">Loading transactions...</p>
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No transactions found
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                        {transactions.map((txn) => (
                          <div
                            key={txn.id}
                            className="flex items-center justify-between px-4 py-3 pl-10 hover:bg-white"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">{txn.name}</p>
                              <p className="text-xs text-gray-500">
                                {txn.accountName} • {new Date(txn.date).toLocaleDateString('en-CA', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                                {txn.isBusinessExpense && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                    Business
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(txn.amount)}
                            </span>
                          </div>
                        ))}
                        {transactions.length >= 100 && (
                          <div className="p-2 text-center text-xs text-gray-500 bg-gray-100">
                            Showing top 100 transactions
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Breakdown</h2>
        </div>

        {/* Monthly Chart */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-end gap-2 h-40">
            {report.months.map((month) => {
              const height = (month.totalExpenses / maxExpense) * 100

              return (
                <div
                  key={month.month}
                  className="flex-1 flex flex-col items-center group cursor-pointer"
                  onClick={() => toggleMonth(month.month)}
                >
                  <div className="w-full relative">
                    <div
                      className="w-full bg-red-400 rounded-t hover:bg-red-500 transition-colors"
                      style={{ height: `${Math.max(height, 4)}px` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {formatMonth(month.month)}: {formatCurrency(month.totalExpenses)}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 rotate-45 origin-left">
                    {month.month.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monthly Details */}
        <div className="divide-y divide-gray-100">
          {[...report.months].reverse().map((month) => {
            const isExpanded = expandedMonths.has(month.month)
            const categories = Object.entries(month.byCategory)
              .sort((a, b) => b[1] - a[1])

            return (
              <div key={month.month}>
                <button
                  onClick={() => toggleMonth(month.month)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{formatMonth(month.month)}</p>
                      <p className="text-xs text-gray-500">
                        {categories.length} categories
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(month.totalExpenses)}
                    </p>
                    {month.totalIncome > 0 && (
                      <p className="text-xs text-green-600">
                        +{formatCurrency(month.totalIncome)} income
                      </p>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pl-11">
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {categories.map(([cat, amount]) => (
                        <div
                          key={cat}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                CATEGORY_COLORS[cat] || 'bg-gray-400'
                              )}
                            />
                            <span className="text-gray-700">{cat}</span>
                          </div>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
