import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/test/create-client-token - Create a test client access token
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow OWNER to create test tokens
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized - Owner access required' }, { status: 401 })
    }

    // Find the first project in the database
    const project = await prisma.project.findFirst({
      include: {
        client: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'No projects found. Create a project first.' }, { status: 404 })
    }

    // Create a client access token
    const token = await prisma.clientAccessToken.create({
      data: {
        projectId: project.id,
        token: 'hCOtswIFRGBi3dZ0QGyQMKMeZTDUI0vn', // Use the token from your URL
        name: 'Test Client Access',
        active: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdById: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Test client access token created',
      token: token.token,
      projectId: project.id,
      projectName: project.name,
      clientName: project.client.name,
      url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/client-progress/${token.token}`
    })

  } catch (error) {
    console.error('Error creating test token:', error)
    return NextResponse.json({ 
      error: 'Failed to create test token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}