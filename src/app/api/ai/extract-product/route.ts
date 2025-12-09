import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/ai/extract-product
 * Use AI to extract product information from page content
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'AI features not configured',
        message: 'OpenAI API key is not set.'
      }, { status: 503 })
    }

    const body = await request.json()
    const { url, pageContent, title, images } = body

    if (!pageContent && !url) {
      return NextResponse.json({ 
        success: false,
        error: 'Either URL or page content is required' 
      }, { status: 400 })
    }

    const openai = getOpenAI()

    // Build the prompt for product extraction
    const systemPrompt = `You are an expert at extracting product information from e-commerce and furniture/interior design product websites.
Your task is to analyze the provided page content and extract ONLY the MAIN PRODUCT details. 

IMPORTANT RULES:
- Focus on the PRIMARY product being sold on the page, ignore navigation, headers, footers, related products
- The product name should be the specific item name, NOT the website/brand name
- Only extract information that is clearly about the main product
- Be very accurate - if you're not sure about a field, leave it empty
- For dimensions, extract ALL dimension info you can find (W x D x H, or individual measurements)
- For prices, distinguish between RRP/retail and trade/wholesale prices
- Look for material composition, finish types, and color options
- Extract any lead time, delivery time, or stock availability info

Return ONLY a valid JSON object with this structure:

{
  "productName": "string - the specific product name (not the brand)",
  "brand": "string - brand or manufacturer name",
  "description": "string - product description focused on the item (max 500 chars)",
  "sku": "string - SKU, model number, article number, or product code",
  "price": "string - retail price with currency symbol (e.g., '$1,299.00' or '£850')",
  "tradePrice": "string - trade/wholesale price if shown",
  "material": "string - main material(s) of the product (e.g., 'Solid Oak', 'Velvet upholstery')",
  "colour": "string - color/colour of the product (e.g., 'Natural Oak', 'Midnight Blue')",
  "finish": "string - finish type (e.g., 'Matte Black', 'Brushed Brass', 'Lacquered')",
  "dimensions": {
    "width": "string - width with unit (e.g., '120cm' or '47 inches')",
    "height": "string - height with unit",
    "depth": "string - depth with unit",
    "length": "string - length with unit"
  },
  "leadTime": "string - delivery/lead time if mentioned (e.g., '4-6 weeks', 'In stock')",
  "notes": "string - other relevant product details like warranty, care instructions, certifications"
}

Only include fields where you found clear, accurate data. Omit fields if unsure.`

    const userMessage = `Extract the MAIN PRODUCT information from this page. Focus only on the primary product being sold.

URL: ${url || 'Not provided'}
Page Title: ${title || 'Not provided'}

Page Content (focus on product details, ignore navigation/headers):
${pageContent?.substring(0, 12000) || 'No content provided'}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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

    // Extract dimensions
    const dims = extractedData.dimensions || {}

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
        width: dims.width || '',
        height: dims.height || '',
        depth: dims.depth || '',
        length: dims.length || '',
        leadTime: extractedData.leadTime || '',
        notes: extractedData.notes || '',
        productWebsite: url || '',
        images: images || []
      }
    })

  } catch (error: any) {
    console.error('[AI Extract Product] Error:', error)

    if (error?.status === 429) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Please try again in a few moments.'
      }, { status: 429 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to extract product information',
      message: error?.message || 'An unexpected error occurred.'
    }, { status: 500 })
  }
}

