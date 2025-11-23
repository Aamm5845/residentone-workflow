import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateMeisnerDeliveryEmailTemplate } from '@/lib/email-templates'

// GET /api/client-approval/[stageId]/email-preview - Get email preview before sending
export async function GET(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const { searchParams } = new URL(request.url)
    const selectedAssetIdsParam = searchParams.get('selectedAssetIds')
    const selectedAssetIds = selectedAssetIdsParam ? selectedAssetIdsParam.split(',') : []

    // Get the current version
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId
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
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const client = currentVersion.stage.room.project.client
    if (!client?.email || !client?.name) {
      return NextResponse.json({ error: 'Client email or name not found' }, { status: 400 })
    }

    // Filter assets based on selected IDs
    const emailAssets = currentVersion.assets
      .filter(asset => {
        if (selectedAssetIds.length > 0) {
          return selectedAssetIds.includes(asset.id)
        }
        return asset.includeInEmail
      })
      .map((assetItem) => {
        const viewableUrl = assetItem.blobUrl || assetItem.asset.url
        return {
          id: assetItem.id,
          url: viewableUrl,
          includeInEmail: true
        }
      })

    // Generate placeholder approval URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const placeholderApprovalUrl = `${baseUrl}/client-progress/placeholder`

    // Generate email template
    const templateData = {
      clientName: client.name,
      projectName: currentVersion.stage.room.project.name,
      approvalUrl: placeholderApprovalUrl,
      assets: emailAssets,
      roomName: currentVersion.stage.room.name || currentVersion.stage.room.type,
      designPhase: 'Design Showcase',
      trackingPixelUrl: `${baseUrl}/api/email/track/preview`
    }

    const projectAddress = currentVersion.stage.room.project.address
    if (projectAddress && projectAddress.trim() !== '') {
      templateData.projectAddress = projectAddress
    }

    const { subject, html } = generateMeisnerDeliveryEmailTemplate(templateData)

    return NextResponse.json({
      to: client.email,
      subject,
      htmlContent: html,
      previewData: {
        clientName: client.name,
        projectName: currentVersion.stage.room.project.name,
        roomName: currentVersion.stage.room.name || currentVersion.stage.room.type,
        assetCount: emailAssets.length,
        version: currentVersion.version
      }
    })

  } catch (error) {
    console.error('Error generating email preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
