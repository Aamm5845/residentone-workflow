'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, CreditCard, AlertCircle, CheckCircle, Lock } from 'lucide-react'

// iFields version - check https://cdn.cardknox.com/ifields/versions.htm for latest
const IFIELDS_VERSION = '3.2.2601.0701'
const IFIELDS_CDN = `https://cdn.cardknox.com/ifields/${IFIELDS_VERSION}`

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
  originalAmount: number
  surchargeAmount: number
  totalAmount: number
  iFieldsKey: string
}

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
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [ifieldsReady, setIfieldsReady] = useState(false)

  // Card state
  const [expiration, setExpiration] = useState('')
  const [cardIssuer, setCardIssuer] = useState<string | null>(null)

  const initAttempted = useRef(false)

  // Load iFields script
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if script already loaded
    const existingScript = document.querySelector(`script[src="${IFIELDS_CDN}/ifields.min.js"]`)
    if (existingScript) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `${IFIELDS_CDN}/ifields.min.js`
    script.async = true
    script.onload = () => {
      console.log('[SoloPayment] iFields script loaded')
      setScriptLoaded(true)
    }
    script.onerror = () => {
      console.error('[SoloPayment] Failed to load iFields script')
      setError('Failed to load payment system')
      setLoading(false)
    }
    document.head.appendChild(script)

    return () => {
      // Don't remove script on cleanup - it might be used elsewhere
    }
  }, [])

  // Initialize payment when component mounts
  useEffect(() => {
    if (!initAttempted.current) {
      initAttempted.current = true
      initializePayment()
    }
  }, [])

  // Initialize iFields when script is loaded and we have payment data
  useEffect(() => {
    if (scriptLoaded && paymentData?.iFieldsKey && !ifieldsReady) {
      // Give iframes time to load
      const timer = setTimeout(() => {
        initializeIFields()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [scriptLoaded, paymentData])

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
          applySurcharge: true // Always apply surcharge for credit card
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment')
      }

      console.log('[SoloPayment] Payment initialized:', data)
      setPaymentData({
        paymentId: data.paymentId,
        originalAmount: data.originalAmount || data.amount || amount,
        surchargeAmount: data.surchargeAmount || 0,
        totalAmount: data.totalAmount || amount,
        iFieldsKey: data.iFieldsKey
      })
    } catch (err) {
      console.error('[SoloPayment] Init error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const initializeIFields = () => {
    if (!paymentData?.iFieldsKey) return

    try {
      // Check if iFields functions are available
      if (typeof (window as any).setAccount !== 'function') {
        console.error('[SoloPayment] iFields functions not available')
        setError('Payment system not ready. Please refresh the page.')
        return
      }

      console.log('[SoloPayment] Initializing iFields with key:', paymentData.iFieldsKey.substring(0, 20) + '...')

      // Initialize account
      ;(window as any).setAccount(paymentData.iFieldsKey, 'ResidentOne', '1.0.0')

      // Style the iFields
      const fieldStyles = {
        'font-family': 'system-ui, -apple-system, sans-serif',
        'font-size': '16px',
        'color': '#1f2937',
        'padding': '10px 12px',
        'background': 'transparent',
        'border': 'none',
        'outline': 'none',
        'width': '100%',
        'height': '100%'
      }

      if (typeof (window as any).setIfieldStyle === 'function') {
        ;(window as any).setIfieldStyle('card-number', fieldStyles)
        ;(window as any).setIfieldStyle('cvv', fieldStyles)
      }

      // Enable card formatting
      if (typeof (window as any).enableAutoFormatting === 'function') {
        ;(window as any).enableAutoFormatting(' ')
      }

      // Add validation callbacks
      if (typeof (window as any).addIfieldCallback === 'function') {
        ;(window as any).addIfieldCallback('input', (data: any) => {
          if (data.issuer) {
            setCardIssuer(data.issuer)
          }
        })
      }

      setIfieldsReady(true)
      console.log('[SoloPayment] iFields initialized successfully')
    } catch (err) {
      console.error('[SoloPayment] Failed to initialize iFields:', err)
      setError('Failed to initialize payment form')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentData || processing) return

    // Validate expiration
    const expDigits = expiration.replace(/\D/g, '')
    if (expDigits.length < 4) {
      setError('Please enter a valid expiration date (MM/YY)')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Get tokens from iFields
      if (typeof (window as any).getTokens !== 'function') {
        throw new Error('Payment system not ready')
      }

      await new Promise<void>((resolve, reject) => {
        ;(window as any).getTokens(
          () => resolve(),
          (data: { errorMessage: string }) => reject(new Error(data.errorMessage || 'Failed to process card')),
          30000
        )
      })

      // Get token values from hidden inputs
      const cardToken = (document.querySelector('input[data-ifields-id="card-number-token"]') as HTMLInputElement)?.value
      const cvvToken = (document.querySelector('input[data-ifields-id="cvv-token"]') as HTMLInputElement)?.value

      if (!cardToken) {
        throw new Error('Please enter a valid card number')
      }

      // Submit payment to our API
      const response = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.paymentId,
          cardToken,
          cvvToken,
          expiration: expDigits // MMYY format
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
      console.error('[SoloPayment] Payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const formatExpiration = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2, 4)
    }
    return digits
  }

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return '$0.00'
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
          Please contact us for alternative payment methods
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
          <span>{formatCurrency(paymentData.originalAmount)}</span>
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

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card Number */}
        <div className="space-y-2">
          <Label>Card Number</Label>
          <div className="relative border rounded-md bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
            <iframe
              data-ifields-id="card-number"
              data-ifields-placeholder="Card Number"
              src={`${IFIELDS_CDN}/ifield.htm`}
              className="w-full h-12 border-0"
              title="Card Number"
            />
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
            <Label>Expiration</Label>
            <Input
              placeholder="MM/YY"
              value={expiration}
              onChange={(e) => setExpiration(formatExpiration(e.target.value))}
              maxLength={5}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label>CVV</Label>
            <div className="border rounded-md bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
              <iframe
                data-ifields-id="cvv"
                data-ifields-placeholder="CVV"
                src={`${IFIELDS_CDN}/ifield.htm`}
                className="w-full h-12 border-0"
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

        <div className="flex gap-3 pt-2">
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
            disabled={processing || !ifieldsReady}
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
                Pay {formatCurrency(paymentData.totalAmount)}
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Lock className="w-3 h-3" />
          <span>Secured by Cardknox</span>
        </div>
      </form>
    </div>
  )
}
