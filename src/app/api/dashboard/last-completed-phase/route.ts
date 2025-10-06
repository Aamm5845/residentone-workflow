import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export interface LastCompletedPhaseDto {
  id: string
  stageType: string
  roomType: string
  roomName?: string
  clientName: string
  projectName: string
  completedAt: string
  completedBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the most recent completed stage
    const lastCompletedStage = await prisma.stage.findFirst({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        completedById: { not: null }
      },
      include: {
        room: {
          select: {
            type: true,
            name: true,
            project: {
              select: {
                name: true,
                client: {
                  select: { name: true }
                }
              }
            }
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    })

    if (!lastCompletedStage || !lastCompletedStage.completedBy) {
      return NextResponse.json({ data: null })
    }

    const roomName = lastCompletedStage.room.name || 
      lastCompletedStage.room.type.replace('_', ' ').toLowerCase()

    // Format stage type properly
    const formatStageType = (type: string) => {
      switch (type.toUpperCase()) {
        case 'DESIGN_CONCEPT':
        case 'DESIGN':
          return 'Design Concept'
        case 'THREE_D':
        case 'RENDERING':
          return '3D Rendering'
        case 'CLIENT_APPROVAL':
          return 'Client Approval'
        case 'DRAWINGS':
          return 'Drawings'
        case 'FFE':
          return 'FFE'
        default:
          // Special case for three_d variations
          if (type.toUpperCase().includes('THREE') || type.toUpperCase().includes('3D')) {
            return '3D Rendering'
          }
          return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
      }
    }

    const response: LastCompletedPhaseDto = {
      id: lastCompletedStage.id,
      stageType: formatStageType(lastCompletedStage.type),
      roomType: lastCompletedStage.room.type.replace('_', ' ').toLowerCase(),
      roomName,
      clientName: lastCompletedStage.room.project.client.name,
      projectName: lastCompletedStage.room.project.name,
      completedAt: lastCompletedStage.completedAt!.toISOString(),
      completedBy: {
        id: lastCompletedStage.completedBy.id,
        name: lastCompletedStage.completedBy.name || 'Unknown',
        role: lastCompletedStage.completedBy.role,
        image: lastCompletedStage.completedBy.image || undefined
      }
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Last completed phase error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
