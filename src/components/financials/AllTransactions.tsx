'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SpendingReport } from './SpendingReport'

interface Transaction {
  id: string
  transactionId: string
  amount: number
  date: string
  name: string
  merchantName: string | null
  category: string[]
  aiCategory: string | null
  aiSubCategory: string | null
  isBusinessExpense: boolean
  pending: boolean
  paymentChannel: string | null
  accountName: string
  accountMask: string | null
  accountType: string
  institutionName: string | null
}

const CATEGORIES = [
  'Groceries',
  'Dining & Restaurants',
  'Transportation',
  'Gas & Fuel',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Healthcare',
  'Insurance',
  'Subscriptions',
  'Travel',
  'Home & Garden',
  'Personal Care',
  'Education',
  'Business Expense',
  'Office Supplies',
  'Professional Services',
  'Bank Fees',
  'Transfer',
  'Income',
  'Refund',
  'Other',
]

export function AllTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // View mode
  const [viewMode, setViewMode] = useState<'transactions' | 'report'>('transactions')

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedType !== 'all') params.set('type', selectedType)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      params.set('limit', limit.toString())
      params.set('offset', offset.toString())

      const response = await fetch(`/api/plaid/all-transactions?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }

      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedCategory, selectedType, startDate, endDate, offset])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Sync transactions from Plaid (auto-categorizes with AI)
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync')
      }

      const message = data.categorized > 0
        ? `Synced ${data.synced} transactions (${data.new} new, ${data.categorized} auto-categorized)`
        : `Synced ${data.synced} transactions (${data.new} new)`
      alert(message)
      setOffset(0)
      fetchTransactions()
    } catch (err: any) {
      alert('Sync failed: ' + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(Math.abs(amount))
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Clear filters
  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSelectedType('all')
    setStartDate('')
    setEndDate('')
    setOffset(0)
  }

  const hasFilters = search || selectedCategory || selectedType !== 'all' || startDate || endDate

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-7 w-7 text-green-600" />
              All Transactions
            </h1>
            <p className="text-gray-500 mt-1">
              View, search, and categorize all your bank transactions
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing & Categorizing...' : 'Sync Transactions'}
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={viewMode === 'transactions' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('transactions')}
        >
          Transactions
        </Button>
        <Button
          variant={viewMode === 'report' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('report')}
        >
          Spending Report
        </Button>
      </div>

      {viewMode === 'report' ? (
        <SpendingReport />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by merchant or description..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setOffset(0)
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Toggle Filters */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'bg-gray-100')}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasFilters && (
                  <span className="ml-2 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    !
                  </span>
                )}
              </Button>

              {/* Clear Filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                {/* Category */}
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value)
                    setOffset(0)
                  }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Type */}
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value as any)
                    setOffset(0)
                  }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </select>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setOffset(0)
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setOffset(0)
                    }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            )}

            {/* Results count */}
            <p className="text-sm text-gray-500">
              {isLoading ? 'Loading...' : `${total.toLocaleString()} transactions found`}
            </p>
          </div>

          {/* Transactions List */}
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchTransactions}>
                Try Again
              </Button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No transactions found</h3>
              <p className="mt-2 text-gray-500">
                {hasFilters
                  ? 'Try adjusting your filters'
                  : 'Sync your bank accounts to see transactions'}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Date
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Description
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Category
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Account
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((txn) => {
                      const isIncome = txn.amount < 0

                      return (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(txn.date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'p-1.5 rounded-full flex-shrink-0',
                                  isIncome ? 'bg-green-100' : 'bg-gray-100'
                                )}
                              >
                                {isIncome ? (
                                  <ArrowDownLeft className="h-3 w-3 text-green-600" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {txn.merchantName || txn.name}
                                </p>
                                {txn.aiSubCategory && (
                                  <p className="text-xs text-gray-500">{txn.aiSubCategory}</p>
                                )}
                              </div>
                              {txn.isBusinessExpense && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  Business
                                </span>
                              )}
                              {txn.pending && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                  Pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {txn.aiCategory ? (
                              <span className="text-sm px-2 py-1 bg-green-50 text-green-700 rounded">
                                {txn.aiCategory}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400 italic">Uncategorized</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <p className="text-gray-900">{txn.accountName}</p>
                              <p className="text-xs text-gray-500">
                                {txn.institutionName} {txn.accountMask && `•••• ${txn.accountMask}`}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={cn(
                                'text-sm font-medium',
                                isIncome ? 'text-green-600' : 'text-gray-900'
                              )}
                            >
                              {isIncome ? '+' : '-'}
                              {formatCurrency(txn.amount)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
