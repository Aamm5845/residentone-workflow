import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClaude, isClaudeConfigured } from '@/lib/server/claude'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface ExtractedItem {
  productName: string
  productNameOriginal?: string
  sku?: string
  quantity?: number
  unitPrice?: number
  totalPrice?: number
  brand?: string
  description?: string
  leadTime?: string
}

interface MatchResult {
  status: 'matched' | 'partial' | 'unmatched'
  confidence: number
  specItem?: {
    id: string
    name: string
    quantity: number
    sku?: string
    brand?: string
    imageUrl?: string
    roomName?: string
    existingSupplierId?: string
    existingSupplierName?: string
    existingTradePrice?: number
  }
  extractedItem: ExtractedItem
  suggestedMatches?: Array<{
    id: string
    name: string
    confidence: number
    roomName?: string
  }>
}

/**
 * POST /api/projects/[id]/procurement/manual-quote
 * Extract items from uploaded quote and match against All Spec items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { fileUrl, fileType, supplierId, supplierName } = body

    if (!fileUrl || !supplierId) {
      return NextResponse.json(
        { error: 'fileUrl and supplierId are required' },
        { status: 400 }
      )
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    // Get all FFE items for this project (All Spec items)
    const ffeItems = await prisma.roomFFEItem.findMany({
      where: {
        section: {
          instance: {
            room: { projectId }
          }
        },
        isSpecItem: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        modelNumber: true,
        brand: true,
        quantity: true,
        images: true,
        supplierId: true,
        supplierName: true,
        tradePrice: true,
        section: {
          select: {
            instance: {
              select: {
                room: {
                  select: {
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (ffeItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No spec items found',
        message: 'Please add items to All Specs before uploading a quote.'
      }, { status: 400 })
    }

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
    "shipping": "number - shipping/delivery charge if shown",
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
- ALWAYS look for and extract SKU, model number, or product codes
- If a field is not visible or unclear, omit it or set to null
- Be accurate - only extract what you can clearly read
- Include ALL line items, even accessories or small items
- Do NOT include shipping/handling/freight charges as line items`

    const specItemsList = ffeItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku || '',
      brand: item.brand || '',
      modelNumber: item.modelNumber || '',
      quantity: item.quantity,
      roomName: item.section?.instance?.room?.name || item.section?.instance?.room?.type || ''
    }))

    const userPrompt = `Please extract all line items and information from this supplier quote document.

These are the items in our All Specs (for your reference - use this to help identify matching products):
${specItemsList.map(item => `- ${item.name}${item.sku ? ` (SKU: ${item.sku})` : ''}${item.brand ? ` by ${item.brand}` : ''} - Qty: ${item.quantity}${item.roomName ? ` [${item.roomName}]` : ''}`).join('\n')}

Extract everything you can see in the quote document.`

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

    // Now match extracted items against All Spec items
    const matchResults: MatchResult[] = []
    const matchedSpecIds = new Set<string>()
    const extractedItems: ExtractedItem[] = extractedData.extractedItems || []

    // Try to match each extracted item to a spec item
    for (const extracted of extractedItems) {
      let bestMatch: typeof ffeItems[0] | null = null
      let bestConfidence = 0
      const allSuggestions: { id: string; name: string; confidence: number; roomName?: string }[] = []

      for (const specItem of ffeItems) {
        let confidence = 0
        let skuMatched = false
        let modelMatched = false

        // SKU matching (highest confidence - 70 points for exact match)
        if (extracted.sku && specItem.sku) {
          const extractedSku = normalize(extracted.sku)
          const specSku = normalize(specItem.sku)
          if (extractedSku === specSku) {
            confidence += 70
            skuMatched = true
          } else if (extractedSku.includes(specSku) || specSku.includes(extractedSku)) {
            confidence += 50
            skuMatched = true
          }
        }

        // Model number matching (also high confidence - 70 points)
        if (extracted.sku && specItem.modelNumber) {
          const extractedSku = normalize(extracted.sku)
          const specModel = normalize(specItem.modelNumber)
          if (extractedSku === specModel || extractedSku.includes(specModel) || specModel.includes(extractedSku)) {
            confidence += 70
            modelMatched = true
          }
        }

        // Brand matching (bonus points)
        if (extracted.brand && specItem.brand) {
          if (normalize(extracted.brand).includes(normalize(specItem.brand)) ||
              normalize(specItem.brand).includes(normalize(extracted.brand))) {
            confidence += 15
          }
        }

        // Name matching using word overlap (only if SKU/model didn't match)
        if (!skuMatched && !modelMatched) {
          const extractedWords = (extracted.productName || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
          const specWords = specItem.name.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          let keyWordMatches = 0
          for (const ew of extractedWords) {
            for (const sw of specWords) {
              if (wordsMatch(ew, sw)) {
                keyWordMatches++
                break
              }
            }
          }

          if (keyWordMatches >= 2) {
            confidence += 50
          } else if (keyWordMatches === 1 && (extractedWords.length <= 3 || specWords.length <= 3)) {
            confidence += 40
          } else if (keyWordMatches === 1) {
            confidence += 25
          }
        }

        // Track all matches above minimum threshold for suggestions
        if (confidence > 15) {
          allSuggestions.push({
            id: specItem.id,
            name: specItem.name,
            confidence: Math.min(100, Math.round(confidence)),
            roomName: specItem.section?.instance?.room?.name || specItem.section?.instance?.room?.type
          })
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence
          bestMatch = specItem
        }
      }

      // Sort suggestions by confidence
      allSuggestions.sort((a, b) => b.confidence - a.confidence)

      // Lower threshold if SKU/model matched (25), otherwise 35
      const matchThreshold = bestConfidence >= 50 ? 25 : 35

      if (bestMatch && bestConfidence >= matchThreshold) {
        matchedSpecIds.add(bestMatch.id)

        matchResults.push({
          status: bestConfidence >= 50 ? 'matched' : 'partial',
          confidence: Math.min(100, Math.round(bestConfidence)),
          specItem: {
            id: bestMatch.id,
            name: bestMatch.name,
            quantity: bestMatch.quantity,
            sku: bestMatch.sku || undefined,
            brand: bestMatch.brand || undefined,
            imageUrl: bestMatch.images?.[0] || undefined,
            roomName: bestMatch.room?.name || bestMatch.room?.type || undefined,
            existingSupplierId: bestMatch.supplierId || undefined,
            existingSupplierName: bestMatch.supplierName || undefined,
            existingTradePrice: bestMatch.tradePrice ? Number(bestMatch.tradePrice) : undefined
          },
          extractedItem: extracted,
          suggestedMatches: allSuggestions.slice(0, 5)
        })
      } else {
        // No good match - unmatched item
        matchResults.push({
          status: 'unmatched',
          confidence: 0,
          extractedItem: extracted,
          suggestedMatches: allSuggestions.slice(0, 5)
        })
      }
    }

    // Calculate summary stats
    const matched = matchResults.filter(r => r.status === 'matched').length
    const partial = matchResults.filter(r => r.status === 'partial').length
    const unmatched = matchResults.filter(r => r.status === 'unmatched').length

    return NextResponse.json({
      success: true,
      supplierInfo: extractedData.supplierInfo || {},
      matchResults,
      summary: {
        totalExtracted: extractedItems.length,
        matched,
        partial,
        unmatched,
        totalSpecItems: ffeItems.length
      },
      notes: extractedData.notes || null,
      // Pass through for later use
      supplierId,
      supplierName,
      fileUrl
    })

  } catch (error: any) {
    console.error('[Manual Quote] Error:', error)

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
