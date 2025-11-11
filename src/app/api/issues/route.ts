import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'
import { put } from '@vercel/blob'

// Get all issues for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Filter by status
    const assignedTo = searchParams.get('assignedTo') // Filter by assignee
    const projectId = searchParams.get('projectId') // Filter by project
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (status && status !== 'all') {
      where.status = status
    }
    
    if (assignedTo && assignedTo !== 'all') {
      where.assignedTo = assignedTo
    }
    
    if (projectId) {
      where.projectId = projectId
    }

    const [issues, totalCount] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' }, // High priority first
          { createdAt: 'desc' }  // Then newest first
        ],
        include: {
          reporter: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
          assignee: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
          resolver: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
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
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      }),
      prisma.issue.count({ where })
    ])

    return NextResponse.json({
      issues,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching issues:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new issue
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if request is FormData (contains image) or JSON
    const contentType = request.headers.get('content-type') || ''
    const isFormData = contentType.includes('multipart/form-data')

    let title: string
    let description: string
    let type: string = 'GENERAL'
    let priority: string = 'MEDIUM'
    let projectId: string | null = null
    let roomId: string | null = null
    let stageId: string | null = null
    let consoleLog: string | undefined
    let imageFile: File | null = null

    if (isFormData) {
      // Parse FormData
      const formData = await request.formData()
      title = formData.get('title') as string
      description = formData.get('description') as string
      type = (formData.get('type') as string) || 'GENERAL'
      priority = (formData.get('priority') as string) || 'MEDIUM'
      projectId = formData.get('projectId') as string | null
      roomId = formData.get('roomId') as string | null
      stageId = formData.get('stageId') as string | null
      consoleLog = formData.get('consoleLog') as string | undefined
      imageFile = formData.get('image') as File | null

      // Validate image if present
      if (imageFile) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        const maxSize = 4 * 1024 * 1024 // 4MB

        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json({ 
            error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' 
          }, { status: 400 })
        }

        if (imageFile.size > maxSize) {
          return NextResponse.json({ 
            error: 'File too large. Maximum size is 4MB' 
          }, { status: 400 })
        }
      }
    } else {
      // Parse JSON (legacy support)
      const data = await request.json()
      title = data.title
      description = data.description
      type = data.type || 'GENERAL'
      priority = data.priority || 'MEDIUM'
      projectId = data.projectId || null
      roomId = data.roomId || null
      stageId = data.stageId || null
      consoleLog = data.metadata?.consoleLog
    }

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json({ 
        error: 'Title and description are required' 
      }, { status: 400 })
    }

    // Get organization (using first org for shared workspace)
    const organization = await prisma.organization.findFirst()

    // Build metadata object
    const metadata: any = {}
    if (consoleLog) {
      metadata.consoleLog = consoleLog
    }

    // Create the issue first
    const issue = await prisma.issue.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        status: 'OPEN',
        reportedBy: session.user.id,
        orgId: organization?.id || null,
        projectId: projectId || null,
        roomId: roomId || null,
        stageId: stageId || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      },
      include: {
        reporter: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
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
      }
    })

    // Upload image to Vercel Blob if provided
    if (imageFile) {
      try {
        const timestamp = Date.now()
        const fileExtension = imageFile.name.split('.').pop() || 'jpg'
        const sanitizedFilename = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`
        const blobPath = `issues/${issue.id}/${sanitizedFilename}`

        console.log('[Issues API] Uploading image to Blob:', blobPath)
        
        const blob = await put(blobPath, imageFile, {
          access: 'public',
          contentType: imageFile.type
        })

        console.log('[Issues API] Image uploaded successfully:', blob.url)

        // Update issue with image URL
        const updatedIssue = await prisma.issue.update({
          where: { id: issue.id },
          data: {
            metadata: {
              ...(issue.metadata as object || {}),
              imageUrl: blob.url
            }
          },
          include: {
            reporter: {
              select: { 
                id: true, 
                name: true, 
                email: true,
                role: true,
                image: true
              }
            },
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
          }
        })

        // Log the activity
        await logActivity({
          session,
          action: 'ISSUE_CREATED',
          entity: EntityTypes.PROJECT,
          entityId: updatedIssue.id,
          details: {
            title: updatedIssue.title,
            type: updatedIssue.type,
            priority: updatedIssue.priority,
            projectId: updatedIssue.projectId,
            roomId: updatedIssue.roomId,
            stageId: updatedIssue.stageId,
            hasImage: true
          },
          ipAddress
        })

        return NextResponse.json(updatedIssue, { status: 201 })
      } catch (blobError) {
        console.error('[Issues API] Failed to upload image to Blob (non-fatal):', blobError)
        // Return issue without image - don't fail the entire request
      }
    }

    // Log the activity (without image)
    await logActivity({
      session,
      action: 'ISSUE_CREATED',
      entity: EntityTypes.PROJECT,
      entityId: issue.id,
      details: {
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        projectId: issue.projectId,
        roomId: issue.roomId,
        stageId: issue.stageId
      },
      ipAddress
    })

    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    console.error('Error creating issue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
