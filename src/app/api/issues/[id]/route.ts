import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// Get a specific issue
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

    const issue = await prisma.issue.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        reporter: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        assignee: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        resolver: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        stage: {
          select: {
            id: true,
            type: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    return NextResponse.json(issue)
  } catch (error) {
    console.error('Error fetching issue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update an issue
export async function PATCH(
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

    const data = await request.json()
    const { 
      title,
      description,
      type,
      priority,
      status,
      assignedTo,
      metadata
    } = data

    // Get the current issue to check permissions and log changes
    const currentIssue = await prisma.issue.findFirst({
      where: { id: resolvedParams.id }
    })

    if (!currentIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions - only reporter, assignee, or admins can update
    const canUpdate = 
      currentIssue.reportedBy === session.user.id ||
      currentIssue.assignedTo === session.user.id ||
      ['ADMIN', 'OWNER'].includes(session.user.role)

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (type !== undefined) updateData.type = type
    if (priority !== undefined) updateData.priority = priority
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    // Safely merge metadata to preserve existing fields like imageUrl and consoleLog
    if (metadata !== undefined) {
      updateData.metadata = {
        ...(currentIssue.metadata as object || {}),
        ...metadata
      }
    }

    // Handle status changes
    if (status !== undefined) {
      updateData.status = status
      
      if (status === 'RESOLVED' && currentIssue.status !== 'RESOLVED') {
        updateData.resolvedBy = session.user.id
        updateData.resolvedAt = new Date()
      } else if (status === 'CLOSED' && currentIssue.status !== 'CLOSED') {
        updateData.closedAt = new Date()
        if (!currentIssue.resolvedBy) {
          updateData.resolvedBy = session.user.id
          updateData.resolvedAt = new Date()
        }
      } else if (status !== 'RESOLVED' && status !== 'CLOSED') {
        // If reopening, clear resolved fields
        updateData.resolvedBy = null
        updateData.resolvedAt = null
        updateData.closedAt = null
      }
    }

    const updatedIssue = await prisma.issue.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        reporter: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        assignee: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        resolver: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    // Log the activity
    let activityAction = 'ISSUE_UPDATED'
    if (status === 'RESOLVED' && currentIssue.status !== 'RESOLVED') {
      activityAction = 'ISSUE_RESOLVED'
    } else if (status === 'CLOSED' && currentIssue.status !== 'CLOSED') {
      activityAction = 'ISSUE_CLOSED'
    }

    await logActivity({
      session,
      action: activityAction,
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        title: updatedIssue.title,
        previousStatus: currentIssue.status,
        newStatus: updatedIssue.status,
        changes: Object.keys(data)
      },
      ipAddress
    })

    return NextResponse.json(updatedIssue)
  } catch (error) {
    console.error('Error updating issue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete an issue
export async function DELETE(
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

    // Get the issue to check permissions
    const issue = await prisma.issue.findFirst({
      where: { id: resolvedParams.id }
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions - only reporter or admins can delete
    const canDelete = 
      issue.reportedBy === session.user.id ||
      ['ADMIN', 'OWNER'].includes(session.user.role)

    if (!canDelete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Delete the issue (cascade will delete comments)
    await prisma.issue.delete({
      where: { id: resolvedParams.id }
    })

    // Log the activity
    await logActivity({
      session,
      action: 'ISSUE_DELETED',
      entity: EntityTypes.PROJECT,
      entityId: resolvedParams.id,
      details: {
        title: issue.title,
        type: issue.type,
        status: issue.status
      },
      ipAddress
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting issue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}