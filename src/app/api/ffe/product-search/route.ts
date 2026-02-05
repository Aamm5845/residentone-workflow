import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import {
  searchProducts,
  isGoogleSearchConfigured,
  getConfigurationStatus,
  type ProductSearchResult
} from '@/lib/server/google-search'

// Configure Next.js route
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rate limiting - allow more frequent product searches than AI analysis
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute window
const RATE_LIMIT_MAX_CALLS = 10 // 10 searches per minute per user

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_CALLS) {
    return false
  }

  record.count++
  return true
}

// Cleanup old rate limit entries periodically
function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

interface ProductSearchRequest {
  itemName: string
  description?: string
  category?: string
}

interface ProductSearchResponse {
  success: boolean
  query?: string
  results?: ProductSearchResult[]
  error?: string
  message?: string
}

/**
 * POST /api/ffe/product-search
 * Search for products matching an FFE item
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ProductSearchResponse>> {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Check if Google Search is configured
    if (!isGoogleSearchConfigured()) {
      const status = getConfigurationStatus()
      console.warn('[Product Search] Not configured:', status)
      return NextResponse.json({
        success: false,
        error: 'Product search not configured',
        message: 'Google Custom Search API is not configured. Contact your administrator.'
      }, { status: 503 })
    }

    // 3. Rate limiting
    const userId = (session.user as any).id || session.user.email || 'anonymous'
    const rateLimitKey = `product-search:${userId}`

    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many search requests. Please wait a moment before trying again.'
      }, { status: 429 })
    }

    // Cleanup old entries occasionally
    if (Math.random() < 0.1) {
      cleanupRateLimits()
    }

    // 4. Parse request body
    const body: ProductSearchRequest = await request.json()

    if (!body.itemName || typeof body.itemName !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid request',
        message: 'itemName is required'
      }, { status: 400 })
    }

    // Sanitize inputs
    const itemName = body.itemName.trim().slice(0, 200) // Limit length
    const description = body.description?.trim().slice(0, 500)
    const category = body.category?.trim().slice(0, 100)

    if (itemName.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request',
        message: 'itemName cannot be empty'
      }, { status: 400 })
    }

    // 5. Search for products
    console.log(`[Product Search] Searching for: "${itemName}"`)

    const { results, query } = await searchProducts(itemName, description, category)

    console.log(`[Product Search] Found ${results.length} results for query: "${query}"`)

    return NextResponse.json({
      success: true,
      query,
      results
    })

  } catch (error: any) {
    console.error('[Product Search] Error:', error)

    // Handle specific error types
    if (error.message?.includes('rate limit')) {
      return NextResponse.json({
        success: false,
        error: 'Search rate limit',
        message: 'Too many searches. Please wait and try again.'
      }, { status: 429 })
    }

    if (error.message?.includes('access denied')) {
      return NextResponse.json({
        success: false,
        error: 'Configuration error',
        message: 'Product search service is temporarily unavailable.'
      }, { status: 503 })
    }

    return NextResponse.json({
      success: false,
      error: 'Search failed',
      message: error?.message || 'An unexpected error occurred during product search.'
    }, { status: 500 })
  }
}

/**
 * GET /api/ffe/product-search
 * Check if product search is available
 */
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = isGoogleSearchConfigured()

  return NextResponse.json({
    available: configured,
    message: configured
      ? 'Product search is available'
      : 'Product search is not configured'
  })
}
