'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  DollarSign,
  Building2
} from 'lucide-react'
import { toast } from 'sonner'

interface RequestChargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    id: string
    orderNumber: string
    vendorName: string
    vendorEmail?: string
    totalAmount: number
    depositRequired: number
    depositPaid: number
    supplierPaymentAmount: number
    currency: string
  }
  onSuccess: () => void
}

type ChargeType = 'REMAINING' | 'NEXT_MILESTONE' | 'CUSTOM'

export default function RequestChargeDialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: RequestChargeDialogProps) {
  const [chargeType, setChargeType] = useState<ChargeType>('REMAINING')
  const [customAmount, setCustomAmount] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const remaining = order.totalAmount - order.supplierPaymentAmount
  const depositRemaining = order.depositRequired > 0
    ? order.depositRequired - order.depositPaid
    : 0
  const hasUnpaidDeposit = depositRemaining > 0

  // Calculate next milestone amount
  const nextMilestoneAmount = hasUnpaidDeposit
    ? depositRemaining
    : remaining
  const nextMilestoneLabel = hasUnpaidDeposit
    ? 'Deposit Payment'
    : 'Balance Payment'

  // Get the display amount for current selection
  const getSelectedAmount = () => {
    switch (chargeType) {
      case 'REMAINING':
        return remaining
      case 'NEXT_MILESTONE':
        return nextMilestoneAmount
      case 'CUSTOM':
        return parseFloat(customAmount) || 0
    }
  }

  useEffect(() => {
    if (open) {
      setChargeType('REMAINING')
      setCustomAmount('')
      setSupplierEmail(order.vendorEmail || '')
      setMessage('')
    }
  }, [open, order.vendorEmail])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: order.currency || 'CAD'
    }).format(amount)
  }

  const handleSend = async () => {
    if (!supplierEmail.trim()) {
      toast.error('Please enter a supplier email address')
      return
    }

    if (chargeType === 'CUSTOM') {
      const amt = parseFloat(customAmount)
      if (!amt || amt <= 0) {
        toast.error('Please enter a valid amount')
        return
      }
      if (amt > remaining) {
        toast.error(`Amount cannot exceed remaining balance of ${formatCurrency(remaining)}`)
        return
      }
    }

    setSending(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/request-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeType,
          customAmount: chargeType === 'CUSTOM' ? parseFloat(customAmount) : undefined,
          supplierEmail: supplierEmail.trim(),
          message: message.trim() || undefined,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send charge request')
      }

      const data = await res.json()
      toast.success(`Charge request for ${formatCurrency(data.requestedAmount)} sent to ${supplierEmail}`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send charge request')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            Request Charge
          </DialogTitle>
          <DialogDescription>
            Send a payment request to the supplier for {order.orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Summary */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-blue-900 text-sm">{order.orderNumber}</p>
                <div className="flex items-center gap-1.5 text-sm text-blue-700 mt-0.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {order.vendorName}
                </div>
              </div>
              <p className="font-bold text-blue-900">{formatCurrency(order.totalAmount)}</p>
            </div>
          </div>

          {/* Payment Status */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase">Total</p>
              <p className="font-semibold text-sm">{formatCurrency(order.totalAmount)}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-[10px] text-green-600 uppercase">Paid</p>
              <p className="font-semibold text-sm text-green-700">{formatCurrency(order.supplierPaymentAmount)}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <p className="text-[10px] text-amber-600 uppercase">Remaining</p>
              <p className="font-semibold text-sm text-amber-700">{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* Charge Type Selection */}
          <div className="space-y-2">
            <Label>Charge Amount</Label>
            <div className="space-y-2">
              {/* Remaining Balance */}
              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  chargeType === 'REMAINING'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chargeType"
                    value="REMAINING"
                    checked={chargeType === 'REMAINING'}
                    onChange={() => setChargeType('REMAINING')}
                    className="accent-amber-600"
                  />
                  <span className="text-sm font-medium">Remaining Balance</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(remaining)}</span>
              </label>

              {/* Next Milestone */}
              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  chargeType === 'NEXT_MILESTONE'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chargeType"
                    value="NEXT_MILESTONE"
                    checked={chargeType === 'NEXT_MILESTONE'}
                    onChange={() => setChargeType('NEXT_MILESTONE')}
                    className="accent-amber-600"
                  />
                  <div>
                    <span className="text-sm font-medium">Next Milestone</span>
                    <p className="text-xs text-gray-500">{nextMilestoneLabel}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(nextMilestoneAmount)}</span>
              </label>

              {/* Custom Amount */}
              <label
                className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                  chargeType === 'CUSTOM'
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chargeType"
                    value="CUSTOM"
                    checked={chargeType === 'CUSTOM'}
                    onChange={() => setChargeType('CUSTOM')}
                    className="accent-amber-600"
                  />
                  <span className="text-sm font-medium">Custom Amount</span>
                </div>
                {chargeType === 'CUSTOM' && (
                  <div className="mt-2 ml-6">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remaining}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Max: {formatCurrency(remaining)}
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Supplier Email */}
          <div className="space-y-2">
            <Label htmlFor="chargeEmail">Supplier Email</Label>
            <Input
              id="chargeEmail"
              type="email"
              value={supplierEmail}
              onChange={(e) => setSupplierEmail(e.target.value)}
              placeholder="supplier@company.com"
            />
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="chargeMessage">Message (optional)</Label>
            <Textarea
              id="chargeMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any additional instructions for the supplier..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !supplierEmail.trim() || (chargeType === 'CUSTOM' && (!customAmount || parseFloat(customAmount) <= 0))}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4 mr-2" />
            )}
            Send Request ({formatCurrency(getSelectedAmount())})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
