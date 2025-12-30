import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'
import { getClaude, isClaudeConfigured } from '@/lib/server/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120 // Longer timeout for PDF processing

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
  // For unmatched extracted items, suggest closest RFQ items
  suggestedMatches?: {
    id: string
    itemName: string
    confidence: number
  }[]
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

    const isPDF = fileType === 'application/pdf'
    const isImage = fileType?.startsWith('image/')

    // Check if appropriate AI is configured
    if (isPDF && !isClaudeConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'PDF analysis not configured',
        message: 'Claude API key is required for PDF analysis.'
      }, { status: 503 })
    }

    if (isImage && !isOpenAIConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Image analysis not configured',
        message: 'OpenAI API key is not set.'
      }, { status: 503 })
    }

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
    const systemPrompt = `You are an expert at reading supplier quotes and invoices. The document may be in French or English. Your task is to:
1. Extract ALL line items from the uploaded quote document
2. For each item, extract: product name (translate to English if French), SKU/model number, quantity, unit price, total price, brand, and any lead time mentioned
3. Be thorough - don't miss any items even if the formatting is unusual
4. IMPORTANT: Always extract SKU, model numbers, product codes - these are critical for matching

Return a JSON object with this structure:
{
  "supplierInfo": {
    "companyName": "string - supplier company name if visible",
    "quoteNumber": "string - quote/invoice number if visible",
    "quoteDate": "string - date on the quote if visible",
    "validUntil": "string - quote validity date if mentioned",
    "subtotal": "number - subtotal before tax if shown",
    "shipping": "number - shipping/delivery/freight charge if shown (IMPORTANT: look for Shipping, Delivery, Freight, Transport lines)",
    "taxes": "number - tax amount if shown",
    "total": "number - grand total if shown"
  },
  "extractedItems": [
    {
      "productName": "string - full product name in English (translate if needed)",
      "productNameOriginal": "string - original product name if different language",
      "sku": "string - SKU, model number, or product code (VERY IMPORTANT)",
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
- If document is in French, translate product names to English
- ALWAYS look for and extract SKU, model number, or product codes - they often appear near the product name
- ALWAYS look for shipping/delivery/freight charges - they are usually near the subtotal/total section
- If a field is not visible or unclear, omit it or set to null
- Be accurate - only extract what you can clearly read
- Include ALL line items, even accessories or small items`

    const userPrompt = `Please extract all line items and information from this supplier quote document.

These are the items we requested (for your reference - use this to help identify matching products):
${rfqItems.map(item => `- ${item.itemName}${item.sku ? ` (SKU: ${item.sku})` : ''}${item.brand ? ` by ${item.brand}` : ''} - Qty: ${item.quantity}`).join('\n')}

Extract everything you can see in the quote, including any items that might not be in our request.`

    let extractedData: any

    if (isPDF) {
      // Use Claude for PDF analysis
      const claude = getClaude()

      // Fetch the PDF file and convert to base64
      const pdfResponse = await fetch(fileUrl)
      if (!pdfResponse.ok) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch PDF',
          message: 'Could not download the PDF file for analysis.'
        }, { status: 500 })
      }

      const pdfBuffer = await pdfResponse.arrayBuffer()
      const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

      // Call Claude with PDF
      const claudeResponse = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64
                }
              },
              {
                type: 'text',
                text: `${systemPrompt}\n\n${userPrompt}\n\nRespond with ONLY the JSON object, no other text.`
              }
            ]
          }
        ]
      })

      const claudeContent = claudeResponse.content[0]
      if (claudeContent.type !== 'text') {
        return NextResponse.json({
          success: false,
          error: 'Failed to analyze PDF',
          message: 'The AI could not read the PDF document.'
        }, { status: 500 })
      }

      try {
        // Extract JSON from response (Claude may include markdown code blocks)
        let jsonStr = claudeContent.text
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          jsonStr = jsonMatch[1]
        }
        extractedData = JSON.parse(jsonStr.trim())
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Failed to parse AI response',
          message: 'The AI response was not in the expected format.'
        }, { status: 500 })
      }

    } else {
      // Use OpenAI GPT-4o for images
      const openai = getOpenAI()

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

      try {
        extractedData = JSON.parse(completion.choices[0].message.content)
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Failed to parse AI response',
          message: 'The AI response was not in the expected format.'
        }, { status: 500 })
      }
    }

    // Helper function to normalize strings for comparison
    const normalize = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

    // Helper function to check if words match (fuzzy)
    const wordsMatch = (word1: string, word2: string) => {
      const w1 = normalize(word1)
      const w2 = normalize(word2)
      if (w1.length < 3 || w2.length < 3) return false
      return w1 === w2 || w1.includes(w2) || w2.includes(w1)
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
        let skuMatched = false
        let modelMatched = false

        // SKU matching (highest confidence - 70 points for exact match)
        if (extracted.sku && rfqItem.sku) {
          const extractedSku = normalize(extracted.sku)
          const rfqSku = normalize(rfqItem.sku)
          if (extractedSku === rfqSku) {
            confidence += 70
            skuMatched = true
          } else if (extractedSku.includes(rfqSku) || rfqSku.includes(extractedSku)) {
            confidence += 50
            skuMatched = true
          }
        }

        // Model number matching (also high confidence - 70 points)
        if (extracted.sku && rfqItem.modelNumber) {
          const extractedSku = normalize(extracted.sku)
          const rfqModel = normalize(rfqItem.modelNumber)
          if (extractedSku === rfqModel || extractedSku.includes(rfqModel) || rfqModel.includes(extractedSku)) {
            confidence += 70
            modelMatched = true
          }
        }

        // Brand matching (bonus points)
        if (extracted.brand && rfqItem.brand) {
          if (normalize(extracted.brand).includes(normalize(rfqItem.brand)) ||
              normalize(rfqItem.brand).includes(normalize(extracted.brand))) {
            confidence += 15
          }
        }

        // Name matching using word overlap (only if SKU/model didn't match)
        // This helps match items like "Porter Ottoman" -> "Ottoman"
        if (!skuMatched && !modelMatched) {
          const extractedWords = (extracted.productName || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
          const rfqWords = rfqItem.itemName.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          // Check for key word matches (like "ottoman", "chair", "sofa")
          let keyWordMatches = 0
          for (const ew of extractedWords) {
            for (const rw of rfqWords) {
              if (wordsMatch(ew, rw)) {
                keyWordMatches++
                break
              }
            }
          }

          // Give higher confidence if multiple words match
          if (keyWordMatches >= 2) {
            confidence += 50
          } else if (keyWordMatches === 1 && (extractedWords.length <= 3 || rfqWords.length <= 3)) {
            // For short product names, one match is enough
            confidence += 40
          } else if (keyWordMatches === 1) {
            confidence += 25
          }
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestMatch = rfqItem
        }
      }

      // Lower threshold if SKU/model matched (25), otherwise 35
      const matchThreshold = bestConfidence >= 50 ? 25 : 35

      // Check for discrepancies if we have a match
      if (bestMatch && bestConfidence >= matchThreshold) {
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
        // Find closest possible matches to suggest
        const suggestions: { id: string; itemName: string; confidence: number }[] = []

        for (const rfqItem of rfqItems) {
          if (matchedRfqIds.has(rfqItem.id)) continue // Skip already matched items

          let score = 0
          const extractedWords = (extracted.productName || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
          const rfqWords = rfqItem.itemName.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          for (const ew of extractedWords) {
            for (const rw of rfqWords) {
              if (wordsMatch(ew, rw)) {
                score += 20
              }
            }
          }

          if (score > 0) {
            suggestions.push({
              id: rfqItem.id,
              itemName: rfqItem.itemName,
              confidence: Math.min(score, 60)
            })
          }
        }

        // Sort by confidence and take top 3
        suggestions.sort((a, b) => b.confidence - a.confidence)

        matchResults.push({
          status: 'extra',
          confidence: 0,
          extractedItem: extracted,
          suggestedMatches: suggestions.slice(0, 3)
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

    // Count items with quantity discrepancies
    const quantityDiscrepancies = matchResults.filter(r =>
      r.discrepancies?.some(d => d.toLowerCase().includes('quantity'))
    ).length

    // Detect if taxes are included in quote
    const hasTaxes = extractedData.supplierInfo?.taxes && extractedData.supplierInfo.taxes > 0

    // Calculate expected total from extracted items
    const calculatedTotal = extractedItems.reduce((sum: number, item: ExtractedItem) =>
      sum + (item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1)), 0
    )
    const quoteTotal = extractedData.supplierInfo?.total || 0
    const totalDiscrepancy = quoteTotal > 0 && calculatedTotal > 0
      ? Math.abs(quoteTotal - calculatedTotal) > 1 // More than $1 difference
      : false

    // Check for shipping/delivery info
    const hasShippingFee = extractedData.supplierInfo?.deliveryFee && extractedData.supplierInfo.deliveryFee > 0

    // Collect all discrepancy messages
    const allDiscrepancies: string[] = []
    matchResults.forEach(r => {
      if (r.discrepancies) {
        allDiscrepancies.push(...r.discrepancies)
      }
    })

    // Log AI match results for email notifications
    await prisma.supplierAccessLog.create({
      data: {
        supplierRFQId: supplierRFQ.id,
        action: 'AI_MATCH',
        metadata: {
          totalRequested: rfqItems.length,
          matched,
          partial,
          missing,
          extra,
          extractedTotal: extractedItems.length,
          hasTaxes,
          hasShippingFee,
          shippingFee: extractedData.supplierInfo?.deliveryFee || 0,
          quoteTotal,
          calculatedTotal,
          totalDiscrepancy,
          quantityDiscrepancies,
          discrepancyMessages: allDiscrepancies,
          fileType: fileType || 'unknown'
        }
      }
    })

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
        quoteTotal: extractedData.supplierInfo?.total || null,
        hasTaxes
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
