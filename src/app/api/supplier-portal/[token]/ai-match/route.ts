import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Longer timeout for AI processing

interface ExtractedItem {
  productName: string
  sku?: string
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  brand?: string
  description?: string
  leadTime?: string
}

interface MatchResult {
  status: 'matched' | 'partial' | 'missing' | 'extra'
  confidence: number
  rfqItem?: {
    id: string
    itemName: string
    quantity: number
    sku?: string
    brand?: string
  }
  extractedItem?: ExtractedItem
  discrepancies?: string[]
}

/**
 * POST /api/supplier-portal/[token]/ai-match
 * Use AI to analyze uploaded supplier quote and match against RFQ items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'AI features not configured',
        message: 'OpenAI API key is not set.'
      }, { status: 503 })
    }

    // Validate token and get RFQ data
    const supplierRFQ = await prisma.supplierRFQ.findFirst({
      where: {
        accessToken: token,
        tokenExpiresAt: { gte: new Date() }
      },
      include: {
        rfq: {
          include: {
            lineItems: {
              include: {
                roomFFEItem: {
                  select: {
                    sku: true,
                    brand: true,
                    modelNumber: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    const body = await request.json()
    const { fileUrl, fileType } = body

    if (!fileUrl) {
      return NextResponse.json({ error: 'File URL is required' }, { status: 400 })
    }

    // Get the OpenAI client
    const openai = getOpenAI()

    // Build the RFQ items list for context
    const rfqItems = supplierRFQ.rfq.lineItems.map(item => ({
      id: item.id,
      itemName: item.itemName,
      quantity: item.quantity,
      sku: item.roomFFEItem?.sku || '',
      brand: item.roomFFEItem?.brand || '',
      modelNumber: item.roomFFEItem?.modelNumber || ''
    }))

    // Create the extraction prompt
    const systemPrompt = `You are an expert at reading supplier quotes and invoices. Your task is to:
1. Extract ALL line items from the uploaded quote document
2. For each item, extract: product name, SKU/model number, quantity, unit price, total price, brand, and any lead time mentioned
3. Be thorough - don't miss any items even if the formatting is unusual

Return a JSON object with this structure:
{
  "supplierInfo": {
    "companyName": "string - supplier company name if visible",
    "quoteNumber": "string - quote/invoice number if visible",
    "quoteDate": "string - date on the quote if visible",
    "validUntil": "string - quote validity date if mentioned",
    "subtotal": "number - subtotal before tax if shown",
    "taxes": "number - tax amount if shown",
    "total": "number - grand total if shown"
  },
  "extractedItems": [
    {
      "productName": "string - full product name",
      "sku": "string - SKU, model number, or product code",
      "quantity": "number - quantity ordered",
      "unitPrice": "number - price per unit (no currency symbol)",
      "totalPrice": "number - line total (no currency symbol)",
      "brand": "string - brand name if mentioned",
      "description": "string - any additional description",
      "leadTime": "string - delivery/lead time if mentioned"
    }
  ],
  "notes": "string - any important notes from the quote (terms, conditions, special instructions)"
}

Important:
- Extract prices as numbers only (no $ or currency symbols)
- If a field is not visible or unclear, omit it or set to null
- Be accurate - only extract what you can clearly read
- Include ALL line items, even accessories or small items`

    const userPrompt = `Please extract all line items and information from this supplier quote document.

These are the items we requested (for your reference - use this to help identify matching products):
${rfqItems.map(item => `- ${item.itemName}${item.sku ? ` (SKU: ${item.sku})` : ''}${item.brand ? ` by ${item.brand}` : ''} - Qty: ${item.quantity}`).join('\n')}

Extract everything you can see in the quote, including any items that might not be in our request.`

    // Call GPT-4 Vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: fileUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })

    if (!completion.choices || !completion.choices[0]?.message?.content) {
      return NextResponse.json({
        success: false,
        error: 'Failed to analyze document',
        message: 'The AI could not read the document. Please try a clearer image.'
      }, { status: 500 })
    }

    let extractedData
    try {
      extractedData = JSON.parse(completion.choices[0].message.content)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        message: 'The AI response was not in the expected format.'
      }, { status: 500 })
    }

    // Now match extracted items against RFQ items
    const matchResults: MatchResult[] = []
    const matchedRfqIds = new Set<string>()
    const extractedItems = extractedData.extractedItems || []

    // Try to match each extracted item to an RFQ item
    for (const extracted of extractedItems) {
      let bestMatch: typeof rfqItems[0] | null = null
      let bestConfidence = 0
      const discrepancies: string[] = []

      for (const rfqItem of rfqItems) {
        let confidence = 0

        // SKU matching (highest confidence)
        if (extracted.sku && rfqItem.sku) {
          const extractedSku = extracted.sku.toLowerCase().replace(/[^a-z0-9]/g, '')
          const rfqSku = rfqItem.sku.toLowerCase().replace(/[^a-z0-9]/g, '')
          if (extractedSku === rfqSku) {
            confidence += 50
          } else if (extractedSku.includes(rfqSku) || rfqSku.includes(extractedSku)) {
            confidence += 30
          }
        }

        // Brand matching
        if (extracted.brand && rfqItem.brand) {
          if (extracted.brand.toLowerCase().includes(rfqItem.brand.toLowerCase()) ||
              rfqItem.brand.toLowerCase().includes(extracted.brand.toLowerCase())) {
            confidence += 15
          }
        }

        // Name matching using word overlap
        const extractedWords = extracted.productName.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
        const rfqWords = rfqItem.itemName.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        const matchingWords = extractedWords.filter((w: string) =>
          rfqWords.some(rw => rw.includes(w) || w.includes(rw))
        )
        const nameConfidence = (matchingWords.length / Math.max(extractedWords.length, rfqWords.length)) * 35
        confidence += nameConfidence

        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestMatch = rfqItem
        }
      }

      // Check for discrepancies if we have a match
      if (bestMatch && bestConfidence >= 30) {
        matchedRfqIds.add(bestMatch.id)

        // Quantity discrepancy
        if (extracted.quantity && extracted.quantity !== bestMatch.quantity) {
          discrepancies.push(`Quantity: requested ${bestMatch.quantity}, quoted ${extracted.quantity}`)
        }

        matchResults.push({
          status: bestConfidence >= 50 ? 'matched' : 'partial',
          confidence: Math.min(100, Math.round(bestConfidence)),
          rfqItem: bestMatch,
          extractedItem: extracted,
          discrepancies: discrepancies.length > 0 ? discrepancies : undefined
        })
      } else {
        // No good match - this is an extra item
        matchResults.push({
          status: 'extra',
          confidence: 0,
          extractedItem: extracted
        })
      }
    }

    // Find missing items (RFQ items not matched)
    for (const rfqItem of rfqItems) {
      if (!matchedRfqIds.has(rfqItem.id)) {
        matchResults.push({
          status: 'missing',
          confidence: 0,
          rfqItem: rfqItem
        })
      }
    }

    // Calculate summary stats
    const matched = matchResults.filter(r => r.status === 'matched').length
    const partial = matchResults.filter(r => r.status === 'partial').length
    const missing = matchResults.filter(r => r.status === 'missing').length
    const extra = matchResults.filter(r => r.status === 'extra').length

    return NextResponse.json({
      success: true,
      supplierInfo: extractedData.supplierInfo || {},
      matchResults,
      summary: {
        totalRequested: rfqItems.length,
        matched,
        partial,
        missing,
        extra,
        extractedTotal: extractedItems.length,
        quoteTotal: extractedData.supplierInfo?.total || null
      },
      notes: extractedData.notes || null
    })

  } catch (error: any) {
    console.error('[AI Match Quote] Error:', error)

    if (error?.status === 429) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Please try again in a few moments.'
      }, { status: 429 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to analyze quote',
      message: error?.message || 'An unexpected error occurred.'
    }, { status: 500 })
  }
}
