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

    // Search projects (including by client name)
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { client: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { email: { contains: searchTerm, mode: 'insensitive' } } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
          { streetAddress: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      include: {
        client: {
          select: {
            name: true
          }
        }
      },
      take: 15
    })

    // Search rooms (excluding type enum field from search)
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { project: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { project: { client: { name: { contains: searchTerm, mode: 'insensitive' } } } }
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
      take: 15
    })

    // Search stages (all statuses, not just active) - excluding type enum from search
    const stages = await prisma.stage.findMany({
      where: {
        OR: [
          { room: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { room: { project: { name: { contains: searchTerm, mode: 'insensitive' } } } },
          { room: { project: { client: { name: { contains: searchTerm, mode: 'insensitive' } } } } }
        ]
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

    // Search clients
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } },
          { company: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true
          },
          take: 1
        }
      },
      take: 10
    })

    // Search assets/files
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { userDescription: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      include: {
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
      ...clients.map(client => ({
        id: client.id,
        type: 'client' as const,
        title: client.name,
        subtitle: client.projects.length > 0 ? `Project: ${client.projects[0].name}` : 'No projects',
        href: client.projects.length > 0 ? `/projects/${client.projects[0].id}` : '/projects'
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
      })),
      ...assets.filter(asset => asset.project).map(asset => ({
        id: asset.id,
        type: 'file' as const,
        title: asset.title || 'Untitled File',
        subtitle: asset.project ? `File in ${asset.project.name}` : 'File',
        href: asset.stage ? `/stages/${asset.stage.id}` : asset.project ? `/projects/${asset.project.id}` : '/dashboard'
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
