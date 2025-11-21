import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

// GET /api/client-progress/[token]/view/[assetId] - Serve image for inline viewing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; assetId: string }> }
) {
  try {
    const { token, assetId } = await params

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

    for (const room of clientAccessToken.project.rooms) {
      for (const stage of room.stages) {
        for (const version of stage.renderingVersions) {
          const asset = version.assets.find(a => a.id === assetId)
          if (asset && (asset.type === 'RENDER' || asset.type === 'IMAGE')) {
            targetAsset = asset
            break
          }
        }
        if (targetAsset) break
      }
      if (targetAsset) break
    }

    if (!targetAsset) {
      return NextResponse.json({ 
        error: 'Asset not found or not available' 
      }, { status: 404 })
    }

    // If it's already a public URL (http/https), redirect to it
    if (targetAsset.url.startsWith('http')) {
      return NextResponse.redirect(targetAsset.url)
    }

    // If it's a Dropbox path, fetch and serve the file
    if (targetAsset.provider === 'dropbox' || targetAsset.url.startsWith('/')) {
      try {
        const dropboxPath = targetAsset.url.startsWith('/') ? targetAsset.url : '/' + targetAsset.url
        const fileBuffer = await dropboxService.downloadFile(dropboxPath)
        
        // Determine content type
        const contentType = targetAsset.mimeType || 'image/jpeg'
        
        // Return the file with appropriate headers
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Disposition': 'inline'
          }
        })
      } catch (error) {
        console.error('Error fetching asset from Dropbox:', error)
        return NextResponse.json({ 
          error: 'Failed to load image from storage' 
        }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      error: 'Asset URL format not supported' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error viewing asset:', error)
    return NextResponse.json({ 
      error: 'Failed to load image' 
    }, { status: 500 })
  }
}
