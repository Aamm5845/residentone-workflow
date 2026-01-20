import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * DEPRECATED: Stripe hosted checkout is no longer used
 *
 * This endpoint was previously used to create Stripe Checkout sessions.
 * The system now uses Solo Payments with embedded iFields forms.
 *
 * Payments should be processed through:
 * - Client Portal: /api/client-portal/[token]/pay
 * - Quote Token: /api/quote/[token]/payment
 *
 * These routes use the SoloPaymentForm component with iFields for
 * secure card collection directly on our site.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error: 'Stripe checkout is no longer available',
      message: 'Please use the client portal payment flow instead',
      deprecated: true
    },
    { status: 410 } // 410 Gone
  )
}
