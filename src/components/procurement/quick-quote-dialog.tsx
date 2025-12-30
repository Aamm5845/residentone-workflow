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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Loader2,
  Send,
  AlertCircle,
  CheckCircle,
  Package,
  User,
  Mail,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  Building2,
  Eye,
  MapPin,
  FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import AddressPicker from '@/components/shipping/AddressPicker'

interface QuickQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId: string
  itemIds: string[]
}

interface ItemInfo {
  id: string
  name: string
  description?: string
  supplierName?: string
  brand?: string
  quantity?: number
  unitType?: string
  images?: string[]
  thumbnailUrl?: string
  specStatus?: string
  roomName?: string
  sectionName?: string
  notes?: string
  hasDocuments?: boolean
}

interface SupplierInfo {
  id: string
  name: string
  email: string
  contactName?: string
  logo?: string
}

interface SupplierGroup {
  key: string
  supplier: SupplierInfo | null
  supplierName: string
  items: Array<{
    item: ItemInfo
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
  availableSuppliers: SupplierInfo[]
  summary: {
    totalItems: number
    readyToSend: number
    alreadySent: number
    noSupplier: number
  }
}

export default function QuickQuoteDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  itemIds
}: QuickQuoteDialogProps) {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [message, setMessage] = useState('')
  const [responseDeadline, setResponseDeadline] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toISOString().split('T')[0]
  })

  // Track supplier overrides per item
  const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string>>({})
  // Track items to resend (override already sent)
  const [resendItems, setResendItems] = useState<Set<string>>(new Set())
  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  // Include spec sheet/documents in quote request
  const [includeSpecSheet, setIncludeSpecSheet] = useState(true)
  // Include notes in quote request
  const [includeNotes, setIncludeNotes] = useState(true)
  // Custom shipping address
  const [useCustomShipping, setUseCustomShipping] = useState(false)
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada'
  })
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (open && itemIds.length > 0) {
      loadPreview()
    } else {
      setPreview(null)
      setSupplierOverrides({})
      setResendItems(new Set())
      setExpandedGroups(new Set())
      setUseCustomShipping(false)
      setShippingAddress({ street: '', city: '', province: '', postalCode: '', country: 'Canada' })
    }
  }, [open, itemIds])

  const loadPreview = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rfq/supplier-quote?projectId=${projectId}&itemIds=${itemIds.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        setPreview(data)
        // Expand all groups by default
        setExpandedGroups(new Set(data.supplierGroups?.map((g: SupplierGroup) => g.key) || []))

        // Auto-enable resend for already-sent items when ALL items are already sent
        // This handles the "Resend Quote Request" action from 3-dot menu
        const allItems = data.supplierGroups?.flatMap((g: SupplierGroup) => g.items) || []
        const allAlreadySent = allItems.length > 0 && allItems.every((i: { alreadySent: boolean }) => i.alreadySent)
        if (allAlreadySent) {
          // Pre-populate resendItems with all item IDs so they can be resent
          setResendItems(new Set(allItems.map((i: { item: ItemInfo }) => i.item.id)))
        }
      } else {
        toast.error('Failed to load quote preview')
      }
    } catch (error) {
      console.error('Error loading preview:', error)
      toast.error('Failed to load quote preview')
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

  const handlePreview = async () => {
    if (!preview) return

    setPreviewLoading(true)
    try {
      // Get the first supplier from the groups
      const firstGroup = preview.supplierGroups.find(g => g.supplier)
      const supplierId = firstGroup?.supplier?.id

      const res = await fetch('/api/rfq/supplier-quote/preview-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          itemIds,
          supplierId,
          shippingAddress: useCustomShipping ? shippingAddress : undefined,
          message: message || undefined
        })
      })

      const data = await res.json()

      if (res.ok && data.success && data.emailHtml) {
        // Open email preview in new tab
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(data.emailHtml)
          newWindow.document.close()
          toast.success('Email preview opened')
        } else {
          toast.error('Please allow popups to view the email preview')
        }
      } else {
        toast.error(data.error || 'Failed to create email preview')
      }
    } catch (error) {
      console.error('Error creating preview:', error)
      toast.error('Failed to create email preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSend = async () => {
    if (!preview) return

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
      toast.error('No items to send. All items have already been sent for quotes.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/rfq/supplier-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          items: itemsToSend,
          message: message || undefined,
          responseDeadline,
          includeSpecSheet,
          includeNotes,
          shippingAddress: useCustomShipping ? shippingAddress : undefined
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success(`Quote requests sent successfully to ${data.sent} supplier(s)!`, {
          duration: 4000
        })
        // Brief delay so user sees success message before dialog closes
        setTimeout(() => {
          onOpenChange(false)
          onSuccess()
        }, 800)
      } else if (data.needsConfirmation) {
        toast.error('All items have already been sent. Enable resend to send again.')
      } else {
        toast.error(data.error || 'Failed to send quote requests')
      }
    } catch (error) {
      console.error('Error sending quote:', error)
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Request Quotes
          </DialogTitle>
          <DialogDescription>
            {loading ? 'Loading...' : `Send quote requests for ${itemIds.length} item(s)`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : preview ? (
          <>
            {/* Resend Warning Banner */}
            {resendItems.size > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                <RefreshCw className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Resending quote request{resendItems.size > 1 ? 's' : ''}</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    {resendItems.size} item{resendItems.size > 1 ? 's have' : ' has'} already been sent for quotes.
                    The supplier will receive a new email with the same request.
                  </p>
                </div>
              </div>
            )}

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
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>{totals.suppliers}</strong> suppliers
                  </span>
                </div>
              </div>
              {preview.summary.alreadySent > 0 && resendItems.size === 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {preview.summary.alreadySent} already sent
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
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
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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
                                alreadySent && !resendItems.has(item.id) && "bg-gray-50 opacity-70"
                              )}
                            >
                              {/* Image */}
                              <div className="w-12 h-12 relative flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border">
                                {item.thumbnailUrl || item.images?.[0] ? (
                                  <img
                                    src={item.thumbnailUrl || item.images![0]}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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
                                  <span className="font-medium text-gray-900 truncate text-sm">
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
                                {alreadySent && (
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
                                )}
                                {/* Supplier selector - always available for price comparison */}
                                {(!alreadySent || resendItems.has(item.id)) && (
                                  <Select
                                    value={supplierOverrides[item.id] || group.supplier?.id || ''}
                                    onValueChange={(v) => handleSupplierChange(item.id, v)}
                                  >
                                    <SelectTrigger className={cn(
                                      "h-8 text-xs",
                                      isUnmatched ? "w-[160px]" : "w-[140px]"
                                    )}>
                                      <SelectValue placeholder="Select supplier...">
                                        {(() => {
                                          const selectedId = supplierOverrides[item.id] || group.supplier?.id
                                          const selected = preview.availableSuppliers.find(s => s.id === selectedId)
                                          return selected ? selected.name : 'Select...'
                                        })()}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {preview.availableSuppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                          <div className="flex items-center gap-2">
                                            <span>{s.name}</span>
                                            {s.id === group.supplier?.id && !supplierOverrides[item.id] && (
                                              <Badge variant="secondary" className="text-[10px] py-0 px-1">Current</Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
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
                    placeholder="Add any special instructions or notes for suppliers..."
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

                {/* Include Spec Sheet & Notes - only show if applicable */}
                {(() => {
                  const allItems = preview?.supplierGroups.flatMap(g => g.items.map(i => i.item)) || []
                  const itemsWithDocs = allItems.filter(item => {
                    const docs = (item as any).documents || []
                    return docs.length > 0
                  })
                  const anyHasSpecs = itemsWithDocs.length > 0 || allItems.some(item =>
                    item.specStatus === 'COMPLETE' || item.specStatus === 'APPROVED'
                  )
                  const anyHasNotes = allItems.some(item => item.notes && item.notes.trim().length > 0)

                  return (
                    <>
                      {anyHasSpecs && (
                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <Checkbox
                            id="includeSpecSheet"
                            checked={includeSpecSheet}
                            onCheckedChange={(checked) => setIncludeSpecSheet(checked === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="includeSpecSheet" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                              <FileText className="w-4 h-4 text-purple-600" />
                              Include spec sheets & attachments
                              {itemsWithDocs.length > 0 && (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                                  {itemsWithDocs.length} {itemsWithDocs.length === 1 ? 'item' : 'items'} with docs
                                </Badge>
                              )}
                            </Label>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Supplier will be able to download spec sheets and documents from the portal
                            </p>
                          </div>
                        </div>
                      )}

                      {anyHasNotes && (
                        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <Checkbox
                            id="includeNotes"
                            checked={includeNotes}
                            onCheckedChange={(checked) => setIncludeNotes(checked === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="includeNotes" className="text-sm font-medium cursor-pointer">
                              Include item notes
                            </Label>
                            <p className="text-xs text-gray-500">
                              Supplier will see any notes or special requirements for each item
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Custom Shipping Address */}
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="useCustomShipping"
                      checked={useCustomShipping}
                      onCheckedChange={(checked) => setUseCustomShipping(checked === true)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="useCustomShipping" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Use custom shipping address
                      </Label>
                      <p className="text-xs text-gray-500">
                        Select from saved addresses or enter a new one
                      </p>
                    </div>
                  </div>

                  {useCustomShipping && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <AddressPicker
                        value={shippingAddress}
                        onChange={(addr) => setShippingAddress({ ...addr, country: addr.country || 'Canada' })}
                        showSavedAddresses={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 mr-auto">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewLoading || loading}
                  className="gap-2"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      View Email
                    </>
                  )}
                </Button>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || totals.toSend === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to {totals.suppliers} Supplier{totals.suppliers !== 1 ? 's' : ''}
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
