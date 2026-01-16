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
import { Loader2, Search, DollarSign, Percent, AlertCircle, Package, ChevronDown, ChevronRight, CheckCircle, Send, Printer, Mail, FileText, ExternalLink, User, Phone, MapPin, Edit3, CreditCard, Plus, Trash2, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface CreateClientQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (quoteId: string) => void
  projectId: string
  preselectedItemIds?: string[]  // Pre-select items (from bulk quote or per-item quote)
}

// Component sub-item (e.g., faucet for a sink)
interface ComponentItem {
  id: string
  name: string
  image?: string
  price?: number | null
  priceWithMarkup?: number | null // RRP for component
  quantity: number
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
  rrpCurrency?: string
  // Supplier info
  supplierName?: string
  brand?: string
  // Images
  images?: string[]
  // Status
  specStatus?: string | null
  // Components
  components?: ComponentItem[]
}

// Statuses that should NOT appear in invoice creation
const EXCLUDED_INVOICE_STATUSES = ['CLIENT_TO_ORDER', 'CONTRACTOR_TO_ORDER', 'DRAFT', 'HIDDEN']

interface LineItem {
  id: string
  itemId: string
  name: string
  description?: string
  category: string
  quantity: number
  unitType: string
  costPrice: number // Trade price (for internal reference only)
  sellingPrice: number // RRP - the client-facing price
  totalPrice: number
  roomName?: string
  currency?: string // CAD or USD
  imageUrl?: string // Image URL
  isComponent?: boolean // True if this is a component of another item
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
  const [sending, setSending] = useState(false)

  // Created quote data (for Step 3 preview)
  const [createdQuote, setCreatedQuote] = useState<any>(null)
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [showCreditCardOption, setShowCreditCardOption] = useState(true)

  // Form data - Step 1
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('100% upfront')
  const [depositRequired, setDepositRequired] = useState<number | undefined>(undefined)

  // Additional charges (delivery, duties, custom)
  interface AdditionalCharge {
    id: string
    name: string
    amount: number
  }
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])

  // Test email state
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  // Step 2: Items & Pricing
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Load items when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadSpecItems()
      loadProjectClient()

      // Set default valid until date (30 days from now)
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 30)
      setValidUntil(defaultDate.toISOString().split('T')[0])
    }
  }, [open, projectId])

  const loadProjectClient = async () => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const project = await response.json()

      if (response.ok) {
        // Load client info
        if (project?.client) {
          setClientEmail(project.client.email || '')
          setClientName(project.client.name || '')
          setClientPhone(project.client.phone || '')
        }

        // Build address from project (streetAddress, city, postalCode)
        const addressParts = []
        if (project.streetAddress) addressParts.push(project.streetAddress)
        if (project.city) addressParts.push(project.city)
        if (project.postalCode) addressParts.push(project.postalCode)
        if (addressParts.length > 0) {
          setClientAddress(addressParts.join(', '))
        }
      }
    } catch (error) {
      console.error('Error loading project client:', error)
    }
  }

  // Build line items from preselected items (only items with RRP and valid status)
  useEffect(() => {
    if (specItems.length > 0 && preselectedItemIds?.length) {
      // Filter to only items that can be invoiced:
      // 1. Must have RRP set
      // 2. Must not have excluded status
      const invoiceableItems = specItems.filter(item =>
        preselectedItemIds.includes(item.id) &&
        item.rrp && item.rrp > 0 &&
        !EXCLUDED_INVOICE_STATUSES.includes(item.specStatus || '')
      )

      buildLineItems(invoiceableItems)

      // Auto-generate title - use item name if only one item, otherwise use categories
      if (invoiceableItems.length === 1) {
        // Single item: use the item name as title
        setTitle(invoiceableItems[0].name || 'Item Quote')
      } else if (invoiceableItems.length > 0) {
        // Multiple items: use categories
        const categories = [...new Set(invoiceableItems.map(i => i.category || i.sectionName || 'Items'))]
        if (categories.length === 1) {
          setTitle(`${categories[0]} Quote`)
        } else if (categories.length <= 3) {
          setTitle(`${categories.join(', ')} Quote`)
        } else {
          setTitle(`Quote (${invoiceableItems.length} items)`)
        }
      }

      // Expand all categories by default
      const categories = [...new Set(invoiceableItems.map(i => i.category || i.sectionName || 'Items'))]
      setExpandedCategories(new Set(categories))
    }
  }, [specItems, preselectedItemIds])

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

  // Build line items using RRP only (no markup calculation needed)
  // Items must have RRP set - this is validated in the filter above
  // Components are added as separate line items with their own qty, price, image
  const buildLineItems = (items: SpecItem[]) => {
    const newLineItems: LineItem[] = []

    items.forEach(item => {
      const category = item.category || item.sectionName || 'General'

      // Cost price is trade price (for internal reference only)
      const costPrice = item.tradePrice || item.unitCost || 0

      // RRP is the client-facing price - already validated to exist
      const sellingPrice = item.rrp || 0
      const quantity = item.quantity || 1

      // Add main item
      newLineItems.push({
        id: `line-${item.id}`,
        itemId: item.id,
        name: item.name,
        description: item.description,
        category,
        quantity,
        unitType: item.unitType || 'units',
        costPrice,
        sellingPrice,
        totalPrice: sellingPrice * quantity,
        roomName: item.roomName,
        currency: item.rrpCurrency || 'CAD',
        imageUrl: item.images && item.images.length > 0 ? item.images[0] : undefined,
        isComponent: false
      })

      // Add each component as a separate line item
      if (item.components && item.components.length > 0) {
        item.components.forEach(comp => {
          // Use priceWithMarkup (RRP) for client-facing price, fallback to price
          const compPrice = comp.priceWithMarkup ?? comp.price ?? 0
          const compQty = comp.quantity || 1

          newLineItems.push({
            id: `line-${item.id}-comp-${comp.id}`,
            itemId: item.id, // Parent item ID
            name: comp.name,
            description: undefined,
            category,
            quantity: compQty,
            unitType: 'units',
            costPrice: comp.price || 0, // Trade price
            sellingPrice: compPrice, // RRP
            totalPrice: compPrice * compQty,
            roomName: item.roomName,
            currency: item.rrpCurrency || 'CAD',
            imageUrl: comp.image || undefined,
            isComponent: true
          })
        })
      }
    })

    setLineItems(newLineItems)
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

  const removeLineItem = (lineId: string) => {
    setLineItems(prev => prev.filter(item => item.id !== lineId))
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

  // Tax rates (defaults - should match org settings)
  const [gstRate] = useState(5)
  const [qstRate] = useState(9.975)

  // Calculate totals
  const totals = useMemo(() => {
    const totalCost = lineItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
    const itemsSubtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const chargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0)
    const subtotal = itemsSubtotal + chargesTotal
    const gstAmount = subtotal * (gstRate / 100)
    const qstAmount = subtotal * (qstRate / 100)
    const totalRevenue = subtotal + gstAmount + qstAmount
    // Profit is from items only - shipping/charges are pass-through, not profit
    const grossProfit = itemsSubtotal - totalCost
    const marginPercent = itemsSubtotal > 0 ? (grossProfit / itemsSubtotal) * 100 : 0

    return {
      totalCost,
      itemsSubtotal,
      chargesTotal,
      subtotal,
      gstAmount,
      qstAmount,
      totalRevenue,
      grossProfit,
      marginPercent,
      depositAmount: depositRequired ? (totalRevenue * depositRequired / 100) : 0
    }
  }, [lineItems, additionalCharges, depositRequired, gstRate, qstRate])

  // Add charge helpers
  const addCharge = (name: string = 'Delivery', amount: number = 0) => {
    setAdditionalCharges(prev => [...prev, { id: `charge-${Date.now()}`, name, amount }])
  }

  const updateCharge = (id: string, field: 'name' | 'amount', value: string | number) => {
    setAdditionalCharges(prev => prev.map(charge =>
      charge.id === id ? { ...charge, [field]: field === 'amount' ? Number(value) || 0 : value } : charge
    ))
  }

  const removeCharge = (id: string) => {
    setAdditionalCharges(prev => prev.filter(charge => charge.id !== id))
  }

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
      toast.error('Please enter an invoice title')
      return
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one item to the invoice')
      return
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
          defaultMarkupPercent: 0, // No markup - using RRP directly
          validUntil: validUntil || null,
          paymentTerms: paymentTerms || null,
          depositRequired: depositRequired || null,
          groupingType: 'category',
          // Bill To information
          clientName: clientName || null,
          clientEmail: clientEmail || null,
          clientPhone: clientPhone || null,
          clientAddress: clientAddress || null,
          // Payment options
          allowCreditCard: showCreditCardOption,
          lineItems: [
            // All items (including components) have RRP - send as separate line items
            // Components appear as standard items with their own qty, price, image
            ...lineItems.map((item, index) => ({
              roomFFEItemId: item.isComponent ? null : item.itemId, // Components don't link to spec item
              groupId: item.category,
              itemName: item.name,
              itemDescription: item.description || null,
              quantity: item.quantity,
              unitType: item.unitType,
              costPrice: item.sellingPrice, // RRP as cost
              markupPercent: 0, // No markup - RRP is final
              sellingPrice: item.sellingPrice,
              totalCost: item.totalPrice,
              totalPrice: item.totalPrice,
              imageUrl: item.imageUrl || null,
              isComponent: item.isComponent || false,
              order: index
            })),
            // Additional charges as line items
            ...additionalCharges.filter(c => c.amount > 0).map((charge, index) => ({
              roomFFEItemId: null,
              groupId: 'Additional Charges',
              itemName: charge.name,
              itemDescription: null,
              quantity: 1,
              unitType: 'flat',
              costPrice: charge.amount,
              markupPercent: 0,
              sellingPrice: charge.amount,
              totalCost: charge.amount,
              totalPrice: charge.amount,
              order: lineItems.length + index
            }))
          ]
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[CreateClientQuote] Invoice created:', data.quote?.id, data.quote?.quoteNumber)
        if (!data.quote?.id) {
          console.error('[CreateClientQuote] No ID in response:', data)
          toast.error('Invoice created but ID missing - please refresh')
          return
        }
        setCreatedQuote(data.quote)
        setStep(3) // Show preview step
        toast.success('Invoice created! Review and send to client.')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create invoice')
      }
    } catch (error) {
      console.error('Error creating client invoice:', error)
      toast.error('Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setValidUntil('')
    setPaymentTerms('100% upfront')
    setDepositRequired(undefined)
    setLineItems([])
    setSearchQuery('')
    setExpandedCategories(new Set())
    setCreatedQuote(null)
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setClientAddress('')
    setShowCreditCardOption(true)
    setAdditionalCharges([])
  }

  const handleSendToClient = async () => {
    if (!clientEmail) {
      toast.error('Please enter client email')
      return
    }

    if (!createdQuote?.id) {
      toast.error('Invoice not found')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/client-quotes/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: createdQuote.id,
          clientEmail,
          clientName: clientName || undefined
        })
      })

      if (response.ok) {
        toast.success(`Invoice sent to ${clientEmail}`)
        handleFinish()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send invoice')
      }
    } catch (error) {
      toast.error('Failed to send invoice')
    } finally {
      setSending(false)
    }
  }

  const handlePrintQuote = () => {
    if (!createdQuote?.id) return
    // Open PDF in new tab for printing
    window.open(`/api/client-quotes/${createdQuote.id}/pdf`, '_blank')
  }

  const handleViewQuote = () => {
    if (!createdQuote?.id) {
      console.error('[CreateClientQuote] No quote ID available for viewing')
      toast.error('Invoice ID not available')
      return
    }
    console.log('[CreateClientQuote] Opening client view for ID:', createdQuote.id)
    // Open clean client-facing invoice view
    window.open(`/client/invoice/${createdQuote.id}`, '_blank')
  }

  const handleFinish = () => {
    const quoteId = createdQuote?.id
    resetForm()
    onOpenChange(false)
    if (quoteId) {
      onSuccess(quoteId)
    }
  }

  // Send test email to preview exactly what client will receive
  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address')
      return
    }

    if (lineItems.length === 0) {
      toast.error('No items to include in test email')
      return
    }

    setSendingTest(true)
    try {
      // Calculate valid days from validUntil date
      const validDays = validUntil
        ? Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 30

      const response = await fetch('/api/client-quotes/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: testEmail.trim(),
          projectId,
          title,
          description: description || null,
          paymentTerms: paymentTerms || null,
          validDays,
          defaultMarkup: 0,
          allowCreditCard: showCreditCardOption,
          // Additional fees
          shippingCost: additionalCharges.find(c => c.name.toLowerCase().includes('delivery'))?.amount || null,
          customFees: additionalCharges.filter(c => !c.name.toLowerCase().includes('delivery') && c.amount > 0),
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.isComponent ? null : item.itemId,
            groupId: item.category,
            itemName: item.name,
            displayDescription: item.description || null,
            imageUrl: item.imageUrl || null,
            isComponent: item.isComponent || false,
            quantity: item.quantity,
            unitType: item.unitType,
            clientUnitPrice: item.sellingPrice,
            costPrice: item.costPrice,
            markupPercent: 0,
            order: index
          }))
        })
      })

      if (response.ok) {
        toast.success(`Test email sent to ${testEmail.trim()}`)
        setShowTestEmailDialog(false)
        setTestEmail('')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send test email')
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error('Failed to send test email')
    } finally {
      setSendingTest(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 3 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <DollarSign className="w-5 h-5 text-green-600" />
            )}
            {step === 1 ? 'Create Invoice - Details' : step === 2 ? 'Create Invoice - Pricing' : 'Invoice Created - Send to Client'}
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
                <Label>Invoice Title <span className="text-red-500">*</span></Label>
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
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100% upfront">100% upfront</SelectItem>
                      <SelectItem value="50% deposit, 50% on delivery">50% deposit, 50% on delivery</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Charges Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <h4 className="font-medium text-gray-700">Additional Charges</h4>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCharge('Delivery', 0)}
                      className="text-xs h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Delivery
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCharge('Duties/Import Fee', 0)}
                      className="text-xs h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Duties
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCharge('Custom Charge', 0)}
                      className="text-xs h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Custom
                    </Button>
                  </div>
                </div>

                {additionalCharges.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">No additional charges added</p>
                ) : (
                  <div className="space-y-2">
                    {additionalCharges.map(charge => (
                      <div key={charge.id} className="flex items-center gap-2">
                        <Input
                          value={charge.name}
                          onChange={(e) => updateCharge(charge.id, 'name', e.target.value)}
                          placeholder="Charge name"
                          className="flex-1 h-9"
                        />
                        <div className="relative w-28">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <Input
                            type="number"
                            value={charge.amount || ''}
                            onChange={(e) => updateCharge(charge.id, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="h-9 pl-6 text-right"
                            min={0}
                            step={0.01}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCharge(charge.id)}
                          className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-gray-500">Additional Charges Total</span>
                      <span className="font-medium">{formatCurrency(totals.chargesTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Options */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <h4 className="font-medium text-gray-700">Payment Options</h4>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="showCreditCardStep1"
                    checked={showCreditCardOption}
                    onCheckedChange={(checked) => setShowCreditCardOption(checked === true)}
                  />
                  <Label htmlFor="showCreditCardStep1" className="text-sm text-gray-700 cursor-pointer">
                    Allow credit card payments (Stripe)
                  </Label>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-7">
                  {showCreditCardOption
                    ? 'Client will see credit card option with 3% processing fee'
                    : 'Client will only see e-Transfer and wire transfer options'}
                </p>
              </div>

              {/* Summary Preview */}
              {lineItems.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-3">Invoice Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Items ({lineItems.length})</span>
                      <span className="font-semibold">{formatCurrency(totals.itemsSubtotal)}</span>
                    </div>
                    {additionalCharges.length > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Additional Charges</span>
                        <span>{formatCurrency(totals.chargesTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>GST ({gstRate}%)</span>
                      <span>{formatCurrency(totals.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>QST ({qstRate}%)</span>
                      <span>{formatCurrency(totals.qstAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-700 font-medium">Total</span>
                      <span className="text-lg font-semibold text-green-600">{formatCurrency(totals.totalRevenue)}</span>
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
                          <span className="text-gray-500 text-sm">
                            Subtotal: <span className="font-medium text-gray-700">
                              {formatCurrency(items.reduce((sum, i) => sum + i.totalPrice, 0))}
                            </span>
                          </span>
                        </button>

                        {/* Items Table - with images, components shown as standard items */}
                        {expandedCategories.has(category) && (
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="w-[50%]">Item</TableHead>
                                <TableHead className="text-right w-[12%]">Qty</TableHead>
                                <TableHead className="text-right w-[18%]">Price (RRP)</TableHead>
                                <TableHead className="text-right w-[20%]">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id} className={cn("text-sm", item.isComponent && "bg-gray-50")}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {/* Item image */}
                                      {item.imageUrl ? (
                                        <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                          <img
                                            src={item.imageUrl}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                          <Package className="w-4 h-4 text-gray-300" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className={cn("font-medium truncate", item.isComponent && "text-gray-600")}>
                                          {item.isComponent && <span className="text-gray-400 mr-1">↳</span>}
                                          {item.name}
                                        </p>
                                        {item.roomName && !item.isComponent && (
                                          <p className="text-xs text-gray-400">{item.roomName}</p>
                                        )}
                                      </div>
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
            </div>
          )}

          {/* Step 3: Invoice Created - Client Preview & Send */}
          {step === 3 && createdQuote && (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Invoice Created!</h3>
                <p className="text-gray-500 mt-1">
                  {createdQuote.quoteNumber} • {lineItems.length} item{lineItems.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Client Preview - What the client will see */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-1">
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="p-4 border-b bg-gray-50">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Client Preview</p>
                    <h4 className="font-bold text-lg text-gray-900">{title}</h4>
                    {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
                  </div>

                  {/* Items - Client View (no markup/profit shown) */}
                  <div className="divide-y max-h-[250px] overflow-y-auto">
                    {lineItems.map((item) => (
                      <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                        {/* Image */}
                        {item.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">Qty: {item.quantity} {item.unitType}</p>
                        </div>
                        {/* Price */}
                        <p className="font-semibold text-gray-900 flex-shrink-0">
                          {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="p-4 bg-gray-50 border-t">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>GST ({gstRate}%)</span>
                        <span>{formatCurrency(totals.gstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>QST ({qstRate}%)</span>
                        <span>{formatCurrency(totals.qstAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t mt-2">
                        <span className="font-medium text-gray-700">Total</span>
                        <span className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalRevenue)}</span>
                      </div>
                    </div>
                    {validUntil && (
                      <p className="text-xs text-gray-400 mt-2">Valid until {new Date(validUntil).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Your Profit (separate, not in client view) */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-sm text-emerald-700">Your Profit (before taxes)</span>
                <span className="font-bold text-emerald-700">{formatCurrency(totals.grossProfit)} ({totals.marginPercent.toFixed(1)}%)</span>
              </div>

              {/* Bill To Section - Editable client info */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-gray-600" />
                  <h4 className="font-medium text-gray-900">Bill To</h4>
                  <span className="text-xs text-gray-400">(editable)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Client Name</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client name..."
                      className="bg-white h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Email</Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@email.com"
                      className="bg-white h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Phone number..."
                      className="bg-white h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Address</Label>
                    <Input
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Street, City, Postal Code"
                      className="bg-white h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Send to Client Section */}
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-gray-900">Send Invoice to Client</h4>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      {clientName && <span className="font-medium">{clientName}</span>}
                      {clientName && clientEmail && <span className="text-gray-400"> • </span>}
                      {clientEmail && <span className="text-blue-600">{clientEmail}</span>}
                    </p>
                    {!clientEmail && (
                      <p className="text-xs text-orange-600">
                        Please enter client email in Bill To section above
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSendToClient}
                    disabled={sending || !clientEmail}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Invoice
                  </Button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Client will receive email with invoice link and Stripe payment option
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setShowTestEmailDialog(true)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </Button>
                <Button variant="outline" onClick={handlePrintQuote}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print / Download PDF
                </Button>
                <Button variant="outline" onClick={handleViewQuote}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View as Client
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          {step === 3 ? (
            <>
              <div className="flex-1" />
              <Button onClick={handleFinish} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Done
              </Button>
            </>
          ) : (
            <>
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
                  Create Invoice ({formatCurrency(totals.totalRevenue)})
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Test Email Dialog */}
    <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Send a test invoice to preview exactly what the client will receive, including the payment link.
            </p>

            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testEmail.trim()) {
                    handleSendTestEmail()
                  }
                }}
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium">This will send a real email that:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-600">
                <li>Shows exactly what the client sees</li>
                <li>Contains the live invoice link</li>
                <li>Includes all payment options</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={sendingTest || !testEmail.trim()}
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

