import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks/project-stages?projectId=xxx
// Returns all stages for rooms in a given project (lightweight endpoint for task creation)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { users: { some: { id: session.user.id } } }
      },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all stages for rooms in this project
    const stages = await prisma.stage.findMany({
      where: {
        room: { projectId }
      },
      select: {
        id: true,
        type: true,
        roomId: true
      },
      orderBy: { type: 'asc' }
    })

    return NextResponse.json({ stages })
  } catch (error) {
    console.error('Error fetching project stages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
