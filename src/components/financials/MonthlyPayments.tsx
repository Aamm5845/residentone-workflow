'use client'

import { useState, useEffect, useRef } from 'react'
import {
  CreditCard,
  Landmark,
  Home,
  Car,
  Zap,
  Wifi,
  Phone,
  GraduationCap,
  Plus,
  Calendar,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Loader2,
  Shield,
  Building2,
  Users,
  Heart,
  ShoppingCart,
  Stethoscope,
  Shirt,
  Wrench,
  HomeIcon,
  Upload,
  Camera,
  Briefcase,
  Receipt,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Check,
  RefreshCw,
  Fish,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Variable expense category mapping
const VARIABLE_CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  GROCERIES: { icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100', label: 'Groceries' },
  KOSHER_FOOD: { icon: Fish, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Fish & Meat (Kosher)' },
  MEDICAL: { icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-100', label: 'Medical' },
  CLOTHING: { icon: Shirt, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Clothing' },
  CAR_SERVICE: { icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Car Service' },
}

// Bill structure - what should appear in the dashboard
// LOC and Credit Cards are now dynamically loaded from Plaid
const PERSONAL_STRUCTURE_STATIC = [
  {
    group: 'Tuition',
    icon: GraduationCap,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
    category: 'TUITION',
    items: [
      { key: 'tuition-girls', name: 'Girls Tuition', subCategory: 'Girls' },
      { key: 'tuition-boys', name: 'Boys Tuition', subCategory: 'Boys' },
      { key: 'tuition-shimily', name: 'Shimily Yeshiva', subCategory: 'Shimily' },
    ],
  },
  {
    group: 'Car',
    icon: Car,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    category: 'CAR_LEASE',
    items: [
      { key: 'car-lease', name: 'Car Lease', frequency: 'BIWEEKLY' },
    ],
  },
  {
    group: 'Subscriptions',
    icon: Zap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    category: 'SOFTWARE',
    dynamic: true, // Will load items from database
    items: [],
  },
  {
    group: 'Loans',
    icon: Landmark,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    category: 'LOAN',
    dynamic: true,
    items: [],
  },
  {
    group: 'Utilities',
    icon: Zap,
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    category: 'UTILITIES',
    dynamic: true,
    items: [],
  },
  {
    group: 'Other Bills',
    icon: Receipt,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    category: 'OTHER',
    dynamic: true,
    items: [],
  },
  {
    group: 'Phone',
    icon: Phone,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    category: 'PHONE',
    items: [
      { key: 'phone', name: 'Phone Bill' },
    ],
  },
  {
    group: 'Tzedaka',
    icon: Heart,
    color: 'text-red-500',
    bg: 'bg-red-100',
    category: 'TZEDAKA',
    items: [
      { key: 'tzedaka', name: 'Tzedaka' },
    ],
  },
  {
    group: 'Insurance',
    icon: Shield,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    items: [
      { key: 'ins-car', name: 'Car Insurance', category: 'CAR_INSURANCE' },
      { key: 'ins-home', name: 'Home Insurance', category: 'HOME_INSURANCE' },
      { key: 'ins-life', name: 'Life Insurance', category: 'LIFE_INSURANCE' },
    ],
  },
  {
    group: 'Property Tax',
    icon: Building2,
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    category: 'PROPERTY_TAX',
    items: [
      { key: 'prop-tax', name: 'Property Tax', frequency: 'YEARLY', note: '(yearly, shown monthly)' },
    ],
  },
]


const BUSINESS_STRUCTURE = [
  {
    group: 'Office Rent',
    icon: Building2,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    category: 'OFFICE_RENT',
    items: [
      { key: 'rent', name: 'Office Rent' },
    ],
  },
  {
    group: 'Payroll',
    icon: Users,
    color: 'text-green-700',
    bg: 'bg-green-100',
    category: 'PAYROLL',
    items: [
      { key: 'payroll1', name: 'Employee #1', subCategory: 'Employee 1', frequency: 'BIWEEKLY' },
      { key: 'payroll2', name: 'Employee #2', subCategory: 'Employee 2', frequency: 'BIWEEKLY' },
      { key: 'payroll3', name: 'Employee #3', subCategory: 'Employee 3', frequency: 'BIWEEKLY' },
    ],
  },
  {
    group: 'Software & Programs',
    icon: Briefcase,
    color: 'text-indigo-700',
    bg: 'bg-indigo-100',
    category: 'SOFTWARE',
    items: [
      { key: 'software', name: 'Software Subscriptions' },
    ],
  },
]

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
  yearlyMonth?: number
  isVariable: boolean
  averageAmount?: number
  payeeName?: string
  isAutoPay: boolean
  source: string
  daysUntilDue?: number
  isOverdue: boolean
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
    category: string
    confidence: string
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
  lastUpdated: string | null
  // Credit card details
  creditLimit: number | null
  interestRate: number | null
  dueDay: number | null
  minimumPayment: number | null
  lastStatementBalance: number | null
  statementStartDay: number | null
  statementEndDay: number | null
  promoRate: number | null
  promoRateExpiry: string | null
  rewardsProgram: string | null
  rewardsBalance: number | null
}

interface DetectedBill {
  name: string
  merchantName: string
  amount: number
  category: string
  frequency: string
  lastDate: string
  occurrences: number
  confidence: string
  monthlyAmounts: Record<string, number>
}

export function MonthlyPayments() {
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Lines of Credit', 'Credit Cards', 'Tuition', 'Insurance', 'Payroll']))
  const [editingItem, setEditingItem] = useState<{ key: string; bill?: Bill } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Variable expenses state
  const [variableData, setVariableData] = useState<VariableExpenseData | null>(null)
  const [isLoadingVariable, setIsLoadingVariable] = useState(false)
  const [showUnknown, setShowUnknown] = useState(false)
  const [categorizingId, setCategorizingId] = useState<string | null>(null)

  // Credit accounts from Plaid
  const [creditAccounts, setCreditAccounts] = useState<{
    creditCards: CreditAccount[]
    linesOfCredit: CreditAccount[]
  }>({ creditCards: [], linesOfCredit: [] })
  const [linkingItem, setLinkingItem] = useState<string | null>(null)

  // AI-detected recurring bills
  const [detectedBills, setDetectedBills] = useState<{
    byCategory: Record<string, DetectedBill[]>
    monthLabels: string[]
  } | null>(null)
  const [isLoadingDetected, setIsLoadingDetected] = useState(false)
  const [showDetected, setShowDetected] = useState(false)

  // Credit card detail editing
  const [editingCreditCard, setEditingCreditCard] = useState<CreditAccount | null>(null)
  const [creditCardForm, setCreditCardForm] = useState({
    nickname: '',
    creditLimit: '',
    dueDay: '',
    interestRate: '',
    statementStartDay: '',
    statementEndDay: '',
    rewardsProgram: '',
  })

  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    amount: '',
    dueDay: '',
    isAutoPay: false,
  })

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

  // Open credit card edit form
  const openCreditCardEdit = (account: CreditAccount) => {
    setEditingCreditCard(account)
    setCreditCardForm({
      nickname: account.nickname || '',
      creditLimit: account.creditLimit?.toString() || '',
      dueDay: account.dueDay?.toString() || '',
      interestRate: account.interestRate?.toString() || '',
      statementStartDay: account.statementStartDay?.toString() || '',
      statementEndDay: account.statementEndDay?.toString() || '',
      rewardsProgram: account.rewardsProgram || '',
    })
  }

  // Save credit card details
  const saveCreditCardDetails = async () => {
    if (!editingCreditCard) return
    setIsSaving(true)
    try {
      await fetch('/api/plaid/account-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: editingCreditCard.id,
          ...creditCardForm,
        }),
      })
      await fetchCreditAccounts()
      setEditingCreditCard(null)
    } catch (err) {
      console.error('Failed to save credit card details:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const fetchDetectedBills = async () => {
    setIsLoadingDetected(true)
    try {
      const res = await fetch('/api/monthly-bills/detect-recurring')
      if (res.ok) {
        const data = await res.json()
        setDetectedBills({
          byCategory: data.byCategory || {},
          monthLabels: data.monthLabels || [],
        })
      }
    } catch (err) {
      console.error('Failed to detect recurring bills:', err)
    } finally {
      setIsLoadingDetected(false)
    }
  }

  // Apply detected bill to a slot
  const applyDetectedBill = async (detected: DetectedBill, itemKey: string, category: string, subCategory?: string) => {
    setIsSaving(true)
    try {
      const existingBill = findBill(itemKey, category, subCategory)
      const url = existingBill ? `/api/monthly-bills/${existingBill.id}` : '/api/monthly-bills'
      const method = existingBill ? 'PUT' : 'POST'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detected.merchantName,
          amount: detected.amount,
          type: 'PERSONAL',
          category,
          subCategory,
          frequency: detected.frequency,
          isVariable: false,
          source: 'BANK_DETECTED',
        }),
      })

      await fetchBills()
      setEditingItem(null)
    } catch (err) {
      console.error('Failed to apply detected bill:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Link a bill to a Plaid account
  const linkToPlaidAccount = async (billKey: string, category: string, subCategory: string | undefined, plaidAccount: CreditAccount) => {
    setIsSaving(true)
    try {
      // Find existing bill or create new one
      const existingBill = findBill(billKey, category, subCategory)
      const url = existingBill ? `/api/monthly-bills/${existingBill.id}` : '/api/monthly-bills'
      const method = existingBill ? 'PUT' : 'POST'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: plaidAccount.officialName || plaidAccount.name,
          amount: plaidAccount.currentBalance,
          type: 'PERSONAL',
          category,
          subCategory,
          frequency: 'MONTHLY',
          isVariable: category === 'CREDIT_CARD', // Credit cards are variable
          bankAccountId: plaidAccount.id,
          payeeName: `${plaidAccount.institutionName} ****${plaidAccount.mask}`,
        }),
      })

      await fetchBills()
      setLinkingItem(null)
    } catch (err) {
      console.error('Failed to link account:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const categorizeTransaction = async (transactionId: string, category: string) => {
    setCategorizingId(transactionId)
    try {
      await fetch('/api/monthly-bills/variable-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorizations: [{ transactionId, category }],
        }),
      })
      // Refresh the data
      await fetchVariableExpenses()
    } catch (err) {
      console.error('Failed to categorize:', err)
    } finally {
      setCategorizingId(null)
    }
  }

  useEffect(() => {
    fetchBills()
    fetchVariableExpenses()
    fetchCreditAccounts()
    fetchDetectedBills()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // Find bill by matching key/category/subCategory
  const findBill = (key: string, category: string, subCategory?: string): Bill | undefined => {
    return bills.find((b) => {
      if (subCategory) {
        return b.category === category && b.subCategory === subCategory
      }
      return b.category === category && !b.subCategory
    })
  }

  const handleEditClick = (key: string, category: string, subCategory?: string, defaultName?: string, defaultFrequency?: string) => {
    const existingBill = findBill(key, category, subCategory)
    setEditingItem({ key, bill: existingBill })
    setEditForm({
      name: existingBill?.name || defaultName || '',
      amount: existingBill?.amount?.toString() || '',
      dueDay: existingBill?.dueDay?.toString() || '',
      isAutoPay: existingBill?.isAutoPay || false,
    })
  }

  const handleSave = async (category: string, subCategory?: string, frequency?: string, isVariable?: boolean) => {
    if (!editingItem) return
    setIsSaving(true)

    try {
      const existingBill = editingItem.bill
      const url = existingBill ? `/api/monthly-bills/${existingBill.id}` : '/api/monthly-bills'
      const method = existingBill ? 'PUT' : 'POST'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          amount: parseFloat(editForm.amount) || 0,
          averageAmount: isVariable ? (parseFloat(editForm.amount) || 0) : undefined,
          dueDay: editForm.dueDay ? parseInt(editForm.dueDay) : null,
          isAutoPay: editForm.isAutoPay,
          type: activeTab,
          category,
          subCategory,
          frequency: frequency || 'MONTHLY',
          isVariable: isVariable || false,
        }),
      })

      await fetchBills()
      setEditingItem(null)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (billId: string) => {
    if (!confirm('Remove this bill?')) return
    try {
      await fetch(`/api/monthly-bills/${billId}`, { method: 'DELETE' })
      await fetchBills()
      setEditingItem(null)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  // Calculate totals
  const personalBills = bills.filter((b) => b.type === 'PERSONAL')
  const businessBills = bills.filter((b) => b.type === 'BUSINESS')
  const personalTotal = personalBills.reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)
  const businessTotal = businessBills.reduce((sum, b) => sum + (b.monthlyAmount || b.amount), 0)

  // Build dynamic structure with actual Plaid accounts
  const PERSONAL_STRUCTURE = [
    // Lines of Credit - from Plaid
    ...(creditAccounts.linesOfCredit.length > 0 ? [{
      group: 'Lines of Credit',
      icon: Landmark,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      category: 'LINE_OF_CREDIT',
      description: 'Fixed monthly payment',
      fromPlaid: true,
      items: creditAccounts.linesOfCredit.map((acc, idx) => ({
        key: `loc-${acc.id}`,
        name: `${acc.institutionName} ****${acc.mask}`,
        subCategory: acc.id,
        plaidAccount: acc,
        balance: acc.currentBalance,
      })),
    }] : []),
    // Credit Cards - from Plaid
    ...(creditAccounts.creditCards.length > 0 ? [{
      group: 'Credit Cards',
      icon: CreditCard,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      category: 'CREDIT_CARD',
      description: 'Current balance from bank',
      fromPlaid: true,
      linkedToPlaid: true,
      items: creditAccounts.creditCards.map((acc, idx) => ({
        key: `cc-${acc.id}`,
        name: `${acc.institutionName} ****${acc.mask}`,
        subCategory: acc.id,
        plaidAccount: acc,
        balance: acc.currentBalance,
      })),
    }] : []),
    // Rest of static structure - but populate dynamic sections from bills
    ...PERSONAL_STRUCTURE_STATIC.map((section) => {
      if ((section as any).dynamic) {
        // Populate items from bills database for dynamic sections
        const sectionBills = personalBills.filter((b) => b.category === section.category)
        return {
          ...section,
          items: sectionBills.map((bill) => ({
            key: `${section.category.toLowerCase()}-${bill.id}`,
            name: bill.name,
            subCategory: bill.subCategory || bill.id,
            billId: bill.id,
          })),
        }
      }
      return section
    }),
  ]

  const structure = activeTab === 'PERSONAL' ? PERSONAL_STRUCTURE : BUSINESS_STRUCTURE

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="h-7 w-7 text-blue-600" />
          Monthly Bills
        </h1>
        <p className="text-gray-500 mt-1">Click on any item to set the amount</p>
      </div>

      {/* AI-Detected Recurring Bills */}
      {detectedBills && Object.keys(detectedBills.byCategory).length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowDetected(!showDetected)}
            className="w-full bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between hover:from-purple-100 hover:to-blue-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">AI Detected Your Bills</h3>
                <p className="text-sm text-gray-500">
                  Found {Object.values(detectedBills.byCategory).flat().length} recurring payments in your transactions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-600 font-medium">
                {showDetected ? 'Hide' : 'Show details'}
              </span>
              {showDetected ? <ChevronDown className="h-5 w-5 text-purple-400" /> : <ChevronRight className="h-5 w-5 text-purple-400" />}
            </div>
          </button>

          {showDetected && (
            <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Month labels */}
              {detectedBills.monthLabels.length > 0 && (
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-4 text-sm text-gray-500 border-b border-gray-100">
                  <span className="flex-1">Detected Bill</span>
                  {detectedBills.monthLabels.map((month) => (
                    <span key={month} className="w-20 text-center">
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  ))}
                  <span className="w-20 text-right">Average</span>
                  <span className="w-24"></span>
                </div>
              )}

              {Object.entries(detectedBills.byCategory).map(([category, bills]) => (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                    {category.replace(/_/g, ' ')}
                  </div>
                  {bills.map((bill, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{bill.merchantName}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded',
                            bill.confidence === 'high' ? 'bg-green-100 text-green-700' :
                            bill.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {bill.confidence} confidence
                          </span>
                          <span>{bill.frequency.toLowerCase()}</span>
                          <span>{bill.occurrences} charges found</span>
                        </div>
                      </div>

                      {/* Monthly amounts */}
                      {detectedBills.monthLabels.map((month) => (
                        <div key={month} className="w-20 text-center">
                          {bill.monthlyAmounts[month] ? (
                            <span className="text-sm text-gray-700">
                              {formatCurrency(bill.monthlyAmounts[month])}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </div>
                      ))}

                      {/* Average */}
                      <div className="w-20 text-right font-bold text-gray-900">
                        {formatCurrency(bill.amount)}
                      </div>

                      {/* Action */}
                      <div className="w-24">
                        <button
                          onClick={() => {
                            // Find matching structure item and apply
                            const structure = PERSONAL_STRUCTURE.find(s => s.category === bill.category)
                            if (structure && structure.items.length > 0) {
                              const item = structure.items[0]
                              applyDetectedBill(bill, item.key, bill.category, item.subCategory)
                            }
                          }}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <Sparkles className="h-4 w-4 inline mr-1" />
                  AI analyzed your transaction history to find these recurring bills
                </p>
                <button
                  onClick={fetchDetectedBills}
                  disabled={isLoadingDetected}
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <RefreshCw className={cn('h-4 w-4', isLoadingDetected && 'animate-spin')} />
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state for detected bills */}
      {isLoadingDetected && !detectedBills && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
          <span className="text-purple-700">Analyzing your transactions to detect recurring bills...</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('PERSONAL')}
          className={cn(
            'flex-1 py-4 px-6 rounded-xl font-semibold transition-all',
            activeTab === 'PERSONAL'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Home className="h-5 w-5" />
            <span>Personal</span>
          </div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(personalTotal)}</p>
        </button>
        <button
          onClick={() => setActiveTab('BUSINESS')}
          className={cn(
            'flex-1 py-4 px-6 rounded-xl font-semibold transition-all',
            activeTab === 'BUSINESS'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Briefcase className="h-5 w-5" />
            <span>Business</span>
          </div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(businessTotal)}</p>
        </button>
      </div>

      {/* Bills Structure */}
      <div className="space-y-3">
        {structure.map((section) => {
          const Icon = section.icon
          const isExpanded = expandedGroups.has(section.group)

          // Calculate section total - use Plaid balance for linked accounts
          const sectionTotal = section.items.reduce((sum, item) => {
            // If item has a Plaid balance, use that
            if ((item as any).balance !== undefined) {
              return sum + (item as any).balance
            }
            const cat = (item as any).category || section.category
            const bill = findBill(item.key, cat, item.subCategory)
            return sum + (bill?.monthlyAmount || bill?.amount || 0)
          }, 0)

          return (
            <div key={section.group} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleGroup(section.group)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', section.bg)}>
                    <Icon className={cn('h-5 w-5', section.color)} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{section.group}</h3>
                    <p className="text-sm text-gray-500">
                      {section.items.length} item{section.items.length !== 1 ? 's' : ''}
                      {(section as any).description && (
                        <span className="text-gray-400"> • {(section as any).description}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(section as any).fromPlaid && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Live</span>
                  )}
                  <p className="font-bold text-gray-900">
                    {sectionTotal > 0 ? formatCurrency(sectionTotal) : '—'}
                    {sectionTotal > 0 && <span className="text-gray-400 font-normal text-sm">{section.category === 'CREDIT_CARD' ? ' owed' : '/mo'}</span>}
                  </p>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100">
                  {section.items.map((item) => {
                    const itemCategory = (item as any).category || section.category
                    const bill = findBill(item.key, itemCategory, item.subCategory)
                    const isEditing = editingItem?.key === item.key

                    return (
                      <div
                        key={item.key}
                        className={cn(
                          'px-4 py-3 border-b border-gray-50 last:border-b-0',
                          isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'
                        )}
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            {/* Link to Plaid option for Credit Cards */}
                            {(section as any).linkedToPlaid && creditAccounts.creditCards.length > 0 && (
                              <div className="bg-purple-50 rounded-lg p-3 mb-2">
                                <p className="text-sm font-medium text-purple-800 mb-2">
                                  Link to bank account (auto-updates balance):
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {creditAccounts.creditCards.map((acc) => (
                                    <button
                                      key={acc.id}
                                      onClick={() => linkToPlaidAccount(item.key, itemCategory, item.subCategory, acc)}
                                      disabled={isSaving}
                                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-lg text-sm hover:bg-purple-100 flex items-center gap-2"
                                    >
                                      <CreditCard className="h-3 w-3 text-purple-500" />
                                      <span>{acc.institutionName} ****{acc.mask}</span>
                                      <span className="text-purple-600 font-medium">{formatCurrency(acc.currentBalance)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Link to Plaid option for Lines of Credit */}
                            {section.category === 'LINE_OF_CREDIT' && creditAccounts.linesOfCredit.length > 0 && (
                              <div className="bg-blue-50 rounded-lg p-3 mb-2">
                                <p className="text-sm font-medium text-blue-800 mb-2">
                                  Link to bank account:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {creditAccounts.linesOfCredit.map((acc) => (
                                    <button
                                      key={acc.id}
                                      onClick={() => linkToPlaidAccount(item.key, itemCategory, item.subCategory, acc)}
                                      disabled={isSaving}
                                      className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm hover:bg-blue-100 flex items-center gap-2"
                                    >
                                      <Landmark className="h-3 w-3 text-blue-500" />
                                      <span>{acc.institutionName} ****{acc.mask}</span>
                                      <span className="text-blue-600 font-medium">{formatCurrency(acc.currentBalance)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-gray-500">Or enter manually:</p>
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Name"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                              <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                  type="number"
                                  value={editForm.amount}
                                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                  placeholder="0"
                                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500">Due day:</span>
                                  <select
                                    value={editForm.dueDay}
                                    onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">—</option>
                                    {Array.from({ length: 31 }, (_, i) => (
                                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                                    ))}
                                  </select>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={editForm.isAutoPay}
                                    onChange={(e) => setEditForm({ ...editForm, isAutoPay: e.target.checked })}
                                    className="rounded"
                                  />
                                  Auto-pay
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                {bill && (
                                  <button
                                    onClick={() => handleDelete(bill.id)}
                                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                                  >
                                    Remove
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSave(itemCategory, item.subCategory, (item as any).frequency)}
                                  disabled={isSaving}
                                  className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (item as any).plaidAccount ? (
                          // Enhanced display for Plaid-linked credit cards
                          editingCreditCard?.id === (item as any).plaidAccount.id ? (
                            // Edit form for credit card details
                            <div className="space-y-3 bg-purple-50 -mx-4 -my-3 p-4 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-purple-900">Edit Credit Card Details</p>
                                <button onClick={() => setEditingCreditCard(null)} className="text-gray-400 hover:text-gray-600">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Nickname</label>
                                  <input
                                    type="text"
                                    value={creditCardForm.nickname}
                                    onChange={(e) => setCreditCardForm({ ...creditCardForm, nickname: e.target.value })}
                                    placeholder="e.g., Aeroplan Card"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Rewards Program</label>
                                  <input
                                    type="text"
                                    value={creditCardForm.rewardsProgram}
                                    onChange={(e) => setCreditCardForm({ ...creditCardForm, rewardsProgram: e.target.value })}
                                    placeholder="e.g., Aeroplan, Cash Back"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Credit Limit</label>
                                  <input
                                    type="number"
                                    value={creditCardForm.creditLimit}
                                    onChange={(e) => setCreditCardForm({ ...creditCardForm, creditLimit: e.target.value })}
                                    placeholder="26000"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Due Day (1-31)</label>
                                  <input
                                    type="number"
                                    value={creditCardForm.dueDay}
                                    onChange={(e) => setCreditCardForm({ ...creditCardForm, dueDay: e.target.value })}
                                    placeholder="6"
                                    min="1"
                                    max="31"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Interest Rate (APR %)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={creditCardForm.interestRate}
                                    onChange={(e) => setCreditCardForm({ ...creditCardForm, interestRate: e.target.value })}
                                    placeholder="19.99"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-500 block mb-1">Cycle Start</label>
                                    <input
                                      type="number"
                                      value={creditCardForm.statementStartDay}
                                      onChange={(e) => setCreditCardForm({ ...creditCardForm, statementStartDay: e.target.value })}
                                      placeholder="11"
                                      min="1"
                                      max="31"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-xs text-gray-500 block mb-1">Cycle End</label>
                                    <input
                                      type="number"
                                      value={creditCardForm.statementEndDay}
                                      onChange={(e) => setCreditCardForm({ ...creditCardForm, statementEndDay: e.target.value })}
                                      placeholder="12"
                                      min="1"
                                      max="31"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-3">
                                <button
                                  onClick={() => setEditingCreditCard(null)}
                                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveCreditCardDetails}
                                  disabled={isSaving}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                                >
                                  {isSaving ? 'Saving...' : 'Save Details'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Display mode
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {(item as any).plaidAccount.dueDay ? (
                                    <div className="w-10 h-10 rounded-full bg-purple-100 flex flex-col items-center justify-center">
                                      <span className="text-[10px] text-purple-600 -mb-0.5">Due</span>
                                      <span className="text-sm font-bold text-purple-700">{(item as any).plaidAccount.dueDay}</span>
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                      <Calendar className="h-4 w-4 text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {(item as any).plaidAccount.nickname || item.name}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Live from bank
                                      </span>
                                      {(item as any).plaidAccount.rewardsProgram && (
                                        <span className="text-xs text-purple-600">{(item as any).plaidAccount.rewardsProgram}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="font-bold text-gray-900 text-lg">{formatCurrency((item as any).balance)}</p>
                                    <p className="text-xs text-gray-500">balance</p>
                                  </div>
                                  <button
                                    onClick={() => openCreditCardEdit((item as any).plaidAccount)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                    title="Edit details"
                                  >
                                    <Edit2 className="h-4 w-4 text-gray-400" />
                                  </button>
                                </div>
                              </div>
                              {/* Credit card details row */}
                              <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2 -mx-1">
                                {(item as any).plaidAccount.creditLimit ? (
                                  <div>
                                    <span className="text-gray-400">Limit:</span>{' '}
                                    <span className="font-medium text-gray-700">{formatCurrency((item as any).plaidAccount.creditLimit)}</span>
                                  </div>
                                ) : null}
                                {(item as any).plaidAccount.availableBalance > 0 && (
                                  <div>
                                    <span className="text-gray-400">Available:</span>{' '}
                                    <span className="font-medium text-green-600">{formatCurrency((item as any).plaidAccount.availableBalance)}</span>
                                  </div>
                                )}
                                {(item as any).plaidAccount.minimumPayment && (item as any).plaidAccount.minimumPayment > 0 ? (
                                  <div>
                                    <span className="text-gray-400">Min:</span>{' '}
                                    <span className="font-medium text-orange-600">{formatCurrency((item as any).plaidAccount.minimumPayment)}</span>
                                  </div>
                                ) : null}
                                {(item as any).plaidAccount.interestRate ? (
                                  <div>
                                    <span className="text-gray-400">APR:</span>{' '}
                                    <span className="font-medium text-gray-700">{(item as any).plaidAccount.interestRate}%</span>
                                  </div>
                                ) : null}
                                {(item as any).plaidAccount.lastStatementBalance ? (
                                  <div>
                                    <span className="text-gray-400">Last stmt:</span>{' '}
                                    <span className="font-medium text-gray-700">{formatCurrency((item as any).plaidAccount.lastStatementBalance)}</span>
                                  </div>
                                ) : null}
                                {!(item as any).plaidAccount.creditLimit && !(item as any).plaidAccount.dueDay && (
                                  <span className="text-gray-400 italic">Click edit to add details from your statement</span>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          // Regular display for non-Plaid items
                          <div
                            onClick={() => handleEditClick(item.key, itemCategory, item.subCategory, item.name, (item as any).frequency)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {bill?.dueDay && (
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                  {bill.dueDay}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">
                                  {bill?.name || item.name}
                                  {(item as any).note && <span className="text-gray-400 text-sm ml-1">{(item as any).note}</span>}
                                </p>
                                <div className="flex items-center gap-2">
                                  {bill?.payeeName && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      {bill.payeeName}
                                    </span>
                                  )}
                                  {bill?.isAutoPay && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Auto-pay</span>
                                  )}
                                  {(item as any).frequency === 'BIWEEKLY' && (
                                    <span className="text-xs text-gray-500">Bi-weekly</span>
                                  )}
                                  {(item as any).frequency === 'YEARLY' && (
                                    <span className="text-xs text-gray-500">Yearly</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {bill ? (
                                <p className="font-bold text-gray-900">{formatCurrency(bill.amount)}</p>
                              ) : (
                                <p className="text-gray-400 italic">Click to set amount</p>
                              )}
                              <Edit2 className="h-4 w-4 text-gray-300" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Variable Expenses - Personal Only (AI-Powered) */}
        {activeTab === 'PERSONAL' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-500" />
                Variable Expenses
                <span className="text-xs font-normal text-gray-400 ml-1">(3-month analysis)</span>
              </h2>
              <button
                onClick={fetchVariableExpenses}
                disabled={isLoadingVariable}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
              >
                <RefreshCw className={cn('h-4 w-4', isLoadingVariable && 'animate-spin')} />
                Refresh
              </button>
            </div>

            {isLoadingVariable ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2 text-sm">Analyzing transactions...</p>
              </div>
            ) : variableData ? (
              <div className="space-y-3">
                {/* Month labels header */}
                {variableData.monthLabels.length > 0 && (
                  <div className="bg-gray-50 rounded-lg px-4 py-2 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex-1">Category</span>
                    {variableData.monthLabels.map((month) => (
                      <span key={month} className="w-20 text-center">
                        {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    ))}
                    <span className="w-24 text-right font-medium">3-mo Avg</span>
                  </div>
                )}

                {/* Category rows */}
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {Object.entries(VARIABLE_CATEGORY_CONFIG).map(([catKey, config]) => {
                    const data = variableData.categories[catKey]
                    const Icon = config.icon

                    return (
                      <div key={catKey} className="px-4 py-3 flex items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn('p-2 rounded-lg', config.bg)}>
                            <Icon className={cn('h-4 w-4', config.color)} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{config.label}</p>
                            {data && (
                              <p className="text-xs text-gray-400">{data.transactions} transactions</p>
                            )}
                          </div>
                        </div>

                        {/* Monthly amounts */}
                        {variableData.monthLabels.map((month) => (
                          <div key={month} className="w-20 text-center">
                            {data?.months[month] ? (
                              <span className="text-sm text-gray-700">
                                {formatCurrency(data.months[month])}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </div>
                        ))}

                        {/* Average */}
                        <div className="w-24 text-right">
                          {data ? (
                            <span className="font-bold text-gray-900">
                              {formatCurrency(data.average)}
                              <span className="text-gray-400 font-normal text-xs">/mo</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">No data</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                {Object.keys(variableData.categories).length > 0 && (
                  <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="font-medium text-gray-700">Total Variable Expenses</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(
                        Object.values(variableData.categories).reduce((sum, cat) => sum + cat.average, 0)
                      )}
                      <span className="text-gray-400 font-normal text-sm">/mo avg</span>
                    </span>
                  </div>
                )}

                {/* Unknown transactions that need categorization */}
                {variableData.unknownTransactions.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowUnknown(!showUnknown)}
                      className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 mb-2"
                    >
                      <AlertCircle className="h-4 w-4" />
                      {variableData.unknownTransactions.length} transactions need your help to categorize
                      {showUnknown ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {showUnknown && (
                      <div className="bg-amber-50 rounded-xl border border-amber-200 divide-y divide-amber-100">
                        {variableData.unknownTransactions.map((txn) => (
                          <div key={txn.transactionId} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{txn.merchantName || txn.name}</p>
                                <p className="text-sm text-gray-500">
                                  {formatCurrency(txn.amount)} • {new Date(txn.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs text-gray-500 mr-2 self-center">Categorize as:</span>
                              {Object.entries(VARIABLE_CATEGORY_CONFIG).map(([catKey, config]) => (
                                <button
                                  key={catKey}
                                  onClick={() => categorizeTransaction(txn.transactionId, catKey)}
                                  disabled={categorizingId === txn.transactionId}
                                  className={cn(
                                    'px-2 py-1 rounded text-xs font-medium border transition-colors',
                                    'hover:bg-white',
                                    config.bg,
                                    config.color,
                                    'border-transparent hover:border-gray-200'
                                  )}
                                >
                                  {categorizingId === txn.transactionId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    config.label
                                  )}
                                </button>
                              ))}
                              <button
                                onClick={() => categorizeTransaction(txn.transactionId, 'SKIP')}
                                disabled={categorizingId === txn.transactionId}
                                className="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Info about data source */}
                <p className="text-xs text-gray-400 text-center mt-2">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  AI analyzed {variableData.totalTransactionsAnalyzed} transactions from your connected accounts
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto text-gray-300" />
                <p className="text-gray-500 mt-2">Connect your bank accounts to see spending analysis</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Total */}
      <div className={cn(
        'mt-6 rounded-xl p-6 text-white',
        activeTab === 'PERSONAL' ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-700'
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Total Monthly</p>
            <p className="text-3xl font-bold">{formatCurrency(activeTab === 'PERSONAL' ? personalTotal : businessTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/80 text-sm">Yearly</p>
            <p className="text-xl font-bold">{formatCurrency((activeTab === 'PERSONAL' ? personalTotal : businessTotal) * 12)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
