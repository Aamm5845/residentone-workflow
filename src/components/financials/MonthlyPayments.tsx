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
  Edit2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Shield,
  Building2,
  Heart,
  ShoppingCart,
  Stethoscope,
  Shirt,
  Wrench,
  Upload,
  Briefcase,
  Receipt,
  Sparkles,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Fish,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatementUploadDialog } from './StatementUploadDialog'

// Variable expense category mapping
const VARIABLE_CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  GROCERIES: { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100', label: 'Groceries' },
  MEAT: { icon: ShoppingCart, color: 'text-red-600', bg: 'bg-red-100', label: 'Meat' },
  FISH: { icon: Fish, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Fish' },
  GAS: { icon: Car, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Gas' },
  MEDICAL: { icon: Stethoscope, color: 'text-pink-600', bg: 'bg-pink-100', label: 'Medical' },
  CLOTHING: { icon: Shirt, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Clothing' },
  CAR_SERVICE: { icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Car Service' },
}

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
  unknownTransactions: {
    transactionId: string
    name: string
    merchantName: string | null
    amount: number
    date: string
  }[]
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

export function MonthlyPayments() {
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL')
  const [variableData, setVariableData] = useState<VariableExpenseData | null>(null)
  const [isLoadingVariable, setIsLoadingVariable] = useState(false)
  const [creditAccounts, setCreditAccounts] = useState<{
    creditCards: CreditAccount[]
    linesOfCredit: CreditAccount[]
  }>({ creditCards: [], linesOfCredit: [] })
  const [uploadingAccount, setUploadingAccount] = useState<CreditAccount | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

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

  // Calculate totals
  const personalBills = bills.filter((b) => b.type === 'PERSONAL')
  const businessBills = bills.filter((b) => b.type === 'BUSINESS')
  const creditCardTotal = creditAccounts.creditCards.reduce((sum, c) => sum + c.currentBalance, 0)
  const locTotal = creditAccounts.linesOfCredit.reduce((sum, c) => sum + c.currentBalance, 0)
  const billsTotal = personalBills.reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)
  const variableTotal = variableData
    ? Object.values(variableData.categories).reduce((sum, cat) => sum + cat.average, 0)
    : 0

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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Monthly Bills</h1>
        <p className="text-gray-500 mt-1">Overview of your recurring expenses</p>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Credit Cards</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(creditCardTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{creditAccounts.creditCards.length} cards</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Landmark className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Lines of Credit</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(locTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{creditAccounts.linesOfCredit.length} accounts</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Fixed Bills</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(billsTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{personalBills.length} bills/mo</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Variable</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(variableTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">3-mo average</p>
        </div>
      </div>

      {/* Credit Cards Section */}
      {creditAccounts.creditCards.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Credit Cards</h2>
            <span className="text-sm text-gray-500">{formatCurrency(creditCardTotal)} total</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {creditAccounts.creditCards.map((card) => (
              <div
                key={card.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white relative overflow-hidden"
              >
                {/* Card chip decoration */}
                <div className="absolute top-5 right-5 w-10 h-8 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md opacity-80" />

                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-white/60 text-sm">{card.institutionName}</p>
                    <p className="font-medium mt-0.5">{card.nickname || card.name}</p>
                  </div>
                  <button
                    onClick={() => setUploadingAccount(card)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Upload statement"
                  >
                    <Upload className="h-4 w-4 text-white/60" />
                  </button>
                </div>

                <p className="text-2xl font-bold mb-1">{formatCurrency(card.currentBalance)}</p>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-white/60 text-sm">•••• {card.mask}</p>
                  {card.dueDay && (
                    <p className="text-white/60 text-sm">Due: {card.dueDay}th</p>
                  )}
                </div>

                {card.creditLimit && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Used</span>
                      <span>{Math.round((card.currentBalance / card.creditLimit) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/80 rounded-full"
                        style={{ width: `${Math.min((card.currentBalance / card.creditLimit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lines of Credit Section */}
      {creditAccounts.linesOfCredit.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Lines of Credit</h2>
            <span className="text-sm text-gray-500">{formatCurrency(locTotal)} total</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {creditAccounts.linesOfCredit.map((loc) => (
              <div
                key={loc.id}
                className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-sm">{loc.institutionName}</p>
                    <p className="font-medium mt-0.5">{loc.nickname || loc.name}</p>
                  </div>
                  <Landmark className="h-5 w-5 text-white/40" />
                </div>

                <p className="text-2xl font-bold mb-1">{formatCurrency(loc.currentBalance)}</p>
                <p className="text-white/60 text-sm">•••• {loc.mask}</p>

                {loc.creditLimit && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>Available</span>
                      <span>{formatCurrency(loc.creditLimit - loc.currentBalance)}</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/80 rounded-full"
                        style={{ width: `${Math.min((loc.currentBalance / loc.creditLimit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed Bills Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Fixed Monthly Bills</h2>
          <span className="text-sm text-gray-500">{formatCurrency(billsTotal)}/mo</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            { key: 'TUITION', label: 'Tuition', icon: GraduationCap, color: 'text-rose-600', bg: 'bg-rose-100' },
            { key: 'CAR_LEASE', label: 'Car Lease', icon: Car, color: 'text-orange-600', bg: 'bg-orange-100' },
            { key: 'SOFTWARE', label: 'Subscriptions', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-100' },
            { key: 'LOAN', label: 'Loans', icon: Landmark, color: 'text-amber-600', bg: 'bg-amber-100' },
            { key: 'UTILITIES', label: 'Utilities', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100' },
            { key: 'PHONE', label: 'Phone', icon: Phone, color: 'text-slate-600', bg: 'bg-slate-100' },
            { key: 'TZEDAKA', label: 'Tzedaka', icon: Heart, color: 'text-red-500', bg: 'bg-red-100' },
            { key: 'CAR_INSURANCE', label: 'Car Insurance', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { key: 'HOME_INSURANCE', label: 'Home Insurance', icon: Home, color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { key: 'LIFE_INSURANCE', label: 'Life Insurance', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-100' },
            { key: 'PROPERTY_TAX', label: 'Property Tax', icon: Building2, color: 'text-blue-700', bg: 'bg-blue-100' },
          ].map((category) => {
            const categoryBills = personalBills.filter(b => b.category === category.key)
            const categoryTotal = categoryBills.reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)
            const Icon = category.icon
            const isExpanded = expandedSection === category.key

            if (categoryBills.length === 0 && categoryTotal === 0) return null

            return (
              <div key={category.key} className="border-b border-gray-50 last:border-b-0">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : category.key)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl', category.bg)}>
                      <Icon className={cn('h-4 w-4', category.color)} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{category.label}</p>
                      {categoryBills.length > 1 && (
                        <p className="text-xs text-gray-400">{categoryBills.length} items</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-gray-900">{formatCurrency(categoryTotal)}</p>
                    {categoryBills.length > 1 && (
                      isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && categoryBills.length > 1 && (
                  <div className="px-5 pb-4 pl-16 space-y-2">
                    {categoryBills.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{bill.name}</span>
                        <span className="text-gray-900">{formatCurrency(bill.monthlyAmount || bill.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Variable Expenses Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Variable Expenses</h2>
          <button
            onClick={fetchVariableExpenses}
            disabled={isLoadingVariable}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className={cn('h-4 w-4', isLoadingVariable && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {isLoadingVariable ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : variableData ? (
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(VARIABLE_CATEGORY_CONFIG).map(([catKey, config]) => {
              const data = variableData.categories[catKey]
              const Icon = config.icon

              return (
                <div key={catKey} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('p-1.5 rounded-lg', config.bg)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {data ? formatCurrency(data.average) : '$0'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {data ? `${data.transactions} transactions` : 'No data'}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <ShoppingCart className="h-8 w-8 mx-auto text-gray-300" />
            <p className="text-gray-500 mt-2">Connect bank accounts to see spending</p>
          </div>
        )}
      </div>

      {/* Total Footer */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Total Monthly Expenses</p>
            <p className="text-3xl font-bold mt-1">
              {formatCurrency(billsTotal + variableTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Annual</p>
            <p className="text-xl font-semibold mt-1">
              {formatCurrency((billsTotal + variableTotal) * 12)}
            </p>
          </div>
        </div>
      </div>

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
