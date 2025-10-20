import { NextRequest, NextResponse } from 'next/server'
import { verifyClientApprovalToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

// GET /api/client-approval/public/[token] - Get client approval data using token (public route)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params

    // Verify and decode the token
    const payload = verifyClientApprovalToken(token)
    
    // Get the client approval version with assets
    const version = await prisma.clientApprovalVersion.findUnique({
      where: { id: payload.versionId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        },
        assets: {
          include: {
            asset: {
              include: {
                uploadedByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          where: {
            includeInEmail: true
          },
          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Approval version not found' }, { status: 404 })
    }

    // Check if client email matches the token
    if (version.stage.room.project.client?.email !== payload.clientEmail) {
      return NextResponse.json({ error: 'Invalid token for this client' }, { status: 403 })
    }

    // Check if already decided
    const alreadyDecided = version.status === 'CLIENT_APPROVED' || version.status === 'REVISION_REQUESTED'

    // Update email opened timestamp if this is the first time
    if (!version.emailOpenedAt) {
      await prisma.clientApprovalVersion.update({
        where: { id: version.id },
        data: { emailOpenedAt: new Date() }
      })
    }

    // Get existing client approval if any
    const existingApproval = await prisma.clientApproval.findFirst({
      where: {
        versionId: version.id,
        approvedBy: payload.clientEmail
      }
    })

    return NextResponse.json({
      version: {
        id: version.id,
        status: version.status,
        sentToClientAt: version.sentToClientAt,
        emailOpenedAt: version.emailOpenedAt || new Date(),
        assets: version.assets,
        stage: {
          id: version.stage.id,
          type: version.stage.type,
          room: {
            id: version.stage.room.id,
            name: version.stage.room.name,
            type: version.stage.room.type,
            project: {
              id: version.stage.room.project.id,
              name: version.stage.room.project.name,
              client: {
                id: version.stage.room.project.client?.id,
                name: version.stage.room.project.client?.name,
                email: version.stage.room.project.client?.email
              }
            }
          }
        }
      },
      clientInfo: {
        name: payload.clientName,
        email: payload.clientEmail
      },
      alreadyDecided,
      existingApproval,
      canDecide: !alreadyDecided
    })

  } catch (error) {
    console.error('Error fetching public client approval:', error)
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}