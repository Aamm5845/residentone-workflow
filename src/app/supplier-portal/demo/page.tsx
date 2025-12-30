'use client'

import { useState, useRef } from 'react'
import {
  Building2,
  Package,
  Clock,
  Send,
  AlertCircle,
  Loader2,
  DollarSign,
  FileText,
  Upload,
  X,
  File,
  Truck,
  Edit3,
  Mail
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'

// Demo/mock data
const DEMO_DATA = {
  rfq: {
    id: 'demo-rfq-1',
    rfqNumber: 'RFQ-2024-DEMO',
    title: 'Living Room Furniture Package',
    description: 'Please provide pricing for the following items. We need delivery to the project site.',
    responseDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    project: {
      name: 'Demo Project - Modern Condo',
      streetAddress: '123 Demo Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2V4H9',
      client: { name: 'John Smith' }
    },
    lineItems: [
      {
        id: 'item-1',
        itemName: 'Modern Sectional Sofa',
        itemDescription: 'L-shaped sectional with chaise, performance fabric',
        quantity: 1,
        unitType: 'unit',
        notes: 'Client prefers grey or charcoal color',
        roomFFEItem: {
          images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200'],
          brand: 'West Elm',
          sku: 'WE-SECT-001',
          color: 'Charcoal'
        }
      },
      {
        id: 'item-2',
        itemName: 'Coffee Table - Marble Top',
        itemDescription: 'Round coffee table with brass base',
        quantity: 1,
        unitType: 'unit',
        roomFFEItem: {
          images: ['https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=200'],
          brand: 'CB2',
          sku: 'CB2-CT-445',
          color: 'White/Brass'
        }
      },
      {
        id: 'item-3',
        itemName: 'Accent Chair',
        itemDescription: 'Mid-century modern accent chair',
        quantity: 2,
        unitType: 'units',
        roomFFEItem: {
          brand: 'Article',
          sku: 'ART-AC-221',
          color: 'Teal'
        }
      },
      {
        id: 'item-4',
        itemName: 'Floor Lamp',
        itemDescription: 'Arc floor lamp with marble base',
        quantity: 1,
        unitType: 'unit',
        roomFFEItem: {
          brand: 'West Elm',
          sku: 'WE-FL-089'
        }
      },
      {
        id: 'item-5',
        itemName: 'Area Rug 8x10',
        itemDescription: 'Hand-knotted wool rug',
        quantity: 1,
        unitType: 'unit',
        notes: 'Must be low pile',
        roomFFEItem: {
          brand: 'Loloi',
          sku: 'LOL-RUG-810'
        }
      }
    ]
  },
  supplier: {
    name: 'Demo Supplier Co.',
    email: 'demo@supplier.com'
  }
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
  rfqItem?: { id: string; itemName: string; quantity: number }
  extractedItem?: { productName: string; sku?: string; unitPrice?: number; quantity?: number }
}

type QuoteMode = 'select' | 'upload' | 'manual'

export default function SupplierPortalDemoPage() {
  const [quoteMode, setQuoteMode] = useState<QuoteMode>('select')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [aiMatching, setAiMatching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deliveryFee, setDeliveryFee] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
    DEMO_DATA.rfq.lineItems.map(item => ({
      rfqLineItemId: item.id,
      unitPrice: '',
      quantity: item.quantity,
      leadTime: '',
      notes: ''
    }))
  )
  const [aiMatchResult, setAiMatchResult] = useState<any>(null)

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

  const calculateTotal = () => {
    return calculateSubtotal() + (parseFloat(deliveryFee) || 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleSendByEmail = () => {
    const subject = encodeURIComponent(`Quote for ${DEMO_DATA.rfq.rfqNumber} - ${DEMO_DATA.rfq.project.name}`)
    const body = encodeURIComponent(`Hi,\n\nPlease find attached my quote for ${DEMO_DATA.rfq.rfqNumber}.\n\n[Please attach your quote PDF to this email]\n\nBest regards`)
    window.location.href = `mailto:shaya@meisnerinteriors.com?subject=${subject}&body=${body}`
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadedFile(file)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setUploading(false)

    setAiMatching(true)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock AI result
    setAiMatchResult({
      success: true,
      supplierInfo: { shipping: 250, taxes: 450, total: 8750 },
      matchResults: [
        { status: 'matched', rfqItem: { id: 'item-1', itemName: 'Modern Sectional Sofa', quantity: 1 }, extractedItem: { productName: 'Sectional Sofa - Grey', unitPrice: 3200, quantity: 1 } },
        { status: 'matched', rfqItem: { id: 'item-2', itemName: 'Coffee Table - Marble Top', quantity: 1 }, extractedItem: { productName: 'Marble Coffee Table', unitPrice: 890, quantity: 1 } },
        { status: 'matched', rfqItem: { id: 'item-3', itemName: 'Accent Chair', quantity: 2 }, extractedItem: { productName: 'Mid-Century Accent Chair', unitPrice: 650, quantity: 2 } },
        { status: 'matched', rfqItem: { id: 'item-4', itemName: 'Floor Lamp', quantity: 1 }, extractedItem: { productName: 'Arc Floor Lamp', unitPrice: 420, quantity: 1 } },
        { status: 'partial', rfqItem: { id: 'item-5', itemName: 'Area Rug 8x10', quantity: 1 }, extractedItem: { productName: 'Wool Area Rug 8x10', unitPrice: 1290, quantity: 1 } },
        { status: 'extra', extractedItem: { productName: 'Throw Pillows (Set of 4)', unitPrice: 180, quantity: 1 } }
      ],
      summary: { totalRequested: 5, matched: 4, partial: 1, missing: 0, extra: 1 }
    })
    setAiMatching(false)
    toast.success('All items matched!')
  }

  const removeUploadedFile = () => {
    setUploadedFile(null)
    setAiMatchResult(null)
    setQuoteMode('select')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = () => {
    toast.success('Demo: Quote would be submitted here!')
  }

  const data = DEMO_DATA
  const project = data.rfq.project

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Toaster position="top-right" />

      {/* Demo Banner */}
      <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
        Demo Mode - This is a preview of the supplier portal
      </div>

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
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
              <p className="text-emerald-100 text-xs uppercase tracking-wide mb-1">Please respond by</p>
              <p className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatDate(data.rfq.responseDeadline)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Ship To & Bill To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-2">Ship To</p>
                  <p className="font-bold text-gray-900 text-lg mb-1">{project.client?.name}</p>
                  <p className="text-sm text-blue-600 mb-2">Project: {project.name}</p>
                  <div className="text-sm text-gray-600">
                    <p>{project.streetAddress}</p>
                    <p>{project.city}, {project.province} {project.postalCode}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold mb-2">Bill To</p>
                  <p className="font-bold text-gray-900 text-lg mb-1">Meisner Interiors</p>
                  <div className="text-sm text-gray-600">
                    <p>6700 Ave Du Parc #109</p>
                    <p>Montreal, QC H2V4H9</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                    <p>514 797 6957</p>
                    <p>aaron@meisnerinteriors.com</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Info */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-600">D</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Quoting as</p>
            <p className="font-medium text-gray-900">{data.supplier.name}</p>
          </div>
          <p className="text-sm text-gray-500 ml-auto">{data.supplier.email}</p>
        </div>

        {/* Description */}
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-gray-700">{data.rfq.description}</p>
          </CardContent>
        </Card>

        {/* Items List */}
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
                const imageUrl = item.roomFFEItem?.images?.[0]
                const specs = item.roomFFEItem
                const lineItem = lineItems[index]
                const manualPrice = lineItem?.unitPrice ? parseFloat(lineItem.unitPrice) : null

                const specParts: string[] = []
                if (specs?.brand) specParts.push(specs.brand)
                if (specs?.sku) specParts.push(specs.sku)
                if (specs?.color) specParts.push(specs.color)
                const specsLine = specParts.join(' • ')

                const matchedItem = aiMatchResult?.matchResults.find(
                  (r: AIMatchResult) => r.rfqItem?.id === item.id && (r.status === 'matched' || r.status === 'partial')
                )
                const matchedPrice = matchedItem?.extractedItem?.unitPrice

                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.itemName} className="w-16 h-16 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900">
                              <span className="text-emerald-600 mr-2">{index + 1}.</span>
                              {item.itemName}
                            </h3>
                            {specsLine && <p className="text-sm text-gray-500 mt-1">{specsLine}</p>}
                            {item.itemDescription && <p className="text-sm text-gray-400 mt-1">{item.itemDescription}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-emerald-600">{item.quantity}</p>
                            <p className="text-xs text-gray-400">{item.unitType || 'units'}</p>
                          </div>
                        </div>

                        {item.notes && (
                          <div className="mt-2">
                            <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">Note: {item.notes}</span>
                          </div>
                        )}

                        {/* Upload mode: price, lead time, notes inline */}
                        {quoteMode === 'upload' && aiMatchResult && (
                          <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
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
                            <div className="min-w-[140px]">
                              <Label className="text-xs text-gray-500">Lead Time</Label>
                              <select
                                value={lineItem?.leadTime || ''}
                                onChange={(e) => updateLineItem(index, 'leadTime', e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
                              >
                                <option value="">Select...</option>
                                <option value="In Stock">In Stock</option>
                                <option value="1-2 weeks">1-2 Weeks</option>
                                <option value="2-4 weeks">2-4 Weeks</option>
                                <option value="4-6 weeks">4-6 Weeks</option>
                              </select>
                            </div>
                            <div className="flex-1 min-w-[150px]">
                              <Label className="text-xs text-gray-500">Notes</Label>
                              <Input
                                value={lineItem?.notes || ''}
                                onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                                placeholder="Optional notes..."
                                className="mt-1 h-9"
                              />
                            </div>
                            {matchedPrice && (
                              <div className="text-right min-w-[100px]">
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(matchedPrice * item.quantity)}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Manual mode */}
                        {quoteMode === 'manual' && (
                          <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
                            <div className="min-w-[120px]">
                              <Label className="text-xs text-gray-500">Unit Price</Label>
                              <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={lineItem?.unitPrice || ''}
                                  onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                                  placeholder="0.00"
                                  className="pl-7 h-9"
                                />
                              </div>
                            </div>
                            <div className="min-w-[140px]">
                              <Label className="text-xs text-gray-500">Lead Time</Label>
                              <select
                                value={lineItem?.leadTime || ''}
                                onChange={(e) => updateLineItem(index, 'leadTime', e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-gray-200 px-3 text-sm bg-white"
                              >
                                <option value="">Select...</option>
                                <option value="In Stock">In Stock</option>
                                <option value="1-2 weeks">1-2 Weeks</option>
                                <option value="2-4 weeks">2-4 Weeks</option>
                                <option value="4-6 weeks">4-6 Weeks</option>
                              </select>
                            </div>
                            <div className="flex-1 min-w-[150px]">
                              <Label className="text-xs text-gray-500">Notes</Label>
                              <Input
                                value={lineItem?.notes || ''}
                                onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                                placeholder="Optional notes..."
                                className="mt-1 h-9"
                              />
                            </div>
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
                  <p className="text-sm text-gray-500">Upload your quote PDF or image and we'll automatically extract prices</p>
                </CardContent>
              </Card>

              <Card
                className="shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                onClick={() => setQuoteMode('manual')}
              >
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Edit3 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Manually</h3>
                  <p className="text-sm text-gray-500">Enter prices and lead times manually for each item</p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-4 pb-8">
              <p className="text-sm text-gray-500 mb-2">Prefer to send your quote by email?</p>
              <Button variant="ghost" onClick={handleSendByEmail} className="text-gray-600 hover:text-gray-900">
                <Mail className="w-4 h-4 mr-2" />
                Send Quote by Email Instead
              </Button>
            </div>
          </>
        )}

        {/* Upload Mode */}
        {quoteMode === 'upload' && (
          <>
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
                <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileSelect} className="hidden" />

                {uploading || aiMatching ? (
                  <div className="border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center bg-emerald-50">
                    <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 animate-spin" />
                    <p className="text-emerald-700 font-medium">{aiMatching ? 'Analyzing your quote...' : 'Uploading...'}</p>
                  </div>
                ) : !uploadedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                  >
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-700 font-medium">Click to upload your quote</p>
                    <p className="text-sm text-gray-400 mt-1">PDF or image files</p>
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

            {/* Extra items + Summary */}
            {aiMatchResult && (
              <>
                {aiMatchResult.matchResults.filter((r: AIMatchResult) => r.status === 'extra').length > 0 && (
                  <Card className="shadow-sm border-l-4 border-l-amber-400">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                        <AlertCircle className="w-4 h-4" />
                        Additional Items in Your Quote
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {aiMatchResult.matchResults
                          .filter((r: AIMatchResult) => r.status === 'extra')
                          .map((result: AIMatchResult, idx: number) => (
                            <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                              <p className="font-medium text-gray-900">{result.extractedItem?.productName}</p>
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

                <Card className="shadow-sm">
                  <CardContent className="pt-5 pb-5">
                    <div className="space-y-3">
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
                      {aiMatchResult.supplierInfo?.shipping > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Shipping / Delivery</span>
                          <span className="font-medium">{formatCurrency(aiMatchResult.supplierInfo.shipping)}</span>
                        </div>
                      )}
                      {aiMatchResult.supplierInfo?.taxes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Taxes</span>
                          <span className="font-medium">{formatCurrency(aiMatchResult.supplierInfo.taxes)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Quote Total</span>
                        <span className="text-2xl font-bold text-emerald-600">{formatCurrency(aiMatchResult.supplierInfo?.total || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Manual Mode */}
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
              <div className="border rounded-xl p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4" />
                  Delivery Fee (if applicable)
                </h4>
                <div className="relative max-w-xs">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="0.00" className="pl-10" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                </div>
                {parseFloat(deliveryFee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-medium">{formatCurrency(parseFloat(deliveryFee))}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Submit */}
        {quoteMode !== 'select' && (
          <>
            <Card className="shadow-sm">
              <CardContent className="pt-5 pb-5">
                <Label className="font-medium">Additional Notes (optional)</Label>
                <Textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Payment terms, special instructions, etc." rows={2} className="mt-2" />
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
              <Button variant="outline" onClick={handleSendByEmail} className="w-full sm:w-auto order-2 sm:order-1">
                <Mail className="w-4 h-4 mr-2" />
                Send Quote by Email
              </Button>
              <Button onClick={handleSubmit} size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 order-1 sm:order-2">
                <Send className="w-4 h-4 mr-2" />
                Submit Quote
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
