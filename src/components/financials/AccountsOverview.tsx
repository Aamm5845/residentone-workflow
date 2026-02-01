'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlaidLinkButton } from './PlaidLinkButton'

interface BankAccount {
  id: string
  name: string
  officialName: string
  type: string
  subtype: string
  mask: string
  currentBalance: number
  availableBalance: number
}

interface Bank {
  id: string
  institutionId: string
  institutionName: string
  status: string
  accounts: BankAccount[]
}

export function AccountsOverview() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/plaid/accounts')
      if (res.ok) {
        const data = await res.json()
        setBanks(data.banks || [])
        // Expand all banks by default
        setExpandedBanks(new Set((data.banks || []).map((b: Bank) => b.id)))
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })
      await fetchAccounts()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const toggleBank = (bankId: string) => {
    setExpandedBanks((prev) => {
      const next = new Set(prev)
      if (next.has(bankId)) {
        next.delete(bankId)
      } else {
        next.add(bankId)
      }
      return next
    })
  }

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return CreditCard
      case 'loan':
        return Landmark
      case 'depository':
      default:
        return PiggyBank
    }
  }

  const getAccountTypeLabel = (type: string, subtype: string) => {
    if (subtype) {
      return subtype.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    }
    switch (type) {
      case 'credit':
        return 'Credit Card'
      case 'loan':
        return 'Loan'
      case 'depository':
        return 'Bank Account'
      default:
        return type
    }
  }

  // Calculate totals
  const totals = banks.reduce(
    (acc, bank) => {
      bank.accounts.forEach((account) => {
        const balance = Number(account.currentBalance) || 0
        if (account.type === 'credit' || account.type === 'loan') {
          acc.liabilities += Math.abs(balance)
        } else {
          acc.assets += balance
        }
      })
      return acc
    },
    { assets: 0, liabilities: 0 }
  )

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-3">Loading your accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-blue-600" />
              Accounts
            </h1>
            <p className="text-gray-500 mt-1">
              All your connected bank accounts and balances
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
              Sync
            </Button>
            <PlaidLinkButton onSuccess={fetchAccounts} />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-200" />
            <span className="text-green-100 text-sm font-medium">Total Assets</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totals.assets)}</p>
          <p className="text-green-200 text-sm mt-1">Cash & savings</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-red-200" />
            <span className="text-red-100 text-sm font-medium">Total Owed</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(totals.liabilities)}</p>
          <p className="text-red-200 text-sm mt-1">Credit cards & loans</p>
        </div>

        <div
          className={cn(
            'rounded-xl p-5 text-white',
            totals.assets - totals.liabilities >= 0
              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
              : 'bg-gradient-to-br from-orange-500 to-orange-600'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 opacity-70" />
            <span className="text-sm font-medium opacity-90">Net Worth</span>
          </div>
          <p className="text-3xl font-bold">
            {formatCurrency(totals.assets - totals.liabilities)}
          </p>
          <p className="text-sm mt-1 opacity-80">Assets minus liabilities</p>
        </div>
      </div>

      {/* Banks List */}
      {banks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Banks Connected</h3>
          <p className="text-gray-500 mb-4">
            Connect your bank accounts to see your balances and track spending.
          </p>
          <PlaidLinkButton onSuccess={fetchAccounts} />
        </div>
      ) : (
        <div className="space-y-4">
          {banks.map((bank) => {
            const isExpanded = expandedBanks.has(bank.id)
            const bankAssets = bank.accounts
              .filter((a) => a.type !== 'credit' && a.type !== 'loan')
              .reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0)
            const bankLiabilities = bank.accounts
              .filter((a) => a.type === 'credit' || a.type === 'loan')
              .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance) || 0), 0)

            return (
              <div
                key={bank.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Bank Header */}
                <button
                  onClick={() => toggleBank(bank.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{bank.institutionName}</h3>
                      <p className="text-sm text-gray-500">
                        {bank.accounts.length} account{bank.accounts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {bank.status === 'NEEDS_REAUTH' && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                        <AlertCircle className="h-3 w-3" />
                        Needs reconnect
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      {bankAssets > 0 && (
                        <p className="text-green-600 font-semibold">
                          +{formatCurrency(bankAssets)}
                        </p>
                      )}
                      {bankLiabilities > 0 && (
                        <p className="text-red-600 font-semibold">
                          -{formatCurrency(bankLiabilities)}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Accounts List */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {bank.accounts.map((account) => {
                      const Icon = getAccountIcon(account.type)
                      const isDebt = account.type === 'credit' || account.type === 'loan'
                      const balance = Number(account.currentBalance) || 0
                      const available = Number(account.availableBalance) || 0

                      return (
                        <div
                          key={account.id}
                          className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                isDebt ? 'bg-red-100' : 'bg-green-100'
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-5 w-5',
                                  isDebt ? 'text-red-600' : 'text-green-600'
                                )}
                              />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {account.name}
                                {account.mask && (
                                  <span className="text-gray-400 ml-1">•••• {account.mask}</span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500">
                                {getAccountTypeLabel(account.type, account.subtype)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                'text-lg font-bold',
                                isDebt ? 'text-red-600' : 'text-gray-900'
                              )}
                            >
                              {isDebt && '-'}
                              {formatCurrency(Math.abs(balance))}
                            </p>
                            {!isDebt && available !== balance && available > 0 && (
                              <p className="text-sm text-gray-500">
                                {formatCurrency(available)} available
                              </p>
                            )}
                            {isDebt && account.type === 'credit' && (
                              <p className="text-sm text-gray-500">Balance owed</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
