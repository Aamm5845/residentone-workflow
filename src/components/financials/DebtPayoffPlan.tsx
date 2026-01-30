'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Target,
  Loader2,
  DollarSign,
  Calendar,
  TrendingDown,
  CheckCircle2,
  Lightbulb,
  CreditCard,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DebtAccount {
  name: string
  balance: number
  order: number
  payoffMonth: number
}

interface Plan {
  strategy: 'avalanche' | 'snowball'
  totalDebt: number
  monthlyPayment: number
  payoffMonths: number
  accounts: DebtAccount[]
  tips: string[]
}

export function DebtPayoffPlan() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [hasDebt, setHasDebt] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthlyBudget, setMonthlyBudget] = useState(500)

  const fetchPlan = async (budget: number) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/plaid/debt-plan?budget=${budget}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate plan')
      }

      setHasDebt(data.hasDebt)
      setPlan(data.plan || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan(monthlyBudget)
  }, [])

  const handleBudgetChange = (newBudget: number) => {
    setMonthlyBudget(newBudget)
    fetchPlan(newBudget)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Creating your debt payoff plan...</p>
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
              <Target className="h-7 w-7 text-amber-600" />
              Debt Payoff Plan
            </h1>
            <p className="text-gray-500 mt-1">
              Your personalized path to being debt-free
            </p>
          </div>
        </div>
      </div>

      {!hasDebt ? (
        // No Debt - Celebration
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-8 text-white text-center">
          <Sparkles className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-3xl font-bold">You&apos;re Debt Free!</h2>
          <p className="mt-2 text-green-100 max-w-md mx-auto">
            No credit card debt detected. Keep up the great work! Consider putting
            extra money into savings or investments.
          </p>
          <Link href="/financials">
            <Button variant="secondary" className="mt-6">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      ) : plan ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Debt</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(plan.totalDebt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monthly Payment</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(plan.monthlyPayment)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time to Debt-Free</p>
                  <p className="text-xl font-bold text-gray-900">
                    {plan.payoffMonths} months
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Strategy</p>
                  <p className="text-xl font-bold text-gray-900 capitalize">
                    {plan.strategy}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Slider */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How much can you put toward debt each month?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="100"
                max="2000"
                step="50"
                value={monthlyBudget}
                onChange={(e) => handleBudgetChange(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className="text-lg font-semibold text-gray-900 w-24 text-right">
                {formatCurrency(monthlyBudget)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>$100</span>
              <span>$2,000</span>
            </div>
          </div>

          {/* Strategy Explanation */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800">
                  {plan.strategy === 'snowball'
                    ? 'Snowball Method'
                    : 'Avalanche Method'}
                </h3>
                <p className="text-amber-700 text-sm mt-1">
                  {plan.strategy === 'snowball'
                    ? 'Pay off smallest debts first for quick wins and motivation. Each paid-off debt frees up money for the next one.'
                    : 'Pay off highest interest debts first to minimize total interest paid. Mathematically optimal but requires patience.'}
                </p>
              </div>
            </div>
          </div>

          {/* Payoff Order */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Your Payoff Order
              </h2>
              <p className="text-sm text-gray-500">
                Focus on one debt at a time while making minimum payments on others
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {plan.accounts.map((account, i) => (
                <div
                  key={i}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg',
                        i === 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {account.order}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500">
                        {i === 0 ? 'Pay this one first!' : `After #${i}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-sm text-gray-500">
                      ~{account.payoffMonth} months
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Tips for Success
              </h2>
            </div>
            <div className="p-4">
              <ul className="space-y-3">
                {plan.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ArrowRight className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Target className="h-12 w-12 mx-auto text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Unable to generate plan
          </h3>
          <p className="mt-2 text-gray-500">
            Connect your credit accounts to create a personalized debt payoff plan.
          </p>
          <Link href="/financials">
            <Button variant="outline" className="mt-4">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
