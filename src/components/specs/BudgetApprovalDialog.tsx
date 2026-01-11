'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Send,
  Eye,
  Package
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface BudgetApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  selectedItemIds: string[]
  specs: SpecItem[]
  onSuccess?: () => void
}

interface SpecItem {
  id: string
  name: string
  brand: string | null
  sku: string | null
  quantity: number
  rrp: number | null
  rrpCurrency?: string // CAD or USD
  tradePrice: number | null
  sectionName: string
  categoryName: string
  roomName: string
  thumbnailUrl: string | null
}

type Step = 'price-check' | 'review' | 'preview'

export default function BudgetApprovalDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  selectedItemIds,
  specs,
  onSuccess
}: BudgetApprovalDialogProps) {
  const [step, setStep] = useState<Step>('price-check')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Client info
  const [clientName, setClientName] = useState<string>('')
  const [clientEmail, setClientEmail] = useState<string>('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [includeTax, setIncludeTax] = useState(true)
  const [expiresInDays, setExpiresInDays] = useState(30)

  // Price overrides for items without RRP
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({})

  // Selected items to include in budget
  const [includedItems, setIncludedItems] = useState<Set<string>>(new Set())

  // Get selected specs
  const selectedSpecs = useMemo(() => {
    return specs.filter(s => selectedItemIds.includes(s.id))
  }, [specs, selectedItemIds])

  // Items with RRP and items needing price
  const itemsWithRrp = useMemo(() => {
    return selectedSpecs.filter(s => s.rrp && s.rrp > 0)
  }, [selectedSpecs])

  const itemsNeedingPrice = useMemo(() => {
    return selectedSpecs.filter(s => !s.rrp || s.rrp <= 0)
  }, [selectedSpecs])

  // Fetch client info
  useEffect(() => {
    if (open && projectId) {
      fetch(`/api/projects/${projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data.client) {
            setClientName(data.client.name || '')
            setClientEmail(data.client.email || '')
          }
        })
        .catch(err => console.error('Failed to fetch project client:', err))
    }
  }, [open, projectId])

  // Initialize on open
  useEffect(() => {
    if (open) {
      setStep('price-check')
      setTitle(`${projectName} - Budget Approval`)
      setDescription('')
      setPriceOverrides({})
      // Auto-include items with RRP
      setIncludedItems(new Set(itemsWithRrp.map(i => i.id)))
    }
  }, [open, projectName, itemsWithRrp])

  // Calculate totals
  const calculateItemPrice = (item: SpecItem): number => {
    if (priceOverrides[item.id] !== undefined) {
      return priceOverrides[item.id]
    }
    return item.rrp || 0
  }

  const includedItemsList = useMemo(() => {
    return selectedSpecs.filter(s => includedItems.has(s.id))
  }, [selectedSpecs, includedItems])

  // Calculate totals by currency (CAD and USD separately)
  const cadSubtotal = useMemo(() => {
    return includedItemsList
      .filter(item => (item.rrpCurrency || 'CAD') === 'CAD')
      .reduce((sum, item) => {
        const price = calculateItemPrice(item)
        return sum + (price * (item.quantity || 1))
      }, 0)
  }, [includedItemsList, priceOverrides])

  const usdSubtotal = useMemo(() => {
    return includedItemsList
      .filter(item => item.rrpCurrency === 'USD')
      .reduce((sum, item) => {
        const price = calculateItemPrice(item)
        return sum + (price * (item.quantity || 1))
      }, 0)
  }, [includedItemsList, priceOverrides])

  // For backward compatibility
  const subtotal = cadSubtotal + usdSubtotal

  const handlePriceChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setPriceOverrides(prev => ({
      ...prev,
      [itemId]: numValue
    }))
  }

  const toggleItemInclusion = (itemId: string) => {
    setIncludedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleContinueToReview = () => {
    // Check if all needed prices are filled
    const missingPrices = itemsNeedingPrice.filter(item =>
      includedItems.has(item.id) && !priceOverrides[item.id]
    )

    if (missingPrices.length > 0) {
      toast.error(`Please fill in prices for ${missingPrices.length} item(s) or uncheck them`)
      return
    }

    if (includedItems.size === 0) {
      toast.error('Please select at least one item')
      return
    }

    setStep('review')
  }

  const handleContinueToPreview = () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    setStep('preview')
  }

  const handleSend = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    if (includedItems.size === 0) {
      toast.error('Please select at least one item')
      return
    }

    setSending(true)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)

      // Create the budget quote
      const res = await fetch('/api/budget-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || null,
          itemIds: Array.from(includedItems),
          supplierQuoteIds: [],
          // Store CAD total as primary, but include both for display
          estimatedTotal: cadSubtotal,
          estimatedTotalUSD: usdSubtotal > 0 ? usdSubtotal : null,
          markupPercent: 0, // RRP already includes markup
          currency: 'CAD', // Primary currency
          includeTax,
          includedServices: [],
          expiresAt: expiresAt.toISOString(),
          clientEmail: clientEmail || null
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create budget quote')
      }

      const budgetQuote = await res.json()

      // Now send the email to client
      if (clientEmail) {
        const sendRes = await fetch(`/api/budget-quotes/${budgetQuote.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: clientEmail
          })
        })

        if (!sendRes.ok) {
          // Budget created but email failed
          toast.error('Budget created but failed to send email. You can send it from Procurement.')
        } else {
          toast.success('Budget sent to client for approval!')
        }
      } else {
        toast.success('Budget quote created! Add client email to send.')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('Error creating budget quote:', error)
      toast.error(error.message || 'Failed to create budget quote')
    } finally {
      setSending(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'CAD') => {
    const currencyCode = currency === 'USD' ? 'USD' : 'CAD'
    const locale = currency === 'USD' ? 'en-US' : 'en-CA'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode
    }).format(amount)
  }

  // Group items by section
  const itemsBySection = useMemo(() => {
    return includedItemsList.reduce((acc, item) => {
      const section = item.sectionName || 'Other'
      if (!acc[section]) acc[section] = []
      acc[section].push(item)
      return acc
    }, {} as Record<string, SpecItem[]>)
  }, [includedItemsList])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-violet-600" />
            Budget Approval
            {step !== 'price-check' && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                {step === 'review' ? 'Step 2: Review Details' : 'Step 3: Preview & Send'}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'price-check' && 'Set prices for items without RRP, then review and send to client for approval.'}
            {step === 'review' && 'Review budget details before sending to client.'}
            {step === 'preview' && 'Preview what the client will see and send for approval.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Price Check */}
          {step === 'price-check' && (
            <div className="space-y-6">
              {/* Items with RRP */}
              {itemsWithRrp.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <Label className="text-green-700">Items with RRP ({itemsWithRrp.length})</Label>
                  </div>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {itemsWithRrp.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={includedItems.has(item.id)}
                          onCheckedChange={() => toggleItemInclusion(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.sectionName} • Qty: {item.quantity}</p>
                        </div>
                        <span className="text-sm font-medium text-green-700">
                          {formatCurrency(item.rrp! * (item.quantity || 1))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items needing price */}
              {itemsNeedingPrice.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <Label className="text-amber-700">Items Needing Price ({itemsNeedingPrice.length})</Label>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Enter RRP prices for these items or uncheck to exclude from budget.
                  </p>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {itemsNeedingPrice.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50/50 border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={includedItems.has(item.id)}
                          onCheckedChange={() => toggleItemInclusion(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.sectionName} • Qty: {item.quantity}
                            {item.tradePrice && ` • Trade: ${formatCurrency(item.tradePrice)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">RRP:</span>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={priceOverrides[item.id] || ''}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            className="w-24 h-8 text-sm"
                            disabled={!includedItems.has(item.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary - Separate CAD and USD */}
              <div className="bg-violet-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Selected</span>
                  <span className="font-medium">{includedItems.size} of {selectedSpecs.length}</span>
                </div>
                {cadSubtotal > 0 && (
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-violet-900">Total CAD</span>
                    <span className="text-violet-700">{formatCurrency(cadSubtotal, 'CAD')}</span>
                  </div>
                )}
                {usdSubtotal > 0 && (
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-blue-900">Total USD</span>
                    <span className="text-blue-700">{formatCurrency(usdSubtotal, 'USD')}</span>
                  </div>
                )}
                {cadSubtotal > 0 && usdSubtotal > 0 && (
                  <p className="text-xs text-gray-500 italic pt-1">
                    Note: CAD and USD items shown separately.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Living Room Furniture - Budget Approval"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details about this budget..."
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeTax"
                      checked={includeTax}
                      onCheckedChange={(checked) => setIncludeTax(checked === true)}
                    />
                    <label htmlFor="includeTax" className="text-sm text-gray-600 cursor-pointer">
                      Show "+ applicable taxes"
                    </label>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div>
                <Label>Items Included ({includedItems.size})</Label>
                <div className="border rounded-lg mt-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(itemsBySection).map(([section, items]) => (
                    <div key={section}>
                      <div className="sticky top-0 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 border-b">
                        {section} ({items.length})
                      </div>
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between px-3 py-2 text-sm border-b last:border-b-0">
                          <span className="text-gray-700 truncate flex-1">{item.name}</span>
                          <span className="text-gray-900 font-medium ml-4">
                            {formatCurrency(calculateItemPrice(item) * (item.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals - Separate CAD and USD */}
              <div className="bg-violet-50 rounded-lg p-4 space-y-2">
                {cadSubtotal > 0 && (
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-violet-900">Total CAD</span>
                    <span className="text-violet-700">
                      {formatCurrency(cadSubtotal, 'CAD')}
                      {includeTax && <span className="text-sm font-normal text-violet-600 ml-1">+ tax</span>}
                    </span>
                  </div>
                )}
                {usdSubtotal > 0 && (
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-blue-900">Total USD</span>
                    <span className="text-blue-700">
                      {formatCurrency(usdSubtotal, 'USD')}
                      {includeTax && <span className="text-sm font-normal text-blue-600 ml-1">+ tax</span>}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Sending to</span>
                </div>
                <p className="text-sm text-gray-900">{clientName || 'Client'}</p>
                <p className="text-sm text-gray-500">{clientEmail || 'No email set - add in project settings'}</p>
              </div>

              {/* Preview Card */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-violet-600 text-white p-6 text-center">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="text-violet-200 text-sm mt-1">{projectName}</p>
                </div>

                <div className="p-6">
                  {description && (
                    <p className="text-gray-600 text-sm mb-4">{description}</p>
                  )}

                  <div className="space-y-3">
                    {Object.entries(itemsBySection).map(([section, items]) => (
                      <div key={section}>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">{section}</p>
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between py-1.5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-700">{item.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-xs text-gray-400">x{item.quantity}</span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(calculateItemPrice(item) * (item.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                    {cadSubtotal > 0 && (
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Estimated Total (CAD)</span>
                        <span className="text-violet-700">
                          {formatCurrency(cadSubtotal, 'CAD')}
                          {includeTax && <span className="text-sm font-normal text-gray-500 ml-1">+ tax</span>}
                        </span>
                      </div>
                    )}
                    {usdSubtotal > 0 && (
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Estimated Total (USD)</span>
                        <span className="text-blue-700">
                          {formatCurrency(usdSubtotal, 'USD')}
                          {includeTax && <span className="text-sm font-normal text-gray-500 ml-1">+ tax</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 text-center">
                    <div className="inline-flex gap-3">
                      <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                        Approve Budget
                      </div>
                      <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                        Ask a Question
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Valid for {expiresInDays} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'price-check' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleContinueToReview}
                disabled={includedItems.size === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('price-check')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleContinueToPreview}
                disabled={!title.trim()}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Eye className="w-4 h-4 mr-1" />
                Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('review')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !clientEmail}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to Client
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
