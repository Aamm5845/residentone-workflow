import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Check if a URL is accessible (for Blob URLs)
 */
async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// GET /api/assets/[assetId]/view - View/download asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const { assetId } = resolvedParams

    // Get asset from database
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        project: true
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Check if user has access to this asset's project
    if (session?.user?.id) {
      // Check if user is part of the organization
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { orgId: true }
      })

      if (!user || user.orgId !== asset.orgId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Parse metadata to check for blobUrl
    let metadata: Record<string, any> = {}
    try {
      if (typeof asset.metadata === 'string') {
        metadata = JSON.parse(asset.metadata || '{}')
      } else if (asset.metadata && typeof asset.metadata === 'object') {
        metadata = asset.metadata as Record<string, any>
      }
    } catch {
      metadata = {}
    }

    // Priority 1: Try Blob URL from metadata (fastest access)
    if (metadata.blobUrl && metadata.blobUrl.startsWith('http')) {
      // Verify URL is accessible before redirecting
      const accessible = await isUrlAccessible(metadata.blobUrl)
      if (accessible) {
        return NextResponse.redirect(metadata.blobUrl)
      }
      console.warn(`[Asset View] Blob URL not accessible for asset ${assetId}, falling back`)
    }

    // Priority 2: If provider is blob and URL is http, use it directly
    if (asset.provider === 'blob' && asset.url?.startsWith('http')) {
      const accessible = await isUrlAccessible(asset.url)
      if (accessible) {
        return NextResponse.redirect(asset.url)
      }
      console.warn(`[Asset View] Primary blob URL not accessible for asset ${assetId}, trying Dropbox fallback`)
    }

    // Priority 3: If stored in Dropbox or has Dropbox fallback
    const dropboxPath = metadata.dropboxPath || (asset.provider === 'dropbox' ? asset.url : null)
    if (dropboxPath && dropboxPath.startsWith('/')) {
      try {
        // Get temporary link from Dropbox (valid for 4 hours)
        const tempLink = await dropboxService.getTemporaryLink(dropboxPath)

        if (tempLink) {
          return NextResponse.redirect(tempLink)
        }
      } catch (error) {
        console.error('[Asset View] Failed to get Dropbox link:', error)
      }
    }

    // Priority 4: For any HTTP URLs (including Dropbox shared links), redirect directly
    if (asset.url?.startsWith('http')) {
      return NextResponse.redirect(asset.url)
    }

    // Priority 5: For base64 data URLs (dev only), serve directly
    if (asset.url?.startsWith('data:')) {
      const [header, data] = asset.url.split(',')
      const mimeMatch = header.match(/data:([^;]+);base64/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream'

      const buffer = Buffer.from(data, 'base64')

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    }

    return NextResponse.json({ error: 'Invalid asset URL' }, { status: 400 })

  } catch (error) {
    console.error('[Asset View] Error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve asset'
    }, { status: 500 })
  }
}
