import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// PATCH /api/assets/[assetId]/description - Update asset description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { assetId } = resolvedParams
    const data = await request.json()
    const { description } = data

    // Verify asset access
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        organization: {
          id: session.user.orgId
        }
      },
      include: {
        renderingVersion: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Check if asset is part of a rendering version that's pushed to client
    if (asset.renderingVersion?.status === 'PUSHED_TO_CLIENT') {
      // Allow description updates even when pushed to client
      // This is per your requirement that descriptions can still be edited
    }

    // Update the asset description
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: withUpdateAttribution(session, {
        description: description?.trim() || null
      })
    })

    // Log activity if it's part of a rendering version
    if (asset.renderingVersion) {
      await logActivity({
        session,
        action: ActivityActions.UPDATE,
        entity: 'RENDERING_FILE',
        entityId: assetId,
        details: {
          fileName: asset.title,
          previousDescription: asset.description,
          newDescription: description?.trim() || null,
          version: asset.renderingVersion.version,
          roomName: asset.renderingVersion.room.name || asset.renderingVersion.room.type,
          projectName: asset.renderingVersion.room.project.name,
          message: `Description updated for "${asset.title}" in ${asset.renderingVersion.version}`
        },
        ipAddress
      })
    }

    return NextResponse.json(updatedAsset)
  } catch (error) {
    console.error('Error updating asset description:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}