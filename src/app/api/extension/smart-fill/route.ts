import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

// Configure Next.js route
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Helper to get authenticated user from extension API key
async function getAuthenticatedUser(request: NextRequest) {
  // Check for extension API key
  const apiKey = request.headers.get('X-Extension-Key')
  
  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true
      },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    })
    
    if (token) {
      // Update last accessed
      await prisma.clientAccessToken.update({
        where: { id: token.id },
        data: { 
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 }
        }
      })
      
      return {
        organizationId: token.project.organizationId,
        userId: token.createdById
      }
    }
  }
  
  return null
}

/**
 * POST /api/extension/smart-fill
 * Use AI to extract product information from page content
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        error: 'AI features not configured',
        message: 'OpenAI API key is not set.'
      }, { status: 503 })
    }

    const body = await request.json()
    const { url, pageContent, title, images } = body

    if (!pageContent && !url) {
      return NextResponse.json({ 
        error: 'Either URL or page content is required' 
      }, { status: 400 })
    }

    const openai = getOpenAI()

    // Filter out common non-product images (logos, icons, etc)
    const productImages = (images || []).filter((img: string) => {
      const lowerImg = img.toLowerCase()
      // Exclude common non-product image patterns
      if (lowerImg.includes('logo')) return false
      if (lowerImg.includes('icon')) return false
      if (lowerImg.includes('favicon')) return false
      if (lowerImg.includes('sprite')) return false
      if (lowerImg.includes('avatar')) return false
      if (lowerImg.includes('placeholder')) return false
      if (lowerImg.includes('loading')) return false
      if (lowerImg.includes('banner')) return false
      if (lowerImg.includes('header')) return false
      if (lowerImg.includes('footer')) return false
      if (lowerImg.includes('social')) return false
      if (lowerImg.includes('payment')) return false
      if (lowerImg.includes('badge')) return false
      if (lowerImg.includes('/assets/') && !lowerImg.includes('product')) return false
      // Exclude very small images (likely icons)
      if (lowerImg.includes('16x16') || lowerImg.includes('32x32') || lowerImg.includes('48x48')) return false
      return true
    })

    // Build the prompt for product extraction
    const systemPrompt = `You are an expert at extracting product information from e-commerce and furniture/interior design product websites.
Your task is to analyze the provided page content and extract ONLY the MAIN PRODUCT details. 

IMPORTANT RULES:
- Focus on the PRIMARY product being sold on the page, ignore navigation, headers, footers, related products
- The product name should be the specific item name, NOT the website/brand name
- Only extract information that is clearly about the main product
- Do NOT include site logos, brand logos, or icons as product images
- Be very accurate - if you're not sure about a field, leave it empty
- For dimensions, only include if they are clearly specified for this product

Return ONLY a valid JSON object with this structure:

{
  "productName": "string - the specific product name (not the brand)",
  "brand": "string - brand or manufacturer name",
  "description": "string - product description focused on the item (max 500 chars)",
  "sku": "string - SKU, model number, article number, or product code",
  "price": "string - retail price with currency symbol",
  "tradePrice": "string - trade/wholesale price if shown",
  "material": "string - main material(s) of the product",
  "colour": "string - color/colour of the product",
  "finish": "string - finish type (e.g., matte, gloss, brushed, natural)",
  "dimensions": {
    "width": "string - width with unit (e.g., '120cm')",
    "height": "string - height with unit",
    "depth": "string - depth with unit",
    "length": "string - length with unit"
  },
  "leadTime": "string - delivery/lead time if mentioned",
  "notes": "string - other relevant product details"
}

Only include fields where you found clear, accurate data. Omit fields if unsure.`

    const userMessage = `Extract the MAIN PRODUCT information from this page. Focus only on the primary product being sold.

URL: ${url || 'Not provided'}
Page Title: ${title || 'Not provided'}

Page Content (focus on product details, ignore navigation/headers):
${pageContent?.substring(0, 10000) || 'No content provided'}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use mini for faster/cheaper extraction
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    
    let extractedData
    try {
      extractedData = JSON.parse(responseText)
    } catch {
      extractedData = {}
    }

    return NextResponse.json({
      success: true,
      data: {
        productName: extractedData.productName || '',
        brand: extractedData.brand || '',
        productDescription: extractedData.description || '',
        sku: extractedData.sku || '',
        rrp: extractedData.price || '',
        tradePrice: extractedData.tradePrice || '',
        material: extractedData.material || '',
        colour: extractedData.colour || '',
        finish: extractedData.finish || '',
        width: extractedData.dimensions?.width || '',
        height: extractedData.dimensions?.height || '',
        depth: extractedData.dimensions?.depth || '',
        length: extractedData.dimensions?.length || '',
        leadTime: extractedData.leadTime || '',
        notes: extractedData.notes || '',
        productWebsite: url || '',
        // Return filtered product images
        images: productImages.slice(0, 10)
      },
      meta: {
        model: completion.model,
        tokensUsed: completion.usage?.total_tokens
      }
    })

  } catch (error: any) {
    console.error('[Extension Smart Fill] Error:', error)

    if (error?.status === 429) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Please try again in a few moments.'
      }, { status: 429 })
    }

    return NextResponse.json({
      error: 'Failed to extract product information',
      message: error?.message || 'An unexpected error occurred.'
    }, { status: 500 })
  }
}
