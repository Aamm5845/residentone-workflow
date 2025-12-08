import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateMeisnerDeliveryEmailTemplate } from '@/lib/email-templates'
import { generateClientApprovalToken } from '@/lib/jwt'
import { dropboxService } from '@/lib/dropbox-service'
import { getBaseUrl } from '@/lib/get-base-url'

// GET /api/email/preview/[versionId] - Preview email for a client approval version
export async function GET(
  request: NextRequest,
  { params }: { params: { versionId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { versionId } = await params

    // Get version details with all necessary relationships - simplified to match client approval API
    const version = await prisma.clientApprovalVersion.findFirst({
      where: {
        id: versionId
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
          where: {
            includeInEmail: true
          },
          include: {
            asset: true
          }
        }
      }
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const client = version.stage.room.project.client
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Generate preview token
    const token = generateClientApprovalToken({
      versionId: version.id,
      clientEmail: client.email,
      clientName: client.name,
      projectId: version.stage.room.project.id
    })

    const approvalUrl = `${getBaseUrl()}/approve/${token}`

    // Transform assets for the template - use Blob URLs (fast, reliable)
    const templateAssets = version.assets.map((assetItem) => {
      // Prefer Blob URL (fast delivery), fallback to original asset URL
      const viewableUrl = assetItem.blobUrl || assetItem.asset.url
      
      if (!assetItem.blobUrl) {
        console.warn(`[Preview] ⚠️ Asset ${assetItem.id} has no Blob URL, using original URL`)
      }
      
      return {
        id: assetItem.id,
        url: viewableUrl,
        includeInEmail: assetItem.includeInEmail
      }
    })

    // Generate the email HTML
    const { subject, html } = generateMeisnerDeliveryEmailTemplate({
      clientName: client.name,
      projectName: version.stage.room.project.name,
      approvalUrl,
      assets: templateAssets,
      roomName: version.stage.room.name || version.stage.room.type,
      designPhase: 'Client Approval',
      projectAddress: version.stage.room.project.address,
      trackingPixelUrl: `${getBaseUrl()}/api/email/track/preview`
    })

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    if (format === 'html') {
      // Return raw HTML for iframe preview
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      })
    }

    // Return structured data
    return NextResponse.json({
      subject,
      html,
      previewData: {
        clientName: client.name,
        clientEmail: client.email,
        projectName: version.stage.room.project.name,
        roomName: version.stage.room.name || version.stage.room.type,
        assetCount: templateAssets.length,
        version: version.version
      }
    })

  } catch (error) {
    console.error('Error generating email preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}