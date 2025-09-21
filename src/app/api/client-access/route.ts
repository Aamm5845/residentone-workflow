import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

// GET /api/client-access?projectId=<projectId> - Get all active tokens for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all active tokens for the project
    const tokens = await prisma.clientAccessToken.findMany({
      where: {
        projectId,
        active: true
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            accessLogs: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ tokens })

  } catch (error) {
    console.error('Error fetching client access tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/client-access - Create a new client access token
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, name, expiresAt } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      },
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate a secure token
    const token = nanoid(32) // 32 characters for security

    // Create the access token
    const clientAccessToken = await prisma.clientAccessToken.create({
      data: {
        projectId,
        token,
        name: name || `${project.client.name} - ${project.name}`,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.user.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'CREATE_CLIENT_ACCESS_TOKEN',
        entity: 'PROJECT',
        entityId: projectId,
        details: {
          tokenId: clientAccessToken.id,
          tokenName: clientAccessToken.name,
          expiresAt: clientAccessToken.expiresAt
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({ 
      success: true, 
      token: clientAccessToken,
      url: `${process.env.NEXTAUTH_URL}/client-progress/${token}`
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating client access token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/client-access - Deactivate a client access token
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('tokenId')

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 })
    }

    // Verify token exists and user has access
    const existingToken = await prisma.clientAccessToken.findFirst({
      where: {
        id: tokenId,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        project: true
      }
    })

    if (!existingToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    // Deactivate the token
    const updatedToken = await prisma.clientAccessToken.update({
      where: { id: tokenId },
      data: { 
        active: false,
        updatedAt: new Date()
      }
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'DEACTIVATE_CLIENT_ACCESS_TOKEN',
        entity: 'PROJECT',
        entityId: existingToken.projectId,
        details: {
          tokenId: existingToken.id,
          tokenName: existingToken.name
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({ 
      success: true, 
      token: updatedToken 
    })

  } catch (error) {
    console.error('Error deactivating client access token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}