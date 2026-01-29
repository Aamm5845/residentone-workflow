'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  RefreshCw,
  Trash2,
  Loader2,
  CreditCard,
  Wallet,
  ChevronDown,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string
  amount: number
  date: string
  name: string
  merchantName: string | null
  category: string[]
  pending: boolean
  isoCurrencyCode: string
}

interface BankAccount {
  id: string
  name: string
  officialName: string | null
  type: string
  subtype: string | null
  mask: string | null
  currentBalance: number | null
  availableBalance: number | null
  currency: string
  lastUpdated: string | null
  accountId: string
}

interface ConnectedBank {
  id: string
  institutionName: string
  institutionId: string | null
  status: string
  lastSynced: string | null
  accounts: BankAccount[]
}

// Bank logo mappings for common Canadian banks
const BANK_LOGOS: Record<string, string> = {
  'td': 'https://logo.clearbit.com/td.com',
  'td bank': 'https://logo.clearbit.com/td.com',
  'td canada trust': 'https://logo.clearbit.com/td.com',
  'rbc': 'https://logo.clearbit.com/rbc.com',
  'royal bank': 'https://logo.clearbit.com/rbc.com',
  'royal bank of canada': 'https://logo.clearbit.com/rbc.com',
  'bmo': 'https://logo.clearbit.com/bmo.com',
  'bank of montreal': 'https://logo.clearbit.com/bmo.com',
  'scotiabank': 'https://logo.clearbit.com/scotiabank.com',
  'bank of nova scotia': 'https://logo.clearbit.com/scotiabank.com',
  'cibc': 'https://logo.clearbit.com/cibc.com',
  'national bank': 'https://logo.clearbit.com/nbc.ca',
  'desjardins': 'https://logo.clearbit.com/desjardins.com',
  'tangerine': 'https://logo.clearbit.com/tangerine.ca',
  'simplii': 'https://logo.clearbit.com/simplii.com',
  'eq bank': 'https://logo.clearbit.com/eqbank.ca',
  'chase': 'https://logo.clearbit.com/chase.com',
  'bank of america': 'https://logo.clearbit.com/bankofamerica.com',
  'wells fargo': 'https://logo.clearbit.com/wellsfargo.com',
  'capital one': 'https://logo.clearbit.com/capitalone.com',
}

function getBankLogo(institutionName: string | null): string | null {
  if (!institutionName) return null
  const normalized = institutionName.toLowerCase()

  for (const [key, url] of Object.entries(BANK_LOGOS)) {
    if (normalized.includes(key)) {
      return url
    }
  }
  return null
}

export function ConnectedBanks() {
  const [banks, setBanks] = useState<ConnectedBank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [accountTransactions, setAccountTransactions] = useState<Record<string, Transaction[]>>({})
  const [loadingTransactions, setLoadingTransactions] = useState<Set<string>>(new Set())

  // Fetch connected banks
  const fetchBanks = async () => {
    try {
      const response = await fetch('/api/plaid/accounts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts')
      }

      setBanks(data.banks || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBanks()
  }, [])

  // Fetch transactions for a specific account
  const fetchAccountTransactions = async (accountId: string) => {
    setLoadingTransactions((prev) => new Set(prev).add(accountId))

    try {
      const response = await fetch(`/api/plaid/transactions?days=30&accountId=${accountId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }

      // Filter transactions for this specific account
      const filtered = (data.transactions || []).filter(
        (t: any) => t.accountId === accountId
      )

      setAccountTransactions((prev) => ({
        ...prev,
        [accountId]: filtered,
      }))
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err)
    } finally {
      setLoadingTransactions((prev) => {
        const next = new Set(prev)
        next.delete(accountId)
        return next
      })
    }
  }

  // Toggle account expansion
  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
        // Fetch transactions if not already loaded
        if (!accountTransactions[accountId]) {
          fetchAccountTransactions(accountId)
        }
      }
      return next
    })
  }

  // Refresh balances
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/plaid/accounts', { method: 'POST' })
      await fetchBanks()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Disconnect bank
  const handleDisconnect = async (plaidItemId: string) => {
    if (!confirm('Are you sure you want to disconnect this bank account? This action cannot be undone.')) {
      return
    }

    setDisconnectingId(plaidItemId)
    try {
      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plaidItemId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect bank')
      }

      // Remove from list
      setBanks((prev) => prev.filter((b) => b.id !== plaidItemId))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDisconnectingId(null)
    }
  }

  // Format currency
  const formatCurrency = (amount: number | null, currency: string = 'CAD') => {
    if (amount === null) return '--'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    })
  }

  // Get icon for account type
  const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'credit':
        return <CreditCard className="h-4 w-4" />
      case 'depository':
      default:
        return <Wallet className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Loading connected banks...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <Button variant="outline" className="mt-4" onClick={fetchBanks}>
          Try Again
        </Button>
      </div>
    )
  }

  if (banks.length === 0) {
    return (
      <div className="p-8 text-center">
        <Building2 className="h-12 w-12 mx-auto text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No banks connected</h3>
        <p className="mt-2 text-gray-500">
          Connect your bank account to start tracking payments automatically.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Refresh button */}
      <div className="p-4 border-b border-gray-100 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Balances
        </Button>
      </div>

      {/* Banks list */}
      <div className="divide-y divide-gray-100">
        {banks.map((bank) => {
          const logoUrl = getBankLogo(bank.institutionName)

          return (
            <div key={bank.id} className="p-4">
              {/* Bank header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={bank.institutionName || 'Bank'}
                      className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200 p-1"
                      onError={(e) => {
                        // Fallback to icon if logo fails to load
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div className={cn("p-2 bg-gray-100 rounded-lg", logoUrl && "hidden")}>
                    <Building2 className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{bank.institutionName}</h3>
                    <p className="text-xs text-gray-500">
                      Last synced: {bank.lastSynced
                        ? new Date(bank.lastSynced).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisconnect(bank.id)}
                  disabled={disconnectingId === bank.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {disconnectingId === bank.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Accounts */}
              <div className="ml-2 space-y-2">
                {bank.accounts.map((account) => {
                  const isExpanded = expandedAccounts.has(account.accountId)
                  const transactions = accountTransactions[account.accountId] || []
                  const isLoadingTxns = loadingTransactions.has(account.accountId)

                  return (
                    <div key={account.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Account header - clickable */}
                      <button
                        onClick={() => toggleAccount(account.accountId)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <div className="text-gray-400">
                            {getAccountIcon(account.type)}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900">
                              {account.name}
                              {account.mask && (
                                <span className="text-gray-400 ml-1">•••• {account.mask}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {account.subtype || account.type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(account.currentBalance, account.currency)}
                          </p>
                          {account.availableBalance !== null &&
                           account.availableBalance !== account.currentBalance && (
                            <p className="text-xs text-gray-500">
                              Available: {formatCurrency(account.availableBalance, account.currency)}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Transactions - expanded */}
                      {isExpanded && (
                        <div className="border-t border-gray-200">
                          {isLoadingTxns ? (
                            <div className="p-4 text-center">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                              <p className="text-sm text-gray-500 mt-1">Loading transactions...</p>
                            </div>
                          ) : transactions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              No recent transactions
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                              {transactions.slice(0, 20).map((txn) => {
                                const isIncome = txn.amount < 0

                                return (
                                  <div
                                    key={txn.id}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={cn(
                                          'p-1.5 rounded-full',
                                          isIncome ? 'bg-green-100' : 'bg-gray-100'
                                        )}
                                      >
                                        {isIncome ? (
                                          <ArrowDownLeft className="h-3 w-3 text-green-600" />
                                        ) : (
                                          <ArrowUpRight className="h-3 w-3 text-gray-600" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {txn.merchantName || txn.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {txn.category?.[txn.category.length - 1] || 'Uncategorized'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p
                                        className={cn(
                                          'text-sm font-medium',
                                          isIncome ? 'text-green-600' : 'text-gray-900'
                                        )}
                                      >
                                        {isIncome ? '+' : '-'}
                                        {formatCurrency(Math.abs(txn.amount), txn.isoCurrencyCode)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatDate(txn.date)}
                                        {txn.pending && (
                                          <span className="ml-1 text-amber-600">(Pending)</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                              {transactions.length > 20 && (
                                <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
                                  Showing 20 of {transactions.length} transactions
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
          )
        })}
      </div>
    </div>
  )
}
