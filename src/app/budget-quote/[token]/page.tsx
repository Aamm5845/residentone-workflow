'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  MessageCircle,
  Loader2,
  Package,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface BudgetQuoteData {
  id: string
  title: string
  description: string | null
  projectName: string
  clientName: string
  companyName: string
  companyLogo: string | null
  estimatedTotal: number
  currency: string
  includeTax: boolean
  includedServices: string[]
  status: string
  expiresAt: string | null
  clientApproved: boolean
  clientApprovedAt: string | null
  clientQuestion: string | null
  items: Array<{
    id: string
    name: string
    categoryName: string
  }>
}

export default function BudgetQuoteClientPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BudgetQuoteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/budget-quotes/public/${token}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Budget quote not found or has expired.')
          } else {
            setError('Failed to load budget quote.')
          }
          return
        }
        const result = await res.json()
        setData(result)

        // Mark as viewed
        await fetch(`/api/budget-quotes/public/${token}/view`, { method: 'POST' })
      } catch (err) {
        setError('An error occurred while loading the budget quote.')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchData()
    }
  }, [token])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: data?.currency || 'CAD',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateStr))
  }

  const handleApprove = async () => {
    try {
      setSubmitting(true)
      const res = await fetch(`/api/budget-quotes/public/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      if (!res.ok) throw new Error('Failed to approve')

      setSubmitted(true)
      setApproveDialogOpen(false)
      // Refresh data
      const updatedRes = await fetch(`/api/budget-quotes/public/${token}`)
      if (updatedRes.ok) {
        setData(await updatedRes.json())
      }
    } catch (err) {
      alert('Failed to submit approval. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuestion = async () => {
    if (!question.trim()) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/budget-quotes/public/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'question', question: question.trim() })
      })

      if (!res.ok) throw new Error('Failed to submit question')

      setSubmitted(true)
      setQuestionDialogOpen(false)
      // Refresh data
      const updatedRes = await fetch(`/api/budget-quotes/public/${token}`)
      if (updatedRes.ok) {
        setData(await updatedRes.json())
      }
    } catch (err) {
      alert('Failed to submit question. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Group items by category
  const itemsByCategory = data?.items.reduce((acc, item) => {
    const cat = item.categoryName || 'Items'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, typeof data.items>) || {}

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-300 border-t-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading budget estimate...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Not Found</h1>
            <p className="text-gray-600">{error || 'This budget quote could not be found.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = data.expiresAt && new Date(data.expiresAt) < new Date()
  const isApproved = data.status === 'APPROVED' || data.clientApproved
  const hasQuestion = data.status === 'QUESTION_ASKED'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center mb-6">
            {data.companyLogo ? (
              <img
                src={data.companyLogo}
                alt={data.companyName}
                className="h-12 bg-white rounded-lg px-4 py-2"
              />
            ) : (
              <span className="text-2xl font-bold">{data.companyName}</span>
            )}
          </div>
          <div className="text-center">
            <Badge className="bg-white/20 text-white border-0 mb-3">
              Budget Estimate
            </Badge>
            <h1 className="text-2xl font-bold mb-2">{data.title}</h1>
            <p className="text-purple-100">for {data.projectName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 -mt-4">
        {/* Status Banner */}
        {isApproved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800">Budget Approved</p>
              <p className="text-sm text-emerald-600">
                {data.clientApprovedAt && `Approved on ${formatDate(data.clientApprovedAt)}`}
              </p>
            </div>
          </div>
        )}

        {hasQuestion && !isApproved && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Question Submitted</p>
              <p className="text-sm text-amber-600">We'll get back to you shortly.</p>
            </div>
          </div>
        )}

        {isExpired && !isApproved && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <Calendar className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Estimate Expired</p>
              <p className="text-sm text-red-600">This estimate has passed its validity date.</p>
            </div>
          </div>
        )}

        {/* Budget Amount Card */}
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-6 text-center text-white">
            <p className="text-sm uppercase tracking-wide text-purple-100 mb-2">Estimated Budget</p>
            <p className="text-4xl font-bold">{formatCurrency(data.estimatedTotal)}</p>
            {data.includeTax && (
              <p className="text-sm text-purple-200 mt-1">+ applicable taxes</p>
            )}
          </div>
          {data.expiresAt && !isExpired && (
            <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-600">
              Valid until {formatDate(data.expiresAt)}
            </div>
          )}
        </Card>

        {/* Description */}
        {data.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-gray-700 leading-relaxed">{data.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Items by Category */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              What's Included
            </h3>
            <div className="space-y-2">
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{category}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </Badge>
                      {expandedCategories.has(category) ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </button>
                  {expandedCategories.has(category) && (
                    <ul className="px-4 py-3 space-y-2 bg-white">
                      {items.map((item) => (
                        <li key={item.id} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isApproved && !isExpired && !hasQuestion && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              onClick={() => setApproveDialogOpen(true)}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Approve Budget
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => setQuestionDialogOpen(true)}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              I Have a Question
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>{data.companyName}</p>
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Budget Estimate</DialogTitle>
            <DialogDescription>
              By approving, you confirm that you'd like to proceed with this budget estimate of{' '}
              <strong>{formatCurrency(data.estimatedTotal)}</strong>
              {data.includeTax ? ' + taxes' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
            A detailed invoice with itemized pricing will be sent to you for final review and payment.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="bg-gradient-to-r from-violet-600 to-purple-600"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve Budget
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask a Question</DialogTitle>
            <DialogDescription>
              Have a question about this budget estimate? We'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleQuestion}
              disabled={submitting || !question.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Question
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
