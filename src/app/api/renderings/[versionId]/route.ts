import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// GET /api/renderings/[versionId] - Get a specific rendering version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams

    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
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
          select: { id: true, version: true, status: true }
        },
        room: {
          select: { id: true, name: true, type: true, project: { select: { id: true, name: true } } }
        },
        stage: {
          select: { id: true, type: true, status: true }
        }
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    return NextResponse.json(renderingVersion)
  } catch (error) {
    console.error('Error fetching rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/renderings/[versionId] - Update rendering version
export async function PATCH(
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
    const data = await request.json()
    const { action, customName } = data

    // Verify rendering version access
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Check if version is pushed to client (restrict certain actions)
    const isPushedToClient = renderingVersion.status === 'PUSHED_TO_CLIENT'

    let updateData: any = {}
    let activityAction: string = ActivityActions.UPDATE
    let activityMessage = ''

    if (action === 'complete') {
      updateData = withCompletionAttribution(session, {
        status: 'COMPLETED'
      })
      activityAction = ActivityActions.COMPLETE
      activityMessage = `Version ${renderingVersion.version} marked complete`
    } else if (action === 'reopen') {
      updateData = withUpdateAttribution(session, {
        status: 'IN_PROGRESS',
        completedAt: null,
        completedById: null
      })
      activityAction = ActivityActions.UPDATE
      activityMessage = `Version ${renderingVersion.version} reopened`
    } else if (action === 'rename' && customName !== undefined) {
      if (isPushedToClient) {
        return NextResponse.json({ error: 'Cannot rename version after pushing to client' }, { status: 403 })
      }
      updateData = withUpdateAttribution(session, {
        customName: customName || null
      })
      activityAction = ActivityActions.UPDATE
      activityMessage = customName 
        ? `Version ${renderingVersion.version} renamed to "${customName}"`
        : `Version ${renderingVersion.version} name reset to default`
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedVersion = await prisma.renderingVersion.update({
      where: { id: versionId },
      data: updateData,
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
          select: { id: true, version: true, status: true }
        }
      }
    })

    // Log activity
    await logActivity({
      session,
      action: activityAction,
      entity: 'RENDERING_VERSION',
      entityId: versionId,
      details: {
        action,
        version: renderingVersion.version,
        customName,
        roomName: renderingVersion.room.name || renderingVersion.room.type,
        projectName: renderingVersion.room.project.name,
        message: activityMessage
      },
      ipAddress
    })

    return NextResponse.json(updatedVersion)
  } catch (error) {
    console.error('Error updating rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/renderings/[versionId] - Delete rendering version
export async function DELETE(
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

    // Verify rendering version access and get details
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: versionId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          include: {
            project: true
          }
        },
        clientApprovalVersion: true
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Check if version is pushed to client
    if (renderingVersion.status === 'PUSHED_TO_CLIENT' || renderingVersion.clientApprovalVersion) {
      return NextResponse.json({ 
        error: 'Cannot delete version after pushing to client approval' 
      }, { status: 403 })
    }

    // Delete the rendering version (will cascade to assets and notes)
    await prisma.renderingVersion.delete({
      where: { id: versionId }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.DELETE,
      entity: 'RENDERING_VERSION',
      entityId: versionId,
      details: {
        version: renderingVersion.version,
        customName: renderingVersion.customName,
        roomName: renderingVersion.room.name || renderingVersion.room.type,
        projectName: renderingVersion.room.project.name,
        message: `Version ${renderingVersion.version} deleted`
      },
      ipAddress
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}