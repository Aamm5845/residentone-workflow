import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/solo-config
 * Debug endpoint to check Solo payment configuration
 * REMOVE THIS IN PRODUCTION
 */
export async function GET() {
  const apiKey = process.env.SOLO_API_KEY
  const iFieldsKey = process.env.NEXT_PUBLIC_SOLO_IFIELDS_KEY

  return NextResponse.json({
    configured: !!apiKey && !!iFieldsKey,
    apiKey: apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT SET',
    iFieldsKey: iFieldsKey ? `${iFieldsKey.substring(0, 20)}...` : 'NOT SET',
    apiKeyLength: apiKey?.length || 0,
    iFieldsKeyLength: iFieldsKey?.length || 0,
    // Check format
    iFieldsKeyFormat: iFieldsKey?.startsWith('ifields_') ? 'VALID (starts with ifields_)' : 'INVALID (should start with ifields_)'
  })
}
