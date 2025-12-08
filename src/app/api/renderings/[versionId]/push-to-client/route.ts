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
import { dropboxService } from '@/lib/dropbox-service'
import { uploadFile as uploadToBlob, generateFilePath } from '@/lib/blob'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

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
    // NOTE: Dropbox-to-Blob copy is done AFTER the transaction to avoid timeouts
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
      // Blob URLs will be added after the transaction completes
      const clientApprovalAssets = []
      for (let i = 0; i < renderingVersion.assets.length; i++) {
        const asset = renderingVersion.assets[i]
        
        const clientApprovalAsset = await tx.clientApprovalAsset.create({
          data: {
            versionId: clientApprovalVersion.id,
            assetId: asset.id,
            includeInEmail: true, // Include all assets by default
            displayOrder: i,
            blobUrl: null // Will be updated after transaction
          }
        })
        clientApprovalAssets.push(clientApprovalAsset)
      }

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

    // Log activities OUTSIDE the transaction (non-critical)
    try {
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

      await logActivity({
        session,
        action: ActivityActions.CREATE,
        entity: 'CLIENT_APPROVAL_VERSION',
        entityId: result.clientApprovalVersion.id,
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
    } catch (logError) {
      console.error('[push-to-client] Activity logging failed (non-critical):', logError)
    }

    // Copy assets from Dropbox to Blob AFTER the transaction (non-blocking)
    // This runs in the background and updates the records when complete
    const copyAssetsToBlob = async () => {
      for (let i = 0; i < renderingVersion.assets.length; i++) {
        const asset = renderingVersion.assets[i]
        const clientApprovalAsset = result.clientApprovalVersion.assets[i]
        
        if (asset.provider === 'dropbox' && asset.url) {
          try {
            console.log(`[push-to-client] Copying asset ${asset.id} from Dropbox to Blob...`)
            
            // Download from Dropbox
            const dropboxPath = asset.url.startsWith('/') ? asset.url : '/' + asset.url
            const fileBuffer = await dropboxService.downloadFile(dropboxPath)
            
            // Upload to Blob with proper path structure
            const blobPath = generateFilePath(
              renderingVersion.room.project.orgId,
              renderingVersion.room.project.id,
              renderingVersion.roomId,
              `client-approval-${result.clientApprovalVersion.id}`,
              asset.filename
            )
            
            const blobResult = await uploadToBlob(fileBuffer, blobPath, {
              contentType: asset.mimeType || 'image/jpeg'
            })
            
            // Update the ClientApprovalAsset with the Blob URL
            await prisma.clientApprovalAsset.update({
              where: { id: clientApprovalAsset.id },
              data: { blobUrl: blobResult.url }
            })
            
            console.log(`[push-to-client] ✅ Copied to Blob: ${blobResult.url}`)
          } catch (copyError) {
            console.error(`[push-to-client] ❌ Failed to copy asset ${asset.id} to Blob:`, copyError)
            // Continue - email will use Dropbox URLs as fallback
          }
        }
      }
    }

    // Start the Blob copy in the background (don't await - let it run async)
    copyAssetsToBlob().catch(err => {
      console.error('[push-to-client] Background Blob copy failed:', err)
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

      }
    } catch (stageCompletionError) {
      console.error('Error auto-completing 3D rendering stage:', stageCompletionError)
      // Don't fail the main operation if stage completion fails
    }

    // Send email notification to Shaya that the room is ready for Client Approval
    try {
      const shaya = await prisma.user.findFirst({
        where: {
          email: 'shaya@meisnerinteriors.com'
        },
        select: {
          id: true,
          name: true,
          email: true,
          emailNotificationsEnabled: true
        }
      })

      if (shaya && shaya.emailNotificationsEnabled) {
        const baseUrl = getBaseUrl()
        const roomName = renderingVersion.room.name || renderingVersion.room.type.replace('_', ' ').toLowerCase()
        const projectName = renderingVersion.room.project.name
        const roomUrl = `${baseUrl}/projects/${renderingVersion.room.project.id}/rooms/${renderingVersion.roomId}?stage=${clientApprovalStage.id}`
        const pushedByName = session.user.name || 'A team member'

        console.log(`[Email] Sending Client Approval notification to Shaya for ${roomName} (${projectName})...`)
        
        await sendEmail({
          to: shaya.email,
          subject: `${roomName} (${projectName}) is ready for Client Approval`,
          html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ready for Client Approval</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 32px; text-align: center;">
            <img src="${baseUrl}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Ready for Client Approval</h1>
            <p style="margin: 8px 0 0 0; color: #bfdbfe; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${shaya.name},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${pushedByName}</strong> has pushed a 3D rendering version to <strong>Client Approval</strong>.
            </p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Project Details</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0; color: #1e293b; font-size: 15px;"><strong>Room:</strong> ${roomName}</p>
            </div>
            
            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                This room is now ready for you to start working on in the Client Approval phase.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${roomUrl}" 
                   style="background: #3b82f6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);"
                   target="_blank">View Room</a>
            </div>
        </div>
        
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #2563eb; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
          text: `Hi ${shaya.name},\n\n${pushedByName} has pushed a 3D rendering version to Client Approval.\n\nProject: ${projectName}\nRoom: ${roomName}\n\nThis room is now ready for you to start working on in the Client Approval phase.\n\nView the room: ${roomUrl}\n\nBest regards,\nThe Team`
        })
        
        console.log(`[Email] Client Approval notification sent to Shaya`)
      } else if (shaya && !shaya.emailNotificationsEnabled) {
        console.log(`[Email] Skipping notification to Shaya (email notifications disabled)`)
      } else {
        console.log(`[Email] Shaya user not found in database`)
      }
    } catch (emailError) {
      console.error('[Email] Failed to send Client Approval notification to Shaya:', emailError)
      // Don't fail the main operation if email notification fails
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