'use client'

import { useState, useEffect, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Building2,
  Banknote,
  FileText,
  Clock,
  Package,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, CC_SURCHARGE_RATE } from '@/lib/tax-utils'

interface Quote {
  id: string
  quoteNumber: string
  title: string
  description: string
  status: string
  isExpired: boolean
  validUntil: string | null
  createdAt: string
  subtotal: number
  gstRate: number
  gstAmount: number
  qstRate: number
  qstAmount: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  currency: string
  ccSurchargePercent: number
  clientName: string
  clientEmail: string
  selectedPaymentMethod: string | null
  lineItems: Array<{
    id: string
    name: string
    description: string
    categoryName: string
    roomName: string
    quantity: number
    unitType: string
    unitPrice: number
    totalPrice: number
  }>
  projectName: string
}

interface Organization {
  name: string
  logoUrl: string | null
  address: string | null
  city: string | null
  province: string | null
  postal: string | null
  country: string | null
  phone: string | null
  email: string | null
  gstNumber: string | null
  qstNumber: string | null
  wireInstructions: string | null
  checkInstructions: string | null
}

type PaymentMethod = 'CREDIT_CARD' | 'WIRE' | 'CHECK' | 'CASH'

export default function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const { token } = resolvedParams

  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD')
  const [processing, setProcessing] = useState(false)
  const [declineMessage, setDeclineMessage] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)

  useEffect(() => {
    fetchQuote()
  }, [token])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quote/${token}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Quote not found')
      }
      const data = await response.json()
      setQuote(data.quote)
      setOrganization(data.organization)
      if (data.quote.selectedPaymentMethod) {
        setPaymentMethod(data.quote.selectedPaymentMethod as PaymentMethod)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setPaymentMethod(method)

    try {
      await fetch(`/api/quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'select-payment',
          paymentMethod: method
        })
      })
    } catch (err) {
      // Silent fail - method will be selected when payment is initiated
    }
  }

  const handlePayWithCard = async () => {
    if (!quote) return

    setProcessing(true)
    try {
      // Create payment intent
      const response = await fetch(`/api/quote/${token}/payment`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initiate payment')
      }

      const data = await response.json()

      // For now, show a message about Stripe integration
      // In production, you would use Stripe Elements here
      toast.success('Payment initiated! Redirecting to payment...')

      // In a full implementation, you would:
      // 1. Load Stripe.js
      // 2. Use Elements to collect card details
      // 3. Confirm the payment with the clientSecret

      // For demonstration, show the payment details
      toast.info(
        `Payment amount: ${formatCurrency(data.totalAmount)} (includes ${formatCurrency(data.surchargeAmount)} CC fee)`,
        { duration: 10000 }
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleDecline = async () => {
    if (!quote) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          message: declineMessage
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to decline quote')
      }

      toast.success('Quote declined. The designer has been notified.')
      await fetchQuote()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline quote')
    } finally {
      setProcessing(false)
      setShowDeclineForm(false)
    }
  }

  // Calculate CC surcharge
  const ccSurcharge = quote ? (quote.remainingAmount * (quote.ccSurchargePercent / 100)) : 0
  const totalWithSurcharge = quote ? quote.remainingAmount + ccSurcharge : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !quote || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Quote Not Found</h1>
            <p className="text-gray-500">{error || 'This quote may have been removed or the link is invalid.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isApproved = quote.status === 'APPROVED'
  const isDeclined = quote.status === 'REJECTED'
  const isPaid = quote.paidAmount >= quote.totalAmount

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Company Header */}
        <div className="bg-white rounded-t-xl p-6 border border-b-0 border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {organization.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{organization.name}</h1>
                {organization.address && (
                  <p className="text-sm text-gray-500">
                    {organization.address}
                    {organization.city && `, ${organization.city}`}
                    {organization.province && `, ${organization.province}`}
                    {organization.postal && ` ${organization.postal}`}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              {organization.gstNumber && <div>GST: {organization.gstNumber}</div>}
              {organization.qstNumber && <div>QST: {organization.qstNumber}</div>}
            </div>
          </div>
        </div>

        {/* Quote Header */}
        <Card className="rounded-none border-t-0">
          <CardHeader className="bg-gray-50 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Quote {quote.quoteNumber}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">{quote.projectName}</p>
              </div>
              <div className="text-right">
                {quote.isExpired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : isPaid ? (
                  <Badge className="bg-green-100 text-green-800">Paid</Badge>
                ) : isApproved ? (
                  <Badge className="bg-blue-100 text-blue-800">Approved</Badge>
                ) : isDeclined ? (
                  <Badge variant="destructive">Declined</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800">Awaiting Response</Badge>
                )}
                {quote.validUntil && !quote.isExpired && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    Valid until {new Date(quote.validUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Line Items */}
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items
              </h3>
              <div className="space-y-3">
                {quote.lineItems.map(item => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500">{item.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {item.roomName && `${item.roomName} • `}
                        {item.categoryName && `${item.categoryName} • `}
                        Qty: {item.quantity} {item.unitType}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-medium text-gray-900">{formatCurrency(item.totalPrice)}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.unitPrice)} each</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="p-6 bg-gray-50">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST ({quote.gstRate}%)</span>
                  <span className="text-gray-900">{formatCurrency(quote.gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">QST ({quote.qstRate}%)</span>
                  <span className="text-gray-900">{formatCurrency(quote.qstAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-lg">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatCurrency(quote.totalAmount)}</span>
                </div>
                {quote.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Paid</span>
                      <span>-{formatCurrency(quote.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-gray-900">Remaining</span>
                      <span className="text-gray-900">{formatCurrency(quote.remainingAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Section */}
        {!quote.isExpired && !isPaid && !isDeclined && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => handlePaymentMethodSelect(value as PaymentMethod)}
                className="space-y-3"
              >
                {/* Credit Card */}
                <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'CREDIT_CARD' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="CREDIT_CARD" id="credit_card" className="mt-1" />
                  <Label htmlFor="credit_card" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium">
                      <CreditCard className="w-4 h-4" />
                      Credit Card
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Pay securely with credit or debit card
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      +{quote.ccSurchargePercent}% processing fee ({formatCurrency(ccSurcharge)})
                    </p>
                    {paymentMethod === 'CREDIT_CARD' && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span>{formatCurrency(quote.remainingAmount)}</span>
                          </div>
                          <div className="flex justify-between text-amber-600">
                            <span>CC Fee ({quote.ccSurchargePercent}%):</span>
                            <span>{formatCurrency(ccSurcharge)}</span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex justify-between font-semibold">
                            <span>Total to Pay:</span>
                            <span>{formatCurrency(totalWithSurcharge)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Label>
                </div>

                {/* Wire Transfer */}
                <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'WIRE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="WIRE" id="wire" className="mt-1" />
                  <Label htmlFor="wire" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium">
                      <Building2 className="w-4 h-4" />
                      Wire Transfer
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Transfer funds directly to our bank account
                    </p>
                    {paymentMethod === 'WIRE' && organization.wireInstructions && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                          {organization.wireInstructions}
                        </pre>
                      </div>
                    )}
                  </Label>
                </div>

                {/* Check */}
                <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'CHECK' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="CHECK" id="check" className="mt-1" />
                  <Label htmlFor="check" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium">
                      <FileText className="w-4 h-4" />
                      Check
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Pay by check
                    </p>
                    {paymentMethod === 'CHECK' && organization.checkInstructions && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                          {organization.checkInstructions}
                        </pre>
                      </div>
                    )}
                  </Label>
                </div>

                {/* Cash */}
                <div className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'CASH' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="CASH" id="cash" className="mt-1" />
                  <Label htmlFor="cash" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-medium">
                      <Banknote className="w-4 h-4" />
                      Cash
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Pay in cash at our office
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                {paymentMethod === 'CREDIT_CARD' ? (
                  <Button
                    onClick={handlePayWithCard}
                    disabled={processing}
                    className="flex-1"
                    size="lg"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay {formatCurrency(totalWithSurcharge)}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="lg"
                    onClick={() => toast.info(`Please follow the ${paymentMethod.toLowerCase()} instructions above. Contact us if you have questions.`)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    I'll Pay via {paymentMethod === 'WIRE' ? 'Wire Transfer' : paymentMethod === 'CHECK' ? 'Check' : 'Cash'}
                  </Button>
                )}

                {!showDeclineForm ? (
                  <Button
                    variant="ghost"
                    className="text-gray-500"
                    onClick={() => setShowDeclineForm(true)}
                  >
                    Decline
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-gray-500"
                    onClick={() => setShowDeclineForm(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {/* Decline Form */}
              {showDeclineForm && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Decline Quote</h4>
                  <Textarea
                    value={declineMessage}
                    onChange={(e) => setDeclineMessage(e.target.value)}
                    placeholder="Please let us know why you're declining (optional)"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeclineForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDecline}
                      disabled={processing}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Declining...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Decline Quote
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Messages */}
        {isPaid && (
          <Card className="mt-6 border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-green-900">Payment Received</h3>
              <p className="text-sm text-green-700 mt-1">Thank you for your payment!</p>
            </CardContent>
          </Card>
        )}

        {isDeclined && (
          <Card className="mt-6 border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <h3 className="font-semibold text-red-900">Quote Declined</h3>
              <p className="text-sm text-red-700 mt-1">
                You declined this quote. Contact us if you'd like to discuss further.
              </p>
            </CardContent>
          </Card>
        )}

        {quote.isExpired && !isPaid && (
          <Card className="mt-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-center">
              <Clock className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <h3 className="font-semibold text-amber-900">Quote Expired</h3>
              <p className="text-sm text-amber-700 mt-1">
                This quote has expired. Please contact us for a new quote.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p className="mb-2">Questions about this quote?</p>
          <div className="flex items-center justify-center gap-4">
            {organization.email && (
              <a href={`mailto:${organization.email}`} className="flex items-center gap-1 hover:text-gray-700">
                <Mail className="w-4 h-4" />
                {organization.email}
              </a>
            )}
            {organization.phone && (
              <a href={`tel:${organization.phone}`} className="flex items-center gap-1 hover:text-gray-700">
                <Phone className="w-4 h-4" />
                {organization.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
