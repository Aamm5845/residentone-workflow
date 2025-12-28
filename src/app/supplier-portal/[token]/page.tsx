'use client'

import { useState, useEffect, use, useRef } from 'react'
import {
  Building2,
  Package,
  Clock,
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
  DollarSign,
  FileText,
  Upload,
  X,
  File,
  MapPin,
  User,
  Phone,
  Mail,
  Truck,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import SupplierMessaging from '@/components/supplier-portal/SupplierMessaging'

interface SupplierPortalPageProps {
  params: Promise<{ token: string }>
}

interface RFQData {
  rfq: {
    id: string
    rfqNumber: string
    title: string
    description?: string
    responseDeadline?: string
    validUntil?: string
    project: {
      name: string
      streetAddress?: string
      city?: string
      province?: string
      postalCode?: string
      client?: {
        name: string
        email: string
        phone?: string
        company?: string
      }
    }
    lineItems: Array<{
      id: string
      itemName: string
      itemDescription?: string
      quantity: number
      unitType?: string
      specifications?: any
      notes?: string
      category?: string
      roomFFEItem?: {
        images?: string[]
        brand?: string
        sku?: string
        color?: string
        finish?: string
        material?: string
        width?: string
        height?: string
        depth?: string
        documents?: Array<{
          id: string
          title: string
          fileName: string
          fileUrl: string
          mimeType: string
          type: string
        }>
      }
    }>
  }
  supplier: {
    name?: string
    email?: string
  }
  existingQuote: any
  responseStatus: string
  allProjectItems?: Array<{
    id: string
    rfqNumber: string
    itemName: string
    itemDescription?: string
    quantity: number
    unitType?: string
    category?: string
    roomFFEItem?: {
      images?: string[]
      brand?: string
      sku?: string
    }
    isCurrentRfq: boolean
    hasQuote: boolean
    quoteStatus: string
    quotedPrice?: number
    quotedAt?: string
  }>
}

interface QuoteLineItem {
  rfqLineItemId: string
  unitPrice: string
  quantity: number
  availability: string
  leadTimeWeeks: string
  notes: string
}

interface AIMatchResult {
  status: 'matched' | 'partial' | 'missing' | 'extra'
  confidence: number
  rfqItem?: {
    id: string
    itemName: string
    quantity: number
    sku?: string
    brand?: string
  }
  extractedItem?: {
    productName: string
    sku?: string
    quantity?: number
    unitPrice?: number
    totalPrice?: number
    brand?: string
    description?: string
    leadTime?: string
  }
  discrepancies?: string[]
}

interface AIMatchResponse {
  success: boolean
  supplierInfo: {
    companyName?: string
    quoteNumber?: string
    quoteDate?: string
    validUntil?: string
    subtotal?: number
    taxes?: number
    total?: number
  }
  matchResults: AIMatchResult[]
  summary: {
    totalRequested: number
    matched: number
    partial: number
    missing: number
    extra: number
    extractedTotal: number
    quoteTotal: number | null
  }
  notes?: string
}

export default function SupplierPortalPage({ params }: SupplierPortalPageProps) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RFQData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitMode, setSubmitMode] = useState<'upload' | 'detailed'>('upload')
  const [showAllItems, setShowAllItems] = useState(false)
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTotalAmount, setUploadTotalAmount] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')

  // AI Match state
  const [aiMatching, setAiMatching] = useState(false)
  const [aiMatchResult, setAiMatchResult] = useState<AIMatchResponse | null>(null)
  const [showAiResults, setShowAiResults] = useState(false)

  // Tax fields (Quebec GST/QST)
  const [includeTaxes, setIncludeTaxes] = useState(false)
  const [gstRate, setGstRate] = useState('5') // 5% GST
  const [qstRate, setQstRate] = useState('9.975') // 9.975% QST

  // Delivery fields
  const [includeDelivery, setIncludeDelivery] = useState(false)
  const [deliveryType, setDeliveryType] = useState<'flat' | 'per_item' | 'included'>('flat')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // Quote form state
  const [quoteNumber, setQuoteNumber] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [shippingTerms, setShippingTerms] = useState('')
  const [estimatedLeadTime, setEstimatedLeadTime] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])

  useEffect(() => {
    loadRFQ()
  }, [token])

  const loadRFQ = async () => {
    try {
      const response = await fetch(`/api/supplier-portal/${token}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)

        // Initialize line items from RFQ
        const items = result.rfq.lineItems.map((item: any) => ({
          rfqLineItemId: item.id,
          unitPrice: '',
          quantity: item.quantity,
          availability: 'IN_STOCK',
          leadTimeWeeks: '',
          notes: ''
        }))
        setLineItems(items)

        // Check if already submitted
        if (result.existingQuote || result.responseStatus === 'SUBMITTED') {
          setSubmitted(true)
        }

        // Auto-detect Quebec for tax defaults
        if (result.rfq.project?.province?.toLowerCase().includes('quebec') ||
            result.rfq.project?.province?.toLowerCase() === 'qc') {
          setIncludeTaxes(true)
        }
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to load quote request')
      }
    } catch (err) {
      setError('Failed to load quote request')
    } finally {
      setLoading(false)
    }
  }

  const updateLineItem = (index: number, field: keyof QuoteLineItem, value: string | number) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice) || 0
      return sum + (price * item.quantity)
    }, 0)
  }

  const calculateDeliveryTotal = () => {
    if (!includeDelivery || deliveryType === 'included') return 0
    if (deliveryType === 'flat') return parseFloat(deliveryFee) || 0
    if (deliveryType === 'per_item') {
      const perItemFee = parseFloat(deliveryFee) || 0
      return lineItems.reduce((sum, item) => sum + (perItemFee * item.quantity), 0)
    }
    return 0
  }

  const calculateTaxes = () => {
    if (!includeTaxes) return { gst: 0, qst: 0 }
    const subtotal = calculateSubtotal() + calculateDeliveryTotal()
    const gst = subtotal * (parseFloat(gstRate) / 100)
    const qst = subtotal * (parseFloat(qstRate) / 100)
    return { gst, qst }
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const delivery = calculateDeliveryTotal()
    const { gst, qst } = calculateTaxes()
    return subtotal + delivery + gst + qst
  }

  const handleSubmit = async () => {
    // Validate
    const hasEmptyPrices = lineItems.some(item => !item.unitPrice || parseFloat(item.unitPrice) <= 0)
    if (hasEmptyPrices) {
      toast.error('Please enter a price for all items')
      return
    }

    setSubmitting(true)
    try {
      const { gst, qst } = calculateTaxes()
      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quoteNumber: quoteNumber || `SQ-${Date.now()}`,
          validUntil: validUntil || null,
          paymentTerms,
          shippingTerms: shippingTerms || null,
          estimatedLeadTime: estimatedLeadTime || null,
          supplierNotes: supplierNotes || null,
          // Tax and delivery info
          includeTaxes,
          gstAmount: gst,
          qstAmount: qst,
          includeDelivery,
          deliveryType: includeDelivery ? deliveryType : null,
          deliveryFee: calculateDeliveryTotal(),
          deliveryNotes: deliveryNotes || null,
          lineItems: lineItems.map(item => ({
            ...item,
            unitPrice: parseFloat(item.unitPrice),
            leadTimeWeeks: item.leadTimeWeeks ? parseInt(item.leadTimeWeeks) : null
          }))
        })
      })

      if (response.ok) {
        toast.success('Quote submitted successfully!')
        setSubmitted(true)
      } else {
        const err = await response.json()
        toast.error(err.error || 'Failed to submit quote')
      }
    } catch (err) {
      toast.error('Failed to submit quote')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this quote request?')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          declineReason: 'Unable to quote at this time'
        })
      })

      if (response.ok) {
        toast.success('Quote request declined')
        setSubmitted(true)
        setData(prev => prev ? { ...prev, responseStatus: 'DECLINED' } : null)
      } else {
        toast.error('Failed to decline')
      }
    } catch (err) {
      toast.error('Failed to decline')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, Word, Excel, or image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch(`/api/supplier-portal/${token}/upload`, {
        method: 'POST',
        body: formData
      })

      if (uploadResponse.ok) {
        const data = await uploadResponse.json()
        setUploadedFileUrl(data.url)
        toast.success('Quote document uploaded successfully')
      } else {
        const errorData = await uploadResponse.json()
        toast.error(errorData.error || 'Failed to upload file')
        setUploadedFile(null)
      }
    } catch (err) {
      toast.error('Failed to upload file')
      setUploadedFile(null)
    } finally {
      setUploading(false)
    }
  }

  const removeUploadedFile = () => {
    setUploadedFile(null)
    setUploadedFileUrl(null)
    setAiMatchResult(null)
    setShowAiResults(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAIMatch = async () => {
    if (!uploadedFileUrl) {
      toast.error('Please upload a quote document first')
      return
    }

    // Check if it's an image file (AI Vision works best with images)
    const isImage = uploadedFile?.type.startsWith('image/')
    if (!isImage) {
      toast.error('AI matching works best with image files (PNG, JPG). For PDF files, please take a screenshot of the quote.')
      return
    }

    setAiMatching(true)
    setAiMatchResult(null)

    try {
      const response = await fetch(`/api/supplier-portal/${token}/ai-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: uploadedFileUrl,
          fileType: uploadedFile?.type
        })
      })

      const result = await response.json()

      if (result.success) {
        setAiMatchResult(result)
        setShowAiResults(true)

        // Auto-fill the total amount if extracted
        if (result.supplierInfo?.total && !uploadTotalAmount) {
          setUploadTotalAmount(result.supplierInfo.total.toString())
        }

        toast.success(`AI analyzed your quote: ${result.summary.matched} matched, ${result.summary.missing} missing items`)
      } else {
        toast.error(result.message || 'Failed to analyze quote')
      }
    } catch (err) {
      toast.error('Failed to analyze quote with AI')
    } finally {
      setAiMatching(false)
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadedFileUrl) {
      toast.error('Please upload your quote document first')
      return
    }

    setSubmitting(true)
    try {
      const { gst, qst } = calculateTaxes()
      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quoteNumber: `SQ-${Date.now()}`,
          quoteDocumentUrl: uploadedFileUrl,
          totalAmount: uploadTotalAmount ? parseFloat(uploadTotalAmount) : null,
          supplierNotes: uploadNotes || null,
          // Tax and delivery info
          includeTaxes,
          gstAmount: gst,
          qstAmount: qst,
          includeDelivery,
          deliveryType: includeDelivery ? deliveryType : null,
          deliveryFee: calculateDeliveryTotal(),
          deliveryNotes: deliveryNotes || null,
          lineItems: data?.rfq.lineItems.map(item => ({
            rfqLineItemId: item.id,
            unitPrice: 0,
            quantity: item.quantity,
            availability: 'IN_STOCK',
            leadTimeWeeks: null,
            notes: 'See attached quote document'
          })) || []
        })
      })

      if (response.ok) {
        toast.success('Quote submitted successfully!')
        setSubmitted(true)
      } else {
        const err = await response.json()
        toast.error(err.error || 'Failed to submit quote')
      }
    } catch (err) {
      toast.error('Failed to submit quote')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading quote request...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
            <p className="text-gray-500">
              This link may have expired or is invalid.
              Please contact the sender for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  if (submitted || data.responseStatus !== 'PENDING') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              data.responseStatus === 'DECLINED' ? "bg-gray-100" : "bg-green-100"
            )}>
              <CheckCircle className={cn(
                "w-8 h-8",
                data.responseStatus === 'DECLINED' ? "text-gray-500" : "text-green-500"
              )} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {data.responseStatus === 'DECLINED' ? 'Quote Declined' : 'Quote Submitted'}
            </h2>
            <p className="text-gray-500">
              {data.responseStatus === 'DECLINED'
                ? 'You have declined this quote request.'
                : 'Thank you! Your quote has been submitted successfully.'}
            </p>
            {data.existingQuote && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Quote Reference</span>
                  <span className="font-medium">{data.existingQuote.quoteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Amount</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(data.existingQuote.totalAmount || 0)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <SupplierMessaging
          token={token}
          projectName={data.rfq.project.name}
          supplierName={data.supplier.name}
        />
      </div>
    )
  }

  const project = data.rfq.project
  const hasShippingAddress = project.streetAddress || project.city

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Quote Request</p>
                  <h1 className="text-2xl font-bold">{data.rfq.rfqNumber}</h1>
                </div>
              </div>
              <h2 className="text-xl font-medium mb-1">{data.rfq.title}</h2>
              <p className="text-emerald-100 text-lg font-medium">{project.name}</p>
            </div>
            {data.rfq.responseDeadline && (
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-emerald-100 text-xs uppercase tracking-wide mb-1">Please respond by</p>
                <p className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {formatDate(data.rfq.responseDeadline)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Ship To & Bill To Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ship To */}
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-2">Ship To</p>
                  <p className="font-bold text-gray-900 text-lg mb-1">
                    {project.client?.name || project.name}
                  </p>
                  <p className="text-sm text-blue-600 mb-2">Project: {project.name}</p>
                  {hasShippingAddress && (
                    <div className="text-sm text-gray-600 space-y-0.5">
                      {project.streetAddress && <p>{project.streetAddress}</p>}
                      <p>{project.city}{project.province ? `, ${project.province}` : ''} {project.postalCode}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bill To - Always Meisner Interiors */}
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold mb-2">Bill To</p>
                  <p className="font-bold text-gray-900 text-lg mb-1">Meisner Interiors</p>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p>6700 Ave Du Parc #109</p>
                    <p>Montreal, QC H2V4H9</p>
                    <p>Canada</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    <p className="text-sm text-gray-500">9446-7503 QUEBEC INC</p>
                    <p className="text-sm text-gray-500">514 797 6957</p>
                    <p className="text-sm text-gray-500">aaron@meisnerinteriors.com</p>
                    <p className="text-xs text-gray-400 mt-2">GST: 714093507 RT0001 | QST: 1228724382 TQ0001</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Info (smaller) */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-600">
              {(data.supplier.name || 'S').substring(0, 1).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Quoting as</p>
            <p className="font-medium text-gray-900">{data.supplier.name || 'Supplier'}</p>
          </div>
          <p className="text-sm text-gray-500 ml-auto">{data.supplier.email}</p>
        </div>

        {/* Description */}
        {data.rfq.description && (
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-gray-700">{data.rfq.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Items Requested */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Items Requested
              <Badge variant="secondary" className="ml-2">{data.rfq.lineItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {data.rfq.lineItems.map((item, index) => {
                const imageUrl = (item.roomFFEItem?.images && item.roomFFEItem.images[0]) || null
                const specs = item.roomFFEItem
                const hasSpecs = specs?.sku || specs?.color || specs?.finish || specs?.material || specs?.width
                const documents = specs?.documents || []

                return (
                  <div key={item.id} className="border rounded-xl overflow-hidden bg-white">
                    {/* Item Header */}
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.itemName} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{item.itemName}</h3>
                            {item.itemDescription && (
                              <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{item.itemDescription}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {specs?.brand && (
                                <Badge variant="outline" className="text-xs">{specs.brand}</Badge>
                              )}
                              {item.category && (
                                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-emerald-600">{item.quantity}</p>
                            <p className="text-xs text-gray-500">{item.unitType || 'units'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specifications */}
                    {hasSpecs && (
                      <div className="px-4 py-3 border-t bg-gray-50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          {specs.sku && (
                            <div>
                              <span className="text-gray-400 text-xs">SKU</span>
                              <p className="font-medium text-gray-700">{specs.sku}</p>
                            </div>
                          )}
                          {specs.color && (
                            <div>
                              <span className="text-gray-400 text-xs">Color</span>
                              <p className="font-medium text-gray-700">{specs.color}</p>
                            </div>
                          )}
                          {specs.finish && (
                            <div>
                              <span className="text-gray-400 text-xs">Finish</span>
                              <p className="font-medium text-gray-700">{specs.finish}</p>
                            </div>
                          )}
                          {specs.material && (
                            <div>
                              <span className="text-gray-400 text-xs">Material</span>
                              <p className="font-medium text-gray-700">{specs.material}</p>
                            </div>
                          )}
                          {(specs.width || specs.height || specs.depth) && (
                            <div className="col-span-2">
                              <span className="text-gray-400 text-xs">Dimensions</span>
                              <p className="font-medium text-gray-700">
                                {[specs.width, specs.height, specs.depth].filter(Boolean).join(' × ')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {documents.length > 0 && (
                      <div className="px-4 py-3 border-t bg-blue-50">
                        <p className="text-xs font-medium text-blue-700 mb-2">Attached Documents</p>
                        <div className="flex flex-wrap gap-2">
                          {documents.map(doc => (
                            <a
                              key={doc.id}
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {doc.title || doc.fileName}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quote Submission */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Submit Your Quote</CardTitle>
            <CardDescription>Choose how you'd like to provide your pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={submitMode} onValueChange={(v) => setSubmitMode(v as 'upload' | 'detailed')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload Quote
                </TabsTrigger>
                <TabsTrigger value="detailed" className="flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Enter Pricing
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {!uploadedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                  >
                    {uploading ? (
                      <Loader2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-spin" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <p className="text-gray-700 font-medium">
                      {uploading ? 'Uploading...' : 'Click to upload your quote'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      PDF, Word, Excel, or images up to 10MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <File className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={removeUploadedFile}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* AI Match Button */}
                    {uploadedFile.type.startsWith('image/') && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAIMatch}
                        disabled={aiMatching}
                        className="w-full bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:border-purple-300 text-purple-700"
                      >
                        {aiMatching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing with AI...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Analyze Quote with AI
                          </>
                        )}
                      </Button>
                    )}

                    {/* AI Match Results */}
                    {aiMatchResult && showAiResults && (
                      <div className="border rounded-xl overflow-hidden bg-white">
                        <div className="bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white">
                            <Sparkles className="w-4 h-4" />
                            <span className="font-medium">AI Analysis Results</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAiResults(false)}
                            className="text-white hover:bg-white/20 h-7 w-7 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Summary */}
                        <div className="px-4 py-3 bg-gray-50 border-b">
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-green-100 rounded-lg p-2">
                              <p className="text-lg font-bold text-green-700">{aiMatchResult.summary.matched}</p>
                              <p className="text-xs text-green-600">Matched</p>
                            </div>
                            <div className="bg-yellow-100 rounded-lg p-2">
                              <p className="text-lg font-bold text-yellow-700">{aiMatchResult.summary.partial}</p>
                              <p className="text-xs text-yellow-600">Partial</p>
                            </div>
                            <div className="bg-red-100 rounded-lg p-2">
                              <p className="text-lg font-bold text-red-700">{aiMatchResult.summary.missing}</p>
                              <p className="text-xs text-red-600">Missing</p>
                            </div>
                            <div className="bg-blue-100 rounded-lg p-2">
                              <p className="text-lg font-bold text-blue-700">{aiMatchResult.summary.extra}</p>
                              <p className="text-xs text-blue-600">Extra</p>
                            </div>
                          </div>
                          {aiMatchResult.supplierInfo?.total && (
                            <div className="mt-3 text-center">
                              <p className="text-sm text-gray-500">Quote Total</p>
                              <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(aiMatchResult.supplierInfo.total)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Match Details */}
                        <div className="max-h-64 overflow-y-auto">
                          {aiMatchResult.matchResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "px-4 py-2 border-b last:border-b-0 flex items-center gap-3",
                                result.status === 'matched' && "bg-green-50",
                                result.status === 'partial' && "bg-yellow-50",
                                result.status === 'missing' && "bg-red-50",
                                result.status === 'extra' && "bg-blue-50"
                              )}
                            >
                              {result.status === 'matched' && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />}
                              {result.status === 'partial' && <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />}
                              {result.status === 'missing' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
                              {result.status === 'extra' && <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />}

                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {result.status === 'missing' || result.status === 'partial'
                                    ? result.rfqItem?.itemName
                                    : result.extractedItem?.productName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {result.status === 'matched' || result.status === 'partial' ? (
                                    <>
                                      <span>Qty: {result.rfqItem?.quantity}</span>
                                      {result.extractedItem?.unitPrice && (
                                        <span>@ {formatCurrency(result.extractedItem.unitPrice)}</span>
                                      )}
                                      {result.confidence > 0 && (
                                        <Badge variant="outline" className="text-xs h-4">
                                          {result.confidence}% match
                                        </Badge>
                                      )}
                                    </>
                                  ) : result.status === 'missing' ? (
                                    <span className="text-red-600">Not found in uploaded quote</span>
                                  ) : (
                                    <>
                                      {result.extractedItem?.quantity && <span>Qty: {result.extractedItem.quantity}</span>}
                                      {result.extractedItem?.unitPrice && (
                                        <span>@ {formatCurrency(result.extractedItem.unitPrice)}</span>
                                      )}
                                      <span className="text-blue-600">Not in your request</span>
                                    </>
                                  )}
                                </div>
                                {result.discrepancies && result.discrepancies.length > 0 && (
                                  <div className="mt-1">
                                    {result.discrepancies.map((d, i) => (
                                      <p key={i} className="text-xs text-yellow-700">{d}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {aiMatchResult.notes && (
                          <div className="px-4 py-3 bg-gray-50 border-t">
                            <p className="text-xs text-gray-500 font-medium mb-1">Quote Notes</p>
                            <p className="text-sm text-gray-700">{aiMatchResult.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Quote Total (optional)</Label>
                    <div className="relative mt-1.5">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={uploadTotalAmount}
                        onChange={(e) => setUploadTotalAmount(e.target.value)}
                        placeholder="Enter total if known"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Input
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Detailed Pricing Tab */}
              <TabsContent value="detailed" className="space-y-6">
                {/* Line Items */}
                <div className="space-y-4">
                  {data.rfq.lineItems.map((item, index) => (
                    <div key={item.id} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-700">
                            {index + 1}
                          </span>
                          <div>
                            <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                            {item.category && <p className="text-xs text-gray-500">{item.category}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.quantity} <span className="text-gray-500 font-normal">{item.unitType || 'units'}</span></p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Unit Price (CAD) <span className="text-red-500">*</span></Label>
                          <div className="relative mt-1">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={lineItems[index]?.unitPrice || ''}
                              onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                              placeholder="0.00"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Availability</Label>
                          <select
                            value={lineItems[index]?.availability || 'IN_STOCK'}
                            onChange={(e) => updateLineItem(index, 'availability', e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
                          >
                            <option value="IN_STOCK">In Stock</option>
                            <option value="BACKORDER">Backorder</option>
                            <option value="SPECIAL_ORDER">Special Order</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Lead Time (weeks)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={lineItems[index]?.leadTimeWeeks || ''}
                            onChange={(e) => updateLineItem(index, 'leadTimeWeeks', e.target.value)}
                            placeholder="e.g., 2"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {lineItems[index]?.unitPrice && (
                        <div className="mt-3 pt-3 border-t flex justify-end">
                          <p className="text-sm">
                            <span className="text-gray-500">Line Total:</span>
                            <span className="font-semibold ml-2">
                              {formatCurrency(parseFloat(lineItems[index].unitPrice) * item.quantity)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quote Details */}
                <div className="border rounded-xl p-4 space-y-4">
                  <h4 className="font-medium text-gray-900">Quote Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Your Quote Number</Label>
                      <Input
                        value={quoteNumber}
                        onChange={(e) => setQuoteNumber(e.target.value)}
                        placeholder="e.g., QT-2024-001"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Quote Valid Until</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Payment Terms</Label>
                      <Input
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="e.g., Net 30"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estimated Lead Time</Label>
                      <Input
                        value={estimatedLeadTime}
                        onChange={(e) => setEstimatedLeadTime(e.target.value)}
                        placeholder="e.g., 4-6 weeks"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Additional Notes</Label>
                    <Textarea
                      value={supplierNotes}
                      onChange={(e) => setSupplierNotes(e.target.value)}
                      placeholder="Any additional information or terms..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Delivery & Taxes Section */}
            <div className="mt-6 border rounded-xl p-4 space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Delivery & Taxes
              </h4>

              {/* Delivery Option */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Include Delivery</Label>
                    <span className="text-xs text-gray-400">(optional)</span>
                  </div>
                  <Switch
                    checked={includeDelivery}
                    onCheckedChange={setIncludeDelivery}
                  />
                </div>

                {includeDelivery && (
                  <div className="pl-4 border-l-2 border-emerald-200 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('included')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm border transition-all",
                          deliveryType === 'included'
                            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        Included in Price
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('flat')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm border transition-all",
                          deliveryType === 'flat'
                            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        Flat Fee
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('per_item')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm border transition-all",
                          deliveryType === 'per_item'
                            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        Per Item
                      </button>
                    </div>

                    {(deliveryType === 'flat' || deliveryType === 'per_item') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">
                            {deliveryType === 'flat' ? 'Delivery Fee' : 'Per Item Fee'}
                          </Label>
                          <div className="relative mt-1">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={deliveryFee}
                              onChange={(e) => setDeliveryFee(e.target.value)}
                              placeholder="0.00"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Delivery Notes</Label>
                          <Input
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            placeholder="e.g., Curbside delivery"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tax Option (Quebec GST/QST) */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Include Quebec Taxes (GST/QST)</Label>
                  </div>
                  <Switch
                    checked={includeTaxes}
                    onCheckedChange={setIncludeTaxes}
                  />
                </div>

                {includeTaxes && (
                  <div className="pl-4 border-l-2 border-blue-200 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">GST Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={gstRate}
                        onChange={(e) => setGstRate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">QST Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={qstRate}
                        onChange={(e) => setQstRate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quote Summary */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(submitMode === 'detailed' ? calculateSubtotal() : parseFloat(uploadTotalAmount) || 0)}</span>
              </div>
              {includeDelivery && deliveryType !== 'included' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Delivery {deliveryType === 'per_item' && `(${deliveryFee || 0} × items)`}
                  </span>
                  <span className="font-medium">{formatCurrency(calculateDeliveryTotal())}</span>
                </div>
              )}
              {includeDelivery && deliveryType === 'included' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className="text-emerald-600 font-medium">Included</span>
                </div>
              )}
              {includeTaxes && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST ({gstRate}%)</span>
                    <span className="font-medium">{formatCurrency(calculateTaxes().gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">QST ({qstRate}%)</span>
                    <span className="font-medium">{formatCurrency(calculateTaxes().qst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-3 border-t">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(submitMode === 'detailed' ? calculateTotal() : (parseFloat(uploadTotalAmount) || 0) + calculateDeliveryTotal() + calculateTaxes().gst + calculateTaxes().qst)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={submitting}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Decline to Quote
          </Button>
          <Button
            onClick={submitMode === 'upload' ? handleUploadSubmit : handleSubmit}
            disabled={submitting || (submitMode === 'upload' && !uploadedFileUrl)}
            size="lg"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 order-1 sm:order-2"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" />
            Submit Quote
          </Button>
        </div>

        {/* All Project Items */}
        {data.allProjectItems && data.allProjectItems.length > 0 && (
          <Card className="shadow-sm mb-8">
            <CardHeader className="cursor-pointer" onClick={() => setShowAllItems(!showAllItems)}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-500" />
                    All Items Sent to You
                    <Badge variant="secondary">{data.allProjectItems.length}</Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    All products from this project that have been sent to you for quoting
                  </p>
                </div>
                {showAllItems ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>
            </CardHeader>
            {showAllItems && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.allProjectItems.map((item) => {
                    const imageUrl = item.roomFFEItem?.images?.[0] || null
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border",
                          item.isCurrentRfq ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"
                        )}
                      >
                        {imageUrl && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border">
                            <img src={imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">{item.itemName}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} {item.unitType || 'units'}
                            {item.roomFFEItem?.brand && ` • ${item.roomFFEItem.brand}`}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {item.hasQuote && item.quotedPrice ? (
                            <div className="text-right">
                              <p className="font-semibold text-green-700 text-sm">${Number(item.quotedPrice).toLocaleString()}</p>
                              <p className="text-xs text-green-600">Quoted</p>
                            </div>
                          ) : item.isCurrentRfq ? (
                            <Badge className="bg-emerald-600 text-white text-xs">Current</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 text-xs">Pending</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Messaging widget */}
      <SupplierMessaging
        token={token}
        projectName={data.rfq.project.name}
        supplierName={data.supplier.name}
      />
    </div>
  )
}
