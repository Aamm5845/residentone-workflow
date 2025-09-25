import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export interface PendingApprovalDto {
  id: string
  version: string
  stageId: string
  status: string
  createdAt: string
  roomType: string
  roomName?: string
  projectName: string
  clientName: string
  assetCount: number
  createdBy: {
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

    // Get all client approval versions pending Aaron's approval
    const pendingApprovals = await prisma.clientApprovalVersion.findMany({
      where: {
        approvedByAaron: false,
        status: { in: ['DRAFT', 'PENDING_AARON_APPROVAL'] }
      },
      include: {
        stage: {
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
            }
          }
        },
        renderingVersion: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true,
                image: true
              }
            }
          }
        },
        assets: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Oldest first to prioritize
      }
    })

    const response: PendingApprovalDto[] = pendingApprovals.map(approval => {
      const roomName = approval.stage.room.name || 
        approval.stage.room.type.replace('_', ' ').toLowerCase()

      return {
        id: approval.id,
        version: approval.version,
        stageId: approval.stageId,
        status: approval.status,
        createdAt: approval.createdAt.toISOString(),
        roomType: approval.stage.room.type.replace('_', ' ').toLowerCase(),
        roomName,
        projectName: approval.stage.room.project.name,
        clientName: approval.stage.room.project.client.name,
        assetCount: approval.assets.length,
        createdBy: {
          id: approval.renderingVersion?.createdBy?.id || 'unknown',
          name: approval.renderingVersion?.createdBy?.name || 'Unknown',
          role: approval.renderingVersion?.createdBy?.role || 'RENDERER',
          image: approval.renderingVersion?.createdBy?.image || undefined
        }
      }
    })

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('Pending approvals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}