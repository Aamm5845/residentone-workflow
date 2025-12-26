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
import { Loader2, Send, AlertCircle, CheckCircle, Package, User, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'

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
}

interface SupplierInfo {
  id: string
  name: string
  email: string
  contactName?: string
  matched?: boolean  // If this supplier was auto-matched from item
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
  const [items, setItems] = useState<ItemInfo[]>([])
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [showSupplierSelection, setShowSupplierSelection] = useState(false)

  useEffect(() => {
    if (open && itemIds.length > 0) {
      loadItemsAndSuppliers()
    }
  }, [open, itemIds])

  const loadItemsAndSuppliers = async () => {
    setLoading(true)
    try {
      // Load item details
      const itemsResponse = await fetch(`/api/projects/${projectId}/ffe-specs?ids=${itemIds.join(',')}`)
      if (itemsResponse.ok) {
        const data = await itemsResponse.json()
        setItems(data.items || [])
      }

      // Load suppliers
      const suppliersResponse = await fetch('/api/suppliers')
      if (suppliersResponse.ok) {
        const data = await suppliersResponse.json()
        const supplierList = Array.isArray(data) ? data : (data.suppliers || [])
        
        // Auto-match suppliers based on item supplierName
        const itemsData = (await itemsResponse.json?.()) || { items: [] }
        const matchedSupplierIds = new Set<string>()
        
        for (const item of items) {
          if (item.supplierName) {
            const normalizedName = item.supplierName.toLowerCase().trim()
            const matchedSupplier = supplierList.find((s: any) => 
              s.name.toLowerCase().trim() === normalizedName ||
              s.name.toLowerCase().includes(normalizedName) ||
              normalizedName.includes(s.name.toLowerCase())
            )
            if (matchedSupplier) {
              matchedSupplierIds.add(matchedSupplier.id)
            }
          }
        }

        // Mark matched suppliers
        const suppliersWithMatch = supplierList.map((s: any) => ({
          ...s,
          matched: matchedSupplierIds.has(s.id)
        }))

        setSuppliers(suppliersWithMatch)
        setSelectedSuppliers(Array.from(matchedSupplierIds))
        
        // If no auto-matched suppliers, show supplier selection
        if (matchedSupplierIds.size === 0) {
          setShowSupplierSelection(true)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load item details')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (selectedSuppliers.length === 0) {
      toast.error('Please select at least one supplier')
      setShowSupplierSelection(true)
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/rfq/quick-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          itemIds,
          overrideSupplierIds: selectedSuppliers,
          message: message || undefined
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(`Quote request sent to ${result.sent} supplier(s)!`)
        onSuccess()
        onOpenChange(false)
      } else if (result.needsSupplierSelection) {
        setShowSupplierSelection(true)
        toast.error('Please select suppliers for this quote request')
      } else {
        toast.error(result.error || 'Failed to send quote request')
      }
    } catch (error) {
      console.error('Error sending quote:', error)
      toast.error('Failed to send quote request')
    } finally {
      setSending(false)
    }
  }

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  const matchedSuppliers = suppliers.filter(s => s.matched)
  const otherSuppliers = suppliers.filter(s => !s.matched)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-600" />
            Quick Quote Request
          </DialogTitle>
          <DialogDescription>
            {loading ? 'Loading...' : `Send quote request for ${items.length} item(s)`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Items Preview */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Items ({items.length})
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 relative flex-shrink-0 bg-white rounded border overflow-hidden">
                        {item.thumbnailUrl || (item.images && item.images[0]) ? (
                          <Image
                            src={item.thumbnailUrl || item.images![0]}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.brand && <span>Brand: {item.brand}</span>}
                          {item.quantity && <span className="ml-2">Qty: {item.quantity}</span>}
                        </p>
                        {item.supplierName && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.supplierName}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suppliers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Suppliers ({selectedSuppliers.length} selected)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSupplierSelection(!showSupplierSelection)}
                  >
                    {showSupplierSelection ? 'Hide' : 'Change'}
                  </Button>
                </div>

                {/* Auto-matched suppliers display */}
                {!showSupplierSelection && selectedSuppliers.length > 0 && (
                  <div className="space-y-2">
                    {suppliers
                      .filter(s => selectedSuppliers.includes(s.id))
                      .map(supplier => (
                        <div key={supplier.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{supplier.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {supplier.email}
                            </p>
                          </div>
                          {supplier.matched && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                              Auto-matched
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Supplier selection list */}
                {showSupplierSelection && (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {matchedSuppliers.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500 font-medium px-2 pt-1">
                          Matched from item suppliers:
                        </p>
                        {matchedSuppliers.map(supplier => (
                          <label
                            key={supplier.id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              selectedSuppliers.includes(supplier.id)
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <Checkbox
                              checked={selectedSuppliers.includes(supplier.id)}
                              onCheckedChange={() => toggleSupplier(supplier.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{supplier.name}</p>
                              <p className="text-xs text-gray-500">{supplier.email}</p>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                    
                    {otherSuppliers.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500 font-medium px-2 pt-2">
                          Other suppliers:
                        </p>
                        {otherSuppliers.map(supplier => (
                          <label
                            key={supplier.id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              selectedSuppliers.includes(supplier.id)
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <Checkbox
                              checked={selectedSuppliers.includes(supplier.id)}
                              onCheckedChange={() => toggleSupplier(supplier.id)}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{supplier.name}</p>
                              <p className="text-xs text-gray-500">{supplier.email}</p>
                            </div>
                          </label>
                        ))}
                      </>
                    )}

                    {suppliers.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No suppliers found</p>
                        <p className="text-xs">Add suppliers in Preferences first</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedSuppliers.length === 0 && !showSupplierSelection && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">No supplier selected</p>
                      <p className="text-xs">Click "Change" to select suppliers</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Message */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Message (optional)
                </Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add any special instructions or notes for the supplier..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || sending || selectedSuppliers.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Quote Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

