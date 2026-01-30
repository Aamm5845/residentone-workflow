'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Loader2,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Bell,
  Flame,
  ExternalLink,
  Sparkles,
  Target,
  CreditCard,
  Landmark,
  Receipt,
} from 'lucide-react'

// Payment portal links for Canadian banks and services
const BANK_PAYMENT_LINKS: Record<string, string> = {
  // Banks - Credit Cards & LOC payments
  'td': 'https://easyweb.td.com',
  'td bank': 'https://easyweb.td.com',
  'td canada': 'https://easyweb.td.com',
  'bmo': 'https://www.bmo.com/onlinebanking',
  'bank of montreal': 'https://www.bmo.com/onlinebanking',
  'rbc': 'https://www.rbcroyalbank.com/ways-to-bank/online-banking/',
  'royal bank': 'https://www.rbcroyalbank.com/ways-to-bank/online-banking/',
  'scotiabank': 'https://www.scotiabank.com/ca/en/personal/scotia-online.html',
  'scotia': 'https://www.scotiabank.com/ca/en/personal/scotia-online.html',
  'cibc': 'https://www.cibc.com/en/personal-banking/ways-to-bank/online-banking.html',
  'national bank': 'https://www.nbc.ca/personal/accounts/online-banking.html',
  'nbc': 'https://www.nbc.ca/personal/accounts/online-banking.html',
  'desjardins': 'https://www.desjardins.com/ca/personal/accounts-services/ways-to-bank/online-banking/',
  'tangerine': 'https://www.tangerine.ca/en/ways-to-bank/online-banking',
  'simplii': 'https://www.simplii.com/en/ways-to-bank/online-banking.html',
  'amex': 'https://www.americanexpress.com/en-ca/account/login',
  'american express': 'https://www.americanexpress.com/en-ca/account/login',
  'capital one': 'https://www.capitalone.ca/sign-in/',
  'mbna': 'https://www.mbna.ca/en/sign-in/',
  'pc financial': 'https://www.pcfinancial.ca/en/',
  'canadian tire': 'https://www.myctfs.com/',
  // Utilities
  'hydro': 'https://www.hydroone.com/myaccount',
  'enbridge': 'https://www.enbridgegas.com/my-account',
  'toronto hydro': 'https://www.torontohydro.com/myaccount',
  // Telecom
  'rogers': 'https://www.rogers.com/consumer/myrogers',
  'bell': 'https://www.bell.ca/Mybell',
  'telus': 'https://www.telus.com/my-telus',
  'fido': 'https://www.fido.ca/myaccount',
  'virgin': 'https://www.virginplus.ca/en/myaccount/',
  'koodo': 'https://www.koodomobile.com/my-account',
  'freedom': 'https://www.freedommobile.ca/my-account',
  'shaw': 'https://my.shaw.ca/',
  // Streaming & Subscriptions
  'netflix': 'https://www.netflix.com/account',
  'spotify': 'https://www.spotify.com/account/',
  'amazon': 'https://www.amazon.ca/gp/css/homepage.html',
  'disney': 'https://www.disneyplus.com/account',
  'apple': 'https://appleid.apple.com/',
  'google': 'https://myaccount.google.com/',
  'microsoft': 'https://account.microsoft.com/',
  'crave': 'https://www.crave.ca/account',
  'youtube': 'https://www.youtube.com/paid_memberships',
}

function getPaymentLink(billName: string): string | null {
  const normalized = billName.toLowerCase()
  for (const [key, url] of Object.entries(BANK_PAYMENT_LINKS)) {
    if (normalized.includes(key)) {
      return url
    }
  }
  return null
}
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Bill {
  name: string
  amount: number
  dueDate: string
  isOverdue: boolean
  daysUntilDue: number
  category: string
  frequency: string
  confidence: string
  accountType?: 'credit_card' | 'loan' | 'line_of_credit' | 'bill'
}

interface BillsSummary {
  totalBills: number
  overdueCount: number
  overdueAmount: number
  dueSoonCount: number
  dueSoonAmount: number
  upcomingAmount: number
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  bills: Bill[]
}

export function BillsCalendar() {
  const [bills, setBills] = useState<Bill[]>([])
  const [summary, setSummary] = useState<BillsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch('/api/plaid/bills')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch bills')
        }

        setBills(data.bills || [])
        setSummary(data.summary || null)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBills()
  }, [])

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

  // Generate calendar days for current month view
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: CalendarDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Add days from previous month to fill the first week
    const firstDayOfWeek = firstDay.getDay()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        bills: [],
      })
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toISOString().split('T')[0]
      const dayBills = bills.filter((b) => {
        const billDate = new Date(b.dueDate).toISOString().split('T')[0]
        return billDate === dateStr
      })

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        bills: dayBills,
      })
    }

    // Add days from next month to complete the last week
    const remainingDays = 42 - days.length // 6 rows of 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        bills: [],
      })
    }

    return days
  }

  const calendarDays = generateCalendarDays()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1)
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1)
      }
      return newMonth
    })
  }

  // Get bills for selected date
  const selectedDateBills = selectedDate
    ? bills.filter((b) => {
        const billDate = new Date(b.dueDate).toISOString().split('T')[0]
        const selected = selectedDate.toISOString().split('T')[0]
        return billDate === selected
      })
    : []

  // Calculate monthly totals
  const monthlyTotal = bills.reduce((sum, b) => {
    if (b.frequency === 'monthly') return sum + b.amount
    if (b.frequency === 'weekly') return sum + b.amount * 4
    if (b.frequency === 'yearly') return sum + b.amount / 12
    return sum + b.amount
  }, 0)

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading your bills calendar...</p>
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
              <Calendar className="h-7 w-7 text-blue-600" />
              Bills Calendar
            </h1>
            <p className="text-gray-500 mt-1">
              See when your bills are due and never miss a payment
            </p>
          </div>
        </div>
      </div>

      {/* ADHD-Friendly: Today's Action Card */}
      {bills.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wide flex items-center gap-2">
                <Target className="h-4 w-4" />
                Your Bill Focus
              </p>
              {bills.filter(b => b.isOverdue).length > 0 ? (
                <>
                  <p className="text-3xl font-bold mt-2">
                    Pay {bills.filter(b => b.isOverdue)[0].name}
                  </p>
                  <p className="text-red-200 mt-1">
                    {Math.abs(bills.filter(b => b.isOverdue)[0].daysUntilDue)} days overdue - {formatCurrency(bills.filter(b => b.isOverdue)[0].amount)}
                  </p>
                </>
              ) : bills.filter(b => b.daysUntilDue <= 3).length > 0 ? (
                <>
                  <p className="text-3xl font-bold mt-2">
                    {bills.filter(b => b.daysUntilDue <= 3)[0].name} due soon
                  </p>
                  <p className="text-blue-200 mt-1">
                    {bills.filter(b => b.daysUntilDue <= 3)[0].daysUntilDue === 0 ? 'Due TODAY!' :
                     bills.filter(b => b.daysUntilDue <= 3)[0].daysUntilDue === 1 ? 'Due tomorrow' :
                     `Due in ${bills.filter(b => b.daysUntilDue <= 3)[0].daysUntilDue} days`} - {formatCurrency(bills.filter(b => b.daysUntilDue <= 3)[0].amount)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold mt-2 flex items-center gap-2">
                    <Sparkles className="h-8 w-8" />
                    All bills on track!
                  </p>
                  <p className="text-blue-200 mt-1">Nothing urgent right now</p>
                </>
              )}
            </div>
            {(bills.filter(b => b.isOverdue).length > 0 || bills.filter(b => b.daysUntilDue <= 3).length > 0) && (
              <div className="text-right">
                {(() => {
                  const urgentBill = bills.filter(b => b.isOverdue)[0] || bills.filter(b => b.daysUntilDue <= 3)[0]
                  const payLink = urgentBill ? getPaymentLink(urgentBill.name) : null
                  return payLink ? (
                    <a
                      href={payLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-md"
                    >
                      Pay Now
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  ) : null
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Urgent Alerts - Enhanced */}
      {summary && (summary.overdueCount > 0 || summary.dueSoonCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {summary.overdueCount > 0 && (
            <div className="p-5 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500 rounded-xl">
                  <Flame className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 text-lg">
                    {summary.overdueCount} OVERDUE
                  </h3>
                  <p className="text-red-700 text-3xl font-bold mt-1">
                    {formatCurrency(summary.overdueAmount)}
                  </p>
                  <p className="text-red-600 text-sm mt-2 font-medium">
                    Pay these right now to avoid late fees!
                  </p>
                </div>
              </div>
            </div>
          )}

          {summary.dueSoonCount > 0 && (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-yellow-100 border-2 border-amber-300 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500 rounded-xl">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800 text-lg">
                    {summary.dueSoonCount} Due This Week
                  </h3>
                  <p className="text-amber-700 text-3xl font-bold mt-1">
                    {formatCurrency(summary.dueSoonAmount)}
                  </p>
                  <p className="text-amber-600 text-sm mt-2 font-medium">
                    Set a reminder or pay now while you remember!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Bills Tracked</p>
              <p className="text-xl font-bold text-gray-900">{bills.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Bills Total</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(monthlyTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yearly Bills Total</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(monthlyTotal * 12)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          {/* Calendar Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                const hasOverdue = day.bills.some((b) => b.isOverdue)
                const hasDueSoon = day.bills.some((b) => !b.isOverdue && b.daysUntilDue <= 3)
                const hasBills = day.bills.length > 0
                const isSelected =
                  selectedDate && day.date.toDateString() === selectedDate.toDateString()

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      'relative p-2 text-center rounded-lg transition-all min-h-[60px]',
                      !day.isCurrentMonth && 'text-gray-300',
                      day.isCurrentMonth && 'text-gray-900 hover:bg-gray-50',
                      day.isToday && 'ring-2 ring-blue-500 ring-inset',
                      isSelected && 'bg-blue-50',
                      hasOverdue && 'bg-red-50',
                      !hasOverdue && hasDueSoon && 'bg-amber-50'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        day.isToday && 'text-blue-600'
                      )}
                    >
                      {day.date.getDate()}
                    </span>

                    {hasBills && (
                      <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                        {day.bills.slice(0, 3).map((bill, j) => (
                          <div
                            key={j}
                            className={cn(
                              'w-2 h-2 rounded-full',
                              bill.isOverdue
                                ? 'bg-red-500'
                                : bill.daysUntilDue <= 3
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            )}
                          />
                        ))}
                        {day.bills.length > 3 && (
                          <span className="text-[10px] text-gray-500">
                            +{day.bills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 pb-4 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Due Soon</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Upcoming</span>
            </div>
          </div>
        </div>

        {/* Side Panel - Bills List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">
              {selectedDate
                ? selectedDate.toLocaleDateString('en-CA', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'All Upcoming Bills'}
            </h3>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {(selectedDate ? selectedDateBills : bills).length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>
                  {selectedDate
                    ? 'No bills due on this date'
                    : 'No upcoming bills detected'}
                </p>
              </div>
            ) : (
              (selectedDate ? selectedDateBills : bills).map((bill, i) => {
                // Get icon based on account type
                const getBillIcon = () => {
                  if (bill.accountType === 'credit_card') return <CreditCard className="h-4 w-4" />
                  if (bill.accountType === 'line_of_credit') return <Landmark className="h-4 w-4" />
                  if (bill.accountType === 'loan') return <DollarSign className="h-4 w-4" />
                  return <Receipt className="h-4 w-4" />
                }

                // Get background color based on account type
                const getTypeBg = () => {
                  if (bill.isOverdue) return 'bg-red-100'
                  if (bill.daysUntilDue <= 3) return 'bg-amber-100'
                  if (bill.accountType === 'credit_card') return 'bg-purple-100'
                  if (bill.accountType === 'line_of_credit') return 'bg-blue-100'
                  if (bill.accountType === 'loan') return 'bg-indigo-100'
                  return 'bg-gray-100'
                }

                const getTypeColor = () => {
                  if (bill.isOverdue) return 'text-red-600'
                  if (bill.daysUntilDue <= 3) return 'text-amber-600'
                  if (bill.accountType === 'credit_card') return 'text-purple-600'
                  if (bill.accountType === 'line_of_credit') return 'text-blue-600'
                  if (bill.accountType === 'loan') return 'text-indigo-600'
                  return 'text-gray-600'
                }

                const paymentLink = getPaymentLink(bill.name)

                return (
                  <div
                    key={i}
                    className={cn(
                      'p-4',
                      bill.isOverdue && 'bg-red-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg', getTypeBg())}>
                          <span className={getTypeColor()}>
                            {getBillIcon()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{bill.name}</p>
                            {bill.accountType && bill.accountType !== 'bill' && (
                              <span className={cn(
                                'text-xs px-1.5 py-0.5 rounded',
                                bill.accountType === 'credit_card' && 'bg-purple-100 text-purple-700',
                                bill.accountType === 'line_of_credit' && 'bg-blue-100 text-blue-700',
                                bill.accountType === 'loan' && 'bg-indigo-100 text-indigo-700'
                              )}>
                                {bill.accountType === 'credit_card' ? 'Credit Card' :
                                 bill.accountType === 'line_of_credit' ? 'LOC' : 'Loan'}
                              </span>
                            )}
                          </div>
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
                              ? `${Math.abs(bill.daysUntilDue)} days overdue!`
                              : bill.daysUntilDue === 0
                                ? 'Due today!'
                                : bill.daysUntilDue === 1
                                  ? 'Due tomorrow'
                                  : `Due in ${bill.daysUntilDue} days`}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">
                            {bill.frequency} • Min payment
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(bill.amount)}
                        </p>
                        {paymentLink && (
                          <a
                            href={paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:underline flex items-center justify-end gap-1 mt-1"
                          >
                            Pay <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Monthly Bill Breakdown
          </h2>
          <p className="text-sm text-gray-500">
            This is how much you spend on recurring bills every month
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {bills
              .sort((a, b) => b.amount - a.amount)
              .map((bill, i) => {
                const monthlyAmount =
                  bill.frequency === 'yearly'
                    ? bill.amount / 12
                    : bill.frequency === 'weekly'
                      ? bill.amount * 4
                      : bill.amount
                const percentage = (monthlyAmount / monthlyTotal) * 100

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{bill.name}</span>
                        {bill.isOverdue && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(monthlyAmount)}
                        </span>
                        <span className="text-gray-400 ml-2">
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          bill.isOverdue
                            ? 'bg-red-500'
                            : bill.daysUntilDue <= 7
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>

          {bills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <span className="font-semibold text-gray-900">
                Total Monthly Bills
              </span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(monthlyTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
