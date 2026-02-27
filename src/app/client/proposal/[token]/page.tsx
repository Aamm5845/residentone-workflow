'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, FileText, CheckCircle, Clock, AlertCircle, X, Pen, Type, Download, ChevronLeft, ChevronRight, Printer } from 'lucide-react'
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
  signatureData: string | null
  signatureType: string | null
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

// Print & font styles
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Great+Vibes&display=swap');

  @font-face {
    font-family: 'Priestacy';
    src: url('/fonts/Priestacy.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

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
      min-height: auto;
      overflow: visible;
    }
    .proposal-page:last-child {
      page-break-after: avoid;
    }
    .scope-item { page-break-inside: avoid; }
    .signature-section { page-break-inside: avoid; }
    .payment-schedule { page-break-inside: avoid; }
    @page { size: letter; margin: 0.5in; }
  }
`

// Design tokens matching v2 PDF
const colors = {
  amber: '#E5A54B',
  amberLight: '#F5D89A',
  charcoal: '#1A1A2E',
  text: '#333333',
  textLight: '#666666',
  textMuted: '#999999',
  offWhite: '#FAFAF8',
  line: '#E8E4DE',
}

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
  const [showSignedView, setShowSignedView] = useState(false)

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    setHasDrawn(true)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = colors.charcoal
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

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
      ctx.fillStyle = colors.charcoal
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
        body: JSON.stringify({ signatureData, signatureType, signedByName, signedByEmail }),
      })
      if (response.ok) {
        setSignSuccess(true)
        setShowSignDialog(false)
        setShowSignedView(true)
        await loadProposal()
        setCurrentPage(3)
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

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.offWhite, fontFamily: 'Montserrat, sans-serif' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.amber }} />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.offWhite, fontFamily: 'Montserrat, sans-serif' }}>
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textMuted }} />
          <h1 className="text-xl font-semibold" style={{ color: colors.charcoal }}>Proposal Not Found</h1>
          <p className="mt-2" style={{ color: colors.textLight }}>{error || 'This proposal may have expired or been removed.'}</p>
        </div>
      </div>
    )
  }

  const companyName = proposal.organization?.businessName || proposal.organization?.name || 'Company'
  const isSigned = proposal.status === 'SIGNED'
  const isExpired = proposal.status === 'EXPIRED'
  const isDeclined = proposal.status === 'DECLINED'
  const canSign = !isSigned && !isExpired && !isDeclined

  // ─── "Thank you" page (revisit after signing) ───────────────────────────────

  if (isSigned && !showSignedView) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: colors.offWhite, fontFamily: 'Montserrat, sans-serif' }}>
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl shadow-lg p-10 text-center" style={{ borderTop: `3px solid ${colors.amber}` }}>
              {proposal.organization?.logoUrl && (
                <img src={proposal.organization.logoUrl} alt={companyName} className="h-14 mx-auto mb-6 object-contain" />
              )}
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#ecfdf5' }}>
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: colors.charcoal }}>
                {signSuccess ? 'Thank You!' : 'Proposal Signed'}
              </h1>
              <p className="mb-2" style={{ color: colors.textLight }}>
                {signSuccess
                  ? `Thank you for accepting our proposal for ${proposal.project.name}. We're excited to get started!`
                  : `This proposal was signed${proposal.signedByName ? ` by ${proposal.signedByName}` : ''}${proposal.signedAt ? ` on ${formatDate(proposal.signedAt)}` : ''}.`
                }
              </p>
              <p className="text-sm mb-6" style={{ color: colors.textMuted }}>
                {signSuccess
                  ? 'A copy of the signed proposal has been sent to your email. You will also receive a deposit invoice shortly.'
                  : 'A copy of the signed proposal has been sent to your email.'
                }
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/billing/proposals/${token}/pdf?v=2`, '_blank')}
                style={{ borderColor: colors.amber, color: colors.charcoal }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.line}` }}>
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {proposal.proposalNumber} &middot; {companyName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Proposal data ──────────────────────────────────────────────────────────

  const scopeItems = proposal.content?.scopeItems ||
    (proposal.content?.deliverables?.map(d => ({ title: d.title, description: d.description || '' })) || [])
  const projectOverview = proposal.content?.projectOverview || proposal.content?.scope || ''
  const terms = proposal.content?.terms || ''
  const paymentSchedule = proposal.paymentSchedule || []
  const coverLetter = proposal.coverLetter || ''

  const pages = [
    { id: 'cover', title: 'Cover' },
    { id: 'letter', title: 'Letter' },
    { id: 'scope', title: 'Scope' },
    { id: 'terms', title: 'Terms' },
  ]

  // ─── Shared components ──────────────────────────────────────────────────────

  const PageHeader = () => (
    <div className="flex items-center justify-between pb-3 mb-6" style={{ borderBottom: `1.5px solid ${colors.amber}` }}>
      <div>
        {proposal.organization?.logoUrl ? (
          <img src={proposal.organization.logoUrl} alt={companyName} className="h-10 max-w-[140px] object-contain" />
        ) : (
          <span className="text-base font-bold tracking-widest" style={{ color: colors.charcoal }}>{companyName.toUpperCase()}</span>
        )}
      </div>
      <div className="text-right leading-relaxed" style={{ fontSize: '0.7rem', fontWeight: 300, color: colors.textMuted }}>
        {proposal.organization?.businessPhone && <p>{proposal.organization.businessPhone}</p>}
        {proposal.organization?.businessEmail && <p>{proposal.organization.businessEmail}</p>}
        {proposal.organization?.businessAddress && <p>{proposal.organization.businessAddress}</p>}
        <p>
          {proposal.organization?.businessCity}
          {proposal.organization?.businessProvince && ` ${proposal.organization.businessProvince}`}
          {proposal.organization?.businessPostal && `, ${proposal.organization.businessPostal}`}
        </p>
      </div>
    </div>
  )

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="mb-4">
      <h2 className="text-sm font-bold tracking-wide uppercase mb-1" style={{ color: colors.charcoal, letterSpacing: '1px' }}>{title}</h2>
      <div style={{ width: 30, height: 2, backgroundColor: colors.amber }} />
    </div>
  )

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="min-h-screen py-8 px-4 print:bg-white print:py-0 print-container" style={{ backgroundColor: colors.offWhite, fontFamily: 'Montserrat, sans-serif' }}>
        <div className="max-w-4xl mx-auto">

          {/* ── Navigation Bar ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5 no-print">
            <div className="flex gap-1.5">
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  onClick={() => setCurrentPage(index)}
                  className="px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-colors"
                  style={{
                    backgroundColor: currentPage === index ? colors.amber : 'white',
                    color: currentPage === index ? 'white' : colors.textLight,
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  {page.title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/billing/proposals/${token}/pdf?v=2`, '_blank')}
                style={{ borderColor: colors.line, color: colors.charcoal, fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem' }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                style={{ borderColor: colors.line, color: colors.charcoal, fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem' }}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print
              </Button>
              {canSign && (
                <Button
                  onClick={() => setShowSignDialog(true)}
                  size="sm"
                  style={{ backgroundColor: colors.amber, color: 'white', fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem' }}
                >
                  <Pen className="w-3.5 h-3.5 mr-1.5" />
                  Sign Proposal
                </Button>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              COVER PAGE
          ════════════════════════════════════════════════════════════════ */}
          <div
            className={`proposal-page bg-white rounded-xl shadow-md overflow-hidden mb-6 relative ${currentPage !== 0 ? 'hidden print:block' : ''}`}
            style={{ minHeight: 800 }}
          >
            {/* Top amber bar */}
            <div className="absolute top-0 left-0 right-0" style={{ height: 3, backgroundColor: colors.amber }} />
            {/* Bottom amber bar */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, backgroundColor: colors.amber }} />

            <div className="flex flex-col items-center justify-center text-center h-full" style={{ minHeight: 800, padding: '80px 56px' }}>
              {/* Logo */}
              {proposal.organization?.logoUrl ? (
                <img src={proposal.organization.logoUrl} alt={companyName} className="h-20 max-w-[220px] object-contain mb-4" />
              ) : (
                <div className="mb-4">
                  <span className="text-3xl font-bold tracking-widest" style={{ color: colors.charcoal }}>{companyName.toUpperCase()}</span>
                </div>
              )}

              {/* PROPOSAL title */}
              <h1 className="font-bold tracking-widest mb-6" style={{ fontSize: '3rem', color: colors.charcoal, letterSpacing: '6px' }}>
                PROPOSAL
              </h1>

              {/* Amber divider */}
              <div className="mb-7" style={{ width: 80, height: 2, backgroundColor: colors.amber }} />

              {/* Meta */}
              <p className="mb-1" style={{ fontSize: '0.85rem', fontWeight: 400, color: colors.textLight }}>{proposal.proposalNumber}</p>
              <p className="mb-12" style={{ fontSize: '0.85rem', fontWeight: 300, color: colors.textMuted }}>{formatDate(proposal.signedAt || proposal.companySignedAt || new Date().toISOString())}</p>

              {/* Prepared for */}
              <p className="mb-2 tracking-widest" style={{ fontSize: '0.65rem', fontWeight: 300, color: colors.textMuted, letterSpacing: '4px' }}>PREPARED FOR</p>
              <p className="text-xl font-semibold mb-2" style={{ color: colors.charcoal }}>{proposal.clientName}</p>
              <p style={{ fontSize: '0.8rem', fontWeight: 300, color: colors.textLight }}>
                {proposal.projectAddress || proposal.clientAddress || ''}
              </p>

              {/* Status badge */}
              <div className="mt-12">
                {isSigned ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                    <CheckCircle className="w-4 h-4" />
                    SIGNED on {formatDate(proposal.signedAt)}
                  </div>
                ) : isExpired ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                    <AlertCircle className="w-4 h-4" />
                    EXPIRED
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                    <Clock className="w-3.5 h-3.5" />
                    Valid until {formatDate(proposal.validUntil)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              LETTER PAGE
          ════════════════════════════════════════════════════════════════ */}
          <div className={`proposal-page bg-white rounded-xl shadow-md overflow-hidden mb-6 ${currentPage !== 1 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12" style={{ minHeight: 800 }}>
              <PageHeader />

              {/* Date */}
              <p className="text-right mb-6" style={{ fontSize: '0.8rem', fontWeight: 300, color: colors.textMuted }}>
                {formatDate(proposal.companySignedAt || new Date().toISOString())}
              </p>

              {/* Client */}
              <h3 className="text-lg font-semibold mb-1" style={{ color: colors.charcoal }}>{proposal.clientName}</h3>
              <p className="mb-8" style={{ fontSize: '0.85rem', fontWeight: 300, color: colors.textLight, lineHeight: 1.4 }}>
                {proposal.projectAddress || proposal.clientAddress}
              </p>

              {/* Cover letter paragraphs */}
              <div className="mb-12">
                {coverLetter.split('\n').map((paragraph, index) => (
                  paragraph.trim() && (
                    <p key={index} className="mb-5" style={{ fontSize: '0.85rem', fontWeight: 400, color: colors.text, lineHeight: 1.7 }}>
                      {paragraph}
                    </p>
                  )
                ))}
              </div>

              {/* Warm regards / signature */}
              <div className="mt-auto">
                <p className="italic mb-4" style={{ fontSize: '0.85rem', fontWeight: 300, color: colors.textLight, fontFamily: 'Montserrat, sans-serif' }}>
                  Warm regards,
                </p>
                {proposal.companySignature ? (
                  <img src={proposal.companySignature} alt="Signature" className="h-14 mb-3 object-contain" />
                ) : (
                  <p className="mb-3" style={{ fontSize: '1.6rem', fontFamily: 'Priestacy, "Brush Script MT", cursive', color: colors.charcoal }}>
                    {proposal.companySignedByName || 'Aaron Meisner'}
                  </p>
                )}
                <p className="font-semibold" style={{ fontSize: '0.85rem', color: colors.charcoal }}>{proposal.companySignedByName || 'Aaron Meisner'}</p>
                <p style={{ fontSize: '0.8rem', fontWeight: 300, color: colors.textLight }}>CEO {companyName}</p>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SCOPE PAGE
          ════════════════════════════════════════════════════════════════ */}
          <div className={`proposal-page scope-page bg-white rounded-xl shadow-md mb-6 ${currentPage !== 2 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12">
              <PageHeader />

              {/* Project Overview */}
              <SectionHeading title="Project Overview" />
              <p className="mb-8" style={{ fontSize: '0.85rem', fontWeight: 400, color: colors.text, lineHeight: 1.7 }}>
                {projectOverview}
              </p>

              {/* Scope of Work */}
              <SectionHeading title="Scope of Work" />
              <div className="mb-8 space-y-5">
                {scopeItems.map((item, index) => (
                  <div key={index} className="scope-item">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-bold" style={{ fontSize: '0.85rem', color: colors.amber }}>{index + 1}.</span>
                      <span className="font-semibold" style={{ fontSize: '0.85rem', color: colors.charcoal }}>{item.title}</span>
                    </div>
                    {item.description && (
                      <p className="ml-5" style={{ fontSize: '0.8rem', fontWeight: 400, color: colors.text, lineHeight: 1.6 }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Billing Details / Payment Schedule */}
              <SectionHeading title={proposal.billingType === 'HOURLY' ? 'Billing Details' : 'Payment Schedule'} />
              <div className="payment-schedule">
                {proposal.billingType === 'HOURLY' ? (
                  <>
                    {/* Hourly rate row */}
                    <div className="flex justify-between items-center py-3 px-3 mb-2" style={{ backgroundColor: colors.offWhite, borderBottom: `2px solid ${colors.amber}` }}>
                      <span className="font-semibold" style={{ fontSize: '0.85rem', color: colors.charcoal }}>Hourly Rate</span>
                      <span className="font-bold text-lg" style={{ color: colors.amber }}>{formatCurrency(proposal.hourlyRate || 0)}/hr</span>
                    </div>
                    {proposal.depositAmount && proposal.depositAmount > 0 && (
                      <div className="flex justify-between items-center py-2 px-1" style={{ borderBottom: `1px dotted ${colors.line}` }}>
                        <span style={{ fontSize: '0.85rem', color: colors.text }}>Retainer (on signing)</span>
                        <span style={{ fontSize: '0.85rem', color: colors.text }}>{formatCurrency(proposal.depositAmount)}</span>
                      </div>
                    )}
                    <p className="mt-3" style={{ fontSize: '0.75rem', fontWeight: 300, color: colors.textMuted, lineHeight: 1.5 }}>
                      Work will be billed based on actual hours worked. Retainer will be applied to future invoices.
                    </p>
                  </>
                ) : (
                  <>
                    {/* Total row */}
                    <div className="flex justify-between items-center py-3 px-3 mb-2" style={{ backgroundColor: colors.offWhite, borderBottom: `2px solid ${colors.amber}` }}>
                      <span className="font-semibold" style={{ fontSize: '0.85rem', color: colors.charcoal }}>Total Project Fee</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-lg" style={{ color: colors.amber }}>{formatCurrency(proposal.subtotal)}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 300, color: colors.textMuted }}>+ tax</span>
                      </div>
                    </div>
                    {paymentSchedule.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 px-1" style={{ borderBottom: `1px dotted ${colors.line}` }}>
                        <span style={{ fontSize: '0.85rem', color: colors.text }}>{item.title}</span>
                        <span style={{ fontSize: '0.85rem', color: colors.text }}>{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              TERMS PAGE
          ════════════════════════════════════════════════════════════════ */}
          <div className={`proposal-page terms-page bg-white rounded-xl shadow-md mb-6 ${currentPage !== 3 ? 'hidden print:block' : ''}`}>
            <div className="p-8 sm:p-12">
              <PageHeader />

              {/* Additional Services */}
              <SectionHeading title="Additional Services" />
              <div className="flex items-start gap-2 mb-6">
                <div className="mt-1.5 flex-shrink-0" style={{ width: 5, height: 5, backgroundColor: colors.amber, borderRadius: 1 }} />
                <p style={{ fontSize: '0.8rem', color: colors.text, lineHeight: 1.5 }}>
                  When paid through a credit card, {proposal.ccFeePercent}% of the transaction value will be charged towards credit card fees.
                </p>
              </div>

              {/* Terms */}
              <SectionHeading title="Terms & Conditions" />
              <div className="space-y-2 mb-6">
                {terms.split('\n').filter((line: string) => line.trim().startsWith('-')).map((line: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="mt-1.5 flex-shrink-0" style={{ width: 5, height: 5, backgroundColor: colors.amber, borderRadius: 1 }} />
                    <p style={{ fontSize: '0.8rem', color: colors.text, lineHeight: 1.5 }}>
                      {line.replace(/^-\s*/, '').trim()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Closing italic text */}
              <p className="italic mb-4" style={{ fontSize: '0.8rem', fontWeight: 300, color: colors.textLight, lineHeight: 1.5 }}>
                I look forward to hearing from you, and as always, please feel free to call with any questions or further clarification.
                {proposal.organization?.businessPhone && ` I can be contacted at ${proposal.organization.businessPhone}.`}
              </p>

              {/* Sincerely */}
              <div className="mb-4">
                <p style={{ fontSize: '0.8rem', fontWeight: 300, color: colors.textLight }}>Sincerely,</p>
                <p className="font-semibold" style={{ fontSize: '0.85rem', color: colors.charcoal }}>{proposal.companySignedByName || 'Aaron Meisner'}</p>
                <p style={{ fontSize: '0.75rem', fontWeight: 300, color: colors.textLight }}>CEO {companyName}</p>
              </div>

              {/* ── Signature Section ─────────────────────────────────────── */}
              <div className="signature-section pt-4 mt-4" style={{ borderTop: `1px solid ${colors.line}` }}>
                <div className="grid grid-cols-3 gap-6">
                  {/* Company */}
                  <div>
                    <div className="h-10 flex items-end">
                      {proposal.companySignature ? (
                        <img src={proposal.companySignature} alt="Company Signature" className="h-8 object-contain" />
                      ) : (
                        <span className="text-xl" style={{ fontFamily: 'Priestacy, "Brush Script MT", cursive', color: colors.charcoal }}>
                          {proposal.companySignedByName || 'Aaron Meisner'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 mb-1" style={{ borderBottom: `1px solid ${colors.charcoal}` }} />
                    <p style={{ fontSize: '0.65rem', fontWeight: 300, color: colors.textMuted }}>{proposal.companySignedByName || 'Aaron Meisner'}</p>
                  </div>

                  {/* Client */}
                  <div>
                    <div className="h-10 flex items-end">
                      {isSigned && proposal.signatureData && proposal.signatureType === 'drawn' ? (
                        <img src={proposal.signatureData} alt="Client Signature" className="h-8 object-contain" />
                      ) : isSigned && proposal.signedByName ? (
                        <span className="text-lg" style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive', color: colors.charcoal }}>
                          {proposal.signedByName}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 mb-1" style={{ borderBottom: `1px solid ${colors.charcoal}` }} />
                    <p style={{ fontSize: '0.65rem', fontWeight: 300, color: colors.textMuted }}>
                      {isSigned && proposal.signedByName ? proposal.signedByName : proposal.clientName}
                    </p>
                  </div>

                  {/* Date */}
                  <div>
                    <div className="h-10 flex items-end">
                      {isSigned && proposal.signedAt && (
                        <span style={{ fontSize: '0.75rem', color: colors.charcoal }}>{formatDate(proposal.signedAt)}</span>
                      )}
                    </div>
                    <div className="mt-1 mb-1" style={{ borderBottom: `1px solid ${colors.charcoal}` }} />
                    <p style={{ fontSize: '0.65rem', fontWeight: 300, color: colors.textMuted }}>Date</p>
                  </div>
                </div>
              </div>

              {/* Sign button */}
              {canSign && !isSigned && (
                <div className="mt-8 text-center no-print">
                  <Button
                    onClick={() => setShowSignDialog(true)}
                    size="lg"
                    style={{ backgroundColor: colors.amber, color: 'white', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    <Pen className="w-5 h-5 mr-2" />
                    Sign & Accept Proposal
                  </Button>
                </div>
              )}

              {/* Done button after signing */}
              {isSigned && showSignedView && (
                <div className="mt-8 text-center no-print">
                  <p className="font-medium mb-4" style={{ color: '#059669' }}>
                    <CheckCircle className="w-5 h-5 inline-block mr-2 -mt-0.5" />
                    Proposal signed successfully
                  </p>
                  <Button
                    onClick={() => setShowSignedView(false)}
                    size="lg"
                    style={{ backgroundColor: colors.amber, color: 'white', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── Page Navigation Arrows ─────────────────────────────────── */}
          <div className="flex items-center justify-center gap-4 no-print">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{ borderColor: colors.line, color: colors.charcoal, fontFamily: 'Montserrat, sans-serif', fontSize: '0.8rem' }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
              Page {currentPage + 1} of {pages.length}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
              disabled={currentPage === pages.length - 1}
              style={{ borderColor: colors.line, color: colors.charcoal, fontFamily: 'Montserrat, sans-serif', fontSize: '0.8rem' }}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center mt-4 no-print" style={{ borderTop: `0.5px solid ${colors.line}`, paddingTop: 8 }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 300, color: colors.textMuted }}>{companyName} &middot; {proposal.proposalNumber}</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SIGN DIALOG
        ══════════════════════════════════════════════════════════════ */}
        {showSignDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.line}` }}>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: colors.charcoal }}>Sign Proposal</h2>
                  <p className="text-sm" style={{ color: colors.textMuted }}>{proposal.proposalNumber}</p>
                </div>
                <button onClick={() => setShowSignDialog(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" style={{ color: colors.textMuted }} />
                </button>
              </div>

              <div className="p-6">
                {/* Signature Type Toggle */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setSignatureType('drawn')}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors"
                    style={{
                      borderColor: signatureType === 'drawn' ? colors.amber : colors.line,
                      backgroundColor: signatureType === 'drawn' ? '#FEF9F0' : 'white',
                      color: signatureType === 'drawn' ? colors.amber : colors.textLight,
                    }}
                  >
                    <Pen className="w-4 h-4" />
                    Draw Signature
                  </button>
                  <button
                    onClick={() => setSignatureType('typed')}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors"
                    style={{
                      borderColor: signatureType === 'typed' ? colors.amber : colors.line,
                      backgroundColor: signatureType === 'typed' ? '#FEF9F0' : 'white',
                      color: signatureType === 'typed' ? colors.amber : colors.textLight,
                    }}
                  >
                    <Type className="w-4 h-4" />
                    Type Name
                  </button>
                </div>

                {/* Signature Area */}
                {signatureType === 'drawn' ? (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                      Draw your signature below
                    </label>
                    <div className="rounded-lg bg-white relative" style={{ border: `2px solid ${colors.line}` }}>
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
                          <span style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Sign here</span>
                        </div>
                      )}
                    </div>
                    <button onClick={clearCanvas} className="mt-2 text-sm hover:underline" style={{ color: colors.textMuted }}>
                      Clear signature
                    </button>
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                      Type your full name
                    </label>
                    <Input
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Your full name"
                      className="text-center text-xl"
                      style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive' }}
                    />
                    {typedName && (
                      <div className="mt-4 p-4 rounded-lg text-center" style={{ backgroundColor: colors.offWhite }}>
                        <span className="text-2xl" style={{ fontFamily: '"Great Vibes", "Brush Script MT", cursive', color: colors.charcoal }}>
                          {typedName}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Signer Info */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Your Full Name</label>
                    <Input value={signedByName} onChange={(e) => setSignedByName(e.target.value)} placeholder="John Smith" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>Your Email</label>
                    <Input type="email" value={signedByEmail} onChange={(e) => setSignedByEmail(e.target.value)} placeholder="john@example.com" />
                  </div>
                </div>

                {/* Agreement Text */}
                <p className="text-xs mb-6" style={{ color: colors.textMuted }}>
                  By signing this proposal, I agree to the terms and conditions outlined above and authorize
                  the commencement of the described services. This electronic signature is legally binding.
                  {proposal.depositAmount && proposal.depositAmount > 0 && (
                    <span className="block mt-2" style={{ color: colors.amber }}>
                      Note: A deposit invoice of {formatCurrency(proposal.depositAmount)} will be sent to you upon signing.
                    </span>
                  )}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowSignDialog(false)} style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSign}
                    disabled={signing}
                    style={{ backgroundColor: colors.amber, color: 'white', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {signing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" />Sign & Accept</>
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
