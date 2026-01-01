'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, History, CreditCard, Building, Banknote, Wallet, DollarSign } from 'lucide-react'
import { format } from 'date-fns'

interface PaymentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoice: {
    id: string
    invoiceNumber: string
    totalAmount: number
  }
}

interface Payment {
  id: string
  amount: number
  currency: string
  method: string
  status: string
  paidAt: string | null
  confirmedAt: string | null
  confirmedBy: string | null
  createdBy: string
  checkNumber: string | null
  wireReference: string | null
  notes: string | null
  createdAt: string
}

interface PaymentSummary {
  totalAmount: number
  paidAmount: number
  balance: number
}

const methodIcons: Record<string, any> = {
  CREDIT_CARD: CreditCard,
  WIRE_TRANSFER: Building,
  CHECK: Banknote,
  ACH_BANK_TRANSFER: Building,
  CASH: Wallet,
  OTHER: DollarSign
}

const methodLabels: Record<string, string> = {
  CREDIT_CARD: 'Credit Card',
  WIRE_TRANSFER: 'Wire Transfer',
  CHECK: 'Check',
  ACH_BANK_TRANSFER: 'ACH/Bank Transfer',
  CASH: 'Cash',
  OTHER: 'Other'
}

export default function PaymentHistoryDialog({
  open,
  onOpenChange,
  projectId,
  invoice
}: PaymentHistoryDialogProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && invoice.id) {
      loadPayments()
    }
  }, [open, invoice.id])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/payment`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Payment History
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {summary && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Invoice Total</span>
                  <span>{formatCurrency(summary.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Total Paid</span>
                  <span>{formatCurrency(summary.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Balance</span>
                  <span className={summary.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {formatCurrency(summary.balance)}
                  </span>
                </div>
              </div>
            )}

            {/* Payments List */}
            <ScrollArea className="h-[300px]">
              {payments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No payments recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const MethodIcon = methodIcons[payment.method] || DollarSign
                    return (
                      <div
                        key={payment.id}
                        className="p-3 border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <MethodIcon className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium">{formatCurrency(payment.amount)}</p>
                              <p className="text-sm text-gray-500">
                                {methodLabels[payment.method] || payment.method}
                              </p>
                              {(payment.checkNumber || payment.wireReference) && (
                                <p className="text-xs text-gray-400">
                                  Ref: {payment.checkNumber || payment.wireReference}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={
                                payment.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }
                            >
                              {payment.status}
                            </Badge>
                            {payment.paidAt && (
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(payment.paidAt), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        {payment.notes && (
                          <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {payment.notes}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                          Recorded by {payment.createdBy}
                          {payment.confirmedBy && ` • Confirmed by ${payment.confirmedBy}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
