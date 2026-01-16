'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Search,
  Package,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldX,
  FileText,
  DollarSign,
  AlertTriangle,
  Send,
  Mail,
  ExternalLink,
  Truck,
  Plus,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { calculateItemRRPTotal } from '@/lib/pricing'

interface CreateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSuccess: () => void
  preselectedItemIds?: string[]
  preselectedQuoteIds?: string[]
  preselectedQuoteData?: {
    supplierName: string
    quoteNumber: string
  }
  source?: 'specs' | 'quotes'
}

interface ComponentItem {
  id: string
  name: string
  modelNumber?: string
  image?: string
  price?: number | null
  priceWithMarkup?: number | null
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
  tradePrice?: number | null
  rrp?: number | null
  rrpCurrency?: string // CAD or USD
  supplierName?: string
  brand?: string
  images?: string[]
  clientApproved?: boolean
  clientApprovedAt?: string
  clientApprovedVia?: string
  specStatus?: string | null
  componentsTotal?: number // Total price of components (with markup)
  markupPercent?: number  // Markup percentage for components
  components?: ComponentItem[] // Component sub-items
}

// Statuses to exclude from client invoice (client/contractor order items)
const EXCLUDED_INVOICE_STATUSES = ['CLIENT_TO_ORDER', 'CONTRACTOR_TO_ORDER']

interface ApprovedQuote {
  id: string
  quoteNumber: string
  supplierName: string
  totalAmount: number
  lineItems: {
    id: string
    itemName: string
    unitPrice: number
    quantity: number
    totalPrice: number
    roomFFEItemId?: string
  }[]
}

interface LineItem {
  roomFFEItemId: string
  supplierQuoteId?: string
  displayName: string
  displayDescription?: string
  categoryName?: string
  roomName?: string
  quantity: number
  unitType: string
  clientUnitPrice: number
  clientTotalPrice: number
  supplierUnitPrice?: number
  supplierTotalPrice?: number
  markupValue?: number
  markupAmount?: number
  currency?: string // CAD or USD
  imageUrl?: string // Image for display (especially for components)
  isComponent?: boolean // Flag for component items
}

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
  preselectedItemIds,
  preselectedQuoteIds,
  preselectedQuoteData,
  source = 'specs'
}: CreateInvoiceDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSource, setActiveSource] = useState<'specs' | 'quotes'>(source)

  // Form data
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Due upon receipt')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  // Items
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [approvedQuotes, setApprovedQuotes] = useState<ApprovedQuote[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Test email state
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [createdQuote, setCreatedQuote] = useState<{ id: string; accessToken: string; quoteNumber: string } | null>(null)

  // Additional fees
  const [deliveryFee, setDeliveryFee] = useState<number>(0)
  const [customFees, setCustomFees] = useState<{ name: string; amount: number }[]>([])

  // Load data when dialog opens
  useEffect(() => {
    if (open && projectId) {
      loadData()
      loadProjectClient()
      // Set default valid until (30 days)
      const date = new Date()
      date.setDate(date.getDate() + 30)
      setValidUntil(date.toISOString().split('T')[0])
    }
  }, [open, projectId])

  // Pre-select items/quotes and auto-fill title
  useEffect(() => {
    if (preselectedItemIds?.length) {
      setSelectedItemIds(new Set(preselectedItemIds))
      setActiveSource('specs')
    }
    if (preselectedQuoteIds?.length) {
      setSelectedQuoteIds(new Set(preselectedQuoteIds))
      setActiveSource('quotes')
      // Auto-fill title from quote data
      if (preselectedQuoteData) {
        setTitle(`Invoice - ${preselectedQuoteData.supplierName}`)
      }
    }
  }, [preselectedItemIds, preselectedQuoteIds, preselectedQuoteData])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load spec items (only those with price)
      const specsRes = await fetch(`/api/projects/${projectId}/ffe-specs?hasPrice=true`)
      if (specsRes.ok) {
        const data = await specsRes.json()
        setSpecItems(data.items || [])
      }

      // Load approved supplier quotes
      const quotesRes = await fetch(`/api/projects/${projectId}/procurement/supplier-quotes?status=ACCEPTED`)
      if (quotesRes.ok) {
        const data = await quotesRes.json()
        setApprovedQuotes(data.quotes?.map((q: any) => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          supplierName: q.supplier.name,
          totalAmount: q.totalAmount,
          lineItems: q.lineItems.map((li: any) => ({
            id: li.id,
            itemName: li.itemName,
            unitPrice: li.unitPrice,
            quantity: li.quantity || li.requestedQuantity,
            totalPrice: li.totalPrice,
            roomFFEItemId: li.roomFFEItemId
          }))
        })) || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectClient = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const project = await res.json()
        if (project.client) {
          setClientName(project.client.name || '')
          setClientEmail(project.client.email || '')
        }
      }
    } catch (error) {
      console.error('Error loading project client:', error)
    }
  }

  // Filter out items with excluded statuses (client/contractor to order)
  const invoiceableSpecItems = useMemo(() => {
    return specItems.filter(item =>
      !EXCLUDED_INVOICE_STATUSES.includes(item.specStatus || '')
    )
  }, [specItems])

  // Group items by category
  const groupedItems = useMemo(() => {
    const filtered = invoiceableSpecItems.filter(item =>
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.reduce((groups: Record<string, SpecItem[]>, item) => {
      const key = item.category || item.sectionName || 'General'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {})
  }, [invoiceableSpecItems, searchQuery])

  // Items without valid price (cannot be invoiced - requires RRP)
  const itemsWithoutPrice = useMemo(() => {
    return invoiceableSpecItems.filter(item => !item.rrp)
  }, [invoiceableSpecItems])

  // Items not approved by client (cannot be invoiced)
  const itemsNotApproved = useMemo(() => {
    return invoiceableSpecItems.filter(item => !item.clientApproved && item.rrp)
  }, [invoiceableSpecItems])

  // Items already invoiced or paid (can still be selected but show warning)
  const itemsAlreadyInvoiced = useMemo(() => {
    return invoiceableSpecItems.filter(item =>
      item.specStatus === 'INVOICED_TO_CLIENT' || item.specStatus === 'CLIENT_PAID'
    )
  }, [invoiceableSpecItems])

  // Check which selected items are already invoiced or paid
  const selectedInvoicedItems = useMemo(() => {
    return invoiceableSpecItems.filter(item =>
      selectedItemIds.has(item.id) &&
      (item.specStatus === 'INVOICED_TO_CLIENT' || item.specStatus === 'CLIENT_PAID')
    )
  }, [invoiceableSpecItems, selectedItemIds])

  // Check if item can be invoiced (must have RRP AND be approved AND not excluded status)
  const canInvoiceItem = (item: SpecItem) => {
    return item.rrp && item.clientApproved && !EXCLUDED_INVOICE_STATUSES.includes(item.specStatus || '')
  }

  // Calculate item total using centralized pricing (includes components with markup)
  // Matches Budget Quote logic exactly
  const calculateItemTotal = (item: SpecItem): number => {
    // Use RRP or fall back to tradePrice (same as Budget Quote)
    const rrpToUse = item.rrp ?? item.tradePrice ?? 0

    // Use centralized pricing calculation that includes components
    return calculateItemRRPTotal({
      rrp: rrpToUse,
      quantity: item.quantity || 1,
      componentsTotal: item.componentsTotal,
      markupPercent: item.markupPercent
    })
  }

  // Build line items for invoice
  const buildLineItems = (): LineItem[] => {
    const lineItems: LineItem[] = []

    if (activeSource === 'specs') {
      // For approved budget items, add main item and each component as separate line items
      // This shows all items (including components) with picture, price, and name
      invoiceableSpecItems
        .filter(item => selectedItemIds.has(item.id))
        .forEach(item => {
          // Get base RRP (without components, they'll be separate line items)
          const baseRrp = item.rrp ?? item.tradePrice ?? 0
          const costPrice = item.tradePrice || 0

          // Add main item (without components total - components will be separate)
          lineItems.push({
            roomFFEItemId: item.id,
            displayName: item.name,
            displayDescription: item.description,
            categoryName: item.category || item.sectionName,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            unitType: item.unitType || 'units',
            clientUnitPrice: baseRrp,
            clientTotalPrice: baseRrp * (item.quantity || 1),
            supplierUnitPrice: costPrice,
            supplierTotalPrice: costPrice * (item.quantity || 1),
            markupValue: 0,
            markupAmount: 0,
            currency: item.rrpCurrency || 'CAD',
            imageUrl: item.images?.[0] || undefined,
            isComponent: false
          })

          // Add each component as a separate line item with its own image and price
          if (item.components && item.components.length > 0) {
            item.components.forEach(comp => {
              // Use price with markup for client-facing price
              const compPrice = comp.priceWithMarkup ?? comp.price ?? 0
              const compTotal = compPrice * (comp.quantity || 1)

              lineItems.push({
                roomFFEItemId: item.id, // Link to parent item
                displayName: `↳ ${comp.name}`, // Indent to show it's a component
                displayDescription: comp.modelNumber || undefined,
                categoryName: item.category || item.sectionName,
                roomName: item.roomName,
                quantity: comp.quantity || 1,
                unitType: 'units',
                clientUnitPrice: compPrice,
                clientTotalPrice: compTotal,
                supplierUnitPrice: comp.price || 0,
                supplierTotalPrice: (comp.price || 0) * (comp.quantity || 1),
                markupValue: 0,
                markupAmount: 0,
                currency: item.rrpCurrency || 'CAD',
                imageUrl: comp.image || undefined, // Component's own image
                isComponent: true
              })
            })
          }
        })
    } else {
      // For quotes, use the price directly without markup (RRP should already be set)
      approvedQuotes
        .filter(quote => selectedQuoteIds.has(quote.id))
        .forEach(quote => {
          quote.lineItems.forEach(li => {
            const price = li.unitPrice

            lineItems.push({
              roomFFEItemId: li.roomFFEItemId || '',
              supplierQuoteId: quote.id,
              displayName: li.itemName,
              categoryName: 'From Supplier Quote',
              quantity: li.quantity,
              unitType: 'units',
              clientUnitPrice: price,
              clientTotalPrice: price * li.quantity,
              supplierUnitPrice: price,
              supplierTotalPrice: li.totalPrice,
              markupValue: 0,
              markupAmount: 0
            })
          })
        })
    }

    return lineItems
  }

  // Calculate totals - separate CAD and USD
  const totals = useMemo(() => {
    const lineItems = buildLineItems()

    // Separate items by currency
    const cadItems = lineItems.filter(item => (item.currency || 'CAD') === 'CAD')
    const usdItems = lineItems.filter(item => item.currency === 'USD')

    const cadSubtotal = cadItems.reduce((sum, item) => sum + item.clientTotalPrice, 0)
    const usdSubtotal = usdItems.reduce((sum, item) => sum + item.clientTotalPrice, 0)

    const subtotal = cadSubtotal + usdSubtotal

    // Calculate total custom fees
    const customFeesTotal = customFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)

    // Taxable amount includes CAD items + delivery + custom fees (all in CAD)
    const taxableAmount = cadSubtotal + deliveryFee + customFeesTotal

    // Tax applies to CAD items + fees
    const gst = taxableAmount * 0.05
    const qst = taxableAmount * 0.09975
    const total = taxableAmount + gst + qst

    return {
      subtotal,
      cadSubtotal,
      usdSubtotal,
      deliveryFee,
      customFeesTotal,
      gst,
      qst,
      total,
      itemCount: lineItems.length,
      cadItemCount: cadItems.length,
      usdItemCount: usdItems.length
    }
  }, [selectedItemIds, selectedQuoteIds, activeSource, deliveryFee, customFees])

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

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const toggleQuote = (quoteId: string) => {
    setSelectedQuoteIds(prev => {
      const next = new Set(prev)
      if (next.has(quoteId)) {
        next.delete(quoteId)
      } else {
        next.add(quoteId)
      }
      return next
    })
  }

  const selectAllInCategory = (category: string, items: SpecItem[]) => {
    // Only select items that can be invoiced (have price AND approved)
    const validItems = items.filter(canInvoiceItem)
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      const allSelected = validItems.every(i => next.has(i.id))
      if (allSelected) {
        validItems.forEach(i => next.delete(i.id))
      } else {
        validItems.forEach(i => next.add(i.id))
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter an invoice title')
      return
    }

    const lineItems = buildLineItems()
    if (lineItems.length === 0) {
      toast.error('Please select at least one item')
      return
    }

    setSaving(true)
    try {
      // Use the same API as All Specs (/api/client-quotes)
      const res = await fetch('/api/client-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description: description || null,
          defaultMarkupPercent: 0, // No markup - using RRP directly
          validUntil: validUntil || null,
          paymentTerms: paymentTerms || null,
          groupingType: 'category',
          // Bill To information
          clientName: clientName || null,
          clientEmail: clientEmail || null,
          // Additional fees
          shippingCost: deliveryFee > 0 ? deliveryFee : null,
          customFees: customFees.filter(f => f.name && f.amount > 0),
          // Map line items - use RRP directly with 0% markup
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.roomFFEItemId || null,
            groupId: item.categoryName || 'From Supplier Quote',
            itemName: item.displayName,
            itemDescription: item.displayDescription || null,
            imageUrl: item.imageUrl || null,
            isComponent: item.isComponent || false,
            quantity: item.quantity,
            unitType: item.unitType,
            costPrice: item.clientUnitPrice, // Use RRP as cost
            markupPercent: 0, // No markup
            sellingPrice: item.clientUnitPrice,
            totalCost: item.clientTotalPrice,
            totalPrice: item.clientTotalPrice,
            order: index
          }))
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const data = await res.json()
      toast.success(`Invoice ${data.quote?.quoteNumber || 'created'} successfully`)
      onSuccess()
      resetForm()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  // Send test email - creates real invoice and sends to test email
  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address')
      return
    }

    if (!title.trim()) {
      toast.error('Please enter an invoice title')
      return
    }

    const lineItems = buildLineItems()
    if (lineItems.length === 0) {
      toast.error('Please select at least one item')
      return
    }

    setSendingTest(true)
    try {
      const res = await fetch('/api/client-quotes/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testEmail: testEmail.trim(),
          projectId,
          title,
          description: description || null,
          paymentTerms: paymentTerms || null,
          validDays: validUntil ? Math.ceil((new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 30,
          defaultMarkup: 0,
          allowCreditCard: true,
          // Additional fees
          shippingCost: deliveryFee > 0 ? deliveryFee : null,
          customFees: customFees.filter(f => f.name && f.amount > 0),
          lineItems: lineItems.map((item, index) => ({
            roomFFEItemId: item.roomFFEItemId || null,
            groupId: item.categoryName || 'Items',
            itemName: item.displayName,
            displayDescription: item.displayDescription || null,
            imageUrl: item.imageUrl || null,
            isComponent: item.isComponent || false,
            quantity: item.quantity,
            unitType: item.unitType,
            clientUnitPrice: item.clientUnitPrice,
            costPrice: item.supplierUnitPrice || item.clientUnitPrice,
            markupPercent: 0,
            order: index
          }))
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send test email')
      }

      const data = await res.json()
      setCreatedQuote({
        id: data.quoteId,
        accessToken: data.accessToken,
        quoteNumber: data.quoteNumber
      })
      toast.success(`Test email sent to ${testEmail.trim()}`)
      setShowTestEmailDialog(false)
      setTestEmail('')
    } catch (error: any) {
      console.error('Error sending test email:', error)
      toast.error(error.message || 'Failed to send test email')
    } finally {
      setSendingTest(false)
    }
  }

  // View invoice as client would see it
  const handleViewAsClient = () => {
    if (createdQuote?.id) {
      window.open(`/client/invoice/${createdQuote.id}`, '_blank')
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setSelectedItemIds(new Set())
    setSelectedQuoteIds(new Set())
    setSearchQuery('')
    setExpandedCategories(new Set())
    setShowTestEmailDialog(false)
    setTestEmail('')
    setCreatedQuote(null)
    setDeliveryFee(0)
    setCustomFees([])
  }

  // Custom fees helpers
  const addCustomFee = () => {
    setCustomFees(prev => [...prev, { name: '', amount: 0 }])
  }

  const updateCustomFee = (index: number, field: 'name' | 'amount', value: string | number) => {
    setCustomFees(prev => {
      const updated = [...prev]
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value as string }
      } else {
        updated[index] = { ...updated[index], amount: parseFloat(value as string) || 0 }
      }
      return updated
    })
  }

  const removeCustomFee = (index: number) => {
    setCustomFees(prev => prev.filter((_, i) => i !== index))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const canProceed = step === 1
    ? (activeSource === 'specs' ? selectedItemIds.size > 0 : selectedQuoteIds.size > 0)
    : title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Select Items for Invoice' : 'Invoice Details'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new client invoice by selecting items and entering details
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : step === 1 ? (
          <div className="flex-1 min-h-0">
            {/* Source Tabs */}
            <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as 'specs' | 'quotes')}>
              <TabsList className="mb-4">
                <TabsTrigger value="specs">From All Specs</TabsTrigger>
                <TabsTrigger value="quotes">From Approved Quotes</TabsTrigger>
              </TabsList>

              <TabsContent value="specs" className="mt-0">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Warning for items without price */}
                {itemsWithoutPrice.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-800">
                      {itemsWithoutPrice.length} item{itemsWithoutPrice.length !== 1 ? 's' : ''} cannot be invoiced (no RRP set)
                    </p>
                  </div>
                )}

                {/* Warning for items not approved */}
                {itemsNotApproved.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm">
                    <ShieldX className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-red-800">
                      {itemsNotApproved.length} item{itemsNotApproved.length !== 1 ? 's' : ''} need client approval before invoicing.
                      <span className="text-red-600 font-medium"> Approve in All Specs first.</span>
                    </p>
                  </div>
                )}

                {/* Info about already invoiced items */}
                {itemsAlreadyInvoiced.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-sm">
                    <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-800">
                      {itemsAlreadyInvoiced.length} item{itemsAlreadyInvoiced.length !== 1 ? 's are' : ' is'} already invoiced or paid.
                      <span className="text-blue-600"> You can still add them if needed (e.g., replacement item).</span>
                    </p>
                  </div>
                )}

                {/* Warning when selecting already invoiced items */}
                {selectedInvoicedItems.length > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg mb-4 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-800">
                      <span className="font-medium">{selectedInvoicedItems.length} selected item{selectedInvoicedItems.length !== 1 ? 's' : ''}</span> already invoiced/paid.
                      {selectedInvoicedItems.some(i => i.specStatus === 'CLIENT_PAID') && (
                        <span className="text-amber-700 font-medium"> Includes paid items!</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Items list */}
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="p-2">
                    {Object.entries(groupedItems).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No items with prices found
                      </div>
                    ) : (
                      Object.entries(groupedItems).map(([category, items]) => {
                        // Items that can be invoiced (have price AND approved)
                        const invoiceableItems = items.filter(canInvoiceItem)
                        const selectedCount = invoiceableItems.filter(i => selectedItemIds.has(i.id)).length
                        const isExpanded = expandedCategories.has(category)

                        return (
                          <div key={category} className="mb-2">
                            <button
                              onClick={() => toggleCategory(category)}
                              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="font-medium text-sm">{category}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {invoiceableItems.length} invoiceable
                                </Badge>
                                {items.length > invoiceableItems.length && (
                                  <Badge variant="outline" className="text-xs text-gray-400">
                                    {items.length - invoiceableItems.length} not ready
                                  </Badge>
                                )}
                              </div>
                              {selectedCount > 0 && (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  {selectedCount} selected
                                </Badge>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="ml-6 mt-1 space-y-1">
                                {/* Select all in category */}
                                {invoiceableItems.length > 1 && (
                                  <button
                                    onClick={() => selectAllInCategory(category, items)}
                                    className="text-xs text-blue-600 hover:text-blue-700 mb-2"
                                  >
                                    {invoiceableItems.every(i => selectedItemIds.has(i.id))
                                      ? 'Deselect all'
                                      : 'Select all approved'}
                                  </button>
                                )}

                                {items.map(item => {
                                  const hasPrice = !!item.rrp
                                  const isApproved = item.clientApproved
                                  const canInvoice = canInvoiceItem(item)
                                  const isSelected = selectedItemIds.has(item.id)
                                  const price = item.rrp || 0

                                  // Check if item is already invoiced or paid
                                  const isAlreadyInvoiced = item.specStatus === 'INVOICED_TO_CLIENT'
                                  const isPaid = item.specStatus === 'CLIENT_PAID'
                                  const hasInvoiceStatus = isAlreadyInvoiced || isPaid

                                  // Determine why item can't be invoiced
                                  const disabledReason = !hasPrice
                                    ? 'No RRP'
                                    : !isApproved
                                    ? 'Not approved'
                                    : null

                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        'flex items-center gap-3 p-2 rounded-lg border',
                                        canInvoice
                                          ? 'cursor-pointer hover:bg-gray-50'
                                          : 'opacity-60 cursor-not-allowed bg-gray-50',
                                        isSelected && 'border-emerald-300 bg-emerald-50',
                                        hasInvoiceStatus && !isSelected && 'border-amber-200 bg-amber-50/50'
                                      )}
                                      onClick={() => canInvoice && toggleItem(item.id)}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={!canInvoice}
                                        className={cn(!canInvoice && 'opacity-50')}
                                      />
                                      {item.images?.[0] && (
                                        <img
                                          src={item.images[0]}
                                          alt=""
                                          className="w-10 h-10 rounded object-cover"
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium text-sm truncate">{item.name}</p>
                                          {/* Approval indicator */}
                                          {isApproved ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Client Approved" />
                                          ) : hasPrice && (
                                            <ShieldX className="w-3.5 h-3.5 text-red-400 flex-shrink-0" title="Not Approved" />
                                          )}
                                          {/* Invoice/Paid status badges */}
                                          {isPaid && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 px-1.5 py-0">
                                              <DollarSign className="w-3 h-3 mr-0.5" />
                                              Paid
                                            </Badge>
                                          )}
                                          {isAlreadyInvoiced && (
                                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 px-1.5 py-0">
                                              <FileText className="w-3 h-3 mr-0.5" />
                                              Invoiced
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          {item.roomName && <span>{item.roomName}</span>}
                                          {item.brand && <span>• {item.brand}</span>}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        {canInvoice ? (
                                          <>
                                            <p className="font-medium text-sm">{formatCurrency(price)}</p>
                                            <p className="text-xs text-gray-500">
                                              Qty: {item.quantity || 1}
                                            </p>
                                          </>
                                        ) : (
                                          <p className={cn(
                                            "text-xs",
                                            !hasPrice ? "text-amber-600" : "text-red-500"
                                          )}>
                                            {disabledReason}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="quotes" className="mt-0">
                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-2 space-y-2">
                    {approvedQuotes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No approved supplier quotes found
                      </div>
                    ) : (
                      approvedQuotes.map(quote => {
                        const isSelected = selectedQuoteIds.has(quote.id)
                        return (
                          <div
                            key={quote.id}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer hover:bg-gray-50',
                              isSelected && 'border-emerald-300 bg-emerald-50'
                            )}
                            onClick={() => toggleQuote(quote.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isSelected} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{quote.supplierName}</p>
                                  <p className="font-medium">{formatCurrency(quote.totalAmount)}</p>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-500">
                                  <span>{quote.quoteNumber}</span>
                                  <span>{quote.lineItems.length} items</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t space-y-1">
                                {quote.lineItems.map(li => (
                                  <div key={li.id} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{li.itemName}</span>
                                    <span>{formatCurrency(li.unitPrice)} x {li.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Selection Summary */}
            {totals.itemCount > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Selected Items</span>
                  <span className="font-medium">{totals.itemCount}</span>
                </div>
                {/* Show CAD and USD subtotals separately */}
                {totals.cadSubtotal > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Subtotal (CAD)</span>
                    <span>{formatCurrency(totals.cadSubtotal)}</span>
                  </div>
                )}
                {totals.usdSubtotal > 0 && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Subtotal (USD)</span>
                    <span>US${totals.usdSubtotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totals.cadSubtotal > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST + QST (on CAD)</span>
                      <span>{formatCurrency(totals.gst + totals.qst)}</span>
                    </div>
                    <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                      <span>Total (CAD)</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                  </>
                )}
                {totals.usdSubtotal > 0 && (
                  <div className="flex justify-between font-medium mt-1">
                    <span>Total (USD)</span>
                    <span>US${totals.usdSubtotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Invoice Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Lighting & Fixtures - Phase 1"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes for the client"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="validUntil">Due Date</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input
                  id="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
            </div>

            {/* Additional Fees Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Additional Fees
              </h4>

              {/* Delivery Fee */}
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 text-gray-400" />
                <Label htmlFor="deliveryFee" className="min-w-24">Delivery</Label>
                <div className="relative flex-1 max-w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="deliveryFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee || ''}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Custom Fees */}
              {customFees.map((fee, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-4" />
                  <Input
                    value={fee.name}
                    onChange={(e) => updateCustomFee(index, 'name', e.target.value)}
                    placeholder="Fee name (e.g., Duties)"
                    className="flex-1"
                  />
                  <div className="relative max-w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fee.amount || ''}
                      onChange={(e) => updateCustomFee(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomFee(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {/* Add Custom Fee Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomFee}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Fee (Duties, Handling, etc.)
              </Button>
            </div>

            {/* Invoice Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-3">Invoice Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items</span>
                  <span>{totals.itemCount}</span>
                </div>
                {totals.cadSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal (CAD)</span>
                    <span>{formatCurrency(totals.cadSubtotal)}</span>
                  </div>
                )}
                {totals.usdSubtotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal (USD)</span>
                    <span>US${totals.usdSubtotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {/* Delivery Fee */}
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                {/* Custom Fees */}
                {customFees.filter(f => f.amount > 0).map((fee, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-gray-600">{fee.name || 'Custom Fee'}</span>
                    <span>{formatCurrency(fee.amount)}</span>
                  </div>
                ))}
                {(totals.cadSubtotal > 0 || deliveryFee > 0 || totals.customFeesTotal > 0) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">GST (5%)</span>
                      <span>{formatCurrency(totals.gst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">QST (9.975%)</span>
                      <span>{formatCurrency(totals.qst)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Total (CAD)</span>
                      <span className="text-lg">{formatCurrency(totals.total)}</span>
                    </div>
                  </>
                )}
                {totals.usdSubtotal > 0 && (
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Total (USD)</span>
                    <span className="text-lg">US${totals.usdSubtotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex-1" />
              {/* Test Email and View as Client buttons */}
              <Button
                variant="outline"
                onClick={() => setShowTestEmailDialog(true)}
                disabled={saving || !canProceed}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Test
              </Button>
              {createdQuote && (
                <Button variant="outline" onClick={handleViewAsClient}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View as Client
                </Button>
              )}
              <Button onClick={handleCreate} disabled={saving || !canProceed}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

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
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testEmail.trim()) {
                    handleSendTest()
                  }
                }}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                This will create a real invoice in the system and send the email with a working payment link.
                Use this to verify the client experience before sending to the actual client.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
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
    </Dialog>
  )
}
