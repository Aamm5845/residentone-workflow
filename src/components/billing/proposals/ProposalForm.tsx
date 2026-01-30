'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Save, Send, Sparkles, Loader2, Plus, Trash2, Calculator, FileText, GripVertical, Wand2, CheckCircle, DollarSign, Layers, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
}

interface PaymentScheduleItem {
  title: string
  amount: number
  percent: number | null
  dueOn: 'signing' | 'milestone' | 'completion' | 'custom'
  description?: string
}

interface ScopeItem {
  title: string
  description: string
}

interface ProposalFormProps {
  projectId: string
  projectName: string
  projectType: string
  projectAddress?: string
  client: Client
  defaultGstRate?: number
  defaultQstRate?: number
  showAIGenerator?: boolean
  companySignature?: string
  ceoName?: string
  existingProposal?: {
    id: string
    title: string
    billingType: 'FIXED' | 'HOURLY' | 'HYBRID'
    content: any
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
    gstRate: number | null
    qstRate: number | null
    ccFeePercent: number | null
    totalAmount: number
    validUntil: string | null
    validDays: number | null
    notes: string | null
  }
}

const DEFAULT_TERMS = `- We own our designs and drawings. Upon payment in full, these things become wholly owned by you, the client. Spec book and finalities will not be released until full payment has been received.
- Meisner Interiors may use images in our company portfolio and on our website, but your address and/or name will never appear on any marketing media without your written consent.
- If the project should be suspended or abandoned, payment is required in proportion to the completed project design.
- In case of an extended period of time of inactivity (2 months), the project will be considered complete, and thus final payment will be due.
- Meisner Interiors is NOT responsible for any legal issues that may arise before or during construction, or after or for any violations.
- Meisner Interiors is not responsible for any issues or damages that may arise before or during construction or after.
- Meisner Interiors is not responsible for any issues or damages, or the quality of any of the purchases for this project.
- The renderings are intended to help visualize design concepts only; they do not replicate design precisely. Please follow the detailed specifications for precise details.
- Proposal is valid for 30 days.`

const DEFAULT_COVER_LETTER = `Thank you for considering Meisner Interiors for your project.

Attached is the proposal outlining the scope of work, the services our team will provide, and the payment structure. Our goal is to make the entire process — from design to construction — as organized and seamless as possible. We work closely with clients, contractors, and consultants to ensure that every phase is coordinated and that the project moves forward smoothly.

Your vision guides the direction of our work. Our role is to translate your goals into a thoughtful, functional, and beautifully executed design. We aim to simplify decisions, provide clarity throughout the process, and support you from initial planning through completion.

Once the agreement is approved, our team is ready to begin. I will reach out in the coming days to review the proposal together and answer any questions you may have.

Thank you again for choosing Meisner Interiors. We look forward to partnering with you and bringing your vision to life with care and attention to detail.`

// Common scope phases for interior design
const COMMON_PHASES = [
  { title: 'Design Development', description: 'Development of the complete interior design including establishing the overall design concept, materials, finishes, and detailing. High-quality 3D renderings will be created to clearly communicate the final design intent. Design revisions are included as needed to finalize the approved direction.' },
  { title: '3D Renderings', description: 'Creation of photorealistic 3D visualizations to help communicate the design intent. Multiple views and angles will be provided for key spaces.' },
  { title: 'Engineering & Consultant Coordination', description: 'Coordination with mechanical, plumbing, and other required engineers to ensure all systems integrate seamlessly with the design. This phase includes collaboration, reviews, and design adjustments as necessary to align with technical and functional requirements.' },
  { title: 'Product & Material Selection', description: 'Selection and specification of all fixtures, finishes, and materials required for the project. This includes product recommendations, sourcing guidance, and ensuring all selections align with the approved design and overall budget.' },
  { title: 'Construction Documents', description: 'Preparation of detailed construction drawings and specifications for contractor bidding and construction.' },
  { title: 'Construction Administration', description: 'Site visits and oversight during construction to ensure the design is being implemented correctly.' },
]

type Step = 'describe' | 'features' | 'exclusions' | 'phases' | 'payment' | 'review'

export default function ProposalForm({
  projectId,
  projectName,
  projectType,
  projectAddress: defaultProjectAddress,
  client,
  defaultGstRate = 5,
  defaultQstRate = 9.975,
  showAIGenerator = false,
  companySignature,
  ceoName = 'Aaron Meisner',
  existingProposal,
}: ProposalFormProps) {
  const router = useRouter()
  const isEditing = !!existingProposal

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(isEditing ? 'review' : 'describe')

  // AI Description state (Steps 1-3)
  const [designDescription, setDesignDescription] = useState('')
  const [whatToInclude, setWhatToInclude] = useState('')
  const [whatNotToInclude, setWhatNotToInclude] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)

  // Form state
  const [title, setTitle] = useState(existingProposal?.title || `${projectName} - Interior Design Services`)
  const [billingType, setBillingType] = useState<'FIXED' | 'HOURLY' | 'HYBRID'>(
    existingProposal?.billingType || 'HYBRID'
  )
  const [clientName, setClientName] = useState(existingProposal?.clientName || client.name)
  const [clientEmail, setClientEmail] = useState(existingProposal?.clientEmail || client.email)
  const [clientPhone, setClientPhone] = useState(existingProposal?.clientPhone || client.phone || '')
  const [clientAddress, setClientAddress] = useState(existingProposal?.clientAddress || '')
  const [projectAddress, setProjectAddress] = useState(
    existingProposal?.projectAddress || defaultProjectAddress || ''
  )

  // Cover letter
  const [coverLetter, setCoverLetter] = useState(existingProposal?.coverLetter || DEFAULT_COVER_LETTER)

  // Scope of Work
  const [projectOverview, setProjectOverview] = useState(existingProposal?.content?.projectOverview || '')
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>(
    existingProposal?.content?.scopeItems || []
  )

  // Payment Schedule (for FIXED and HYBRID)
  const [totalBudget, setTotalBudget] = useState(existingProposal?.subtotal || 0)
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>(
    existingProposal?.paymentSchedule || []
  )

  // Hourly rate (for HOURLY and HYBRID)
  const [hourlyRate, setHourlyRate] = useState(existingProposal?.hourlyRate || 200)

  // Terms
  const [terms, setTerms] = useState(existingProposal?.content?.terms || DEFAULT_TERMS)
  const [notes, setNotes] = useState(existingProposal?.notes || '')

  // Pricing
  const [gstRate, setGstRate] = useState(existingProposal?.gstRate || defaultGstRate)
  const [qstRate, setQstRate] = useState(existingProposal?.qstRate || defaultQstRate)
  const [ccFeePercent, setCcFeePercent] = useState(existingProposal?.ccFeePercent || 3.5)

  // Dates
  const [validDays, setValidDays] = useState(existingProposal?.validDays || 30)
  const [validUntil, setValidUntil] = useState(
    existingProposal?.validUntil
      ? new Date(existingProposal.validUntil).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Calculate totals
  const subtotal = totalBudget
  const taxableAmount = subtotal
  const gstAmount = taxableAmount * (gstRate / 100)
  const qstAmount = taxableAmount * (qstRate / 100)
  const totalAmount = taxableAmount + gstAmount + qstAmount

  // Get deposit amount from payment schedule
  const depositItem = paymentSchedule.find(p => p.dueOn === 'signing')
  const depositAmount = depositItem?.amount || 0

  // Payment schedule total
  const scheduleTotal = paymentSchedule.reduce((sum, item) => sum + item.amount, 0)
  const scheduleBalanced = billingType === 'HOURLY' || Math.abs(scheduleTotal - totalBudget) < 0.01

  // Update valid until when valid days changes
  useEffect(() => {
    const date = new Date()
    date.setDate(date.getDate() + validDays)
    setValidUntil(date.toISOString().split('T')[0])
  }, [validDays])

  // Scope item management
  const addScopeItem = (phase?: typeof COMMON_PHASES[0]) => {
    if (phase) {
      setScopeItems([...scopeItems, { title: phase.title, description: phase.description }])
    } else {
      setScopeItems([...scopeItems, { title: '', description: '' }])
    }
  }

  const updateScopeItem = (index: number, field: 'title' | 'description', value: string) => {
    const newItems = [...scopeItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setScopeItems(newItems)
  }

  const removeScopeItem = (index: number) => {
    setScopeItems(scopeItems.filter((_, i) => i !== index))
  }

  // Payment schedule management
  const addPaymentItem = (preset?: { title: string; dueOn: 'signing' | 'milestone' | 'completion' }) => {
    if (preset) {
      setPaymentSchedule([
        ...paymentSchedule,
        { title: preset.title, amount: 0, percent: null, dueOn: preset.dueOn }
      ])
    } else {
      setPaymentSchedule([
        ...paymentSchedule,
        { title: '', amount: 0, percent: null, dueOn: 'milestone' }
      ])
    }
  }

  const updatePaymentItem = (index: number, field: keyof PaymentScheduleItem, value: any) => {
    const newSchedule = [...paymentSchedule]
    newSchedule[index] = { ...newSchedule[index], [field]: value }
    setPaymentSchedule(newSchedule)
  }

  const removePaymentItem = (index: number) => {
    setPaymentSchedule(paymentSchedule.filter((_, i) => i !== index))
  }

  // Auto-calculate payment amounts from percentages
  const updatePaymentPercent = (index: number, percent: number) => {
    const newSchedule = [...paymentSchedule]
    newSchedule[index] = {
      ...newSchedule[index],
      percent,
      amount: Math.round(totalBudget * (percent / 100))
    }
    setPaymentSchedule(newSchedule)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // AI Generation with Claude
  const handleGenerateWithAI = async () => {
    if (!designDescription.trim()) {
      alert('Please describe what you will be designing')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/billing/proposals/generate-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectType,
          clientName: client.name,
          designDescription,
          whatToInclude,
          whatNotToInclude,
          billingType,
          suggestedBudget: totalBudget > 0 ? totalBudget : undefined,
          hourlyRate: billingType !== 'FIXED' ? hourlyRate : undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Populate form with AI-generated content
        if (data.projectOverview) setProjectOverview(data.projectOverview)
        if (data.scopeItems && data.scopeItems.length > 0) setScopeItems(data.scopeItems)
        if (data.coverLetter) setCoverLetter(data.coverLetter)
        if (data.paymentSchedule && data.paymentSchedule.length > 0) {
          setPaymentSchedule(data.paymentSchedule)
          const total = data.paymentSchedule.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
          if (total > 0) setTotalBudget(total)
        }
        if (data.suggestedBudget) setTotalBudget(data.suggestedBudget)
        if (data.hourlyRate) setHourlyRate(data.hourlyRate)

        setAiGenerated(true)
        // Stay on current step - user reviews the AI-generated content
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate content')
      }
    } catch (err) {
      console.error('Error generating AI content:', err)
      alert('Failed to generate content. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Save proposal
  const handleSave = async (andSend = false) => {
    if (!title || !clientName || !clientEmail) {
      alert('Please fill in the required fields')
      return
    }

    if (billingType !== 'HOURLY' && totalBudget <= 0) {
      alert('Please enter a total budget amount')
      return
    }

    if (andSend) {
      setSending(true)
    } else {
      setSaving(true)
    }

    try {
      const proposalData = {
        projectId,
        title,
        billingType,
        content: {
          projectOverview,
          scopeItems: scopeItems.filter(s => s.title),
          terms,
          designDescription,
        },
        coverLetter,
        paymentSchedule: billingType !== 'HOURLY' ? paymentSchedule.filter(p => p.title) : [],
        clientName,
        clientEmail,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        projectAddress: projectAddress || null,
        subtotal: billingType === 'HOURLY' ? 0 : totalBudget,
        depositAmount: billingType !== 'HOURLY' ? depositAmount : null,
        depositPercent: billingType !== 'HOURLY' && depositAmount > 0 && totalBudget > 0
          ? (depositAmount / totalBudget) * 100
          : null,
        hourlyRate: billingType !== 'FIXED' ? hourlyRate : null,
        discountPercent: null,
        gstRate,
        qstRate,
        ccFeePercent,
        totalAmount: billingType === 'HOURLY' ? 0 : totalAmount,
        validUntil,
        validDays,
        notes: notes || null,
      }

      let proposalId = existingProposal?.id

      if (isEditing) {
        const response = await fetch(`/api/billing/proposals/${existingProposal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update proposal')
        }
      } else {
        const response = await fetch('/api/billing/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create proposal')
        }

        const newProposal = await response.json()
        proposalId = newProposal.id
      }

      // Send if requested
      if (andSend && proposalId) {
        const sendResponse = await fetch(`/api/billing/proposals/${proposalId}/send`, {
          method: 'POST',
        })

        if (!sendResponse.ok) {
          const error = await sendResponse.json()
          throw new Error(error.error || 'Failed to send proposal')
        }
      }

      router.push(`/projects/${projectId}/billing`)
      router.refresh()
    } catch (err: any) {
      console.error('Error saving proposal:', err)
      alert(err.message || 'Failed to save proposal')
    } finally {
      setSaving(false)
      setSending(false)
    }
  }

  // Check if phase already added
  const isPhaseAdded = (phaseTitle: string) => {
    return scopeItems.some(item => item.title === phaseTitle)
  }

  // Step 1: What are you designing?
  const renderDescribeStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">What are you designing?</h2>
            <p className="text-gray-500">Describe the project and AI will help generate the proposal</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Billing Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How will you charge?
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setBillingType('FIXED')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  billingType === 'FIXED'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">Fixed Price</div>
                <div className="text-sm text-gray-500">Set total with milestones</div>
              </button>
              <button
                type="button"
                onClick={() => setBillingType('HOURLY')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  billingType === 'HOURLY'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">Hourly</div>
                <div className="text-sm text-gray-500">Bill by hours worked</div>
              </button>
              <button
                type="button"
                onClick={() => setBillingType('HYBRID')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  billingType === 'HYBRID'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">Hybrid</div>
                <div className="text-sm text-gray-500">Fixed + hourly extras</div>
              </button>
            </div>
          </div>

          {/* Design Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe what you will be designing *
            </label>
            <textarea
              value={designDescription}
              onChange={(e) => setDesignDescription(e.target.value)}
              placeholder="e.g., Complete interior design for a mikvah including the main ritual bath area, preparation rooms, waiting area, and reception..."
              className="w-full h-32 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Quick Budget Input for Fixed/Hybrid */}
          {billingType !== 'HOURLY' && (
            <div className="bg-gray-50 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total budget (leave blank to let AI suggest)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <Input
                  type="number"
                  value={totalBudget || ''}
                  onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                  placeholder="20000"
                  className="w-40"
                />
              </div>
            </div>
          )}

          {/* Hourly Rate for Hourly/Hybrid */}
          {billingType !== 'FIXED' && (
            <div className="bg-gray-50 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hourly rate
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <span className="text-gray-500">/ hour</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('phases')}
          >
            Skip AI, fill manually
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={() => setCurrentStep('features')}
            disabled={!designDescription.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Next: What's Included
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 2: What features are included?
  const renderFeaturesStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">What's included in this project?</h2>
            <p className="text-gray-500">Tell us about special features or services</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Add Chips */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Quick add common features:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Working with architect',
                'Contractor coordination',
                '3D renderings',
                'Site visits',
                'Furniture procurement',
                'Custom millwork design',
                'Lighting design',
                'Material selections',
                'Project management',
              ].map((feature) => (
                <button
                  key={feature}
                  type="button"
                  onClick={() => {
                    const current = whatToInclude.trim()
                    if (!current.toLowerCase().includes(feature.toLowerCase())) {
                      setWhatToInclude(current ? `${current}\n• ${feature}` : `• ${feature}`)
                    }
                  }}
                  className="px-3 py-1.5 rounded-full text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                >
                  + {feature}
                </button>
              ))}
            </div>
          </div>

          {/* Features Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Features & services included
            </label>
            <textarea
              value={whatToInclude}
              onChange={(e) => setWhatToInclude(e.target.value)}
              placeholder="• Working with the architect on design coordination&#10;• Multiple design presentations&#10;• Unlimited revisions during design phase&#10;• Site visits during construction"
              className="w-full h-40 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => setCurrentStep('describe')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('exclusions')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Next: What's NOT Included
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 3: What's NOT included?
  const renderExclusionsStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">What's NOT included?</h2>
            <p className="text-gray-500">Be clear about exclusions to avoid misunderstandings</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Add Chips */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Common exclusions:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Construction work',
                'Permit applications',
                'Structural engineering',
                'MEP engineering',
                'Product purchasing',
                'Installation',
                'Moving services',
                'Storage',
                'Window treatments installation',
              ].map((exclusion) => (
                <button
                  key={exclusion}
                  type="button"
                  onClick={() => {
                    const current = whatNotToInclude.trim()
                    if (!current.toLowerCase().includes(exclusion.toLowerCase())) {
                      setWhatNotToInclude(current ? `${current}\n• ${exclusion}` : `• ${exclusion}`)
                    }
                  }}
                  className="px-3 py-1.5 rounded-full text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                >
                  + {exclusion}
                </button>
              ))}
            </div>
          </div>

          {/* Exclusions Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What's excluded from this proposal
            </label>
            <textarea
              value={whatNotToInclude}
              onChange={(e) => setWhatNotToInclude(e.target.value)}
              placeholder="• Construction and renovation work&#10;• Permit applications and approvals&#10;• Product purchasing and delivery&#10;• Installation services"
              className="w-full h-40 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => setCurrentStep('features')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('phases')}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Next: Add Phases
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 2: What phases are included?
  const renderPhasesStep = () => (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">What phases are included?</h2>
            <p className="text-gray-500">Select or add the work phases for this project</p>
          </div>
        </div>

        {/* AI Generated Badge */}
        {aiGenerated && scopeItems.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-6 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-700">AI generated - review and edit as needed</span>
          </div>
        )}

        {/* Quick Add Common Phases */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Quick add common phases:</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_PHASES.map((phase) => (
              <button
                key={phase.title}
                onClick={() => !isPhaseAdded(phase.title) && addScopeItem(phase)}
                disabled={isPhaseAdded(phase.title)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  isPhaseAdded(phase.title)
                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {isPhaseAdded(phase.title) && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {phase.title}
              </button>
            ))}
          </div>
        </div>

        {/* Current Phases */}
        <div className="space-y-4">
          {scopeItems.map((item, index) => (
            <div key={index} className="border rounded-xl p-4 bg-gray-50">
              <div className="flex items-start gap-3">
                <span className="font-bold text-emerald-600 text-lg mt-1">{index + 1}.</span>
                <div className="flex-1 space-y-3">
                  <Input
                    value={item.title}
                    onChange={(e) => updateScopeItem(index, 'title', e.target.value)}
                    placeholder="Phase name (e.g., Design Development)"
                    className="font-semibold text-lg"
                  />
                  <textarea
                    value={item.description}
                    onChange={(e) => updateScopeItem(index, 'description', e.target.value)}
                    placeholder="Describe what's included in this phase..."
                    className="w-full h-24 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScopeItem(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {scopeItems.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed rounded-xl text-gray-500">
              No phases added yet. Click a quick-add button above or add a custom phase.
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => addScopeItem()}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Phase
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => setCurrentStep('exclusions')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('payment')}
            disabled={scopeItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Next: Payment Schedule
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 4: Payment Schedule
  const renderPaymentStep = () => (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment Schedule</h2>
            <p className="text-gray-500">
              {billingType === 'HOURLY'
                ? 'Set your hourly rate for this project'
                : 'Define how and when payments will be collected'
              }
            </p>
          </div>
        </div>

        {billingType === 'HOURLY' ? (
          /* Hourly Only */
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Hourly Rate</label>
              <div className="flex items-center gap-3">
                <span className="text-2xl text-gray-500">$</span>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  className="w-32 text-2xl font-bold"
                  min="0"
                />
                <span className="text-xl text-gray-500">/ hour</span>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                Hours will be tracked and billed separately. Client will receive invoices for actual hours worked.
              </p>
            </div>
          </div>
        ) : (
          /* Fixed / Hybrid */
          <div className="space-y-6">
            {/* Total Budget */}
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
              <label className="block text-sm font-medium text-emerald-800 mb-3">Total Project Fee</label>
              <div className="flex items-center gap-3">
                <span className="text-2xl text-emerald-600">$</span>
                <Input
                  type="number"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                  className="w-40 text-2xl font-bold border-emerald-300"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            {/* Quick Add Payment Milestones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Quick add:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => addPaymentItem({ title: 'Deposit to begin', dueOn: 'signing' })}
                  className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  + Deposit (on signing)
                </button>
                <button
                  onClick={() => addPaymentItem({ title: 'Completion of Design Development', dueOn: 'milestone' })}
                  className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  + Design Milestone
                </button>
                <button
                  onClick={() => addPaymentItem({ title: 'Completion of Product Selections', dueOn: 'milestone' })}
                  className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  + Product Selection
                </button>
                <button
                  onClick={() => addPaymentItem({ title: 'Final Payment', dueOn: 'completion' })}
                  className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  + Final Payment
                </button>
              </div>
            </div>

            {/* Payment Schedule Items */}
            <div className="space-y-3">
              {paymentSchedule.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border rounded-xl bg-gray-50">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <Input
                    value={item.title}
                    onChange={(e) => updatePaymentItem(index, 'title', e.target.value)}
                    placeholder="Payment name"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={item.percent || ''}
                      onChange={(e) => updatePaymentPercent(index, parseFloat(e.target.value) || 0)}
                      placeholder="%"
                      className="w-16 text-center"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                  <div className="flex items-center gap-1 min-w-[120px]">
                    <span className="text-gray-500">$</span>
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updatePaymentItem(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24 text-right font-medium"
                      min="0"
                      step="100"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePaymentItem(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {paymentSchedule.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-xl text-gray-500">
                  No payment milestones. Use the quick-add buttons above.
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => addPaymentItem()}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Payment
              </Button>
            </div>

            {/* Summary */}
            {paymentSchedule.length > 0 && (
              <div className={`p-4 rounded-xl ${scheduleBalanced ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex justify-between items-center">
                  <span className={scheduleBalanced ? 'text-green-700' : 'text-amber-700'}>
                    Payment Schedule Total:
                  </span>
                  <span className={`font-bold ${scheduleBalanced ? 'text-green-700' : 'text-amber-700'}`}>
                    {formatCurrency(scheduleTotal)}
                  </span>
                </div>
                {!scheduleBalanced && (
                  <p className="text-sm text-amber-600 mt-1">
                    {scheduleTotal < totalBudget
                      ? `${formatCurrency(totalBudget - scheduleTotal)} remaining to allocate`
                      : `${formatCurrency(scheduleTotal - totalBudget)} over budget`
                    }
                  </p>
                )}
              </div>
            )}

            {/* Hourly Rate for Hybrid */}
            {billingType === 'HYBRID' && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <label className="block text-sm font-medium text-amber-800 mb-2">Additional Work Rate</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    className="w-24"
                    min="0"
                  />
                  <span className="text-gray-600">/ hour for work beyond scope</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => setCurrentStep('phases')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('review')}
            className="bg-green-600 hover:bg-green-700"
          >
            Review Proposal
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )

  // Step 4: Review
  const renderReviewStep = () => (
    <div className="grid grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="col-span-2 space-y-6">
        {/* Proposal Details */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Proposal Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Email</label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Address</label>
              <Input value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Cover Letter */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cover Letter</h2>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full h-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Scope Summary */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Scope of Work ({scopeItems.length} phases)</h2>
            <Button variant="outline" size="sm" onClick={() => setCurrentStep('phases')}>
              Edit Phases
            </Button>
          </div>
          <div className="space-y-3">
            {scopeItems.map((item, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="font-semibold text-emerald-600">{index + 1}.</span>
                <div>
                  <span className="font-medium">{item.title}</span>
                  {item.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        {billingType !== 'HOURLY' && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Payment Schedule</h2>
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('payment')}>
                Edit Payments
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-medium pb-2 border-b">
                <span>Total Budget Fee</span>
                <span>{formatCurrency(totalBudget)}</span>
              </div>
              {paymentSchedule.map((item, index) => (
                <div key={index} className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">{item.title}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {billingType === 'HYBRID' && (
                <div className="flex justify-between text-sm py-1 text-amber-700 border-t mt-2 pt-2">
                  <span>Additional work rate</span>
                  <span>{formatCurrency(hourlyRate)}/hour</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full h-40 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="bg-white rounded-xl border p-6 sticky top-24">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Summary
          </h3>

          {billingType === 'HOURLY' ? (
            <div className="space-y-3">
              <div className="text-center py-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-gray-500">Hourly Rate</p>
                <p className="text-3xl font-bold text-emerald-600">{formatCurrency(hourlyRate)}/hr</p>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Billed based on actual hours worked
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(totalBudget)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST ({gstRate}%)</span>
                <span>{formatCurrency(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>QST ({qstRate}%)</span>
                <span>{formatCurrency(qstAmount)}</span>
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-emerald-600">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
              {depositAmount > 0 && (
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Deposit Due</span>
                    <span className="font-medium">{formatCurrency(depositAmount)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validity */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Valid for</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
                  className="w-16 text-center h-8"
                  min="1"
                />
                <span className="text-gray-500">days</span>
              </div>
            </div>
          </div>

          {/* AI Generate Button */}
          {!aiGenerated && (
            <div className="mb-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-sm text-purple-700 mb-3">
                Let AI enhance your proposal with professional descriptions
              </p>
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700"
                onClick={handleGenerateWithAI}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
          )}

          {aiGenerated && (
            <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">AI enhanced</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleSave(true)}
              disabled={saving || sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Save & Send
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleSave(false)}
              disabled={saving || sending}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save as Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const steps = [
    { key: 'describe', label: 'Describe', color: 'purple' },
    { key: 'features', label: 'Included', color: 'blue' },
    { key: 'exclusions', label: 'Excluded', color: 'amber' },
    { key: 'phases', label: 'Phases', color: 'sky' },
    { key: 'payment', label: 'Payment', color: 'green' },
    { key: 'review', label: 'Review', color: 'emerald' },
  ]

  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="min-h-[calc(100vh-4rem)] -mt-6">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-16 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${projectId}/billing`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Edit Proposal' : 'New Proposal'}
                </h1>
                <p className="text-sm text-gray-500">{projectName}</p>
              </div>
            </div>
          </div>

          {/* Step indicator */}
          {!isEditing && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              {steps.map((step, index) => (
                <div key={step.key} className="flex items-center">
                  {index > 0 && (
                    <div className={`w-8 h-0.5 mx-1 ${index <= currentStepIndex ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                  )}
                  <button
                    onClick={() => index <= currentStepIndex && setCurrentStep(step.key as Step)}
                    disabled={index > currentStepIndex}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      currentStep === step.key
                        ? `bg-${step.color}-100 text-${step.color}-700`
                        : index < currentStepIndex
                        ? 'text-emerald-600 hover:bg-gray-100'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                      currentStep === step.key
                        ? `bg-${step.color}-600 text-white`
                        : index < currentStepIndex
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-300 text-white'
                    }`}>
                      {index < currentStepIndex ? <CheckCircle className="w-3 h-3" /> : index + 1}
                    </span>
                    {step.label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {currentStep === 'describe' && renderDescribeStep()}
        {currentStep === 'features' && renderFeaturesStep()}
        {currentStep === 'exclusions' && renderExclusionsStep()}
        {currentStep === 'phases' && renderPhasesStep()}
        {currentStep === 'payment' && renderPaymentStep()}
        {currentStep === 'review' && renderReviewStep()}
      </div>
    </div>
  )
}
