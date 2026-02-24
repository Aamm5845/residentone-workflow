import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const exportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv', 'json']),
  type: z.enum(['full-report', 'updates-only', 'photos-only', 'tasks-only', 'timeline-only']),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).optional(),
  includePhotos: z.boolean().optional().default(true),
  includePrivateNotes: z.boolean().optional().default(false)
})

// POST /api/projects/[id]/export - Generate project export
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = exportSchema.parse(body)

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build date filter if provided
    const dateFilter = validatedData.dateRange ? {
      createdAt: {
        ...(validatedData.dateRange.from && { gte: new Date(validatedData.dateRange.from) }),
        ...(validatedData.dateRange.to && { lte: new Date(validatedData.dateRange.to) })
      }
    } : {}

    // Collect data based on export type
    let exportData: any = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        createdBy: project.createdBy,
        organization: project.organization,
        exportedAt: new Date().toISOString(),
        exportedBy: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email
        }
      }
    }

    // Get project updates
    if (['full-report', 'updates-only'].includes(validatedData.type)) {
      const updates = await prisma.projectUpdate.findMany({
        where: {
          projectId,
          ...dateFilter
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          photos: validatedData.includePhotos ? {
            select: {
              id: true,
              filename: true,
              url: true,
              thumbnailUrl: true,
              type: true,
              description: true,
              location: true,
              metadata: true,
              createdAt: true
            }
          } : false,
          tasks: {
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              contractor: {
                select: {
                  id: true,
                  businessName: true,
                  contactName: true,
                  email: true
                }
              }
            }
          },
          messages: {
            where: {
              deletedAt: null
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: {
              photos: true,
              tasks: true,
              messages: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      exportData.updates = updates
      exportData.stats = {
        totalUpdates: updates.length,
        totalPhotos: updates.reduce((sum, u) => sum + u._count.photos, 0),
        totalTasks: updates.reduce((sum, u) => sum + u._count.tasks, 0),
        totalMessages: updates.reduce((sum, u) => sum + u._count.messages, 0)
      }
    }

    // Get photos only
    if (['full-report', 'photos-only'].includes(validatedData.type)) {
      const photos = await prisma.projectUpdatePhoto.findMany({
        where: {
          projectId,
          ...dateFilter
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true
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
        orderBy: { createdAt: 'desc' }
      })

      exportData.photos = photos
      exportData.photoStats = {
        totalPhotos: photos.length,
        byType: photos.reduce((acc, photo) => {
          acc[photo.type] = (acc[photo.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        byRoom: photos.reduce((acc, photo) => {
          const roomName = photo.room?.name || 'No Room'
          acc[roomName] = (acc[roomName] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }

    // Get tasks only
    if (['full-report', 'tasks-only'].includes(validatedData.type)) {
      const tasks = await prisma.projectUpdateTask.findMany({
        where: {
          projectId,
          ...dateFilter
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true,
              contactName: true,
              email: true,
              phone: true,
              specialty: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
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
        orderBy: { createdAt: 'desc' }
      })

      exportData.tasks = tasks
      exportData.taskStats = {
        totalTasks: tasks.length,
        byStatus: tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        byPriority: tasks.reduce((acc, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        completedTasks: tasks.filter(t => t.status === 'DONE').length,
        overdueTasks: tasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
        ).length,
        totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
        totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
        totalEstimatedCost: tasks.reduce((sum, t) => sum + (t.estimatedCost || 0), 0),
        totalActualCost: tasks.reduce((sum, t) => sum + (t.actualCost || 0), 0)
      }
    }

    // Get activity timeline
    if (['full-report', 'timeline-only'].includes(validatedData.type)) {
      const activities = await prisma.projectUpdateActivity.findMany({
        where: {
          projectId,
          ...dateFilter
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          update: {
            select: {
              id: true,
              title: true,
              type: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Limit to recent 1000 activities for performance
      })

      exportData.timeline = activities
      exportData.timelineStats = {
        totalActivities: activities.length,
        byActionType: activities.reduce((acc, activity) => {
          acc[activity.actionType] = (acc[activity.actionType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        byEntityType: activities.reduce((acc, activity) => {
          acc[activity.entityType] = (acc[activity.entityType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        mostActiveUsers: Object.entries(
          activities.reduce((acc, activity) => {
            const userName = activity.actor?.name || 'Unknown'
            acc[userName] = (acc[userName] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        )
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
      }
    }

    // Return appropriate format
    switch (validatedData.format) {
      case 'json':
        return NextResponse.json(exportData)

      case 'csv':
        // For CSV, we'll need to flatten the data structure
        const csvData = await generateCSVExport(exportData, validatedData.type)
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${project.name}-export-${Date.now()}.csv"`
          }
        })

      case 'excel':
        // TODO: Implement Excel generation using a library like exceljs
        return NextResponse.json({ 
          error: 'Excel export not yet implemented',
          message: 'Please use CSV format for now'
        }, { status: 501 })

      case 'pdf':
        // TODO: Implement PDF generation using a library like puppeteer or jsPDF
        return NextResponse.json({ 
          error: 'PDF export not yet implemented',
          message: 'Please use JSON or CSV format for now'
        }, { status: 501 })

      default:
        return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error exporting project data:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate CSV export
async function generateCSVExport(data: any, type: string): Promise<string> {
  let csv = ''
  
  switch (type) {
    case 'updates-only':
      if (data.updates) {
        csv = 'ID,Title,Description,Type,Status,Category,Priority,Location,Created By,Room,Created At,Updated At\n'
        csv += data.updates.map((update: any) =>
          [
            update.id,
            `"${update.title}"`,
            `"${update.description || ''}"`,
            update.type,
            update.status,
            update.category || '',
            update.priority || '',
            `"${update.location || ''}"`,
            `"${update.createdBy?.name || ''}"`,
            `"${update.room?.name || ''}"`,
            update.createdAt,
            update.updatedAt
          ].join(',')
        ).join('\n')
      }
      break
      
    case 'tasks-only':
      if (data.tasks) {
        csv = 'ID,Title,Description,Status,Priority,Trade Type,Assignee,Contractor,Due Date,Estimated Hours,Actual Hours,Estimated Cost,Actual Cost,Created At,Completed At\n'
        csv += data.tasks.map((task: any) =>
          [
            task.id,
            `"${task.title}"`,
            `"${task.description || ''}"`,
            task.status,
            task.priority,
            task.tradeType || '',
            `"${task.assignee?.name || ''}"`,
            `"${task.contractor?.businessName || ''}"`,
            task.dueDate || '',
            task.estimatedHours || 0,
            task.actualHours || 0,
            task.estimatedCost || 0,
            task.actualCost || 0,
            task.createdAt,
            task.completedAt || ''
          ].join(',')
        ).join('\n')
      }
      break
      
    case 'photos-only':
      if (data.photos) {
        csv = 'ID,Filename,Type,Description,Location,Room,Uploaded By,Created At,URL\n'
        csv += data.photos.map((photo: any) =>
          [
            photo.id,
            `"${photo.filename}"`,
            photo.type,
            `"${photo.description || ''}"`,
            `"${photo.location || ''}"`,
            `"${photo.room?.name || ''}"`,
            `"${photo.uploadedBy?.name || ''}"`,
            photo.createdAt,
            photo.url
          ].join(',')
        ).join('\n')
      }
      break
      
    case 'timeline-only':
      if (data.timeline) {
        csv = 'Date,Actor,Action Type,Entity Type,Description,Update Title\n'
        csv += data.timeline.map((activity: any) =>
          [
            activity.createdAt,
            `"${activity.actor?.name || ''}"`,
            activity.actionType,
            activity.entityType,
            `"${activity.description}"`,
            `"${activity.update?.title || ''}"`
          ].join(',')
        ).join('\n')
      }
      break
      
    default:
      // Full report - combine all data types
      csv = 'Export Type,Data\n'
      csv += `"Project Name","${data.project.name}"\n`
      csv += `"Project Status","${data.project.status}"\n`
      csv += `"Total Updates","${data.stats?.totalUpdates || 0}"\n`
      csv += `"Total Photos","${data.stats?.totalPhotos || 0}"\n`
      csv += `"Total Tasks","${data.stats?.totalTasks || 0}"\n`
      csv += `"Total Messages","${data.stats?.totalMessages || 0}"\n`
      csv += `"Exported At","${data.project.exportedAt}"\n`
      csv += `"Exported By","${data.project.exportedBy.name}"\n`
  }
  
  return csv
}