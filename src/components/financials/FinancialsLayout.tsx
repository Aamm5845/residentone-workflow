'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Wallet,
  Calendar,
  Receipt,
  Target,
  BarChart3,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
  Landmark,
  PiggyBank,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BankAccount {
  id: string
  name: string
  type: string
  subtype: string
  mask: string
  currentBalance: number
  availableBalance: number
  institutionName: string
}

interface AccountsSummary {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  banks: {
    institutionName: string
    accounts: BankAccount[]
  }[]
}

const NAV_ITEMS = [
  {
    href: '/financials/accounts',
    label: 'Accounts',
    icon: Wallet,
    description: 'Bank accounts & balances',
  },
  {
    href: '/financials',
    label: 'Monthly Bills',
    icon: Receipt,
    description: 'Recurring payments',
    exact: true,
  },
  {
    href: '/financials/bills',
    label: 'Calendar',
    icon: Calendar,
    description: 'Payment schedule',
  },
  {
    href: '/financials/debt',
    label: 'Debt Payoff',
    icon: Target,
    description: 'Payoff strategy',
  },
  {
    href: '/financials/reports',
    label: 'Reports',
    icon: BarChart3,
    description: 'Spending analytics',
  },
]

export function FinancialsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [summary, setSummary] = useState<AccountsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/plaid/accounts')
        if (res.ok) {
          const data = await res.json()
          const banks = data.banks || []

          let totalAssets = 0
          let totalLiabilities = 0

          const groupedBanks = banks.map((bank: any) => {
            const accounts = (bank.accounts || []).map((acc: any) => {
              const balance = Number(acc.currentBalance) || 0
              const available = Number(acc.availableBalance) || 0

              // Credit and loan accounts are liabilities (shown as positive in Plaid)
              if (acc.type === 'credit' || acc.type === 'loan') {
                totalLiabilities += Math.abs(balance)
              } else {
                totalAssets += balance
              }

              return {
                ...acc,
                currentBalance: balance,
                availableBalance: available,
                institutionName: bank.institutionName,
              }
            })

            return {
              institutionName: bank.institutionName,
              accounts,
            }
          })

          setSummary({
            totalAssets,
            totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
            banks: groupedBanks,
          })
        }
      } catch (err) {
        console.error('Failed to fetch accounts:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
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

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div
        className={cn(
          'bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-72'
        )}
      >
        {/* Summary Section */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Overview
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-100 rounded">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-600">You Have</span>
                  </div>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.totalAssets)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-100 rounded">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                    <span className="text-sm text-gray-600">You Owe</span>
                  </div>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.totalLiabilities)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Net Worth</span>
                    <span
                      className={cn(
                        'font-bold',
                        summary.netWorth >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {formatCurrency(summary.netWorth)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Connect banks to see summary</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-blue-600')} />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500 truncate">{item.description}</p>
                      </div>
                    )}
                    {!isCollapsed && isActive && (
                      <ChevronRight className="h-4 w-4 text-blue-400" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Accounts Quick View */}
        {!isCollapsed && summary && summary.banks.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Accounts
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {summary.banks.map((bank, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {bank.institutionName}
                    </span>
                  </div>
                  <div className="space-y-1 ml-5">
                    {bank.accounts.slice(0, 4).map((acc) => {
                      const Icon = getAccountIcon(acc.type)
                      const isDebt = acc.type === 'credit' || acc.type === 'loan'

                      return (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Icon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600 truncate">
                              {acc.name}
                              {acc.mask && <span className="text-gray-400"> •{acc.mask}</span>}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'font-medium flex-shrink-0 ml-2',
                              isDebt ? 'text-red-600' : 'text-gray-900'
                            )}
                          >
                            {isDebt && '-'}
                            {formatCurrency(Math.abs(acc.currentBalance))}
                          </span>
                        </div>
                      )
                    })}
                    {bank.accounts.length > 4 && (
                      <p className="text-xs text-gray-400">
                        +{bank.accounts.length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 border-t border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight
            className={cn(
              'h-5 w-5 mx-auto transition-transform',
              isCollapsed ? '' : 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </div>
    </div>
  )
}
