/**
 * Tax calculation utilities for Quebec GST/QST
 */

export const QUEBEC_TAX_RATES = {
  GST: 5.0,      // Federal GST (5%)
  QST: 9.975,    // Quebec QST (9.975%)
} as const

export const CC_SURCHARGE_RATE = 3.0 // Credit card surcharge (3%)

export interface TaxCalculation {
  subtotal: number
  gstRate: number
  gstAmount: number
  qstRate: number
  qstAmount: number
  totalBeforeSurcharge: number
  total: number
}

export interface TaxCalculationWithSurcharge extends TaxCalculation {
  hasCCSurcharge: boolean
  ccSurchargeRate: number
  ccSurchargeAmount: number
}

/**
 * Calculate Quebec taxes (GST and QST)
 * @param subtotal - The subtotal before taxes
 * @param gstRate - GST rate (default 5%)
 * @param qstRate - QST rate (default 9.975%)
 * @returns Tax calculation breakdown
 */
export function calculateQuebecTaxes(
  subtotal: number,
  gstRate: number = QUEBEC_TAX_RATES.GST,
  qstRate: number = QUEBEC_TAX_RATES.QST
): TaxCalculation {
  const gstAmount = roundToTwoDecimals(subtotal * (gstRate / 100))
  const qstAmount = roundToTwoDecimals(subtotal * (qstRate / 100))
  const total = roundToTwoDecimals(subtotal + gstAmount + qstAmount)

  return {
    subtotal: roundToTwoDecimals(subtotal),
    gstRate,
    gstAmount,
    qstRate,
    qstAmount,
    totalBeforeSurcharge: total,
    total,
  }
}

/**
 * Calculate credit card surcharge
 * @param amount - The amount to calculate surcharge on
 * @param surchargePercent - Surcharge percentage (default 3%)
 * @returns Surcharge amount and new total
 */
export function calculateCCSurcharge(
  amount: number,
  surchargePercent: number = CC_SURCHARGE_RATE
): { surcharge: number; total: number } {
  const surcharge = roundToTwoDecimals(amount * (surchargePercent / 100))
  const total = roundToTwoDecimals(amount + surcharge)
  return { surcharge, total }
}

/**
 * Calculate full pricing with Quebec taxes and optional CC surcharge
 * @param subtotal - The subtotal before taxes
 * @param applyCCSurcharge - Whether to apply credit card surcharge
 * @param gstRate - GST rate (default 5%)
 * @param qstRate - QST rate (default 9.975%)
 * @param ccSurchargeRate - CC surcharge rate (default 3%)
 * @returns Full tax calculation with optional surcharge
 */
export function calculateFullPricing(
  subtotal: number,
  applyCCSurcharge: boolean = false,
  gstRate: number = QUEBEC_TAX_RATES.GST,
  qstRate: number = QUEBEC_TAX_RATES.QST,
  ccSurchargeRate: number = CC_SURCHARGE_RATE
): TaxCalculationWithSurcharge {
  const taxCalc = calculateQuebecTaxes(subtotal, gstRate, qstRate)

  let ccSurchargeAmount = 0
  let total = taxCalc.total

  if (applyCCSurcharge) {
    const surcharge = calculateCCSurcharge(taxCalc.total, ccSurchargeRate)
    ccSurchargeAmount = surcharge.surcharge
    total = surcharge.total
  }

  return {
    ...taxCalc,
    hasCCSurcharge: applyCCSurcharge,
    ccSurchargeRate: applyCCSurcharge ? ccSurchargeRate : 0,
    ccSurchargeAmount,
    total,
  }
}

/**
 * Round a number to two decimal places
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Format currency for display
 * @param amount - The amount to format
 * @param currency - Currency code (default CAD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format percentage for display
 * @param rate - The percentage rate
 * @returns Formatted percentage string
 */
export function formatPercentage(rate: number): string {
  return `${rate.toFixed(rate % 1 === 0 ? 0 : 3)}%`
}

/**
 * Calculate combined tax rate
 * @param gstRate - GST rate
 * @param qstRate - QST rate
 * @returns Combined tax rate
 */
export function getCombinedTaxRate(
  gstRate: number = QUEBEC_TAX_RATES.GST,
  qstRate: number = QUEBEC_TAX_RATES.QST
): number {
  return gstRate + qstRate
}
