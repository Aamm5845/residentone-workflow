import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'
import { 
  getFFEDetectionSystemPrompt,
  buildFFEDetectionMessages,
  parseFFEDetectionResponse,
  getNoImagesResponse,
  type AIFFEDetectionResult 
} from '@/lib/server/aiFFEPrompt'
import { dropboxService } from '@/lib/dropbox-service'

// Configure Next.js route
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 second timeout for image analysis

// Rate limiting
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW_MS = 30000 // 30 seconds
const RATE_LIMIT_MAX_CALLS = 1

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const lastCall = rateLimitMap.get(key)
  
  if (lastCall && (now - lastCall) < RATE_LIMIT_WINDOW_MS) {
    return false
  }
  
  rateLimitMap.set(key, now)
  
  // Cleanup old entries
  if (rateLimitMap.size > 100) {
    for (const [k, v] of rateLimitMap.entries()) {
      if ((now - v) > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(k)
      }
    }
  }
  
  return true
}

/**
 * POST /api/ffe/v2/rooms/[roomId]/ai-generate
 * Analyze 3D rendering images and generate FFE item suggestions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const startTime = Date.now()
  
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        error: 'AI features not configured',
        message: 'OpenAI API key is not set. Please configure OPENAI_API_KEY.'
      }, { status: 503 })
    }

    const { roomId } = await params
    
    // 3. Rate limiting
    const rateLimitKey = `ffe-ai:${roomId}:${(session.user as any).id}`
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Please wait 30 seconds before generating another AI analysis.',
        retryAfter: 30
      }, { status: 429 })
    }

    // 4. Fetch room with project context
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 5. Get the latest rendering version with images
    const latestRenderingVersion = await prisma.renderingVersion.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      include: {
        assets: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // 6. Build context
    const context = {
      roomName: room.name || room.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      roomType: room.type,
      projectName: room.project.name
    }

    // Filter assets to only include image types (filter client-side since type is an enum)
    const imageAssets = latestRenderingVersion?.assets.filter(asset => {
      const type = asset.type?.toString().toLowerCase() || ''
      return type === 'render' || type === 'image' || type.startsWith('image')
    }) || []

    // 7. Handle no images case
    if (!latestRenderingVersion || imageAssets.length === 0) {
      // Also check for spec book renderings
      const specBookRenderings = await prisma.specBookSection.findFirst({
        where: {
          roomId,
          type: 'ROOM'
        },
        select: {
          renderingUrls: true,
          renderingUrl: true
        }
      })
      
      let imageUrls: string[] = []
      
      if (specBookRenderings) {
        if (specBookRenderings.renderingUrls && specBookRenderings.renderingUrls.length > 0) {
          imageUrls = specBookRenderings.renderingUrls
        } else if (specBookRenderings.renderingUrl) {
          imageUrls = [specBookRenderings.renderingUrl]
        }
      }
      
      if (imageUrls.length === 0) {
        return NextResponse.json({
          success: true,
          data: getNoImagesResponse(context),
          meta: {
            source: 'no-images',
            processingTimeMs: Date.now() - startTime
          }
        })
      }
      
      // Use spec book renderings
      return await analyzeImages(imageUrls, context, startTime)
    }

    // 8. Get image URLs (prefer Blob for fast access, fallback to Dropbox)
    const imageUrls: string[] = []

    for (const asset of imageAssets) {
      // First check if there's a blob URL in metadata (fast access)
      const metadata = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata || '{}') : (asset.metadata || {})
      if (metadata.blobUrl) {
        imageUrls.push(metadata.blobUrl)
        continue
      }

      // If provider is blob, use URL directly
      if (asset.provider === 'blob' && asset.url?.startsWith('http')) {
        imageUrls.push(asset.url)
        continue
      }

      // Handle Dropbox links
      if (asset.provider === 'dropbox' && asset.url) {
        try {
          const temporaryLink = await dropboxService.getTemporaryLink(asset.url)
          if (temporaryLink) {
            imageUrls.push(temporaryLink)
          }
        } catch (error) {
          console.error(`Failed to get Dropbox link for asset ${asset.id}:`, error)
          // Try using the URL directly as fallback
          if (asset.url.startsWith('http')) {
            imageUrls.push(asset.url)
          }
        }
      } else if (asset.url && asset.url.startsWith('http')) {
        imageUrls.push(asset.url)
      }
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({
        success: true,
        data: getNoImagesResponse(context),
        meta: {
          source: 'no-accessible-images',
          processingTimeMs: Date.now() - startTime
        }
      })
    }

    // 9. Analyze images with OpenAI
    return await analyzeImages(imageUrls, context, startTime)

  } catch (error: any) {
    console.error('[AI FFE Generate] Error:', error)

    if (error?.status === 429) {
      return NextResponse.json({
        error: 'OpenAI rate limit exceeded',
        message: 'The AI service is currently overloaded. Please try again in a few moments.'
      }, { status: 429 })
    }

    return NextResponse.json({
      error: 'Failed to generate AI FFE analysis',
      message: error?.message || 'An unexpected error occurred.'
    }, { status: 500 })
  }
}

/**
 * Analyze images with OpenAI Vision API
 */
async function analyzeImages(
  imageUrls: string[], 
  context: { roomName: string; roomType: string; projectName: string },
  startTime: number
): Promise<NextResponse> {
  const openai = getOpenAI()
  
  const messages = buildFFEDetectionMessages(imageUrls, context)
  
  console.log(`[AI FFE Generate] Analyzing ${imageUrls.length} images for ${context.roomName}`)
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o', // Use GPT-4o for best vision capabilities
    messages: [
      {
        role: 'system',
        content: getFFEDetectionSystemPrompt()
      },
      {
        role: 'user',
        content: messages
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  })

  const responseText = completion.choices[0]?.message?.content || '{}'
  const result = parseFFEDetectionResponse(responseText)
  const processingTime = Date.now() - startTime

  console.log(`[AI FFE Generate] Detected ${result.totalItemsDetected} items in ${processingTime}ms`)

  return NextResponse.json({
    success: true,
    data: result,
    meta: {
      model: completion.model,
      source: 'rendering-version',
      imagesAnalyzed: imageUrls.length,
      processingTimeMs: processingTime,
      tokensUsed: {
        prompt: completion.usage?.prompt_tokens,
        completion: completion.usage?.completion_tokens,
        total: completion.usage?.total_tokens
      }
    }
  })
}
