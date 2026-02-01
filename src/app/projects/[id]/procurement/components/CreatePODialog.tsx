'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
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
  Loader2,
  Package,
  ShoppingCart,
  Building2,
  CreditCard,
  Truck,
  AlertCircle,
  Plus,
  X,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import AddressPicker from '@/components/shipping/AddressPicker'

// Ensure URLs use https to avoid mixed content warnings
const ensureHttps = (url: string | null | undefined): string | null => {
  if (!url) return null
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

interface ItemComponent {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
  imageUrl: string | null
}

interface SupplierQuoteInfo {
  id: string
  unitPrice: number
  totalPrice: number
  shippingCost: number | null
  currency: string
  quoteSubtotal: number | null
  quoteTotal: number | null
}

interface POItem {
  id: string
  name: string
  description: string | null
  roomName: string | null
  quantity: number
  imageUrl: string | null
  tradePrice: number | null
  currency: string
  hasQuote: boolean
  quoteUnitPrice: number | null
  quoteShippingCost: number | null
  supplierQuote: SupplierQuoteInfo | null
  components: ItemComponent[]
}

interface FlatItem {
  id: string
  name: string
  roomName: string | null
  quantity: number
  imageUrl: string | null
  unitPrice: number | null
  currency: string
  isComponent: boolean
  parentName?: string
  hasQuote: boolean
  quoteUnitPrice: number | null
}

interface ExtraCharge {
  id: string
  label: string
  amount: number
}

interface UploadedFile {
  id: string
  file: File
  title: string
  type: 'SPEC_SHEET' | 'DRAWING' | 'PHOTO' | 'OTHER'
  preview?: string
}

interface SavedPaymentMethod {
  id: string
  type: string
  nickname: string | null
  lastFour: string | null
  cardBrand: string | null
  expiry: string | null
  holderName: string | null
  hasFullCardDetails: boolean
}

interface CreatePODialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  supplier: {
    id: string
    name: string
    email: string | null
  }
  project?: {
    name: string
    address?: string | null
    defaultShippingAddress?: string
    client?: {
      name: string
      email: string | null
      phone: string | null
    } | null
  }
  onSuccess: () => void
}

export default function CreatePODialog({
  open,
  onOpenChange,
  projectId,
  supplier,
  project,
  onSuccess
}: CreatePODialogProps) {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [items, setItems] = useState<POItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)
  const [groupCurrency, setGroupCurrency] = useState('CAD')

  // Form state - shipping address as structured data
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada'
  })
  const [notes, setNotes] = useState('')
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('')

  // Extra charges
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([])
  const [newChargeLabel, setNewChargeLabel] = useState('')
  const [newChargeAmount, setNewChargeAmount] = useState('')

  // Tax options (default checked)
  const [includeGst, setIncludeGst] = useState(true)
  const [includeQst, setIncludeQst] = useState(true)
  const [useCustomTax, setUseCustomTax] = useState(false)
  const [customTaxPercent, setCustomTaxPercent] = useState('')
  const [customTaxLabel, setCustomTaxLabel] = useState('Custom Tax')

  // Deposit
  const [depositPercent, setDepositPercent] = useState<string>('')

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  // Tax rates
  const GST_RATE = 0.05 // 5%
  const QST_RATE = 0.09975 // 9.975%

  // Fetch items for this supplier
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/procurement/orders/ready-to-order?supplierId=${supplier.id}`
      )
      if (res.ok) {
        const data = await res.json()
        const supplierGroup = data.supplierGroups?.find(
          (g: any) => g.supplierId === supplier.id || g.supplierName === supplier.name
        )
        if (supplierGroup) {
          setGroupCurrency(supplierGroup.currency || 'CAD')
          const fetchedItems = supplierGroup.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            roomName: item.roomName,
            quantity: item.quantity || 1,
            imageUrl: item.imageUrl,
            tradePrice: item.tradePrice,
            currency: item.tradePriceCurrency || supplierGroup.currency || 'CAD',
            hasQuote: !!item.supplierQuote,
            quoteUnitPrice: item.supplierQuote?.unitPrice || null,
            quoteShippingCost: item.supplierQuote?.shippingCost || null,
            supplierQuote: item.supplierQuote || null,
            components: item.components || []
          }))
          setItems(fetchedItems)

          // Auto-add shipping from quote if exists
          const quoteShipping = fetchedItems.find((i: POItem) => i.quoteShippingCost && i.quoteShippingCost > 0)
          if (quoteShipping && quoteShipping.quoteShippingCost) {
            setExtraCharges([{
              id: 'quote-shipping',
              label: 'Shipping (from quote)',
              amount: quoteShipping.quoteShippingCost
            }])
          }
        } else {
          setItems([])
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [projectId, supplier.id, supplier.name])

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    setLoadingPaymentMethods(true)
    try {
      const res = await fetch('/api/saved-payment-methods')
      if (res.ok) {
        const data = await res.json()
        setPaymentMethods(data.paymentMethods || data.methods || [])
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    } finally {
      setLoadingPaymentMethods(false)
    }
  }, [])

  // Initialize when dialog opens
  useEffect(() => {
    if (open) {
      fetchItems()
      fetchPaymentMethods()
      // Parse default shipping address if available (simple string to structured)
      if (project?.defaultShippingAddress) {
        // Try to parse the address - it's usually a simple string
        // We'll just put it in the street field and let user adjust
        setShippingAddress({
          street: project.defaultShippingAddress,
          city: '',
          province: '',
          postalCode: '',
          country: 'Canada'
        })
      } else {
        setShippingAddress({
          street: '',
          city: '',
          province: '',
          postalCode: '',
          country: 'Canada'
        })
      }
      setNotes('')
      setSelectedPaymentMethodId('')
      setExtraCharges([])
      setNewChargeLabel('')
      setNewChargeAmount('')
      setIncludeGst(true)
      setIncludeQst(true)
      setUseCustomTax(false)
      setCustomTaxPercent('')
      setCustomTaxLabel('Custom Tax')
      setDepositPercent('')
      setUploadedFiles([])
    }
  }, [open, fetchItems, fetchPaymentMethods, project?.defaultShippingAddress])

  // Flatten items and components into single list
  // All prices come from spec trade prices
  const flatItems: FlatItem[] = []
  items.forEach(item => {
    flatItems.push({
      id: item.id,
      name: item.name,
      roomName: item.roomName,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      unitPrice: item.tradePrice,
      currency: item.currency || groupCurrency,
      isComponent: false,
      hasQuote: item.hasQuote,
      quoteUnitPrice: item.quoteUnitPrice
    })
    // Add components as regular line items
    if (item.components && item.components.length > 0) {
      item.components.forEach(comp => {
        flatItems.push({
          id: comp.id,
          name: comp.name,
          roomName: item.roomName,
          quantity: comp.quantity || 1,
          imageUrl: comp.imageUrl,
          unitPrice: comp.price,
          currency: item.currency || groupCurrency,
          isComponent: true,
          parentName: item.name,
          hasQuote: false,
          quoteUnitPrice: null
        })
      })
    }
  })

  // Calculate totals
  const calculateTotals = () => {
    let itemsSubtotal = 0
    flatItems.forEach(item => {
      itemsSubtotal += (item.unitPrice || 0) * item.quantity
    })

    const extraChargesTotal = extraCharges.reduce((sum, c) => sum + c.amount, 0)
    const subtotalBeforeTax = itemsSubtotal + extraChargesTotal

    const gstAmount = includeGst ? subtotalBeforeTax * GST_RATE : 0
    const qstAmount = includeQst ? subtotalBeforeTax * QST_RATE : 0
    const customTaxRate = useCustomTax && customTaxPercent ? parseFloat(customTaxPercent) / 100 : 0
    const customTaxAmount = useCustomTax ? subtotalBeforeTax * customTaxRate : 0
    const totalTax = gstAmount + qstAmount + customTaxAmount
    const total = subtotalBeforeTax + totalTax

    // Calculate deposit
    const depositPercentNum = parseFloat(depositPercent) || 0
    const depositAmount = depositPercentNum > 0 ? (total * depositPercentNum / 100) : 0
    const balanceDue = total - depositAmount

    return {
      itemsSubtotal,
      extraChargesTotal,
      subtotalBeforeTax,
      gstAmount,
      qstAmount,
      customTaxAmount,
      totalTax,
      total,
      depositAmount,
      balanceDue
    }
  }

  const totals = calculateTotals()

  // Quote comparison - compares PO items total vs supplier quote total
  // Uses the actual SupplierQuote total (not calculated from line items)
  const getQuoteComparison = () => {
    // Find an item with a quote to get the full quote totals
    const itemWithQuote = items.find(i => i.hasQuote && i.supplierQuote)
    if (!itemWithQuote || !itemWithQuote.supplierQuote) return null

    // Use actual quote totals from SupplierQuote record
    const quoteSubtotal = itemWithQuote.supplierQuote.quoteSubtotal
    const quoteTotal = itemWithQuote.supplierQuote.quoteTotal
    const quoteShipping = itemWithQuote.supplierQuote.shippingCost || 0

    // If we don't have the actual quote total, skip comparison
    if (quoteSubtotal === null && quoteTotal === null) return null

    // Use quoteSubtotal for comparison (before shipping)
    const supplierQuoteAmount = quoteSubtotal || quoteTotal || 0
    const poItemsTotal = totals.itemsSubtotal
    const difference = poItemsTotal - supplierQuoteAmount

    return {
      supplierQuoteAmount,
      quoteShipping,
      poItemsTotal,
      poItemsCount: flatItems.length,
      difference,
      matches: Math.abs(difference) < 0.01
    }
  }

  const quoteComparison = getQuoteComparison()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const addExtraCharge = () => {
    if (!newChargeLabel.trim() || !newChargeAmount) return
    const amount = parseFloat(newChargeAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setExtraCharges([...extraCharges, {
      id: `charge-${Date.now()}`,
      label: newChargeLabel.trim(),
      amount
    }])
    setNewChargeLabel('')
    setNewChargeAmount('')
  }

  const removeExtraCharge = (id: string) => {
    setExtraCharges(extraCharges.filter(c => c.id !== id))
  }

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles: UploadedFile[] = []
    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/')
      const fileType = isImage ? 'PHOTO' : (file.type === 'application/pdf' ? 'SPEC_SHEET' : 'OTHER')

      const uploadedFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for title
        type: fileType,
        preview: isImage ? URL.createObjectURL(file) : undefined
      }
      newFiles.push(uploadedFile)
    })

    setUploadedFiles([...uploadedFiles, ...newFiles])
    e.target.value = '' // Reset input
  }

  const updateFileTitle = (id: string, title: string) => {
    setUploadedFiles(uploadedFiles.map(f =>
      f.id === id ? { ...f, title } : f
    ))
  }

  const updateFileType = (id: string, type: UploadedFile['type']) => {
    setUploadedFiles(uploadedFiles.map(f =>
      f.id === id ? { ...f, type } : f
    ))
  }

  const removeFile = (id: string) => {
    const file = uploadedFiles.find(f => f.id === id)
    if (file?.preview) {
      URL.revokeObjectURL(file.preview)
    }
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id))
  }

  // Upload files to order after creation
  const uploadFilesToOrder = async (orderId: string) => {
    for (const uploadedFile of uploadedFiles) {
      try {
        const formData = new FormData()
        formData.append('file', uploadedFile.file)
        formData.append('title', uploadedFile.title)
        formData.append('type', uploadedFile.type)

        await fetch(`/api/orders/${orderId}/documents`, {
          method: 'POST',
          body: formData
        })
      } catch (error) {
        console.error('Failed to upload file:', uploadedFile.title, error)
      }
    }
  }

  // Format shipping address for API
  const formatShippingAddress = () => {
    const parts = []
    if (shippingAddress.street) parts.push(shippingAddress.street)
    if (shippingAddress.city) parts.push(shippingAddress.city)
    if (shippingAddress.province) parts.push(shippingAddress.province)
    if (shippingAddress.postalCode) parts.push(shippingAddress.postalCode)
    if (shippingAddress.country && shippingAddress.country !== 'Canada') parts.push(shippingAddress.country)
    return parts.join(', ')
  }

  const handleCreate = async () => {
    if (flatItems.length === 0) {
      toast.error('No items to order')
      return
    }

    const itemsWithoutPrices = flatItems.filter(i => !i.unitPrice)
    if (itemsWithoutPrices.length > 0) {
      toast.error(`${itemsWithoutPrices.length} item(s) don't have trade prices`)
      return
    }

    setCreating(true)
    try {
      const mainItems = items.map(item => ({
        roomFFEItemId: item.id,
        unitPrice: item.quoteUnitPrice || item.tradePrice || 0,
        quantity: item.quantity
      }))

      const formattedAddress = formatShippingAddress()

      const res = await fetch(`/api/projects/${projectId}/procurement/orders/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          vendorName: supplier.name,
          vendorEmail: supplier.email,
          items: mainItems,
          shippingAddress: formattedAddress || undefined,
          notes: notes.trim() || undefined,
          savedPaymentMethodId: selectedPaymentMethodId || undefined,
          shippingCost: extraCharges.find(c => c.label.toLowerCase().includes('shipping'))?.amount || undefined,
          extraCharges: extraCharges.filter(c => !c.label.toLowerCase().includes('shipping')),
          // Tax options
          includeGst,
          includeQst,
          customTaxPercent: useCustomTax && customTaxPercent ? parseFloat(customTaxPercent) : undefined,
          customTaxLabel: useCustomTax ? customTaxLabel : undefined,
          taxAmount: totals.totalTax > 0 ? totals.totalTax : undefined,
          // Deposit
          depositPercent: depositPercent ? parseFloat(depositPercent) : undefined,
          depositRequired: totals.depositAmount > 0 ? totals.depositAmount : undefined
        })
      })

      if (res.ok) {
        const data = await res.json()

        // Upload any attached files
        if (uploadedFiles.length > 0) {
          toast.info('Uploading documents...')
          await uploadFilesToOrder(data.order.id)
        }

        toast.success(`PO ${data.order.orderNumber} created for ${supplier.name}`)
        onSuccess()
        onOpenChange(false)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to create order')
      }
    } catch (error) {
      toast.error('Failed to create order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            Create a PO for {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 -mx-1">
          <div className="space-y-6 py-4">
            {/* Project & Client Info */}
            {project && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Project</p>
                    <p className="font-semibold text-gray-900">{project.name}</p>
                  </div>
                  {project.client && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Client</p>
                      <p className="font-medium text-gray-900">{project.client.name}</p>
                    </div>
                  )}
                </div>
                {project.defaultShippingAddress && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Ship To</p>
                    <p className="text-sm text-gray-700">{project.defaultShippingAddress}</p>
                  </div>
                )}
              </div>
            )}

            {/* Supplier Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Supplier</p>
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{supplier.name}</p>
                  {supplier.email && (
                    <p className="text-sm text-blue-700">{supplier.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Comparison */}
            {quoteComparison && (
              <div className={`p-4 rounded-lg border ${
                quoteComparison.matches
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className={`w-4 h-4 ${
                    quoteComparison.matches ? 'text-green-600' : 'text-amber-600'
                  }`} />
                  <p className={`text-sm font-medium ${
                    quoteComparison.matches ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    Quote Comparison
                  </p>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Supplier Quote (subtotal):</span>
                    <span>{formatCurrency(quoteComparison.supplierQuoteAmount)}{groupCurrency === 'USD' ? ' USD' : ''}</span>
                  </div>
                  {quoteComparison.quoteShipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quote Shipping/Freight:</span>
                      <span>{formatCurrency(quoteComparison.quoteShipping)}{groupCurrency === 'USD' ? ' USD' : ''}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">PO Items ({quoteComparison.poItemsCount}):</span>
                    <span>{formatCurrency(quoteComparison.poItemsTotal)}{groupCurrency === 'USD' ? ' USD' : ''}</span>
                  </div>
                  {!quoteComparison.matches && (
                    <div className={`flex justify-between font-medium pt-1 border-t mt-1 ${
                      quoteComparison.difference > 0 ? 'text-amber-700' : 'text-green-700'
                    }`}>
                      <span>Difference:</span>
                      <span>{quoteComparison.difference > 0 ? '+' : ''}{formatCurrency(quoteComparison.difference)}</span>
                    </div>
                  )}
                </div>
                {quoteComparison.matches ? (
                  <div className="flex items-center gap-1 mt-2 text-green-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    PO matches supplier quote
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-2 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    PO doesn't match quote - check items/prices
                  </div>
                )}
              </div>
            )}

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Items ({flatItems.length})
                </h3>
                {groupCurrency === 'USD' && (
                  <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                    USD
                  </Badge>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : flatItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No items ready to order for this supplier</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flatItems.map((item, idx) => {
                    const totalPrice = (item.unitPrice || 0) * item.quantity

                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={ensureHttps(item.imageUrl) || ''}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.name}
                              {item.hasQuote && (
                                <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                  Quoted
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {item.roomName && <span>{item.roomName}</span>}
                              {item.roomName && <span>•</span>}
                              <span>Qty: {item.quantity}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {item.unitPrice ? (
                            <>
                              <p className="font-medium text-gray-900">
                                {formatCurrency(totalPrice)}{groupCurrency === 'USD' ? ' USD' : ''}
                              </p>
                              {item.quantity > 1 && (
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(item.unitPrice)} × {item.quantity}
                                </p>
                              )}
                            </>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No price
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Extra Charges */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Additional Charges
              </h3>

              {extraCharges.length > 0 && (
                <div className="space-y-2">
                  {extraCharges.map(charge => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <span className="text-sm text-gray-700">{charge.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatCurrency(charge.amount)}{groupCurrency === 'USD' ? ' USD' : ''}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => removeExtraCharge(charge.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Delivery, Tax, Installation..."
                  value={newChargeLabel}
                  onChange={(e) => setNewChargeLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={newChargeAmount}
                  onChange={(e) => setNewChargeAmount(e.target.value)}
                  className="w-28"
                  step="0.01"
                  min="0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addExtraCharge}
                  disabled={!newChargeLabel.trim() || !newChargeAmount}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Add delivery, installation, or other charges
              </p>
            </div>

            {/* Tax Options */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Taxes</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-gst"
                    checked={includeGst}
                    onCheckedChange={(checked) => setIncludeGst(checked === true)}
                  />
                  <Label htmlFor="include-gst" className="text-sm font-normal cursor-pointer">
                    GST (5%)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-qst"
                    checked={includeQst}
                    onCheckedChange={(checked) => setIncludeQst(checked === true)}
                  />
                  <Label htmlFor="include-qst" className="text-sm font-normal cursor-pointer">
                    QST (9.975%)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-custom-tax"
                    checked={useCustomTax}
                    onCheckedChange={(checked) => setUseCustomTax(checked === true)}
                  />
                  <Label htmlFor="use-custom-tax" className="text-sm font-normal cursor-pointer">
                    Custom
                  </Label>
                </div>
              </div>
              {/* Custom Tax Input */}
              {useCustomTax && (
                <div className="flex items-center gap-3 pl-6 pt-2">
                  <Input
                    value={customTaxLabel}
                    onChange={(e) => setCustomTaxLabel(e.target.value)}
                    placeholder="Tax name"
                    className="w-32 h-8 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={customTaxPercent}
                      onChange={(e) => setCustomTaxPercent(e.target.value)}
                      placeholder="0"
                      className="w-20 h-8 text-sm"
                      step="0.01"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  {customTaxPercent && totals.customTaxAmount > 0 && (
                    <span className="text-sm text-gray-600">
                      = {formatCurrency(totals.customTaxAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Deposit */}
            <div className="space-y-2">
              <Label>Deposit Required (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-24"
                  min="0"
                  max="100"
                  step="1"
                />
                <span className="text-sm text-gray-500">%</span>
                {totals.depositAmount > 0 && (
                  <span className="text-sm font-medium text-blue-600">
                    = {formatCurrency(totals.depositAmount)}{groupCurrency === 'USD' ? ' USD' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Enter deposit percentage if supplier requires upfront payment
              </p>
            </div>

            {/* Shipping Address */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-500" />
                Ship To Address
              </Label>
              <AddressPicker
                value={shippingAddress}
                onChange={setShippingAddress}
                showSavedAddresses={true}
                placeholder="Select or enter shipping address"
              />
            </div>

            {/* Credit Card for Supplier */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                Payment Method for Supplier
              </Label>
              <Select
                value={selectedPaymentMethodId || 'none'}
                onValueChange={(val) => setSelectedPaymentMethodId(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a card for supplier to charge..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No payment method</SelectItem>
                  {loadingPaymentMethods ? (
                    <SelectItem value="_loading" disabled>Loading...</SelectItem>
                  ) : paymentMethods.length === 0 ? (
                    <SelectItem value="_empty" disabled>No saved payment methods</SelectItem>
                  ) : (
                    paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        <div className="flex items-center gap-2">
                          <span>{pm.nickname || `${pm.cardBrand} ****${pm.lastFour}`}</span>
                          {pm.hasFullCardDetails && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              Full Details
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedPaymentMethodId && paymentMethods.find(pm => pm.id === selectedPaymentMethodId)?.hasFullCardDetails && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Full card details will be included in the PO for supplier to charge
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Order Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes visible on PO..."
                rows={2}
              />
            </div>

            {/* Documents & Photos */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Documents & Photos
              </h3>
              <p className="text-xs text-gray-500">
                Upload spec sheets, drawings, or photos to include with this PO
              </p>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-white border rounded-lg"
                    >
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.title}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Input
                          value={file.title}
                          onChange={(e) => updateFileTitle(file.id, e.target.value)}
                          className="h-8 text-sm mb-1"
                          placeholder="Document title"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={file.type}
                            onChange={(e) => updateFileType(file.id, e.target.value as UploadedFile['type'])}
                            className="text-xs h-6 rounded border border-gray-200 bg-white px-2"
                          >
                            <option value="SPEC_SHEET">Spec Sheet</option>
                            <option value="DRAWING">Drawing</option>
                            <option value="PHOTO">Photo</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <span className="text-xs text-gray-400 truncate">
                            {file.file.name}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => removeFile(file.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Click to upload documents or photos
                    </span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>
            </div>

            {/* Totals */}
            {flatItems.length > 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-emerald-700">Items Subtotal ({flatItems.length})</p>
                  <p className="font-medium text-emerald-800">
                    {formatCurrency(totals.itemsSubtotal)}{groupCurrency === 'USD' ? ' USD' : ''}
                  </p>
                </div>
                {extraCharges.map(charge => (
                  <div key={charge.id} className="flex items-center justify-between">
                    <p className="text-sm text-emerald-700">{charge.label}</p>
                    <p className="font-medium text-emerald-800">
                      {formatCurrency(charge.amount)}{groupCurrency === 'USD' ? ' USD' : ''}
                    </p>
                  </div>
                ))}
                {(includeGst || includeQst || useCustomTax) && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                      <p className="text-sm text-emerald-700">Subtotal</p>
                      <p className="font-medium text-emerald-800">
                        {formatCurrency(totals.subtotalBeforeTax)}{groupCurrency === 'USD' ? ' USD' : ''}
                      </p>
                    </div>
                    {includeGst && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-emerald-700">GST (5%)</p>
                        <p className="font-medium text-emerald-800">
                          {formatCurrency(totals.gstAmount)}{groupCurrency === 'USD' ? ' USD' : ''}
                        </p>
                      </div>
                    )}
                    {includeQst && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-emerald-700">QST (9.975%)</p>
                        <p className="font-medium text-emerald-800">
                          {formatCurrency(totals.qstAmount)}{groupCurrency === 'USD' ? ' USD' : ''}
                        </p>
                      </div>
                    )}
                    {useCustomTax && customTaxPercent && totals.customTaxAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-emerald-700">{customTaxLabel} ({customTaxPercent}%)</p>
                        <p className="font-medium text-emerald-800">
                          {formatCurrency(totals.customTaxAmount)}{groupCurrency === 'USD' ? ' USD' : ''}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                  <p className="font-semibold text-emerald-800">Total</p>
                  <p className="text-xl font-bold text-emerald-900">
                    {formatCurrency(totals.total)}{groupCurrency === 'USD' ? ' USD' : ''}
                  </p>
                </div>
                {totals.depositAmount > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200 mt-2">
                      <p className="text-sm text-blue-700 font-medium">Deposit Required ({depositPercent}%)</p>
                      <p className="font-bold text-blue-700">
                        {formatCurrency(totals.depositAmount)}{groupCurrency === 'USD' ? ' USD' : ''}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">Balance Due</p>
                      <p className="font-medium text-gray-700">
                        {formatCurrency(totals.balanceDue)}{groupCurrency === 'USD' ? ' USD' : ''}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || flatItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4 mr-2" />
            )}
            Create Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
