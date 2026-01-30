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
  ExternalLink,
  Mountain,
  Flag,
  Trophy,
  Flame,
  Star,
} from 'lucide-react'

// Payment portal links for Canadian banks
const BANK_PAYMENT_LINKS: Record<string, string> = {
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
  'banque nationale': 'https://www.nbc.ca/personal/accounts/online-banking.html',
  'desjardins': 'https://www.desjardins.com/ca/personal/accounts-services/ways-to-bank/online-banking/',
  'tangerine': 'https://www.tangerine.ca/en/ways-to-bank/online-banking',
  'simplii': 'https://www.simplii.com/en/ways-to-bank/online-banking.html',
  'amex': 'https://www.americanexpress.com/en-ca/account/login',
  'american express': 'https://www.americanexpress.com/en-ca/account/login',
  'capital one': 'https://www.capitalone.ca/sign-in/',
}

function getPaymentLink(accountName: string): string | null {
  const normalized = accountName.toLowerCase()
  for (const [key, url] of Object.entries(BANK_PAYMENT_LINKS)) {
    if (normalized.includes(key)) {
      return url
    }
  }
  return null
}
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
          {/* Visual Journey to Debt-Free */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Mountain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Journey to Debt-Free</h2>
                <p className="text-amber-700">You can do this! Every payment gets you closer.</p>
              </div>
            </div>

            {/* Visual Progress Mountain */}
            <div className="relative h-32 mb-4">
              {/* Mountain background */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                {/* Mountain shape */}
                <path
                  d="M0,100 L50,60 L100,80 L150,40 L200,50 L250,20 L300,45 L350,10 L400,30 L400,100 Z"
                  fill="url(#mountainGradient)"
                  opacity="0.3"
                />
                {/* Progress fill based on how far along */}
                <defs>
                  <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Progress path */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-green-500 rounded-full transition-all duration-1000"
                  style={{ width: '0%' }}
                />
              </div>

              {/* Milestones */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
                <div className="flex flex-col items-center">
                  <div className="p-2 bg-amber-500 rounded-full mb-1">
                    <Flag className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs text-gray-600">Start</span>
                </div>
                {plan.accounts.map((account, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className={cn(
                      "p-1.5 rounded-full mb-1",
                      i === 0 ? "bg-amber-400" : "bg-gray-300"
                    )}>
                      <Star className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-gray-500 max-w-[60px] truncate text-center">
                      {account.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
                <div className="flex flex-col items-center">
                  <div className="p-2 bg-green-500 rounded-full mb-1">
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs text-green-600 font-semibold">Debt Free!</span>
                </div>
              </div>
            </div>

            {/* Motivational stats */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-amber-200">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">{plan.payoffMonths}</p>
                <p className="text-sm text-gray-600">months to freedom</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{plan.accounts.length}</p>
                <p className="text-sm text-gray-600">debts to crush</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {new Date(new Date().setMonth(new Date().getMonth() + plan.payoffMonths)).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
                </p>
                <p className="text-sm text-gray-600">debt-free date</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <CreditCard className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Debt</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(plan.totalDebt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

          {/* Budget Slider - Enhanced */}
          <div className="bg-white rounded-xl border-2 border-amber-200 p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-amber-500" />
              <label className="text-lg font-semibold text-gray-900">
                How much can you attack debt with each month?
              </label>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={monthlyBudget}
                  onChange={(e) => handleBudgetChange(parseInt(e.target.value))}
                  className="w-full h-3 bg-gradient-to-r from-gray-200 via-amber-200 to-green-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>$100</span>
                  <span>$500</span>
                  <span>$1,000</span>
                  <span>$1,500</span>
                  <span>$2,000</span>
                </div>
              </div>
              <div className="text-center bg-amber-50 rounded-xl px-6 py-3 border-2 border-amber-300">
                <span className="text-3xl font-bold text-amber-600">
                  {formatCurrency(monthlyBudget)}
                </span>
                <p className="text-xs text-amber-700">per month</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              {monthlyBudget < 300 ? "Start small - every bit counts!" :
               monthlyBudget < 700 ? "Good pace! You'll be free in " + plan.payoffMonths + " months." :
               monthlyBudget < 1200 ? "Aggressive! You're crushing this debt!" :
               "Warrior mode! You'll be debt-free fast!"}
            </p>
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

          {/* Payoff Order - Enhanced with visual progress */}
          <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Your Attack Order
              </h2>
              <p className="text-sm text-gray-500">
                Focus ALL extra money on #1 until it&apos;s gone. Minimum payments on the rest.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {plan.accounts.map((account, i) => {
                const paymentLink = getPaymentLink(account.name)
                const isFirst = i === 0
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-4 transition-all",
                      isFirst && "bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-md',
                            isFirst
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-4 ring-amber-200'
                              : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          {isFirst ? <Flame className="h-6 w-6" /> : account.order}
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold",
                            isFirst ? "text-amber-800 text-lg" : "text-gray-900"
                          )}>
                            {account.name}
                          </p>
                          <p className={cn(
                            "text-sm",
                            isFirst ? "text-amber-600 font-medium" : "text-gray-500"
                          )}>
                            {isFirst ? '🎯 ATTACK THIS ONE NOW!' : `After #${i} is done`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={cn(
                            "font-bold text-xl",
                            isFirst ? "text-amber-700" : "text-gray-900"
                          )}>
                            {formatCurrency(account.balance)}
                          </p>
                          <p className="text-sm text-gray-500">
                            ~{account.payoffMonth} months
                          </p>
                        </div>
                        {paymentLink && (
                          <a
                            href={paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                              isFirst
                                ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                            )}
                          >
                            {isFirst ? 'Pay Now' : 'Min Payment'}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for each debt */}
                    {isFirst && (
                      <div className="mt-4 pt-4 border-t border-amber-200">
                        <div className="flex items-center justify-between text-xs text-amber-700 mb-1">
                          <span>Progress</span>
                          <span>0% paid (just getting started!)</span>
                        </div>
                        <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full w-0" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ADHD-Friendly Tips with actionable checkboxes */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 overflow-hidden">
            <div className="p-4 border-b border-green-200 bg-green-100/50">
              <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-green-600" />
                ADHD-Friendly Tips for Success
              </h2>
              <p className="text-sm text-green-700">Small wins build big momentum!</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Always include these ADHD-specific tips */}
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                <div className="p-1 bg-green-100 rounded">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Set up automatic payments</p>
                  <p className="text-sm text-gray-600">Remove the mental load - autopay removes the forget-to-pay problem</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                <div className="p-1 bg-amber-100 rounded">
                  <Flame className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Put a sticky note on your card</p>
                  <p className="text-sm text-gray-600">&quot;Do I NEED this?&quot; - visible friction helps impulsive spending</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                <div className="p-1 bg-purple-100 rounded">
                  <Star className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Celebrate every $100 paid off</p>
                  <p className="text-sm text-gray-600">Dopamine hits keep you motivated - treat yourself (for free!)</p>
                </div>
              </div>

              {plan.tips.slice(0, 2).map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                  <div className="p-1 bg-blue-100 rounded">
                    <ArrowRight className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-gray-700">{tip}</p>
                </div>
              ))}
            </div>

            {/* Quick Win CTA */}
            <div className="p-4 bg-green-100 border-t border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-green-800">Ready for your first win?</p>
                  <p className="text-sm text-green-700">Make a payment right now, even if it&apos;s just $10!</p>
                </div>
                <Trophy className="h-8 w-8 text-green-600" />
              </div>
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
