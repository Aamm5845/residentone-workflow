import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query.toLowerCase()

    // Search projects
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { client: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      take: 10
    })

    // Search rooms
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { type: { contains: searchTerm.toUpperCase() } }
        ]
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                name: true
              }
            }
          }
        }
      },
      take: 10
    })

    // Search stages (tasks)
    const stages = await prisma.stage.findMany({
      where: {
        OR: [
          { type: { contains: searchTerm.toUpperCase() } },
          { room: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { room: { project: { name: { contains: searchTerm, mode: 'insensitive' } } } }
        ],
        status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_ATTENTION', 'PENDING_APPROVAL'] }
      },
      include: {
        room: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      take: 10
    })

    // Format results
    const results = [
      ...projects.map(project => ({
        id: project.id,
        type: 'project' as const,
        title: project.name,
        subtitle: `Client: ${project.client.name}`,
        href: `/projects/${project.id}`
      })),
      ...rooms.map(room => ({
        id: room.id,
        type: 'room' as const,
        title: room.name || room.type.replace('_', ' '),
        subtitle: `${room.project.name} • ${room.project.client.name}`,
        href: `/projects/${room.project.id}/rooms/${room.id}`
      })),
      ...stages.map(stage => ({
        id: stage.id,
        type: 'stage' as const,
        title: `${formatStageType(stage.type)} - ${stage.room.name || stage.room.type.replace('_', ' ')}`,
        subtitle: `${stage.room.project.name} • ${stage.room.project.client.name}`,
        href: `/stages/${stage.id}`
      }))
    ]

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    )
  }
}

function formatStageType(type: string): string {
  switch (type) {
    case 'THREE_D':
      return '3D Rendering'
    case 'DESIGN_CONCEPT':
    case 'DESIGN':
      return 'Design Concept'
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
