import crypto from 'crypto'

/**
 * Nuvei API Integration for Interac e-Transfer
 * Documentation: https://docs.nuvei.com/documentation/us-and-canada-guides/interac-etransfer/
 */

const NUVEI_API_URL = process.env.NUVEI_API_URL || 'https://ppp-test.nuvei.com/ppp/api/v1'
const NUVEI_MERCHANT_ID = process.env.NUVEI_MERCHANT_ID || ''
const NUVEI_MERCHANT_SITE_ID = process.env.NUVEI_MERCHANT_SITE_ID || ''
const NUVEI_SECRET_KEY = process.env.NUVEI_SECRET_KEY || ''

interface NuveiSessionResponse {
  sessionToken: string
  merchantId: string
  merchantSiteId: string
  clientRequestId: string
  internalRequestId: number
  status: string
  errCode: number
  reason: string
  version: string
}

interface NuveiPaymentResponse {
  orderId: string
  userTokenId: string
  paymentOptionId: string
  transactionStatus: string
  transactionId: string
  transactionType: string
  redirectUrl?: string
  userPaymentOptionId?: string
  errCode: number
  reason: string
  status: string
  clientUniqueId: string
  internalRequestId: number
  version: string
}

/**
 * Generate timestamp in YYYYMMDDHHmmss format
 */
function getTimestamp(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
}

/**
 * Calculate checksum for Nuvei API authentication
 */
function calculateChecksum(...params: string[]): string {
  const concatenated = params.join('')
  return crypto.createHash('sha256').update(concatenated).digest('hex')
}

/**
 * Get a session token from Nuvei
 */
export async function getSessionToken(clientRequestId: string): Promise<NuveiSessionResponse> {
  const timestamp = getTimestamp()
  const checksum = calculateChecksum(
    NUVEI_MERCHANT_ID,
    NUVEI_MERCHANT_SITE_ID,
    clientRequestId,
    timestamp,
    NUVEI_SECRET_KEY
  )

  const response = await fetch(`${NUVEI_API_URL}/getSessionToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchantId: NUVEI_MERCHANT_ID,
      merchantSiteId: NUVEI_MERCHANT_SITE_ID,
      clientRequestId,
      timeStamp: timestamp,
      checksum,
    }),
  })

  if (!response.ok) {
    throw new Error(`Nuvei getSessionToken failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Initiate an Interac e-Transfer payment
 */
export async function initiateETransferPayment(params: {
  sessionToken: string
  amount: number
  currency?: string
  invoiceId: string
  quoteNumber: string
  customerEmail: string
  customerPhone?: string
  customerName: string
  notificationUrl: string
  successUrl: string
  failureUrl: string
  pendingUrl: string
  ipAddress?: string
}): Promise<NuveiPaymentResponse> {
  const {
    sessionToken,
    amount,
    currency = 'CAD',
    invoiceId,
    quoteNumber,
    customerEmail,
    customerPhone,
    customerName,
    notificationUrl,
    successUrl,
    failureUrl,
    pendingUrl,
    ipAddress = '127.0.0.1',
  } = params

  const timestamp = getTimestamp()
  const clientUniqueId = `${invoiceId}-${Date.now()}`
  const clientRequestId = `req-${Date.now()}`

  // Parse customer name
  const nameParts = customerName.split(' ')
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || 'N/A'

  // Format phone for Canadian format (10 digits)
  const formattedPhone = customerPhone?.replace(/\D/g, '').slice(-10) || '0000000000'

  const checksum = calculateChecksum(
    NUVEI_MERCHANT_ID,
    NUVEI_MERCHANT_SITE_ID,
    clientRequestId,
    amount.toString(),
    currency,
    timestamp,
    NUVEI_SECRET_KEY
  )

  const response = await fetch(`${NUVEI_API_URL}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionToken,
      merchantId: NUVEI_MERCHANT_ID,
      merchantSiteId: NUVEI_MERCHANT_SITE_ID,
      clientRequestId,
      clientUniqueId,
      timeStamp: timestamp,
      checksum,
      currency,
      amount: amount.toFixed(2),
      paymentOption: {
        alternativePaymentMethod: {
          paymentMethod: 'apmgw_Interac_eTransfer',
          email: customerEmail,
          mobilePhone: formattedPhone,
        },
      },
      billingAddress: {
        firstName,
        lastName,
        email: customerEmail,
        phone: formattedPhone,
        country: 'CA',
      },
      deviceDetails: {
        ipAddress,
      },
      urlDetails: {
        notificationUrl,
        successUrl,
        failureUrl,
        pendingUrl,
      },
      customData: quoteNumber,
      merchantDetails: {
        customField1: invoiceId,
        customField2: quoteNumber,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Nuvei payment failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Verify webhook/DMN checksum
 */
export function verifyDMNChecksum(params: Record<string, string>): boolean {
  const {
    totalAmount,
    currency,
    responseTimeStamp,
    PPP_TransactionID,
    Status,
    productId,
    advanceResponseChecksum,
  } = params

  const expectedChecksum = calculateChecksum(
    NUVEI_SECRET_KEY,
    totalAmount || '',
    currency || '',
    responseTimeStamp || '',
    PPP_TransactionID || '',
    Status || '',
    productId || ''
  )

  return expectedChecksum === advanceResponseChecksum
}

/**
 * Check if Nuvei is configured
 */
export function isNuveiConfigured(): boolean {
  return !!(NUVEI_MERCHANT_ID && NUVEI_MERCHANT_SITE_ID && NUVEI_SECRET_KEY)
}
