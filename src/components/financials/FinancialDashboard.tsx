'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  CreditCard,
  Receipt,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Bell,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  ChevronRight,
  Repeat,
  Target,
  BarChart3,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlaidLinkButton } from './PlaidLinkButton'
import { ConnectedBanks } from './ConnectedBanks'

interface Stats {
  bankCount: number
  accountCount: number
  transactionCount: number
  uncategorizedCount: number
}

interface Insight {
  type: 'warning' | 'tip' | 'alert' | 'success'
  title: string
  description: string
  action?: string
  priority: number
}

interface Bill {
  name: string
  amount: number
  dueDate: string
  isOverdue: boolean
  daysUntilDue: number
}

interface SubscriptionSummary {
  total: number
  monthlyTotal: number
  potentialSavings: number
}

export function FinancialDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState<Stats>({
    bankCount: 0,
    accountCount: 0,
    transactionCount: 0,
    uncategorizedCount: 0,
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [bills, setBills] = useState<{ bills: Bill[]; summary: any }>({ bills: [], summary: {} })
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary | null>(null)
  const [isLoadingInsights, setIsLoadingInsights] = useState(true)
  const [financialSummary, setFinancialSummary] = useState<{
    totalIncome: number
    totalExpenses: number
    netCashflow: number
  } | null>(null)

  const handleBankConnected = () => {
    setRefreshKey((prev) => prev + 1)
    fetchAllData()
  }

  const fetchStats = async () => {
    try {
      const banksRes = await fetch('/api/plaid/accounts')
      const banksData = await banksRes.json()
      const banks = banksData.banks || []

      const txnRes = await fetch('/api/plaid/all-transactions?limit=1')
      const txnData = await txnRes.json()

      setStats({
        bankCount: banks.length,
        accountCount: banks.reduce((sum: number, b: any) => sum + (b.accounts?.length || 0), 0),
        transactionCount: txnData.total || 0,
        uncategorizedCount: 0,
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const fetchInsights = async () => {
    try {
      const res = await fetch('/api/plaid/insights')
      const data = await res.json()
      setInsights(data.insights || [])
      setFinancialSummary(data.summary || null)
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    }
  }

  const fetchBills = async () => {
    try {
      const res = await fetch('/api/plaid/bills')
      const data = await res.json()
      setBills(data)
    } catch (err) {
      console.error('Failed to fetch bills:', err)
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/plaid/subscriptions')
      const data = await res.json()
      setSubscriptions(data.summary || null)
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err)
    }
  }

  const fetchAllData = async () => {
    setIsLoadingInsights(true)
    await Promise.all([
      fetchStats(),
      fetchInsights(),
      fetchBills(),
      fetchSubscriptions(),
    ])
    setIsLoadingInsights(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [refreshKey])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 90 }),
      })
      await fetchAllData()
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'tip':
      default:
        return <Lightbulb className="h-5 w-5 text-blue-500" />
    }
  }

  const getInsightBg = (type: string) => {
    switch (type) {
      case 'alert':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-amber-50 border-amber-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'tip':
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  // Count urgent items
  const overdueBills = bills.bills?.filter((b) => b.isOverdue) || []
  const dueSoonBills = bills.bills?.filter((b) => !b.isOverdue && b.daysUntilDue <= 7) || []
  const urgentInsights = insights.filter((i) => i.priority <= 2)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-green-600" />
              Financial Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Your money at a glance - stay on top of bills and spending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <PlaidLinkButton onSuccess={handleBankConnected} />
          </div>
        </div>
      </div>

      {/* Urgent Alerts Banner */}
      {(overdueBills.length > 0 || urgentInsights.length > 0) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Needs Your Attention</h3>
              <ul className="mt-2 space-y-1">
                {overdueBills.length > 0 && (
                  <li className="text-red-700 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    {overdueBills.length} overdue bill{overdueBills.length > 1 ? 's' : ''} totaling{' '}
                    {formatCurrency(overdueBills.reduce((sum, b) => sum + b.amount, 0))}
                  </li>
                )}
                {urgentInsights.map((insight, i) => (
                  <li key={i} className="text-red-700 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    {insight.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Monthly Cashflow */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                financialSummary && financialSummary.netCashflow >= 0
                  ? 'bg-green-100'
                  : 'bg-red-100'
              )}
            >
              {financialSummary && financialSummary.netCashflow >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p
                className={cn(
                  'text-xl font-bold',
                  financialSummary && financialSummary.netCashflow >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {financialSummary
                  ? `${financialSummary.netCashflow >= 0 ? '+' : ''}${formatCurrency(financialSummary.netCashflow)}`
                  : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Bills Due Soon */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                dueSoonBills.length > 0 ? 'bg-amber-100' : 'bg-gray-100'
              )}
            >
              <Calendar
                className={cn(
                  'h-5 w-5',
                  dueSoonBills.length > 0 ? 'text-amber-600' : 'text-gray-600'
                )}
              />
            </div>
            <div>
              <p className="text-sm text-gray-500">Due This Week</p>
              <p className="text-xl font-bold text-gray-900">
                {dueSoonBills.length} bills
              </p>
              {dueSoonBills.length > 0 && (
                <p className="text-xs text-amber-600">
                  {formatCurrency(dueSoonBills.reduce((sum, b) => sum + b.amount, 0))}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Repeat className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Subscriptions</p>
              <p className="text-xl font-bold text-gray-900">
                {subscriptions ? `${subscriptions.total} active` : '--'}
              </p>
              {subscriptions && subscriptions.potentialSavings > 0 && (
                <p className="text-xs text-green-600">
                  Save up to {formatCurrency(subscriptions.potentialSavings)}/yr
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.transactionCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Link
          href="/financials/bills"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white hover:from-blue-600 hover:to-blue-700 transition-all group col-span-2 md:col-span-1"
        >
          <Calendar className="h-5 w-5" />
          <span className="font-medium">Bills Calendar</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Link>

        <Link
          href="/financials/transactions"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group"
        >
          <Receipt className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
          <span className="font-medium text-gray-700 group-hover:text-green-700">
            Transactions
          </span>
          <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-green-600" />
        </Link>

        <Link
          href="/financials/reports"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group"
        >
          <BarChart3 className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
          <span className="font-medium text-gray-700 group-hover:text-green-700">
            Reports
          </span>
          <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-green-600" />
        </Link>

        <Link
          href="/financials/subscriptions"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
        >
          <Repeat className="h-5 w-5 text-gray-400 group-hover:text-purple-600" />
          <span className="font-medium text-gray-700 group-hover:text-purple-700">
            Subscriptions
          </span>
          <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-purple-600" />
        </Link>

        <Link
          href="/financials/debt"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all group"
        >
          <Target className="h-5 w-5 text-gray-400 group-hover:text-amber-600" />
          <span className="font-medium text-gray-700 group-hover:text-amber-700">
            Debt Plan
          </span>
          <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-amber-600" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Insights & Bills */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Insights */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Smart Insights</h2>
              </div>
              {isLoadingInsights && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
            <div className="p-4">
              {insights.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Info className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Sync your transactions to get personalized insights</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.slice(0, 4).map((insight, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-lg border',
                        getInsightBg(insight.type)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{insight.title}</p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {insight.description}
                          </p>
                          {insight.action && (
                            <p className="text-sm font-medium text-gray-700 mt-1">
                              → {insight.action}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Bills */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Bills</h2>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {bills.bills?.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No upcoming bills detected yet</p>
                </div>
              ) : (
                bills.bills?.slice(0, 5).map((bill, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center justify-between p-4',
                      bill.isOverdue && 'bg-red-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          bill.isOverdue
                            ? 'bg-red-100'
                            : bill.daysUntilDue <= 3
                              ? 'bg-amber-100'
                              : 'bg-gray-100'
                        )}
                      >
                        <Clock
                          className={cn(
                            'h-4 w-4',
                            bill.isOverdue
                              ? 'text-red-600'
                              : bill.daysUntilDue <= 3
                                ? 'text-amber-600'
                                : 'text-gray-600'
                          )}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{bill.name}</p>
                        <p
                          className={cn(
                            'text-sm',
                            bill.isOverdue
                              ? 'text-red-600 font-medium'
                              : bill.daysUntilDue <= 3
                                ? 'text-amber-600'
                                : 'text-gray-500'
                          )}
                        >
                          {bill.isOverdue
                            ? `${Math.abs(bill.daysUntilDue)} days overdue`
                            : bill.daysUntilDue === 0
                              ? 'Due today'
                              : bill.daysUntilDue === 1
                                ? 'Due tomorrow'
                                : `Due in ${bill.daysUntilDue} days`}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(bill.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Connected Banks */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Connected Accounts
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Click an account to see transactions
              </p>
            </div>
            <ConnectedBanks key={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  )
}
