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
  Flame,
  Sparkles,
  Eye,
  EyeOff,
  ShoppingBag,
  Utensils,
  Car,
  Zap,
  Film,
  Heart,
  Home,
  Briefcase,
  Coffee,
  Gift,
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

// Category icons mapping for quick visual scanning
const CATEGORY_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  'Groceries': { icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-100' },
  'Dining & Restaurants': { icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-100' },
  'Transportation': { icon: Car, color: 'text-blue-600', bg: 'bg-blue-100' },
  'Gas & Fuel': { icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  'Entertainment': { icon: Film, color: 'text-purple-600', bg: 'bg-purple-100' },
  'Healthcare': { icon: Heart, color: 'text-red-600', bg: 'bg-red-100' },
  'Home & Garden': { icon: Home, color: 'text-teal-600', bg: 'bg-teal-100' },
  'Business Expense': { icon: Briefcase, color: 'text-slate-600', bg: 'bg-slate-100' },
  'Shopping': { icon: Gift, color: 'text-pink-600', bg: 'bg-pink-100' },
  'Subscriptions': { icon: Repeat, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  'Other': { icon: Coffee, color: 'text-gray-600', bg: 'bg-gray-100' },
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

  // ADHD-friendly features
  const [focusMode, setFocusMode] = useState(false)
  const [weeklySpending, setWeeklySpending] = useState<{
    spent: number
    budget: number
    daysLeft: number
    dailyAverage: number
  } | null>(null)
  const [topCategories, setTopCategories] = useState<{
    category: string
    amount: number
    percentage: number
  }[]>([])
  const [streak, setStreak] = useState(0) // Days on budget

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

  // Calculate weekly spending for ADHD-friendly weekly view
  const fetchWeeklyData = async () => {
    try {
      // Get this week's transactions (Sunday to today)
      const today = new Date()
      const dayOfWeek = today.getDay()

      const res = await fetch(`/api/plaid/spending-report?period=week`)
      const data = await res.json()

      if (data.summary?.totalExpenses !== undefined) {
        // Calculate weekly budget (assume monthly budget / 4)
        const monthlyBudget = 2000 // Default, could be user-configurable
        const weeklyBudget = monthlyBudget / 4
        const daysLeft = 7 - dayOfWeek
        const daysElapsed = dayOfWeek === 0 ? 7 : dayOfWeek
        const dailyAverage = daysElapsed > 0 ? data.summary.totalExpenses / daysElapsed : 0

        setWeeklySpending({
          spent: data.summary.totalExpenses || 0,
          budget: weeklyBudget,
          daysLeft,
          dailyAverage
        })

        // Calculate streak (simplified - days this week under daily budget)
        const dailyBudget = weeklyBudget / 7
        if (dailyAverage <= dailyBudget) {
          setStreak(prev => Math.min(prev + 1, daysElapsed || 1))
        }

        // Set top categories from byCategory array
        if (data.byCategory && Array.isArray(data.byCategory)) {
          const categories = data.byCategory
            .slice(0, 5)
            .map((cat: { category: string; amount: number; percentage: number }) => ({
              category: cat.category,
              amount: cat.amount,
              percentage: cat.percentage
            }))
          setTopCategories(categories)
        }
      }
    } catch (err) {
      console.error('Failed to fetch weekly data:', err)
    }
  }

  const fetchAllData = async () => {
    setIsLoadingInsights(true)
    await Promise.all([
      fetchStats(),
      fetchInsights(),
      fetchBills(),
      fetchSubscriptions(),
      fetchWeeklyData(),
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

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '$0'
    const num = Number(amount)
    if (isNaN(num)) return '$0'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
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

  // Helper to safely get numeric value
  const safeNum = (val: number | null | undefined): number => {
    if (val === null || val === undefined) return 0
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }

  // Calculate Safe to Spend (income - bills - spent this month)
  const safeToSpend = financialSummary
    ? Math.max(0, safeNum(financialSummary.totalIncome) - safeNum(bills.summary?.upcomingAmount) - safeNum(subscriptions?.monthlyTotal) - safeNum(weeklySpending?.spent))
    : null

  // Weekly spending percentage for progress ring
  const weeklySpendingPercent = weeklySpending
    ? Math.min(100, (weeklySpending.spent / weeklySpending.budget) * 100)
    : 0

  // Get spending status color
  const getSpendingStatus = (percent: number) => {
    if (percent < 70) return { color: 'text-green-600', bg: 'bg-green-500', status: 'On Track' }
    if (percent < 90) return { color: 'text-amber-600', bg: 'bg-amber-500', status: 'Caution' }
    return { color: 'text-red-600', bg: 'bg-red-500', status: 'Over Budget' }
  }

  const spendingStatus = getSpendingStatus(weeklySpendingPercent)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Focus Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-green-600" />
              Financial Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              {focusMode ? 'Focus on what matters right now' : 'Your money at a glance'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Focus Mode Toggle */}
            <Button
              variant={focusMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFocusMode(!focusMode)}
              className={focusMode ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {focusMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {focusMode ? 'Focus Mode' : 'Full View'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            {!focusMode && <PlaidLinkButton onSuccess={handleBankConnected} />}
          </div>
        </div>
      </div>

      {/* ADHD-Friendly: Safe to Spend Hero Card */}
      <div className="mb-6 bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Safe to Spend</p>
            <p className="text-5xl font-bold mt-2">
              {safeToSpend !== null ? formatCurrency(safeToSpend) : '--'}
            </p>
            <p className="text-green-200 mt-2 text-sm">
              After bills and subscriptions this month
            </p>
          </div>
          <div className="text-right">
            {/* Weekly Progress Ring */}
            <div className="relative w-28 h-28">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke={weeklySpendingPercent < 70 ? '#4ade80' : weeklySpendingPercent < 90 ? '#fbbf24' : '#ef4444'}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(weeklySpendingPercent / 100) * 301.6} 301.6`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{Math.round(weeklySpendingPercent)}%</span>
                <span className="text-xs text-green-200">Weekly</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Spending Bar */}
        {weeklySpending && (
          <div className="mt-4 pt-4 border-t border-green-400/30">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-green-100">This Week&apos;s Spending</span>
              <span className="font-semibold">
                {formatCurrency(weeklySpending.spent)} / {formatCurrency(weeklySpending.budget)}
              </span>
            </div>
            <div className="h-3 bg-green-800/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  weeklySpendingPercent < 70 ? 'bg-green-300' : weeklySpendingPercent < 90 ? 'bg-amber-400' : 'bg-red-400'
                )}
                style={{ width: `${Math.min(100, weeklySpendingPercent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-green-200">
              <span>{weeklySpending.daysLeft} days left this week</span>
              <span>Avg: {formatCurrency(weeklySpending.dailyAverage)}/day</span>
            </div>
          </div>
        )}

        {/* Streak Badge */}
        {streak > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-500/20 text-amber-200 px-3 py-1 rounded-full text-sm">
              <Flame className="h-4 w-4" />
              <span>{streak} day{streak > 1 ? 's' : ''} on budget!</span>
            </div>
          </div>
        )}
      </div>

      {/* Urgent Alerts Banner - Enhanced with countdown */}
      {(overdueBills.length > 0 || urgentInsights.length > 0) && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl animate-pulse-slow">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500 rounded-full">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-800 text-lg">Action Required Now</h3>
              <div className="mt-3 space-y-2">
                {overdueBills.map((bill, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Clock className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{bill.name}</p>
                        <p className="text-red-600 text-sm font-medium">
                          {Math.abs(bill.daysUntilDue)} days overdue!
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-red-600">{formatCurrency(bill.amount)}</p>
                      <Link href="/financials/bills" className="text-sm text-red-700 hover:underline">
                        Pay now →
                      </Link>
                    </div>
                  </div>
                ))}
                {urgentInsights.map((insight, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white p-3 rounded-lg border border-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700 font-medium">{insight.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bills Due Soon - Always visible countdown */}
      {dueSoonBills.length > 0 && !focusMode && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Coming Up This Week</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dueSoonBills.slice(0, 3).map((bill, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{bill.name}</span>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full font-semibold',
                    bill.daysUntilDue === 0 ? 'bg-red-100 text-red-700' :
                    bill.daysUntilDue <= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {bill.daysUntilDue === 0 ? 'TODAY' :
                     bill.daysUntilDue === 1 ? 'TOMORROW' :
                     `${bill.daysUntilDue} days`}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(bill.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Spending Categories - Visual Quick View */}
      {!focusMode && topCategories.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              Where Your Money Goes (This Week)
            </h3>
            <Link href="/financials/reports" className="text-sm text-green-600 hover:underline">
              See details →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {topCategories.map((cat, i) => {
              const iconData = CATEGORY_ICONS[cat.category] || CATEGORY_ICONS['Other']
              const IconComponent = iconData.icon
              return (
                <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className={cn('p-3 rounded-full mb-2', iconData.bg)}>
                    <IconComponent className={cn('h-6 w-6', iconData.color)} />
                  </div>
                  <span className="text-xs text-gray-500 text-center">{cat.category}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(cat.amount)}</span>
                  <div className="w-full h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', iconData.bg.replace('100', '500'))}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Summary Cards */}
      {!focusMode && (
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
      )}

      {/* Quick Actions Grid - Simplified in Focus Mode */}
      <div className={cn(
        "grid gap-3 mb-6",
        focusMode ? "grid-cols-2" : "grid-cols-2 md:grid-cols-5"
      )}>
        <Link
          href="/financials/bills"
          className={cn(
            "flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all group shadow-md",
            focusMode && "col-span-1"
          )}
        >
          <Calendar className="h-6 w-6" />
          <div className="flex-1">
            <span className="font-semibold">Bills</span>
            {dueSoonBills.length > 0 && (
              <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                {dueSoonBills.length} due
              </span>
            )}
          </div>
          <ChevronRight className="h-5 w-5" />
        </Link>

        <Link
          href="/financials/debt"
          className={cn(
            "flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white hover:from-amber-600 hover:to-orange-700 transition-all group shadow-md",
            focusMode && "col-span-1"
          )}
        >
          <Target className="h-6 w-6" />
          <span className="font-semibold">Debt Plan</span>
          <ChevronRight className="h-5 w-5 ml-auto" />
        </Link>

        {!focusMode && (
          <>
            <Link
              href="/financials/transactions"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group shadow-sm"
            >
              <Receipt className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
              <span className="font-medium text-gray-700 group-hover:text-green-700">
                Transactions
              </span>
              <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-green-600" />
            </Link>

            <Link
              href="/financials/reports"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group shadow-sm"
            >
              <BarChart3 className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
              <span className="font-medium text-gray-700 group-hover:text-green-700">
                Reports
              </span>
              <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-green-600" />
            </Link>

            <Link
              href="/financials/subscriptions"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group shadow-sm"
            >
              <Repeat className="h-5 w-5 text-gray-400 group-hover:text-purple-600" />
              <span className="font-medium text-gray-700 group-hover:text-purple-700">
                Subscriptions
              </span>
              <ChevronRight className="h-4 w-4 ml-auto text-gray-400 group-hover:text-purple-600" />
            </Link>
          </>
        )}
      </div>

      {/* Focus Mode: Simple One-Action Card */}
      {focusMode && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Your One Thing to Do Today
          </h3>
          {overdueBills.length > 0 ? (
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <p className="font-semibold text-red-800">Pay overdue bill: {overdueBills[0].name}</p>
                <p className="text-red-600">{Math.abs(overdueBills[0].daysUntilDue)} days late</p>
              </div>
              <Link href="/financials/bills">
                <Button className="bg-red-600 hover:bg-red-700">
                  Pay {formatCurrency(overdueBills[0].amount)}
                </Button>
              </Link>
            </div>
          ) : dueSoonBills.length > 0 ? (
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <p className="font-semibold text-amber-800">Bill due soon: {dueSoonBills[0].name}</p>
                <p className="text-amber-600">
                  {dueSoonBills[0].daysUntilDue === 0 ? 'Due today!' :
                   dueSoonBills[0].daysUntilDue === 1 ? 'Due tomorrow' :
                   `Due in ${dueSoonBills[0].daysUntilDue} days`}
                </p>
              </div>
              <Link href="/financials/bills">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  Pay {formatCurrency(dueSoonBills[0].amount)}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-semibold text-green-800">You&apos;re all caught up!</p>
                  <p className="text-green-600">No urgent bills to pay</p>
                </div>
              </div>
              <Sparkles className="h-8 w-8 text-green-400" />
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid - Hidden in Focus Mode */}
      {!focusMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Insights & Bills */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Insights */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                  </div>
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
                          'p-4 rounded-xl border-2 transition-all hover:shadow-md',
                          getInsightBg(insight.type)
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{insight.title}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {insight.description}
                            </p>
                            {insight.action && (
                              <p className="text-sm font-medium text-gray-800 mt-2 flex items-center gap-1">
                                <ArrowRight className="h-4 w-4" />
                                {insight.action}
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

            {/* Upcoming Bills - Enhanced */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Bills</h2>
                </div>
                <Link href="/financials/bills" className="text-sm text-blue-600 hover:underline">
                  View all →
                </Link>
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
                        'flex items-center justify-between p-4 hover:bg-gray-50 transition-colors',
                        bill.isOverdue && 'bg-red-50 hover:bg-red-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            bill.isOverdue
                              ? 'bg-red-200'
                              : bill.daysUntilDue <= 3
                                ? 'bg-amber-200'
                                : 'bg-gray-100'
                          )}
                        >
                          <Clock
                            className={cn(
                              'h-5 w-5',
                              bill.isOverdue
                                ? 'text-red-700'
                                : bill.daysUntilDue <= 3
                                  ? 'text-amber-700'
                                  : 'text-gray-600'
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{bill.name}</p>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              bill.isOverdue
                                ? 'text-red-600'
                                : bill.daysUntilDue <= 3
                                  ? 'text-amber-600'
                                  : 'text-gray-500'
                            )}
                          >
                            {bill.isOverdue
                              ? `${Math.abs(bill.daysUntilDue)} days overdue!`
                              : bill.daysUntilDue === 0
                                ? 'Due today!'
                                : bill.daysUntilDue === 1
                                  ? 'Due tomorrow'
                                  : `Due in ${bill.daysUntilDue} days`}
                          </p>
                        </div>
                      </div>
                      <p className={cn(
                        "text-lg font-bold",
                        bill.isOverdue ? "text-red-600" : "text-gray-900"
                      )}>
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Wallet className="h-5 w-5 text-green-600" />
                  </div>
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
      )}

      {/* Focus Mode Footer */}
      {focusMode && (
        <div className="text-center text-gray-500 text-sm">
          <p>Focus Mode: Showing only essential information</p>
          <button
            onClick={() => setFocusMode(false)}
            className="text-green-600 hover:underline mt-1"
          >
            Show full dashboard
          </button>
        </div>
      )}
    </div>
  )
}
