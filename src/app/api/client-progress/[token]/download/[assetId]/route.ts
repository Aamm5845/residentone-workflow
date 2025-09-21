import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

// GET /api/client-progress/[token]/download/[assetId] - Secure rendering download
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string; assetId: string } }
) {
  try {
    const { token, assetId } = await params
    const headersList = headers()
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
            rooms: {
              include: {
                stages: {
                  include: {
                    renderingVersions: {
                      where: {
                        status: 'PUSHED_TO_CLIENT',
                        clientApprovalVersion: {
                          clientDecision: 'APPROVED'
                        }
                      },
                      include: {
                        assets: true
                      }
                    }
                  }
                }
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

    // Find the requested asset in approved renderings
    let targetAsset = null
    let renderingVersion = null

    for (const room of clientAccessToken.project.rooms) {
      for (const stage of room.stages) {
        for (const version of stage.renderingVersions) {
          const asset = version.assets.find(a => a.id === assetId)
          if (asset && (asset.type === 'RENDER' || asset.type === 'IMAGE')) {
            targetAsset = asset
            renderingVersion = version
            break
          }
        }
        if (targetAsset) break
      }
      if (targetAsset) break
    }

    if (!targetAsset) {
      return NextResponse.json({ 
        error: 'Asset not found or not available for download' 
      }, { status: 404 })
    }

    // Log the download
    await prisma.clientAccessLog.create({
      data: {
        tokenId: clientAccessToken.id,
        ipAddress,
        userAgent,
        action: 'DOWNLOAD_RENDERING',
        metadata: {
          assetId: targetAsset.id,
          assetTitle: targetAsset.title,
          renderingVersion: renderingVersion?.version,
          timestamp: new Date().toISOString()
        }
      }
    })

    // For direct file URLs (like S3 or Dropbox), redirect to the asset URL
    // For local files, you might want to stream the file content
    if (targetAsset.url.startsWith('http')) {
      // Create a temporary redirect with download headers
      const response = NextResponse.redirect(targetAsset.url)
      response.headers.set('Content-Disposition', `attachment; filename="${targetAsset.title || 'rendering'}"`)
      return response
    } else {
      // For local files, you would implement file streaming here
      return NextResponse.json({ 
        error: 'Download not available for this asset type' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Error downloading asset:', error)
    return NextResponse.json({ 
      error: 'Download failed' 
    }, { status: 500 })
  }
}