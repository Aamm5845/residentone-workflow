import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

// GET /api/client-progress/[token] - Get sanitized project data for clients
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || 'Unknown'
    const forwarded = headersList.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0] : headersList.get('x-real-ip') || 'Unknown'

    // Verify the token exists and is active
    const clientAccessToken = await prisma.clientAccessToken.findFirst({
      where: {
        token,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        project: {
          include: {
            client: true,
            rooms: {
              include: {
                stages: {
                  include: {
                    // Only include completed renderings that have been approved by clients
                    renderingVersions: {
                      where: {
                        status: 'PUSHED_TO_CLIENT',
                        clientApprovalVersion: {
                          clientDecision: 'APPROVED'
                        }
                      },
                      include: {
                        assets: {
                          where: {
                            type: {
                              in: ['RENDER', 'IMAGE']
                            }
                          },
                          select: {
                            id: true,
                            title: true,
                            url: true,
                            type: true,
                            description: true,
                            createdAt: true
                          }
                        },
                        clientApprovalVersion: {
                          select: {
                            version: true,
                            clientDecision: true,
                            clientDecidedAt: true,
                            aaronApprovedAt: true
                          }
                        }
                      },
                      orderBy: {
                        createdAt: 'desc'
                      }
                    }
                  },
                  orderBy: {
                    createdAt: 'asc'
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    })

    if (!clientAccessToken) {
      return NextResponse.json({ 
        error: 'Invalid or expired access link' 
      }, { status: 404 })
    }

    // Update last accessed info
    await prisma.clientAccessToken.update({
      where: { id: clientAccessToken.id },
      data: {
        lastAccessedAt: new Date(),
        lastAccessedIP: ipAddress,
        accessCount: {
          increment: 1
        }
      }
    })

    // Log the access
    await prisma.clientAccessLog.create({
      data: {
        tokenId: clientAccessToken.id,
        ipAddress,
        userAgent,
        action: 'VIEW_PROJECT',
        metadata: {
          timestamp: new Date().toISOString(),
          rooms: clientAccessToken.project.rooms.length
        }
      }
    })

    // Process and sanitize the project data for client consumption
    const sanitizedProject = {
      id: clientAccessToken.project.id,
      name: clientAccessToken.project.name,
      description: clientAccessToken.project.description,
      type: clientAccessToken.project.type,
      status: clientAccessToken.project.status,
      client: {
        name: clientAccessToken.project.client.name
      },
      createdAt: clientAccessToken.project.createdAt,
      updatedAt: clientAccessToken.project.updatedAt,
      rooms: clientAccessToken.project.rooms.map(room => processRoomData(room))
    }

    return NextResponse.json({
      success: true,
      project: sanitizedProject,
      tokenInfo: {
        name: clientAccessToken.name,
        createdAt: clientAccessToken.createdAt,
        expiresAt: clientAccessToken.expiresAt,
        lastAccessed: clientAccessToken.lastAccessedAt
      }
    })

  } catch (error) {
    console.error('Error fetching client progress:', error)
    return NextResponse.json({ 
      error: 'Unable to load project progress' 
    }, { status: 500 })
  }
}

// Helper function to process room data
function processRoomData(room: any) {
  // Define the workflow stages in order (handling both DESIGN and DESIGN_CONCEPT types)
  const WORKFLOW_STAGES = [
    { type: 'DESIGN', name: 'Design Concept', alternateTypes: ['DESIGN_CONCEPT'] },
    { type: 'THREE_D', name: '3D Rendering', alternateTypes: [] },
    { type: 'CLIENT_APPROVAL', name: 'Client Approval', alternateTypes: [] },
    { type: 'DRAWINGS', name: 'Drawings', alternateTypes: [] },
    { type: 'FFE', name: 'FFE', alternateTypes: [] }
  ]

  // Calculate room progress based on actual stages
  const totalPhases = WORKFLOW_STAGES.length
  const completedPhases = room.stages.filter((stage: any) => 
    stage.status === 'COMPLETED'
  ).length
  const progress = Math.round((completedPhases / totalPhases) * 100)

  // Get approved renderings
  const approvedRenderings = room.stages
    .flatMap((stage: any) => stage.renderingVersions)
    .filter((version: any) => version.clientApprovalVersion?.clientDecision === 'APPROVED')

  // Create dynamic phases based on actual database stages
  const phases = WORKFLOW_STAGES.map(workflowStage => {
    // Try to find a stage by primary type or alternate types
    const dbStage = room.stages.find((stage: any) => {
      return stage.type === workflowStage.type || 
             workflowStage.alternateTypes.includes(stage.type)
    })
    
    return {
      name: workflowStage.name,
      status: dbStage ? mapStageStatus(dbStage.status) : 'PENDING',
      completedAt: dbStage?.completedAt || null,
      startedAt: dbStage?.startedAt || null
    }
  })

  return {
    id: room.id,
    name: room.name,
    type: room.type,
    status: room.status,
    progress,
    phases,
    approvedRenderings: approvedRenderings.map((version: any) => ({
      id: version.id,
      version: version.version,
      customName: version.customName,
      approvedAt: version.clientApprovalVersion?.clientDecidedAt,
      aaronApprovedAt: version.clientApprovalVersion?.aaronApprovedAt,
      assets: version.assets.map((asset: any) => ({
        id: asset.id,
        title: asset.title,
        url: asset.url,
        type: asset.type,
        description: asset.description,
        createdAt: asset.createdAt
      }))
    }))
  }
}

// Helper function to map database stage status to client-friendly status
function mapStageStatus(dbStatus: string): 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' {
  switch (dbStatus) {
    case 'COMPLETED':
      return 'COMPLETED'
    case 'IN_PROGRESS':
    case 'NEEDS_ATTENTION':
      return 'IN_PROGRESS'
    case 'NOT_STARTED':
    default:
      return 'PENDING'
  }
}
