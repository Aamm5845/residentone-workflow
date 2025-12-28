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
  Info,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Link as LinkIcon
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
  suggestedMatches?: {
    id: string
    itemName: string
    confidence: number
  }[]
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
    hasTaxes?: boolean
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
  const [showAllItems, setShowAllItems] = useState(false)

  // File upload state (optional - to auto-fill)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Match state
  const [aiMatching, setAiMatching] = useState(false)
  const [aiMatchResult, setAiMatchResult] = useState<AIMatchResponse | null>(null)

  // Delivery fee (simple input, not toggle)
  const [deliveryFee, setDeliveryFee] = useState('')

  // Taxes - Quebec suppliers always show GST/QST
  const [isQuebec, setIsQuebec] = useState(false)
  const [gstAmount, setGstAmount] = useState(0)
  const [qstAmount, setQstAmount] = useState(0)

  // Quote form state - each item has: price, lead time, notes
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')

  // Validation state
  const [showValidationErrors, setShowValidationErrors] = useState(false)

  // Manual linking of unmatched items
  const [manualLinks, setManualLinks] = useState<Record<number, string>>({}) // extractedIdx -> rfqItemId

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

        // Detect Quebec for tax calculation
        const province = result.rfq.project?.province?.toLowerCase() || ''
        if (province.includes('quebec') || province === 'qc') {
          setIsQuebec(true)
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

  const calculateTaxes = () => {
    if (!isQuebec) return { gst: 0, qst: 0 }
    const subtotal = calculateSubtotal() + calculateDeliveryTotal()
    const gst = subtotal * 0.05 // 5% GST
    const qst = subtotal * 0.09975 // 9.975% QST
    return { gst, qst }
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const delivery = calculateDeliveryTotal()
    const { gst, qst } = calculateTaxes()
    return subtotal + delivery + gst + qst
  }

  const handleSubmit = async () => {
    setShowValidationErrors(true)

    // Validate prices
    const hasEmptyPrices = lineItems.some(item => !item.unitPrice || parseFloat(item.unitPrice) <= 0)
    if (hasEmptyPrices) {
      toast.error('Please enter a price for all items')
      return
    }

    // Validate lead times
    const hasEmptyLeadTimes = lineItems.some(item => !item.leadTime)
    if (hasEmptyLeadTimes) {
      toast.error('Please select lead time for all items - look for items highlighted in red')
      return
    }

    // Validate notes required for "See notes" lead time
    const hasMissingNotes = lineItems.some(item => item.leadTime === 'See notes' && !item.notes?.trim())
    if (hasMissingNotes) {
      toast.error('Please enter notes for items with "See notes" lead time')
      return
    }

    setSubmitting(true)
    const { gst, qst } = calculateTaxes()
    try {
      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quoteNumber: `SQ-${Date.now()}`,
          quoteDocumentUrl: uploadedFileUrl || null,
          supplierNotes: orderNotes || null,
          totalAmount: calculateTotal(),
          // Tax and delivery info
          isQuebec,
          gstAmount: gst,
          qstAmount: qst,
          deliveryFee: calculateDeliveryTotal(),
          lineItems: lineItems.map(item => ({
            rfqLineItemId: item.rfqLineItemId,
            unitPrice: parseFloat(item.unitPrice),
            quantity: item.quantity,
            leadTime: item.leadTime,
            notes: item.notes || null
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

  const handleSendByEmail = () => {
    // Open email client to send quote via email
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

    const fileSize = file.size
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
        setUploadedFileSize(fileSize)
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

              // Auto-fill prices and lead times from matched items
              setLineItems(prev => prev.map(item => {
                const match = aiResult.matchResults.find(
                  (r: AIMatchResult) => r.rfqItem?.id === item.rfqLineItemId && (r.status === 'matched' || r.status === 'partial')
                )
                if (match?.extractedItem) {
                  return {
                    ...item,
                    unitPrice: match.extractedItem.unitPrice?.toString() || item.unitPrice,
                    leadTime: match.extractedItem.leadTime || item.leadTime
                  }
                }
                return item
              }))

              // Auto-fill delivery if detected in quote
              // (AI extracts this as part of supplierInfo or notes)
              // For now, we rely on manual entry but could parse from notes

              const matched = aiResult.summary.matched + aiResult.summary.partial
              if (matched === aiResult.summary.totalRequested) {
                toast.success('All items matched and filled in!')
              } else {
                toast.success(`${matched} of ${aiResult.summary.totalRequested} items matched`)
              }
            } else {
              toast('Could not analyze document. Please fill in details manually.')
            }
          } catch (aiErr) {
            console.error('AI matching failed:', aiErr)
            toast('Analysis failed. Please fill in details manually.')
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
    setUploadedFileSize(0)
    setAiMatchResult(null)
    // Reset line items to empty values
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
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => {
                  // TODO: Navigate to supplier portal home with all requests
                  toast('Supplier Portal coming soon!')
                }}
              >
                <Package className="w-4 h-4 mr-2" />
                My Requests
              </Button>
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

        {/* Quote Submission - Unified Item Cards */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Items to Quote
                  <Badge variant="secondary" className="ml-2">{data.rfq.lineItems.length}</Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Upload your quote to auto-fill, or enter prices manually for each item
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Optional Upload Section */}
            <div>
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
                    {aiMatching ? 'Analyzing quote...' : 'Uploading...'}
                  </p>
                  {uploadingFileName && (
                    <p className="text-sm text-emerald-600 mt-1">{uploadingFileName}</p>
                  )}
                </div>
              ) : !uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-700 font-medium">Upload your quote (optional)</p>
                  <p className="text-sm text-gray-400 mt-1">
                    PDF or image - we'll auto-fill prices for you
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <File className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {uploadedFileSize > 0 ? `${(uploadedFileSize / 1024 / 1024).toFixed(2)} MB` : 'Uploaded'}
                      {aiMatchResult && ` • ${aiMatchResult.summary.matched + aiMatchResult.summary.partial} items matched`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={removeUploadedFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* AI Match warning for missing items */}
              {aiMatchResult && aiMatchResult.summary.missing > 0 && (
                <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {aiMatchResult.summary.missing} item{aiMatchResult.summary.missing > 1 ? 's' : ''} not found in your quote
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Please enter prices manually for items marked below
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Unified Item Cards - Product info + Price + Lead Time + Notes */}
            <div className="space-y-4">
              {data.rfq.lineItems.map((item, index) => {
                const lineItem = lineItems[index]
                const imageUrl = (item.roomFFEItem?.images && item.roomFFEItem.images[0]) || null
                const specs = item.roomFFEItem
                const hasSpecs = specs?.sku || specs?.color || specs?.finish || specs?.material || specs?.width || specs?.modelNumber || specs?.length
                const documents = specs?.documents || []
                const hasItemNotes = item.notes || specs?.notes
                const supplierLink = specs?.supplierLink

                const hasPrice = lineItem?.unitPrice && parseFloat(lineItem.unitPrice) > 0
                const hasLeadTime = lineItem?.leadTime
                const needsNotes = lineItem?.leadTime === 'See notes'
                const isMissing = aiMatchResult?.matchResults.find(
                  r => r.rfqItem?.id === item.id && r.status === 'missing'
                )

                // Validation highlighting
                const showPriceError = showValidationErrors && !hasPrice
                const showLeadTimeError = showValidationErrors && !hasLeadTime
                const showNotesError = showValidationErrors && needsNotes && !lineItem?.notes?.trim()

                return (
                  <div key={item.id} className={cn(
                    "border rounded-xl overflow-hidden bg-white transition-all",
                    isMissing && "ring-2 ring-amber-300",
                    (showPriceError || showLeadTimeError) && "ring-2 ring-red-300"
                  )}>
                    {/* Product Info Header */}
                    <div className="flex items-start gap-4 p-4">
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.itemName} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                                {index + 1}
                              </span>
                              <h3 className="font-semibold text-gray-900 text-lg">{item.itemName}</h3>
                            </div>
                            {item.itemDescription && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.itemDescription}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {specs?.brand && (
                                <Badge variant="outline" className="text-xs">{specs.brand}</Badge>
                              )}
                              {item.category && (
                                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                              )}
                              {isMissing && (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100 text-xs">
                                  Not in uploaded quote
                                </Badge>
                              )}
                            </div>
                            {/* Supplier Link */}
                            {supplierLink && (
                              <a
                                href={supplierLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                View Product Page
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-3xl font-bold text-emerald-600">{item.quantity}</p>
                            <p className="text-xs text-gray-500">{item.unitType || 'units'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specifications */}
                    {hasSpecs && (
                      <div className="px-4 py-3 border-t bg-gray-50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          {specs?.sku && (
                            <div>
                              <span className="text-gray-400 text-xs">SKU</span>
                              <p className="font-medium text-gray-700">{specs.sku}</p>
                            </div>
                          )}
                          {specs?.modelNumber && (
                            <div>
                              <span className="text-gray-400 text-xs">Model #</span>
                              <p className="font-medium text-gray-700">{specs.modelNumber}</p>
                            </div>
                          )}
                          {specs?.color && (
                            <div>
                              <span className="text-gray-400 text-xs">Color</span>
                              <p className="font-medium text-gray-700">{specs.color}</p>
                            </div>
                          )}
                          {specs?.finish && (
                            <div>
                              <span className="text-gray-400 text-xs">Finish</span>
                              <p className="font-medium text-gray-700">{specs.finish}</p>
                            </div>
                          )}
                          {specs?.material && (
                            <div>
                              <span className="text-gray-400 text-xs">Material</span>
                              <p className="font-medium text-gray-700">{specs.material}</p>
                            </div>
                          )}
                          {(specs?.width || specs?.height || specs?.depth || specs?.length) && (
                            <div className="col-span-2">
                              <span className="text-gray-400 text-xs">Dimensions</span>
                              <p className="font-medium text-gray-700">
                                {[specs?.width && `W: ${specs.width}`, specs?.height && `H: ${specs.height}`, specs?.depth && `D: ${specs.depth}`, specs?.length && `L: ${specs.length}`].filter(Boolean).join(' • ')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Item Notes from AllSpec */}
                    {hasItemNotes && (
                      <div className="px-4 py-3 border-t bg-amber-50">
                        <p className="text-xs font-medium text-amber-700 mb-1">Item Notes</p>
                        <p className="text-sm text-amber-900">{item.notes || specs?.notes}</p>
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

                    {/* Quote Input Section - Price, Lead Time, Notes */}
                    <div className="px-4 py-4 border-t bg-emerald-50/50">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">Your Quote</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Unit Price */}
                        <div>
                          <Label className="text-xs font-medium">
                            Unit Price <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative mt-1">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={lineItem?.unitPrice || ''}
                              onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                              placeholder="0.00"
                              className={cn(
                                "pl-10 bg-white",
                                showPriceError && "border-red-500 ring-1 ring-red-500"
                              )}
                            />
                          </div>
                          {showPriceError && (
                            <p className="text-xs text-red-600 mt-1">Price is required</p>
                          )}
                        </div>

                        {/* Lead Time */}
                        <div>
                          <Label className="text-xs font-medium">
                            Lead Time <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={lineItem?.leadTime || ''}
                            onChange={(e) => updateLineItem(index, 'leadTime', e.target.value)}
                            className={cn(
                              "mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white",
                              showLeadTimeError ? "border-red-500 ring-1 ring-red-500" : "border-gray-200"
                            )}
                          >
                            <option value="">Select lead time...</option>
                            <option value="In Stock">In Stock</option>
                            <option value="1-2 weeks">1-2 Weeks</option>
                            <option value="2-4 weeks">2-4 Weeks</option>
                            <option value="4-6 weeks">4-6 Weeks</option>
                            <option value="6-8 weeks">6-8 Weeks</option>
                            <option value="8-12 weeks">8-12 Weeks</option>
                            <option value="12+ weeks">12+ Weeks</option>
                            <option value="See notes">See notes (explain below)</option>
                          </select>
                          {showLeadTimeError && (
                            <p className="text-xs text-red-600 mt-1">Lead time is required</p>
                          )}
                        </div>

                        {/* Notes */}
                        <div>
                          <Label className="text-xs font-medium">
                            Notes {needsNotes ? <span className="text-red-500">*</span> : '(optional)'}
                          </Label>
                          <Input
                            value={lineItem?.notes || ''}
                            onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                            placeholder={needsNotes ? "Explain lead time (backordered, out of stock, etc.)" : "Any notes..."}
                            className={cn(
                              "mt-1 bg-white",
                              showNotesError && "border-red-500 ring-1 ring-red-500"
                            )}
                          />
                          {showNotesError && (
                            <p className="text-xs text-red-600 mt-1">Notes required when "See notes" is selected</p>
                          )}
                        </div>
                      </div>

                      {/* Line total */}
                      {hasPrice && (
                        <div className="mt-3 pt-3 border-t border-emerald-200 text-right">
                          <span className="text-sm text-gray-600">Line Total: </span>
                          <span className="text-lg font-bold text-emerald-600">
                            {formatCurrency(parseFloat(lineItem.unitPrice) * item.quantity)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Unmatched Items - Ask supplier to link */}
            {aiMatchResult && aiMatchResult.matchResults.filter(r => r.status === 'extra' && r.suggestedMatches && r.suggestedMatches.length > 0).length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50">
                <div className="bg-amber-100 px-4 py-3 border-b border-amber-200">
                  <p className="font-medium text-amber-800">Link Unmatched Items</p>
                  <p className="text-xs text-amber-600">We found items in your quote that need to be linked to our request</p>
                </div>
                <div className="divide-y divide-amber-200">
                  {aiMatchResult.matchResults
                    .map((result, idx) => ({ result, idx }))
                    .filter(({ result }) => result.status === 'extra' && result.suggestedMatches && result.suggestedMatches.length > 0)
                    .map(({ result, idx }) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{result.extractedItem?.productName}</p>
                            <p className="text-xs text-gray-500">
                              {result.extractedItem?.quantity && `Qty: ${result.extractedItem.quantity}`}
                              {result.extractedItem?.unitPrice && ` • $${result.extractedItem.unitPrice}`}
                            </p>
                          </div>
                        </div>
                        <div className="ml-9">
                          <Label className="text-xs text-amber-700">Link to:</Label>
                          <select
                            value={manualLinks[idx] || ''}
                            onChange={(e) => {
                              const rfqItemId = e.target.value
                              setManualLinks(prev => ({ ...prev, [idx]: rfqItemId }))
                              // Auto-fill the linked item's price
                              if (rfqItemId && result.extractedItem?.unitPrice) {
                                const itemIndex = lineItems.findIndex(li => li.rfqLineItemId === rfqItemId)
                                if (itemIndex >= 0) {
                                  updateLineItem(itemIndex, 'unitPrice', result.extractedItem.unitPrice.toString())
                                  if (result.extractedItem.leadTime) {
                                    updateLineItem(itemIndex, 'leadTime', result.extractedItem.leadTime)
                                  }
                                }
                              }
                            }}
                            className="mt-1 w-full rounded-md border border-amber-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">Select item to link...</option>
                            {result.suggestedMatches?.map(suggestion => (
                              <option key={suggestion.id} value={suggestion.id}>
                                {suggestion.itemName}
                              </option>
                            ))}
                            {/* Also show unmatched RFQ items */}
                            {data.rfq.lineItems
                              .filter(item => {
                                const isMatched = aiMatchResult.matchResults.some(
                                  r => r.rfqItem?.id === item.id && (r.status === 'matched' || r.status === 'partial')
                                )
                                const isSuggested = result.suggestedMatches?.some(s => s.id === item.id)
                                return !isMatched && !isSuggested
                              })
                              .map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.itemName}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Delivery - Simple input, no toggle */}
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
                  placeholder="Leave empty if no delivery fee"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Leave empty if delivery is included or not applicable</p>
            </div>

            {/* Order Notes */}
            <div>
              <Label>Additional Notes (optional)</Label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Payment terms, special instructions, etc."
                rows={2}
                className="mt-1.5"
              />
            </div>

            {/* Quote Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal ({lineItems.length} items)</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              {parseFloat(deliveryFee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-medium">{formatCurrency(calculateDeliveryTotal())}</span>
                </div>
              )}
              {isQuebec && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (5%)</span>
                    <span className="font-medium">{formatCurrency(calculateTaxes().gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">QST (9.975%)</span>
                    <span className="font-medium">{formatCurrency(calculateTaxes().qst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-3 border-t">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
              {isQuebec && (
                <p className="text-xs text-gray-500 pt-2">Quebec taxes (GST + QST) applied automatically</p>
              )}
            </div>
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
            disabled={submitting || aiMatching}
            size="lg"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 order-1 sm:order-2"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" />
            Submit Quote
          </Button>
        </div>
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
