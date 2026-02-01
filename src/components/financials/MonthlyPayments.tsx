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
  X,
  ChevronRight,
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

// Category card configurations with muted colors and background images
const CATEGORY_CARDS = [
  {
    key: 'CREDIT_CARD',
    label: 'Credit Cards',
    icon: CreditCard,
    gradient: 'from-slate-700 to-slate-800',
    bgImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80',
    description: 'Total owed'
  },
  {
    key: 'LINE_OF_CREDIT',
    label: 'Lines of Credit',
    icon: Landmark,
    gradient: 'from-slate-600 to-slate-700',
    bgImage: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?w=400&q=80',
    description: 'Total balance'
  },
  {
    key: 'SOFTWARE',
    label: 'Subscriptions',
    icon: Zap,
    gradient: 'from-indigo-800 to-indigo-900',
    bgImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80',
    description: 'Monthly'
  },
  {
    key: 'LOAN',
    label: 'Loans',
    icon: DollarSign,
    gradient: 'from-amber-700 to-amber-800',
    bgImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80',
    description: 'Monthly payments'
  },
  {
    key: 'TUITION',
    label: 'Tuition',
    icon: GraduationCap,
    gradient: 'from-rose-800 to-rose-900',
    bgImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&q=80',
    description: 'Education'
  },
  {
    key: 'CHILDCARE',
    label: 'Childcare',
    icon: Baby,
    gradient: 'from-pink-700 to-pink-800',
    bgImage: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&q=80',
    description: 'Monthly'
  },
  {
    key: 'CAR_LEASE',
    label: 'Car Lease',
    icon: Car,
    gradient: 'from-zinc-700 to-zinc-800',
    bgImage: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&q=80',
    description: 'Monthly'
  },
  {
    key: 'UTILITIES',
    label: 'Utilities',
    icon: Zap,
    gradient: 'from-yellow-700 to-yellow-800',
    bgImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    description: 'Hydro, gas, water'
  },
  {
    key: 'INTERNET',
    label: 'Internet',
    icon: Wifi,
    gradient: 'from-cyan-700 to-cyan-800',
    bgImage: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&q=80',
    description: 'Monthly'
  },
  {
    key: 'PHONE',
    label: 'Phone',
    icon: Phone,
    gradient: 'from-gray-700 to-gray-800',
    bgImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
    description: 'Mobile plans'
  },
  {
    key: 'INSURANCE',
    label: 'Insurance',
    icon: Shield,
    gradient: 'from-emerald-800 to-emerald-900',
    bgImage: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80',
    description: 'All coverage',
    categories: ['CAR_INSURANCE', 'HOME_INSURANCE', 'LIFE_INSURANCE']
  },
  {
    key: 'TZEDAKA',
    label: 'Tzedaka',
    icon: Heart,
    gradient: 'from-red-800 to-red-900',
    bgImage: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&q=80',
    description: 'Monthly giving'
  },
  {
    key: 'PROPERTY_TAX',
    label: 'Property Tax',
    icon: Building2,
    gradient: 'from-blue-800 to-blue-900',
    bgImage: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80',
    description: 'Yearly (monthly)'
  },
]

// Variable expense categories with muted colors and background images
const VARIABLE_CARDS = [
  {
    key: 'GROCERIES',
    label: 'Groceries',
    icon: ShoppingCart,
    gradient: 'from-green-800 to-green-900',
    bgImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80'
  },
  {
    key: 'MEAT',
    label: 'Meat',
    icon: ShoppingCart,
    gradient: 'from-red-900 to-red-950',
    bgImage: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80'
  },
  {
    key: 'FISH',
    label: 'Fish',
    icon: Fish,
    gradient: 'from-sky-800 to-sky-900',
    bgImage: 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=400&q=80'
  },
  {
    key: 'GAS',
    label: 'Gas',
    icon: Fuel,
    gradient: 'from-orange-800 to-orange-900',
    bgImage: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&q=80'
  },
  {
    key: 'MEDICAL',
    label: 'Medical',
    icon: Stethoscope,
    gradient: 'from-teal-800 to-teal-900',
    bgImage: 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=400&q=80'
  },
  {
    key: 'CLOTHING',
    label: 'Clothing',
    icon: Shirt,
    gradient: 'from-violet-800 to-violet-900',
    bgImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80'
  },
  {
    key: 'CAR_SERVICE',
    label: 'Car Service',
    icon: Wrench,
    gradient: 'from-stone-700 to-stone-800',
    bgImage: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400&q=80'
  },
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
  const [selectedCategory, setSelectedCategory] = useState<{
    key: string
    label: string
    gradient: string
    type: 'fixed' | 'variable'
  } | null>(null)

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

  // Get items for a category
  const getCategoryItems = (categoryKey: string, categories?: string[]) => {
    if (categoryKey === 'CREDIT_CARD') {
      return creditAccounts.creditCards.map(c => ({
        id: c.id,
        name: c.nickname || c.name,
        subtitle: `${c.institutionName} •••• ${c.mask}`,
        amount: c.currentBalance,
        extra: c.creditLimit ? `Limit: ${formatCurrency(c.creditLimit)}` : undefined
      }))
    }
    if (categoryKey === 'LINE_OF_CREDIT') {
      return creditAccounts.linesOfCredit.map(c => ({
        id: c.id,
        name: c.nickname || c.name,
        subtitle: `${c.institutionName} •••• ${c.mask}`,
        amount: c.currentBalance,
        extra: c.creditLimit ? `Available: ${formatCurrency(c.creditLimit - c.currentBalance)}` : undefined
      }))
    }
    const filteredBills = categories
      ? bills.filter(b => b.type === 'PERSONAL' && categories.includes(b.category))
      : bills.filter(b => b.type === 'PERSONAL' && b.category === categoryKey)

    return filteredBills.map(b => ({
      id: b.id,
      name: b.name,
      subtitle: b.dueDay ? `Due: ${b.dueDay}th` : undefined,
      amount: b.monthlyAmount || b.amount,
      extra: b.isAutoPay ? 'Auto-pay' : undefined
    }))
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
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
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
                onClick={() => setSelectedCategory({ key: cat.key, label: cat.label, gradient: cat.gradient, type: 'fixed' })}
                className={cn(
                  'relative rounded-2xl p-5 text-white overflow-hidden cursor-pointer',
                  'bg-gradient-to-br',
                  cat.gradient,
                  'hover:scale-[1.02] transition-transform shadow-lg group'
                )}
                style={{ minHeight: '160px' }}
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                  style={{
                    backgroundImage: `url(${cat.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Dark overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    {count > 0 && (
                      <span className="text-xs bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>

                  <p className="text-white/90 text-sm font-medium">{cat.label}</p>
                  <p className="text-2xl font-bold mt-1 drop-shadow-md">{formatCurrency(total)}</p>
                  <p className="text-white/70 text-xs mt-2">{cat.description}</p>
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
                  onClick={() => setSelectedCategory({ key: cat.key, label: cat.label, gradient: cat.gradient, type: 'variable' })}
                  className={cn(
                    'relative rounded-2xl p-5 text-white overflow-hidden cursor-pointer',
                    'bg-gradient-to-br',
                    cat.gradient,
                    'hover:scale-[1.02] transition-transform shadow-lg group'
                  )}
                  style={{ minHeight: '160px' }}
                >
                  {/* Background image */}
                  <div
                    className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{
                      backgroundImage: `url(${cat.bgImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      {data && data.transactions > 0 && (
                        <span className="text-xs bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
                          {data.transactions} txns
                        </span>
                      )}
                    </div>

                    <p className="text-white/90 text-sm font-medium">{cat.label}</p>
                    <p className="text-2xl font-bold mt-1 drop-shadow-md">
                      {data ? formatCurrency(data.average) : '$0'}
                    </p>
                    <p className="text-white/70 text-xs mt-2">avg/month</p>
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

      {/* Category Detail Modal */}
      {selectedCategory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={cn('p-6 text-white bg-gradient-to-br', selectedCategory.gradient)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{selectedCategory.label}</h3>
                  <p className="text-white/70 mt-1">
                    {selectedCategory.type === 'fixed'
                      ? `${getCategoryCount(selectedCategory.key, CATEGORY_CARDS.find(c => c.key === selectedCategory.key)?.categories as any)} items`
                      : `${variableData?.categories[selectedCategory.key]?.transactions || 0} transactions`
                    }
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-3xl font-bold mt-4">
                {selectedCategory.type === 'fixed'
                  ? formatCurrency(getCategoryTotal(selectedCategory.key, CATEGORY_CARDS.find(c => c.key === selectedCategory.key)?.categories as any))
                  : formatCurrency(variableData?.categories[selectedCategory.key]?.average || 0)
                }
                {selectedCategory.type === 'variable' && <span className="text-lg font-normal text-white/70">/mo avg</span>}
              </p>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {selectedCategory.type === 'fixed' ? (
                <div className="space-y-2">
                  {getCategoryItems(selectedCategory.key, CATEGORY_CARDS.find(c => c.key === selectedCategory.key)?.categories as any).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.name}</p>
                        {item.subtitle && (
                          <p className="text-sm text-gray-500">{item.subtitle}</p>
                        )}
                        {item.extra && (
                          <p className="text-xs text-gray-400 mt-1">{item.extra}</p>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 ml-4">{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                  {getCategoryItems(selectedCategory.key, CATEGORY_CARDS.find(c => c.key === selectedCategory.key)?.categories as any).length === 0 && (
                    <p className="text-center text-gray-500 py-8">No items in this category</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Monthly breakdown for variable expenses */}
                  {variableData?.categories[selectedCategory.key] && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        {variableData.monthLabels.map((month) => {
                          const amount = variableData.categories[selectedCategory.key]?.months[month] || 0
                          const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })
                          return (
                            <div key={month} className="bg-gray-50 rounded-xl p-4 text-center">
                              <p className="text-xs text-gray-500 uppercase">{monthName}</p>
                              <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(amount)}</p>
                            </div>
                          )
                        })}
                      </div>
                      <div className="bg-gray-100 rounded-xl p-4 text-center">
                        <p className="text-sm text-gray-600">3-Month Average</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(variableData.categories[selectedCategory.key]?.average || 0)}
                        </p>
                      </div>
                    </>
                  )}
                  {!variableData?.categories[selectedCategory.key] && (
                    <p className="text-center text-gray-500 py-8">No transaction data available</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer for credit cards - upload option */}
            {selectedCategory.key === 'CREDIT_CARD' && creditAccounts.creditCards.length > 0 && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedCategory(null)
                    setShowUploadPicker(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
                >
                  <Upload className="h-4 w-4" />
                  Upload Statement for More History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{card.nickname || card.name}</p>
                    <p className="text-sm text-gray-500">{card.institutionName} •••• {card.mask}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
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
