'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Bell, Mail, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    clientEmail: string
    clientName: string
    totalAmount: number
    paidAmount: number
    balance: number
    validUntil?: string | null
  }
  onSuccess: () => void
}

export default function PaymentReminderDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
  onSuccess
}: PaymentReminderDialogProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const isOverdue = invoice.validUntil && new Date(invoice.validUntil) < new Date()

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send reminder')
      }

      toast.success(`Reminder sent to ${invoice.clientEmail}`)
      setMessage('')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reminder')
    } finally {
      setSending(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOverdue ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <Bell className="w-5 h-5 text-amber-500" />
            )}
            {isOverdue ? 'Send Overdue Notice' : 'Send Payment Reminder'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Preview Header */}
          <div className={`p-4 rounded-lg ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Email will be sent to:</span>
            </div>
            <p className="text-sm">
              <span className="font-medium">{invoice.clientName}</span>
              <span className="text-gray-500"> ({invoice.clientEmail})</span>
            </p>
          </div>

          {/* Invoice Summary */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice</span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Paid</span>
                <span>-{formatCurrency(invoice.paidAmount)}</span>
              </div>
            )}
            <div className={`flex justify-between font-medium pt-2 border-t ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
              <span>{isOverdue ? 'Overdue Balance' : 'Balance Due'}</span>
              <span>{formatCurrency(invoice.balance)}</span>
            </div>
            {invoice.validUntil && (
              <div className="flex items-center gap-1 pt-2 text-xs">
                <Clock className="w-3 h-3" />
                <span className={isOverdue ? 'text-red-600' : 'text-gray-500'}>
                  {isOverdue ? 'Was due' : 'Due'}: {new Date(invoice.validUntil).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Preview of what will be sent */}
          <div className="border rounded-lg overflow-hidden">
            <div className={`p-3 text-white text-center text-sm font-medium ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`}>
              {isOverdue ? 'Payment Overdue' : 'Payment Reminder'}
            </div>
            <div className="p-4 space-y-3 text-sm bg-white">
              <p className="text-gray-700">Hi {invoice.clientName},</p>
              <p className="text-gray-700">
                This is a friendly reminder that {invoice.paidAmount > 0 ? 'a balance remains' : 'payment is pending'} on Invoice <strong>{invoice.invoiceNumber}</strong> for {invoice.title}.
              </p>
              {message && (
                <p className="text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-gray-300 italic">
                  {message}
                </p>
              )}
              <div className={`p-3 rounded ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}>
                <p className={`font-semibold text-lg ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                  {isOverdue ? 'Overdue: ' : 'Balance Due: '}{formatCurrency(invoice.balance)}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Message */}
          <div>
            <Label htmlFor="message">Add a personal message (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any additional notes or context for the client..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className={isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Send {isOverdue ? 'Overdue Notice' : 'Reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
