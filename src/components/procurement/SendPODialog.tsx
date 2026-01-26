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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Send,
  Mail,
  FileDown,
  Eye,
  Package,
  Building2,
  Truck,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface OrderItem {
  id: string
  name: string
  description?: string | null
  quantity: number
  unitType?: string | null
  unitPrice: number
  totalPrice: number
}

interface SendPODialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    id: string
    orderNumber: string
    vendorName: string
    vendorEmail?: string | null
    totalAmount: number
    subtotal?: number
    shippingCost?: number
    taxAmount?: number
    currency?: string
    shippingAddress?: string | null
    expectedDelivery?: string | null
    items: OrderItem[]
  }
  onSuccess: () => void
}

export default function SendPODialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: SendPODialogProps) {
  const [email, setEmail] = useState(order.vendorEmail || '')
  const [notes, setNotes] = useState('')
  const [shippingAddress, setShippingAddress] = useState(order.shippingAddress || '')
  const [expectedDelivery, setExpectedDelivery] = useState(
    order.expectedDelivery ? order.expectedDelivery.split('T')[0] : ''
  )
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<'send' | 'preview'>('send')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail(order.vendorEmail || '')
      setShippingAddress(order.shippingAddress || '')
      setExpectedDelivery(order.expectedDelivery ? order.expectedDelivery.split('T')[0] : '')
      setNotes('')
      setPaymentTerms('Net 30')
    }
  }, [open, order])

  // Load preview when switching to preview tab
  useEffect(() => {
    if (activeTab === 'preview' && !previewHtml) {
      loadPreview()
    }
  }, [activeTab])

  const loadPreview = async () => {
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/send`)
      if (res.ok) {
        const data = await res.json()
        setPreviewHtml(data.email?.html || null)
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter a supplier email address')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierEmail: email,
          notes,
          shippingAddress,
          expectedDelivery: expectedDelivery || undefined,
          paymentTerms
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send PO')
      }

      toast.success(`Purchase Order sent to ${email}`)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send Purchase Order')
    } finally {
      setSending(false)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/pdf`)
      if (!res.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PO-${order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF downloaded successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: order.currency || 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Send Purchase Order
          </DialogTitle>
          <DialogDescription>
            Send PO {order.orderNumber} to {order.vendorName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'send' | 'preview')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Send Email
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview ({order.items.length} items)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="flex-1 mt-4 overflow-auto">
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-blue-900">{order.orderNumber}</p>
                    <div className="flex items-center gap-2 text-sm text-blue-700 mt-1">
                      <Building2 className="w-4 h-4" />
                      {order.vendorName}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">{order.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-900">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Supplier Email */}
              <div>
                <Label htmlFor="email">Supplier Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supplier@company.com"
                />
              </div>

              {/* Shipping Address */}
              <div>
                <Label htmlFor="shippingAddress">Ship To Address</Label>
                <Textarea
                  id="shippingAddress"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter shipping address..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Expected Delivery */}
                <div>
                  <Label htmlFor="expectedDelivery" className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Expected Delivery
                  </Label>
                  <Input
                    id="expectedDelivery"
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Net 30"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes for the supplier..."
                  rows={3}
                />
              </div>

              {/* Download PDF Option */}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Or download the PO as PDF:</p>
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="w-full"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  Download PDF
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
                    <h4 className="font-medium text-sm text-gray-700 mb-3">Items in this PO</h4>
                    {order.items.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p>No items found</p>
                      </div>
                    ) : (
                      order.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 truncate">{item.description}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              {formatCurrency(item.unitPrice)} × {item.quantity}
                              {item.unitType && ` ${item.unitType}`}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold text-sm">{formatCurrency(item.totalPrice)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Totals */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{formatCurrency(order.subtotal || 0)}</span>
                    </div>
                    {(order.shippingCost || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span>{formatCurrency(order.shippingCost || 0)}</span>
                      </div>
                    )}
                    {(order.taxAmount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span>{formatCurrency(order.taxAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Total</span>
                      <span className="text-lg text-blue-600">{formatCurrency(order.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
