import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateMeisnerDeliveryEmailTemplate } from '@/lib/email-templates'
import { getBaseUrl } from '@/lib/get-base-url'
import { dropboxService } from '@/lib/dropbox-service'

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

    // Filter assets based on selected IDs and generate proper URLs
    const assetsToInclude = currentVersion.assets.filter(asset => {
      if (selectedAssetIds.length > 0) {
        return selectedAssetIds.includes(asset.id)
      }
      return asset.includeInEmail
    })
    
    // Generate proper URLs for each asset (async because Dropbox needs API call)
    const emailAssets = await Promise.all(assetsToInclude.map(async (assetItem) => {
      // Prefer Blob URL (fast delivery)
      if (assetItem.blobUrl) {
        return {
          id: assetItem.id,
          url: assetItem.blobUrl,
          includeInEmail: true
        }
      }
      
      // If no Blob URL, try to get Dropbox temporary link
      if (assetItem.asset.provider === 'dropbox' && assetItem.asset.url) {
        try {
          const dropboxPath = assetItem.asset.url.startsWith('/') 
            ? assetItem.asset.url 
            : '/' + assetItem.asset.url
          const temporaryLink = await dropboxService.getTemporaryLink(dropboxPath)
          if (temporaryLink) {
            return {
              id: assetItem.id,
              url: temporaryLink,
              includeInEmail: true
            }
          }
        } catch (error) {
          console.error(`[email-preview] Failed to get Dropbox link for asset ${assetItem.id}:`, error)
        }
      }
      
      // Fallback to existing URL (may not work in email)
      return {
        id: assetItem.id,
        url: assetItem.asset.url || '',
        includeInEmail: true
      }
    }))
    
    // Filter out assets without valid http URLs
    const validEmailAssets = emailAssets.filter(a => a.url && a.url.startsWith('http'))

    // Generate placeholder approval URL
    const baseUrl = getBaseUrl()
    const placeholderApprovalUrl = `${baseUrl}/client-progress/placeholder`

    // Generate email template
    const templateData = {
      clientName: client.name,
      projectName: currentVersion.stage.room.project.name,
      approvalUrl: placeholderApprovalUrl,
      assets: validEmailAssets,
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
        assetCount: validEmailAssets.length,
        version: currentVersion.version
      }
    })

  } catch (error) {
    console.error('Error generating email preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
