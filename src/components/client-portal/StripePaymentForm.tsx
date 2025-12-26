'use client'

import { useState, useEffect } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, CreditCard, AlertCircle, CheckCircle } from 'lucide-react'

interface PaymentFormProps {
  token: string
  quoteId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}

interface PaymentData {
  clientSecret: string
  paymentIntentId: string
  paymentId: string
  amount: number
  surchargeAmount: number
  totalAmount: number
  publishableKey: string
}

export default function StripePaymentForm({
  token,
  quoteId,
  amount,
  onSuccess,
  onCancel
}: PaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applySurcharge, setApplySurcharge] = useState(true)

  useEffect(() => {
    initializePayment()
  }, [applySurcharge])

  const initializePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/client-portal/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          amount,
          applySurcharge
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment')
      }

      setPaymentData(data)

      if (data.publishableKey) {
        setStripePromise(loadStripe(data.publishableKey))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(value)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-gray-500">Setting up payment...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 font-medium mb-2">Payment Error</p>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    )
  }

  if (!paymentData || !stripePromise) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Payment processing is not available</p>
        <p className="text-sm text-gray-500 mt-2">
          Please contact your designer for alternative payment methods
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Amount Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span>{formatCurrency(paymentData.amount)}</span>
        </div>
        {paymentData.surchargeAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Credit Card Fee (3%)</span>
            <span className="text-gray-500">
              {formatCurrency(paymentData.surchargeAmount)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>Total</span>
          <span className="text-emerald-600">
            {formatCurrency(paymentData.totalAmount)}
          </span>
        </div>
      </div>

      {/* Surcharge Option */}
      <div className="flex items-start gap-3 p-4 border rounded-lg">
        <Checkbox
          id="surcharge"
          checked={applySurcharge}
          onCheckedChange={(checked) => setApplySurcharge(!!checked)}
        />
        <div className="flex-1">
          <Label htmlFor="surcharge" className="font-medium cursor-pointer">
            Pay with credit card (3% processing fee)
          </Label>
          <p className="text-sm text-gray-500 mt-1">
            A 3% surcharge applies to credit card payments. Uncheck to see other payment options.
          </p>
        </div>
      </div>

      {/* Stripe Payment Form */}
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: paymentData.clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#059669',
              colorText: '#1f2937',
              fontFamily: 'system-ui, sans-serif'
            }
          }
        }}
      >
        <CheckoutForm
          token={token}
          paymentData={paymentData}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </div>
  )
}

interface CheckoutFormProps {
  token: string
  paymentData: PaymentData
  onSuccess: () => void
  onCancel: () => void
}

function CheckoutForm({ token, paymentData, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()

      if (submitError) {
        throw new Error(submitError.message)
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href
        },
        redirect: 'if_required'
      })

      if (confirmError) {
        throw new Error(confirmError.message)
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm with our backend
        const confirmResponse = await fetch(`/api/client-portal/${token}/pay`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentData.paymentIntentId,
            paymentId: paymentData.paymentId
          })
        })

        if (!confirmResponse.ok) {
          console.warn('Backend confirmation failed, but payment succeeded')
        }

        setSucceeded(true)
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  if (succeeded) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-green-700 mb-2">Payment Successful!</h3>
        <p className="text-gray-500">Thank you for your payment.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs'
        }}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Your payment is processed securely by Stripe
      </p>
    </form>
  )
}
