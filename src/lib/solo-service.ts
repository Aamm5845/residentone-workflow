/**
 * Solo Payments (Cardknox) Service
 * Server-side transaction processing for credit card payments
 */

const SOLO_API_URL = 'https://x1.cardknox.com/gatewayjson'
const SOLO_VERSION = '5.0.0'
const SOFTWARE_NAME = 'ResidentOne'
const SOFTWARE_VERSION = '1.0.0'

export interface SoloSaleParams {
  amount: number // Amount in dollars
  currency?: string
  cardToken: string // SUT from iFields (xCardNum)
  cvvToken?: string // SUT from iFields (xCVV)
  expiration: string // MMYY format
  customerEmail?: string
  customerName?: string
  billingAddress?: {
    firstName?: string
    lastName?: string
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  description?: string
  invoiceNumber?: string
  metadata?: Record<string, string>
  applySurcharge?: boolean
  surchargePercent?: number
}

export interface SoloTransactionResult {
  success: boolean
  transactionId: string // xRefNum
  authCode?: string
  maskedCard?: string
  cardType?: string
  token?: string // Reusable token for future transactions
  amount: number
  surchargeAmount: number
  totalAmount: number
  currency: string
  error?: string
  errorCode?: string
  avsResult?: string
  cvvResult?: string
}

export interface SoloRefundParams {
  transactionId: string // Original xRefNum
  amount?: number // Partial refund amount (omit for full)
}

interface SoloApiResponse {
  xResult: 'A' | 'D' | 'E' // Approved, Declined, Error
  xStatus: string
  xError: string
  xErrorCode: string
  xRefNum: string
  xAuthCode: string
  xExp: string
  xMaskedCardNumber: string
  xCardType: string
  xToken: string
  xAuthAmount: string
  xAvsResultCode: string
  xCvvResultCode: string
  xDate: string
  xCurrency: string
}

class SoloService {
  private apiKey: string | null
  private iFieldsKey: string | null
  private defaultSurchargePercent = 3

  constructor() {
    this.apiKey = process.env.SOLO_API_KEY || null
    this.iFieldsKey = process.env.NEXT_PUBLIC_SOLO_IFIELDS_KEY || null
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  getIFieldsKey(): string | null {
    return this.iFieldsKey
  }

  /**
   * Process a credit card sale transaction
   */
  async processSale(params: SoloSaleParams): Promise<SoloTransactionResult> {
    if (!this.apiKey) {
      throw new Error('Solo Payments is not configured. Set SOLO_API_KEY environment variable.')
    }

    const {
      amount,
      currency = 'CAD',
      cardToken,
      cvvToken,
      expiration,
      customerEmail,
      customerName,
      billingAddress,
      description,
      invoiceNumber,
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

    // Build request body
    const requestBody: Record<string, string> = {
      xKey: this.apiKey,
      xVersion: SOLO_VERSION,
      xSoftwareName: SOFTWARE_NAME,
      xSoftwareVersion: SOFTWARE_VERSION,
      xCommand: 'cc:sale',
      xAmount: totalAmount.toFixed(2),
      xCardNum: cardToken,
      xExp: expiration,
      xCurrency: currency
    }

    // Add CVV if provided
    if (cvvToken) {
      requestBody.xCVV = cvvToken
    }

    // Add customer info
    if (customerEmail) {
      requestBody.xEmail = customerEmail
    }
    if (customerName) {
      requestBody.xName = customerName
    }

    // Add billing address
    if (billingAddress) {
      if (billingAddress.firstName) requestBody.xBillFirstName = billingAddress.firstName
      if (billingAddress.lastName) requestBody.xBillLastName = billingAddress.lastName
      if (billingAddress.street) requestBody.xBillStreet = billingAddress.street
      if (billingAddress.city) requestBody.xBillCity = billingAddress.city
      if (billingAddress.state) requestBody.xBillState = billingAddress.state
      if (billingAddress.zip) requestBody.xBillZip = billingAddress.zip
    }

    // Add reference numbers
    if (invoiceNumber) {
      requestBody.xInvoice = invoiceNumber
    }
    if (description) {
      requestBody.xDescription = description
    }

    // Add metadata as custom fields (up to 20)
    const metadataEntries = Object.entries(metadata).slice(0, 20)
    metadataEntries.forEach(([key, value], index) => {
      requestBody[`xCustom${String(index + 1).padStart(2, '0')}`] = `${key}:${value}`
    })

    try {
      const response = await fetch(SOLO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data: SoloApiResponse = await response.json()

      if (data.xResult === 'A') {
        // Approved
        return {
          success: true,
          transactionId: data.xRefNum,
          authCode: data.xAuthCode,
          maskedCard: data.xMaskedCardNumber,
          cardType: data.xCardType,
          token: data.xToken,
          amount,
          surchargeAmount,
          totalAmount: parseFloat(data.xAuthAmount) || totalAmount,
          currency: data.xCurrency || currency,
          avsResult: data.xAvsResultCode,
          cvvResult: data.xCvvResultCode
        }
      } else {
        // Declined or Error
        return {
          success: false,
          transactionId: data.xRefNum || '',
          amount,
          surchargeAmount,
          totalAmount,
          currency,
          error: data.xError || data.xStatus || 'Transaction failed',
          errorCode: data.xErrorCode
        }
      }
    } catch (error) {
      console.error('[Solo] Transaction error:', error)
      return {
        success: false,
        transactionId: '',
        amount,
        surchargeAmount,
        totalAmount,
        currency,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }
    }
  }

  /**
   * Process a refund
   */
  async processRefund(params: SoloRefundParams): Promise<{ success: boolean; refundId?: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'Solo Payments not configured' }
    }

    const { transactionId, amount } = params

    const requestBody: Record<string, string> = {
      xKey: this.apiKey,
      xVersion: SOLO_VERSION,
      xSoftwareName: SOFTWARE_NAME,
      xSoftwareVersion: SOFTWARE_VERSION,
      xCommand: 'cc:refund',
      xRefNum: transactionId
    }

    if (amount) {
      requestBody.xAmount = amount.toFixed(2)
    }

    try {
      const response = await fetch(SOLO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data: SoloApiResponse = await response.json()

      if (data.xResult === 'A') {
        return {
          success: true,
          refundId: data.xRefNum
        }
      } else {
        return {
          success: false,
          error: data.xError || 'Refund failed'
        }
      }
    } catch (error) {
      console.error('[Solo] Refund error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed'
      }
    }
  }

  /**
   * Void a transaction (before settlement)
   */
  async voidTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'Solo Payments not configured' }
    }

    const requestBody: Record<string, string> = {
      xKey: this.apiKey,
      xVersion: SOLO_VERSION,
      xSoftwareName: SOFTWARE_NAME,
      xSoftwareVersion: SOFTWARE_VERSION,
      xCommand: 'cc:void',
      xRefNum: transactionId
    }

    try {
      const response = await fetch(SOLO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data: SoloApiResponse = await response.json()

      if (data.xResult === 'A') {
        return { success: true }
      } else {
        return {
          success: false,
          error: data.xError || 'Void failed'
        }
      }
    } catch (error) {
      console.error('[Solo] Void error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Void failed'
      }
    }
  }
}

export const soloService = new SoloService()
