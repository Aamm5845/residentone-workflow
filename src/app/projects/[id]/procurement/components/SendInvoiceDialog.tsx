'use client'

import { useState, useEffect } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Send, Mail, Copy, ExternalLink, Eye, Package } from 'lucide-react'
import { toast } from 'sonner'

interface LineItem {
  id: string
  displayName: string
  displayDescription?: string
  quantity: number
  clientUnitPrice: number
  clientTotalPrice: number
  roomFFEItem?: {
    images?: string[]
    brand?: string
    modelNumber?: string
  }
}

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
    subtotal?: number
    gstAmount?: number
    qstAmount?: number
    accessToken: string
    items?: { name: string; quantity: number; total: number }[]
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
  const [activeTab, setActiveTab] = useState<'send' | 'preview'>('send')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [invoiceDetails, setInvoiceDetails] = useState<{
    subtotal: number
    gstAmount: number
    qstAmount: number
    totalAmount: number
  } | null>(null)

  const invoiceLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/client/invoice/${invoice.accessToken}`

  // Fetch line items when dialog opens
  useEffect(() => {
    if (open && invoice.id) {
      fetchLineItems()
    }
  }, [open, invoice.id])

  const fetchLineItems = async () => {
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}`)
      if (res.ok) {
        const data = await res.json()
        setLineItems(data.lineItems || [])
        setInvoiceDetails({
          subtotal: data.subtotal || 0,
          gstAmount: data.gstAmount || 0,
          qstAmount: data.qstAmount || 0,
          totalAmount: data.totalAmount || invoice.totalAmount
        })
      }
    } catch (error) {
      console.error('Error fetching line items:', error)
    } finally {
      setLoadingPreview(false)
    }
  }

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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Invoice to Client
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'send' | 'preview')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Send Email
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview ({lineItems.length} items)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="flex-1 mt-4 space-y-4">
            {/* Invoice Summary */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-gray-500">{invoice.title}</p>
                  <p className="text-xs text-gray-400 mt-1">To: {invoice.clientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatCurrency(invoice.totalAmount)}</p>
                  <p className="text-xs text-gray-500">{lineItems.length} items</p>
                </div>
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
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-4 min-h-0">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Items Preview */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="p-4 space-y-3">
                    <h4 className="font-medium text-sm text-gray-700 mb-3">Items in this Invoice</h4>
                    {lineItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p>No items found</p>
                      </div>
                    ) : (
                      lineItems.map((item) => {
                        const imageUrl = item.roomFFEItem?.images?.[0]
                        return (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {/* Image */}
                            <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                                  📦
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.displayName}</p>
                              {item.roomFFEItem?.brand && (
                                <p className="text-xs text-gray-500">{item.roomFFEItem.brand}</p>
                              )}
                              <p className="text-xs text-gray-400">
                                {formatCurrency(item.clientUnitPrice)} × {item.quantity}
                              </p>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCurrency(item.clientTotalPrice)}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* Totals */}
                {invoiceDetails && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span>{formatCurrency(invoiceDetails.subtotal)}</span>
                      </div>
                      {invoiceDetails.gstAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">GST (5%)</span>
                          <span>{formatCurrency(invoiceDetails.gstAmount)}</span>
                        </div>
                      )}
                      {invoiceDetails.qstAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">QST (9.975%)</span>
                          <span>{formatCurrency(invoiceDetails.qstAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t font-semibold">
                        <span>Total</span>
                        <span className="text-lg">{formatCurrency(invoiceDetails.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
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
