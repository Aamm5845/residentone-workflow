import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * DEPRECATED: Stripe webhooks are no longer used
 *
 * This endpoint was previously used for Stripe payment webhooks.
 * The system now uses Solo Payments (Cardknox) which processes
 * transactions synchronously - no webhooks needed.
 *
 * Solo returns the transaction result immediately in the API response,
 * so we don't need async notification of payment status.
 *
 * This file is kept for backwards compatibility in case any old
 * webhook configurations still point here.
 */
export async function POST(request: NextRequest) {
  console.log('[Deprecated] Stripe webhook endpoint called but is no longer in use')

  return NextResponse.json({
    message: 'Stripe webhooks are deprecated. System now uses Solo Payments.',
    received: true
  })
}
