'use client'

import { useState, useEffect } from 'react'
import {
  CreditCard,
  Landmark,
  Home,
  Car,
  Zap,
  Phone,
  GraduationCap,
  Loader2,
  Shield,
  Building2,
  Heart,
  ShoppingCart,
  Stethoscope,
  Shirt,
  Wrench,
  Upload,
  Receipt,
  TrendingUp,
  RefreshCw,
  Fish,
  Fuel,
  Baby,
  Wifi,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatementUploadDialog } from './StatementUploadDialog'

interface Bill {
  id: string
  name: string
  amount: number
  monthlyAmount: number
  type: 'PERSONAL' | 'BUSINESS'
  category: string
  subCategory?: string
  dueDay?: number
  frequency: string
  isAutoPay: boolean
}

interface VariableExpenseData {
  categories: Record<string, {
    average: number
    months: Record<string, number>
    transactions: number
  }>
  monthLabels: string[]
  totalTransactionsAnalyzed: number
}

interface CreditAccount {
  id: string
  accountId: string
  name: string
  officialName: string | null
  nickname: string | null
  type: string
  subtype: string | null
  mask: string | null
  currentBalance: number
  availableBalance: number
  institutionName: string
  creditLimit: number | null
  dueDay: number | null
  minimumPayment: number | null
}

// Category card configurations
const CATEGORY_CARDS = [
  {
    key: 'CREDIT_CARD',
    label: 'Credit Cards',
    icon: CreditCard,
    gradient: 'from-violet-500 to-purple-600',
    description: 'Total owed'
  },
  {
    key: 'LINE_OF_CREDIT',
    label: 'Lines of Credit',
    icon: Landmark,
    gradient: 'from-blue-500 to-blue-600',
    description: 'Total balance'
  },
  {
    key: 'SOFTWARE',
    label: 'Subscriptions',
    icon: Zap,
    gradient: 'from-indigo-500 to-indigo-600',
    description: 'Monthly'
  },
  {
    key: 'LOAN',
    label: 'Loans',
    icon: DollarSign,
    gradient: 'from-amber-500 to-orange-500',
    description: 'Monthly payments'
  },
  {
    key: 'TUITION',
    label: 'Tuition',
    icon: GraduationCap,
    gradient: 'from-rose-500 to-pink-600',
    description: 'Education'
  },
  {
    key: 'CHILDCARE',
    label: 'Childcare',
    icon: Baby,
    gradient: 'from-pink-400 to-rose-500',
    description: 'Monthly'
  },
  {
    key: 'CAR_LEASE',
    label: 'Car Lease',
    icon: Car,
    gradient: 'from-slate-600 to-slate-700',
    description: 'Monthly'
  },
  {
    key: 'UTILITIES',
    label: 'Utilities',
    icon: Zap,
    gradient: 'from-yellow-500 to-amber-500',
    description: 'Hydro, gas, water'
  },
  {
    key: 'INTERNET',
    label: 'Internet',
    icon: Wifi,
    gradient: 'from-cyan-500 to-teal-500',
    description: 'Monthly'
  },
  {
    key: 'PHONE',
    label: 'Phone',
    icon: Phone,
    gradient: 'from-gray-600 to-gray-700',
    description: 'Mobile plans'
  },
  {
    key: 'INSURANCE',
    label: 'Insurance',
    icon: Shield,
    gradient: 'from-emerald-500 to-green-600',
    description: 'All coverage',
    categories: ['CAR_INSURANCE', 'HOME_INSURANCE', 'LIFE_INSURANCE']
  },
  {
    key: 'TZEDAKA',
    label: 'Tzedaka',
    icon: Heart,
    gradient: 'from-red-500 to-red-600',
    description: 'Monthly giving'
  },
  {
    key: 'PROPERTY_TAX',
    label: 'Property Tax',
    icon: Building2,
    gradient: 'from-blue-700 to-blue-800',
    description: 'Yearly (monthly)'
  },
]

// Variable expense categories
const VARIABLE_CARDS = [
  { key: 'GROCERIES', label: 'Groceries', icon: ShoppingCart, gradient: 'from-green-500 to-emerald-600' },
  { key: 'MEAT', label: 'Meat', icon: ShoppingCart, gradient: 'from-red-500 to-red-600' },
  { key: 'FISH', label: 'Fish', icon: Fish, gradient: 'from-blue-400 to-cyan-500' },
  { key: 'GAS', label: 'Gas', icon: Fuel, gradient: 'from-amber-500 to-orange-500' },
  { key: 'MEDICAL', label: 'Medical', icon: Stethoscope, gradient: 'from-pink-500 to-rose-500' },
  { key: 'CLOTHING', label: 'Clothing', icon: Shirt, gradient: 'from-violet-500 to-purple-500' },
  { key: 'CAR_SERVICE', label: 'Car Service', icon: Wrench, gradient: 'from-gray-500 to-gray-600' },
]

export function MonthlyPayments() {
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [variableData, setVariableData] = useState<VariableExpenseData | null>(null)
  const [isLoadingVariable, setIsLoadingVariable] = useState(false)
  const [creditAccounts, setCreditAccounts] = useState<{
    creditCards: CreditAccount[]
    linesOfCredit: CreditAccount[]
  }>({ creditCards: [], linesOfCredit: [] })
  const [uploadingAccount, setUploadingAccount] = useState<CreditAccount | null>(null)
  const [showUploadPicker, setShowUploadPicker] = useState(false)

  const fetchBills = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/monthly-bills')
      if (res.ok) {
        const data = await res.json()
        setBills(data.bills || [])
      }
    } catch (err) {
      console.error('Failed to fetch bills:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVariableExpenses = async () => {
    setIsLoadingVariable(true)
    try {
      const res = await fetch('/api/monthly-bills/variable-expenses')
      if (res.ok) {
        const data = await res.json()
        setVariableData(data)
      }
    } catch (err) {
      console.error('Failed to fetch variable expenses:', err)
    } finally {
      setIsLoadingVariable(false)
    }
  }

  const fetchCreditAccounts = async () => {
    try {
      const res = await fetch('/api/monthly-bills/credit-accounts')
      if (res.ok) {
        const data = await res.json()
        setCreditAccounts({
          creditCards: data.creditCards || [],
          linesOfCredit: data.linesOfCredit || [],
        })
      }
    } catch (err) {
      console.error('Failed to fetch credit accounts:', err)
    }
  }

  useEffect(() => {
    fetchBills()
    fetchVariableExpenses()
    fetchCreditAccounts()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate category totals
  const getCategoryTotal = (categoryKey: string, categories?: string[]) => {
    if (categoryKey === 'CREDIT_CARD') {
      return creditAccounts.creditCards.reduce((sum, c) => sum + c.currentBalance, 0)
    }
    if (categoryKey === 'LINE_OF_CREDIT') {
      return creditAccounts.linesOfCredit.reduce((sum, c) => sum + c.currentBalance, 0)
    }
    if (categories) {
      return bills
        .filter(b => b.type === 'PERSONAL' && categories.includes(b.category))
        .reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)
    }
    return bills
      .filter(b => b.type === 'PERSONAL' && b.category === categoryKey)
      .reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)
  }

  const getCategoryCount = (categoryKey: string, categories?: string[]) => {
    if (categoryKey === 'CREDIT_CARD') return creditAccounts.creditCards.length
    if (categoryKey === 'LINE_OF_CREDIT') return creditAccounts.linesOfCredit.length
    if (categories) {
      return bills.filter(b => b.type === 'PERSONAL' && categories.includes(b.category)).length
    }
    return bills.filter(b => b.type === 'PERSONAL' && b.category === categoryKey).length
  }

  // Calculate totals
  const fixedTotal = bills
    .filter(b => b.type === 'PERSONAL')
    .reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)

  const variableTotal = variableData
    ? Object.values(variableData.categories).reduce((sum, cat) => sum + cat.average, 0)
    : 0

  const grandTotal = fixedTotal + variableTotal

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Bills</h1>
          <p className="text-gray-500 mt-1">Overview of your recurring expenses</p>
        </div>
        <button
          onClick={() => setShowUploadPicker(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload Statement
        </button>
      </div>

      {/* Fixed Expenses Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-800">Fixed Expenses</h2>
          <span className="text-lg font-semibold text-gray-600">{formatCurrency(fixedTotal)}/mo</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORY_CARDS.map((cat) => {
            const total = getCategoryTotal(cat.key, (cat as any).categories)
            const count = getCategoryCount(cat.key, (cat as any).categories)
            const Icon = cat.icon

            if (total === 0 && count === 0) return null

            return (
              <div
                key={cat.key}
                className={cn(
                  'relative rounded-2xl p-5 text-white overflow-hidden cursor-pointer',
                  'bg-gradient-to-br',
                  cat.gradient,
                  'hover:scale-[1.02] transition-transform shadow-lg'
                )}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20" />
                  <div className="absolute -right-2 -bottom-6 w-32 h-32 rounded-full bg-white/10" />
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    {count > 0 && (
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>

                  <p className="text-white/80 text-sm font-medium">{cat.label}</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(total)}</p>
                  <p className="text-white/60 text-xs mt-2">{cat.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Variable Expenses Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Variable Expenses</h2>
            <p className="text-sm text-gray-500">3-month averages from bank transactions</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-gray-600">{formatCurrency(variableTotal)}/mo</span>
            <button
              onClick={fetchVariableExpenses}
              disabled={isLoadingVariable}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={cn('h-5 w-5', isLoadingVariable && 'animate-spin')} />
            </button>
          </div>
        </div>

        {isLoadingVariable ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {VARIABLE_CARDS.map((cat) => {
              const data = variableData?.categories[cat.key]
              const Icon = cat.icon

              return (
                <div
                  key={cat.key}
                  className={cn(
                    'relative rounded-2xl p-5 text-white overflow-hidden',
                    'bg-gradient-to-br',
                    cat.gradient,
                    'shadow-lg'
                  )}
                >
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20" />
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      {data && data.transactions > 0 && (
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                          {data.transactions} txns
                        </span>
                      )}
                    </div>

                    <p className="text-white/80 text-sm font-medium">{cat.label}</p>
                    <p className="text-2xl font-bold mt-1">
                      {data ? formatCurrency(data.average) : '$0'}
                    </p>
                    <p className="text-white/60 text-xs mt-2">avg/month</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Grand Total */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm uppercase tracking-wider">Total Monthly</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm uppercase tracking-wider">Annual</p>
            <p className="text-2xl font-semibold mt-2">{formatCurrency(grandTotal * 12)}</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-white/50">Fixed:</span>
              <span className="ml-2 font-medium">{formatCurrency(fixedTotal)}</span>
            </div>
            <div>
              <span className="text-white/50">Variable:</span>
              <span className="ml-2 font-medium">{formatCurrency(variableTotal)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <TrendingUp className="h-4 w-4" />
            <span>Based on 3-month average</span>
          </div>
        </div>
      </div>

      {/* Upload Statement Picker */}
      {showUploadPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUploadPicker(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Account</h3>
            <p className="text-sm text-gray-500 mb-4">Choose which credit card statement to upload</p>

            <div className="space-y-2">
              {creditAccounts.creditCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => {
                    setUploadingAccount(card)
                    setShowUploadPicker(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                >
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{card.nickname || card.name}</p>
                    <p className="text-sm text-gray-500">{card.institutionName} •••• {card.mask}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowUploadPicker(false)}
              className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Statement Upload Dialog */}
      {uploadingAccount && (
        <StatementUploadDialog
          open={!!uploadingAccount}
          onOpenChange={(open) => !open && setUploadingAccount(null)}
          account={{
            id: uploadingAccount.id,
            name: uploadingAccount.nickname || uploadingAccount.name,
            institutionName: uploadingAccount.institutionName,
            mask: uploadingAccount.mask,
          }}
          onUploadComplete={() => {
            fetchVariableExpenses()
          }}
        />
      )}
    </div>
  )
}
