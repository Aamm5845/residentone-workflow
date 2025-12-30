'use client'

import { useState, useEffect, use, useRef, useCallback } from 'react'
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
  Truck,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Mail,
  MessageSquare,
  Plus,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
        length?: string
        modelNumber?: string
        supplierLink?: string
        supplierName?: string
        leadTime?: string
        notes?: string
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
}

interface QuoteLineItem {
  rfqLineItemId: string
  unitPrice: string
  quantity: number
  leadTime: string
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
    shipping?: number
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
    hasTaxes?: boolean
  }
  notes?: string
}

type QuoteMode = 'select' | 'upload' | 'manual'

export default function SupplierPortalPage({ params }: SupplierPortalPageProps) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RFQData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Quote mode: 'select' (initial), 'upload', or 'manual'
  const [quoteMode, setQuoteMode] = useState<QuoteMode>('select')

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Match state
  const [aiMatching, setAiMatching] = useState(false)
  const [aiMatchResult, setAiMatchResult] = useState<AIMatchResponse | null>(null)

  // Delivery fee
  const [deliveryFee, setDeliveryFee] = useState('')

  // Currency - detect USD for US suppliers
  const [currency, setCurrency] = useState<'CAD' | 'USD'>('CAD')

  // Quote form state - each item has: price, lead time, notes
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')

  // Validation state
  const [showValidationErrors, setShowValidationErrors] = useState(false)

  // State to control if user wants to revise an existing quote
  const [isRevising, setIsRevising] = useState(false)

  // Track which items have notes expanded
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const toggleNoteExpanded = useCallback((itemId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

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
          leadTime: '',
          notes: ''
        }))
        setLineItems(items)

        // Check if already submitted
        if (result.existingQuote || result.responseStatus === 'SUBMITTED') {
          setSubmitted(true)
        }

        // Detect US for currency (check for US states)
        const province = result.rfq.project?.province?.toLowerCase() || ''
        const usStates = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy']
        if (usStates.includes(province)) {
          setCurrency('USD')
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
    return parseFloat(deliveryFee) || 0
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateDeliveryTotal()
  }

  const handleSubmit = async () => {
    setShowValidationErrors(true)

    // For upload mode, we need the AI result with prices
    if (quoteMode === 'upload') {
      if (!aiMatchResult) {
        toast.error('Please upload your quote first')
        return
      }
      // Validate lead times
      const hasEmptyLeadTimes = lineItems.some(item => !item.leadTime)
      if (hasEmptyLeadTimes) {
        toast.error('Please select lead time for all items')
        return
      }
    }

    // For manual mode, validate all inputs
    if (quoteMode === 'manual') {
      const hasEmptyPrices = lineItems.some(item => !item.unitPrice || parseFloat(item.unitPrice) <= 0)
      if (hasEmptyPrices) {
        toast.error('Please enter a price for all items')
        return
      }
      const hasEmptyLeadTimes = lineItems.some(item => !item.leadTime)
      if (hasEmptyLeadTimes) {
        toast.error('Please select lead time for all items')
        return
      }
    }

    // Validate notes required for "See notes" lead time
    const hasMissingNotes = lineItems.some(item => item.leadTime === 'See notes' && !item.notes?.trim())
    if (hasMissingNotes) {
      toast.error('Please enter notes for items with "See notes" lead time')
      return
    }

    setSubmitting(true)
    try {
      // Calculate total based on mode
      let totalAmount = 0
      if (quoteMode === 'upload' && aiMatchResult?.supplierInfo?.total) {
        totalAmount = aiMatchResult.supplierInfo.total
      } else {
        totalAmount = calculateTotal()
      }

      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quoteNumber: `SQ-${Date.now()}`,
          quoteDocumentUrl: uploadedFileUrl || null,
          supplierNotes: orderNotes || null,
          totalAmount,
          deliveryFee: quoteMode === 'upload' ? (aiMatchResult?.supplierInfo?.shipping || 0) : calculateDeliveryTotal(),
          lineItems: lineItems.map(item => {
            // For upload mode, get price from AI match
            let unitPrice = parseFloat(item.unitPrice) || 0
            if (quoteMode === 'upload' && aiMatchResult) {
              const match = aiMatchResult.matchResults.find(
                r => r.rfqItem?.id === item.rfqLineItemId && (r.status === 'matched' || r.status === 'partial')
              )
              if (match?.extractedItem?.unitPrice) {
                unitPrice = match.extractedItem.unitPrice
              }
            }
            return {
              rfqLineItemId: item.rfqLineItemId,
              unitPrice,
              quantity: item.quantity,
              leadTime: item.leadTime || null,
              notes: item.notes || null
            }
          })
        })
      })

      if (response.ok) {
        const result = await response.json()
        // Show different message for revision vs new submission
        const wasRevision = isRevising || data?.existingQuote || data?.responseStatus === 'SUBMITTED'
        toast.success(wasRevision ? 'Quote revised successfully! We\'ll review your changes.' : 'Quote submitted successfully!')

        // Reload the data to show updated quote info
        await loadRFQ()
        setIsRevising(false) // Go back to summary view
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

  const handleSendByEmail = () => {
    const rfqNumber = data?.rfq?.rfqNumber || 'Quote Request'
    const projectName = data?.rfq?.project?.name || ''
    const subject = encodeURIComponent(`Quote for ${rfqNumber}${projectName ? ` - ${projectName}` : ''}`)
    const body = encodeURIComponent(`Hi,\n\nPlease find attached my quote for ${rfqNumber}.\n\n[Please attach your quote PDF to this email]\n\nBest regards`)
    window.location.href = `mailto:shaya@meisnerinteriors.com?subject=${subject}&body=${body}`
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

    setUploading(true)
    setUploadingFileName(file.name)
    setAiMatchResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch(`/api/supplier-portal/${token}/upload`, {
        method: 'POST',
        body: formData
      })

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json()
        setUploadedFile(file)
        setUploadedFileUrl(uploadData.url)
        setUploading(false)
        toast.success('Quote uploaded - analyzing...')

        // Automatically run AI matching for images and PDFs
        const canAnalyze = file.type.startsWith('image/') || file.type === 'application/pdf'
        if (canAnalyze) {
          setAiMatching(true)
          try {
            const aiResponse = await fetch(`/api/supplier-portal/${token}/ai-match`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileUrl: uploadData.url,
                fileType: file.type
              })
            })

            const aiResult = await aiResponse.json()

            if (aiResult.success) {
              setAiMatchResult(aiResult)

              // Auto-fill lead times from matched items
              setLineItems(prev => prev.map(item => {
                const match = aiResult.matchResults.find(
                  (r: AIMatchResult) => r.rfqItem?.id === item.rfqLineItemId && (r.status === 'matched' || r.status === 'partial')
                )
                if (match?.extractedItem?.leadTime) {
                  return {
                    ...item,
                    leadTime: match.extractedItem.leadTime
                  }
                }
                return item
              }))

              // Auto-fill delivery if detected in quote
              if (aiResult.supplierInfo?.shipping && aiResult.supplierInfo.shipping > 0) {
                setDeliveryFee(aiResult.supplierInfo.shipping.toString())
              }

              const matched = aiResult.summary.matched + aiResult.summary.partial
              if (matched === aiResult.summary.totalRequested) {
                toast.success('All items matched!')
              } else {
                toast.success(`${matched} of ${aiResult.summary.totalRequested} items matched`)
              }
            } else {
              toast('Could not analyze document. Please try again or enter manually.')
            }
          } catch (aiErr) {
            console.error('AI matching failed:', aiErr)
            toast('Analysis failed. Please try again or enter manually.')
          } finally {
            setAiMatching(false)
          }
        }
      } else {
        const errorData = await uploadResponse.json()
        toast.error(errorData.details || errorData.error || 'Failed to upload file')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (err) {
      toast.error('Failed to upload file')
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploadingFileName(null)
    }
  }

  const removeUploadedFile = () => {
    setUploadedFile(null)
    setUploadedFileUrl(null)
    setAiMatchResult(null)
    setQuoteMode('select')
    setLineItems(prev => prev.map(item => ({
      ...item,
      unitPrice: '',
      leadTime: '',
      notes: ''
    })))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-CA', {
      style: 'currency',
      currency: currency
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

  // Check if already submitted
  const hasExistingQuote = data.responseStatus === 'SUBMITTED' || data.existingQuote
  const isDeclined = data.responseStatus === 'DECLINED'

  // If declined, show a simple message (no resubmission)
  if (isDeclined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Quote Declined</h2>
            <p className="text-gray-500">You have declined this quote request.</p>
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

  // If already submitted and not revising, show submitted summary
  if (hasExistingQuote && !isRevising) {
    const quote = data.existingQuote
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <Toaster position="top-right" />

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm font-medium">Quote Submitted</p>
                <h1 className="text-2xl font-bold">{data.rfq.rfqNumber}</h1>
              </div>
            </div>
            <p className="text-emerald-100">{data.rfq.project.name}</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Quote Summary Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Your Quote
              </CardTitle>
              <CardDescription>
                Submitted on {quote?.submittedAt ? new Date(quote.submittedAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : 'recently'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quote Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Quote Reference</p>
                  <p className="font-semibold text-gray-900">{quote?.quoteNumber || 'N/A'}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <p className="text-sm text-emerald-600 mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(quote?.totalAmount || 0)}</p>
                </div>
              </div>

              {/* Items Summary */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Items Quoted ({data.rfq.lineItems.length})</p>
                <div className="space-y-2">
                  {data.rfq.lineItems.slice(0, 5).map((item, index) => {
                    const quoteLineItem = quote?.lineItems?.find((ql: any) => ql.rfqLineItemId === item.id)
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400">{index + 1}.</span>
                          <span className="text-sm text-gray-900">{item.itemName}</span>
                          <span className="text-xs text-gray-400">×{item.quantity}</span>
                        </div>
                        {quoteLineItem?.unitPrice && (
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(quoteLineItem.unitPrice)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {data.rfq.lineItems.length > 5 && (
                    <p className="text-sm text-gray-500 pt-2">
                      +{data.rfq.lineItems.length - 5} more items
                    </p>
                  )}
                </div>
              </div>

              {/* Supplier Notes */}
              {quote?.supplierNotes && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Your Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{quote.supplierNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setIsRevising(true)}
              size="lg"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Revise Quote
            </Button>
            <Button
              variant="outline"
              onClick={handleSendByEmail}
              size="lg"
              className="flex-1"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Update by Email
            </Button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Need to make changes? Click "Revise Quote" to update your pricing.
          </p>
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

  const project = data.rfq.project
  const hasShippingAddress = project.streetAddress || project.city

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Toaster position="top-right" />

      {/* Revising Banner */}
      {isRevising && hasExistingQuote && (
        <div className="bg-amber-500 text-white text-center py-2 px-4">
          <div className="flex items-center justify-center gap-2">
            <Edit3 className="w-4 h-4" />
            <span className="font-medium">Revising Quote</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRevising(false)}
              className="text-white hover:bg-amber-600 ml-2 h-7 px-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Info */}
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

        {/* Items List - Read Only */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Items Requested
              <Badge variant="secondary" className="ml-2">{data.rfq.lineItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {data.rfq.lineItems.map((item, index) => {
                const imageUrl = (item.roomFFEItem?.images && item.roomFFEItem.images[0]) || null
                const specs = item.roomFFEItem
                const documents = specs?.documents || []
                const hasItemNotes = item.notes || specs?.notes
                const supplierLink = specs?.supplierLink

                // Build specs line
                const specParts: string[] = []
                if (specs?.brand) specParts.push(specs.brand)
                if (specs?.sku) specParts.push(specs.sku)
                else if (specs?.modelNumber) specParts.push(specs.modelNumber)
                if (specs?.color) specParts.push(specs.color)
                if (specs?.finish && specs.finish !== specs?.color) specParts.push(specs.finish)
                const specsLine = specParts.join(' • ')

                // Get matched price if in upload mode
                const matchedItem = aiMatchResult?.matchResults.find(
                  r => r.rfqItem?.id === item.id && (r.status === 'matched' || r.status === 'partial')
                )
                const matchedPrice = matchedItem?.extractedItem?.unitPrice

                // Get manual price
                const lineItem = lineItems[index]
                const manualPrice = lineItem?.unitPrice ? parseFloat(lineItem.unitPrice) : null

                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.itemName} className="w-16 h-16 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900">
                              <span className="text-emerald-600 mr-2">{index + 1}.</span>
                              {item.itemName}
                            </h3>
                            {specsLine && (
                              <p className="text-sm text-gray-500 mt-1">{specsLine}</p>
                            )}
                            {item.itemDescription && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-1">{item.itemDescription}</p>
                            )}
                            {supplierLink && (
                              <a
                                href={supplierLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Product Link
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-emerald-600">{item.quantity}</p>
                            <p className="text-xs text-gray-400">{item.unitType || 'units'}</p>
                          </div>
                        </div>

                        {/* Notes & Documents */}
                        {(hasItemNotes || documents.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            {hasItemNotes && (
                              <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded">Note: {item.notes || specs?.notes}</span>
                            )}
                            {documents.map(doc => (
                              <a
                                key={doc.id}
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <FileText className="w-3 h-3" />
                                {doc.title || doc.fileName}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Upload mode: show matched price and inputs */}
                        {quoteMode === 'upload' && aiMatchResult && (
                          <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
                            {/* Price from AI */}
                            <div className="min-w-[120px]">
                              <Label className="text-xs text-gray-500">Unit Price</Label>
                              <div className="mt-1 h-9 px-3 flex items-center bg-emerald-50 border border-emerald-200 rounded-md">
                                {matchedPrice ? (
                                  <span className="font-semibold text-emerald-700">{formatCurrency(matchedPrice)}</span>
                                ) : (
                                  <span className="text-amber-600 text-sm">Not found</span>
                                )}
                              </div>
                            </div>
                            {/* Lead Time */}
                            <div className="min-w-[140px]">
                              <Label className="text-xs text-gray-500">Lead Time</Label>
                              <select
                                value={lineItem?.leadTime || ''}
                                onChange={(e) => updateLineItem(index, 'leadTime', e.target.value)}
                                className={cn(
                                  "mt-1 w-full h-9 rounded-md border px-3 text-sm bg-white",
                                  showValidationErrors && !lineItem?.leadTime ? "border-red-500" : "border-gray-200"
                                )}
                              >
                                <option value="">Select...</option>
                                <option value="In Stock">In Stock</option>
                                <option value="1-2 weeks">1-2 Weeks</option>
                                <option value="2-4 weeks">2-4 Weeks</option>
                                <option value="4-6 weeks">4-6 Weeks</option>
                                <option value="6-8 weeks">6-8 Weeks</option>
                                <option value="8-12 weeks">8-12 Weeks</option>
                                <option value="12+ weeks">12+ Weeks</option>
                                <option value="See notes">See notes</option>
                              </select>
                            </div>
                            {/* Notes - Collapsed by default */}
                            {expandedNotes.has(item.id) ? (
                              <div className="flex-1 min-w-[150px]">
                                <Label className="text-xs text-gray-500">Notes</Label>
                                <Input
                                  value={lineItem?.notes || ''}
                                  onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                                  placeholder="Add any notes for this item..."
                                  className="mt-1 h-9"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleNoteExpanded(item.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Add note
                              </button>
                            )}
                            {/* Line Total */}
                            {matchedPrice && (
                              <div className="text-right min-w-[100px]">
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(matchedPrice * item.quantity)}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Manual mode: show input fields */}
                        {quoteMode === 'manual' && (
                          <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
                            <div className="min-w-[120px]">
                              <Label className="text-xs text-gray-500">Unit Price</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={lineItem?.unitPrice || ''}
                                  onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                                  placeholder="0.00"
                                  className={cn(
                                    "pl-7 h-9",
                                    showValidationErrors && !lineItem?.unitPrice && "border-red-500"
                                  )}
                                />
                              </div>
                            </div>
                            <div className="min-w-[140px]">
                              <Label className="text-xs text-gray-500">Lead Time</Label>
                              <select
                                value={lineItem?.leadTime || ''}
                                onChange={(e) => updateLineItem(index, 'leadTime', e.target.value)}
                                className={cn(
                                  "mt-1 w-full h-9 rounded-md border px-3 text-sm bg-white",
                                  showValidationErrors && !lineItem?.leadTime ? "border-red-500" : "border-gray-200"
                                )}
                              >
                                <option value="">Select...</option>
                                <option value="In Stock">In Stock</option>
                                <option value="1-2 weeks">1-2 Weeks</option>
                                <option value="2-4 weeks">2-4 Weeks</option>
                                <option value="4-6 weeks">4-6 Weeks</option>
                                <option value="6-8 weeks">6-8 Weeks</option>
                                <option value="8-12 weeks">8-12 Weeks</option>
                                <option value="12+ weeks">12+ Weeks</option>
                                <option value="See notes">See notes</option>
                              </select>
                            </div>
                            {/* Notes - Collapsed by default */}
                            {expandedNotes.has(item.id) ? (
                              <div className="flex-1 min-w-[150px]">
                                <Label className="text-xs text-gray-500">Notes</Label>
                                <Input
                                  value={lineItem?.notes || ''}
                                  onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                                  placeholder="Add any notes for this item..."
                                  className="mt-1 h-9"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleNoteExpanded(item.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Add note
                              </button>
                            )}
                            {manualPrice && manualPrice > 0 && (
                              <div className="text-right min-w-[100px]">
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(manualPrice * item.quantity)}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quote Mode Selection */}
        {quoteMode === 'select' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upload Quote Option */}
              <Card
                className="shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all"
                onClick={() => {
                  setQuoteMode('upload')
                  setTimeout(() => fileInputRef.current?.click(), 100)
                }}
              >
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Quote</h3>
                  <p className="text-sm text-gray-500">
                    Upload your quote PDF or image and we'll automatically extract and match the prices
                  </p>
                </CardContent>
              </Card>

              {/* Enter Manually Option */}
              <Card
                className="shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                onClick={() => setQuoteMode('manual')}
              >
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Edit3 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Manually</h3>
                  <p className="text-sm text-gray-500">
                    Enter prices and lead times manually for each item
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Email Alternative */}
            <div className="text-center pt-4 pb-8">
              <p className="text-sm text-gray-500 mb-2">Prefer to send your quote by email?</p>
              <Button
                variant="ghost"
                onClick={handleSendByEmail}
                className="text-gray-600 hover:text-gray-900"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Quote by Email Instead
              </Button>
            </div>
          </>
        )}

        {/* Upload Mode Content */}
        {quoteMode === 'upload' && (
          <>
            {/* File Upload Area */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    Your Quote
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setQuoteMode('select')}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploading || aiMatching ? (
                  <div className="border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center bg-emerald-50">
                    <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 animate-spin" />
                    <p className="text-emerald-700 font-medium">
                      {aiMatching ? 'Analyzing your quote...' : 'Uploading...'}
                    </p>
                  </div>
                ) : !uploadedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                  >
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-700 font-medium">Click to upload your quote</p>
                    <p className="text-sm text-gray-400 mt-1">PDF, Word, Excel, or image files</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <File className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-sm text-emerald-600">
                        {aiMatchResult && `${aiMatchResult.summary.matched + aiMatchResult.summary.partial} of ${aiMatchResult.summary.totalRequested} items matched`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeUploadedFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* After AI Match: Unmatched Items + Summary */}
            {aiMatchResult && (
              <>
                {/* Missing Items - items we requested but not found in their quote */}
                {aiMatchResult.matchResults.filter((r: AIMatchResult) => r.status === 'missing').length > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        {aiMatchResult.matchResults.filter((r: AIMatchResult) => r.status === 'missing').length} item(s) not found in your quote
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Don't worry - we'll review your quote and follow up if needed. You can continue submitting.
                      </p>
                    </div>
                  </div>
                )}

                {/* Unmatched/Extra Items from their quote */}
                {aiMatchResult.matchResults.filter((r: AIMatchResult) => r.status === 'extra').length > 0 && (
                  <Card className="shadow-sm border-l-4 border-l-amber-400">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                        <AlertCircle className="w-4 h-4" />
                        Additional Items
                      </CardTitle>
                      <p className="text-sm text-amber-600 mt-1">
                        We'll review these and match them accordingly.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {aiMatchResult.matchResults
                          .filter((r: AIMatchResult) => r.status === 'extra')
                          .map((result: AIMatchResult, idx: number) => (
                            <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{result.extractedItem?.productName}</p>
                                {result.extractedItem?.sku && (
                                  <p className="text-sm text-gray-500">{result.extractedItem.sku}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(result.extractedItem?.unitPrice || 0)}</p>
                                <p className="text-xs text-gray-500">× {result.extractedItem?.quantity || 1}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quote Summary - clean layout */}
                <Card className="shadow-sm">
                  <CardContent className="pt-5 pb-5">
                    <div className="space-y-3">
                      {/* Subtotal */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal ({aiMatchResult.summary.matched + aiMatchResult.summary.partial} items)</span>
                        <span className="font-medium">
                          {formatCurrency(
                            aiMatchResult.matchResults
                              .filter((r: AIMatchResult) => r.status === 'matched' || r.status === 'partial')
                              .reduce((sum: number, r: AIMatchResult) => sum + ((r.extractedItem?.unitPrice || 0) * (r.extractedItem?.quantity || r.rfqItem?.quantity || 1)), 0)
                          )}
                        </span>
                      </div>

                      {/* Extra items total */}
                      {aiMatchResult.matchResults.filter((r: AIMatchResult) => r.status === 'extra').length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Additional items</span>
                          <span className="font-medium">
                            {formatCurrency(
                              aiMatchResult.matchResults
                                .filter((r: AIMatchResult) => r.status === 'extra')
                                .reduce((sum: number, r: AIMatchResult) => sum + ((r.extractedItem?.unitPrice || 0) * (r.extractedItem?.quantity || 1)), 0)
                            )}
                          </span>
                        </div>
                      )}

                      {/* Shipping */}
                      {aiMatchResult.supplierInfo?.shipping && aiMatchResult.supplierInfo.shipping > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Shipping / Delivery</span>
                          <span className="font-medium">{formatCurrency(aiMatchResult.supplierInfo.shipping)}</span>
                        </div>
                      )}

                      {/* Taxes */}
                      {aiMatchResult.supplierInfo?.taxes && aiMatchResult.supplierInfo.taxes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Taxes</span>
                          <span className="font-medium">{formatCurrency(aiMatchResult.supplierInfo.taxes)}</span>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Quote Total</span>
                        <span className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(aiMatchResult.supplierInfo?.total || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Manual Mode Content - Total & Delivery */}
        {quoteMode === 'manual' && (
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Quote Summary
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setQuoteMode('select')}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Delivery Fee */}
              <div className="border rounded-xl p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4" />
                  Delivery Fee (if applicable)
                </h4>
                <div className="relative max-w-xs">
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

              {/* Total */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({lineItems.filter(i => i.unitPrice && parseFloat(i.unitPrice) > 0).length} items)</span>
                  <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>
                {parseFloat(deliveryFee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-medium">{formatCurrency(calculateDeliveryTotal())}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Notes & Submit - Show when mode is selected */}
        {quoteMode !== 'select' && (
          <>
            {/* Order Notes */}
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-5">
                <Label className="font-medium">Additional Notes (optional)</Label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Payment terms, special instructions, etc."
                  rows={2}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
              <Button
                variant="outline"
                onClick={handleSendByEmail}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Quote by Email
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || aiMatching || (quoteMode === 'upload' && !aiMatchResult)}
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 order-1 sm:order-2"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Send className="w-4 h-4 mr-2" />
                {isRevising ? 'Update Quote' : 'Submit Quote'}
              </Button>
            </div>
          </>
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
