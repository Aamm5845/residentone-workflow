'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Repeat,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Trash2,
  ExternalLink,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Subscription {
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  lastCharge: string
  nextExpected: string
  category: string
  isEssential: boolean
  cancelSuggestion?: string
}

interface SubscriptionSummary {
  total: number
  monthlyTotal: number
  yearlyTotal: number
  annualCost: number
  potentialSavings: number
  essentialCount: number
  nonEssentialCount: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Entertainment: 'bg-purple-100 text-purple-700',
  Productivity: 'bg-blue-100 text-blue-700',
  Utilities: 'bg-cyan-100 text-cyan-700',
  Fitness: 'bg-green-100 text-green-700',
  News: 'bg-orange-100 text-orange-700',
  Storage: 'bg-indigo-100 text-indigo-700',
  Music: 'bg-pink-100 text-pink-700',
  Video: 'bg-red-100 text-red-700',
  Gaming: 'bg-violet-100 text-violet-700',
  Software: 'bg-slate-100 text-slate-700',
  Other: 'bg-gray-100 text-gray-700',
}

export function SubscriptionsManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'essential' | 'non-essential'>('all')

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const res = await fetch('/api/plaid/subscriptions')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch subscriptions')
        }

        setSubscriptions(data.subscriptions || [])
        setSummary(data.summary || null)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscriptions()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (filter === 'essential') return sub.isEssential
    if (filter === 'non-essential') return !sub.isEssential
    return true
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Analyzing your subscriptions...</p>
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
      {/* Header with Back Button */}
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
              <Repeat className="h-7 w-7 text-purple-600" />
              Subscription Manager
            </h1>
            <p className="text-gray-500 mt-1">
              Track and manage your recurring charges
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Repeat className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Subscriptions</p>
                <p className="text-xl font-bold text-gray-900">{summary.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly Cost</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(summary.monthlyTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Annual Cost</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(summary.annualCost)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Lightbulb className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Potential Savings</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.potentialSavings)}/yr
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Potential Savings Alert */}
      {summary && summary.potentialSavings > 0 && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800">
                You could save up to {formatCurrency(summary.potentialSavings)} per year
              </h3>
              <p className="text-green-700 text-sm mt-1">
                Review the non-essential subscriptions below. Consider canceling ones you
                don&apos;t actively use.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({subscriptions.length})
        </Button>
        <Button
          variant={filter === 'essential' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('essential')}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Essential ({summary?.essentialCount || 0})
        </Button>
        <Button
          variant={filter === 'non-essential' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('non-essential')}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Review ({summary?.nonEssentialCount || 0})
        </Button>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filteredSubscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <Repeat className="h-12 w-12 mx-auto text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No subscriptions found
            </h3>
            <p className="mt-2 text-gray-500">
              {filter !== 'all'
                ? 'Try changing the filter to see more subscriptions'
                : 'Sync your transactions to detect recurring charges'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSubscriptions.map((sub, i) => (
              <div
                key={i}
                className={cn(
                  'p-4',
                  !sub.isEssential && 'bg-amber-50/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        sub.isEssential ? 'bg-green-100' : 'bg-amber-100'
                      )}
                    >
                      {sub.isEssential ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{sub.name}</h3>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.Other
                          )}
                        >
                          {sub.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>
                          {formatCurrency(sub.amount)}/{sub.frequency}
                        </span>
                        <span>Last: {formatDate(sub.lastCharge)}</span>
                        <span>Next: {formatDate(sub.nextExpected)}</span>
                      </div>
                      {sub.cancelSuggestion && (
                        <p className="mt-2 text-sm text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {sub.cancelSuggestion}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(
                        sub.frequency === 'yearly'
                          ? sub.amount
                          : sub.frequency === 'monthly'
                            ? sub.amount * 12
                            : sub.amount * 52
                      )}
                      <span className="text-sm font-normal text-gray-500">/yr</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
