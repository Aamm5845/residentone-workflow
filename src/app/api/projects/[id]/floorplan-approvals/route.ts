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

    // Get all versions with relations
    // Using try-catch to handle potential orphaned data issues
    let versions: any[] = []
    try {
      versions = await prisma.floorplanApprovalVersion.findMany({
        where: {
          projectId: resolvedParams.id
        },
        include: {
          assets: {
            include: {
              asset: true
            },
            orderBy: [
              { displayOrder: 'asc' },
              { createdAt: 'desc' }
            ]
          },
          activityLogs: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 15
          },
          emailLogs: {
            select: {
              id: true,
              sentAt: true
            },
            orderBy: {
              sentAt: 'desc'
            },
            take: 5
          },
          aaronApprovedBy: {
            select: {
              id: true,
              name: true
            }
          },
          sentBy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
    } catch (fetchError) {
      console.error('Error fetching versions with relations, trying fallback:', fetchError)
      
      // Fallback: fetch versions without problematic relations
      versions = await prisma.floorplanApprovalVersion.findMany({
        where: {
          projectId: resolvedParams.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
      
      // Try to fetch assets separately for each version (skip orphaned ones)
      for (const v of versions) {
        try {
          const assets = await prisma.floorplanApprovalAsset.findMany({
            where: { 
              versionId: v.id,
              asset: { id: { not: undefined } } // Only include if asset exists
            },
            include: { asset: true },
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
          })
          v.assets = assets.filter(a => a.asset !== null) // Filter out any null assets
        } catch (assetError) {
          console.error(`Error fetching assets for version ${v.id}:`, assetError)
          v.assets = []
        }
        
        // Initialize other arrays as empty in fallback mode
        v.activityLogs = []
        v.emailLogs = []
        v.aaronApprovedBy = null
        v.sentBy = null
      }
    }

    const mappedVersions = versions.map(v => ({
      id: v.id,
      version: v.version,
      status: v.status,
      approvedByAaron: v.approvedByAaron,
      aaronApprovedAt: v.aaronApprovedAt,
      aaronApprovedBy: v.aaronApprovedBy || null,
      sentToClientAt: v.sentToClientAt,
      sentBy: v.sentBy || null,
      emailOpenedAt: v.emailOpenedAt,
      followUpCompletedAt: v.followUpCompletedAt,
      followUpNotes: v.followUpNotes,
      clientDecision: v.clientDecision,
      clientDecidedAt: v.clientDecidedAt,
      clientMessage: v.clientMessage,
      notes: v.notes,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      // Filter out assets with null asset property (orphaned records)
      assets: (v.assets || [])
        .filter((a: any) => a && a.asset)
        .map((a: any) => ({
          id: a.id,
          includeInEmail: a.includeInEmail,
          displayOrder: a.displayOrder,
          asset: a.asset
        })),
      activityLogs: v.activityLogs || [],
      emailCount: (v.emailLogs || []).length
    }))

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
      clientDecision
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
        updateData.status = clientDecision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED'
        activityMessage = `Client ${clientDecision.toLowerCase().replace('_', ' ')}`
        if (clientMessage) {
          activityMessage += `: ${clientMessage}`
        }
        activityType = 'client_decision'
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