import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      },
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all versions - use separate queries to avoid failures from orphaned data
    let versions: any[] = []
    
    try {
      // First, get basic version data without relations that might fail
      const baseVersions = await prisma.floorplanApprovalVersion.findMany({
        where: {
          projectId: resolvedParams.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
      
      // Now fetch related data separately for each version with error handling
      versions = await Promise.all(baseVersions.map(async (v) => {
        // Fetch assets - filter out orphaned ones
        let assets: any[] = []
        try {
          const rawAssets = await prisma.floorplanApprovalAsset.findMany({
            where: { versionId: v.id },
            orderBy: [
              { displayOrder: 'asc' },
              { createdAt: 'desc' }
            ]
          })
          
          // Fetch actual asset data only for assets that exist
          const assetIds = rawAssets.map(a => a.assetId)
          const existingAssets = await prisma.asset.findMany({
            where: { id: { in: assetIds } }
          })
          const assetMap = new Map(existingAssets.map(a => [a.id, a]))
          
          // Only include assets that exist
          assets = rawAssets
            .filter(a => assetMap.has(a.assetId))
            .map(a => ({
              id: a.id,
              includeInEmail: a.includeInEmail,
              displayOrder: a.displayOrder,
              asset: assetMap.get(a.assetId)
            }))
        } catch (assetError) {
          console.error(`Error fetching assets for version ${v.id}:`, assetError)
        }
        
        // Fetch activity logs
        let activityLogs: any[] = []
        try {
          activityLogs = await prisma.floorplanApprovalActivity.findMany({
            where: { versionId: v.id },
            include: {
              user: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 15
          })
          // Handle null user references
          activityLogs = activityLogs.map(log => ({
            ...log,
            user: log.user || { id: null, name: 'Unknown User' }
          }))
        } catch (logError) {
          console.error(`Error fetching activity logs for version ${v.id}:`, logError)
        }
        
        // Fetch email logs count
        let emailCount = 0
        try {
          emailCount = await prisma.floorplanApprovalEmailLog.count({
            where: { versionId: v.id }
          })
        } catch (emailError) {
          console.error(`Error fetching email logs for version ${v.id}:`, emailError)
        }
        
        // Fetch user references safely
        let aaronApprovedBy = null
        if (v.aaronApprovedById) {
          try {
            aaronApprovedBy = await prisma.user.findUnique({
              where: { id: v.aaronApprovedById },
              select: { id: true, name: true }
            })
          } catch (e) {
            console.error(`Error fetching aaronApprovedBy user:`, e)
          }
        }
        
        let sentBy = null
        if (v.sentById) {
          try {
            sentBy = await prisma.user.findUnique({
              where: { id: v.sentById },
              select: { id: true, name: true }
            })
          } catch (e) {
            console.error(`Error fetching sentBy user:`, e)
          }
        }
        
        return {
          id: v.id,
          version: v.version,
          status: v.status,
          approvedByAaron: v.approvedByAaron,
          aaronApprovedAt: v.aaronApprovedAt,
          aaronApprovedBy,
          sentToClientAt: v.sentToClientAt,
          sentBy,
          emailOpenedAt: v.emailOpenedAt,
          followUpCompletedAt: v.followUpCompletedAt,
          followUpNotes: v.followUpNotes,
          clientDecision: v.clientDecision,
          clientDecidedAt: v.clientDecidedAt,
          clientMessage: v.clientMessage,
          revisionItems: v.revisionItems,
          notes: v.notes,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          assets,
          activityLogs,
          emailCount
        }
      }))
    } catch (queryError) {
      console.error('Error in main query for floorplan versions:', queryError)
      throw queryError
    }
    
    const mappedVersions = versions

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        client: project.client
      },
      versions: mappedVersions,
      currentVersion: mappedVersions.length > 0 ? mappedVersions[0] : null
    })

  } catch (error) {
    console.error('Error fetching floorplan approval versions:', error)
    
    // Return detailed error for debugging - TEMPORARILY include in production
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      meta: (error as any)?.meta,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
    }
    
    return NextResponse.json({
      error: 'Failed to fetch versions',
      details: errorDetails.message,
      // Include debug info temporarily to diagnose production issue
      debug: errorDetails
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: resolvedParams.id,
        orgId: session.user.orgId
      },
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let data = {}
    try {
      const body = await request.text()
      data = body ? JSON.parse(body) : {}
    } catch (error) {
      // Handle empty or invalid JSON body
      data = {}
    }
    const { notes } = data

    // Generate version number
    const existingVersionsCount = await prisma.floorplanApprovalVersion.count({
      where: {
        projectId: resolvedParams.id
      }
    })

    const versionNumber = `v${existingVersionsCount + 1}`

    // Create new floorplan approval version
    const version = await prisma.floorplanApprovalVersion.create({
      data: {
        projectId: resolvedParams.id,
        version: versionNumber,
        status: 'DRAFT',
        approvedByAaron: false,
        clientDecision: 'PENDING',
        notes: notes || null
      }
    })

    // Create initial activity log
    await prisma.floorplanApprovalActivity.create({
      data: {
        versionId: version.id,
        type: 'version_created',
        message: `Floorplan approval ${versionNumber} created`,
        userId: session.user.id,
        metadata: JSON.stringify({
          initialNotes: notes || null
        })
      }
    })

    // Log to main activity log
    await logActivity({
      session,
      action: ActivityActions.PROJECT_UPDATED,
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        action: 'floorplan_approval_version_created',
        versionId: version.id,
        version: versionNumber,
        projectName: project.name,
        clientName: project.client?.name
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      version: {
        id: version.id,
        version: version.version,
        status: version.status,
        approvedByAaron: version.approvedByAaron,
        clientDecision: version.clientDecision,
        notes: version.notes,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt
      }
    })

  } catch (error) {
    console.error('Error creating floorplan approval version:', error)
    return NextResponse.json({
      error: 'Failed to create version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const {
      versionId,
      action,
      notes,
      clientMessage,
      followUpNotes,
      approveByAaron,
      clientDecision,
      revisionItems
    } = data

    if (!versionId) {
      return NextResponse.json({
        error: 'Version ID is required'
      }, { status: 400 })
    }

    // Find the version and verify access
    const version = await prisma.floorplanApprovalVersion.findFirst({
      where: {
        id: versionId,
        projectId: resolvedParams.id,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    let updateData: any = {}
    let activityMessage = ''
    let activityType = 'version_updated'

    // Handle different actions
    switch (action) {
      case 'push_to_approval':
        // Push version from Drawings phase to Approval phase
        updateData.status = 'READY_FOR_CLIENT'
        activityMessage = 'Floorplan pushed to approval phase'
        activityType = 'pushed_to_approval'
        break

      case 'approve_by_aaron':
        updateData.approvedByAaron = true
        updateData.aaronApprovedAt = new Date()
        updateData.aaronApprovedById = session.user.id
        updateData.status = 'READY_FOR_CLIENT'
        activityMessage = 'Aaron approved the floorplan'
        activityType = 'aaron_approved'
        break

      case 'unapprove_by_aaron':
        updateData.approvedByAaron = false
        updateData.aaronApprovedAt = null
        updateData.aaronApprovedById = null
        updateData.status = 'DRAFT'
        activityMessage = 'Aaron approval removed'
        activityType = 'aaron_unapproved'
        break

      case 'send_to_client':
        updateData.sentToClientAt = new Date()
        updateData.sentById = session.user.id
        updateData.status = 'SENT_TO_CLIENT'
        activityMessage = 'Floorplan sent to client'
        activityType = 'sent_to_client'
        break

      case 'mark_as_sent':
        updateData.sentToClientAt = new Date()
        updateData.sentById = session.user.id
        updateData.status = 'SENT_TO_CLIENT'
        updateData.followUpNotes = 'Email sent manually outside of system'
        activityMessage = 'Marked as already sent to client'
        activityType = 'marked_as_sent'
        break

      case 'mark_followup_done':
        updateData.followUpCompletedAt = new Date()
        updateData.followUpNotes = followUpNotes || null
        updateData.status = 'FOLLOW_UP_REQUIRED'
        activityMessage = 'Follow-up completed'
        activityType = 'followup_completed'
        break

      case 'client_decision':
        if (!clientDecision || !['APPROVED', 'REVISION_REQUESTED'].includes(clientDecision)) {
          return NextResponse.json({
            error: 'Valid client decision is required (APPROVED or REVISION_REQUESTED)'
          }, { status: 400 })
        }
        updateData.clientDecision = clientDecision
        updateData.clientDecidedAt = new Date()
        updateData.clientMessage = clientMessage || null
        // Save structured revision items if provided
        if (revisionItems && Array.isArray(revisionItems)) {
          updateData.revisionItems = revisionItems
        }
        updateData.status = clientDecision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED'
        activityMessage = `Client ${clientDecision.toLowerCase().replace('_', ' ')}`
        if (revisionItems?.length) {
          activityMessage += ` with ${revisionItems.length} revision item(s)`
        } else if (clientMessage) {
          activityMessage += `: ${clientMessage}`
        }
        activityType = 'client_decision'
        break

      case 'update_revision_items':
        if (!revisionItems || !Array.isArray(revisionItems)) {
          return NextResponse.json({
            error: 'Revision items array is required'
          }, { status: 400 })
        }
        updateData.revisionItems = revisionItems
        const completedCount = revisionItems.filter((i: any) => i.completed).length
        activityMessage = `Updated revision progress: ${completedCount}/${revisionItems.length} completed`
        activityType = 'revision_items_updated'
        break

      case 'update_notes':
        updateData.notes = notes
        activityMessage = 'Notes updated'
        activityType = 'notes_updated'
        break

      // TODO: Re-enable after running prisma db push on production
      // case 'link_source_file':
      //   const { sourceFilePath, sourceFileName } = data
      //   updateData.sourceFilePath = sourceFilePath || null
      //   updateData.sourceFileName = sourceFileName || null
      //   activityMessage = sourceFilePath 
      //     ? `Linked source CAD file: ${sourceFileName}`
      //     : 'Unlinked source CAD file'
      //   activityType = 'source_file_linked'
      //   break

      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }

    // Update the version
    const updatedVersion = await prisma.floorplanApprovalVersion.update({
      where: { id: versionId },
      data: updateData,
      include: {
        aaronApprovedBy: {
          select: { id: true, name: true }
        },
        sentBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Create activity log
    await prisma.floorplanApprovalActivity.create({
      data: {
        versionId: versionId,
        type: activityType,
        message: activityMessage,
        userId: session.user.id,
        metadata: JSON.stringify({
          action,
          previousStatus: version.status,
          newStatus: updatedVersion.status,
          ...data
        })
      }
    })

    // Log to main activity log
    await logActivity({
      session,
      action: ActivityActions.PROJECT_UPDATED,
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        action: `floorplan_approval_${activityType}`,
        versionId: versionId,
        version: version.version,
        projectName: version.project.name,
        clientName: version.project.client?.name,
        message: activityMessage
      },
      ipAddress
    })

    // Send email notification to Shaya when floorplan is pushed to approval
    if (action === 'push_to_approval') {
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
          const projectName = version.project.name
          const projectUrl = `${baseUrl}/projects/${version.projectId}/floorplan-approval`
          const pushedByName = session.user.name || 'A team member'

          console.log(`[Email] Sending Floorplan Approval notification to Shaya for ${projectName}...`)

          await sendEmail({
            to: shaya.email,
            subject: `${projectName} - Floorplan Ready for Client Approval`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorplan Ready for Client Approval</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 32px; text-align: center;">
            <img src="${baseUrl}/meisnerinteriorlogo.png"
                 alt="Meisner Interiors"
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Floorplan Ready for Approval</h1>
            <p style="margin: 8px 0 0 0; color: #ddd6fe; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>

        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${shaya.name},</p>

            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${pushedByName}</strong> has pushed a floorplan version to <strong>Client Approval</strong>.
            </p>

            <div style="background: #f1f5f9; border-left: 4px solid #8b5cf6; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Project Details</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0; color: #1e293b; font-size: 15px;"><strong>Version:</strong> ${version.version}</p>
            </div>

            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                The floorplan is now ready for you to review and send to the client.
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}"
                   style="background: #8b5cf6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);"
                   target="_blank">View Floorplan</a>
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
            text: `Hi ${shaya.name},\n\n${pushedByName} has pushed a floorplan version to Client Approval.\n\nProject: ${projectName}\nVersion: ${version.version}\n\nThe floorplan is now ready for you to review and send to the client.\n\nView the floorplan: ${projectUrl}\n\nBest regards,\nThe Team`
          })

          console.log(`[Email] Floorplan Approval notification sent to Shaya`)
        } else if (shaya && !shaya.emailNotificationsEnabled) {
          console.log(`[Email] Skipping notification to Shaya (email notifications disabled)`)
        } else {
          console.log(`[Email] Shaya user not found in database`)
        }
      } catch (emailError) {
        console.error('[Email] Failed to send Floorplan Approval notification to Shaya:', emailError)
        // Don't fail the main operation if email notification fails
      }
    }

    // Send email notification to Sami when floorplan revision is requested
    if (action === 'client_decision' && clientDecision === 'REVISION_REQUESTED') {
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
          const baseUrl = getBaseUrl()
          const projectName = version.project.name
          const projectUrl = `${baseUrl}/projects/${version.projectId}/floorplan/drawings`
          const requestedByName = session.user.name || 'A team member'

          console.log(`[Email] Sending Floorplan Revision notification to Sami for ${projectName}...`)

          // Format revision notes for email - use revisionItems if available, otherwise parse clientMessage
          let formattedRevisionNotes = ''
          let plainTextRevisions = ''

          if (revisionItems && Array.isArray(revisionItems) && revisionItems.length > 0) {
            formattedRevisionNotes = revisionItems
              .map((item: any, idx: number) => `<li style="margin: 4px 0; color: #dc2626;">${idx + 1}. ${item.text}</li>`)
              .join('')
            plainTextRevisions = revisionItems
              .map((item: any, idx: number) => `${idx + 1}. ${item.text}`)
              .join('\n')
          } else if (clientMessage) {
            formattedRevisionNotes = clientMessage
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0)
              .map((line: string) => `<li style="margin: 4px 0; color: #dc2626;">${line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')}</li>`)
              .join('')
            plainTextRevisions = clientMessage
          } else {
            formattedRevisionNotes = '<li style="margin: 4px 0; color: #dc2626;">No specific notes provided</li>'
            plainTextRevisions = 'No specific notes provided'
          }

          await sendEmail({
            to: sami.email,
            subject: `${projectName} - Floorplan Revision Requested`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Floorplan Revision Requested</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 32px; text-align: center;">
            <img src="${baseUrl}/meisnerinteriorlogo.png"
                 alt="Meisner Interiors"
                 style="max-width: 200px; height: auto; margin-bottom: 24px; background-color: white; padding: 16px; border-radius: 8px;" />
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Floorplan Revision Requested</h1>
            <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 16px; font-weight: 400;">${projectName}</p>
        </div>

        <div style="padding: 40px 32px;">
            <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px;">Hi ${sami.name},</p>

            <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                <strong>${requestedByName}</strong> has requested revisions for the floorplan <strong>${version.version}</strong>.
            </p>

            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Revisions Needed</p>
                <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 15px;"><strong>Project:</strong> ${projectName}</p>
                <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 15px;"><strong>Version:</strong> ${version.version}</p>
                <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                    ${formattedRevisionNotes}
                </ul>
            </div>

            <p style="margin: 24px 0 0 0; color: #475569; font-size: 15px; line-height: 1.7;">
                Please review the revisions and make the necessary changes to the floorplan.
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}"
                   style="background: #dc2626; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);"
                   target="_blank">View Floorplan</a>
            </div>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <div style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Meisner Interiors Team</div>
            <div style="margin-bottom: 12px;">
                <a href="mailto:projects@meisnerinteriors.com"
                   style="color: #dc2626; text-decoration: none; font-size: 13px; margin: 0 8px;">projects@meisnerinteriors.com</a>
                <span style="color: #cbd5e1;">•</span>
                <a href="tel:+15147976957"
                   style="color: #dc2626; text-decoration: none; font-size: 13px; margin: 0 8px;">514-797-6957</a>
            </div>
            <p style="margin: 0; color: #94a3b8; font-size: 11px;">&copy; 2025 Meisner Interiors. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
            text: `Hi ${sami.name},\n\n${requestedByName} has requested revisions for the floorplan ${version.version}.\n\nProject: ${projectName}\nVersion: ${version.version}\n\nRevisions Needed:\n${plainTextRevisions}\n\nPlease review the revisions and make the necessary changes to the floorplan.\n\nView the floorplan: ${projectUrl}\n\nBest regards,\nThe Team`
          })

          console.log(`[Email] Floorplan Revision notification sent to Sami`)
        } else if (sami && !sami.emailNotificationsEnabled) {
          console.log(`[Email] Skipping notification to Sami (email notifications disabled)`)
        } else {
          console.log(`[Email] Sami user not found in database`)
        }
      } catch (emailError) {
        console.error('[Email] Failed to send Floorplan Revision notification to Sami:', emailError)
        // Don't fail the main operation if email notification fails
      }
    }

    return NextResponse.json({
      success: true,
      version: {
        id: updatedVersion.id,
        version: updatedVersion.version,
        status: updatedVersion.status,
        approvedByAaron: updatedVersion.approvedByAaron,
        aaronApprovedAt: updatedVersion.aaronApprovedAt,
        aaronApprovedBy: updatedVersion.aaronApprovedBy,
        sentToClientAt: updatedVersion.sentToClientAt,
        sentBy: updatedVersion.sentBy,
        emailOpenedAt: updatedVersion.emailOpenedAt,
        followUpCompletedAt: updatedVersion.followUpCompletedAt,
        followUpNotes: updatedVersion.followUpNotes,
        clientDecision: updatedVersion.clientDecision,
        clientDecidedAt: updatedVersion.clientDecidedAt,
        clientMessage: updatedVersion.clientMessage,
        revisionItems: updatedVersion.revisionItems,
        notes: updatedVersion.notes,
        createdAt: updatedVersion.createdAt,
        updatedAt: updatedVersion.updatedAt
      }
    })

  } catch (error) {
    console.error('Error updating floorplan approval version:', error)
    return NextResponse.json({
      error: 'Failed to update version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const versionId = searchParams.get('versionId')

    if (!versionId) {
      return NextResponse.json({
        error: 'Version ID is required'
      }, { status: 400 })
    }

    // Find the version and verify access
    const version = await prisma.floorplanApprovalVersion.findFirst({
      where: {
        id: versionId,
        projectId: resolvedParams.id,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        project: {
          include: {
            client: true
          }
        },
        assets: {
          include: {
            asset: true
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Get asset IDs before deletion (to delete the actual Asset records)
    const assetIds = version.assets.map(a => a.assetId)

    // Delete in transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // 1. Delete activity logs (has cascade but doing explicitly for safety)
      await tx.floorplanApprovalActivity.deleteMany({
        where: { versionId: versionId }
      })

      // 2. Delete email logs
      await tx.floorplanApprovalEmailLog.deleteMany({
        where: { versionId: versionId }
      })

      // 3. Delete version-asset join table records
      await tx.floorplanApprovalAsset.deleteMany({
        where: { versionId: versionId }
      })

      // 4. Delete the actual Asset records (uploaded files metadata)
      if (assetIds.length > 0) {
        await tx.asset.deleteMany({
          where: { id: { in: assetIds } }
        })
      }

      // 5. Finally delete the version
      await tx.floorplanApprovalVersion.delete({
        where: { id: versionId }
      })
    })

    // Log to main activity log
    await logActivity({
      session,
      action: ActivityActions.PROJECT_UPDATED,
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        action: 'floorplan_approval_version_deleted',
        versionId: versionId,
        version: version.version,
        projectName: version.project.name,
        clientName: version.project.client?.name,
        wasPublished: version.status !== 'DRAFT',
        assetCount: version.assets.length
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: `Version ${version.version} deleted successfully`,
      deletedVersion: version.version
    })

  } catch (error) {
    console.error('Error deleting floorplan approval version:', error)
    return NextResponse.json({
      error: 'Failed to delete version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}