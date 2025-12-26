import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleWorkflowTransition, type WorkflowEvent } from '@/lib/phase-transitions'
import { getIPAddress } from '@/lib/attribution'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

// POST /api/client-approval/[stageId]/client-decision - Record client's approval decision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { decision, notes } = body

    if (!decision || !['APPROVED', 'REVISION_REQUESTED'].includes(decision)) {
      return NextResponse.json({ error: 'Valid decision is required' }, { status: 400 })
    }

    // Get the current version
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId
      },
      include: {
        stage: {
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
        },
        assets: {
          include: {
            asset: {
              include: {
                uploadedByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Use transaction to update multiple records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Update the version with client decision
      const updatedVersion = await tx.clientApprovalVersion.update({
        where: {
          id: currentVersion.id
        },
        data: {
          clientDecision: decision,
          clientDecidedAt: new Date(),
          clientMessage: notes || null,
          status: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED'
        },
        include: {
          assets: {
            include: {
              asset: {
                include: {
                  uploadedByUser: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          renderingVersion: true
        }
      })

      // If revision requested, reopen the 3D rendering stage and add revision notes
      if (decision === 'REVISION_REQUESTED' && updatedVersion.renderingVersion) {
        // Update the rendering version to show revision status
        await tx.renderingVersion.update({
          where: {
            id: updatedVersion.renderingVersion.id
          },
          data: {
            status: 'IN_PROGRESS' // Reopen for revisions
          }
        })

        // Add a revision note to the rendering version
        await tx.renderingNote.create({
          data: {
            versionId: updatedVersion.renderingVersion.id,
            content: `🔄 **REVISION REQUESTED**\n\n${notes || 'Client requested revisions'}\n\n*Posted from Client Approval workspace*`,
            authorId: session.user.id
          }
        })

        // Update the 3D rendering stage to be active again
        const renderingStage = await tx.stage.findFirst({
          where: {
            roomId: currentVersion.stage.roomId,
            type: 'THREE_D'
          }
        })

        if (renderingStage) {
          await tx.stage.update({
            where: {
              id: renderingStage.id
            },
            data: {
              status: 'IN_PROGRESS',
              completedAt: null // Reopen the stage
            }
          })
        }
      }

      return updatedVersion
    })

    // Create activity log
    const activityMessage = decision === 'APPROVED' 
      ? `Client approved ${currentVersion.version} - Client approved the design by ${session.user.name}`
      : `Client requested revision ${currentVersion.version} - Client requested revisions by ${session.user.name}${notes ? `: "${notes}"` : ''}`

    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED',
        message: activityMessage,
        userId: session.user.id
      }
    })

    // Create a ClientApproval record for tracking
    await prisma.clientApproval.create({
      data: {
        versionId: currentVersion.id,
        approvedBy: session.user.email || 'Unknown',
        decision: decision,
        comments: notes || null
      }
    })

    // Send email notification to Vitor when revision is requested
    if (decision === 'REVISION_REQUESTED') {
      try {
        const vitor = await prisma.user.findFirst({
          where: {
            email: 'euvi.3d@gmail.com'
          },
          select: {
            id: true,
            name: true,
            email: true,
            emailNotificationsEnabled: true
          }
        })

        if (vitor && vitor.emailNotificationsEnabled) {
          const roomName = currentVersion.stage.room.name || currentVersion.stage.room.type.replace('_', ' ').toLowerCase()
          const projectName = currentVersion.stage.room.project.name
          const clientName = currentVersion.stage.room.project.client?.name || 'The client'
          const renderingStageId = await prisma.stage.findFirst({ where: { roomId: currentVersion.stage.roomId, type: 'THREE_D' }, select: { id: true } }).then(s => s?.id)
          const roomUrl = `${getBaseUrl()}/projects/${currentVersion.stage.room.project.id}/rooms/${currentVersion.stage.roomId}?stage=${renderingStageId || currentVersion.stageId}`

          console.log(`[Email] Sending revision notification to Vitor for ${roomName} (${projectName})...`)
          
          await sendEmail({
            to: vitor.email,
            subject: `Client Requested Changes - ${roomName} (${projectName})`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Requested Changes</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Client Requested Changes</h1>
            <p style="margin: 8px 0 0 0; color: #fef3c7; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${vitor.name},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${clientName}</strong> has requested revisions for the 3D renderings.
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Revision Requested</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0; color: #1e293b; font-size: 15px;"><strong>Room:</strong> ${roomName}</p>
            </div>
            ${notes ? `
            <div style="background: #f8fafc; border-left: 4px solid #64748b; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Client's Feedback</p>
                <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${notes}</p>
            </div>` : ''}
            
            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                The 3D Rendering stage has been reopened. Please review the feedback and make the necessary updates.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${roomUrl}" 
                   style="background: #f59e0b; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);"
                   target="_blank">View Room</a>
            </div>
        </div>
        
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #d97706; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #d97706; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
            text: `Hi ${vitor.name},\n\n${clientName} has requested revisions for the 3D renderings.\n\nProject: ${projectName}\nRoom: ${roomName}${notes ? `\n\nClient's Feedback: ${notes}` : ''}\n\nThe 3D Rendering stage has been reopened. Please review the feedback and make the necessary updates.\n\nView the room: ${roomUrl}\n\nBest regards,\nThe Team`
          })
          
          console.log(`[Email] Revision notification sent to Vitor`)
        } else if (vitor && !vitor.emailNotificationsEnabled) {
          console.log(`[Email] Skipping notification to Vitor (email notifications disabled)`)
        } else {
          console.log(`[Email] Vitor user not found in database`)
        }
      } catch (emailError) {
        console.error('[Email] Failed to send revision notification to Vitor:', emailError)
        // Don't fail the main operation if email notification fails
      }
    }

    // Trigger workflow transitions
    try {
      const ipAddress = getIPAddress(request)
      
      if (decision === 'REVISION_REQUESTED') {
        const workflowEvent: WorkflowEvent = {
          type: 'CLIENT_REVISION_REQUESTED',
          roomId: currentVersion.stage.roomId,
          stageType: 'CLIENT_APPROVAL',
          stageId: currentVersion.stageId,
          details: {
            versionId: currentVersion.id,
            clientMessage: notes
          }
        }
        
        await handleWorkflowTransition(workflowEvent, session, ipAddress)
      } else if (decision === 'APPROVED') {
        const workflowEvent: WorkflowEvent = {
          type: 'CLIENT_APPROVED',
          roomId: currentVersion.stage.roomId,
          stageType: 'CLIENT_APPROVAL',
          stageId: currentVersion.stageId,
          details: {
            versionId: currentVersion.id
          }
        }
        
        await handleWorkflowTransition(workflowEvent, session, ipAddress)
      }
    } catch (workflowError) {
      console.warn('Workflow transition failed:', workflowError)
      // Don't fail the request if workflow transition fails
    }

    // Send email notifications to Sami (Drawings) and Shaya (FFE) when client approves
    if (decision === 'APPROVED') {
      const roomName = currentVersion.stage.room.name || currentVersion.stage.room.type.replace('_', ' ').toLowerCase()
      const projectName = currentVersion.stage.room.project.name
      const clientName = currentVersion.stage.room.project.client?.name || 'The client'
      
      // Get stage IDs for Drawings and FFE phases
      const drawingsStage = await prisma.stage.findFirst({ where: { roomId: currentVersion.stage.roomId, type: 'DRAWINGS' }, select: { id: true } })
      const ffeStage = await prisma.stage.findFirst({ where: { roomId: currentVersion.stage.roomId, type: 'FFE' }, select: { id: true } })
      const drawingsUrl = `${getBaseUrl()}/projects/${currentVersion.stage.room.project.id}/rooms/${currentVersion.stage.roomId}?stage=${drawingsStage?.id || currentVersion.stageId}`
      const ffeUrl = `${getBaseUrl()}/projects/${currentVersion.stage.room.project.id}/rooms/${currentVersion.stage.roomId}?stage=${ffeStage?.id || currentVersion.stageId}`

      // Notify Sami for Drawings phase
      try {
        const sami = await prisma.user.findFirst({
          where: {
            email: 'sami@meisnerinteriors.com'
          },
          select: {
            id: true,
            name: true,
            email: true,
            emailNotificationsEnabled: true
          }
        })

        if (sami && sami.emailNotificationsEnabled) {
          console.log(`[Email] Sending Drawings phase notification to Sami for ${roomName} (${projectName})...`)
          
          await sendEmail({
            to: sami.email,
            subject: `${roomName} (${projectName}) - Drawings Phase Ready`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Drawings Phase Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Drawings Phase Ready</h1>
            <p style="margin: 8px 0 0 0; color: #fed7aa; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${sami.name},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${clientName}</strong> has approved the design in <strong>Client Approval</strong>.
            </p>
            
            <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #9a3412; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Ready to Start</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0; color: #1e293b; font-size: 15px;"><strong>Room:</strong> ${roomName}</p>
            </div>
            
            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                The Drawings phase is now open and ready for you to start working on the technical drawings and specifications.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${drawingsUrl}" 
                   style="background: #f97316; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);"
                   target="_blank">View Room</a>
            </div>
        </div>
        
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #ea580c; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #ea580c; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
            text: `Hi ${sami.name},\n\n${clientName} has approved the design in Client Approval.\n\nProject: ${projectName}\nRoom: ${roomName}\n\nThe Drawings phase is now open and ready for you to start working on the technical drawings and specifications.\n\nView the room: ${drawingsUrl}\n\nBest regards,\nThe Team`
          })
          
          console.log(`[Email] Drawings phase notification sent to Sami`)
        } else if (sami && !sami.emailNotificationsEnabled) {
          console.log(`[Email] Skipping notification to Sami (email notifications disabled)`)
        } else {
          console.log(`[Email] Sami user not found in database`)
        }
      } catch (emailError) {
        console.error('[Email] Failed to send Drawings phase notification to Sami:', emailError)
        // Don't fail the main operation if email notification fails
      }

      // Notify Shaya for FFE phase
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
          console.log(`[Email] Sending FFE phase notification to Shaya for ${roomName} (${projectName})...`)
          
          await sendEmail({
            to: shaya.email,
            subject: `${roomName} (${projectName}) - FFE Phase Ready`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FFE Phase Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 32px; text-align: center;">
            <img src="${getBaseUrl()}/meisnerinteriorlogo.png" 
                 alt="Meisner Interiors" 
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">FFE Phase Ready</h1>
            <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>
        
        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${shaya.name},</p>
            
            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${clientName}</strong> has approved the design in <strong>Client Approval</strong>.
            </p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #065f46; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Ready to Start</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0; color: #1e293b; font-size: 15px;"><strong>Room:</strong> ${roomName}</p>
            </div>
            
            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                The FFE phase is now open and ready for you to start working on furniture, fixtures, and equipment sourcing.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${ffeUrl}" 
                   style="background: #10b981; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);"
                   target="_blank">View Room</a>
            </div>
        </div>
        
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com" 
                   style="color: #059669; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957" 
                   style="color: #059669; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
            text: `Hi ${shaya.name},\n\n${clientName} has approved the design in Client Approval.\n\nProject: ${projectName}\nRoom: ${roomName}\n\nThe FFE phase is now open and ready for you to start working on furniture, fixtures, and equipment sourcing.\n\nView the room: ${ffeUrl}\n\nBest regards,\nThe Team`
          })
          
          console.log(`[Email] FFE phase notification sent to Shaya`)
        } else if (shaya && !shaya.emailNotificationsEnabled) {
          console.log(`[Email] Skipping notification to Shaya (email notifications disabled)`)
        } else {
          console.log(`[Email] Shaya user not found in database`)
        }
      } catch (emailError) {
        console.error('[Email] Failed to send FFE phase notification to Shaya:', emailError)
        // Don't fail the main operation if email notification fails
      }
    }

    return NextResponse.json({ 
      success: true,
      version: {
        ...result,
        assets: result.assets.map(asset => ({
          id: asset.id,
          asset: asset.asset,
          includeInEmail: asset.includeInEmail
        }))
      }
    })

  } catch (error) {
    console.error('Error recording client decision:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}