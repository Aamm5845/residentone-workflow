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
} from 'lucide-react'
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
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

      {/* Urgent Alerts */}
      {summary && (summary.overdueCount > 0 || summary.dueSoonCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {summary.overdueCount > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800">
                    {summary.overdueCount} Overdue Bill{summary.overdueCount > 1 ? 's' : ''}
                  </h3>
                  <p className="text-red-700 text-2xl font-bold mt-1">
                    {formatCurrency(summary.overdueAmount)}
                  </p>
                  <p className="text-red-600 text-sm mt-1">Pay these immediately!</p>
                </div>
              </div>
            </div>
          )}

          {summary.dueSoonCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Bell className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800">
                    {summary.dueSoonCount} Bill{summary.dueSoonCount > 1 ? 's' : ''} Due This Week
                  </h3>
                  <p className="text-amber-700 text-2xl font-bold mt-1">
                    {formatCurrency(summary.dueSoonAmount)}
                  </p>
                  <p className="text-amber-600 text-sm mt-1">Don&apos;t forget to pay!</p>
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
              (selectedDate ? selectedDateBills : bills).map((bill, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-4',
                    bill.isOverdue && 'bg-red-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
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
                        {bill.isOverdue ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : bill.daysUntilDue <= 3 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-600" />
                        )}
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
                            ? `${Math.abs(bill.daysUntilDue)} days overdue!`
                            : bill.daysUntilDue === 0
                              ? 'Due today!'
                              : bill.daysUntilDue === 1
                                ? 'Due tomorrow'
                                : `Due in ${bill.daysUntilDue} days`}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {bill.frequency}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(bill.amount)}
                    </p>
                  </div>
                </div>
              ))
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
