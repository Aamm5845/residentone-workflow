import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export interface RecentCompletionDto {
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

    // Get the last 10 completed stages
    const recentCompletions = await prisma.stage.findMany({
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
      },
      take: 10
    })

    const response: RecentCompletionDto[] = recentCompletions
      .filter(stage => stage.completedBy)
      .map(stage => {
        const roomName = stage.room.name || 
          stage.room.type.replace('_', ' ').toLowerCase()

        // Format stage type properly
        const formatStageType = (type: string) => {
          switch (type) {
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
              return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
          }
        }

        return {
          id: stage.id,
          stageType: formatStageType(stage.type),
          roomType: stage.room.type.replace('_', ' ').toLowerCase(),
          roomName,
          clientName: stage.room.project.client.name,
          projectName: stage.room.project.name,
          completedAt: stage.completedAt!.toISOString(),
          completedBy: {
            id: stage.completedBy!.id,
            name: stage.completedBy!.name || 'Unknown',
            role: stage.completedBy!.role,
            image: stage.completedBy!.image || undefined
          }
        }
      })

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Recent completions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}