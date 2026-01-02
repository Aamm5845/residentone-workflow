'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, Percent, DollarSign } from 'lucide-react'

interface LineItemWithMarkup {
  id: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  sectionName: string
  defaultMarkup: number
  markup: number
  sellingPrice: number
}

interface AcceptQuoteMarkupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quoteId: string
  rfqId: string
  supplierName: string
  onAccepted: () => void
}

export default function AcceptQuoteMarkupDialog({
  open,
  onOpenChange,
  quoteId,
  rfqId,
  supplierName,
  onAccepted
}: AcceptQuoteMarkupDialogProps) {
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [lineItems, setLineItems] = useState<LineItemWithMarkup[]>([])
  const [sectionPresets, setSectionPresets] = useState<Record<string, number>>({})

  useEffect(() => {
    if (open && quoteId) {
      loadQuoteData()
    }
  }, [open, quoteId])

  const loadQuoteData = async () => {
    setLoading(true)
    try {
      // Fetch quote line items with related data
      const [quoteRes, presetsRes] = await Promise.all([
        fetch(`/api/supplier-quotes/${quoteId}/line-items`),
        fetch('/api/ffe/section-presets')
      ])

      if (!quoteRes.ok || !presetsRes.ok) {
        throw new Error('Failed to load data')
      }

      const quoteData = await quoteRes.json()
      const presetsData = await presetsRes.json()

      // Build section preset markup lookup
      const presetLookup: Record<string, number> = {}
      for (const preset of presetsData.presets || []) {
        if (preset.markupPercent !== null) {
          presetLookup[preset.name.toLowerCase()] = parseFloat(preset.markupPercent)
        }
      }
      setSectionPresets(presetLookup)

      // Map line items with markup
      const items: LineItemWithMarkup[] = (quoteData.lineItems || []).map((item: any) => {
        const sectionName = item.rfqLineItem?.roomFFEItem?.section?.name || 'General'
        const defaultMarkup = presetLookup[sectionName.toLowerCase()] ?? 25
        const unitPrice = parseFloat(item.unitPrice) || 0

        return {
          id: item.id,
          itemName: item.itemName || item.rfqLineItem?.itemName || 'Unknown Item',
          quantity: item.quantity || 1,
          unitPrice,
          totalPrice: parseFloat(item.totalPrice) || unitPrice * (item.quantity || 1),
          sectionName,
          defaultMarkup,
          markup: item.approvedMarkupPercent !== null ? parseFloat(item.approvedMarkupPercent) : defaultMarkup,
          sellingPrice: unitPrice * (1 + defaultMarkup / 100)
        }
      })

      setLineItems(items)
    } catch (error) {
      console.error('Error loading quote data:', error)
      toast.error('Failed to load quote details')
    } finally {
      setLoading(false)
    }
  }

  const updateMarkup = (itemId: string, newMarkup: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          markup: newMarkup,
          sellingPrice: item.unitPrice * (1 + newMarkup / 100)
        }
      }
      return item
    }))
  }

  const handleAccept = async () => {
    setAccepting(true)
    try {
      // First, save the approved markups to each line item
      const markupUpdates = lineItems.map(item => ({
        lineItemId: item.id,
        approvedMarkupPercent: item.markup
      }))

      const markupRes = await fetch(`/api/supplier-quotes/${quoteId}/approve-markups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: markupUpdates })
      })

      if (!markupRes.ok) {
        throw new Error('Failed to save markups')
      }

      // Then accept the quote
      const acceptRes = await fetch(`/api/rfq/${rfqId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, action: 'accept' })
      })

      if (!acceptRes.ok) {
        throw new Error('Failed to accept quote')
      }

      toast.success('Quote accepted with markups saved')
      onOpenChange(false)
      onAccepted()
    } catch (error) {
      console.error('Error accepting quote:', error)
      toast.error('Failed to accept quote')
    } finally {
      setAccepting(false)
    }
  }

  const totalSupplierCost = lineItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const totalSellingPrice = lineItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0)
  const totalProfit = totalSellingPrice - totalSupplierCost

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Accept Quote with Markup
          </DialogTitle>
          <DialogDescription>
            Review and set markup for each item from <span className="font-medium">{supplierName}</span> before accepting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : lineItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No line items found in this quote
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Supplier Price</TableHead>
                    <TableHead className="text-center w-32">Markup %</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.sectionName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="200"
                            step="0.5"
                            value={item.markup}
                            onChange={(e) => updateMarkup(item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-center text-sm"
                          />
                          <Percent className="w-4 h-4 text-gray-400" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600">
                        ${item.sellingPrice.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Supplier Cost:</span>
                  <span className="font-mono">${totalSupplierCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Selling Price:</span>
                  <span className="font-mono font-medium">${totalSellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600 font-medium">Gross Profit:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    ${totalProfit.toFixed(2)} ({((totalProfit / totalSupplierCost) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={accepting}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading || accepting || lineItems.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Accept Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
