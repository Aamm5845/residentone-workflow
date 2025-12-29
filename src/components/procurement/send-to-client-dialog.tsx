'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2, Send, Mail, Calendar, Package, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { calculateQuebecTaxes, formatCurrency, QUEBEC_TAX_RATES } from '@/lib/tax-utils'

interface SendToClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (quoteId: string) => void
  projectId: string
  itemIds: string[]
}

interface SpecItem {
  id: string
  name: string
  description?: string
  category?: string
  quantity: number
  unitType?: string
  roomName?: string
  rrp?: number | null
  unitCost?: number | null
  tradePrice?: number | null
  brand?: string
  supplierName?: string
}

interface ProjectClient {
  id: string
  name: string
  email: string
  phone?: string
}

export default function SendToClientDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  itemIds
}: SendToClientDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Data
  const [items, setItems] = useState<SpecItem[]>([])
  const [client, setClient] = useState<ProjectClient | null>(null)
  const [projectName, setProjectName] = useState('')

  // Form fields
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [note, setNote] = useState('')
  const [validDays, setValidDays] = useState(30)

  // Tax rates (from org settings)
  const [gstRate, setGstRate] = useState(QUEBEC_TAX_RATES.GST)
  const [qstRate, setQstRate] = useState(QUEBEC_TAX_RATES.QST)

  // Fetch items and project info when dialog opens
  useEffect(() => {
    if (open && itemIds.length > 0) {
      fetchData()
    }
  }, [open, itemIds])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSent(false)
      setNote('')
      setValidDays(30)
    }
  }, [open])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch project info with client
      const projectRes = await fetch(`/api/projects/${projectId}`)
      if (projectRes.ok) {
        const projectData = await projectRes.json()
        setProjectName(projectData.project?.name || projectData.name || '')
        if (projectData.project?.client || projectData.client) {
          const projectClient = projectData.project?.client || projectData.client
          setClient(projectClient)
          setClientEmail(projectClient.email || '')
          setClientName(projectClient.name || '')
        }
      }

      // Fetch organization settings for tax rates
      const orgRes = await fetch('/api/settings/organization')
      if (orgRes.ok) {
        const orgData = await orgRes.json()
        if (orgData.organization) {
          setGstRate(Number(orgData.organization.defaultGstRate) || QUEBEC_TAX_RATES.GST)
          setQstRate(Number(orgData.organization.defaultQstRate) || QUEBEC_TAX_RATES.QST)
        }
      }

      // Fetch FFE specs for this project to get item details
      const specsRes = await fetch(`/api/projects/${projectId}/ffe-specs`)
      if (specsRes.ok) {
        const specsData = await specsRes.json()
        // Filter items by the provided itemIds
        const allItems: SpecItem[] = []

        if (specsData.rooms) {
          for (const room of specsData.rooms) {
            for (const section of room.sections || []) {
              for (const item of section.items || []) {
                if (itemIds.includes(item.id)) {
                  allItems.push({
                    ...item,
                    roomName: room.name,
                    category: section.name
                  })
                }
              }
            }
          }
        }

        setItems(allItems)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load item data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate pricing
  const pricing = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const price = item.rrp || item.unitCost || item.tradePrice || 0
      return sum + (Number(price) * item.quantity)
    }, 0)

    return calculateQuebecTaxes(subtotal, gstRate, qstRate)
  }, [items, gstRate, qstRate])

  // Calculate valid until date
  const validUntilDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + validDays)
    return date
  }, [validDays])

  const handleSend = async () => {
    if (!clientEmail) {
      toast.error('Please enter a client email')
      return
    }

    if (items.length === 0) {
      toast.error('No items selected')
      return
    }

    setSending(true)
    try {
      // Create the client quote and send email
      const response = await fetch('/api/client-quotes/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          itemIds: items.map(i => i.id),
          clientEmail,
          clientName,
          note,
          validUntil: validUntilDate.toISOString(),
          gstRate,
          qstRate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send quote')
      }

      const data = await response.json()
      setSent(true)
      toast.success('Quote sent to client!')

      // Delay closing to show success state
      setTimeout(() => {
        onSuccess(data.quoteId)
        onOpenChange(false)
      }, 1500)
    } catch (error) {
      console.error('Error sending quote:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send quote')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Quote to Client
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Quote Sent!</h3>
              <p className="text-sm text-gray-500 mt-1">
                An email has been sent to {clientEmail}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Items Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {items.length} Item{items.length !== 1 ? 's' : ''} Selected
                  </span>
                </div>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {items.slice(0, 5).map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate flex-1">{item.name}</span>
                        <span className="text-gray-900 ml-2">
                          {formatCurrency(Number(item.rrp || item.unitCost || item.tradePrice || 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div className="text-sm text-gray-500 italic">
                        + {items.length - 5} more items
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Client Email */}
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="clientEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Client Name */}
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              {/* Quote Validity */}
              <div className="space-y-2">
                <Label htmlFor="validDays">Quote Valid For</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <Input
                    id="validDays"
                    type="number"
                    value={validDays}
                    onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
                    className="w-20"
                    min={1}
                    max={365}
                  />
                  <span className="text-sm text-gray-500">days</span>
                  <span className="text-sm text-gray-400 ml-auto">
                    (Until {validUntilDate.toLocaleDateString()})
                  </span>
                </div>
              </div>

              {/* Note to Client */}
              <div className="space-y-2">
                <Label htmlFor="note">Note to Client (optional)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={2}
                />
              </div>

              <Separator />

              {/* Pricing Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(pricing.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST ({gstRate}%)</span>
                  <span className="text-gray-900">{formatCurrency(pricing.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">QST ({qstRate}%)</span>
                  <span className="text-gray-900">{formatCurrency(pricing.qstAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatCurrency(pricing.total)}</span>
                </div>
              </div>

              {/* Payment Options Info */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Client will be able to pay via Credit Card (+3% fee), Wire Transfer, Check, or Cash.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !clientEmail}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Quote
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
