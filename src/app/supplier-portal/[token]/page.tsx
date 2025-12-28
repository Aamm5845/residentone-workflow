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
  MessageCircle,
  Upload,
  X,
  File
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function SupplierPortalPage({ params }: SupplierPortalPageProps) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RFQData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitMode, setSubmitMode] = useState<'upload' | 'detailed'>('upload')
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadTotalAmount, setUploadTotalAmount] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')

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

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice) || 0
      return sum + (price * item.quantity)
    }, 0)
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

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, Word, Excel, or image file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
    setUploading(true)

    try {
      // Upload the file
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'supplier-quotes')

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (uploadResponse.ok) {
        const { url } = await uploadResponse.json()
        setUploadedFileUrl(url)
        toast.success('Quote document uploaded successfully')
      } else {
        toast.error('Failed to upload file')
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
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadedFileUrl) {
      toast.error('Please upload your quote document first')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/supplier-portal/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quoteNumber: `SQ-${Date.now()}`,
          quoteDocumentUrl: uploadedFileUrl,
          totalAmount: uploadTotalAmount ? parseFloat(uploadTotalAmount) : null,
          supplierNotes: uploadNotes || null,
          // Create placeholder line items with zero prices (will be updated after review)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading quote request...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">{error}</h2>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Toaster position="top-right" />
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {data.responseStatus === 'DECLINED' ? 'Quote Declined' : 'Quote Submitted'}
            </h2>
            <p className="text-gray-500">
              {data.responseStatus === 'DECLINED'
                ? 'You have declined this quote request.'
                : 'Thank you! Your quote has been submitted successfully.'}
            </p>
            {data.existingQuote && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                <p className="text-sm text-gray-500">Quote Reference</p>
                <p className="font-medium">{data.existingQuote.quoteNumber}</p>
                <p className="text-sm text-gray-500 mt-2">Total Amount</p>
                <p className="font-medium">{formatCurrency(data.existingQuote.totalAmount || 0)}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Messaging widget */}
        <SupplierMessaging
          token={token}
          projectName={data.rfq.project.name}
          supplierName={data.supplier.name}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-emerald-600 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-emerald-100 text-sm">Request for Quote</p>
              <h1 className="text-2xl font-bold">{data.rfq.rfqNumber}</h1>
            </div>
          </div>
          <h2 className="text-xl mb-2">{data.rfq.title}</h2>
          <p className="text-emerald-100">Project: {data.rfq.project.name}</p>
          {data.rfq.responseDeadline && (
            <p className="mt-4 flex items-center gap-2 text-emerald-200 text-sm">
              <Clock className="w-3.5 h-3.5" />
              Please respond by {formatDate(data.rfq.responseDeadline)}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Supplier Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">{data.supplier.name || 'Supplier'}</p>
                <p className="text-sm text-gray-500">{data.supplier.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {data.rfq.description && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{data.rfq.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Items Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Items Requested ({data.rfq.lineItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.rfq.lineItems.map((item, index) => {
                const imageUrl = (item.roomFFEItem?.images && item.roomFFEItem.images[0]) || null
                const specs = item.roomFFEItem
                const hasSpecs = specs?.sku || specs?.color || specs?.finish || specs?.material || specs?.width
                const documents = specs?.documents || []

                return (
                  <div key={item.id} className="border rounded-lg overflow-hidden">
                    {/* Item Header */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.itemName} className="w-20 h-20 object-cover rounded-lg border" />
                      ) : (
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{item.itemName}</h3>
                        {item.itemDescription && (
                          <p className="text-sm text-gray-600 mt-1">{item.itemDescription}</p>
                        )}
                        {specs?.brand && (
                          <Badge variant="outline" className="mt-2">{specs.brand}</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">{item.quantity}</p>
                        <p className="text-sm text-gray-500">{item.unitType || 'units'}</p>
                      </div>
                    </div>

                    {/* Specifications */}
                    {hasSpecs && (
                      <div className="px-4 py-3 border-t bg-white">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Specifications</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {specs.sku && (
                            <div>
                              <span className="text-gray-500">SKU:</span>
                              <span className="ml-1 font-medium">{specs.sku}</span>
                            </div>
                          )}
                          {specs.color && (
                            <div>
                              <span className="text-gray-500">Color:</span>
                              <span className="ml-1 font-medium">{specs.color}</span>
                            </div>
                          )}
                          {specs.finish && (
                            <div>
                              <span className="text-gray-500">Finish:</span>
                              <span className="ml-1 font-medium">{specs.finish}</span>
                            </div>
                          )}
                          {specs.material && (
                            <div>
                              <span className="text-gray-500">Material:</span>
                              <span className="ml-1 font-medium">{specs.material}</span>
                            </div>
                          )}
                          {(specs.width || specs.height || specs.depth) && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Dimensions:</span>
                              <span className="ml-1 font-medium">
                                {[specs.width, specs.height, specs.depth].filter(Boolean).join(' x ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {documents.length > 0 && (
                      <div className="px-4 py-3 border-t bg-blue-50">
                        <p className="text-xs font-medium text-blue-700 uppercase mb-2">📎 Documents</p>
                        <div className="flex flex-wrap gap-2">
                          {documents.map(doc => (
                            <a
                              key={doc.id}
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
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

        {/* Quote Submission Options */}
        <Tabs value={submitMode} onValueChange={(v) => setSubmitMode(v as 'upload' | 'detailed')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Quote
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Enter Details
            </TabsTrigger>
          </TabsList>

          {/* Upload Quote Tab */}
          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Your Quote Document</CardTitle>
                <CardDescription>
                  Upload a PDF, Word, Excel, or image file containing your quote
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-spin" />
                    ) : (
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    )}
                    <p className="text-gray-600 font-medium">
                      {uploading ? 'Uploading...' : 'Click to upload your quote'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      PDF, Word, Excel, or images up to 10MB
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <File className="w-10 h-10 text-emerald-600" />
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div>
                    <Label>Total Amount (optional)</Label>
                    <div className="relative mt-1">
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
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Quote Tab */}
          <TabsContent value="detailed" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Item Pricing</CardTitle>
                <CardDescription>Enter your pricing for each item</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {data.rfq.lineItems.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-medium text-emerald-600">
                              {index + 1}
                            </span>
                            <h3 className="font-medium">{item.itemName}</h3>
                          </div>
                          {item.itemDescription && (
                            <p className="text-sm text-gray-500 ml-8">{item.itemDescription}</p>
                          )}
                          {item.category && (
                            <Badge variant="outline" className="ml-8 mt-1">{item.category}</Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-medium">{item.quantity}</p>
                          <p className="text-sm text-gray-500">{item.unitType || 'units'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <Label>Unit Price (CAD) <span className="text-red-500">*</span></Label>
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
                          <Label>Availability</Label>
                          <select
                            value={lineItems[index]?.availability || 'IN_STOCK'}
                            onChange={(e) => updateLineItem(index, 'availability', e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="IN_STOCK">In Stock</option>
                            <option value="BACKORDER">Backorder</option>
                            <option value="SPECIAL_ORDER">Special Order</option>
                          </select>
                        </div>

                        <div>
                          <Label>Lead Time (weeks)</Label>
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

                      <div className="mt-3">
                        <Label>Notes</Label>
                        <Input
                          value={lineItems[index]?.notes || ''}
                          onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                          placeholder="Any additional notes for this item..."
                          className="mt-1"
                        />
                      </div>

                      {lineItems[index]?.unitPrice && (
                        <div className="mt-3 text-right">
                          <span className="text-sm text-gray-500">Line Total: </span>
                          <span className="font-medium">
                            {formatCurrency(parseFloat(lineItems[index].unitPrice) * item.quantity)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quote Summary - Only in detailed mode */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Your Quote Number (optional)</Label>
                    <Input
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      placeholder="e.g., QT-2024-001"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Quote Valid Until</Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Terms</Label>
                    <Input
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g., Net 30"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Shipping Terms</Label>
                    <Input
                      value={shippingTerms}
                      onChange={(e) => setShippingTerms(e.target.value)}
                      placeholder="e.g., FOB Destination"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Estimated Lead Time</Label>
                  <Input
                    value={estimatedLeadTime}
                    onChange={(e) => setEstimatedLeadTime(e.target.value)}
                    placeholder="e.g., 4-6 weeks"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={supplierNotes}
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    placeholder="Any additional information or terms..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">Quote Total:</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={submitting}
            className="text-gray-600"
          >
            Decline to Quote
          </Button>
          <Button
            onClick={submitMode === 'upload' ? handleUploadSubmit : handleSubmit}
            disabled={submitting || (submitMode === 'upload' && !uploadedFileUrl)}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" />
            Submit Quote
          </Button>
        </div>
      </div>

      {/* All Project Items Section */}
      {data.allProjectItems && data.allProjectItems.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              All Items Sent to You ({data.allProjectItems.length})
            </CardTitle>
            <p className="text-sm text-gray-500">
              All products from {data.rfq.project.name} that have been sent to you for quoting
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.allProjectItems.map((item) => {
                const imageUrl = item.roomFFEItem?.images?.[0] || null
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border",
                      item.isCurrentRfq ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                    )}
                  >
                    {/* Image */}
                    {imageUrl && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white border">
                        <img src={imageUrl} alt={item.itemName} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.itemName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{item.category}</span>
                        {item.roomFFEItem?.brand && (
                          <>
                            <span>•</span>
                            <span>{item.roomFFEItem.brand}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{item.quantity} {item.unitType || 'units'}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 text-right">
                      {item.hasQuote && item.quotedPrice ? (
                        <div>
                          <p className="font-semibold text-green-700">${Number(item.quotedPrice).toLocaleString()}</p>
                          <p className="text-xs text-green-600">Quoted</p>
                        </div>
                      ) : item.isCurrentRfq ? (
                        <Badge className="bg-emerald-600 text-white">Current Request</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Pending</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messaging widget */}
      <SupplierMessaging
        token={token}
        projectName={data.rfq.project.name}
        supplierName={data.supplier.name}
      />
    </div>
  )
}
