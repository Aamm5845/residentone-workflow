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
  // Calculate room progress
  const totalPhases = 5 // Design, 3D, Client Approval, Drawings, FFE
  const completedPhases = room.stages.filter((stage: any) => 
    stage.status === 'COMPLETED'
  ).length
  const progress = Math.round((completedPhases / totalPhases) * 100)

  // Get approved renderings
  const approvedRenderings = room.stages
    .flatMap((stage: any) => stage.renderingVersions)
    .filter((version: any) => version.clientApprovalVersion?.clientDecision === 'APPROVED')

  return {
    id: room.id,
    name: room.name,
    type: room.type,
    status: room.status,
    progress,
    phases: [
      {
        name: 'Design Concept',
        status: getPhaseStatus(room.stages, 'DESIGN_CONCEPT'),
        completedAt: getPhaseCompletedAt(room.stages, 'DESIGN_CONCEPT')
      },
      {
        name: '3D Rendering',
        status: getPhaseStatus(room.stages, 'THREE_D'),
        completedAt: getPhaseCompletedAt(room.stages, 'THREE_D')
      },
      {
        name: 'Client Approval',
        status: getPhaseStatus(room.stages, 'CLIENT_APPROVAL'),
        completedAt: getPhaseCompletedAt(room.stages, 'CLIENT_APPROVAL')
      },
      {
        name: 'Drawings',
        status: getPhaseStatus(room.stages, 'DRAWINGS'),
        completedAt: getPhaseCompletedAt(room.stages, 'DRAWINGS')
      },
      {
        name: 'FFE',
        status: getPhaseStatus(room.stages, 'FFE'),
        completedAt: getPhaseCompletedAt(room.stages, 'FFE')
      }
    ],
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

// Helper function to get phase status
function getPhaseStatus(stages: any[], stageType: string) {
  const stage = stages.find(s => s.type === stageType)
  if (!stage) return 'PENDING'
  
  switch (stage.status) {
    case 'COMPLETED':
      return 'COMPLETED'
    case 'IN_PROGRESS':
      return 'IN_PROGRESS'
    default:
      return 'PENDING'
  }
}

// Helper function to get phase completion date
function getPhaseCompletedAt(stages: any[], stageType: string) {
  const stage = stages.find(s => s.type === stageType)
  return stage?.completedAt || null
}