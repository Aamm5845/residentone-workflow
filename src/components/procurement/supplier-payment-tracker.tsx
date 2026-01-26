'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Receipt,
  Wallet,
  Banknote
} from 'lucide-react'
import { toast } from 'sonner'

interface PaymentData {
  totalAmount: number
  currency: string
  depositRequired: number
  depositPercent: number | null
  depositPaid: number
  depositPaidAt: string | null
  balanceDue: number
  balancePaidAt: string | null
  supplierPaidAt: string | null
  supplierPaymentMethod: string | null
  supplierPaymentRef: string | null
  supplierPaymentAmount: number
  supplierPaymentNotes: string | null
  savedPaymentMethod: {
    id: string
    nickname: string
    type: string
    lastFour: string
    cardBrand: string
  } | null
  paymentStatus: 'NOT_STARTED' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'OVERPAID'
  remainingBalance: number
}

interface SavedPaymentMethod {
  id: string
  nickname: string
  type: string
  cardBrand: string | null
  lastFour: string | null
}

interface SupplierPaymentTrackerProps {
  orderId: string
  orderNumber: string
  supplierName: string
  canEdit?: boolean
  onPaymentUpdate?: () => void
}

const PAYMENT_METHODS = [
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'WIRE_TRANSFER', label: 'Wire Transfer', icon: Building2 },
  { value: 'CHECK', label: 'Check', icon: Receipt },
  { value: 'ETRANSFER', label: 'E-Transfer', icon: Wallet },
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'OTHER', label: 'Other', icon: DollarSign }
]

const STATUS_CONFIG = {
  NOT_STARTED: { label: 'Not Paid', color: 'bg-gray-100 text-gray-700', icon: Clock },
  DEPOSIT_PAID: { label: 'Deposit Paid', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  FULLY_PAID: { label: 'Fully Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  OVERPAID: { label: 'Overpaid', color: 'bg-purple-100 text-purple-700', icon: AlertCircle }
}

export default function SupplierPaymentTracker({
  orderId,
  orderNumber,
  supplierName,
  canEdit = false,
  onPaymentUpdate
}: SupplierPaymentTrackerProps) {
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  // Form states
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'DEPOSIT' as 'DEPOSIT' | 'BALANCE' | 'FULL',
    amount: '',
    method: 'CREDIT_CARD',
    savedPaymentMethodId: '',
    reference: '',
    notes: '',
    paidAt: new Date().toISOString().split('T')[0]
  })
  const [depositForm, setDepositForm] = useState({
    depositRequired: '',
    depositPercent: ''
  })

  const fetchPaymentData = useCallback(async () => {
    try {
      setLoading(true)
      const [paymentRes, methodsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}/supplier-payment`),
        fetch('/api/saved-payment-methods')
      ])

      if (!paymentRes.ok) throw new Error('Failed to fetch payment data')

      const paymentData = await paymentRes.json()
      setPayment(paymentData.payment)

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json()
        setSavedMethods(methodsData.methods || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchPaymentData()
  }, [fetchPaymentData])

  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return

    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/orders/${orderId}/supplier-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentType: paymentForm.paymentType,
          method: paymentForm.method,
          savedPaymentMethodId: paymentForm.savedPaymentMethodId || null,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
          paidAt: paymentForm.paidAt
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to record payment')
      }

      toast.success('Payment recorded successfully')
      setShowPaymentForm(false)
      setPaymentForm({
        paymentType: 'DEPOSIT',
        amount: '',
        method: 'CREDIT_CARD',
        savedPaymentMethodId: '',
        reference: '',
        notes: '',
        paidAt: new Date().toISOString().split('T')[0]
      })
      fetchPaymentData()
      onPaymentUpdate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return

    const depositRequired = parseFloat(depositForm.depositRequired) || undefined
    const depositPercent = parseFloat(depositForm.depositPercent) || undefined

    if (!depositRequired && !depositPercent) {
      toast.error('Please enter a deposit amount or percentage')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/orders/${orderId}/supplier-payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depositRequired,
          depositPercent
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update deposit')
      }

      toast.success('Deposit requirements updated')
      setShowDepositForm(false)
      setDepositForm({ depositRequired: '', depositPercent: '' })
      fetchPaymentData()
      onPaymentUpdate?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update deposit')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error || 'Failed to load payment data'}</span>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[payment.paymentStatus]
  const StatusIcon = statusConfig.icon

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Supplier Payment</h3>
            <p className="text-sm text-gray-500">Track payments to {supplierName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-4 w-4" />
            {statusConfig.label}
          </span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-6">
          {/* Payment Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Total Amount</div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(payment.totalAmount, payment.currency)}
              </div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm text-yellow-700">Deposit Required</div>
              <div className="text-xl font-bold text-yellow-900">
                {formatCurrency(payment.depositRequired, payment.currency)}
                {payment.depositPercent && (
                  <span className="text-sm font-normal text-yellow-700 ml-1">
                    ({payment.depositPercent}%)
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-700">Total Paid</div>
              <div className="text-xl font-bold text-green-900">
                {formatCurrency(payment.supplierPaymentAmount, payment.currency)}
              </div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-sm text-red-700">Balance Due</div>
              <div className="text-xl font-bold text-red-900">
                {formatCurrency(payment.remainingBalance, payment.currency)}
              </div>
            </div>
          </div>

          {/* Payment Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Payment Progress</span>
              <span className="text-sm text-gray-500">
                {payment.totalAmount > 0
                  ? Math.round((payment.supplierPaymentAmount / payment.totalAmount) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  payment.paymentStatus === 'FULLY_PAID' || payment.paymentStatus === 'OVERPAID'
                    ? 'bg-green-500'
                    : payment.paymentStatus === 'DEPOSIT_PAID'
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                }`}
                style={{
                  width: `${Math.min(100, payment.totalAmount > 0
                    ? (payment.supplierPaymentAmount / payment.totalAmount) * 100
                    : 0)}%`
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Deposit: {formatCurrency(payment.depositPaid)}</span>
              <span>Balance: {formatCurrency(payment.supplierPaymentAmount - payment.depositPaid)}</span>
            </div>
          </div>

          {/* Payment Details */}
          {payment.supplierPaymentAmount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-gray-900">Payment Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {payment.depositPaidAt && (
                  <div>
                    <span className="text-gray-500">Deposit Paid:</span>
                    <span className="ml-2 text-gray-900">{formatDate(payment.depositPaidAt)}</span>
                  </div>
                )}
                {payment.balancePaidAt && (
                  <div>
                    <span className="text-gray-500">Balance Paid:</span>
                    <span className="ml-2 text-gray-900">{formatDate(payment.balancePaidAt)}</span>
                  </div>
                )}
                {payment.supplierPaymentMethod && (
                  <div>
                    <span className="text-gray-500">Method:</span>
                    <span className="ml-2 text-gray-900">{payment.supplierPaymentMethod}</span>
                  </div>
                )}
                {payment.supplierPaymentRef && (
                  <div>
                    <span className="text-gray-500">Reference:</span>
                    <span className="ml-2 text-gray-900 font-mono">{payment.supplierPaymentRef}</span>
                  </div>
                )}
              </div>
              {payment.supplierPaymentNotes && (
                <div className="text-sm">
                  <span className="text-gray-500">Notes:</span>
                  <p className="mt-1 text-gray-700">{payment.supplierPaymentNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex flex-wrap gap-3">
              {!showDepositForm && !showPaymentForm && (
                <>
                  {payment.depositRequired === 0 && (
                    <button
                      onClick={() => setShowDepositForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Receipt className="h-4 w-4" />
                      Set Deposit Requirement
                    </button>
                  )}
                  {payment.remainingBalance > 0 && (
                    <button
                      onClick={() => {
                        // Pre-fill with deposit amount if not paid
                        if (payment.depositRequired > 0 && payment.depositPaid < payment.depositRequired) {
                          setPaymentForm(prev => ({
                            ...prev,
                            paymentType: 'DEPOSIT',
                            amount: (payment.depositRequired - payment.depositPaid).toFixed(2)
                          }))
                        } else {
                          setPaymentForm(prev => ({
                            ...prev,
                            paymentType: 'BALANCE',
                            amount: payment.remainingBalance.toFixed(2)
                          }))
                        }
                        setShowPaymentForm(true)
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <DollarSign className="h-4 w-4" />
                      Record Payment
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Set Deposit Form */}
          {showDepositForm && (
            <form onSubmit={handleSetDeposit} className="bg-yellow-50 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-yellow-900">Set Deposit Requirement</h4>
              <p className="text-sm text-yellow-700">
                Define how much deposit the supplier requires before starting work.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deposit Amount ({payment.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={depositForm.depositRequired}
                    onChange={(e) => setDepositForm(prev => ({
                      ...prev,
                      depositRequired: e.target.value,
                      depositPercent: '' // Clear percent if amount is entered
                    }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Or Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={depositForm.depositPercent}
                    onChange={(e) => setDepositForm(prev => ({
                      ...prev,
                      depositPercent: e.target.value,
                      depositRequired: '' // Clear amount if percent is entered
                    }))}
                    placeholder="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>
              {depositForm.depositPercent && payment.totalAmount > 0 && (
                <p className="text-sm text-yellow-700">
                  = {formatCurrency((payment.totalAmount * parseFloat(depositForm.depositPercent)) / 100, payment.currency)}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDepositForm(false)
                    setDepositForm({ depositRequired: '', depositPercent: '' })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Set Deposit'}
                </button>
              </div>
            </form>
          )}

          {/* Record Payment Form */}
          {showPaymentForm && (
            <form onSubmit={handleRecordPayment} className="bg-emerald-50 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-emerald-900">Record Supplier Payment</h4>
              <p className="text-sm text-emerald-700">
                Record a payment made to {supplierName} for order {orderNumber}.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Payment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Type
                  </label>
                  <select
                    value={paymentForm.paymentType}
                    onChange={(e) => {
                      const type = e.target.value as 'DEPOSIT' | 'BALANCE' | 'FULL'
                      let amount = ''
                      if (type === 'DEPOSIT' && payment.depositRequired > 0) {
                        amount = Math.max(0, payment.depositRequired - payment.depositPaid).toFixed(2)
                      } else if (type === 'BALANCE') {
                        amount = payment.remainingBalance.toFixed(2)
                      } else if (type === 'FULL') {
                        amount = payment.remainingBalance.toFixed(2)
                      }
                      setPaymentForm(prev => ({ ...prev, paymentType: type, amount }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="DEPOSIT">Deposit Payment</option>
                    <option value="BALANCE">Balance Payment</option>
                    <option value="FULL">Full Payment</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ({payment.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>

                {/* Saved Payment Method (for credit card) */}
                {paymentForm.method === 'CREDIT_CARD' && savedMethods.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Saved Card
                    </label>
                    <select
                      value={paymentForm.savedPaymentMethodId}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, savedPaymentMethodId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select a card...</option>
                      {savedMethods.map(method => (
                        <option key={method.id} value={method.id}>
                          {method.nickname || method.cardBrand} ****{method.lastFour}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Payment Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.paidAt}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paidAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference / Confirmation #
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                    placeholder="e.g., Wire confirmation number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any additional notes about this payment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentForm(false)
                    setPaymentForm({
                      paymentType: 'DEPOSIT',
                      amount: '',
                      method: 'CREDIT_CARD',
                      savedPaymentMethodId: '',
                      reference: '',
                      notes: '',
                      paidAt: new Date().toISOString().split('T')[0]
                    })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
