import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user-specific tasks based on their assignments
    const userTasks = await prisma.stage.findMany({
      where: {
        assignedTo: session.user.id,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_ATTENTION'] },
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          select: {
            type: true,
            name: true,
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: 10
    })

    // Transform stages into task format
    const tasks = (userTasks || []).map(stage => {
      const roomName = stage.room.name || stage.room.type.replace('_', ' ').toLowerCase()
      const isOverdue = stage.dueDate && stage.dueDate < new Date()
      
      return {
        id: stage.id,
        title: `${stage.type.replace('_', ' ')} - ${roomName}`,
        project: stage.room.project.name,
        projectId: stage.room.project.id,
        client: stage.room.project.client.name,
        priority: isOverdue ? 'high' : stage.status === 'NEEDS_ATTENTION' ? 'high' : 'medium',
        dueDate: stage.dueDate,
        status: stage.status,
        stageType: stage.type,
        roomType: stage.room.type,
        roomId: stage.room.project.id // Fixed this to use correct room reference
      }
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Dashboard tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}