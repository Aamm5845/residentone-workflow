import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { logActivity, ActivityActions, EntityTypes, getIPAddress } from '@/lib/attribution'
import { sendEmail } from '@/lib/email/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

const createUpdateSchema = z.object({
  type: z.enum(['GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE']),
  category: z.enum(['GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL']).default('GENERAL'),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).default('MEDIUM'),
  title: z.string().optional(),
  description: z.string().optional(),
  roomId: z.string().optional(),
  location: z.string().optional(),
  gpsCoordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedCost: z.number().optional(),
  timeEstimated: z.number().optional(),
  metadata: z.record(z.any()).optional()
})

const updateFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'REQUIRES_ATTENTION']).optional(),
  type: z.enum(['GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE']).optional(),
  category: z.enum(['GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).optional(),
  roomId: z.string().optional(),
  authorId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional()
})

// GET /api/projects/[id]/updates - Get all updates for a project
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
    const { searchParams } = new URL(request.url)
    
    // Validate filters
    const filters = updateFilterSchema.parse({
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      category: searchParams.get('category'),
      priority: searchParams.get('priority'),
      roomId: searchParams.get('roomId'),
      authorId: searchParams.get('authorId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search')
    })

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

    // Build where clause
    const where: any = {
      projectId,
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.roomId && { roomId: filters.roomId }),
      ...(filters.authorId && { authorId: filters.authorId }),
      ...(filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) })
        }
      },
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { location: { contains: filters.search, mode: 'insensitive' } }
        ]
      })
    }

    // Pagination
    const page = parseInt(filters.page || '1')
    const limit = parseInt(filters.limit || '20')
    const skip = (page - 1) * limit

    // Get updates with relations
    const [updates, total] = await Promise.all([
      prisma.projectUpdate.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
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
          completedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          photos: {
            include: {
              asset: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  type: true,
                  size: true,
                  mimeType: true
                }
              }
            }
          },
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
                  specialty: true
                }
              }
            }
          },
          documents: {
            include: {
              asset: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  type: true,
                  size: true,
                  mimeType: true
                }
              }
            }
          },
          messages: {
            take: 3,
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          _count: {
            select: {
              photos: true,
              tasks: true,
              documents: true,
              messages: true,
              children: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.projectUpdate.count({ where })
    ])

    // Get project stats
    const stats = await prisma.projectUpdate.groupBy({
      by: ['status', 'priority', 'type'],
      where: { projectId },
      _count: true
    })

    const response = {
      updates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat.status] = (acc[stat.status] || 0) + stat._count
          return acc
        }, {} as Record<string, number>),
        byPriority: stats.reduce((acc, stat) => {
          acc[stat.priority] = (acc[stat.priority] || 0) + stat._count
          return acc
        }, {} as Record<string, number>),
        byType: stats.reduce((acc, stat) => {
          acc[stat.type] = (acc[stat.type] || 0) + stat._count
          return acc
        }, {} as Record<string, number>)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching project updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch updates' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/updates - Create a new update
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
    const validatedData = createUpdateSchema.parse(body)

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

    // Create update
    const update = await prisma.projectUpdate.create({
      data: {
        ...validatedData,
        projectId,
        authorId: session.user.id,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined
      },
      include: {
        tasks: true,
        _count: {
          select: {
            tasks: true
          }
        }
      }
    })

    // Fetch author info separately since there's no relation
    const author = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, image: true }
    })

    // Fetch room info if roomId exists
    let room = null
    if (update.roomId) {
      room = await prisma.room.findUnique({
        where: { id: update.roomId },
        select: { id: true, name: true, type: true }
      })
    }

    const responseData = {
      ...update,
      author,
      room,
      _count: {
        photos: 0,
        tasks: update._count.tasks,
        documents: 0,
        messages: 0
      }
    }

    // Create activity log in ProjectUpdateActivity
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: update.id,
        actorId: session.user.id,
        actionType: 'CREATE',
        entityType: 'PROJECT_UPDATE',
        entityId: update.id,
        description: `Created ${validatedData.type.toLowerCase()} update${validatedData.title ? `: ${validatedData.title}` : ''}`
      }
    })
    
    // Also log to main ActivityLog so it shows in the Activities page
    const ipAddress = getIPAddress(request)
    await logActivity({
      session,
      action: ActivityActions.PROJECT_UPDATE_CREATED,
      entity: EntityTypes.PROJECT_UPDATE,
      entityId: update.id,
      details: {
        projectId,
        projectName: project.name,
        updateType: validatedData.type,
        title: validatedData.title || undefined,
        description: validatedData.description || undefined,
        roomId: validatedData.roomId || undefined,
        roomName: room?.name || undefined
      },
      ipAddress
    })

    // Revalidate project updates page
    revalidatePath(`/projects/${projectId}/project-updates`)

    // Send email notifications to all team members
    try {
      // Get all team members for this project's organization
      if (!project.orgId) {
        console.log('[Update Notification] No orgId found, skipping notifications')
      } else {
      const teamMembers = await prisma.user.findMany({
        where: {
          orgId: project.orgId,
          id: { not: session.user.id }, // Exclude the author
          emailNotificationsEnabled: true
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      })

      if (teamMembers.length > 0) {
        const projectUrl = `${getBaseUrl()}/projects/${projectId}/project-updates`
        const authorName = author?.name || session.user.name || 'A team member'
        const updateTypeDisplay = validatedData.type.charAt(0) + validatedData.type.slice(1).toLowerCase()
        
        // Send emails in parallel (non-blocking)
        const emailPromises = teamMembers.map(async (member) => {
          try {
            await sendEmail({
              to: member.email,
              subject: `📢 New ${updateTypeDisplay} Update - ${project.name}`,
              html: generateProjectUpdateEmail({
                recipientName: member.name || 'Team Member',
                authorName,
                projectName: project.name,
                updateType: updateTypeDisplay,
                updateTitle: validatedData.title || undefined,
                updateDescription: validatedData.description || undefined,
                roomName: room?.name || undefined,
                priority: validatedData.priority,
                projectUrl
              }),
              text: `Hi ${member.name},\n\n${authorName} posted a new ${updateTypeDisplay.toLowerCase()} update for ${project.name}${validatedData.title ? `: ${validatedData.title}` : ''}.\n\n${validatedData.description || ''}\n\nView the update: ${projectUrl}\n\nBest regards,\nMeisner Interiors`
            })
            console.log(`[Update Notification] Email sent to ${member.name}`)
          } catch (emailError) {
            console.error(`[Update Notification] Failed to send email to ${member.name}:`, emailError)
          }
        })

        // Don't wait for emails - let them send in background
        Promise.all(emailPromises).catch(err => 
          console.error('[Update Notification] Some emails failed:', err)
        )

        console.log(`[Update Notification] Sending emails to ${teamMembers.length} team members`)
      }
      }
    } catch (notificationError) {
      console.error('[Update Notification] Error sending notifications:', notificationError)
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    console.error('Error creating project update:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create update' },
      { status: 500 }
    )
  }
}

/**
 * Generate HTML email for project update notification
 */
function generateProjectUpdateEmail({
  recipientName,
  authorName,
  projectName,
  updateType,
  updateTitle,
  updateDescription,
  roomName,
  priority,
  projectUrl
}: {
  recipientName: string
  authorName: string
  projectName: string
  updateType: string
  updateTitle?: string
  updateDescription?: string
  roomName?: string
  priority?: string
  projectUrl: string
}) {
  const priorityColors: Record<string, { bg: string; text: string }> = {
    URGENT: { bg: '#fee2e2', text: '#dc2626' },
    HIGH: { bg: '#ffedd5', text: '#ea580c' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    LOW: { bg: '#dcfce7', text: '#16a34a' },
    NORMAL: { bg: '#f1f5f9', text: '#475569' }
  }

  const priorityStyle = priorityColors[priority || 'NORMAL'] || priorityColors.NORMAL

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Project Update - ${projectName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">📢 New Update Posted</h1>
            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${projectName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px 24px;">
            <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px;">
                Hi ${recipientName},
            </p>
            
            <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px;">
                <strong>${authorName}</strong> posted a new <strong>${updateType.toLowerCase()}</strong> update${roomName ? ` for <strong>${roomName}</strong>` : ''}:
            </p>
            
            <!-- Update Card -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #4f46e5;">
                ${updateTitle ? `<h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">${updateTitle}</h3>` : ''}
                ${updateDescription ? `<p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${updateDescription.substring(0, 300)}${updateDescription.length > 300 ? '...' : ''}</p>` : '<p style="margin: 0; color: #6b7280; font-size: 14px; font-style: italic;">No description provided</p>'}
                
                <div style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #4338ca; border-radius: 20px; font-size: 12px; font-weight: 500;">
                        ${updateType}
                    </span>
                    ${priority ? `<span style="display: inline-block; padding: 4px 12px; background: ${priorityStyle.bg}; color: ${priorityStyle.text}; border-radius: 20px; font-size: 12px; font-weight: 500;">
                        ${priority}
                    </span>` : ''}
                </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="${projectUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    View Update →
                </a>
            </div>
            
            <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">
                You're receiving this because you're a team member on this project.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Meisner Interiors. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`
}