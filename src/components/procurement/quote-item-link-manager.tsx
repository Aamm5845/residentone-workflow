'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  Link as LinkIcon,
  Unlink,
  Package,
  Clock,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface QuoteInfo {
  id: string
  unitPrice: number | null
  totalPrice: number | null
  leadTime: string | null
  leadTimeWeeks: number | null
  availability: string | null
  supplierName: string | null
  supplierId: string | null
  quoteId: string | null
  quoteStatus: string | null
  isAccepted?: boolean
  isCurrent?: boolean
}

interface ItemWithQuotes {
  id: string
  name: string
  description: string | null
  quantity: number
  unitType: string | null
  images: string[]
  supplierName: string | null
  currentQuote: QuoteInfo | null
  availableQuotes: QuoteInfo[]
}

interface QuoteItemLinkManagerProps {
  projectId: string
  items: Array<{
    id: string
    name: string
    description?: string | null
    quantity: number
    unitType?: string | null
    images?: string[]
    supplierName?: string | null
    acceptedQuoteLineItemId?: string | null
    acceptedQuoteLineItem?: {
      id: string
      unitPrice: any
      totalPrice: any
      leadTime?: string | null
      supplierQuote?: {
        supplier?: {
          name: string
        }
      }
    } | null
  }>
  onUpdate?: () => void
}

export default function QuoteItemLinkManager({
  projectId,
  items,
  onUpdate
}: QuoteItemLinkManagerProps) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [itemDetails, setItemDetails] = useState<ItemWithQuotes | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '—'
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(Number(amount))
  }

  const fetchItemDetails = useCallback(async (itemId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/items/${itemId}/quote-link`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch item details')
      }
      const data = await res.json()
      setItemDetails(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch item details')
      setSelectedItem(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (selectedItem) {
      fetchItemDetails(selectedItem)
    } else {
      setItemDetails(null)
    }
  }, [selectedItem, fetchItemDetails])

  const handleLinkQuote = async (quoteLineItemId: string) => {
    if (!selectedItem) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/items/${selectedItem}/quote-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteLineItemId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to link quote')
      }

      toast.success('Quote linked successfully')
      await fetchItemDetails(selectedItem)
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to link quote')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnlinkQuote = async () => {
    if (!selectedItem) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/procurement/items/${selectedItem}/quote-link`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to unlink quote')
      }

      toast.success('Quote unlinked successfully')
      await fetchItemDetails(selectedItem)
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlink quote')
    } finally {
      setActionLoading(false)
    }
  }

  const getAvailabilityBadge = (availability: string | null) => {
    if (!availability) return null
    switch (availability) {
      case 'IN_STOCK':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">In Stock</Badge>
      case 'BACKORDER':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Backorder</Badge>
      case 'SPECIAL_ORDER':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Special Order</Badge>
      case 'DISCONTINUED':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Discontinued</Badge>
      default:
        return <Badge variant="outline">{availability}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Items Table */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Quote-Item Links</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage which supplier quotes are linked to each item
          </p>
        </div>
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Linked Quote</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No items to manage</p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const hasQuote = !!item.acceptedQuoteLineItemId
                  const quote = item.acceptedQuoteLineItem

                  return (
                    <TableRow
                      key={item.id}
                      className={selectedItem === item.id ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        {item.images && item.images[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {item.quantity} {item.unitType || 'units'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasQuote ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            No Quote
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {quote?.supplierQuote?.supplier?.name || item.supplierName || (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {quote ? formatCurrency(quote.unitPrice) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {quote?.leadTime || (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(item.id)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <LinkIcon className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Item Details Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-blue-600" />
              Manage Quote Link
            </DialogTitle>
            <DialogDescription>
              {itemDetails?.name || 'Loading...'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : itemDetails ? (
            <div className="space-y-6">
              {/* Item Info */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                {itemDetails.images && itemDetails.images[0] ? (
                  <img
                    src={itemDetails.images[0]}
                    alt={itemDetails.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{itemDetails.name}</h4>
                  {itemDetails.description && (
                    <p className="text-sm text-gray-500 mt-1">{itemDetails.description}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Qty: {itemDetails.quantity} {itemDetails.unitType || 'units'}
                  </p>
                </div>
              </div>

              {/* Current Quote */}
              {itemDetails.currentQuote && (
                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Currently Linked Quote</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkQuote}
                      disabled={actionLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Unlink className="w-4 h-4 mr-1" />
                          Unlink
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Supplier:</span>
                      <p className="font-medium">{itemDetails.currentQuote.supplierName || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit Price:</span>
                      <p className="font-medium">{formatCurrency(itemDetails.currentQuote.unitPrice)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Price:</span>
                      <p className="font-medium">{formatCurrency(itemDetails.currentQuote.totalPrice)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Lead Time:</span>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {itemDetails.currentQuote.leadTime ||
                         (itemDetails.currentQuote.leadTimeWeeks ? `${itemDetails.currentQuote.leadTimeWeeks} weeks` : '—')}
                      </p>
                    </div>
                    {itemDetails.currentQuote.availability && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Availability:</span>
                        <p className="mt-1">{getAvailabilityBadge(itemDetails.currentQuote.availability)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Available Quotes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Available Quotes ({itemDetails.availableQuotes.length})</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchItemDetails(selectedItem!)}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {itemDetails.availableQuotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No quotes available for this item</p>
                    <p className="text-sm mt-1">Request quotes from suppliers to see them here</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {itemDetails.availableQuotes.map((quote) => (
                        <div
                          key={quote.id}
                          className={`p-4 border rounded-lg ${
                            quote.isCurrent
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-gray-400" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {quote.supplierName || 'Unknown Supplier'}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                  <span>{formatCurrency(quote.unitPrice)}/unit</span>
                                  {quote.leadTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {quote.leadTime}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {getAvailabilityBadge(quote.availability)}
                              {quote.isCurrent ? (
                                <Badge className="bg-green-600">Current</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleLinkQuote(quote.id)}
                                  disabled={actionLoading}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <LinkIcon className="w-4 h-4 mr-1" />
                                      Link
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Quote Details */}
                          <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Unit Price</span>
                              <p className="font-medium">{formatCurrency(quote.unitPrice)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Price</span>
                              <p className="font-medium">{formatCurrency(quote.totalPrice)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Lead Time</span>
                              <p className="font-medium">
                                {quote.leadTime ||
                                 (quote.leadTimeWeeks ? `${quote.leadTimeWeeks} weeks` : '—')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Failed to load item details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
