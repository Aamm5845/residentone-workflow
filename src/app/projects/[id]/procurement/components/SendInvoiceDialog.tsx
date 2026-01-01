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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Mail, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface SendInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    clientName: string
    clientEmail: string
    totalAmount: number
    accessToken: string
  }
  onSuccess: () => void
}

export default function SendInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
  onSuccess
}: SendInvoiceDialogProps) {
  const [email, setEmail] = useState(invoice.clientEmail || '')
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber} - ${invoice.title}`)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const invoiceLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/client/invoice/${invoice.accessToken}`

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject,
          message
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send invoice')
      }

      toast.success(`Invoice sent to ${email}`)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(invoiceLink)
    toast.success('Invoice link copied to clipboard')
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
            <Send className="w-5 h-5" />
            Send Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Summary */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-gray-500">{invoice.title}</p>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(invoice.totalAmount)}</p>
            </div>
          </div>

          {/* Email Form */}
          <div>
            <Label htmlFor="email">Send to *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="message">Personal Message (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the email..."
              rows={3}
            />
          </div>

          {/* Alternative: Share Link */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500 mb-2">Or share the invoice link directly:</p>
            <div className="flex gap-2">
              <Input
                value={invoiceLink}
                readOnly
                className="text-sm bg-gray-50"
              />
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(invoiceLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
