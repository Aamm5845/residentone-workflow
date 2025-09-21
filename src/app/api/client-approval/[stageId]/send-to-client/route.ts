import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendClientApprovalEmail } from '@/lib/email-service'

// POST /api/client-approval/[stageId]/send-to-client - Send renderings to client
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { selectedAssetIds, customMessage } = body

    // Get the current version with stage and project details
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
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
            asset: true
          },
          where: selectedAssetIds ? {
            id: {
              in: selectedAssetIds
            }
          } : undefined
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    if (!currentVersion.approvedByAaron) {
      return NextResponse.json({ error: 'Rendering must be approved by Aaron first' }, { status: 400 })
    }

    const project = currentVersion.stage.room.project
    const client = project.client

    if (!client?.email) {
      return NextResponse.json({ error: 'Client email not found' }, { status: 400 })
    }

    // Prepare assets for email
    const assets = currentVersion.assets.map(({ asset }) => ({
      id: asset.id,
      url: asset.url,
      includeInEmail: true // All selected assets should be included
    }))

    // Send email using new email service
    const emailLogId = await sendClientApprovalEmail({
      versionId: currentVersion.id,
      clientEmail: client.email,
      clientName: client.name,
      projectName: project.name,
      assets
    })

    // Update version status
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        sentToClientAt: new Date(),
        sentById: session.user.id,
        status: 'SENT'
      },
      include: {
        assets: true,
        emailLogs: true
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'EMAIL_SENT',
        message: `Renderings sent to client (${client.email})`,
        userId: session.user.id,
        timestamp: new Date()
      }
    })

    return NextResponse.json({ 
      version: updatedVersion,
      emailLogId
    })

  } catch (error) {
    console.error('Error sending to client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}