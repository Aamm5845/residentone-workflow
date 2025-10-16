import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/search - Search across all project content
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('q')
    const type = searchParams.get('type') // 'all', 'updates', 'photos', 'tasks', 'messages'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        error: 'Search query must be at least 2 characters long' 
      }, { status: 400 })
    }

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const searchTerm = query.trim()
    const results: any = {
      query: searchTerm,
      totalResults: 0,
      results: [],
      breakdown: {
        updates: 0,
        photos: 0,
        tasks: 0,
        messages: 0
      }
    }

    // Search in Project Updates
    if (type === 'all' || type === 'updates') {
      const updateResults = await prisma.projectUpdate.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { notes: { contains: searchTerm, mode: 'insensitive' } },
            { location: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          _count: {
            select: {
              photos: true,
              tasks: true,
              messages: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: type === 'updates' ? limit : Math.ceil(limit / 4)
      })

      results.results.push(...updateResults.map(update => ({
        type: 'update',
        id: update.id,
        title: update.title,
        description: update.description,
        content: update.description?.substring(0, 200) + '...',
        createdAt: update.createdAt,
        updatedAt: update.updatedAt,
        author: update.createdBy,
        room: update.room,
        status: update.status,
        category: update.category,
        priority: update.priority,
        counts: update._count,
        url: `/projects/${projectId}/project-updates/${update.id}`
      })))
      
      results.breakdown.updates = updateResults.length
    }

    // Search in Photos
    if (type === 'all' || type === 'photos') {
      const photoResults = await prisma.projectUpdatePhoto.findMany({
        where: {
          projectId,
          OR: [
            { filename: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { location: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          update: {
            select: {
              id: true,
              title: true,
              type: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'photos' ? limit : Math.ceil(limit / 4)
      })

      results.results.push(...photoResults.map(photo => ({
        type: 'photo',
        id: photo.id,
        title: photo.filename,
        description: photo.description,
        content: `Photo: ${photo.filename} - ${photo.description || 'No description'}`,
        createdAt: photo.createdAt,
        author: photo.uploadedBy,
        room: photo.room,
        update: photo.update,
        photoType: photo.type,
        url: photo.url,
        thumbnail: photo.thumbnailUrl,
        location: photo.location,
        pageUrl: `/projects/${projectId}/project-updates/${photo.updateId}#photo-${photo.id}`
      })))
      
      results.breakdown.photos = photoResults.length
    }

    // Search in Tasks
    if (type === 'all' || type === 'tasks') {
      const taskResults = await prisma.projectUpdateTask.findMany({
        where: {
          projectId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { tradeType: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true,
              contactName: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          update: {
            select: {
              id: true,
              title: true,
              type: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: type === 'tasks' ? limit : Math.ceil(limit / 4)
      })

      results.results.push(...taskResults.map(task => ({
        type: 'task',
        id: task.id,
        title: task.title,
        description: task.description,
        content: `Task: ${task.title} - ${task.description || 'No description'}`,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        author: task.createdBy,
        assignee: task.assignee,
        contractor: task.contractor,
        room: task.room,
        update: task.update,
        status: task.status,
        priority: task.priority,
        tradeType: task.tradeType,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        pageUrl: `/projects/${projectId}/project-updates/${task.updateId}#task-${task.id}`
      })))
      
      results.breakdown.tasks = taskResults.length
    }

    // Search in Messages
    if (type === 'all' || type === 'messages') {
      const messageResults = await prisma.projectUpdateMessage.findMany({
        where: {
          projectId,
          content: { contains: searchTerm, mode: 'insensitive' },
          deletedAt: null // Don't include deleted messages
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true
            }
          },
          update: {
            select: {
              id: true,
              title: true,
              type: true
            }
          },
          task: {
            select: {
              id: true,
              title: true
            }
          },
          photo: {
            select: {
              id: true,
              filename: true,
              url: true
            }
          },
          _count: {
            select: {
              replies: true,
              reactions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'messages' ? limit : Math.ceil(limit / 4)
      })

      results.results.push(...messageResults.map(message => ({
        type: 'message',
        id: message.id,
        title: 'Message',
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        author: message.author,
        update: message.update,
        task: message.task,
        photo: message.photo,
        attachments: message.attachments,
        mentions: message.mentions,
        counts: message._count,
        pageUrl: message.updateId 
          ? `/projects/${projectId}/project-updates/${message.updateId}#message-${message.id}`
          : `/projects/${projectId}/messages#message-${message.id}`
      })))
      
      results.breakdown.messages = messageResults.length
    }

    // Sort all results by relevance and date
    results.results.sort((a: any, b: any) => {
      // Prioritize exact title matches
      const aExactMatch = a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0
      const bExactMatch = b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0
      
      if (aExactMatch !== bExactMatch) {
        return bExactMatch - aExactMatch
      }
      
      // Then sort by date
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    })

    // Apply pagination to final results
    const totalResults = results.results.length
    results.results = results.results.slice(skip, skip + limit)
    results.totalResults = totalResults

    // Add search suggestions based on query
    const suggestions = await getSearchSuggestions(projectId, searchTerm)

    return NextResponse.json({
      ...results,
      pagination: {
        page,
        limit,
        total: totalResults,
        totalPages: Math.ceil(totalResults / limit),
        hasNext: page * limit < totalResults,
        hasPrev: page > 1
      },
      suggestions
    })

  } catch (error) {
    console.error('Error searching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate search suggestions
async function getSearchSuggestions(projectId: string, query: string) {
  try {
    // Get common terms from the project
    const [categories, tradeTypes, statuses, roomNames] = await Promise.all([
      prisma.projectUpdate.groupBy({
        by: ['category'],
        where: { 
          projectId,
          category: { not: null }
        },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 5
      }),
      
      prisma.projectUpdateTask.groupBy({
        by: ['tradeType'],
        where: { 
          projectId,
          tradeType: { not: null }
        },
        _count: { tradeType: true },
        orderBy: { _count: { tradeType: 'desc' } },
        take: 5
      }),
      
      prisma.projectUpdate.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
        take: 5
      }),
      
      prisma.room.findMany({
        where: { 
          project: { id: projectId }
        },
        select: { name: true },
        take: 10
      })
    ])

    const suggestions = [
      ...categories.map(c => c.category).filter(Boolean),
      ...tradeTypes.map(t => t.tradeType).filter(Boolean),
      ...statuses.map(s => s.status),
      ...roomNames.map(r => r.name)
    ]

    // Filter suggestions that are similar to current query
    return suggestions
      .filter(suggestion => 
        suggestion && 
        suggestion.toLowerCase() !== query.toLowerCase() &&
        suggestion.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5)

  } catch (error) {
    console.error('Error generating search suggestions:', error)
    return []
  }
}