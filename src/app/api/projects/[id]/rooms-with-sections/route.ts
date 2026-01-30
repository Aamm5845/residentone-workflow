import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/rooms-with-sections
 * Get all rooms with their sections for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to user's org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all rooms with their FFE instance and sections
    const rooms = await prisma.room.findMany({
      where: { projectId },
      include: {
        ffeInstance: {
          include: {
            sections: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }]
    })

    // Transform to simpler format
    const transformedRooms = rooms
      .filter(room => room.ffeInstance) // Only rooms with FFE instance
      .map(room => ({
        id: room.id,
        name: room.name || room.type,
        sections: room.ffeInstance?.sections || []
      }))

    return NextResponse.json({ rooms: transformedRooms })

  } catch (error) {
    console.error('Error fetching rooms with sections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}
