'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, CreditCard, AlertCircle, CheckCircle, Lock } from 'lucide-react'

// iFields types
declare global {
  interface Window {
    setAccount: (key: string, software: string, version: string) => void
    getTokens: (
      success: () => void,
      error: (data: { errorMessage: string }) => void,
      timeout: number
    ) => void
    setIfieldStyle: (fieldId: string, styles: Record<string, string>) => void
    enableAutoFormatting: (separator: string) => void
    addIfieldCallback: (event: string, callback: (data: IFieldEventData) => void) => void
  }
}

interface IFieldEventData {
  cardNumberFormattedLength?: number
  cardNumberIsValid?: boolean
  cvvIsValid?: boolean
  issuer?: string
  lastIfieldChanged?: string
  isEmpty?: boolean
}

interface PaymentFormProps {
  token: string
  quoteId: string
  amount: number
  currency?: string
  onSuccess: () => void
  onCancel: () => void
  /** API base path - defaults to '/api/client-portal' for client portal, use '/api/quote' for invoice pages */
  apiBasePath?: string
}

interface PaymentData {
  paymentId: string
  amount: number
  surchargeAmount: number
  totalAmount: number
  iFieldsKey: string
}

const IFIELDS_VERSION = '2.15.2401.0801'
const IFIELDS_CDN = `https://cdn.cardknox.com/ifields/${IFIELDS_VERSION}`

export default function SoloPaymentForm({
  token,
  quoteId,
  amount,
  currency = 'CAD',
  onSuccess,
  onCancel,
  apiBasePath = '/api/client-portal'
}: PaymentFormProps) {
  // Determine API endpoint based on base path
  const apiEndpoint = apiBasePath === '/api/quote'
    ? `${apiBasePath}/${token}/payment`
    : `${apiBasePath}/${token}/pay`
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const [applySurcharge, setApplySurcharge] = useState(true)

  // Card state
  const [expiration, setExpiration] = useState('')
  const [cardNumberValid, setCardNumberValid] = useState(false)
  const [cvvValid, setCvvValid] = useState(false)
  const [cardIssuer, setCardIssuer] = useState<string | null>(null)

  const iFieldsInitialized = useRef(false)
  const cardNumberRef = useRef<HTMLIFrameElement>(null)
  const cvvRef = useRef<HTMLIFrameElement>(null)

  // Load iFields script
  useEffect(() => {
    if (typeof window === 'undefined') return

    const script = document.createElement('script')
    script.src = `${IFIELDS_CDN}/ifields.min.js`
    script.async = true
    script.onload = () => {
      initializeIFields()
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // Initialize payment when surcharge changes
  useEffect(() => {
    initializePayment()
  }, [applySurcharge])

  const initializeIFields = useCallback(() => {
    if (iFieldsInitialized.current || !paymentData?.iFieldsKey) return

    try {
      window.setAccount(paymentData.iFieldsKey, 'ResidentOne', '1.0.0')

      // Style the iFields to match our design
      const fieldStyles = {
        'font-family': 'system-ui, -apple-system, sans-serif',
        'font-size': '14px',
        'color': '#1f2937',
        'padding': '8px 12px',
        'background': 'transparent'
      }

      window.setIfieldStyle('card-number', fieldStyles)
      window.setIfieldStyle('cvv', fieldStyles)

      // Enable card formatting
      window.enableAutoFormatting(' ')

      // Add validation callbacks
      window.addIfieldCallback('input', (data: IFieldEventData) => {
        if (data.cardNumberIsValid !== undefined) {
          setCardNumberValid(data.cardNumberIsValid)
        }
        if (data.cvvIsValid !== undefined) {
          setCvvValid(data.cvvIsValid)
        }
        if (data.issuer) {
          setCardIssuer(data.issuer)
        }
      })

      iFieldsInitialized.current = true
    } catch (err) {
      console.error('Failed to initialize iFields:', err)
    }
  }, [paymentData?.iFieldsKey])

  // Re-initialize iFields when payment data is loaded
  useEffect(() => {
    if (paymentData?.iFieldsKey && !iFieldsInitialized.current) {
      // Small delay to ensure iframes are mounted
      setTimeout(initializeIFields, 100)
    }
  }, [paymentData, initializeIFields])

  const initializePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(apiEndpoint, {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentData || processing) return

    // Validate expiration
    if (!expiration || expiration.length < 4) {
      setError('Please enter a valid expiration date (MMYY)')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Get tokens from iFields
      await new Promise<void>((resolve, reject) => {
        window.getTokens(
          () => resolve(),
          (data) => reject(new Error(data.errorMessage || 'Failed to tokenize card')),
          30000
        )
      })

      // Get token values from hidden inputs
      const cardToken = (document.querySelector('input[data-ifields-id="card-number-token"]') as HTMLInputElement)?.value
      const cvvToken = (document.querySelector('input[data-ifields-id="cvv-token"]') as HTMLInputElement)?.value

      if (!cardToken) {
        throw new Error('Failed to get card token')
      }

      // Submit payment to our API
      const response = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.paymentId,
          cardToken,
          cvvToken,
          expiration: expiration.replace(/\D/g, '') // Remove any non-digits
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Payment failed')
      }

      if (result.success) {
        setSucceeded(true)
        setTimeout(() => {
          onSuccess()
        }, 2000)
      } else {
        throw new Error(result.error || 'Payment was not approved')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const formatExpiration = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '')

    // Format as MM/YY
    if (digits.length >= 2) {
      return digits.slice(0, 2) + (digits.length > 2 ? '/' + digits.slice(2, 4) : '')
    }
    return digits
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency
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

  if (error && !paymentData) {
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

  if (!paymentData) {
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

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card Number iField */}
        <div className="space-y-2">
          <Label htmlFor="card-number">Card Number</Label>
          <div className="relative">
            <div className="border rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
              <iframe
                ref={cardNumberRef}
                data-ifields-id="card-number"
                data-ifields-placeholder="Card Number"
                src={`${IFIELDS_CDN}/ifield.htm`}
                className="w-full h-10 border-0"
                title="Card Number"
              />
            </div>
            {cardIssuer && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 uppercase">
                {cardIssuer}
              </span>
            )}
          </div>
          <input type="hidden" data-ifields-id="card-number-token" />
        </div>

        {/* Expiration and CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expiration">Expiration</Label>
            <Input
              id="expiration"
              placeholder="MM/YY"
              value={expiration}
              onChange={(e) => setExpiration(formatExpiration(e.target.value))}
              maxLength={5}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cvv">CVV</Label>
            <div className="border rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
              <iframe
                ref={cvvRef}
                data-ifields-id="cvv"
                data-ifields-placeholder="CVV"
                src={`${IFIELDS_CDN}/ifield.htm`}
                className="w-full h-10 border-0"
                title="CVV"
              />
            </div>
            <input type="hidden" data-ifields-id="cvv-token" />
          </div>
        </div>

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
            disabled={processing}
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

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <span>Your payment is processed securely</span>
        </div>
      </form>
    </div>
  )
}
