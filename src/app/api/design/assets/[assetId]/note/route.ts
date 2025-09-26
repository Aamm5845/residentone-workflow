import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function PATCH(
  request: NextRequest, 
  { params }: { params: { assetId: string } }
) {
  try {
    console.log('📝 Starting asset note update...')
    
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    console.log('🔑 Session validation:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userOrgId: session?.user?.orgId
    })
    
    if (!isValidAuthSession(session)) {
      console.error('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assetId } = await params
    const data = await request.json()
    const { note } = data
    
    console.log('📝 Request data:', {
      assetId,
      hasNote: !!note,
      noteLength: note?.length || 0
    })

    if (!assetId) {
      console.error('❌ Missing assetId')
      return NextResponse.json({ 
        error: 'Missing required field: assetId' 
      }, { status: 400 })
    }

    console.log('🔍 Looking up asset:', assetId)
    
    // Verify asset exists and user has access
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        organization: {
          id: session.user.orgId
        }
      },
      include: {
        section: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      }
    })
    
    console.log('🔍 Asset lookup result:', {
      found: !!asset,
      assetId: asset?.id,
      assetTitle: asset?.title,
      sectionId: asset?.sectionId
    })

    if (!asset) {
      console.error('❌ Asset not found or access denied for:', assetId)
      return NextResponse.json({ error: 'Asset not found or access denied' }, { status: 404 })
    }

    console.log('📝 Updating asset note:', {
      assetId: asset.id,
      oldNote: asset.userDescription ? `"${asset.userDescription.substring(0, 50)}${asset.userDescription.length > 50 ? '...' : ''}"` : 'null',
      newNote: note ? `"${note.substring(0, 50)}${note.length > 50 ? '...' : ''}"` : 'empty'
    })
    
    // Update asset note
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        userDescription: note || null
      }
    })
    
    console.log('✅ Asset note updated successfully:', {
      assetId: updatedAsset.id,
      hasNote: !!updatedAsset.userDescription
    })

    // Log the activity if we have context
    if (asset.section?.stage) {
      await logActivity({
        session,
        action: ActivityActions.ASSET_TAGGED, // Reusing this as closest match
        entity: EntityTypes.ASSET,
        entityId: asset.id,
        details: {
          assetTitle: asset.title,
          noteAdded: !!note,
          sectionType: asset.section?.type,
          stageName: `${asset.section.stage.type} - ${asset.section.stage.room?.name || asset.section.stage.room?.type}`,
          projectName: asset.section.stage.room?.project?.name
        },
        ipAddress
      })
    }

    return NextResponse.json({
      success: true,
      asset: {
        id: updatedAsset.id,
        title: updatedAsset.title,
        userDescription: updatedAsset.userDescription
      }
    })
  } catch (error) {
    console.error('Error updating asset note:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}