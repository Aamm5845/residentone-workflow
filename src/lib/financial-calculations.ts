/**
 * Financial Calculations for Procurement Profit & Tax Tracking
 *
 * Key Rules:
 * - Profit = confirmed client payments received - supplier payments made
 * - GST (5%) and QST (9.975%) tracked separately
 * - Order.taxAmount stores combined tax — must be split by ratio
 */

import { roundCurrency } from './pricing'

const DEFAULT_GST_RATE = 5.0
const DEFAULT_QST_RATE = 9.975

/**
 * Calculate procurement profit from confirmed payments and supplier costs
 */
export function calculateProjectProfit(paidRevenue: number, supplierCosts: number): number {
  return roundCurrency(paidRevenue - supplierCosts)
}

/**
 * Calculate profit margin as a percentage
 * Returns 0 if revenue is 0
 */
export function calculateMargin(profit: number, revenue: number): number {
  if (revenue === 0) return 0
  return roundCurrency((profit / revenue) * 100)
}

/**
 * Split a combined tax amount into GST and QST portions
 * Order.taxAmount stores combined tax — this splits it by the standard ratio
 */
export function splitTax(
  combinedTax: number,
  gstRate: number = DEFAULT_GST_RATE,
  qstRate: number = DEFAULT_QST_RATE
): { gst: number; qst: number } {
  if (combinedTax === 0) return { gst: 0, qst: 0 }

  const totalRate = gstRate + qstRate
  if (totalRate === 0) return { gst: 0, qst: 0 }

  const gst = roundCurrency((combinedTax * gstRate) / totalRate)
  const qst = roundCurrency(combinedTax - gst) // Use subtraction to avoid rounding errors

  return { gst, qst }
}
