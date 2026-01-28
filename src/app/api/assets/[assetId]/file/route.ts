import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'
import { dropboxService } from '@/lib/dropbox-service'

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assetId } = await params

    // Look up asset
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        orgId: true,
        projectId: true,
        url: true,
        mimeType: true,
        metadata: true,
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Very light auth: require the user to belong to the same organization as the project asset
    // If stricter checks are needed, expand this later
    const hasAccess = await prisma.organization.findFirst({
      where: {
        id: asset.orgId,
        users: { some: { id: session.user.id } }
      },
      select: { id: true }
    })

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse metadata
    let dropboxPath: string | null = null
    try {
      const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : asset.metadata
      dropboxPath = meta?.dropboxPath || null
    } catch {}

    // Check if asset has a direct URL (Vercel Blob or other CDN)
    // Vercel Blob URLs start with https://*.public.blob.vercel-storage.com
    if (asset.url && (
      asset.url.includes('blob.vercel-storage.com') ||
      asset.url.includes('vercel-storage.com') ||
      asset.url.startsWith('https://') && !dropboxPath
    )) {
      // Redirect directly to the blob URL
      return NextResponse.redirect(asset.url, { status: 302 })
    }

    // Fall back to Dropbox if we have a dropboxPath
    if (!dropboxPath) {
      // If no dropboxPath and no valid direct URL, try the stored URL anyway
      if (asset.url) {
        return NextResponse.redirect(asset.url, { status: 302 })
      }
      return NextResponse.json({ error: 'No valid file URL found' }, { status: 400 })
    }

    // Get a temporary direct link from Dropbox
    const tempLink = await dropboxService.getTemporaryLink(dropboxPath)
    if (!tempLink) {
      return NextResponse.json({ error: 'Failed to obtain Dropbox link' }, { status: 502 })
    }

    // Redirect to Dropbox temporary link (works for images and videos)
    return NextResponse.redirect(tempLink, { status: 302 })
  } catch (err) {
    console.error('[AssetFileRoute] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

