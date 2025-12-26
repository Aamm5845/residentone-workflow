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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Search, DollarSign, Percent, AlertCircle, Package, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface CreateClientQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (quoteId: string) => void
  projectId: string
  preselectedItemIds?: string[]  // Pre-select items (from bulk quote or per-item quote)
}

interface SpecItem {
  id: string
  name: string
  description?: string
  category?: string
  sectionName?: string
  quantity: number
  unitType?: string
  roomName?: string
  // Pricing
  tradePrice?: number | null
  unitCost?: number | null
  rrp?: number | null
  // Supplier info
  supplierName?: string
  brand?: string
}

interface LineItem {
  id: string
  itemId: string
  name: string
  description?: string
  category: string
  quantity: number
  unitType: string
  costPrice: number
  markupPercent: number
  sellingPrice: number
  totalPrice: number
  roomName?: string
}

interface CategoryMarkup {
  categoryName: string
  markupPercent: number
}

export default function CreateClientQuoteDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId,
  preselectedItemIds
}: CreateClientQuoteDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form data - Step 1
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('50% deposit, 50% on delivery')
  const [depositRequired, setDepositRequired] = useState<number | undefined>(50)
  const [defaultMarkup, setDefaultMarkup] = useState(25)

  // Step 2: Items & Pricing
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryMarkups, setCategoryMarkups] = useState<CategoryMarkup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Load items when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadSpecItems()
      loadCategoryMarkups()
      
      // Set default valid until date (30 days from now)
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 30)
      setValidUntil(defaultDate.toISOString().split('T')[0])
    }
  }, [open, projectId])

  // Build line items from preselected items
  useEffect(() => {
    if (specItems.length > 0 && preselectedItemIds?.length) {
      const items = specItems.filter(item => preselectedItemIds.includes(item.id))
      buildLineItems(items)
      
      // Auto-generate title based on categories
      const categories = [...new Set(items.map(i => i.category || i.sectionName || 'Items'))]
      if (categories.length === 1) {
        setTitle(`${categories[0]} Quote`)
      } else if (categories.length <= 3) {
        setTitle(`${categories.join(', ')} Quote`)
      } else {
        setTitle(`Quote (${items.length} items)`)
      }

      // Expand all categories by default
      setExpandedCategories(new Set(categories))
    }
  }, [specItems, preselectedItemIds, categoryMarkups])

  const loadSpecItems = async () => {
    setLoading(true)
    try {
      const url = preselectedItemIds?.length
        ? `/api/projects/${projectId}/ffe-specs?ids=${preselectedItemIds.join(',')}`
        : `/api/projects/${projectId}/ffe-specs`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSpecItems(data.items || [])
      }
    } catch (error) {
      console.error('Error loading spec items:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategoryMarkups = async () => {
    try {
      const response = await fetch('/api/settings/category-markups')
      if (response.ok) {
        const data = await response.json()
        setCategoryMarkups(data.markups || [])
      }
    } catch (error) {
      console.error('Error loading category markups:', error)
    }
  }

  const getMarkupForCategory = (category: string): number => {
    const markup = categoryMarkups.find(m => 
      m.categoryName.toLowerCase() === category.toLowerCase()
    )
    return markup?.markupPercent || defaultMarkup
  }

  const buildLineItems = (items: SpecItem[]) => {
    const newLineItems: LineItem[] = items.map(item => {
      const category = item.category || item.sectionName || 'General'
      const markup = getMarkupForCategory(category)
      const costPrice = item.tradePrice || item.unitCost || 0
      const sellingPrice = costPrice * (1 + markup / 100)
      const quantity = item.quantity || 1

      return {
        id: `line-${item.id}`,
        itemId: item.id,
        name: item.name,
        description: item.description,
        category,
        quantity,
        unitType: item.unitType || 'units',
        costPrice,
        markupPercent: markup,
        sellingPrice,
        totalPrice: sellingPrice * quantity,
        roomName: item.roomName
      }
    })

    setLineItems(newLineItems)
  }

  const updateLineItemMarkup = (lineId: string, newMarkup: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const sellingPrice = item.costPrice * (1 + newMarkup / 100)
        return {
          ...item,
          markupPercent: newMarkup,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  const updateLineItemQuantity = (lineId: string, quantity: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        return {
          ...item,
          quantity,
          totalPrice: item.sellingPrice * quantity
        }
      }
      return item
    }))
  }

  const updateLineItemCostPrice = (lineId: string, costPrice: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const sellingPrice = costPrice * (1 + item.markupPercent / 100)
        return {
          ...item,
          costPrice,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  const removeLineItem = (lineId: string) => {
    setLineItems(prev => prev.filter(item => item.id !== lineId))
  }

  // Apply markup to all items in a category
  const applyCategoryMarkup = (category: string, markup: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.category === category) {
        const sellingPrice = item.costPrice * (1 + markup / 100)
        return {
          ...item,
          markupPercent: markup,
          sellingPrice,
          totalPrice: sellingPrice * item.quantity
        }
      }
      return item
    }))
  }

  // Group line items by category
  const groupedLineItems = useMemo(() => {
    const groups: Record<string, LineItem[]> = {}
    lineItems.forEach(item => {
      const category = item.category || 'Other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    })
    return groups
  }, [lineItems])

  // Calculate totals
  const totals = useMemo(() => {
    const totalCost = lineItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
    const totalRevenue = lineItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const grossProfit = totalRevenue - totalCost
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    return {
      totalCost,
      totalRevenue,
      grossProfit,
      marginPercent,
      depositAmount: depositRequired ? (totalRevenue * depositRequired / 100) : 0
    }
  }, [lineItems, depositRequired])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a quote title')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one item to the quote')
      return
    }

    // Check for items without pricing
    const itemsWithoutPrice = lineItems.filter(item => item.costPrice === 0)
    if (itemsWithoutPrice.length > 0) {
      const confirmed = window.confirm(
        `${itemsWithoutPrice.length} item(s) have no cost price set. The client will see these as $0. Continue anyway?`
      )
      if (!confirmed) return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/client-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description: description || null,
          defaultMarkupPercent: defaultMarkup,
          validUntil: validUntil || null,
          paymentTerms: paymentTerms || null,
          depositRequired: depositRequired || null,
          groupingType: 'category',
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.itemId,
            groupId: item.category,
            itemName: item.name,
            itemDescription: item.description || null,
            quantity: item.quantity,
            unitType: item.unitType,
            costPrice: item.costPrice,
            markupPercent: item.markupPercent,
            sellingPrice: item.sellingPrice,
            totalCost: item.costPrice * item.quantity,
            totalPrice: item.totalPrice,
            order: index
          }))
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Client quote created successfully!')
        resetForm()
        onSuccess(data.quote?.id || data.id)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create quote')
      }
    } catch (error) {
      console.error('Error creating client quote:', error)
      toast.error('Failed to create quote')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setValidUntil('')
    setPaymentTerms('50% deposit, 50% on delivery')
    setDepositRequired(50)
    setDefaultMarkup(25)
    setLineItems([])
    setSearchQuery('')
    setExpandedCategories(new Set())
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            {step === 1 ? 'Create Client Quote - Details' : 'Create Client Quote - Pricing'}
          </DialogTitle>
          {preselectedItemIds?.length ? (
            <p className="text-sm text-gray-500">
              {preselectedItemIds.length} item{preselectedItemIds.length > 1 ? 's' : ''} selected
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Quote Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quote Title <span className="text-red-500">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kitchen Tiles & Flooring"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes for the client..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Markup %</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={defaultMarkup}
                      onChange={(e) => setDefaultMarkup(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50% deposit, 50% on delivery">50% deposit, 50% on delivery</SelectItem>
                      <SelectItem value="100% upfront">100% upfront</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Deposit Required (%)</Label>
                  <Input
                    type="number"
                    value={depositRequired || ''}
                    onChange={(e) => setDepositRequired(parseFloat(e.target.value) || undefined)}
                    min={0}
                    max={100}
                    placeholder="e.g., 50"
                  />
                </div>
              </div>

              {/* Summary Preview */}
              {lineItems.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-3">Quote Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Items</p>
                      <p className="text-lg font-semibold">{lineItems.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total (with markup)</p>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Your Profit</p>
                      <p className="text-lg font-semibold text-emerald-600">
                        {formatCurrency(totals.grossProfit)}
                        <span className="text-xs text-gray-500 ml-1">({totals.marginPercent.toFixed(1)}%)</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Items & Pricing */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Totals Header */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Cost</p>
                  <p className="text-lg font-bold">{formatCurrency(totals.totalCost)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Quote Total</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalRevenue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Profit</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.grossProfit)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Margin</p>
                  <p className="text-lg font-bold text-purple-600">{totals.marginPercent.toFixed(1)}%</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : lineItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No items selected</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-2">
                    {Object.entries(groupedLineItems).map(([category, items]) => (
                      <div key={category} className="mb-4">
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <Package className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{category}</span>
                            <Badge variant="secondary">{items.length}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">
                              Subtotal: <span className="font-medium text-gray-700">
                                {formatCurrency(items.reduce((sum, i) => sum + i.totalPrice, 0))}
                              </span>
                            </span>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-gray-500">Markup:</Label>
                              <Input
                                type="number"
                                className="w-16 h-7 text-xs"
                                value={items[0]?.markupPercent || defaultMarkup}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  applyCategoryMarkup(category, parseFloat(e.target.value) || 0)
                                }}
                                min={0}
                                max={200}
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </div>
                        </button>

                        {/* Items Table */}
                        {expandedCategories.has(category) && (
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="w-[30%]">Item</TableHead>
                                <TableHead className="text-right w-[12%]">Qty</TableHead>
                                <TableHead className="text-right w-[15%]">Cost</TableHead>
                                <TableHead className="text-right w-[12%]">Markup</TableHead>
                                <TableHead className="text-right w-[15%]">Price</TableHead>
                                <TableHead className="text-right w-[15%]">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id} className="text-sm">
                                  <TableCell>
                                    <div>
                                      <p className="font-medium truncate">{item.name}</p>
                                      {item.roomName && (
                                        <p className="text-xs text-gray-400">{item.roomName}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      className="w-16 h-7 text-right text-xs"
                                      value={item.quantity}
                                      onChange={(e) => updateLineItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                      min={1}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="relative">
                                      <DollarSign className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                      <Input
                                        type="number"
                                        className={cn(
                                          "w-20 h-7 text-right text-xs pl-5",
                                          item.costPrice === 0 && "border-orange-300 bg-orange-50"
                                        )}
                                        value={item.costPrice || ''}
                                        onChange={(e) => updateLineItemCostPrice(item.id, parseFloat(e.target.value) || 0)}
                                        min={0}
                                        step={0.01}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Input
                                        type="number"
                                        className="w-14 h-7 text-right text-xs"
                                        value={item.markupPercent}
                                        onChange={(e) => updateLineItemMarkup(item.id, parseFloat(e.target.value) || 0)}
                                        min={0}
                                        max={200}
                                      />
                                      <span className="text-xs text-gray-400">%</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(item.sellingPrice)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-green-600">
                                    {formatCurrency(item.totalPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Items without pricing warning */}
              {lineItems.filter(i => i.costPrice === 0).length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="text-orange-700">
                    {lineItems.filter(i => i.costPrice === 0).length} item(s) have no cost price. 
                    Add trade/cost prices before sending to client.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={!title.trim() || lineItems.length === 0}
            >
              Next: Review Pricing
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <DollarSign className="w-4 h-4 mr-1" />
              Create Quote ({formatCurrency(totals.totalRevenue)})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

