import Stripe from 'stripe'

// Initialize Stripe with the secret key
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia'
    })
  : null

export interface CreatePaymentIntentParams {
  amount: number // Amount in dollars (will be converted to cents)
  currency?: string
  customerId?: string
  customerEmail?: string
  customerName?: string
  description?: string
  metadata?: Record<string, string>
  applySurcharge?: boolean // Apply 3% credit card surcharge
  surchargePercent?: number // Default 3%
}

export interface PaymentIntentResult {
  paymentIntentId: string
  clientSecret: string
  amount: number // Original amount
  surchargeAmount: number // Surcharge if applied
  totalAmount: number // Total after surcharge
  currency: string
}

export interface WebhookEvent {
  type: string
  data: {
    object: Stripe.PaymentIntent
  }
}

class StripeService {
  private defaultSurchargePercent = 3 // 3% CC surcharge

  isConfigured(): boolean {
    return !!stripe
  }

  /**
   * Create a payment intent for processing payment
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.')
    }

    const {
      amount,
      currency = 'cad',
      customerId,
      customerEmail,
      customerName,
      description,
      metadata = {},
      applySurcharge = false,
      surchargePercent = this.defaultSurchargePercent
    } = params

    // Calculate surcharge if applicable
    let surchargeAmount = 0
    let totalAmount = amount

    if (applySurcharge) {
      surchargeAmount = Math.round(amount * (surchargePercent / 100) * 100) / 100
      totalAmount = amount + surchargeAmount
    }

    // Convert to cents for Stripe
    const amountInCents = Math.round(totalAmount * 100)

    // Build payment intent params
    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      description,
      metadata: {
        ...metadata,
        originalAmount: amount.toString(),
        surchargeAmount: surchargeAmount.toString(),
        surchargePercent: applySurcharge ? surchargePercent.toString() : '0'
      },
      automatic_payment_methods: {
        enabled: true
      }
    }

    // Create or get customer
    if (customerId) {
      intentParams.customer = customerId
    } else if (customerEmail) {
      // Look for existing customer or create new one
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        intentParams.customer = existingCustomers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName
        })
        intentParams.customer = customer.id
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams)

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount,
      surchargeAmount,
      totalAmount,
      currency
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    if (!stripe) return null

    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId)
    } catch (error) {
      console.error('[Stripe] Error retrieving payment intent:', error)
      return null
    }
  }

  /**
   * Confirm payment was successful
   */
  async confirmPayment(paymentIntentId: string): Promise<{
    success: boolean
    status: string
    chargeId?: string
    receiptUrl?: string
  }> {
    if (!stripe) {
      return { success: false, status: 'not_configured' }
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status === 'succeeded') {
        // Get the charge for receipt URL
        const charges = await stripe.charges.list({
          payment_intent: paymentIntentId,
          limit: 1
        })

        return {
          success: true,
          status: paymentIntent.status,
          chargeId: charges.data[0]?.id,
          receiptUrl: charges.data[0]?.receipt_url || undefined
        }
      }

      return {
        success: false,
        status: paymentIntent.status
      }
    } catch (error) {
      console.error('[Stripe] Error confirming payment:', error)
      return { success: false, status: 'error' }
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number, // Partial refund amount in dollars
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' }
    }

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason
      }

      if (amount) {
        refundParams.amount = Math.round(amount * 100) // Convert to cents
      }

      const refund = await stripe.refunds.create(refundParams)

      return {
        success: true,
        refundId: refund.id
      }
    } catch (error) {
      console.error('[Stripe] Error creating refund:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create refund'
      }
    }
  }

  /**
   * Verify webhook signature and parse event
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event | null {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Stripe] Webhook secret not configured')
      return null
    }

    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (error) {
      console.error('[Stripe] Webhook signature verification failed:', error)
      return null
    }
  }

  /**
   * Get Stripe publishable key for frontend
   */
  getPublishableKey(): string | null {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null
  }
}

export const stripeService = new StripeService()
