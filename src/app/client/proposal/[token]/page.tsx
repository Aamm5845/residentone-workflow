'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, FileText, CheckCircle, Clock, AlertCircle, X, Pen, Type, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PaymentScheduleItem {
  title: string
  amount: number
  percent: number | null
  dueOn: string
  description?: string
}

interface ScopeItem {
  title: string
  description: string
}

interface ProposalContent {
  projectOverview?: string
  scopeItems?: ScopeItem[]
  terms?: string
  // Legacy fields
  scope?: string
  deliverables?: Array<{ title: string; description?: string; price?: number }>
  timeline?: string
  pricing?: { items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>; notes?: string }
}

interface ProposalData {
  id: string
  proposalNumber: string
  title: string
  billingType: string
  status: string
  content: ProposalContent
  coverLetter: string | null
  paymentSchedule: PaymentScheduleItem[] | null
  clientName: string
  clientEmail: string
  clientPhone: string | null
  clientAddress: string | null
  projectAddress: string | null
  subtotal: number
  depositAmount: number | null
  depositPercent: number | null
  hourlyRate: number | null
  discountPercent: number | null
  discountAmount: number | null
  gstRate: number | null
  gstAmount: number | null
  qstRate: number | null
  qstAmount: number | null
  ccFeePercent: number
  totalAmount: number
  validUntil: string | null
  validDays: number | null
  notes: string | null
  signedAt: string | null
  signedByName: string | null
  companySignature: string | null
  companySignedByName: string | null
  companySignedAt: string | null
  project: { id: string; name: string }
  organization: {
    name: string
    businessName: string | null
    logoUrl: string | null
    businessEmail: string | null
    businessPhone: string | null
    businessAddress: string | null
    businessCity: string | null
    businessProvince: string | null
    businessPostal: string | null
    gstNumber: string | null
    qstNumber: string | null
    neqNumber: string | null
  }
}

// Print styles
const printStyles = `
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    html, body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-container {
      padding: 0 !important;
      margin: 0 !important;
    }
    .proposal-page {
      page-break-after: always;
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
    }
    .proposal-page:last-child {
      page-break-after: avoid;
    }
    @page {
      size: letter;
      margin: 0.5in;
    }
  }
`

export default function ClientProposalPage() {
  const params = useParams()
  const token = params?.token as string

  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  // Signature state
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('drawn')
  const [typedName, setTypedName] = useState('')
  const [signedByName, setSignedByName] = useState('')
  const [signedByEmail, setSignedByEmail] = useState('')
  const [signing, setSigning] = useState(false)
  const [signSuccess, setSignSuccess] = useState(false)

  // Canvas ref for drawn signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    if (token) {
      loadProposal()
    }
  }, [token])

  const loadProposal = async () => {
    try {
      const response = await fetch(`/api/billing/proposals/${token}/client-view`)
      if (response.ok) {
        const data = await response.json()
        setProposal(data)
        setSignedByEmail(data.clientEmail || '')
        setSignedByName(data.clientName || '')
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Proposal not found')
      }
    } catch (err) {
      console.error('Error loading proposal:', err)
      setError('Failed to load proposal')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    setHasDrawn(true)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const getSignatureData = (): string | null => {
    if (signatureType === 'typed') {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#1e293b'
      ctx.font = 'italic 32px "Brush Script MT", cursive, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2)

      return canvas.toDataURL('image/png')
    } else {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawn) return null
      return canvas.toDataURL('image/png')
    }
  }

  const handleSign = async () => {
    if (!signedByName || !signedByEmail) {
      alert('Please enter your name and email')
      return
    }

    const signatureData = getSignatureData()
    if (!signatureData) {
      alert(signatureType === 'drawn' ? 'Please draw your signature' : 'Please type your name')
      return
    }

    setSigning(true)

    try {
      const response = await fetch(`/api/billing/proposals/${token}/client-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          signatureType,
          signedByName,
          signedByEmail,
        }),
      })

      if (response.ok) {
        setSignSuccess(true)
        setShowSignDialog(false)
        await loadProposal()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to sign proposal')
      }
    } catch (err) {
      console.error('Error signing proposal:', err)
      alert('Failed to sign proposal')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Proposal Not Found</h1>
          <p className="text-gray-500 mt-2">{error || 'This proposal may have expired or been removed.'}</p>
        </div>
      </div>
    )
  }

  const companyName = proposal.organization?.businessName || proposal.organization?.name || 'Company'
  const isSigned = proposal.status === 'SIGNED'
  const isExpired = proposal.status === 'EXPIRED'
  const isDeclined = proposal.status === 'DECLINED'
  const canSign = !isSigned && !isExpired && !isDeclined

  // Get scope items (support both new and legacy format)
  const scopeItems = proposal.content?.scopeItems ||
    (proposal.content?.deliverables?.map(d => ({ title: d.title, description: d.description || '' })) || [])
  const projectOverview = proposal.content?.projectOverview || proposal.content?.scope || ''
  const terms = proposal.content?.terms || ''
  const paymentSchedule = proposal.paymentSchedule || []
  const coverLetter = proposal.coverLetter || ''

  // Page definitions
  const pages = [
    { id: 'cover', title: 'Cover' },
    { id: 'letter', title: 'Letter' },
    { id: 'scope', title: 'Scope of Work' },
    { id: 'terms', title: 'Terms' },
  ]

  // Header component for each page
  const PageHeader = () => (
    <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-amber-500">
      <div>
        {proposal.organization?.logoUrl ? (
          <img
            src={proposal.organization.logoUrl}
            alt={companyName}
            className="h-20 max-w-[280px] object-contain"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900">{companyName}</h2>
        )}
      </div>
      <div className="text-right text-sm text-gray-600">
        <p className="font-medium">{proposal.organization?.businessPhone}</p>
        <p>{proposal.organization?.businessEmail}</p>
        <div className="mt-2 flex items-center gap-2 justify-end">
          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
          <div>
            <p>{proposal.organization?.businessAddress}</p>
            <p>
              {proposal.organization?.businessCity}
              {proposal.organization?.businessProvince && ` ${proposal.organization.businessProvince}`}
              {proposal.organization?.businessPostal && `, ${proposal.organization.businessPostal}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print-container">
        <div className="max-w-4xl mx-auto">
          {/* Success Message */}
          {signSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 no-print">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Proposal Signed Successfully!</p>
                <p className="text-sm text-green-600">Thank you for accepting this proposal. You will receive an invoice for the deposit shortly.</p>
              </div>
            </div>
          )}

          {/* Page Navigation */}
          <div className="flex items-center justify-between mb-4 no-print">
            <div className="flex gap-2">
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  onClick={() => setCurrentPage(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === index
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page.title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/billing/proposals/${token}/pdf`, '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" />
                Print
              </Button>
              {canSign && (
                <Button
                  onClick={() => setShowSignDialog(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                >
                  <Pen className="w-4 h-4 mr-2" />
                  Sign Proposal
                </Button>
              )}
            </div>
          </div>

          {/* Cover Page */}
          <div className={`proposal-page bg-white rounded-2xl shadow-lg overflow-hidden mb-6 ${currentPage !== 0 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12 min-h-[800px] flex flex-col">
              <PageHeader />

              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <h1 className="text-5xl font-bold text-amber-500 mb-16">Proposal</h1>

                <div className="space-y-2">
                  <p className="text-gray-600">Client Name: <span className="font-semibold text-gray-900">{proposal.clientName}</span></p>
                  <p className="text-gray-600">Project Address:</p>
                  <p className="font-semibold text-gray-900">{proposal.projectAddress || proposal.clientAddress || '-'}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-center">
                {isSigned ? (
                  <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full">
                    <CheckCircle className="w-5 h-5" />
                    SIGNED on {formatDate(proposal.signedAt)}
                  </div>
                ) : isExpired ? (
                  <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full">
                    <AlertCircle className="w-5 h-5" />
                    EXPIRED
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-gray-500">
                    <Clock className="w-4 h-4" />
                    Valid until {formatDate(proposal.validUntil)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Letter Page */}
          <div className={`proposal-page bg-white rounded-2xl shadow-lg overflow-hidden mb-6 ${currentPage !== 1 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12 min-h-[800px]">
              <PageHeader />

              <div className="mb-8">
                <h3 className="text-xl font-bold text-amber-500 mb-2">Mr. {proposal.clientName}</h3>
                <p className="text-gray-600">{proposal.projectAddress || proposal.clientAddress}</p>
              </div>

              <div className="prose prose-gray max-w-none mb-12">
                {coverLetter.split('\n').map((paragraph, index) => (
                  paragraph.trim() && <p key={index} className="text-gray-700 mb-4">{paragraph}</p>
                ))}
              </div>

              <div className="mt-auto">
                <p className="font-bold text-gray-900">{proposal.companySignedByName || 'Aaron Meisner'}</p>
                <p className="text-gray-600">CEO {companyName}</p>
                {proposal.companySignature && (
                  <img
                    src={proposal.companySignature}
                    alt="Signature"
                    className="h-16 mt-4"
                  />
                )}
                {!proposal.companySignature && (
                  <div className="mt-4 italic text-2xl text-gray-400" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                    {proposal.companySignedByName || 'Aaron Meisner'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scope of Work Page */}
          <div className={`proposal-page bg-white rounded-2xl shadow-lg overflow-hidden mb-6 ${currentPage !== 2 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12 min-h-[800px]">
              <PageHeader />

              <h2 className="text-lg font-bold text-gray-900 mb-4">Project Overview</h2>
              <p className="text-gray-700 mb-8">{projectOverview}</p>

              <h2 className="text-lg font-bold text-gray-900 mb-4 italic">Scope of Work:</h2>
              <div className="space-y-6 mb-8">
                {scopeItems.map((item, index) => (
                  <div key={index}>
                    <h3 className="font-bold text-gray-900 italic">{index + 1}. {item.title}</h3>
                    <p className="text-gray-700 ml-4 mt-1">{item.description}</p>
                  </div>
                ))}
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-4 italic">Payment Schedule:</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">Total Budget Fee</span>
                  <span className="font-bold text-gray-900 border-b-2 border-dotted border-gray-300 flex-1 mx-4"></span>
                  <span className="font-bold text-gray-900">{formatCurrency(proposal.subtotal)}</span>
                </div>
                {paymentSchedule.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-700">{item.title}</span>
                    <span className="border-b-2 border-dotted border-gray-300 flex-1 mx-4"></span>
                    <span className="text-gray-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              {proposal.hourlyRate && proposal.hourlyRate > 0 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-gray-700">Additional work will be billed separately</span>
                  <span className="border-b-2 border-dotted border-gray-300 flex-1 mx-4"></span>
                  <span className="text-gray-900">{formatCurrency(proposal.hourlyRate)}/hour</span>
                </div>
              )}

              <p className="text-sm text-gray-600 mt-4">
                Payments are due within 7 days of the invoice date.
              </p>

              <p className="text-sm text-gray-700 mt-6">
                Once approved, design development will begin immediately, and coordination with consultants will be scheduled accordingly.
              </p>
            </div>
          </div>

          {/* Terms Page */}
          <div className={`proposal-page bg-white rounded-2xl shadow-lg overflow-hidden mb-6 ${currentPage !== 3 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12 min-h-[800px]">
              <PageHeader />

              <h2 className="text-lg font-bold text-gray-900 mb-4 italic">Additional Services:</h2>
              <p className="text-gray-700 mb-6">
                - When paid through a credit card, {proposal.ccFeePercent}% of the transaction value will be charged towards credit card fees.
              </p>

              <h2 className="text-lg font-bold text-gray-900 mb-4 italic">Terms:</h2>
              <div className="text-gray-700 text-sm space-y-2 mb-8 whitespace-pre-line">
                {terms.split('\n').filter(line => line.trim().startsWith('-')).map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>

              <p className="text-gray-700 italic mb-8">
                I look forward to hearing from you, and as always, please feel free to call with any questions or further clarification.
                {proposal.organization?.businessPhone && ` I can be contacted at ${proposal.organization.businessPhone}`}
              </p>

              <div className="mb-8">
                <p className="text-gray-600">Sincerely,</p>
                <p className="font-bold text-gray-900 mt-2">{proposal.companySignedByName || 'Aaron Meisner'}</p>
                <p className="text-gray-600">CEO {companyName}</p>
              </div>

              {/* Signature Section */}
              <div className="border-t pt-8 mt-8">
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <div className="border-b border-gray-400 pb-2 mb-2">
                      <span className="text-gray-600">X:</span>
                      {proposal.companySignature ? (
                        <img src={proposal.companySignature} alt="Company Signature" className="h-12 inline-block ml-2" />
                      ) : (
                        <span className="ml-2 italic text-lg" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                          {proposal.companySignedByName || 'Aaron Meisner'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{proposal.companySignedByName || 'Aaron Meisner'}</p>
                  </div>
                  <div>
                    <div className="border-b border-gray-400 pb-2 mb-2">
                      <span className="text-gray-600">X:</span>
                      {isSigned && proposal.signedAt && (
                        <span className="ml-2 text-gray-700">{formatDate(proposal.signedAt)}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Date:</p>
                  </div>
                  <div>
                    <div className="border-b border-gray-400 pb-2 mb-2">
                      <span className="text-gray-600">X:</span>
                      {isSigned && proposal.signedByName && (
                        <span className="ml-2 italic text-lg" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                          {proposal.signedByName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Mr. {proposal.clientName}</p>
                  </div>
                </div>
              </div>

              {/* Sign Button for unsigned proposals */}
              {canSign && !isSigned && (
                <div className="mt-8 text-center no-print">
                  <Button
                    onClick={() => setShowSignDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    size="lg"
                  >
                    <Pen className="w-5 h-5 mr-2" />
                    Sign & Accept Proposal
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Page Navigation Arrows */}
          <div className="flex items-center justify-center gap-4 no-print">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Previous
            </Button>
            <span className="text-gray-600">
              Page {currentPage + 1} of {pages.length}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
              disabled={currentPage === pages.length - 1}
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Sign Dialog */}
        {showSignDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Sign Proposal</h2>
                  <p className="text-sm text-gray-500">{proposal.proposalNumber}</p>
                </div>
                <button
                  onClick={() => setShowSignDialog(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                {/* Signature Type Toggle */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setSignatureType('drawn')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      signatureType === 'drawn'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Pen className="w-4 h-4" />
                    Draw Signature
                  </button>
                  <button
                    onClick={() => setSignatureType('typed')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      signatureType === 'typed'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    Type Name
                  </button>
                </div>

                {/* Signature Area */}
                {signatureType === 'drawn' ? (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Draw your signature below
                    </label>
                    <div className="border-2 border-gray-200 rounded-lg bg-white relative">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={150}
                        className="w-full touch-none cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      {!hasDrawn && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-gray-400 text-sm">Sign here</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={clearCanvas}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear signature
                    </button>
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type your full name
                    </label>
                    <Input
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Your full name"
                      className="text-center text-xl"
                      style={{ fontFamily: '"Brush Script MT", cursive, sans-serif', fontStyle: 'italic' }}
                    />
                    {typedName && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                        <span
                          className="text-2xl text-gray-900"
                          style={{ fontFamily: '"Brush Script MT", cursive, sans-serif', fontStyle: 'italic' }}
                        >
                          {typedName}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Signer Info */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Full Name
                    </label>
                    <Input
                      value={signedByName}
                      onChange={(e) => setSignedByName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Email
                    </label>
                    <Input
                      type="email"
                      value={signedByEmail}
                      onChange={(e) => setSignedByEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                {/* Agreement Text */}
                <p className="text-xs text-gray-500 mb-6">
                  By signing this proposal, I agree to the terms and conditions outlined above and authorize
                  the commencement of the described services. This electronic signature is legally binding.
                  {proposal.depositAmount && proposal.depositAmount > 0 && (
                    <span className="block mt-2 text-amber-600">
                      Note: A deposit invoice of {formatCurrency(proposal.depositAmount)} will be sent to you upon signing.
                    </span>
                  )}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowSignDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleSign}
                    disabled={signing}
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Sign & Accept
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
