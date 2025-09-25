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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }
    
    // Reset stage data based on stage type
    const stageId = resolvedParams.id
    
    try {
      await prisma.$transaction(async (tx) => {
        // Reset common stage fields
        await tx.stage.update({
          where: { id: stageId },
          data: withUpdateAttribution(session, {
            status: 'NOT_STARTED',
            startedAt: null,
            completedAt: null,
            completedById: null,
            assignedTo: null
          })
        })

        // Reset stage-specific data based on type
        switch (stage.type) {
          case 'DESIGN_CONCEPT':
          case 'DESIGN':
            // Delete design sections and their assets/comments
            const designSections = await tx.designSection.findMany({
              where: { stageId },
              include: { assets: true, comments: true }
            })
            
            for (const section of designSections) {
              // Delete comments
              await tx.comment.deleteMany({
                where: { designSectionId: section.id }
              })
              
              // Delete assets
              await tx.asset.deleteMany({
                where: { designSectionId: section.id }
              })
            }
            
            // Delete design sections
            await tx.designSection.deleteMany({
              where: { stageId }
            })
            break

          case 'THREE_D':
            // Delete rendering versions and their assets
            const renderingVersions = await tx.renderingVersion.findMany({
              where: { stageId },
              include: { assets: true, notes: true }
            })
            
            for (const version of renderingVersions) {
              // Delete rendering notes
              await tx.renderingNote.deleteMany({
                where: { versionId: version.id }
              })
              
              // Delete assets
              await tx.asset.deleteMany({
                where: { renderingVersionId: version.id }
              })
            }
            
            // Delete rendering versions
            await tx.renderingVersion.deleteMany({
              where: { stageId }
            })
            break

          case 'CLIENT_APPROVAL':
            // Delete client approval versions and their assets
            const clientApprovalVersions = await tx.clientApprovalVersion.findMany({
              where: { stageId }
            })
            
            for (const version of clientApprovalVersions) {
              // Delete client approval version assets
              await tx.clientApprovalAsset.deleteMany({
                where: { versionId: version.id }
              })
              
              // Delete client approval activities
              await tx.clientApprovalActivity.deleteMany({
                where: { versionId: version.id }
              })
            }
            
            // Delete client approval versions
            await tx.clientApprovalVersion.deleteMany({
              where: { stageId }
            })
            break

          case 'DRAWINGS':
            // Delete drawing checklist items and their assets
            const drawingChecklists = await tx.drawingChecklistItem.findMany({
              where: { stageId },
              include: { assets: true }
            })
            
            for (const checklist of drawingChecklists) {
              // Delete assets
              await tx.asset.deleteMany({
                where: { drawingChecklistItemId: checklist.id }
              })
            }
            
            // Delete drawing checklist items
            await tx.drawingChecklistItem.deleteMany({
              where: { stageId }
            })
            break

          case 'FFE':
            // Delete FFE items
            await tx.fFEItem.deleteMany({
              where: { 
                room: { 
                  stages: { 
                    some: { id: stageId } 
                  } 
                } 
              }
            })
            break
        }

        // Delete chat messages for this stage
        await tx.chatMention.deleteMany({
          where: { 
            message: { 
              stageId: stageId 
            } 
          }
        })
        
        await tx.chatMessage.deleteMany({
          where: { stageId }
        })

        // Delete general stage assets not covered above
        await tx.asset.deleteMany({
          where: { stageId }
        })

        // Delete activity logs related to this stage
        await tx.activityLog.deleteMany({
          where: { 
            entityType: 'STAGE',
            entityId: stageId
          }
        })
      })

      // Log the reset activity
      await logActivity({
        session,
        action: 'STAGE_RESET',
        entity: EntityTypes.STAGE,
        entityId: stageId,
        details: {
          stageName: `${stage.type}`,
          resetBy: session.user?.name
        },
        ipAddress
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Stage reset successfully' 
      })
    } catch (transactionError) {
      console.error('Transaction error during stage reset:', transactionError)
      return NextResponse.json({ 
        error: 'Failed to reset stage data' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error resetting stage:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}