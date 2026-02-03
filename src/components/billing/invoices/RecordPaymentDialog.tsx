'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, DollarSign, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Invoice {
  id: string
  invoiceNumber: string
  title: string
  balanceDue: number
  clientName: string
}

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  onSuccess: () => void
}

export default function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState(invoice.balanceDue.toString())
  const [method, setMethod] = useState('WIRE_TRANSFER')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (paymentAmount > invoice.balanceDue) {
      toast.error('Amount cannot exceed balance due')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/billing/invoices/${invoice.id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          method,
          reference,
          notes,
          paidAt,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment')
      }

      setSuccess(true)
      toast.success(data.message || 'Payment recorded successfully')

      setTimeout(() => {
        onSuccess()
        onOpenChange(false)
        // Reset state
        setSuccess(false)
        setAmount(invoice.balanceDue.toString())
        setMethod('WIRE_TRANSFER')
        setReference('')
        setNotes('')
      }, 1500)
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Recorded</h3>
            <p className="text-gray-500">The payment has been successfully recorded.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Invoice Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-sm text-slate-500 mb-1">{invoice.invoiceNumber}</div>
            <div className="font-medium text-slate-900">{invoice.title}</div>
            <div className="text-sm text-slate-600 mt-1">{invoice.clientName}</div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between">
              <span className="text-sm text-slate-500">Balance Due</span>
              <span className="font-semibold text-slate-900">{formatCurrency(invoice.balanceDue)}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setAmount(invoice.balanceDue.toString())}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              Pay full balance ({formatCurrency(invoice.balanceDue)})
            </button>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="method">Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WIRE_TRANSFER">Wire/Bank Transfer</SelectItem>
                <SelectItem value="E_TRANSFER">Interac e-Transfer</SelectItem>
                <SelectItem value="CHECK">Check</SelectItem>
                <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paidAt">Payment Date</Label>
            <Input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="reference">Reference / Transaction ID (optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g., Check #1234 or Transaction ID"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this payment..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
