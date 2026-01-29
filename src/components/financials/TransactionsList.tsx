'use client'

import { useState, useEffect } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Receipt,
  Filter,
  Search,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string
  accountId: string
  accountName: string
  accountMask: string | null
  institutionName: string | null
  amount: number
  date: string
  name: string
  merchantName: string | null
  category: string[]
  pending: boolean
  paymentChannel: string | null
  isoCurrencyCode: string
}

export function TransactionsList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  // Fetch transactions
  const fetchTransactions = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/plaid/transactions?days=${days}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }

      setTransactions(data.transactions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [days])

  // Filter transactions
  useEffect(() => {
    let filtered = [...transactions]

    // Filter by type (income/expense)
    if (filterType === 'income') {
      filtered = filtered.filter((t) => t.amount < 0) // Negative = money in (Plaid convention)
    } else if (filterType === 'expense') {
      filtered = filtered.filter((t) => t.amount > 0) // Positive = money out
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.merchantName?.toLowerCase().includes(query) ||
          t.category?.some((c) => c.toLowerCase().includes(query))
      )
    }

    setFilteredTransactions(filtered)
  }, [transactions, filterType, searchQuery])

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    // Plaid uses positive for debits (money out) and negative for credits (money in)
    const displayAmount = Math.abs(amount)
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
    }).format(displayAmount)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get category display
  const getCategoryDisplay = (categories: string[]) => {
    if (!categories || categories.length === 0) return 'Uncategorized'
    return categories[categories.length - 1] // Most specific category
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Loading transactions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchTransactions}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Date range */}
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          {/* Type filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                'px-3 py-2 text-sm',
                filterType === 'all' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={cn(
                'px-3 py-2 text-sm border-l border-gray-200',
                filterType === 'income' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={cn(
                'px-3 py-2 text-sm border-l border-gray-200',
                filterType === 'expense' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              Expenses
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </p>
      </div>

      {/* Transactions list */}
      {filteredTransactions.length === 0 ? (
        <div className="p-8 text-center">
          <Receipt className="h-12 w-12 mx-auto text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No transactions found</h3>
          <p className="mt-2 text-gray-500">
            {transactions.length === 0
              ? 'Connect a bank account to see transactions'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredTransactions.map((transaction) => {
            const isIncome = transaction.amount < 0 // Plaid: negative = money in

            return (
              <div
                key={transaction.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Icon + Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'p-2 rounded-full flex-shrink-0',
                        isIncome ? 'bg-green-100' : 'bg-red-100'
                      )}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {transaction.merchantName || transaction.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{transaction.accountName}</span>
                        {transaction.accountMask && (
                          <span>•••• {transaction.accountMask}</span>
                        )}
                        <span>•</span>
                        <span>{getCategoryDisplay(transaction.category)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount + Date */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className={cn(
                        'font-semibold',
                        isIncome ? 'text-green-600' : 'text-gray-900'
                      )}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(transaction.amount, transaction.isoCurrencyCode)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(transaction.date)}
                      {transaction.pending && (
                        <span className="ml-1 text-amber-600">(Pending)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
