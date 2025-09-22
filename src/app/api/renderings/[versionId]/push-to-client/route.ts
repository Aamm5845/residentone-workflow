import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'
import { 
  handleWorkflowTransition,
  type WorkflowEvent
} from '@/lib/phase-transitions'

// POST /api/renderings/[versionId]/push-to-client - Push rendering version to client approval
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams

    // Verify rendering version access
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId
      },
      include: {
        assets: {
          where: {
            type: {
              in: ['RENDER', 'IMAGE', 'PDF']
            }
          }
        },
        room: {
          include: {
            project: true
          }
        },
        stage: true,
        clientApprovalVersion: true
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Check if already pushed to client
    if (renderingVersion.clientApprovalVersion) {
      return NextResponse.json({ 
        error: 'This version has already been pushed to client approval',
        clientApprovalVersion: renderingVersion.clientApprovalVersion
      }, { status: 400 })
    }

    // Require at least one asset to push to client
    if (renderingVersion.assets.length === 0) {
      return NextResponse.json({ 
        error: 'Cannot push to client approval without any renderings' 
      }, { status: 400 })
    }

    // Find the CLIENT_APPROVAL stage for this room
    const clientApprovalStage = await prisma.stage.findFirst({
      where: {
        roomId: renderingVersion.roomId,
        type: 'CLIENT_APPROVAL'
      }
    })

    if (!clientApprovalStage) {
      return NextResponse.json({ 
        error: 'Client Approval stage not found for this room' 
      }, { status: 404 })
    }

    // Use database transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update rendering version status
      const updatedRenderingVersion = await tx.renderingVersion.update({
        where: { id: versionId },
        data: withUpdateAttribution(session, {
          status: 'PUSHED_TO_CLIENT',
          pushedToClientAt: new Date()
        })
      })

      // Create ClientApprovalVersion
      const clientApprovalVersion = await tx.clientApprovalVersion.create({
        data: {
          stageId: clientApprovalStage.id,
          renderingVersionId: versionId,
          version: renderingVersion.version,
          status: 'DRAFT',
          approvedByAaron: false,
          clientDecision: 'PENDING'
        }
      })

      // Create ClientApprovalAsset entries for each rendering asset
      const clientApprovalAssets = []
      for (let i = 0; i < renderingVersion.assets.length; i++) {
        const asset = renderingVersion.assets[i]
        const clientApprovalAsset = await tx.clientApprovalAsset.create({
          data: {
            versionId: clientApprovalVersion.id,
            assetId: asset.id,
            includeInEmail: true, // Include all assets by default
            displayOrder: i
          }
        })
        clientApprovalAssets.push(clientApprovalAsset)
      }

      // The automatic stage transition will be handled by the phase transition utility
      // after the transaction completes

      // Log activity for rendering version
      await logActivity({
        session,
        action: ActivityActions.UPDATE,
        entity: 'RENDERING_VERSION',
        entityId: versionId,
        details: {
          action: 'push_to_client',
          version: renderingVersion.version,
          assetCount: renderingVersion.assets.length,
          roomName: renderingVersion.room.name || renderingVersion.room.type,
          projectName: renderingVersion.room.project.name,
          message: `Version ${renderingVersion.version} pushed to Client Approval`
        },
        ipAddress
      })

      // Log activity for client approval creation
      await logActivity({
        session,
        action: ActivityActions.CREATE,
        entity: 'CLIENT_APPROVAL_VERSION',
        entityId: clientApprovalVersion.id,
        details: {
          version: renderingVersion.version,
          sourceRenderingVersionId: versionId,
          assetCount: renderingVersion.assets.length,
          roomName: renderingVersion.room.name || renderingVersion.room.type,
          projectName: renderingVersion.room.project.name,
          message: `Client Approval version created from ${renderingVersion.version}`
        },
        ipAddress
      })

      // Add activity log to Client Approval stage
      await tx.activity.create({
        data: {
          stageId: clientApprovalStage.id,
          type: 'VERSION_RECEIVED',
          message: `${renderingVersion.version} pushed to Client Approval - 3D rendering version pushed by ${session.user.name} with ${renderingVersion.assets.length} assets`,
          userId: session.user.id
        }
      })

      return {
        renderingVersion: updatedRenderingVersion,
        clientApprovalVersion: {
          ...clientApprovalVersion,
          assets: clientApprovalAssets
        }
      }
    })

    // Auto-complete the 3D rendering stage when pushing to client
    try {
      const renderingStage = await prisma.stage.findUnique({
        where: { id: renderingVersion.stageId }
      })

      if (renderingStage && renderingStage.status !== 'COMPLETED') {
        await prisma.stage.update({
          where: { id: renderingVersion.stageId },
          data: withUpdateAttribution(session, {
            status: 'COMPLETED',
            completedAt: new Date()
          })
        })

        console.log(`Auto-completed 3D rendering stage ${renderingVersion.stageId} when pushing version to client`)
      }
    } catch (stageCompletionError) {
      console.error('Error auto-completing 3D rendering stage:', stageCompletionError)
      // Don't fail the main operation if stage completion fails
    }

    // Handle automatic phase transition after successful push to client
    try {
      const workflowEvent: WorkflowEvent = {
        type: 'RENDERING_PUSHED_TO_CLIENT',
        roomId: renderingVersion.roomId,
        stageType: 'THREE_D',
        details: {
          renderingVersionId: versionId,
          version: renderingVersion.version,
          assetCount: renderingVersion.assets.length
        }
      }
      
      const transitionResult = await handleWorkflowTransition(workflowEvent, session, ipAddress)
      
      if (transitionResult.transitionsTriggered.length > 0) {
        console.log(`Phase transitions triggered by push-to-client:`, transitionResult.transitionsTriggered)
        // Add transition info to the response
        result.phaseTransitions = transitionResult.transitionsTriggered
      }
      
      if (transitionResult.errors.length > 0) {
        console.error('Phase transition errors:', transitionResult.errors)
      }
    } catch (transitionError) {
      console.error('Error handling phase transitions:', transitionError)
      // Don't fail the main operation if transitions fail
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error pushing rendering version to client approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}