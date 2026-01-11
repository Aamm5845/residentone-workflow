/**
 * Centralized Pricing Calculations
 *
 * This is the SINGLE SOURCE OF TRUTH for all price calculations in the application.
 * All components, APIs, and pages should use these functions to ensure consistency.
 *
 * Key Rules:
 * 1. Components have their own quantity - NOT multiplied by parent item quantity
 * 2. For RRP calculations, markup is applied to components
 * 3. For Trade Price calculations, components are added without markup
 * 4. Currency (CAD/USD) must always be tracked separately
 */

export interface PricingItem {
  rrp?: number | null
  tradePrice?: number | null
  quantity?: number | null
  rrpCurrency?: string | null
  tradePriceCurrency?: string | null
  markupPercent?: number | null
  componentsTotal?: number | null // Raw component total (without markup)
}

export interface ComponentItem {
  price?: number | null
  quantity?: number | null
}

export interface PricingTotals {
  cadTotal: number
  usdTotal: number
}

/**
 * Calculate the raw components total (sum of component prices × their quantities)
 * Components have their own quantity - NOT multiplied by parent item quantity
 */
export function calculateComponentsTotal(components: ComponentItem[]): number {
  return (components || []).reduce((sum, c) => {
    const price = c.price ? Number(c.price) : 0
    const qty = c.quantity || 1
    return sum + (price * qty)
  }, 0)
}

/**
 * Calculate components total with markup applied (for RRP display)
 */
export function calculateComponentsRRP(components: ComponentItem[], markupPercent: number): number {
  const rawTotal = calculateComponentsTotal(components)
  return rawTotal * (1 + (markupPercent || 0) / 100)
}

/**
 * Calculate the total RRP for a single item (includes components with markup)
 * Formula: (item.rrp × quantity) + (componentsTotal × (1 + markup/100))
 */
export function calculateItemRRPTotal(item: PricingItem, rawComponentsTotal?: number): number {
  const price = item.rrp ?? item.tradePrice ?? 0
  const qty = item.quantity || 1
  const componentsPrice = rawComponentsTotal ?? item.componentsTotal ?? 0
  const markupPercent = item.markupPercent || 0

  // Apply markup to components for RRP
  const componentsRRP = componentsPrice * (1 + markupPercent / 100)

  return (Number(price) * qty) + componentsRRP
}

/**
 * Calculate the total Trade Price for a single item (includes components without markup)
 * Formula: (item.tradePrice × quantity) + componentsTotal
 */
export function calculateItemTradeTotal(item: PricingItem, rawComponentsTotal?: number): number {
  const price = item.tradePrice ?? item.rrp ?? 0
  const qty = item.quantity || 1
  const componentsPrice = rawComponentsTotal ?? item.componentsTotal ?? 0

  return (Number(price) * qty) + componentsPrice
}

/**
 * Calculate RRP totals separated by currency (CAD and USD)
 * This is the standard calculation used across Financial Tab, Share Links, etc.
 */
export function calculateRRPTotals(items: PricingItem[]): PricingTotals {
  const cadTotal = items.reduce((sum, item) => {
    const currency = item.rrpCurrency || 'CAD'
    if (currency !== 'CAD') return sum
    return sum + calculateItemRRPTotal(item)
  }, 0)

  const usdTotal = items.reduce((sum, item) => {
    const currency = item.rrpCurrency || 'CAD'
    if (currency !== 'USD') return sum
    return sum + calculateItemRRPTotal(item)
  }, 0)

  return { cadTotal, usdTotal }
}

/**
 * Calculate Trade Price totals separated by currency (CAD and USD)
 */
export function calculateTradeTotals(items: PricingItem[]): PricingTotals {
  const cadTotal = items.reduce((sum, item) => {
    const currency = item.tradePriceCurrency || item.rrpCurrency || 'CAD'
    if (currency !== 'CAD') return sum
    return sum + calculateItemTradeTotal(item)
  }, 0)

  const usdTotal = items.reduce((sum, item) => {
    const currency = item.tradePriceCurrency || item.rrpCurrency || 'CAD'
    if (currency !== 'USD') return sum
    return sum + calculateItemTradeTotal(item)
  }, 0)

  return { cadTotal, usdTotal }
}

/**
 * Calculate RRP from Trade Price using markup percentage
 */
export function calculateRRPFromMarkup(tradePrice: number, markupPercent: number): number {
  return tradePrice * (1 + markupPercent / 100)
}

/**
 * Calculate Trade Price from RRP using trade discount percentage
 */
export function calculateTradePriceFromDiscount(rrp: number, discountPercent: number): number {
  return rrp * (1 - discountPercent / 100)
}

/**
 * Calculate markup percentage from Trade Price and RRP
 */
export function calculateMarkupPercent(tradePrice: number, rrp: number): number {
  if (!tradePrice || tradePrice === 0) return 0
  return ((rrp - tradePrice) / tradePrice) * 100
}

/**
 * Calculate trade discount percentage from Trade Price and RRP
 */
export function calculateDiscountPercent(tradePrice: number, rrp: number): number {
  if (!rrp || rrp === 0) return 0
  return ((rrp - tradePrice) / rrp) * 100
}

/**
 * Format currency value for display
 */
export function formatCurrency(value: number | null | undefined, currency: string = 'CAD'): string {
  if (value === null || value === undefined) return '-'
  const currencyCode = currency === 'USD' ? 'USD' : 'CAD'
  const locale = currency === 'USD' ? 'en-US' : 'en-CA'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Round to 2 decimal places for currency precision
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
