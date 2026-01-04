'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface CreateBudgetQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSuccess?: () => void
  // Pre-selected items from supplier quotes or all specs
  preselectedItems?: Array<{
    id: string
    name: string
    categoryName?: string
    totalCost: number
    clientApproved?: boolean
  }>
  preselectedSupplierQuoteIds?: string[]
  source?: 'supplier-quotes' | 'all-specs'
}

interface FFEItem {
  id: string
  name: string
  categoryName?: string
  totalCost: number
  clientApproved: boolean
}

const DEFAULT_SERVICES = [
  'Material selection & sourcing',
  'Supplier coordination',
  'Quality inspection',
  'Delivery coordination',
  'Installation oversight'
]

export default function CreateBudgetQuoteDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  preselectedItems,
  preselectedSupplierQuoteIds,
  source
}: CreateBudgetQuoteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<FFEItem[]>([])
  const [markupPercent, setMarkupPercent] = useState<number>(15)
  const [includeTax, setIncludeTax] = useState(true)
  const [includedServices, setIncludedServices] = useState<string[]>([
    'Material selection & sourcing',
    'Supplier coordination'
  ])
  const [newService, setNewService] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [includeApprovedItems, setIncludeApprovedItems] = useState(false)

  // Load items when dialog opens
  useEffect(() => {
    if (open && preselectedItems) {
      setItems(preselectedItems.map(item => ({
        ...item,
        clientApproved: item.clientApproved || false
      })))
      // Auto-select items that are NOT already client-approved
      const toSelect = preselectedItems
        .filter(item => !item.clientApproved)
        .map(item => item.id)
      setSelectedItems(new Set(toSelect))
    }
  }, [open, preselectedItems])

  // Calculate totals
  const selectedItemsList = items.filter(item => selectedItems.has(item.id))
  const subtotal = selectedItemsList.reduce((sum, item) => sum + (item.totalCost || 0), 0)
  const markupAmount = subtotal * (markupPercent / 100)
  const estimatedTotal = Math.round((subtotal + markupAmount) * 100) / 100

  // Filter items based on includeApprovedItems toggle
  const visibleItems = includeApprovedItems
    ? items
    : items.filter(item => !item.clientApproved)

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    const allVisible = visibleItems.map(item => item.id)
    setSelectedItems(new Set(allVisible))
  }

  const handleSelectNone = () => {
    setSelectedItems(new Set())
  }

  const handleToggleService = (service: string) => {
    setIncludedServices(prev => {
      if (prev.includes(service)) {
        return prev.filter(s => s !== service)
      }
      return [...prev, service]
    })
  }

  const handleAddService = () => {
    if (newService.trim() && !includedServices.includes(newService.trim())) {
      setIncludedServices(prev => [...prev, newService.trim()])
      setNewService('')
    }
  }

  const handleRemoveService = (service: string) => {
    setIncludedServices(prev => prev.filter(s => s !== service))
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item')
      return
    }

    setCreating(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)

      const res = await fetch('/api/budget-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || null,
          itemIds: Array.from(selectedItems),
          supplierQuoteIds: preselectedSupplierQuoteIds || [],
          estimatedTotal,
          markupPercent,
          currency: 'CAD',
          includeTax,
          includedServices,
          expiresAt: expiresAt.toISOString()
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create budget quote')
      }

      toast.success('Budget quote created successfully')
      onOpenChange(false)
      resetForm()
      onSuccess?.()
    } catch (error: any) {
      console.error('Error creating budget quote:', error)
      toast.error(error.message || 'Failed to create budget quote')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSelectedItems(new Set())
    setMarkupPercent(15)
    setIncludeTax(true)
    setIncludedServices(['Material selection & sourcing', 'Supplier coordination'])
    setExpiresInDays(30)
    setIncludeApprovedItems(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  // Group items by category
  const itemsByCategory = visibleItems.reduce((acc, item) => {
    const cat = item.categoryName || 'Items'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, FFEItem[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-violet-600" />
            Create Budget Quote
          </DialogTitle>
          <DialogDescription>
            Send a budget estimate to your client for approval before creating a detailed invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Living Room Furniture - Phase 1"
              className="mt-1.5"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this budget estimate..."
              rows={2}
              className="mt-1.5"
            />
          </div>

          {/* Items Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Select Items ({selectedItems.size} selected)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectNone}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Include already approved items toggle */}
            {items.some(item => item.clientApproved) && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <Checkbox
                  id="includeApproved"
                  checked={includeApprovedItems}
                  onCheckedChange={(checked) => setIncludeApprovedItems(checked === true)}
                />
                <label htmlFor="includeApproved" className="text-sm text-amber-800 cursor-pointer">
                  Include {items.filter(i => i.clientApproved).length} already client-approved items
                </label>
              </div>
            )}

            {/* Items list grouped by category */}
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 border-b">
                    {category} ({categoryItems.length})
                  </div>
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer ${
                        item.clientApproved ? 'bg-emerald-50/50' : ''
                      }`}
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => handleToggleItem(item.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        {item.clientApproved && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Already approved
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatCurrency(item.totalCost || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {visibleItems.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No items available
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="markup">Markup %</Label>
              <Input
                id="markup"
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.5}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="expires">Valid for (days)</Label>
              <Input
                id="expires"
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                min={1}
                max={365}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-violet-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items Cost</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Markup ({markupPercent}%)</span>
              <span className="font-medium">{formatCurrency(markupAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t border-violet-200 pt-2 mt-2">
              <span className="text-violet-900">Estimated Total</span>
              <span className="text-violet-700">{formatCurrency(estimatedTotal)}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="includeTax"
                checked={includeTax}
                onCheckedChange={(checked) => setIncludeTax(checked === true)}
              />
              <label htmlFor="includeTax" className="text-sm text-gray-600 cursor-pointer">
                Show "+ applicable taxes" note
              </label>
            </div>
          </div>

          {/* Included Services */}
          <div>
            <Label className="mb-2 block">Included Services</Label>
            <div className="space-y-2">
              {DEFAULT_SERVICES.map(service => (
                <div key={service} className="flex items-center gap-2">
                  <Checkbox
                    id={service}
                    checked={includedServices.includes(service)}
                    onCheckedChange={() => handleToggleService(service)}
                  />
                  <label htmlFor={service} className="text-sm text-gray-700 cursor-pointer">
                    {service}
                  </label>
                </div>
              ))}
              {/* Custom services */}
              {includedServices.filter(s => !DEFAULT_SERVICES.includes(s)).map(service => (
                <div key={service} className="flex items-center gap-2">
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => handleRemoveService(service)}
                  />
                  <span className="text-sm text-gray-700 flex-1">{service}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(service)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {/* Add custom service */}
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="Add custom service..."
                  className="flex-1 h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddService}
                  disabled={!newService.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !title.trim() || selectedItems.size === 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4 mr-2" />
                Create Budget Quote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
