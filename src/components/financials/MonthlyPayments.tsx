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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Bill structure - what should appear in the dashboard
const PERSONAL_STRUCTURE = [
  {
    group: 'Lines of Credit',
    icon: Landmark,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    category: 'LINE_OF_CREDIT',
    items: [
      { key: 'loc1', name: 'Line of Credit #1', subCategory: 'LOC 1' },
      { key: 'loc2', name: 'Line of Credit #2', subCategory: 'LOC 2' },
      { key: 'loc3', name: 'Line of Credit #3', subCategory: 'LOC 3' },
    ],
  },
  {
    group: 'Credit Cards',
    icon: CreditCard,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    category: 'CREDIT_CARD',
    items: [
      { key: 'cc1', name: 'Credit Card #1', subCategory: 'Card 1' },
      { key: 'cc2', name: 'Credit Card #2', subCategory: 'Card 2' },
      { key: 'cc3', name: 'Credit Card #3', subCategory: 'Card 3' },
      { key: 'cc4', name: 'Credit Card #4', subCategory: 'Card 4' },
      { key: 'cc5', name: 'Credit Card #5', subCategory: 'Card 5' },
      { key: 'cc6', name: 'Credit Card #6', subCategory: 'Card 6' },
    ],
  },
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

const PERSONAL_VARIABLE = [
  { key: 'groceries', name: 'Groceries', icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100', category: 'GROCERIES' },
  { key: 'kosher', name: 'Fish & Meat (Kosher)', icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-100', category: 'KOSHER_FOOD' },
  { key: 'medical', name: 'Medical', icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-100', category: 'MEDICAL' },
  { key: 'clothing', name: 'Clothing', icon: Shirt, color: 'text-violet-600', bg: 'bg-violet-100', category: 'CLOTHING' },
  { key: 'car-service', name: 'Car Service', icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-100', category: 'CAR_SERVICE' },
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

export function MonthlyPayments() {
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Lines of Credit', 'Credit Cards', 'Tuition', 'Insurance', 'Payroll']))
  const [editingItem, setEditingItem] = useState<{ key: string; bill?: Bill } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  useEffect(() => {
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

          // Calculate section total
          const sectionTotal = section.items.reduce((sum, item) => {
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
                    <p className="text-sm text-gray-500">{section.items.length} item{section.items.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-gray-900">
                    {sectionTotal > 0 ? formatCurrency(sectionTotal) : '—'}
                    {sectionTotal > 0 && <span className="text-gray-400 font-normal text-sm">/mo</span>}
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
                        ) : (
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

        {/* Variable Expenses - Personal Only */}
        {activeTab === 'PERSONAL' && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gray-500" />
              Variable Expenses (Monthly Averages)
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {PERSONAL_VARIABLE.map((item) => {
                const bill = bills.find((b) => b.category === item.category && b.isVariable)
                const Icon = item.icon
                const isEditing = editingItem?.key === item.key

                return (
                  <div
                    key={item.key}
                    className={cn('px-4 py-3', isEditing ? 'bg-blue-50' : 'hover:bg-gray-50')}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', item.bg)}>
                          <Icon className={cn('h-4 w-4', item.color)} />
                        </div>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={editForm.amount}
                            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                            placeholder="0"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(item.category, undefined, 'MONTHLY', true)}
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingItem({ key: item.key, bill })
                          setEditForm({
                            name: bill?.name || item.name,
                            amount: bill?.averageAmount?.toString() || bill?.amount?.toString() || '',
                            dueDay: '',
                            isAutoPay: false,
                          })
                        }}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', item.bg)}>
                            <Icon className={cn('h-4 w-4', item.color)} />
                          </div>
                          <p className="font-medium text-gray-900">{bill?.name || item.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {bill ? (
                            <p className="font-bold text-gray-600">{formatCurrency(bill.averageAmount || bill.amount)}<span className="text-gray-400 font-normal text-sm">/mo avg</span></p>
                          ) : (
                            <p className="text-gray-400 italic">Click to set average</p>
                          )}
                          <Edit2 className="h-4 w-4 text-gray-300" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
