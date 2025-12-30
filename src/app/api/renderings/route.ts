import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import { 
  withCreateAttribution, 
  withUpdateAttribution,
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// GET /api/renderings - List all rendering versions for a stage
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')
    const roomId = searchParams.get('roomId')

    if (!stageId && !roomId) {
      return NextResponse.json({ error: 'stageId or roomId is required' }, { status: 400 })
    }

    const where: any = {}
    if (stageId) {
      where.stageId = stageId
    }
    if (roomId) {
      where.roomId = roomId
    }

    // All users can access rendering versions (no orgId filtering)

    const renderingVersions = await prisma.renderingVersion.findMany({
      where: {
        ...where
      },
      include: {
        assets: {
          orderBy: { createdAt: 'asc' }
        },
        notes: {
          include: {
            author: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        updatedBy: {
          select: { id: true, name: true, email: true }
        },
        completedBy: {
          select: { id: true, name: true, email: true }
        },
        clientApprovalVersion: {
          select: { 
            id: true, 
            version: true, 
            status: true,
            clientDecision: true,
            clientMessage: true,
            clientDecidedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Generate URLs for assets - prefer Blob for speed, fallback to Dropbox
    const versionsWithLinks = await Promise.all(
      renderingVersions.map(async (version) => {
        const assetsWithLinks = await Promise.all(
          version.assets.map(async (asset) => {
            // Parse metadata to check for blobUrl
            let metadata: Record<string, any> = {}
            try {
              if (typeof asset.metadata === 'string') {
                metadata = JSON.parse(asset.metadata || '{}')
              } else if (asset.metadata && typeof asset.metadata === 'object') {
                metadata = asset.metadata as Record<string, any>
              }
            } catch {
              metadata = {}
            }

            // Priority 1: Use blobUrl from metadata (fastest)
            if (metadata.blobUrl && metadata.blobUrl.startsWith('http')) {
              return {
                ...asset,
                temporaryUrl: metadata.blobUrl
              }
            }

            // Priority 2: If provider is blob and URL is http, use it directly
            if (asset.provider === 'blob' && asset.url?.startsWith('http')) {
              return {
                ...asset,
                temporaryUrl: asset.url
              }
            }

            // Priority 3: If stored in Dropbox, get temporary link
            if (asset.provider === 'dropbox' && asset.url) {
              try {
                const temporaryLink = await dropboxService.getTemporaryLink(asset.url)
                return {
                  ...asset,
                  temporaryUrl: temporaryLink || asset.url
                }
              } catch (error) {
                console.error(`Failed to generate temporary link for asset ${asset.id}:`, error)
                return asset
              }
            }

            // Fallback: use asset.url directly if it's http
            if (asset.url?.startsWith('http')) {
              return {
                ...asset,
                temporaryUrl: asset.url
              }
            }

            return asset
          })
        )
        return {
          ...version,
          assets: assetsWithLinks
        }
      })
    )

    return NextResponse.json({ renderingVersions: versionsWithLinks })
  } catch (error) {
    console.error('Error fetching rendering versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/renderings - Create a new rendering version
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { roomId, stageId, customName } = data

    if (!roomId || !stageId) {
      return NextResponse.json({ error: 'roomId and stageId are required' }, { status: 400 })
    }

    // Verify room/stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        roomId: roomId,
        type: 'THREE_D'
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found or access denied' }, { status: 404 })
    }

    // Get the next version number for this room
    const lastVersion = await prisma.renderingVersion.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' }
    })

    const nextVersionNumber = lastVersion 
      ? parseInt(lastVersion.version.replace('V', '')) + 1 
      : 1

    const version = `V${nextVersionNumber}`

    // Create the new rendering version
    const renderingVersion = await prisma.renderingVersion.create({
      data: withCreateAttribution(session, {
        roomId,
        stageId,
        version,
        customName,
        status: 'IN_PROGRESS'
      }),
      include: {
        assets: true,
        notes: {
          include: {
            author: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.RENDERING_VERSION_CREATED,
      entity: 'RENDERING_VERSION',
      entityId: renderingVersion.id,
      details: {
        version,
        roomName: stage.room.name || stage.room.type,
        projectName: stage.room.project.name,
        customName
      },
      ipAddress
    })

    return NextResponse.json(renderingVersion, { status: 201 })
  } catch (error) {
    console.error('Error creating rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
