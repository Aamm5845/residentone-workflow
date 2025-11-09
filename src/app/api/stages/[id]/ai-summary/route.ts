import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'
import { 
  prepareDesignData, 
  buildChatMessages, 
  getSystemPrompt,
  getEmptyStageSummary 
} from '@/lib/server/aiSummaryPrompt'

// Configure Next.js route
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // 30 second timeout for Vercel

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 10000 // 10 seconds (reduced for testing)
const RATE_LIMIT_MAX_CALLS = 1 // 1 call per 10 seconds per stage+user

/**
 * Check if request is rate limited
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const lastCall = rateLimitMap.get(key)
  
  if (lastCall && (now - lastCall) < RATE_LIMIT_WINDOW_MS) {
    return false // Rate limited
  }
  
  rateLimitMap.set(key, now)
  
  // Cleanup old entries (every 100 requests)
  if (rateLimitMap.size > 100) {
    for (const [k, v] of rateLimitMap.entries()) {
      if ((now - v) > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(k)
      }
    }
  }
  
  return true // Allowed
}

/**
 * GET /api/stages/[id]/ai-summary
 * Generate an AI summary of the design concept items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { 
          error: 'AI features not configured',
          message: 'OpenAI API key is not set. Please configure OPENAI_API_KEY.'
        },
        { status: 503 }
      )
    }

    const { id: stageId } = await params
    
    // 3. Rate limiting
    const rateLimitKey = `${stageId}:${session.user.id}`
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Please wait a minute before requesting another summary.',
          retryAfter: 60
        },
        { status: 429 }
      )
    }

    // 4. Fetch stage with room and project context
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json(
        { error: 'Stage not found' },
        { status: 404 }
      )
    }

    // If user has manually edited the summary, return that instead
    if (stage.customAiSummary) {
      console.log(`[AI Summary] Returning custom edited summary for stage ${stageId}`)
      
      // Still fetch items for counts
      const items = await prisma.designConceptItem.findMany({
        where: { stageId },
        select: {
          id: true,
          completedByRenderer: true
        }
      })

      const counts = {
        total: items.length,
        completed: items.filter(i => i.completedByRenderer).length,
        pending: items.filter(i => !i.completedByRenderer).length
      }

      return NextResponse.json({
        summary: stage.customAiSummary,
        counts,
        meta: {
          model: 'custom-edited',
          generatedAt: stage.updatedAt.toISOString(),
          processingTimeMs: 0,
          itemsAnalyzed: items.length,
          imagesAnalyzed: 0
        }
      })
    }

    // 5. Fetch design items with all relations
    const items = await prisma.designConceptItem.findMany({
      where: { stageId },
      orderBy: { updatedAt: 'desc' },
      include: {
        libraryItem: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true,
            icon: true
          }
        },
        images: {
          orderBy: { order: 'asc' },
          select: {
            url: true,
            fileName: true,
            description: true
          }
        },
        links: {
          orderBy: { order: 'asc' },
          select: {
            url: true,
            title: true
          }
        }
      }
    })

    // 6. Build context
    const context = {
      roomName: stage.room.name || stage.room.type,
      roomType: stage.room.type,
      projectName: stage.room.project.name,
      clientName: stage.room.project.client?.name
    }

    // 7. Handle empty stage case
    if (items.length === 0) {
      const emptySummary = getEmptyStageSummary(context)
      return NextResponse.json({
        summary: emptySummary,
        counts: {
          total: 0,
          completed: 0,
          pending: 0
        },
        meta: {
          model: 'empty-state',
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          itemsAnalyzed: 0,
          imagesAnalyzed: 0
        }
      })
    }

    // 8. Prepare data for OpenAI
    const processedData = prepareDesignData(items as any, context)
    
    console.log(`[AI Summary] Processing ${items.length} items, ${processedData.imageUrls.length} images for stage ${stageId}`)

    // 9. Build messages
    const userContent = buildChatMessages(processedData)
    
    // 10. Call OpenAI API
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: processedData.imageUrls.length > 0 ? 'gpt-4o' : 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: getSystemPrompt()
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0.4,
      max_tokens: 800
      // Note: timeout is configured in the OpenAI client initialization, not per-request
    })

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.'
    const processingTime = Date.now() - startTime

    console.log(`[AI Summary] Generated in ${processingTime}ms using ${completion.model}`)

    // 11. Return response
    return NextResponse.json({
      summary,
      counts: processedData.counts,
      meta: {
        model: completion.model,
        generatedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        itemsAnalyzed: items.length,
        imagesAnalyzed: processedData.imageUrls.length,
        tokensUsed: {
          prompt: completion.usage?.prompt_tokens,
          completion: completion.usage?.completion_tokens,
          total: completion.usage?.total_tokens
        }
      }
    })

  } catch (error: any) {
    console.error('[AI Summary] Error generating summary:', error)

    // Handle specific OpenAI errors
    if (error?.status === 429) {
      return NextResponse.json(
        { 
          error: 'OpenAI rate limit exceeded',
          message: 'The AI service is currently overloaded. Please try again in a few moments.'
        },
        { status: 429 }
      )
    }

    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json(
        { 
          error: 'OpenAI authentication failed',
          message: 'There is an issue with the API configuration. Please contact support.'
        },
        { status: 503 }
      )
    }

    // Generic error
    return NextResponse.json(
      { 
        error: 'Failed to generate AI summary',
        message: error?.message || 'An unexpected error occurred. Please try again.'
      },
      { status: 500 }
    )
  }
}
