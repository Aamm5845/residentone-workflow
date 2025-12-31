'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Package,
  Mail,
  Building2,
  Eye,
  Calendar,
  Users
} from 'lucide-react'

interface SelectedItem {
  id: string
  name: string
  description?: string
  brand?: string
  sku?: string
  quantity?: number
  unitType?: string
  supplierName?: string
  images?: string[]
  tradePrice?: number
  roomName?: string
  sectionName?: string
}

interface Supplier {
  id: string
  name: string
  email: string
  contactName?: string
  logo?: string
}

interface SupplierGroup {
  key: string
  supplier: Supplier | null
  supplierName: string
  items: Array<{
    item: SelectedItem
    alreadySent: boolean
    previousRequest?: {
      sentAt: string
      status: string
    }
  }>
}

interface PreviewData {
  project: { id: string; name: string }
  supplierGroups: SupplierGroup[]
  availableSuppliers: Supplier[]
  summary: {
    totalItems: number
    readyToSend: number
    alreadySent: number
    noSupplier: number
  }
}

interface BulkQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  selectedItems: SelectedItem[]
  onSuccess?: () => void
}

export function BulkQuoteDialog({
  open,
  onOpenChange,
  projectId,
  selectedItems,
  onSuccess
}: BulkQuoteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [message, setMessage] = useState('')
  const [responseDeadline, setResponseDeadline] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toISOString().split('T')[0]
  })

  // Item-supplier overrides
  const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string>>({})
  // Items to resend (override already sent)
  const [resendItems, setResendItems] = useState<Set<string>>(new Set())
  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  // Show email preview
  const [showEmailPreview, setShowEmailPreview] = useState(false)

  // Load preview when dialog opens
  useEffect(() => {
    if (open && selectedItems.length > 0) {
      loadPreview()
    } else {
      setPreview(null)
      setSupplierOverrides({})
      setResendItems(new Set())
      setExpandedGroups(new Set())
    }
  }, [open, selectedItems])

  const loadPreview = async () => {
    setLoading(true)
    try {
      const itemIds = selectedItems.map(i => i.id).join(',')
      const res = await fetch(`/api/rfq/supplier-quote?projectId=${projectId}&itemIds=${itemIds}`)

      if (res.ok) {
        const data = await res.json()
        setPreview(data)
        // Expand all groups by default
        setExpandedGroups(new Set(data.supplierGroups.map((g: SupplierGroup) => g.key)))
      } else {
        toast.error('Failed to load preview')
      }
    } catch (error) {
      console.error('Failed to load preview:', error)
      toast.error('Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const handleSupplierChange = (itemId: string, supplierId: string) => {
    setSupplierOverrides(prev => ({
      ...prev,
      [itemId]: supplierId
    }))
  }

  const toggleResend = (itemId: string) => {
    setResendItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!preview) return

    setSending(true)
    try {
      // Build items array with overrides
      const itemsToSend = preview.supplierGroups.flatMap(group =>
        group.items
          .filter(({ item, alreadySent }) => !alreadySent || resendItems.has(item.id))
          .map(({ item }) => ({
            id: item.id,
            supplierId: supplierOverrides[item.id] || group.supplier?.id,
            supplierName: item.supplierName,
            overrideSupplier: resendItems.has(item.id)
          }))
      )

      if (itemsToSend.length === 0) {
        toast.error('No items to send. All items have already been sent.')
        return
      }

      const res = await fetch('/api/rfq/supplier-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          items: itemsToSend,
          message: message || undefined,
          responseDeadline
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`Quote requests sent to ${data.sent} supplier(s)!`)
        onOpenChange(false)
        onSuccess?.()
      } else if (data.needsConfirmation) {
        toast.warning('All items have already been sent. Enable resend to send again.')
      } else {
        toast.error(data.error || 'Failed to send quote requests')
      }
    } catch (error) {
      console.error('Failed to send:', error)
      toast.error('Failed to send quote requests')
    } finally {
      setSending(false)
    }
  }

  // Calculate totals
  const totals = preview ? {
    toSend: preview.supplierGroups.reduce((acc, g) =>
      acc + g.items.filter(i => !i.alreadySent || resendItems.has(i.item.id)).length, 0
    ),
    suppliers: new Set(
      preview.supplierGroups
        .filter(g => g.items.some(i => !i.alreadySent || resendItems.has(i.item.id)))
        .map(g => g.supplier?.id || g.supplierName)
    ).size
  } : { toSend: 0, suppliers: 0 }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Send Quote Requests
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : preview ? (
          <>
            {/* Summary Bar */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>{totals.toSend}</strong> items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>{totals.suppliers}</strong> suppliers
                  </span>
                </div>
              </div>
              {preview.summary.alreadySent > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {preview.summary.alreadySent} already sent
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 -mx-6 px-6" style={{ maxHeight: 'calc(90vh - 280px)' }}>
              <div className="space-y-4 py-2">
                {/* Supplier Groups */}
                {preview.supplierGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.key)
                  const itemsToSend = group.items.filter(i => !i.alreadySent || resendItems.has(i.item.id))
                  const hasItemsToSend = itemsToSend.length > 0
                  const isUnmatched = group.key.startsWith('unmatched:')

                  return (
                    <div
                      key={group.key}
                      className={cn(
                        "border rounded-lg overflow-hidden",
                        !hasItemsToSend && "opacity-60",
                        isUnmatched && "border-amber-200 bg-amber-50/50"
                      )}
                    >
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {group.supplier?.logo ? (
                            <img
                              src={group.supplier.logo}
                              alt={group.supplierName}
                              className="w-10 h-10 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold",
                              isUnmatched
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            )}>
                              {group.supplierName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {group.supplierName}
                              </span>
                              {isUnmatched && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                                  No match
                                </Badge>
                              )}
                            </div>
                            {group.supplier?.email && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Mail className="w-3 h-3" />
                                {group.supplier.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {group.items.length} item{group.items.length > 1 ? 's' : ''}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Items */}
                      {isExpanded && (
                        <div className="border-t bg-white">
                          {group.items.map(({ item, alreadySent, previousRequest }) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-3 p-3 border-b last:border-b-0",
                                alreadySent && !resendItems.has(item.id) && "bg-gray-50"
                              )}
                            >
                              {/* Image */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border flex-shrink-0">
                                {item.images?.[0] ? (
                                  <img
                                    src={item.images[0]}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 truncate">
                                    {item.name}
                                  </span>
                                  {item.brand && (
                                    <span className="text-xs text-gray-500">
                                      {item.brand}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {item.quantity || 1} {item.unitType || 'units'}
                                  {item.roomName && ` • ${item.roomName}`}
                                </div>
                              </div>

                              {/* Status / Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {alreadySent ? (
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        resendItems.has(item.id)
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-gray-100 text-gray-600 border-gray-200"
                                      )}
                                    >
                                      {resendItems.has(item.id) ? 'Will resend' : 'Already sent'}
                                    </Badge>
                                    <button
                                      onClick={() => toggleResend(item.id)}
                                      className={cn(
                                        "p-1.5 rounded-md transition-colors",
                                        resendItems.has(item.id)
                                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                          : "hover:bg-gray-100 text-gray-500"
                                      )}
                                      title={resendItems.has(item.id) ? 'Cancel resend' : 'Resend'}
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : isUnmatched ? (
                                  <Select
                                    value={supplierOverrides[item.id] || ''}
                                    onValueChange={(v) => handleSupplierChange(item.id, v)}
                                  >
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                      <SelectValue placeholder="Select supplier..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {preview.availableSuppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                          <div className="flex items-center gap-2">
                                            {s.logo ? (
                                              <img src={s.logo} className="w-5 h-5 rounded" />
                                            ) : (
                                              <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-xs">
                                                {s.name.charAt(0)}
                                              </div>
                                            )}
                                            <span>{s.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Ready
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Message */}
                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-medium">
                    Message to suppliers (optional)
                  </Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a note or special instructions for suppliers..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Deadline */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Response deadline
                  </Label>
                  <input
                    type="date"
                    value={responseDeadline}
                    onChange={(e) => setResponseDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || totals.toSend === 0}
                className="gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to {totals.suppliers} Supplier{totals.suppliers > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Select items to request quotes</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
