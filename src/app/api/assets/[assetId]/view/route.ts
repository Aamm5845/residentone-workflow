import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const maxDuration = 30

// GET /api/assets/[assetId]/view - View/download asset from Dropbox
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

    // If stored in Dropbox, get temporary download link
    if (asset.provider === 'dropbox' && asset.url.startsWith('/')) {
      try {
        // Get temporary link from Dropbox (valid for 4 hours)
        const tempLink = await dropboxService.getTemporaryLink(asset.url)
        
        if (!tempLink) {
          throw new Error('Failed to get Dropbox download link')
        }

        // Redirect to Dropbox temporary link
        return NextResponse.redirect(tempLink)
      } catch (error) {
        console.error('[Asset View] Failed to get Dropbox link:', error)
        return NextResponse.json({ 
          error: 'Failed to retrieve file from Dropbox' 
        }, { status: 500 })
      }
    }

    // For Vercel Blob or other URLs, redirect directly
    if (asset.url.startsWith('http')) {
      return NextResponse.redirect(asset.url)
    }

    // For base64 data URLs (dev only), serve directly
    if (asset.url.startsWith('data:')) {
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
